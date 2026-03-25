# Pomodoro Timer & Focus Marker — Design Spec

> Date: 2026-03-24

## Overview

Two independent features that complement each other but do not interact:

1. **Focus Marker** — a cognitive anchor that promotes one work item to a dedicated section at the top of the navigator
2. **Pomodoro Timer** — a timer with timeline visualization, progress bar, and a full break experience with an animated astronaut overlay

Both features are designed for the ADHD brain: spatial stability, low friction, clear visual states, and a break experience that actively encourages stepping away.

---

## Feature 1: Focus Marker

### Purpose

A simple toggle that marks one work item as "what I'm working on right now." Purely a visual/cognitive anchor — no timer, no automation, no notifications.

### Interaction

- When a work item (ticket, PR, task, idea) is selected in the workbench, the **action rail** shows a new button: **"Fokus setzen"** (target/crosshair icon).
- Clicking it marks that item as the current focus. The button changes to **"Fokus entfernen"**.
- If another item was already focused, the focus silently moves to the new item (only one item can be in focus at a time).
- Clicking "Fokus entfernen" removes focus entirely — no item is focused.

### Navigator: Pinned Focus Section

- The focused item gets **promoted out of its original list** and rendered in a dedicated **"Fokus" section** at the top of the navigator, right below the rhythm card.
- The section has a header: "🎯 Fokus" with a gradient separator line.
- The focused card uses a stronger visual treatment: thicker indigo border, bolder title.
- The item is **removed from its original list** while focused (no duplication). When focus is removed, it returns to its original position.
- The focus section is not collapsible — it's always visible when an item is focused.
- When no item is focused, the section is not rendered at all.

### Edge Cases

- **Focused item disappears from source:** If a focused Jira ticket is no longer returned by the API (moved to Done, reassigned, etc.), the focus is automatically cleared. No notification needed — the section simply disappears.
- **Focus removal and selection:** When "Fokus entfernen" is clicked, the item remains selected in the workbench. Only the focus promotion is removed.

### Data Model

- `FocusService` (providedIn: root)
- Single signal holding the focused item's ID and type (e.g. `{ id: string, type: 'ticket' | 'pr' | 'todo' | 'idea' }`) or `null`.
- The navigator resolves the full work item by looking up the ID across the relevant service (`WorkDataService` for tickets/PRs, `TodoService` for tasks, `IdeaService` for ideas). If the lookup returns nothing, focus is cleared.
- Persisted to localStorage.

---

## Feature 2: Pomodoro Timer

### Purpose

A focus-session timer that helps the user stay in the zone and reminds them to take breaks. The timer is independent of the focus marker — starting a Pomodoro does not require or affect which item is focused.

### Architecture: Separate Service with Timeline Visualization

The timer is its own service (`PomodoroService`) with its own state machine. A read-only visualization renders the current session onto the day timeline as an overlay — but it is **not** an appointment in the data model. This keeps timer logic cleanly separated from the appointment/schedule system.

### Timer States

```
idle → running → break → idle
                  ↑        ↓
                  └── running (another round)
```

- **idle**: No session active.
- **running**: Focus session in progress. Timeline block visible, progress bar filling.
- **break**: Break in progress. Full overlay covers the app.

### Starting a Session

- A **button in the Tagesplan panel** (in the header area, near the "Tagesplan" title).
- When idle: shows "Pomodoro starten" (or a play icon).
- Clicking it opens a **small config popup** (similar to the appointment popup):
  - Focus duration: number input, default 25 minutes.
  - Break duration: number input, default 5 minutes.
  - "Starten" button.
- Default durations are remembered (persisted to localStorage) so the user only configures once.
- The popup can be dismissed without starting by pressing Escape or clicking outside (same pattern as the existing appointment popup).
- On start: timer begins, timeline block appears, progress bar starts filling.

### During a Focus Session

#### Timeline Block
- A block renders on the day timeline at the current time slot.
- Styled **distinctly from appointments** (e.g. dashed border, different pattern, or subtle pulsing) so it's clearly a timer block, not a scheduled event.
- Shows the duration label inside the block.
- Only the **focus block** renders — no break block on the timeline.
- The existing red current-time indicator line moves through it.
- If the session extends past the timeline's `END_HOUR` (17:00), the block is clipped at the grid boundary. The progress bar at the top still shows the full session progress.

#### Top Progress Bar
- A thin bar (3–4px tall) at the very top of the entire app, above all other content.
- Fills left-to-right as the focus session progresses.
- Indigo colored.
- No text, no buttons — purely visual.
- Visible even when the Tagesplan panel is collapsed.
- Disappears when no session is active.

### Canceling a Session

- While running, the start button in the Tagesplan panel transforms to **"Pomodoro abbrechen"**.
- Clicking it shows a brief confirmation: **"Pomodoro abbrechen?"** with yes/no.
- On cancel: progress bar disappears, timeline block is removed, timer returns to idle.
- When the Tagesplan panel is collapsed, the cancel button is not accessible. The user must expand the panel to cancel. This is acceptable since canceling is a rare action and the panel expands with one click.

### Focus Time Ends

- A **single distinct chime** sound plays.
- A **full-screen overlay** fades in over the entire app:
  - Semi-transparent backdrop that blurs and dims the app beneath.
  - White card in the center with rounded corners and a drop shadow.
  - A simple icon (e.g. ☀️) at the top.
  - **Congratulatory message** from a rotating pool (e.g. "Gut gemacht!", "Super Arbeit!", "Stark durchgehalten!").
  - **"X Minuten Fokuszeit geschafft."** confirmation line.
  - **Break suggestion** from a rotating pool (e.g. "Steh auf und streck dich kurz", "Trink ein Glas Wasser", "Schau kurz aus dem Fenster", "Mach ein paar tiefe Atemzüge").
  - Two buttons:
    - **"Pause starten (X Min)"** — primary, prominent. Starts the break.
    - **"Noch 5 Minuten arbeiten"** — secondary, less prominent. Snooze.

#### Snooze Mechanic
- Clicking "Noch 5 Minuten arbeiten" dismisses the overlay and extends the focus session by 5 minutes.
- After those 5 minutes, the **same chime + overlay appear again**.
- This is infinitely repeatable — the user always has the option to snooze, but the repeated interruption creates enough friction to eventually nudge them into taking a break.

### Break Experience

#### Break Overlay
- After clicking "Pause starten", the overlay transforms into the **break screen**.
- **Full dark background** (deep indigo-to-dark gradient) covering the entire app.
- The app beneath remains blurred and inaccessible — actively discouraging work.

#### Floating Astronaut Animation
- A small **SVG astronaut** floats weightlessly above an Earth curve glow at the bottom of the screen.
- The astronaut has **idle personality animations** that cycle through:
  - Waving a hand
  - Putting hands behind head (relaxing pose)
  - Looking around
  - Stretching
- The animations are slow, gentle, and looping — no sudden movements. Animation cycles should be 8–12 seconds minimum with `ease-in-out` easing.
- **Twinkling stars** in the background, subtle **nebula clouds** drifting.
- Subtext: **"Schwerelos treiben lassen …"**

#### Break UI Elements
- "Pause" title in light, airy typography.
- A **subtle progress bar** showing break progress (not a countdown timer — calm, not pressuring).
- **"noch X Minuten"** in subdued text.
- The **break suggestion** from the initial popup stays visible.
- A small **"Pause beenden"** button at the bottom for canceling the break early if needed.

### Break Ends

- A **softer, different sound** than the focus-end chime.
- The dark overlay transitions to a **white card overlay** (less dim backdrop — the app is "coming back"):
  - Icon (e.g. 🚀).
  - **"Pause vorbei!"**
  - **"Bereit für die nächste Runde?"**
  - Two buttons:
    - **"Neue Fokuszeit starten"** — primary. Starts another focus session with the same settings.
    - **"Fertig für jetzt"** — secondary. Closes everything, returns to idle.

---

## Data & Persistence

### PomodoroService
- Manages timer state machine (idle / running / break).
- Stores start timestamp and durations (not an interval counter) — survives page refresh.
- Emits events: `sessionStart`, `sessionEnd`, `breakStart`, `breakEnd`.
- Default durations persisted to localStorage.
- No backend dependency.

### Page Refresh / Recovery Behavior
- On page load, `PomodoroService` checks localStorage for an active session.
- **If focus session is still in progress:** Resume — timeline block reappears, progress bar jumps to the correct position based on elapsed time since start timestamp.
- **If focus session ended while page was closed** (elapsed time > focus duration): Silently reset to idle. No overlay or chime — the moment has passed and retroactively interrupting would be confusing.
- **If break is still in progress:** Resume — break overlay reappears with correct remaining time.
- **If break ended while page was closed:** Silently reset to idle.

### FocusService
- Manages which item is focused (ID + type, or `null`).
- Persisted to localStorage.
- No backend dependency.

### Independence
- The two services have **no dependencies on each other**.
- Starting a Pomodoro does not affect focus state and vice versa.

---

## Sound Design

- **Focus ends**: A single distinct chime/bell tone. Noticeable but not harsh.
- **Break ends**: A softer, different tone. Gentle nudge back to awareness.
- Sounds should be short (1–2 seconds max).
- Sound playback is best-effort — wrapped in a catch for browsers that block autoplay. The visual overlay is the authoritative notification.

---

## Accessibility

- All overlays are focus-trapped (keyboard focus stays within the overlay).
- Overlay buttons are reachable via Tab and activatable via Enter/Space.
- Progress bar has `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
- Sound notifications are complemented by visual indicators (never sound-only).
- Animations respect `prefers-reduced-motion` — reduced to static states when enabled.
- All text in German, consistent with Orbit's UI language.

---

## Out of Scope

- Long break cycles (every 4th Pomodoro) — not needed per user preference.
- Pomodoro history / statistics tracking.
- Integration between focus marker and Pomodoro timer.
- Sound customization / volume control.
- Multiple simultaneous focus items.
