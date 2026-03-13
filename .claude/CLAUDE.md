
You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

---

## Project Identity

Orbit is a personal command center for a frontend engineer at a German insurance company. It lives permanently on a dedicated second monitor, visible throughout the workday. It integrates with work tools (Jira, Bitbucket, and others) — real API integrations come in later iterations.

- **UI language is German** — all user-facing text must be in German
- **The "anti-Jira" principle**: Orbit must feel instant, clean, and low-noise — the opposite of cluttered enterprise tools

Read the `/project-idea.md` file to gain more understanding about this project.

## The User

The primary user has ADHD. This is the single most important design constraint — it is why Orbit exists.

- Tool-switching is mentally exhausting → surface everything relevant in one place
- Context loss on distraction is costly → spatial stability, predictability, and visual calm are essential
- Overwhelm is a real risk → prefer showing less but clearer, over more but busier

## ADHD UX Principles

Follow these guiding principles when working on the UX/UI:

- **Unified Context and the Single Source of Truth**: Orbit must act as a cognitive consolidator. Every time a user has to hunt for information across tabs, they pay a mental tax. The goal is to bring the task, the context, and the collaboration into a single, unified view where the user’s focus is never broken by the need to navigate elsewhere.
- **Scaffolding through Progressive Disclosure**: Do not barrage the user with data. Reveal information in layers. Start with the most salient facts and allow the user to drill down into details at their own request. This prevents the mental freeze that occurs when an ADHD brain is presented with a complex, high-stakes decision all at once.
- **Language must be supportive and literal**: Design for the vulnerable brain in distress by using forgiving error messages and non-blaming language. Every button and link should act like a crystal ball, telling the user exactly what will happen when they click it. Avoiding jargon and technical abbreviations reduces the cognitive leap required to process commands. System tones should avoid the authoritative voice that can trigger oppositional behavior.
- **Meaningful Rewards and Dopamine Closing**: Close the loop for every task. Provide immediate, tangible visual feedback for completion. This is also the part where fun animations, sounds, etc. play a vital role, here there are not distracting but rather engaging. This provides the dopamine boost necessary for sustained engagement and prevents open-loop anxiety, where the user feels they have forgotten to finish a sub-task.
- **Be mindful of the users focus and attention**: Orbit should act as a digital companion that supports the user's focus without becoming another source of interruption or pressure.

Every new UI element, interaction, or feature must be evaluated against these constraints:

- **Spatial Stability**: Layout must not shift or reorder. Users orient by position; losing that orientation is jarring.
- **Zero-Depth Navigation**: No nested menus, no back buttons. Every interaction should resolve in one step, or in as few steps as possible.
- **Status at a Glance**: State/status must be communicated visually (color, icon) — scanning beats reading.
- **Chunking**: Group related information with strong visual separation. Avoid walls of undifferentiated content.
- **Frictionless Transitions**: Links to external tools (Jira, Bitbucket) must open in a new tab without breaking Orbit's context.
- **Low Motion**: No auto-playing animations. Subtle transitions only (≤150ms). Movement draws attention — use it deliberately, e.g. to trigger a dopamine boost when a task is complete.

## Visual Design Philosophy

- **Warm over cold**: The palette should feel calm and human, not clinical. Warm neutrals (stone family) over cool grays (slate/zinc).
- **Reduce eye strain**: This UI is open all day. High contrast is good; high saturation is not. Keep backgrounds low-key.
- **Accent sparingly**: Use the primary accent color (indigo) only to signal interactivity or selection — never decoratively.
- **Typography signals hierarchy**: Key identifiers (ticket keys, branch names) use monospace. Use weight and size, not color, to establish reading order.
