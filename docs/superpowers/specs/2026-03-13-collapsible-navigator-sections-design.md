# Collapsible Navigator Sections

**Date:** 2026-03-13
**Status:** Approved

## Overview

The three navigator sections (Aktuelle Tickets, Pull Requests, Meine Todos) can be individually collapsed to reduce visual noise. Collapsed sections remain visible as a slim header row that always shows the section's unfinished-count badge — nothing falls out of sight. All sections start expanded by default. Collapse state persists across reloads via localStorage.

## Interaction Design

- The entire section header row is the toggle button (`<button>`, full width)
- Chevron SVG sits at the far right of the header, after the source label (Jira / Bitbucket)
- When collapsed: chevron rotates `-90deg`; transition `rotate 100ms ease` (within ≤150ms low-motion budget)
- Collapsed state: header row gains a subtle `bg-stone-100` background to signal closed state
- Section content (`<ul>` and the Todos inline input) is removed from the DOM with `@if` when collapsed

## State Management

Three boolean signals in `NavigatorComponent`:

```ts
ticketsCollapsed = signal(false);
prsCollapsed     = signal(false);
todosCollapsed   = signal(false);
```

Initialized by reading `localStorage.getItem('orbit.navigator.collapsed')` — a JSON object `{ tickets: boolean, prs: boolean, todos: boolean }`. If the key is absent or unparseable, all default to `false` (expanded).

An `effect()` writes the current state back on every change:

```ts
effect(() => {
  localStorage.setItem('orbit.navigator.collapsed', JSON.stringify({
    tickets: this.ticketsCollapsed(),
    prs: this.prsCollapsed(),
    todos: this.todosCollapsed(),
  }));
});
```

No new service is needed. All logic lives in `NavigatorComponent`.

## Badges

Badges render only when count > 0. They appear in the header row at all times (expanded and collapsed).

| Section           | Signal                        | Color  |
|-------------------|-------------------------------|--------|
| Aktuelle Tickets  | `data.tickets().length`       | Indigo (new — matches Todos style) |
| Pull Requests     | `data.awaitingReviewCount()`  | Amber  (existing) |
| Meine Todos       | `data.pendingTodoCount()`     | Indigo (existing) |

The Tickets badge is new — it uses `tickets().length` since all listed tickets are active work items with no "done" state.

## Accessibility

- Header toggle is a `<button type="button">` wrapping the full header row
- `aria-expanded` attribute reflects current collapsed state
- `aria-controls` points to the section content element's `id`
- Section content element has a matching `id`
- Chevron SVG is `aria-hidden="true"`
- Existing `aria-labelledby` on each `<section>` is preserved

## Files Changed

| File | Change |
|------|--------|
| `navigator.ts` | Add collapse signals, localStorage init, effect, toggle methods |
| `navigator.html` | Convert headers to buttons, add chevron, conditional content rendering, badges |

No changes to `WorkDataService` — `tickets().length` is accessed directly in the template.

## Out of Scope

- Keyboard shortcut to collapse/expand sections
- Collapsing all sections at once
- Reordering sections
