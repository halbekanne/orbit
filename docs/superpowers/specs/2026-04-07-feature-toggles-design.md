# Feature Toggles Design

## Overview

A centralized feature toggle system for Orbit that allows experimental and in-progress features to ship on mainline behind toggles. Users can opt into experiments via a dedicated section in the settings UI.

## Data Model

### Toggle Definitions (Code-Only)

Toggle definitions live in `FeatureToggleService` as a typed registry. They are not persisted — they are the source of truth for what experiments exist.

```typescript
interface BaseToggleDefinition {
  id: string;
  label: string;
  description: string;
}

interface BooleanToggle extends BaseToggleDefinition {
  type: 'boolean';
  defaultValue: boolean;
}

interface SelectToggle extends BaseToggleDefinition {
  type: 'select';
  options: { value: string; label: string }[];
  defaultValue: string;
}

type ToggleDefinition = BooleanToggle | SelectToggle;
```

Labels and descriptions are in German (per project rules).

### Persisted State

User choices are stored in the existing `settings.json` under a new `experiments` key:

```json
{
  "connections": { ... },
  "features": { ... },
  "appearance": { ... },
  "experiments": {
    "notes": true,
    "focus-mode": "compact"
  }
}
```

The `experiments` field is typed as `Record<string, string | boolean>`. Keys that no longer match a registry entry are ignored on read — no migration logic needed.

### Settings Model Update

Add to `OrbitSettings`:

```typescript
experiments: Record<string, string | boolean>;
```

Default value: `{}`. The `createDefaultSettings()` function initializes it as an empty object.

## FeatureToggleService

New service at `src/app/settings/feature-toggle.service.ts`, provided in root.

### Responsibilities

- Holds the registry of `ToggleDefinition[]` as a constant
- Reads current values from `SettingsService.settings().experiments`
- Exposes `getValue(id): Signal<string | boolean>` — returns the user's choice, falling back to the definition's `defaultValue` if not set
- Exposes `getDefinitions(): ToggleDefinition[]` — for the settings UI to iterate

### Usage

```typescript
private featureToggle = inject(FeatureToggleService);

readonly notesEnabled = this.featureToggle.getValue('notes');
readonly focusMode = this.featureToggle.getValue('focus-mode');
```

In templates:

```html
@if (notesEnabled()) {
<!-- notes UI -->
} @switch (focusMode()) { @case ('compact') { ... } @case ('expanded') { ... } }
```

### No New Backend Routes

Experiments live inside the existing `OrbitSettings` object. `PUT /api/settings` handles persistence. No changes to `settings-routes.js` needed beyond accepting the new `experiments` field.

## Settings UI

### New Component

`src/app/settings/view-settings/experiment-section/experiment-section.ts`

### Placement

At the bottom of the settings page, below all existing sections. Visually separated with extra spacing and distinct treatment.

### Structure

1. **Section header:** "Experimentelle Funktionen" with a Lucide icon (e.g. `flask-conical`)
2. **Warning text:** "Diese Funktionen befinden sich in aktiver Entwicklung. Sie können instabil sein, sich jederzeit ändern oder entfernt werden."
3. **Toggle list:** Dynamically rendered from `featureToggleService.getDefinitions()`:
   - `type: 'boolean'` renders a checkbox
   - `type: 'select'` renders a radio group
   - Each toggle displays its `label` and `description`

### Integration with Existing Settings

- Participates in the existing dirty-state / draft pattern in `view-settings`
- Changes to experiments mark the form as dirty
- Saving writes everything together via `SettingsService.save()`

### Empty State

When the registry has no definitions, the section is not rendered at all.

## Developer Workflow

### Adding a New Experiment

1. Add a definition to the registry in `FeatureToggleService`:
   ```typescript
   { id: 'notes', type: 'boolean', defaultValue: false, label: 'Notizen', description: 'Persoenliche Notizen zu Tickets und PRs' }
   ```
2. Use the toggle in your component via `featureToggleService.getValue('notes')`
3. The settings UI picks it up automatically.

### Graduating a Feature

When an experiment is finished and stable, remove the registry entry and remove the toggle guards from the code. The feature becomes part of the core experience. Dead keys left in `settings.json` are harmless and ignored.

If the feature should remain optional for users, move it to `settings.features` with a proper typed interface and add it to the "Funktionen" section manually.

### Removing an Experiment

Delete the registry entry and remove usages from components. Dead keys in `settings.json` are ignored.

## Testing

### FeatureToggleService

- Returns default values when no experiments are saved
- Returns user values when present in settings
- Falls back to default for unknown/missing keys
- Ignores keys in settings that have no matching definition

### ExperimentSection Component

- Renders checkboxes for boolean toggles
- Renders radio groups for select toggles
- Does not render when registry is empty
- Integrates with dirty-state tracking

### Mocking in Other Tests

Mock `FeatureToggleService` the same way `SettingsService` is mocked today — provide it with signal values:

```typescript
{ provide: FeatureToggleService, useValue: { getValue: (id: string) => signal(false) } }
```

## AGENTS.md Update

Add the following rule:

- New features that are not yet stable or complete must be developed behind a feature toggle using `FeatureToggleService`
- Register the feature in the toggle registry with `defaultValue: false` (off by default)
- Guard all UI entry points with the toggle signal
- Only remove the toggle when the feature is considered finished and stable
