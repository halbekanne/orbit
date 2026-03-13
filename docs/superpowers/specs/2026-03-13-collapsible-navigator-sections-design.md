# Collapsible Navigator Sections

**Date:** 2026-03-13
**Status:** Approved

## Overview

The three navigator sections (Aktuelle Tickets, Pull Requests, Meine Todos) can be individually collapsed to reduce visual noise. Collapsed sections remain visible as a slim header row that always shows the section's unfinished-count badge — nothing falls out of sight. All sections start expanded by default. Collapse state persists across reloads via localStorage.

## Interaction Design

- The entire section header row is the toggle button (`<button type="button">`, full width)
- Chevron SVG sits at the far right of the header, after the source label (Jira / Bitbucket)
- Base orientation of the chevron SVG: pointing **down** (chevron-down, `0deg` = expanded)
- When collapsed: chevron rotates to `-90deg` (pointing right); transition `rotate 100ms ease`
- Collapsed state: header row gains a subtle `bg-stone-100` background to signal closed state
- Section title text is always fully visible in the header row — never truncated when collapsed

## State Management

Three boolean signals in `NavigatorComponent`, initialized directly from localStorage in their declaration so they hold the correct value before any `effect()` runs:

```ts
private readonly savedCollapsed = this.loadCollapsed();

ticketsCollapsed = signal(this.savedCollapsed.tickets);
prsCollapsed     = signal(this.savedCollapsed.prs);
todosCollapsed   = signal(this.savedCollapsed.todos);

private loadCollapsed(): { tickets: boolean; prs: boolean; todos: boolean } {
  try {
    const raw = localStorage.getItem('orbit.navigator.collapsed');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { tickets: false, prs: false, todos: false };
}
```

An `effect()` persists state back on every change. Because signals are already initialized from localStorage before the effect runs, there is no risk of the effect clobbering persisted values on startup:

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

Badges render only when count > 0. They appear in the header row at all times (expanded and collapsed). Section title text remains visible alongside the badge at all times, ensuring color-blind users are not reliant on badge color alone.

| Section           | Value                         | Color  |
|-------------------|-------------------------------|--------|
| Aktuelle Tickets  | `data.tickets().length`       | Indigo |
| Pull Requests     | `data.awaitingReviewCount()`  | Amber  |
| Meine Todos       | `data.pendingTodoCount()`     | Indigo |

**Tickets badge invariant:** `WorkDataService.tickets` only ever contains active/in-progress tickets assigned to the user — there is no "done" state in the tickets signal. `tickets().length` therefore represents the correct active count. If a done-filter is added to `WorkDataService` in the future, the badge source must be revisited.

**Zero count:** When a section's count is 0, no badge renders. A collapsed section with no badge communicates "nothing needs attention here" — this is the intended behaviour. No "0" badge or empty placeholder is shown.

**Contrast:** `bg-stone-100` background with `text-stone-500` label text passes WCAG AA (contrast ratio ~4.6:1). Badge colors (indigo/amber on their respective light backgrounds) are unchanged from existing implementation and already meet AA.

## Accessibility

- Header toggle is a `<button type="button">` wrapping the full header row
- `[attr.aria-expanded]="!sectionCollapsed()"` — note the inversion: the signal is `collapsed`, so expanded = `!collapsed`
- `aria-controls` points to the section content `id`; content uses `[hidden]="sectionCollapsed()"` (not `@if`) so the referenced element always exists in the DOM — avoids an invalid `aria-controls` reference when collapsed
- Section content IDs: `navigator-tickets-content`, `navigator-prs-content`, `navigator-todos-content`
- Chevron SVG is `aria-hidden="true"`
- Existing `aria-labelledby` on each `<section>` is preserved

**Reduced motion:** The chevron transition is wrapped in `@media (prefers-reduced-motion: no-preference)`. Users with the OS-level reduced-motion preference set will see an instant toggle with no animation.

**Focus management:** The toggle button remains in the DOM at all times (expanded and collapsed), so focus naturally stays on the button after toggling. No explicit focus management is needed.

## Files Changed

| File | Change |
|------|--------|
| `navigator.ts` | Add collapse signals (localStorage-initialized), `loadCollapsed()` helper, `effect()` for persistence, toggle methods: `toggleTickets()`, `togglePrs()`, `toggleTodos()` |
| `navigator.html` | Convert headers to `<button>`, add chevron SVG with rotation class, `[hidden]` on section content, badges for all three sections |

No changes to `WorkDataService` — `tickets().length` is accessed directly in the template.

## Out of Scope

- Keyboard shortcut to collapse/expand sections
- Collapsing all sections at once
- Reordering sections
