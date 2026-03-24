# Day Calendar — Design Spec

> Date: 2026-03-24

## Purpose

Fight time blindness by giving the user a visual overview of their day's appointments. The user fills out a simple daily timeline during the morning flow, then keeps it visible on the right side of the Arbeit view throughout the day. A red line shows the current time, making it obvious how much time remains before the next appointment.

No external calendar integration — the user manually enters appointments each morning. This is intentional: it makes them mindful of the day ahead.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Time range | 08:00–17:00 fixed | Covers standard workday, keeps grid manageable |
| Grid snap | 15 minutes | Covers 95% of real appointments, clean grid |
| Fine-tuning | Via popup time inputs | Allows non-15min precision when needed |
| Appointment data | Name + start/end only | Minimal v1, no categories or links |
| Day persistence | Single day, clears on date change | Fresh slate each morning, part of the ritual |
| History | None | Current day only, keeps feature simple |
| Drag approach | CSS Grid + pointer events | Full control, no library dependency, simple math |
| Current time indicator | Red line only | No notifications or emphasis on upcoming appointments |
| Deletion | Through edit popup only | Double-click → popup → delete button |
| Panel collapsible | Yes, to ~32px strip | Gives main content more room when needed |

## Data Model

```typescript
// models/day-schedule.model.ts

interface DayAppointment {
  id: string;           // 'apt-' + Date.now()
  title: string;
  startTime: string;    // 'HH:mm' format, e.g. '09:00'
  endTime: string;      // 'HH:mm' format, e.g. '10:15'
}

interface DaySchedule {
  date: string;         // 'YYYY-MM-DD'
  appointments: DayAppointment[];
}
```

## Persistence

- **File:** `data/day-schedule.json`
- **Endpoint:** `/api/day-schedule` (GET returns schedule, POST replaces it)
- **Date rollover:** `DayScheduleService` checks on load — if stored date ≠ today, clears appointments and saves empty schedule back
- Follows the same pattern as `TodoService` (GET all, POST full replacement)

## Layout

The right panel in the Arbeit view transforms from the current 144px action rail into a ~260px day calendar panel:

```
┌──────────┬──────────────────┬──────────────────┬────────────┐
│          │                  │                  │ [Action    │
│  Nav     │   Navigator      │   Workbench      │  Buttons]  │
│  Rail    │   (360-400px)    │   (flex-1)       │────────────│
│  (64px)  │                  │                  │ Tagesplan  │
│          │                  │                  │            │
│          │                  │                  │ 08:00      │
│          │                  │                  │ 09:00 ████ │
│          │                  │                  │ 10:00 ──── │ ← red line
│          │                  │                  │ 11:00      │
│          │                  │                  │ ...        │
│          │                  │                  │ 17:00      │
│          │                  │                  │  [‹]       │
└──────────┴──────────────────┴──────────────────┴────────────┘
```

### Collapsible Panel

- **Collapsed:** ~32px strip with a `›` chevron button, no calendar content
- **Expanded:** ~260px, full calendar + action buttons
- **Toggle:** Click chevron to collapse/expand
- **Animation:** Width transition, ≤150ms
- **Persistence:** `localStorage.setItem('orbit.dayCalendar.collapsed', ...)`
- **Default:** Expanded

## Morning Flow Integration

Current flow: Focus question → Submit → Animation → Readonly

New flow:

```
Focus question → "Weiter" (saves focus, no animation) → Calendar setup → "Fertig" → Animation → Readonly
```

1. User answers the focus question, clicks "Weiter" (replaces "Fokus setzen")
2. Focus is saved quietly (no animation yet)
3. `RhythmDetailComponent` transitions to a new `'calendar-setup'` view state
4. Calendar setup shows `DayTimelineComponent` in a centered layout with header "Tagesplan erstellen"
5. User creates appointments via drag-to-create, edits them, etc.
6. "Fertig" button completes the morning flow → celebration animation plays → readonly state
7. "Überspringen" button skips the calendar step → animation plays → readonly state
8. Right panel now shows the same appointments

If the user skips the focus question entirely, the calendar setup step is also skipped.

## Component Architecture

### DayTimelineComponent (shared, reusable)

The core visual component, used in both morning setup and right panel.

**Inputs:**
- `appointments: DayAppointment[]`

**Outputs:**
- `appointmentCreate: { startTime: string, endTime: string }` — drag-to-create completed
- `appointmentUpdate: DayAppointment` — edit/resize completed
- `appointmentDelete: string` — appointment id to delete

**Rendering:**
- CSS Grid container, each row = 15 minutes (36 rows for 08:00–17:00)
- Row height: ~8px per quarter-hour slot (32px per hour)
- Time labels on the left (every hour, half-hour labels in lighter color)
- Quarter-hour rows have subtle dotted borders, hour rows have solid borders
- Appointment blocks are absolutely positioned overlays within the grid
- Appointment styling: indigo-tinted background (`bg-indigo-50`), left border stripe (`border-l-3 border-indigo-500`), title + time range text

**Current time line:**
- Red horizontal line with a dot on the left
- Position calculated from current time relative to 08:00–17:00 range
- Updated every 60 seconds via `setInterval`
- Hidden if current time is outside 08:00–17:00

### Interactions

**Drag-to-create:**
1. `pointerdown` on empty grid area → record start slot
2. `pointermove` → show dashed indigo preview rectangle spanning from start slot to current slot
3. Preview shows time range text (e.g., "09:15 – 10:00")
4. Snap to nearest 15-minute boundary
5. `pointerup` → emit `appointmentCreate` with startTime/endTime → parent opens popup

**Drag-to-resize:**
1. Hover on appointment block → detect if pointer is within 6px of top or bottom edge
2. Show `ns-resize` cursor, subtle resize handle bar appears
3. `pointerdown` on edge → enter resize mode
4. `pointermove` → update preview (dashed extension/contraction)
5. Snap to 15-minute boundaries
6. `pointerup` → emit `appointmentUpdate` with new times

**Double-click to edit:**
1. `dblclick` on appointment block → emit edit event
2. Parent opens `AppointmentPopupComponent` with appointment data

### AppointmentPopupComponent

Overlay popup for creating and editing appointments.

**Inputs:**
- `appointment: Partial<DayAppointment>` (partial for new, full for edit)
- `isNew: boolean`

**Outputs:**
- `save: DayAppointment`
- `delete: string` (appointment id)
- `cancel: void`

**UI:**
- Positioned as a floating overlay (similar to QuickCapture pattern)
- Fixed backdrop with `bg-black/20 backdrop-blur-sm`
- Card: white, rounded-xl, shadow
- Name input (auto-focused on open)
- Von / Bis time inputs (side by side, editable text inputs in HH:mm format)
- Buttons: "Speichern" (indigo), "Abbrechen" (stone), "Löschen" (red, only if `!isNew`)
- Keyboard: Enter = save, Escape = cancel

### DayCalendarPanelComponent (right panel wrapper)

Replaces `ActionRailComponent` in the Arbeit view layout.

**Structure:**
- Action buttons at top (same logic as current `ActionRailComponent`, reformatted for horizontal layout)
- `DayTimelineComponent` below, filling remaining height
- Collapse/expand chevron button
- Reads appointments from `DayScheduleService`, handles create/update/delete events by calling service methods and managing popup state

### DayScheduleService (singleton)

**State:**
- `todaySchedule: signal<DaySchedule>` — the current day's schedule

**Methods:**
- `addAppointment(title, startTime, endTime)` → generates id, updates signal, saves
- `updateAppointment(appointment)` → updates signal, saves
- `deleteAppointment(id)` → removes from signal, saves
- `private save()` → `POST /api/day-schedule` with full schedule
- `private load()` → `GET /api/day-schedule`, check date, clear if stale

**Backend:**
- New route in proxy server for `/api/day-schedule`
- Reads/writes `data/day-schedule.json`
- Same pattern as existing todo/idea endpoints

## Edge Cases

- **Overlapping appointments:** Allowed — no validation. User is in control.
- **Minimum duration:** 15 minutes (one grid slot). Drag shorter than one slot = no appointment created.
- **Empty grid at day start:** Shows just the time labels and grid lines — no empty-state message needed, the morning flow guides the user.
- **Time outside range:** If it's before 08:00 or after 17:00, the red line is hidden.
- **Cancel during create:** If user cancels the popup after a drag-to-create, no appointment is created.
- **Drag outside grid bounds:** Clamped — dragging above 08:00 snaps to 08:00, dragging below 17:00 snaps to 17:00.
- **Skipped morning flow:** The right panel still shows the empty timeline with full interaction support. The user can create appointments anytime, not just during the morning flow.
- **Action buttons in panel:** Same buttons and logic as current ActionRailComponent, re-laid-out horizontally in the wider panel. No changes to button behavior.
- **Timeline component reuse:** `DayTimelineComponent` is identical in both contexts (morning setup and right panel) — same interactions, same rendering. No readonly mode.
