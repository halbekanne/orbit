# Orbit — Coding Agent Guidelines

## Project Identity

Orbit is a personal command center for software engineers working at a German company.
It lives permanently on a dedicated second monitor, integrating company tools like Jira, Bitbucket, and local task management into a single calm interface.

- **UI language is German** — all user-facing text must be in German
- **The "anti-Jira" principle** — Orbit must feel instant, clean, and low-noise
- **Bundle size is irrelevant** — this is a local tool, not a customer-facing product

## Architecture Overview

```
Angular SPA (:6200) → Express BFF (:6201) → Jira / Bitbucket APIs
                                           → Local JSON files (~/.orbit/)
                                           → CoSi AI review (SSE)
Mock servers (:6202, :6203) simulate Jira and Bitbucket for local dev.
```

- **Frontend:** Angular 21, zoneless, signal-based, Angular Router for URL routing with signal-driven state sync
- **Backend (`server/`):** Express app with three roles — API proxy (auth injection), local data CRUD, CoSi review SSE endpoint. Routes are split into `server/routes/`.
- **Mock servers (`mock-server/`):** Standalone Express apps returning realistic German-language test data
- **State:** External data (tickets, PRs) is read-only from APIs. Local data that is important and should be stored safely (e.g. todos, ideas, logbook, schedule, subtasks) is persisted as JSON in `~/.orbit/`. Information that is only interesting temporarily (e.g. Pomodoro end time, information on expanded sections) use localStorage.

## Frontend Folder Structure

`src/app/` is organized by **business domain**, not by technical type. Each domain folder is flat — no `components/`/`services/` subfolders within it.

```
src/app/
├── jira/           # Jira ticket integration
├── bitbucket/      # Bitbucket PR integration
├── todos/          # Personal task management
├── ideas/          # Idea capture
├── reflection/     # Daily reflection / logbook
├── pomodoro/       # Pomodoro timer
├── review/         # AI code review (CoSi)
├── calendar/       # Day calendar & appointments
├── settings/       # App configuration & welcome screen
├── .../            # Other/new features/bisness domains get their own folder here
├── shared/         # Cross-cutting: layout, shared UI, app-wide services & models
└── app.ts ...
```

**Placement rule:** if a file belongs to one domain, it goes in that domain's folder. If it is used by multiple domains or is app-wide (layout, orchestration, shared UI components), it goes in `shared/`.

Each domain folder contains its components (in subfolders), services, models, pipes, and utils side by side — everything for a feature lives together. Components get their own subfolder (e.g. `todos/todo-card/todo-card.ts`), while services, models, and utils sit directly in the domain folder (e.g. `todos/todo.service.ts`).

When creating new files, follow this structure. Do not create top-level `components/`, `services/`, `models/`, `pipes/`, or `utils/` folders.

## Design for ADHD users

This is the single most important design constraint — it is why Orbit exists.

- Tool-switching is mentally exhausting — surface everything relevant in one place
- Context loss on distraction is costly — spatial stability and visual calm are essential
- Overwhelm is a real risk — show less but clearer, not more but busier

Every UI element, interaction, or feature must be evaluated against these principles:

- **Spatial Stability**: Layout must not shift or reorder. Users orient by position — losing that orientation is jarring and costly. Elements should stay where they are across interactions and data loads.
- **Zero-Depth Navigation**: No nested menus, no back buttons. Every interaction should resolve in one step, or as few steps as possible. If a user has to remember where they came from, the design has failed.
- **Status at a Glance**: State and status must be communicated visually through color, icons, and spatial position. Scanning beats reading — a user should understand what needs attention without reading a single word.
- **Chunking**: Group related information with strong visual separation. Avoid walls of undifferentiated content. White space and borders are tools for reducing cognitive load.
- **Frictionless Transitions**: Links to external tools (Jira, Bitbucket) must open in a new tab without breaking Orbit's context. The user should never lose their place.
- **Low Motion**: No auto-playing animations. Subtle transitions only (≤150ms). Movement draws attention — use it deliberately, not decoratively. The exception is dopamine feedback (e.g. confetti on task completion), where motion is engaging rather than distracting.
- **Progressive Disclosure**: Don't barrage the user with data. Reveal information in layers — start with the most salient facts and let the user drill down on demand. This prevents the mental freeze that occurs when an ADHD brain faces too much information at once.
- **Supportive Language**: Use forgiving error messages and non-blaming language. Every button and link should tell the user exactly what will happen when they click it. Avoid jargon and technical abbreviations — reduce the cognitive leap required to process commands.
- **Dopamine Closing**: Close the loop for every task. Provide immediate, tangible visual and audio feedback for completion. This provides the dopamine boost necessary for sustained engagement and prevents open-loop anxiety.

## Coding Standards

### TypeScript

- Strict type checking, prefer type inference when obvious
- Never use `any` — use `unknown` when type is uncertain
- Do not add explanatory comments to code

### Angular

- Standalone components only (do NOT set `standalone: true` — it's the default in Angular v20+)
- Signals for state, `computed()` for derived state, `OnPush` change detection everywhere
- `input()` / `output()` functions, not decorators
- `inject()` function, not constructor injection
- `host` object in `@Component` decorator, not `@HostBinding` / `@HostListener`
- Native control flow (`@if`, `@for`, `@switch`), not structural directives
- Class bindings, not `ngClass`. Style bindings, not `ngStyle`.
- `NgOptimizedImage` for all static images (not for inline base64)
- Reactive forms over template-driven forms
- Do not assume globals like `new Date()` are available in templates

### Testing

- **Runner:** Vitest via `@angular/build:unit-test` — run with `ng test --no-watch`
- **Zoneless project** — do NOT use `fakeAsync` or `tick` from `@angular/core/testing`
- **Flush effects:** `TestBed.tick()` (not the deprecated `flushEffects()`)
- **Component tests:** `TestBed.configureTestingModule({ imports: [MyComponent] })`

### After Making Changes

Always run both:
```bash
ng test --no-watch
npx ng build
```

## Visual Design System

### Philosophy

- **Warm over cold** — stone family, not slate/zinc. Calm and human, not clinical.
- **Reduce eye strain** — this UI is open all day. High contrast is good; high saturation is not.
- **Accent sparingly** — violet only for interactivity or selection, never decoratively.
- **Typography signals hierarchy** — ticket keys and branch names use monospace. Weight and size establish reading order, not color.

### Color Rules

Orbit uses semantic CSS custom properties defined in `src/styles/tokens.css`. Dark mode is toggled via a `dark` class on `<html>` (managed by `ThemeService`). The tokens redefine themselves under `.dark`, so **using token variables is usually all you need** — dark mode comes for free. Only when you need a color not covered by an existing token do you need to add a new token with both light and dark values to `tokens.css`. 

**Mandatory:**
- **Never hardcode neutral colors.** No `bg-white`, `bg-stone-50`, `text-stone-800`, `#ff00dd` etc. Use token variables that are defined in [src/styles/tokens.css](src/styles/tokens.css) and add them as needed. Some examples:
  - Backgrounds: `bg-[var(--color-bg-card)]`, `bg-[var(--color-bg-page)]`, `bg-[var(--color-bg-surface)]`
  - Text: `text-[var(--color-text-heading)]`, `text-[var(--color-text-body)]`, `text-[var(--color-text-muted)]`
  - Borders: `border-[var(--color-border-default)]`, `border-[var(--color-border-subtle)]`
  - Primary: `bg-[var(--color-primary-bg)]`, `text-[var(--color-primary-text)]`, `bg-[var(--color-primary-solid)]`
- **Semantic colors also use tokens.** Success, danger, signal, and info all have tokens (e.g. `--color-success-text`, `--color-danger-bg`, `--color-signal-bar`). Use these instead of direct Tailwind classes like `text-emerald-700`. If a needed shade doesn't have a token yet, add one to `tokens.css` first.
- **Form inputs** must have explicit `text-[var(--color-text-heading)]` and `placeholder:text-[var(--color-text-muted)]`.
- **No hex values** in component styles (except purely decorative SVGs).
- **Every component must work in both light and dark mode.**

### Allowed Palettes

| Role | Palette |
|---|---|
| Neutral | `stone` |
| Primary | `violet` |
| Attention | `amber` |
| Success | `emerald` |
| Error | `red` |
| Info | `blue` (links only) |

No other palettes (`gray`, `slate`, `zinc`, `indigo`, `sky`, etc.) may be used.

### Card States

Every card (ticket, PR, todo, idea) has exactly one state:

| State | Visual | When |
|---|---|---|
| **Inactive** | Reduced opacity (55% light / 62% dark) | User doesn't need to act |
| **Normal** | Neutral card, no accent | Default state |
| **Attention** | `border-l-4 border-amber-500` | Urgent or overdue |

Cards never have colored backgrounds. Color lives only in badges, icons, text, and the amber attention bar. Type badges ("Fehler", "Aufgabe", "User Story") are always neutral stone — only status badges carry semantic colors.

## Accessibility

- Must pass all AXE checks
- Must meet WCAG AA minimums: focus management, color contrast, ARIA attributes
