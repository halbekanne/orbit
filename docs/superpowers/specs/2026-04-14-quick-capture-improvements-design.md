# Quick Capture UX/UI Improvements

**Issue:** #8 — Quick Capture UX/UI verbessern  
**Date:** 2026-04-14  
**Branch:** feature/quick-capture-improvements

## Problem

Quick Capture has two UX gaps:
1. No visible save/cancel affordance — users don't know how to interact with the modal
2. The feature is undiscoverable — no visual indicator that it exists, only an invisible keyboard shortcut (Cmd+K / Ctrl+K)

## Design Decisions

- Keep Quick Capture as minimal as possible — no additional form fields, no extra UI complexity
- Keyboard hints instead of clickable buttons (target audience is keyboard-focused developers)
- Direct changes to existing components, no new component files

## Changes

### 1. Keyboard Hints in Quick Capture Modal

Add a hint line below the mode toggle (Aufgabe/Idee buttons):

```
↵ Speichern · Esc Abbrechen · Tab Wechseln
```

- Purely informational text, no clickable elements
- Styled with `text-xs`, `text-[var(--color-text-muted)]`, centered, `mt-2`
- Documents all three keyboard interactions (Enter, Escape, Tab) that are currently undiscoverable

**File:** `src/app/shared/quick-capture/quick-capture.ts`

### 2. Quick Capture Button in App Rail

Add a button directly below the logo area, above the navigation items.

- Same sizing as nav buttons: `w-[52px] h-12`
- Lucide `LucidePlus` icon in `violet-400`
- Label below icon: `⌘K` on macOS, `Ctrl+K` on other platforms (same `text-[10px]` style as view labels)
- Hover state matching inactive nav buttons: `hover:bg-stone-800`, `hover:text-stone-200`
- Separated from navigation by the existing logo area border-bottom — no extra separator needed
- Emits a new `quickCapture` output event, wired through `app.ts` to set `overlayOpen`
- Platform detection via `navigator.platform` for shortcut label

**Files:** `src/app/shared/app-rail/app-rail.ts`, `src/app/app.html`, `src/app/app.ts`

### 3. Empty State Hint in Workbench

Extend the existing workbench empty state ("Bereit loszulegen?") with a Quick Capture hint.

Add below the existing paragraph:

```
Oder drücke ⌘K für Quick Capture
```

- Same style as existing text: `text-sm`, `text-[var(--color-text-muted)]`
- Shortcut rendered as `<kbd>` element (subtle visual distinction)
- Platform-aware: `⌘K` on macOS, `Ctrl+K` on other platforms

**File:** `src/app/shared/workbench/workbench.ts` (or `.html`)

## Scope

Three focused changes to existing components. No new files, no new services, no architectural changes.

## Out of Scope

- Save confirmation / feedback after capture
- Multi-capture (staying open after save)
- Additional form fields (description, urgency, tags)
- Hints in other views (Builds, Logbuch)
