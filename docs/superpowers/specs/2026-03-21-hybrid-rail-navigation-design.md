# Hybrid Rail Navigation — Design Spec

## Overview

Orbit is growing beyond a single-screen layout. The Hybrid Rail introduces a top-level navigation system: a narrow vertical rail on the far left with icon + label pairs, each representing a View. This follows the left-to-right drill-down principle (View → Section → Detail), similar to VS Code, MS Teams, or a file explorer. The current Navigator + Workbench + Action Rail layout becomes the content of the first View ("Arbeit").

### ADHD Relevance

- **Spatial stability**: The rail never moves, reorders, or changes. Users orient by position.
- **Zero cognitive cost**: Icon + label means no guessing what an icon means.
- **Extensibility without overwhelm**: New views are added as a single new entry — the rail stays calm even as Orbit grows.

## Architecture

### View Model

```typescript
interface OrbitView {
  id: string;
  label: string;
  icon: string; // Lucide icon name, e.g. 'zap', 'calendar'
}
```

Views are defined statically in the app component. No dynamic registration or lazy discovery — keep it simple.

Initial views:

| ID | Label | Icon | Content |
|----|-------|------|---------|
| `arbeit` | Arbeit | lightning bolt / Zap | Existing Navigator + Workbench + Action Rail |
| `timeline` | Timeline | calendar / history | Timeline view (built in separate spec) |

Future candidates (not part of this spec): Tools, Einstellungen.

### Component Structure

```
AppComponent
├── HybridRailComponent        ← NEW: the nav rail
├── ViewArbeitComponent         ← NEW: wraps existing layout
│   ├── NavigatorComponent
│   ├── WorkbenchComponent
│   └── ActionRailComponent
├── ViewTimelineComponent       ← placeholder, built later
└── QuickCaptureComponent       ← stays at app level (overlay)
```

- `HybridRailComponent` — renders the rail, emits view selection
- `ViewArbeitComponent` — extracts the current `app.html` layout into its own component
- Active view is a signal on `AppComponent`, toggled by the rail
- Views are rendered with `@switch` on the active view ID — no router needed, instant switching, no URL state

### Why No Router

Orbit lives on a second monitor as an always-open tool. URL-based navigation adds complexity (history management, deep linking, guards) with no benefit here. A simple signal-driven `@switch` keeps view transitions instant and the mental model simple.

## UI Design

### Rail Specifications

- **Width**: 64px
- **Background**: `bg-stone-900` (dark, creates clear separation from content)
- **Position**: Far left, full height
- **Orbit logo**: Centered at the top (28×28px indigo circle with white ring), separated from view items by a subtle `border-b border-white/[0.06]` line. This is the only place the Orbit branding lives.
- **Item layout**: Icon above label, vertically centered in a ~52×48px hit area
- **Active indicator**: Item background `bg-indigo-600` with white icon/label
- **Inactive**: Icon and label in `text-stone-400`, hover → `text-stone-200`
- **Spacing**: Items grouped below the logo, separated by 4px gap

### Rail Anatomy

```
┌──────────┐
│  (logo)   │  ← Orbit circle, 28×28
├──────────┤  ← subtle separator
│   [icon]  │  ← 20×20 SVG, stroke style
│   Label   │  ← 10px font, medium weight
│           │
│   [icon]  │
│   Label   │
└──────────┘
```

### Navigator Header

Since the Orbit logo moves to the rail, the navigator header no longer displays the logo. Instead it shows the active view name (e.g. "Arbeit") as a section title, with "Dein Command Center" as subtitle.

### Full Layout

```
┌────┬──────────────────────────────────────┐
│    │                                      │
│ ⚡ │  ┌─Navigator─┬──Workbench──┬─Rail─┐  │
│Arb │  │           │             │      │  │
│    │  │           │             │      │  │
│ 📅 │  │           │             │      │  │
│Time│  │           │             │      │  │
│    │  └───────────┴─────────────┴──────┘  │
│    │                                      │
└────┴──────────────────────────────────────┘
 64px              remaining width
```

### Icons

Use Lucide icons (already used elsewhere in Orbit) as inline SVGs:

- **Arbeit**: `Zap` (lightning bolt)
- **Timeline**: `Calendar` or `History`

### Accessibility

- Rail is a `<nav>` element with `aria-label="Hauptnavigation"`
- Each item is a `<button>` with `aria-current="page"` when active
- Focus visible styles on all interactive elements
- Keyboard: Tab into rail, Arrow Up/Down to navigate items, Enter/Space to activate

## State Management

```typescript
// In AppComponent
activeView = signal<string>('arbeit');
```

- Persisted to `localStorage` key `orbit.activeView` so Orbit remembers which view was open
- Default: `'arbeit'`

## Migration Path

The existing `app.html` template moves almost entirely into `ViewArbeitComponent`. The new `app.html` becomes:

```html
<div class="flex h-screen overflow-hidden">
  <app-hybrid-rail
    [activeView]="activeView()"
    (viewChange)="activeView.set($event)" />

  @switch (activeView()) {
    @case ('arbeit') {
      <app-view-arbeit class="flex-1 overflow-hidden" />
    }
    @case ('timeline') {
      <app-view-timeline class="flex-1 overflow-hidden" />
    }
  }
</div>
<app-quick-capture [open]="overlayOpen()" (close)="onOverlayClose()" />
```

`ViewArbeitComponent` contains the existing layout verbatim — no changes to Navigator, Workbench, or Action Rail. The `onKeydown` handler (Cmd+K), `overlayOpen` signal, and `QuickCaptureComponent` remain in `AppComponent` since the overlay spans all views.

## Testing

- `HybridRailComponent`: renders all view items, active state matches input, click emits correct view ID, keyboard navigation works
- `AppComponent`: switching views shows correct content, persists to localStorage
- `ViewArbeitComponent`: renders existing layout unchanged
- Accessibility: axe checks pass, focus management works

## Scope Boundaries

**In scope:**
- HybridRailComponent with static view definitions
- ViewArbeitComponent extracting existing layout
- ViewTimelineComponent as empty placeholder
- localStorage persistence of active view
- Keyboard and screen reader accessibility

**Out of scope:**
- Timeline content (separate spec)
- Tagesrhythmus features (separate spec)
- Animation/transitions between views
- Route-based navigation
