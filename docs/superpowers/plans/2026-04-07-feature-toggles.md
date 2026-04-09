# Feature Toggles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a centralized feature toggle system that lets users opt into experimental features via a dynamically rendered settings section.

**Architecture:** A `FeatureToggleService` holds a typed registry of toggle definitions (boolean or select). User choices persist in `settings.json` under an `experiments` key. A new `ExperimentSectionComponent` at the bottom of the settings page renders controls dynamically from the registry.

**Tech Stack:** Angular 21 (signals, standalone components, OnPush), Vitest, Tailwind CSS with semantic tokens, Lucide Angular icons.

---

### Task 1: Extend the Settings Model

**Files:**

- Modify: `src/app/settings/settings.model.ts`
- Modify: `src/app/settings/settings.service.ts`
- Modify: `src/app/settings/settings.service.spec.ts`

- [ ] **Step 1: Add `experiments` to `OrbitSettings` interface**

In `src/app/settings/settings.model.ts`, add the `experiments` field to the `OrbitSettings` interface and the default in `createDefaultSettings()`:

```typescript
// Add to OrbitSettings interface, after appearance:
experiments: Record<string, string | boolean>;
```

```typescript
// Add to createDefaultSettings() return object, after appearance:
experiments: {},
```

- [ ] **Step 2: Update `SettingsService.load()` to merge experiments**

In `src/app/settings/settings.service.ts`, inside `load()`, add the experiments merge after the existing merges (after line 50):

```typescript
settings.experiments = { ...defaults.experiments, ...settings.experiments };
```

- [ ] **Step 3: Update `SettingsService.save()` to merge experiments**

In `src/app/settings/settings.service.ts`, inside `save()`, add the experiments merge after the existing merges (after line 62):

```typescript
result.experiments = { ...defaults.experiments, ...result.experiments };
```

- [ ] **Step 4: Update the existing settings service spec**

In `src/app/settings/settings.service.spec.ts`, the `createDefaultSettings()` call in the first test will now include `experiments: {}`. Verify the existing tests still pass:

Run: `npx ng test --no-watch`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/settings.model.ts src/app/settings/settings.service.ts src/app/settings/settings.service.spec.ts
git commit -m "feat(settings): add experiments field to OrbitSettings model"
```

---

### Task 2: Create the FeatureToggleService

**Files:**

- Create: `src/app/settings/feature-toggle.model.ts`
- Create: `src/app/settings/feature-toggle.service.ts`
- Create: `src/app/settings/feature-toggle.service.spec.ts`

- [ ] **Step 1: Write the toggle definition types**

Create `src/app/settings/feature-toggle.model.ts`:

```typescript
interface BaseToggleDefinition {
  id: string;
  label: string;
  description: string;
}

export interface BooleanToggle extends BaseToggleDefinition {
  type: 'boolean';
  defaultValue: boolean;
}

export interface SelectToggle extends BaseToggleDefinition {
  type: 'select';
  options: { value: string; label: string }[];
  defaultValue: string;
}

export type ToggleDefinition = BooleanToggle | SelectToggle;
```

- [ ] **Step 2: Write the failing tests**

Create `src/app/settings/feature-toggle.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { FeatureToggleService } from './feature-toggle.service';
import { SettingsService } from './settings.service';
import { signal } from '@angular/core';
import { createDefaultSettings } from './settings.model';

describe('FeatureToggleService', () => {
  function setup(experiments: Record<string, string | boolean> = {}) {
    const settings = signal({ ...createDefaultSettings(), experiments });
    TestBed.configureTestingModule({
      providers: [FeatureToggleService, { provide: SettingsService, useValue: { settings } }],
    });
    return TestBed.inject(FeatureToggleService);
  }

  it('should return default value when no experiment is saved', () => {
    const service = setup();
    const definitions = service.getDefinitions();
    for (const def of definitions) {
      expect(service.getValue(def.id)()).toBe(def.defaultValue);
    }
  });

  it('should return saved value when experiment is set', () => {
    const defs = new FeatureToggleService({
      settings: signal(createDefaultSettings()),
    } as SettingsService).getDefinitions();
    if (defs.length === 0) return;

    const firstDef = defs[0];
    const overrideValue =
      firstDef.type === 'boolean' ? !firstDef.defaultValue : firstDef.defaultValue;
    const service = setup({ [firstDef.id]: overrideValue });
    expect(service.getValue(firstDef.id)()).toBe(overrideValue);
  });

  it('should return default for unknown toggle id', () => {
    const service = setup();
    expect(service.getValue('nonexistent-toggle')()).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx ng test --no-watch`
Expected: FAIL — `FeatureToggleService` does not exist yet.

- [ ] **Step 4: Implement the service**

Create `src/app/settings/feature-toggle.service.ts`:

```typescript
import { computed, inject, Injectable } from '@angular/core';
import { SettingsService } from './settings.service';
import { ToggleDefinition } from './feature-toggle.model';

const TOGGLE_REGISTRY: ToggleDefinition[] = [];

@Injectable({ providedIn: 'root' })
export class FeatureToggleService {
  private readonly settingsService = inject(SettingsService);

  getDefinitions(): ToggleDefinition[] {
    return TOGGLE_REGISTRY;
  }

  getValue(id: string) {
    return computed(() => {
      const experiments = this.settingsService.settings().experiments;
      const definition = TOGGLE_REGISTRY.find((d) => d.id === id);
      if (!definition) return experiments[id];
      return experiments[id] ?? definition.defaultValue;
    });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/settings/feature-toggle.model.ts src/app/settings/feature-toggle.service.ts src/app/settings/feature-toggle.service.spec.ts
git commit -m "feat(settings): add FeatureToggleService with typed toggle registry"
```

---

### Task 3: Create the Experiment Section Component

**Files:**

- Create: `src/app/settings/view-settings/experiment-section/experiment-section.ts`
- Create: `src/app/settings/view-settings/experiment-section/experiment-section.html`
- Create: `src/app/settings/view-settings/experiment-section/experiment-section.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/settings/view-settings/experiment-section/experiment-section.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExperimentSectionComponent } from './experiment-section';
import { FeatureToggleService } from '../../feature-toggle.service';
import { BooleanToggle, SelectToggle } from '../../feature-toggle.model';

describe('ExperimentSectionComponent', () => {
  const booleanToggle: BooleanToggle = {
    id: 'test-bool',
    type: 'boolean',
    defaultValue: false,
    label: 'Test-Funktion',
    description: 'Eine Testfunktion',
  };

  const selectToggle: SelectToggle = {
    id: 'test-select',
    type: 'select',
    defaultValue: 'a',
    options: [
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B' },
    ],
    label: 'Test-Auswahl',
    description: 'Eine Testauswahl',
  };

  function setup(
    definitions: (BooleanToggle | SelectToggle)[] = [],
    experiments: Record<string, string | boolean> = {},
  ) {
    TestBed.configureTestingModule({
      imports: [ExperimentSectionComponent],
      providers: [
        {
          provide: FeatureToggleService,
          useValue: {
            getDefinitions: () => definitions,
            getValue: (id: string) => {
              const def = definitions.find((d) => d.id === id);
              return () => experiments[id] ?? def?.defaultValue;
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ExperimentSectionComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should not render when there are no definitions', () => {
    const fixture = setup([]);
    expect(fixture.nativeElement.querySelector('[data-section]')).toBeNull();
  });

  it('should render a checkbox for boolean toggles', () => {
    const fixture = setup([booleanToggle]);
    const checkbox = fixture.nativeElement.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeTruthy();
    expect(checkbox.checked).toBe(false);
  });

  it('should render radio buttons for select toggles', () => {
    const fixture = setup([selectToggle]);
    const radios = fixture.nativeElement.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBe(2);
  });

  it('should show warning text', () => {
    const fixture = setup([booleanToggle]);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('aktiver Entwicklung');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch`
Expected: FAIL — `ExperimentSectionComponent` does not exist.

- [ ] **Step 3: Implement the component template**

Create `src/app/settings/view-settings/experiment-section/experiment-section.html`:

```html
@if (definitions.length > 0) {
<section data-section="experimente" id="section-experimente" class="mb-12">
  <div class="flex items-center gap-2 mb-1">
    <lucide-angular
      name="flask-conical"
      class="text-[var(--color-text-muted)]"
      [size]="18"
    ></lucide-angular>
    <h3 class="text-lg font-bold text-[var(--color-text-heading)]">Experimentelle Funktionen</h3>
  </div>
  <p class="text-sm text-[var(--color-signal-text)] mb-5">
    Diese Funktionen befinden sich in aktiver Entwicklung. Sie können instabil sein, sich jederzeit
    ändern oder entfernt werden.
  </p>

  @for (def of definitions; track def.id) {
  <div class="bg-[var(--color-bg-card)] rounded-xl p-5 mb-4">
    @switch (def.type) { @case ('boolean') {
    <div class="flex items-center justify-between">
      <div>
        <h4 class="font-bold text-[var(--color-text-heading)]">{{ def.label }}</h4>
        <p class="text-sm text-[var(--color-text-muted)] mt-0.5">{{ def.description }}</p>
      </div>
      <label class="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
        <input
          type="checkbox"
          class="sr-only peer"
          [checked]="getValue(def.id)()"
          (change)="onToggle(def.id, $any($event.target).checked)"
        />
        <div
          class="w-9 h-5 bg-[var(--color-bg-surface)] rounded-full peer peer-checked:bg-violet-500
                  after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-[var(--color-bg-card)]
                  after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"
        ></div>
      </label>
    </div>
    } @case ('select') {
    <div>
      <h4 class="font-bold text-[var(--color-text-heading)]">{{ def.label }}</h4>
      <p class="text-sm text-[var(--color-text-muted)] mt-0.5 mb-3">{{ def.description }}</p>
      <div class="flex flex-col gap-2">
        @for (option of def.options; track option.value) {
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            [name]="def.id"
            [value]="option.value"
            [checked]="getValue(def.id)() === option.value"
            (change)="onToggle(def.id, option.value)"
            class="accent-violet-500"
          />
          <span class="text-sm text-[var(--color-text-body)]">{{ option.label }}</span>
        </label>
        }
      </div>
    </div>
    } }
  </div>
  }
</section>
}
```

- [ ] **Step 4: Implement the component class**

Create `src/app/settings/view-settings/experiment-section/experiment-section.ts`:

```typescript
import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { FeatureToggleService } from '../../feature-toggle.service';
import { ToggleDefinition } from '../../feature-toggle.model';

@Component({
  selector: 'app-experiment-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './experiment-section.html',
})
export class ExperimentSectionComponent {
  private readonly featureToggleService = inject(FeatureToggleService);

  readonly definitions: ToggleDefinition[] = this.featureToggleService.getDefinitions();
  readonly experimentChanged = output<{ id: string; value: string | boolean }>();

  getValue(id: string) {
    return this.featureToggleService.getValue(id);
  }

  onToggle(id: string, value: string | boolean): void {
    this.experimentChanged.emit({ id, value });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/settings/view-settings/experiment-section/
git commit -m "feat(settings): add ExperimentSectionComponent with dynamic toggle rendering"
```

---

### Task 4: Integrate into View Settings

**Files:**

- Modify: `src/app/settings/view-settings/view-settings.ts`
- Modify: `src/app/settings/view-settings/view-settings.html`

- [ ] **Step 1: Add the experiment section to the navigation sidebar**

In `src/app/settings/view-settings/view-settings.ts`, add to the `sections` array after the `darstellung` entry:

```typescript
{ id: 'experimente', label: 'Experimentell', children: [] },
```

- [ ] **Step 2: Import the ExperimentSectionComponent**

In `src/app/settings/view-settings/view-settings.ts`, add to imports array in `@Component`:

```typescript
imports: [FormsModule, KeyValuePipe, ExperimentSectionComponent],
```

Add the import statement at the top:

```typescript
import { ExperimentSectionComponent } from './experiment-section/experiment-section';
```

- [ ] **Step 3: Add the `updateExperiment` method**

In `src/app/settings/view-settings/view-settings.ts`, add a method:

```typescript
updateExperiment(id: string, value: string | boolean): void {
  this.updateDraft(d => d.experiments[id] = value);
}
```

- [ ] **Step 4: Add the experiment section to the template**

In `src/app/settings/view-settings/view-settings.html`, add after the closing `</section>` of the "Darstellung" section (after line 436, before the closing `</div>` tags):

```html
<!-- Section: Experimentelle Funktionen -->
<app-experiment-section (experimentChanged)="updateExperiment($event.id, $event.value)">
</app-experiment-section>
```

- [ ] **Step 5: Run tests and build**

Run: `npx ng test --no-watch && npx ng build`
Expected: All tests pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/settings/view-settings/view-settings.ts src/app/settings/view-settings/view-settings.html
git commit -m "feat(settings): integrate experiment section into settings page"
```

---

### Task 5: Update AGENTS.md

**Files:**

- Modify: `AGENTS.md`

- [ ] **Step 1: Add feature toggle rule**

In `AGENTS.md`, add a new section after the "After Making Changes" section (after line 106):

```markdown
### Feature Toggles

- New features that are not yet stable or complete must be developed behind a feature toggle using `FeatureToggleService`
- Register the feature in the toggle registry (`TOGGLE_REGISTRY` in `src/app/settings/feature-toggle.service.ts`) with `defaultValue: false` (off by default)
- Guard all UI entry points with the toggle signal
- Only remove the toggle when the feature is considered finished and stable
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add feature toggle guidelines to AGENTS.md"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx ng test --no-watch`
Expected: All tests pass.

- [ ] **Step 2: Run build**

Run: `npx ng build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Verify visually (manual)**

Start the dev server and verify:

- Settings page loads correctly
- "Experimentell" appears in left nav
- When the toggle registry is empty, the section does not render
- (To test rendering, temporarily add a toggle definition to the registry)
