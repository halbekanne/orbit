# Color System Migration & Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Orbit from ad-hoc indigo-based light-only colors to a two-tier semantic token system (violet primary, stone neutrals) with full dark mode support and three-tier card states (inactive/normal/attention).

**Architecture:** CSS custom properties in `tokens.css` define semantic tokens (Tier 1) and component tokens (Tier 2). A `ThemeService` manages dark/light/system preference. All components migrate from `indigo-*` → `violet-*` classes and add `dark:` variants referencing tokens. Card state logic is computed per-component using existing data.

**Tech Stack:** Angular 21+ (standalone, signals, zoneless), Tailwind CSS v4.1.12, CSS custom properties, Vitest, localStorage.

**Spec:** `docs/superpowers/specs/2026-03-27-color-system-and-dark-mode-design.md`

**Reference:** `new-color-concept.md` (token mapping details and Tailwind class examples)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/styles/tokens.css` | All CSS custom properties: Tier 1 semantic tokens + Tier 2 component tokens, `:root` and `.dark` variants |
| `src/app/services/theme.service.ts` | Theme state management (light/dark/system), `<html>` class toggle, localStorage persistence, system preference listener |
| `src/app/services/theme.service.spec.ts` | Unit tests for ThemeService |

### Modified Files

| File | Changes |
|------|---------|
| `src/styles.css` | Add `@import './styles/tokens.css'` at top; update RGBA values in animation keyframes (`gentlePulse` etc.) from indigo to violet |
| `src/index.html` | Add inline script for theme initialization (prevents dark mode flash) |
| `src/app/components/hybrid-rail/hybrid-rail.ts` | Add dark mode toggle button; migrate `indigo-*` → `violet-*`; add `dark:` variants |
| `src/app/components/pr-status-colors.ts` | Replace all indigo stripe/badge/dot colors with violet equivalents; add dark mode variant support |
| `src/app/components/pr-status-class.ts` | Update background+text color mappings |
| `src/app/components/ticket-card/ticket-card.ts` | Migrate colors, add dark mode, implement three-tier card state logic, sky→stone for type badges |
| `src/app/components/pr-card/pr-card.ts` | Migrate colors, add dark mode, implement three-tier card state logic |
| `src/app/components/jira-pr-card/jira-pr-card.ts` | Migrate indigo→violet, hex/RGBA values, sky→stone type badges, add dark mode |
| `src/app/components/todo-card/todo-card.ts` | Migrate colors, add dark mode, update inactive state |
| `src/app/components/idea-card/idea-card.ts` | Migrate colors, add dark mode |
| `src/app/components/rhythm-card/rhythm-card.ts` | Migrate indigo→violet, RGBA values, gradients, add dark mode |
| `src/app/components/rhythm-detail/rhythm-detail.ts` | Migrate indigo→violet for borders, buttons, focus rings |
| `src/app/components/navigator/navigator.html` | Migrate indigo→violet for badges/gradients/focus-rings, add dark mode to backgrounds |
| `src/app/components/navigator/navigator.ts` | Minor: dark mode for any inline styles |
| `src/app/components/day-calendar-panel/day-calendar-panel.ts` | Migrate indigo→violet, add dark mode |
| `src/app/components/action-rail/action-rail.ts` | Migrate indigo→violet button colors, add dark mode |
| `src/app/components/pomodoro-overlay/pomodoro-overlay.ts` | Migrate indigo→violet (gradients, RGBA nebula, hex star colors, buttons) |
| `src/app/components/pomodoro-progress-bar/pomodoro-progress-bar.ts` | `bg-indigo-500` → token reference |
| `src/app/components/pomodoro-config-popup/pomodoro-config-popup.ts` | Migrate focus rings and button colors |
| `src/app/components/quick-capture/quick-capture.ts` | Migrate focus ring and badge colors |
| `src/app/components/pr-detail/pr-detail.ts` | Migrate focus ring, spinner, link colors |
| `src/app/components/todo-detail/todo-detail.ts` | Migrate border, focus, badge colors |
| `src/app/components/idea-detail/idea-detail.ts` | Migrate border, focus, badge colors |
| `src/app/components/review-pipeline/review-pipeline.ts` | Migrate any indigo references |
| `src/app/components/review-findings/review-findings.ts` | Migrate any indigo references |
| `src/app/app.html` | Add dark mode to background |
| `src/app/app.ts` | Minor: import ThemeService if needed for initialization |

---

## Task 1: Token Infrastructure

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/styles.css`

- [ ] **Step 1: Create the styles directory**

```bash
mkdir -p src/styles
```

- [ ] **Step 2: Create tokens.css with Tier 1 semantic tokens**

Create `src/styles/tokens.css` with all CSS custom properties. Use `theme()` function to reference Tailwind colors:

```css
@layer base {
  :root {
    /* Backgrounds & Surfaces */
    --color-bg-page: var(--color-stone-100);
    --color-bg-surface: var(--color-stone-200);
    --color-bg-card: #ffffff;
    --color-bg-elevated: #ffffff;
    --color-border-default: var(--color-stone-300);
    --color-border-subtle: var(--color-stone-200);

    /* Text */
    --color-text-heading: var(--color-stone-800);
    --color-text-body: var(--color-stone-600);
    --color-text-muted: var(--color-stone-400);

    /* Rail */
    --color-rail-bg: var(--color-stone-900);
    --color-rail-icon: var(--color-stone-500);
    --color-rail-icon-active: #ffffff;
    --color-rail-accent: var(--color-violet-500);

    /* Primary (Violet) */
    --color-primary-bg: var(--color-violet-50);
    --color-primary-bg-hover: var(--color-violet-100);
    --color-primary-border: var(--color-violet-200);
    --color-primary-solid: var(--color-violet-500);
    --color-primary-solid-hover: var(--color-violet-600);
    --color-primary-text: var(--color-violet-700);
    --color-primary-on-solid: #ffffff;

    /* Success (Emerald) */
    --color-success-bg: var(--color-emerald-50);
    --color-success-border: var(--color-emerald-200);
    --color-success-solid: var(--color-emerald-500);
    --color-success-text: var(--color-emerald-700);

    /* Danger (Red) */
    --color-danger-bg: var(--color-red-50);
    --color-danger-border: var(--color-red-200);
    --color-danger-solid: var(--color-red-500);
    --color-danger-text: var(--color-red-700);

    /* Signal (Amber) */
    --color-signal-bar: var(--color-amber-500);
    --color-signal-text: var(--color-amber-700);

    /* Info (Blue) */
    --color-info-text: var(--color-blue-600);
    --color-info-text-hover: var(--color-blue-700);
  }

  .dark {
    /* Backgrounds & Surfaces */
    --color-bg-page: var(--color-stone-950);
    --color-bg-surface: var(--color-stone-900);
    --color-bg-card: var(--color-stone-800);
    --color-bg-elevated: var(--color-stone-800);
    --color-border-default: var(--color-stone-600);
    --color-border-subtle: var(--color-stone-700);

    /* Text */
    --color-text-heading: var(--color-stone-100);
    --color-text-body: var(--color-stone-300);
    --color-text-muted: var(--color-stone-500);

    /* Rail */
    --color-rail-bg: var(--color-stone-950);
    --color-rail-icon: var(--color-stone-600);
    --color-rail-accent: var(--color-violet-400);

    /* Primary (Violet) */
    --color-primary-bg: color-mix(in srgb, var(--color-violet-500) 12%, transparent);
    --color-primary-bg-hover: color-mix(in srgb, var(--color-violet-500) 20%, transparent);
    --color-primary-border: color-mix(in srgb, var(--color-violet-500) 25%, transparent);
    --color-primary-solid: var(--color-violet-400);
    --color-primary-solid-hover: var(--color-violet-300);
    --color-primary-text: var(--color-violet-300);

    /* Success (Emerald) */
    --color-success-bg: color-mix(in srgb, var(--color-emerald-400) 10%, transparent);
    --color-success-border: color-mix(in srgb, var(--color-emerald-400) 20%, transparent);
    --color-success-solid: var(--color-emerald-400);
    --color-success-text: var(--color-emerald-400);

    /* Danger (Red) */
    --color-danger-bg: color-mix(in srgb, var(--color-red-400) 10%, transparent);
    --color-danger-border: color-mix(in srgb, var(--color-red-400) 20%, transparent);
    --color-danger-solid: var(--color-red-400);
    --color-danger-text: var(--color-red-400);

    /* Signal (Amber) */
    --color-signal-bar: var(--color-amber-500);
    --color-signal-text: var(--color-amber-500);

    /* Info (Blue) */
    --color-info-text: var(--color-blue-400);
    --color-info-text-hover: var(--color-blue-300);
  }
}
```

**Note on Tailwind v4:** Tailwind v4 exposes all palette colors as CSS variables automatically (e.g., `--color-stone-100`). Use these directly instead of `theme()`. If `--color-stone-100` is not available, fall back to raw hex values from the Tailwind v4 default palette. Verify by checking the browser dev tools after import.

- [ ] **Step 3: Add Tier 2 component tokens**

Append to the `:root` block in `tokens.css`:

```css
    /* --- Tier 2: Component Tokens --- */

    /* Card Selection */
    --color-card-selected-bg: var(--color-primary-bg);
    --color-card-selected-ring: var(--color-primary-border);
    --color-card-selected-bg-hover: var(--color-primary-bg-hover);

    /* Card States */
    --card-inactive-opacity: 0.55;
    --color-card-attention-bar: var(--color-signal-bar);

    /* PR Status Badges */
    --color-pr-approved-bg: var(--color-success-bg);
    --color-pr-approved-text: var(--color-success-text);
    --color-pr-approved-border: var(--color-success-border);
    --color-pr-in-review-bg: var(--color-primary-bg);
    --color-pr-in-review-text: var(--color-primary-text);
    --color-pr-in-review-border: var(--color-primary-border);
    --color-pr-changes-bg: var(--color-danger-bg);
    --color-pr-changes-text: var(--color-danger-text);
    --color-pr-changes-border: var(--color-danger-border);

    /* Build Status */
    --color-build-ok: var(--color-success-solid);
    --color-build-fail: var(--color-danger-solid);

    /* Pomodoro */
    --color-pomodoro-accent: var(--color-primary-solid);
    --color-pomodoro-bg: var(--color-primary-bg);

    /* Type Badges (all neutral) */
    --color-type-badge-bg: var(--color-bg-surface);
    --color-type-badge-text: var(--color-text-body);
    --color-type-badge-border: var(--color-border-default);

    /* Focus Ring */
    --color-focus-ring: var(--color-primary-solid);

    /* Timeline */
    --color-timeline-now: var(--color-danger-solid);
    --color-timeline-grid: var(--color-border-subtle);
```

And in the `.dark` block, add the dark-specific overrides:

```css
    /* Card States */
    --card-inactive-opacity: 0.62;
```

(All other Tier 2 tokens inherit from Tier 1 automatically — they don't need dark overrides.)

- [ ] **Step 4: Import tokens.css in styles.css**

Add at the top of `src/styles.css`, right after `@import 'tailwindcss'`:

```css
@import './styles/tokens.css';
```

- [ ] **Step 5: Verify the build compiles**

```bash
cd /Users/dominik/dev/other/orbit && npx ng build 2>&1 | tail -5
```

Expected: Build succeeds. If Tailwind v4 CSS variables like `--color-stone-100` are not available, replace with hex values from Tailwind defaults.

- [ ] **Step 6: Commit**

```bash
git add src/styles/tokens.css src/styles.css
git commit -m "feat: add semantic color token system (Tier 1 + Tier 2)"
```

---

## Task 2: ThemeService

**Files:**
- Create: `src/app/services/theme.service.ts`
- Create: `src/app/services/theme.service.spec.ts`
- Modify: `src/index.html`

- [ ] **Step 1: Write failing tests for ThemeService**

Create `src/app/services/theme.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  it('should default to system preference when no stored value', () => {
    expect(service.preference()).toBe('system');
  });

  it('should apply dark class when set to dark', () => {
    service.setPreference('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(service.preference()).toBe('dark');
  });

  it('should remove dark class when set to light', () => {
    document.documentElement.classList.add('dark');
    service.setPreference('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(service.preference()).toBe('light');
  });

  it('should persist preference to localStorage', () => {
    service.setPreference('dark');
    expect(localStorage.getItem('orbit-theme')).toBe('dark');
  });

  it('should cycle through system → light → dark → system', () => {
    expect(service.preference()).toBe('system');
    service.cycle();
    expect(service.preference()).toBe('light');
    service.cycle();
    expect(service.preference()).toBe('dark');
    service.cycle();
    expect(service.preference()).toBe('system');
  });

  it('should load stored preference on creation', () => {
    localStorage.setItem('orbit-theme', 'dark');
    const newService = TestBed.inject(ThemeService);
    expect(newService.preference()).toBe('dark');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/dominik/dev/other/orbit && npx ng test --no-watch 2>&1 | grep -E '(FAIL|PASS|Error|theme)'
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ThemeService**

Create `src/app/services/theme.service.ts`:

```typescript
import { Injectable, signal, effect } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'orbit-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly preference = signal<ThemePreference>(this.loadPreference());

  private mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    effect(() => {
      const pref = this.preference();
      this.applyTheme(pref);
    });

    this.mediaQuery.addEventListener('change', () => {
      if (this.preference() === 'system') {
        this.applyTheme('system');
      }
    });
  }

  setPreference(pref: ThemePreference) {
    this.preference.set(pref);
    if (pref === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  }

  cycle() {
    const order: ThemePreference[] = ['system', 'light', 'dark'];
    const current = order.indexOf(this.preference());
    this.setPreference(order[(current + 1) % order.length]);
  }

  private loadPreference(): ThemePreference {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return 'system';
  }

  private applyTheme(pref: ThemePreference) {
    const isDark = pref === 'dark' || (pref === 'system' && this.mediaQuery.matches);
    document.documentElement.classList.toggle('dark', isDark);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/dominik/dev/other/orbit && npx ng test --no-watch 2>&1 | grep -E '(FAIL|PASS|Tests)'
```

Expected: All ThemeService tests PASS.

- [ ] **Step 5: Add theme initialization to index.html**

Add this inline script in `<head>` of `src/index.html`, after the font links but before `</head>`:

```html
<script>
  (function() {
    var stored = localStorage.getItem('orbit-theme');
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  })();
</script>
```

This prevents a flash of light mode before Angular boots.

- [ ] **Step 6: Commit**

```bash
git add src/app/services/theme.service.ts src/app/services/theme.service.spec.ts src/index.html
git commit -m "feat: add ThemeService with dark/light/system preference and flash prevention"
```

---

## Task 3: Hybrid Rail — Dark Mode Toggle + Color Migration

**Files:**
- Modify: `src/app/components/hybrid-rail/hybrid-rail.ts`
- Modify: `src/app/components/hybrid-rail/hybrid-rail.spec.ts` (if tests reference colors)

- [ ] **Step 1: Read the current hybrid-rail component**

Read `src/app/components/hybrid-rail/hybrid-rail.ts` fully to understand the current template and identify all indigo references.

- [ ] **Step 2: Add theme toggle button and migrate colors**

In `hybrid-rail.ts`:
- Import `ThemeService`
- Inject it: `private theme = inject(ThemeService)`
- Add a `themeIcon` computed signal that returns the appropriate icon (sun/moon/monitor) based on `theme.preference()`
- Add a button at the bottom of the rail template that calls `theme.cycle()`
- Replace all `indigo-*` classes with `violet-*` equivalents:
  - `bg-indigo-600` → `bg-violet-500`
  - `shadow-[0_0_12px_rgba(99,102,241,0.25)]` → `shadow-[0_0_12px_rgba(139,92,246,0.25)]`
  - `focus-visible:outline-indigo-400` → `focus-visible:outline-violet-400`
  - `[class.bg-indigo-600]` → `[class.bg-violet-500]`
- Add `dark:` variants where needed (rail bg is already `stone-900`, just needs `dark:bg-stone-950`)

The toggle button template (add at bottom of rail, before closing `</nav>`):

```html
<button
  (click)="theme.cycle()"
  [attr.aria-label]="themeLabel()"
  class="w-10 h-10 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
>
  <!-- Sun icon (light mode) -->
  @if (theme.preference() === 'light') {
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  }
  <!-- Moon icon (dark mode) -->
  @if (theme.preference() === 'dark') {
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  }
  <!-- Monitor icon (system mode) -->
  @if (theme.preference() === 'system') {
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
    </svg>
  }
</button>
```

The `themeLabel` computed:
```typescript
themeLabel = computed(() => {
  const labels = { system: 'Design: System', light: 'Design: Hell', dark: 'Design: Dunkel' };
  return labels[this.theme.preference()];
});
```

- [ ] **Step 3: Update hybrid-rail tests if needed**

Read `hybrid-rail.spec.ts` and update any color-specific assertions.

- [ ] **Step 4: Verify build compiles**

```bash
cd /Users/dominik/dev/other/orbit && npx ng build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/app/components/hybrid-rail/
git commit -m "feat: add dark mode toggle to rail, migrate indigo → violet"
```

---

## Task 4: PR Status Utilities

**Files:**
- Modify: `src/app/components/pr-status-colors.ts`
- Modify: `src/app/components/pr-status-class.ts`

- [ ] **Step 1: Read both files fully**

Read `src/app/components/pr-status-colors.ts` and `src/app/components/pr-status-class.ts`.

- [ ] **Step 2: Migrate pr-status-colors.ts**

Replace all indigo references with violet. The file exports three maps (`stripeMap`, `badgeMap`, `dotMap`). Replace:

- All `indigo-400` → `violet-400` (stripes)
- All `bg-indigo-50 text-indigo-700 border-indigo-200` → `bg-violet-50 text-violet-700 border-violet-200 dark:bg-[var(--color-primary-bg)] dark:text-violet-300 dark:border-[var(--color-primary-border)]` (badges)
- All `bg-indigo-400` → `bg-violet-400` (dots)

Add `dark:` variants to badge maps for colored badges:
- Emerald badges: add `dark:bg-[var(--color-success-bg)] dark:text-emerald-400 dark:border-[var(--color-success-border)]`
- Stone/neutral badges: add `dark:bg-stone-700 dark:text-stone-300 dark:border-stone-600`
- Amber badges: keep amber values, add dark variants

- [ ] **Step 3: Migrate pr-status-class.ts**

Update the background+text color mappings. Add dark mode variants.

- [ ] **Step 4: Run existing tests**

```bash
cd /Users/dominik/dev/other/orbit && npx ng test --no-watch 2>&1 | grep -E '(FAIL|PASS|Tests)'
```

- [ ] **Step 5: Commit**

```bash
git add src/app/components/pr-status-colors.ts src/app/components/pr-status-class.ts
git commit -m "feat: migrate PR status colors from indigo to violet with dark mode"
```

---

## Task 5: Ticket Card — Color Migration + Card States

**Files:**
- Modify: `src/app/components/ticket-card/ticket-card.ts`

This is a key component — it establishes the pattern for the three-tier card state system that other cards will follow.

- [ ] **Step 1: Read the full ticket-card component**

Read `src/app/components/ticket-card/ticket-card.ts` to understand all color usage.

- [ ] **Step 2: Implement card state computation**

Add a `cardState` computed signal that returns `'inactive' | 'normal' | 'attention'` based on the ticket data:

```typescript
cardState = computed(() => {
  const ticket = this.ticket();
  const status = ticket.status;

  // Inactive: Done, or not assigned to user
  if (status === 'Done') return 'inactive';

  // Attention: high priority or urgent indicators
  if (ticket.priority === 'Highest' || ticket.priority === 'High') return 'attention';

  // Normal: everything else that's mine
  return 'normal';
});
```

- [ ] **Step 3: Migrate the template**

Replace the card wrapper class binding. Currently it conditionally applies selected/unselected styles. Update to incorporate card state:

**Card container:**
- Remove the existing left-stripe `div` element entirely
- Apply card state classes to the outer container:
  - Inactive: `opacity-[0.55] dark:opacity-[0.62]` — no stripe
  - Normal: standard card — no stripe
  - Attention: `border-l-4 border-l-amber-500 rounded-r-lg rounded-l-none`
- For all states, card bg: `bg-white dark:bg-[var(--color-bg-card)]`
- Border: `ring-1 ring-stone-200 dark:ring-[var(--color-border-default)]`
- Selected state: `bg-[var(--color-card-selected-bg)] ring-1 ring-[var(--color-card-selected-ring)]`

**Indigo → Violet throughout:**
- `bg-indigo-50/70` → `bg-[var(--color-card-selected-bg)]`
- `ring-indigo-200/80` → `ring-[var(--color-card-selected-ring)]`
- `text-indigo-600` → `text-[var(--color-primary-text)]`
- `hover:text-indigo-500` → `hover:text-[var(--color-primary-solid)]`
- `focus-visible:outline-indigo-500` → `focus-visible:outline-[var(--color-focus-ring)]`
- `stroke-indigo-500` → `stroke-[var(--color-primary-solid)]`

**Status badges:**
- `bg-indigo-50 text-indigo-700 border-indigo-200` → `bg-[var(--color-primary-bg)] text-[var(--color-primary-text)] border-[var(--color-primary-border)]`
- Remove the `statusStripeClass()` function — stripe logic is now handled by `cardState`

**Type badges (sky → stone):**
- `bg-sky-50 text-sky-700 border-sky-200` → `bg-[var(--color-type-badge-bg)] text-[var(--color-type-badge-text)] border-[var(--color-type-badge-border)]`
- Apply this to ALL type badges ("Fehler", "Aufgabe", "User Story", "Verbesserung") — they all get the same neutral styling

**Text dark mode:**
- `text-stone-800` → `text-[var(--color-text-heading)]`
- `text-stone-600` → `text-[var(--color-text-body)]`
- `text-stone-400` → `text-[var(--color-text-muted)]`

- [ ] **Step 4: Run any related tests**

```bash
cd /Users/dominik/dev/other/orbit && npx ng test --no-watch 2>&1 | grep -E '(FAIL|PASS|Tests)'
```

- [ ] **Step 5: Visual verification**

```bash
cd /Users/dominik/dev/other/orbit && npx ng serve &
```

Open browser, check ticket cards render correctly in light mode. Toggle dark mode via the rail button. Verify:
- Inactive cards are faded
- Normal cards are neutral
- High-priority cards show amber bar
- Selected cards show violet highlight

- [ ] **Step 6: Commit**

```bash
git add src/app/components/ticket-card/
git commit -m "feat: migrate ticket-card to token system with three-tier card states and dark mode"
```

---

## Task 6: PR Card — Color Migration + Card States

**Files:**
- Modify: `src/app/components/pr-card/pr-card.ts`

- [ ] **Step 1: Read the full PR card component**

Read `src/app/components/pr-card/pr-card.ts`.

- [ ] **Step 2: Implement card state computation**

Add a `cardState` computed signal:

```typescript
cardState = computed(() => {
  const pr = this.pr();

  // Inactive: merged, approved by others (not mine), declined
  if (pr.state === 'MERGED' || pr.state === 'DECLINED') return 'inactive';
  if (pr.status === 'approved' && !pr.isMine) return 'inactive';

  // Attention: needs re-review, changes requested on my PR, build failed on my PR, waiting >2 days
  if (pr.status === 'needs-rereview') return 'attention';
  if (pr.isMine && pr.status === 'changes-requested') return 'attention';
  if (pr.isMine && pr.buildStatus === 'FAILED') return 'attention';
  if (pr.reviewAge && pr.reviewAge > 2) return 'attention';

  // Normal: everything else
  return 'normal';
});
```

Adapt property names to match the actual `PullRequest` model — read the model file to confirm exact field names.

- [ ] **Step 3: Migrate template colors**

Follow the same pattern as Task 5:
- Replace card wrapper classes with token-based + card state logic
- Remove left stripe element, use `border-l-4 border-l-amber-500` on attention cards
- Indigo → violet via token variables
- Add dark mode variants
- Text colors → token variables

- [ ] **Step 4: Run tests**

```bash
cd /Users/dominik/dev/other/orbit && npx ng test --no-watch 2>&1 | grep -E '(FAIL|PASS|Tests)'
```

- [ ] **Step 5: Commit**

```bash
git add src/app/components/pr-card/
git commit -m "feat: migrate pr-card to token system with three-tier card states and dark mode"
```

---

## Task 7: Remaining Card Components

**Files:**
- Modify: `src/app/components/todo-card/todo-card.ts`
- Modify: `src/app/components/idea-card/idea-card.ts`
- Modify: `src/app/components/jira-pr-card/jira-pr-card.ts`

- [ ] **Step 1: Read all three components**

Read each file fully.

- [ ] **Step 2: Migrate todo-card**

- Replace `indigo-*` with token variables for selection state
- Replace `focus-visible:outline-indigo-500` → `focus-visible:outline-[var(--color-focus-ring)]`
- Done state: use `opacity-[var(--card-inactive-opacity)]` (already uses opacity-60, change to 0.55/0.62 via token)
- Add dark mode: `bg-white` → `bg-[var(--color-bg-card)]`, borders → token variables
- Todo cards have two states only: inactive (done) and normal (active). No attention state.

- [ ] **Step 3: Migrate idea-card**

- Replace `indigo-*` selection styles with token variables
- Add dark mode variants
- Idea cards: inactive (won't-do), normal (active). No attention state.

- [ ] **Step 4: Migrate jira-pr-card**

This is the detailed PR view panel. It has extensive indigo usage:
- `border-indigo-100` → `border-[var(--color-primary-border)]`
- `bg-indigo-50/40` → `bg-[var(--color-primary-bg)]`
- `bg-[#f0f3ff]` → `bg-[var(--color-primary-bg)]` (this was a hardcoded hex for indigo-50-like)
- `text-indigo-600` → `text-[var(--color-primary-text)]`
- `bg-indigo-100 text-indigo-600` badges → token variables
- `bg-indigo-500` dot → `bg-[var(--color-primary-solid)]`
- Sky type badges → stone neutral tokens
- Add dark mode variants for all backgrounds, borders, and text

- [ ] **Step 5: Run tests**

```bash
cd /Users/dominik/dev/other/orbit && npx ng test --no-watch 2>&1 | grep -E '(FAIL|PASS|Tests)'
```

- [ ] **Step 6: Commit**

```bash
git add src/app/components/todo-card/ src/app/components/idea-card/ src/app/components/jira-pr-card/
git commit -m "feat: migrate todo/idea/jira-pr cards to token system with dark mode"
```

---

## Task 8: Navigator

**Files:**
- Modify: `src/app/components/navigator/navigator.html`
- Modify: `src/app/components/navigator/navigator.ts` (if inline styles exist)

- [ ] **Step 1: Read navigator.html and navigator.ts**

Read both files fully. The navigator has the most color references of any template (~30+ instances).

- [ ] **Step 2: Migrate navigator.html**

Systematic replacement throughout the template:

**Backgrounds:**
- `bg-stone-100` → `bg-[var(--color-bg-surface)]`
- `bg-white` → `bg-[var(--color-bg-card)]` (if used)

**Text:**
- `text-stone-800` → `text-[var(--color-text-heading)]`
- `text-stone-400` / `text-stone-500` → `text-[var(--color-text-muted)]`

**Indigo → Violet:**
- `text-indigo-600` → `text-[var(--color-primary-text)]`
- `bg-gradient-to-r from-indigo-200 to-transparent` → `bg-gradient-to-r from-violet-200 dark:from-violet-500/20 to-transparent`
- `bg-indigo-100 text-indigo-700` count badges → `bg-[var(--color-primary-bg)] text-[var(--color-primary-text)]`
- `focus-visible:outline-indigo-500` → `focus-visible:outline-[var(--color-focus-ring)]`

**Borders:**
- `border-stone-200` → `border-[var(--color-border-subtle)]`

**Error indicators (keep red):**
- `text-red-500` → `text-[var(--color-danger-solid)]`

**Amber indicators (keep amber):**
- `bg-amber-100 text-amber-700` → `bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500`

- [ ] **Step 3: Run navigator tests**

```bash
cd /Users/dominik/dev/other/orbit && npx ng test --no-watch 2>&1 | grep -E '(navigator|FAIL|PASS)'
```

- [ ] **Step 4: Commit**

```bash
git add src/app/components/navigator/
git commit -m "feat: migrate navigator to token system with dark mode"
```

---

## Task 9: Detail Components

**Files:**
- Modify: `src/app/components/pr-detail/pr-detail.ts`
- Modify: `src/app/components/todo-detail/todo-detail.ts`
- Modify: `src/app/components/idea-detail/idea-detail.ts`
- Modify: `src/app/components/rhythm-detail/rhythm-detail.ts`

- [ ] **Step 1: Read all four detail components**

- [ ] **Step 2: Migrate each component**

All follow the same pattern — replace indigo with violet via tokens, add dark mode:

**Common replacements:**
- `border-indigo-400` → `border-[var(--color-primary-solid)]`
- `focus:ring-indigo-400` / `focus:ring-indigo-300` → `focus:ring-[var(--color-primary-solid)]`
- `focus:border-indigo-300` → `focus:border-[var(--color-primary-border)]`
- `hover:text-indigo-700` → `hover:text-[var(--color-primary-text)]`
- `bg-indigo-100 text-indigo-700` badges → `bg-[var(--color-primary-bg)] text-[var(--color-primary-text)]`
- `bg-indigo-600 hover:bg-indigo-700` buttons → `bg-[var(--color-primary-solid)] hover:bg-[var(--color-primary-solid-hover)]`
- `focus-visible:outline-indigo-500` → `focus-visible:outline-[var(--color-focus-ring)]`
- `text-indigo-400` placeholder/muted → `text-[var(--color-primary-solid)] dark:text-[var(--color-primary-text)]`

**Dark mode for containers:**
- Add `dark:bg-[var(--color-bg-card)]` to white backgrounds
- Add `dark:border-[var(--color-border-default)]` to borders
- Add `dark:text-[var(--color-text-heading)]` / `dark:text-[var(--color-text-body)]` to text

**rhythm-detail.ts** has the most references (~15 indigo instances). Pay special attention to:
- Circle animation: `bg-indigo-600` → `bg-[var(--color-primary-solid)]`
- Input focus rings
- Button colors (multiple CTA buttons)

- [ ] **Step 3: Run tests**

```bash
cd /Users/dominik/dev/other/orbit && npx ng test --no-watch 2>&1 | grep -E '(FAIL|PASS|Tests)'
```

- [ ] **Step 4: Commit**

```bash
git add src/app/components/pr-detail/ src/app/components/todo-detail/ src/app/components/idea-detail/ src/app/components/rhythm-detail/
git commit -m "feat: migrate detail components to token system with dark mode"
```

---

## Task 10: Action Rail + Quick Capture

**Files:**
- Modify: `src/app/components/action-rail/action-rail.ts`
- Modify: `src/app/components/quick-capture/quick-capture.ts`

- [ ] **Step 1: Read both components**

- [ ] **Step 2: Migrate action-rail**

Replace button color classes:
- Active: `bg-indigo-100 border-indigo-300 text-indigo-700 hover:bg-indigo-200` → token-based primary variants
- Inactive: `bg-stone-50 border-stone-200` → `bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)]`
- All action buttons: `bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100` → `bg-[var(--color-primary-bg)] border-[var(--color-primary-border)] text-[var(--color-primary-text)] hover:bg-[var(--color-primary-bg-hover)]`

- [ ] **Step 3: Migrate quick-capture**

- `focus:ring-indigo-400` → `focus:ring-[var(--color-focus-ring)]`
- `bg-indigo-50 border-indigo-300 text-indigo-700` option badges → token-based
- Add dark mode for the overlay background and input field

- [ ] **Step 4: Run tests**

```bash
cd /Users/dominik/dev/other/orbit && npx ng test --no-watch 2>&1 | grep -E '(FAIL|PASS|Tests)'
```

- [ ] **Step 5: Commit**

```bash
git add src/app/components/action-rail/ src/app/components/quick-capture/
git commit -m "feat: migrate action-rail and quick-capture to token system with dark mode"
```

---

## Task 11: Day Calendar Panel

**Files:**
- Modify: `src/app/components/day-calendar-panel/day-calendar-panel.ts`

- [ ] **Step 1: Read the component**

- [ ] **Step 2: Migrate colors**

- `text-stone-400` / `hover:text-stone-600` / `hover:bg-stone-100` → token variables
- `text-stone-800` → `text-[var(--color-text-heading)]`
- `bg-indigo-50 border-indigo-200 text-indigo-700` event badges → token-based primary
- `bg-indigo-400` / `bg-indigo-500` animated dot → `bg-[var(--color-primary-solid)]`
- `text-indigo-700` → `text-[var(--color-primary-text)]`
- Now-marker: keep red, use `bg-[var(--color-timeline-now)]`

- [ ] **Step 3: Run tests**

```bash
cd /Users/dominik/dev/other/orbit && npx ng test --no-watch 2>&1 | grep -E '(FAIL|PASS|Tests)'
```

- [ ] **Step 4: Commit**

```bash
git add src/app/components/day-calendar-panel/
git commit -m "feat: migrate day-calendar-panel to token system with dark mode"
```

---

## Task 12: Rhythm Card

**Files:**
- Modify: `src/app/components/rhythm-card/rhythm-card.ts`

- [ ] **Step 1: Read the full component**

This is a complex component with gradients, RGBA values, and animations.

- [ ] **Step 2: Migrate colors**

**RGBA values:**
- `rgba(129, 140, 248, ...)` (indigo-400 RGB) → `rgba(167, 139, 250, ...)` (violet-400 RGB)

**Indigo → Violet direct replacements:**
- `text-indigo-500` / `text-indigo-400` / `text-indigo-600` → violet equivalents
- `bg-indigo-50 text-indigo-700 border-indigo-200` badges → token-based primary
- `bg-indigo-50/70 shadow-sm ring-1 ring-indigo-200/80` selected state → token-based selection

**Gradients:**
- `bg-gradient-to-br from-indigo-50/80 to-white` → `bg-gradient-to-br from-violet-50/80 dark:from-violet-500/10 to-white dark:to-transparent`
- `ring-indigo-200 hover:ring-indigo-300` → `ring-[var(--color-primary-border)] hover:ring-violet-300 dark:hover:ring-violet-500/40`
- `bg-gradient-to-b from-indigo-400 to-indigo-300` progress bars → `bg-gradient-to-b from-violet-400 to-violet-300 dark:from-violet-500 dark:to-violet-400`
- `bg-gradient-to-b from-indigo-400 to-amber-400` → `bg-gradient-to-b from-violet-400 to-amber-400 dark:from-violet-500 dark:to-amber-500`

**Animation class bindings:**
- `[class.bg-indigo-500]` → `[class.bg-violet-500]`
- `bg-indigo-400` → `bg-violet-400`

- [ ] **Step 3: Run rhythm-card tests**

```bash
cd /Users/dominik/dev/other/orbit && npx ng test --no-watch 2>&1 | grep -E '(rhythm|FAIL|PASS)'
```

- [ ] **Step 4: Commit**

```bash
git add src/app/components/rhythm-card/
git commit -m "feat: migrate rhythm-card to violet with dark mode"
```

---

## Task 13: Pomodoro Components

**Files:**
- Modify: `src/app/components/pomodoro-overlay/pomodoro-overlay.ts`
- Modify: `src/app/components/pomodoro-progress-bar/pomodoro-progress-bar.ts`
- Modify: `src/app/components/pomodoro-config-popup/pomodoro-config-popup.ts`

- [ ] **Step 1: Read all three components**

- [ ] **Step 2: Migrate pomodoro-overlay**

This is the most color-intensive component. Replace:

**Buttons:**
- `bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200` → `bg-[var(--color-primary-solid)] hover:bg-[var(--color-primary-solid-hover)] shadow-md shadow-violet-200 dark:shadow-violet-900/30`

**Break screen text:**
- `text-indigo-100` → `text-violet-100`
- `text-indigo-300/40` → `text-violet-300/40`
- `text-indigo-300/60` → `text-violet-300/60`
- `text-indigo-200` → `text-violet-200`

**Gradients:**
- `bg-gradient-to-r from-indigo-400 to-indigo-300` progress bar → `from-violet-400 to-violet-300`

**RGBA nebula values:**
- `rgba(99, 102, 241, 0.06)` nebula-1 → `rgba(139, 92, 246, 0.06)` (violet-500)
- `rgba(129, 140, 248, 0.04)` nebula-2 → `rgba(167, 139, 250, 0.04)` (violet-400)
- `rgba(59, 130, 246, 0.12)` earth-glow → `rgba(139, 92, 246, 0.12)` (violet-500)

**Hex star colors:**
- `#818cf8` → `#a78bfa` (violet-400)
- `#a5b4fc` → `#c4b5fd` (violet-300)

**Background gradient:**
- `linear-gradient(135deg, #312e81, #0f0a1a)` → `linear-gradient(135deg, #4c1d95, #0f0a1a)` (violet-900)

**Focus message badge:**
- `bg-indigo-50 text-indigo-700` → `bg-[var(--color-primary-bg)] text-[var(--color-primary-text)]`

- [ ] **Step 3: Migrate pomodoro-progress-bar**

Simple: `bg-indigo-500` → `bg-[var(--color-pomodoro-accent)]`

- [ ] **Step 4: Migrate pomodoro-config-popup**

- `focus:ring-indigo-300 focus:border-indigo-300` → `focus:ring-[var(--color-primary-border)] focus:border-[var(--color-primary-border)]`
- `bg-indigo-600 hover:bg-indigo-700` → `bg-[var(--color-primary-solid)] hover:bg-[var(--color-primary-solid-hover)]`
- Add dark mode for input backgrounds and text

- [ ] **Step 5: Run tests**

```bash
cd /Users/dominik/dev/other/orbit && npx ng test --no-watch 2>&1 | grep -E '(FAIL|PASS|Tests)'
```

- [ ] **Step 6: Commit**

```bash
git add src/app/components/pomodoro-overlay/ src/app/components/pomodoro-progress-bar/ src/app/components/pomodoro-config-popup/
git commit -m "feat: migrate pomodoro components to violet with dark mode"
```

---

## Task 14: Review Components

**Files:**
- Modify: `src/app/components/review-pipeline/review-pipeline.ts`
- Modify: `src/app/components/review-findings/review-findings.ts`

- [ ] **Step 1: Read both components, identify indigo references**

- [ ] **Step 2: Migrate any indigo references**

Replace indigo → violet, add dark mode where applicable. These components may have fewer color references than cards.

- [ ] **Step 3: Run tests**

```bash
cd /Users/dominik/dev/other/orbit && npx ng test --no-watch 2>&1 | grep -E '(review|FAIL|PASS)'
```

- [ ] **Step 4: Commit**

```bash
git add src/app/components/review-pipeline/ src/app/components/review-findings/
git commit -m "feat: migrate review components to violet with dark mode"
```

---

## Task 15: Global Styles + App Shell

**Files:**
- Modify: `src/styles.css`
- Modify: `src/app/app.html`
- Modify: `src/app/app.ts`

- [ ] **Step 1: Read styles.css, app.html, and app.ts**

- [ ] **Step 2: Migrate animation keyframes in styles.css**

Update RGBA values in animation keyframes:
- `gentlePulse`: replace indigo RGBA → violet RGBA
- `gentlePulseAmber`: keep as-is (amber is unchanged)
- Any other animations referencing indigo colors

Update Jira markup styling:
- Replace any `indigo` references with `violet`
- Add dark mode variants for `.jira-markup` styles (code blocks, blockquotes, etc.):
  ```css
  .dark .jira-markup code { /* dark variants */ }
  ```

- [ ] **Step 3: Migrate app.html**

- `bg-stone-50` (on logbuch view) → `bg-[var(--color-bg-page)]`
- Verify the root layout has proper dark mode support

- [ ] **Step 4: Ensure ThemeService is initialized**

In `src/app/app.ts`, inject `ThemeService` to ensure it's created at app startup:

```typescript
private theme = inject(ThemeService);
```

This is necessary because the service uses `effect()` to apply the theme — it must be instantiated.

- [ ] **Step 5: Build and run full test suite**

```bash
cd /Users/dominik/dev/other/orbit && npx ng build 2>&1 | tail -5
cd /Users/dominik/dev/other/orbit && npx ng test --no-watch 2>&1 | tail -20
```

Expected: Build succeeds, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/styles.css src/app/app.html src/app/app.ts
git commit -m "feat: migrate global styles and app shell to token system with dark mode"
```

---

## Task 16: Final Verification + Cleanup

- [ ] **Step 1: Search for remaining indigo references**

```bash
cd /Users/dominik/dev/other/orbit && grep -r "indigo" src/ --include="*.ts" --include="*.html" --include="*.css" -l
```

Expected: No files found (or only in comments/docs). If any remain, fix them.

- [ ] **Step 2: Search for remaining sky references**

```bash
cd /Users/dominik/dev/other/orbit && grep -r "sky-" src/ --include="*.ts" --include="*.html" --include="*.css" -l
```

Expected: No files found.

- [ ] **Step 3: Search for gray/slate/zinc usage**

```bash
cd /Users/dominik/dev/other/orbit && grep -rE "(gray-|slate-|zinc-)" src/ --include="*.ts" --include="*.html" --include="*.css" -l
```

Expected: No files found (these palettes are forbidden).

- [ ] **Step 4: Visual dark mode walkthrough**

Serve the app and manually verify each view in both light and dark mode:

```bash
cd /Users/dominik/dev/other/orbit && npx ng serve
```

Check:
- [ ] Rail: toggle button works, icon cycles correctly
- [ ] Navigator: section headers, cards, badges render correctly in both modes
- [ ] Ticket cards: three states (inactive/normal/attention) look correct
- [ ] PR cards: three states look correct
- [ ] Todo/idea cards: inactive/normal states look correct
- [ ] Day calendar panel: timeline, now-marker, event badges
- [ ] Pomodoro overlay: break screen colors and gradients
- [ ] Quick capture: overlay background, input, badges
- [ ] Detail panels: borders, buttons, text

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/dominik/dev/other/orbit && npx ng test --no-watch
```

Expected: All tests pass.

- [ ] **Step 6: Final commit with any cleanup**

```bash
git add -A
git commit -m "chore: final color system migration cleanup"
```
