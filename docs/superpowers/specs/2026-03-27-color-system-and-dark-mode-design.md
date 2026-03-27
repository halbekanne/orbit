# Color System Migration & Dark Mode — Design Spec

> Date: 2026-03-27

## Overview

Migrate Orbit from its current ad-hoc color usage (indigo-based, light-only) to a deliberate, two-tier semantic token system with full dark mode support. The goal is a warm, calm workspace that reduces visual noise and supports ADHD-friendly scanning through exactly three card attention tiers.

### Core Principles

1. **Warm neutrals as foundation.** All backgrounds, surfaces, borders, and text use the `stone` palette — the only Tailwind palette with warm undertones. The result should feel like paper, wood, a good notebook.
2. **Color is sparse and meaningful.** A "normal" card has no color. Color always signals a concrete state.
3. **One attention mechanism.** Three card tiers: inactive (faded), normal (neutral), attention (amber bar). This is the heart of the design.

---

## Token Architecture

### Two-Tier System

**Tier 1 — Semantic Tokens** (~30 CSS custom properties): Broad design concepts that map directly to Tailwind colors and switch between light/dark via `:root` vs `.dark` selector.

**Tier 2 — Component Tokens** (as many as needed): Specific UI elements that reference Tier 1. Example: `--color-pr-approved-badge-bg: var(--color-success-bg)`. Today it points to success-bg; tomorrow it can be decoupled to its own color without touching any component template.

### Implementation

A new file `src/styles/tokens.css` is imported at the top of `styles.css`. It contains both tiers. Components reference tokens via `var()` — either directly in Tailwind arbitrary values (`bg-[var(--color-bg-card)]`) or via Tailwind v4 `@theme` registration for first-class utility names.

Dark mode is controlled by a `dark` class on `<html>`, toggled via:
- On load: check `localStorage.getItem('orbit-theme')`. If no value → follow `window.matchMedia('(prefers-color-scheme: dark)')`.
- A toggle button in the hybrid rail (bottom icon) stores the preference in localStorage.

---

## Tier 1 — Semantic Tokens

### Backgrounds & Surfaces

| Token | Light | Dark |
|---|---|---|
| `--color-bg-page` | `stone-100` | `stone-950` |
| `--color-bg-surface` | `stone-200` | `stone-900` |
| `--color-bg-card` | `white` | `stone-800` |
| `--color-bg-elevated` | `white` | `stone-800` |
| `--color-border-default` | `stone-300` | `stone-600` |
| `--color-border-subtle` | `stone-200` | `stone-700` |

### Text

| Token | Light | Dark |
|---|---|---|
| `--color-text-heading` | `stone-800` | `stone-100` |
| `--color-text-body` | `stone-600` | `stone-300` |
| `--color-text-muted` | `stone-400` | `stone-500` |

### Rail / Navigation

| Token | Light | Dark |
|---|---|---|
| `--color-rail-bg` | `stone-900` | `stone-950` |
| `--color-rail-icon` | `stone-500` | `stone-600` |
| `--color-rail-icon-active` | `white` | `white` |
| `--color-rail-accent` | `violet-500` | `violet-400` |

### Primary (Violet)

| Token | Light | Dark |
|---|---|---|
| `--color-primary-bg` | `violet-50` | `violet-500/12` |
| `--color-primary-bg-hover` | `violet-100` | `violet-500/20` |
| `--color-primary-border` | `violet-200` | `violet-500/25` |
| `--color-primary-solid` | `violet-500` | `violet-400` |
| `--color-primary-solid-hover` | `violet-600` | `violet-300` |
| `--color-primary-text` | `violet-700` | `violet-300` |
| `--color-primary-on-solid` | `white` | `white` |

### Success (Emerald)

| Token | Light | Dark |
|---|---|---|
| `--color-success-bg` | `emerald-50` | `emerald-400/10` |
| `--color-success-border` | `emerald-200` | `emerald-400/20` |
| `--color-success-solid` | `emerald-500` | `emerald-400` |
| `--color-success-text` | `emerald-700` | `emerald-400` |

### Danger (Red)

| Token | Light | Dark |
|---|---|---|
| `--color-danger-bg` | `red-50` | `red-400/10` |
| `--color-danger-border` | `red-200` | `red-400/20` |
| `--color-danger-solid` | `red-500` | `red-400` |
| `--color-danger-text` | `red-700` | `red-400` |

### Signal (Amber)

| Token | Light | Dark |
|---|---|---|
| `--color-signal-bar` | `amber-500` | `amber-500` |
| `--color-signal-text` | `amber-700` | `amber-500` |

### Info (Blue)

| Token | Light | Dark |
|---|---|---|
| `--color-info-text` | `blue-600` | `blue-400` |
| `--color-info-text-hover` | `blue-700` | `blue-300` |

---

## Tier 2 — Component Tokens

These reference Tier 1 and can be individually overridden.

### Card Selection

| Token | References |
|---|---|
| `--color-card-selected-bg` | `var(--color-primary-bg)` |
| `--color-card-selected-ring` | `var(--color-primary-border)` |
| `--color-card-selected-bg-hover` | `var(--color-primary-bg-hover)` |

### Card States

| Token | Value |
|---|---|
| `--card-inactive-opacity-light` | `0.55` |
| `--card-inactive-opacity-dark` | `0.62` |
| `--color-card-attention-bar` | `var(--color-signal-bar)` |

### PR Status Badges

| Token | References |
|---|---|
| `--color-pr-approved-bg` | `var(--color-success-bg)` |
| `--color-pr-approved-text` | `var(--color-success-text)` |
| `--color-pr-approved-border` | `var(--color-success-border)` |
| `--color-pr-in-review-bg` | `var(--color-primary-bg)` |
| `--color-pr-in-review-text` | `var(--color-primary-text)` |
| `--color-pr-in-review-border` | `var(--color-primary-border)` |
| `--color-pr-changes-bg` | `var(--color-danger-bg)` |
| `--color-pr-changes-text` | `var(--color-danger-text)` |
| `--color-pr-changes-border` | `var(--color-danger-border)` |

### Build Status

| Token | References |
|---|---|
| `--color-build-ok` | `var(--color-success-solid)` |
| `--color-build-fail` | `var(--color-danger-solid)` |

### Pomodoro

| Token | References |
|---|---|
| `--color-pomodoro-accent` | `var(--color-primary-solid)` |
| `--color-pomodoro-bg` | `var(--color-primary-bg)` |

### Type Badges (all neutral)

| Token | References |
|---|---|
| `--color-type-badge-bg` | `var(--color-bg-surface)` |
| `--color-type-badge-text` | `var(--color-text-body)` |
| `--color-type-badge-border` | `var(--color-border-default)` |

### Focus Rings

| Token | References |
|---|---|
| `--color-focus-ring` | `var(--color-primary-solid)` |

### Timeline

| Token | References |
|---|---|
| `--color-timeline-now` | `var(--color-danger-solid)` |
| `--color-timeline-grid` | `var(--color-border-subtle)` |

---

## The Three Card States

Every ticket card, PR card, todo card, and idea card falls into exactly one tier. The assignment is derived logically from the item's data — there is no fixed list.

### Inactive — "Ich muss nichts tun"

Same layout as a normal card but faded. The user should scan past it.

- Opacity: 55% (light) / 62% (dark)
- No colored left edge, no colored background
- Examples: Done tickets, approved-by-others PRs, tickets not assigned to me

### Normal — "Mein Thema, normale Priorität"

A clean, neutral card. The default for everything I need to work on.

- White / stone-800 background, subtle border, rounded corners
- No colored left edge, no colored background
- Badges inside the card may carry semantic colors (violet for "In Review", emerald for "Build OK"), but the card itself stays neutral
- Examples: In Progress / In Review tickets with normal priority, fresh PRs awaiting my review

### Attention — "Braucht meine Aufmerksamkeit"

Only visual difference from normal: a thick amber bar on the left edge.

- `border-l-4` with `amber-500` (both light and dark)
- `rounded-r-lg rounded-l-none` (right rounded, left square because of the bar)
- No colored background on the card
- Supplementary inline text like "prio: hoch" or "3d offen" in signal-text color
- Examples: High priority tickets, PRs waiting for review >2 days, PRs needing re-review, own PRs with failed build or requested changes

### Card State Determination Logic

The state is derived from item data using common sense:

**Attention** when: item requires user action AND it's urgent or overdue.
**Normal** when: item requires user action but at normal urgency.
**Inactive** when: user doesn't need to act.

---

## Color Palette Migration

### Indigo → Violet

All `indigo-*` Tailwind classes become their `violet-*` equivalents. This includes:
- Backgrounds: `bg-indigo-50` → `bg-violet-50`, etc.
- Text: `text-indigo-600` → `text-violet-600`, etc.
- Borders: `border-indigo-200` → `border-violet-200`, etc.
- Rings: `ring-indigo-200` → `ring-violet-200`, etc.
- Focus rings: `focus-visible:outline-indigo-500` → `focus-visible:outline-violet-500`, etc.
- RGBA values: `rgba(99, 102, 241, ...)` (indigo-500) → `rgba(139, 92, 246, ...)` (violet-500)
- Hex values: `#818cf8` (indigo-400) → `#a78bfa` (violet-400), `#312e81` (indigo-900) → `#4c1d95` (violet-900)

### Sky → Stone (neutral)

All `sky-*` type badge classes become neutral stone styling:
- `bg-sky-50 text-sky-700 border-sky-200` → type-badge tokens (stone-based)

### Type Badges

All issue type badges ("Fehler", "Aufgabe", "User Story", "Verbesserung") use the same neutral stone styling. No type gets its own color. Only status badges carry semantic colors.

---

## Dark Mode Implementation

### Strategy

Use Tailwind's `dark:` prefix system. The `dark` class on `<html>` is controlled by JavaScript.

### Theme Initialization (in index.html or app bootstrap)

```javascript
const stored = localStorage.getItem('orbit-theme');
if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
}
```

### Toggle Service

A minimal Angular service (`ThemeService`) that:
- Exposes a `theme` signal (`'light' | 'dark' | 'system'`)
- Toggles `dark` class on `<html>`
- Persists choice to localStorage under `orbit-theme`
- Listens to `prefers-color-scheme` changes when set to `system`

### Toggle UI

A sun/moon icon button at the bottom of the hybrid rail. Clicking cycles: system → light → dark → system.

### Dark Mode Principles

- **Warm black, not cold gray.** `stone-950` and `stone-900` have warm undertones. Never use `gray`, `slate`, or `zinc`.
- **Text is warm-beige, not pure white.** `stone-100` / `stone-200` for heading/body. Never `white` for body text.
- **Color accents get lighter, not more saturated.** In dark mode, violet/emerald/red/amber shift to 400-stops (instead of 500/600/700 in light). This prevents colors from "glowing" on dark backgrounds.
- **Badge backgrounds are semi-transparent** in dark mode (10-12% opacity of the accent color) to avoid visual dominance. The colored text and dot carry the semantics.
- **The attention gradient stays the same.** The three tiers (inactive, normal, amber bar) must work identically in both modes.

---

## Affected Files

### New Files

| File | Purpose |
|---|---|
| `src/styles/tokens.css` | All CSS custom properties (Tier 1 + Tier 2) |
| `src/app/services/theme.service.ts` | Theme toggle service |

### Modified Files — Token Infrastructure

| File | Change |
|---|---|
| `src/styles.css` | Import `tokens.css` |
| `src/index.html` | Add theme initialization script, ensure no `dark` class flicker |
| `src/app/components/hybrid-rail/hybrid-rail.ts` | Add dark mode toggle button |

### Modified Files — Indigo → Violet + Dark Mode

| File | Scope |
|---|---|
| `src/app/components/ticket-card/ticket-card.ts` | Selection colors, focus ring, status stripe, status badges, type badges (sky→stone) |
| `src/app/components/pr-card/pr-card.ts` | Selection colors, focus ring, status display |
| `src/app/components/pr-status-colors.ts` | All stripe/badge/dot color maps |
| `src/app/components/pr-status-class.ts` | Background + text color maps |
| `src/app/components/jira-pr-card/jira-pr-card.ts` | Card styling, badges, type badges (sky→stone) |
| `src/app/components/todo-card/todo-card.ts` | Selection, focus ring, done state opacity |
| `src/app/components/idea-card/idea-card.ts` | Selection, focus ring |
| `src/app/components/rhythm-card/rhythm-card.ts` | Badges, selection, gradient, RGBA values |
| `src/app/components/navigator/navigator.html` | Section headers, badge counts, focus rings, backgrounds |
| `src/app/components/day-calendar-panel/day-calendar-panel.ts` | Timeline colors, now-marker, event badges |
| `src/app/components/action-rail/action-rail.ts` | Button colors |
| `src/app/components/pomodoro-overlay/pomodoro-overlay.ts` | Full overlay (gradients, RGBA nebula colors, hex star colors, button colors) |
| `src/app/components/pomodoro-progress-bar/pomodoro-progress-bar.ts` | Bar color |
| `src/app/components/pomodoro-config-popup/pomodoro-config-popup.ts` | Input focus, button colors |
| `src/app/components/quick-capture/quick-capture.ts` | Focus ring, option badges |
| `src/app/components/pr-detail/pr-detail.ts` | Focus ring, spinner, link colors |
| `src/app/components/todo-detail/todo-detail.ts` | Border, focus, badge colors |
| `src/app/components/idea-detail/idea-detail.ts` | Border, focus, badge colors |
| `src/app/components/rhythm-detail/rhythm-detail.ts` | Borders, focus rings, button colors, circle animation |
| `src/app/components/review-pipeline/review-pipeline.ts` | Any indigo references |
| `src/app/components/review-findings/review-findings.ts` | Any indigo references |
| `src/app/app.html` | Background color |
| `src/styles.css` | Animation keyframe colors (gentlePulse RGBA values), jira-markup styling |

---

## Card State Assignment Rules

### Ticket Cards

| Condition | State |
|---|---|
| Status = "Done" | Inactive |
| Not assigned to me | Inactive |
| Status = "In Progress" / "In Review" / "To Do", normal priority | Normal |
| High priority, or status suggests urgency | Attention |

### PR Cards

| Condition | State |
|---|---|
| Approved (by others, not mine) | Inactive |
| Merged | Inactive |
| Awaiting my review (fresh, < 2 days) | Normal |
| In review / open (my PRs, no issues) | Normal |
| Awaiting review > 2 days | Attention |
| Needs re-review | Attention |
| My PR with failed build | Attention |
| My PR with changes requested | Attention |

### Todo / Idea Cards

| Condition | State |
|---|---|
| Completed / won't-do | Inactive |
| Active | Normal |
| (No attention state — todos don't have urgency signals) | — |

---

## What Must NOT Happen

- **No colored card backgrounds.** Cards are white (light) or stone-800 (dark). No violet-tinted, amber-tinted, or red-tinted card backgrounds. Color lives only in badges, icons, text, and the amber bar.
- **No rainbow sidebar.** The navigator should look predominantly neutral as a whole, with occasional amber bars catching the eye.
- **No new color categories.** Exactly five color roles: violet (identity), amber (attention), emerald (success), red (error), optional blue (links). No pink badges, no cyan highlights, no orange variants.
- **Not everything needs color.** Type badges use neutral stone styling. Only where color has real action-relevance is it used.
- **No `gray`, `slate`, or `zinc`.** Stone only for neutrals.
- **No pure `white` for body text in dark mode.** Use `stone-100` / `stone-200`.

---

## Reference

- Token mapping details and Tailwind class examples: `/new-color-concept.md`
- Visual mockup (approved v3): `.superpowers/brainstorm/49278-1774626167/card-states-v3.html`
