# Tagesrhythmus-System — Design Spec

## Overview

A daily rhythm system that bookends each workday with intention and reflection. In the morning, Orbit prompts the user to set a focus for the day (with a rotating motivational question). In the evening, a gentle nudge invites them to reflect on the day (with a rotating reflection question). Both entries, along with automatically tracked completions, are stored per day and displayed in a scrollable Timeline view.

### ADHD Relevance

- **Task initiation**: The morning prompt breaks the "where do I start?" freeze by asking one simple question
- **Dopamine closing**: The evening reflection makes accomplishments visible, closing open loops
- **Long-term self-evidence**: The Timeline proves to the user over weeks and months that they are productive, even when individual days feel chaotic
- **Low pressure**: Morning flow is automatic but skippable, evening is a gentle nudge — never guilt-inducing

## Data Model

### DayEntry Interface

```typescript
interface DayEntry {
  date: string; // ISO date, e.g. "2026-03-21"
  morningQuestion: string | null;
  morningFocus: string | null; // free text
  morningAnsweredAt: string | null; // ISO datetime
  eveningQuestion: string | null;
  eveningReflection: string | null; // free text
  eveningAnsweredAt: string | null; // ISO datetime
  completedItems: CompletedItem[];
}

interface CompletedItem {
  type: 'todo' | 'ticket' | 'pr';
  id: string;
  title: string;
  completedAt: string; // ISO datetime
}
```

### Storage

- File: `~/.orbit/days.json` — array of `DayEntry` objects, newest first
- A new entry is created automatically when Orbit detects a new day (no entry for today exists)
- `completedItems` are appended in real-time as items are completed during the day
- Morning and evening fields start empty and are filled when the user completes the respective flow

### Question Pool

Two separate pools, each with 15-20 questions. A question is selected randomly per day, avoiding the last 5 used questions to prevent repetition.

**Morning questions** (forward-looking, intention-setting):

1. "Was wäre das Beste, was du heute schaffen könntest?"
2. "Worauf möchtest du dich heute konzentrieren?"
3. "Was würde den heutigen Tag zu einem guten Tag machen?"
4. "Welche eine Sache würdest du heute gerne abschließen?"
5. "Was ist heute wirklich wichtig — nicht nur dringend?"
6. "Wenn du heute nur eine Sache schaffst, welche soll es sein?"
7. "Was würde dich heute Abend zufrieden auf den Tag zurückblicken lassen?"
8. "Worauf freust du dich heute?"
9. "Was brauchst du heute, um gut arbeiten zu können?"
10. "Welches Thema verdient heute deine beste Energie?"
11. "Was hast du gestern angefangen, das du heute weiterführen möchtest?"
12. "Wie möchtest du dich heute Abend fühlen?"
13. "Was steht heute an, das du am liebsten schnell hinter dich bringen würdest?"
14. "Gibt es etwas, das du heute bewusst loslassen möchtest?"
15. "Was wäre ein kleiner Gewinn, der deinen Tag besser machen würde?"

**Evening questions** (reflective, appreciative):

1. "Was hat heute gut geklappt?"
2. "Worauf bist du heute stolz?"
3. "Was hast du heute gelernt?"
4. "Was hat dich heute überrascht?"
5. "Was würdest du morgen anders machen?"
6. "Wofür bist du heute dankbar?"
7. "Was hat dir heute Energie gegeben?"
8. "Was hat dich heute gebremst?"
9. "Gab es einen Moment heute, der sich gut angefühlt hat?"
10. "Was war heute leichter als erwartet?"
11. "Hast du heute jemandem geholfen oder hat dir jemand geholfen?"
12. "Was kannst du von heute mitnehmen?"
13. "Was hättest du heute gebraucht, das dir gefehlt hat?"
14. "Welchen Fortschritt hast du heute gemacht, auch wenn er klein war?"
15. "Was möchtest du morgen als erstes angehen?"

Questions are stored as constants in a dedicated file. The selection algorithm tracks recently used questions in `localStorage` to ensure variety.

## Morning Flow

### Trigger

On app initialization, check if a `DayEntry` for today exists with `morningAnsweredAt !== null`. If not, show the morning flow.

### Precedence Rule

The morning flow always takes priority over the evening nudge. If the app is opened after 17:00 and the morning was never completed, show the morning flow first. The evening nudge only appears once the morning flow has been completed or skipped for the current day.

### UI: Full-Screen Overlay

The morning flow takes over the entire content area (right of the Hybrid Rail). It is not a modal — it replaces the active view content temporarily.

```
┌────┬─────────────────────────────────────────┐
│    │                                         │
│ ⚡ │     Guten Morgen! 👋                    │
│Arb │                                         │
│    │     « rotierende Frage »                │
│ 📅 │                                         │
│Time│     ┌─────────────────────────────────┐ │
│    │     │ Freitext-Eingabe               │ │
│    │     │                                 │ │
│    │     └─────────────────────────────────┘ │
│    │                                         │
│    │     [Tag starten]        [Überspringen] │
│    │                                         │
└────┴─────────────────────────────────────────┘
```

- Greeting: "Guten Morgen!" (or time-appropriate: "Guten Tag!" after 12:00)
- The rotating question is displayed prominently
- Textarea for free-text focus (2-3 lines, auto-growing)
- "Tag starten" saves the entry and dismisses the flow
- "Überspringen" dismisses without saving (entry remains with empty morning fields)
- After dismissal, the previously active view is shown

### Design

- Centered content, max-width ~500px, generous whitespace
- Warm, calm styling — background `bg-stone-50`, text `text-stone-800`
- Question in slightly larger font, `text-lg` or `text-xl`, `text-stone-600`
- No distracting elements — this should feel like a quiet moment

## Evening Nudge

### Trigger

After 17:00, if `eveningAnsweredAt` is null for today and the morning flow has been completed or skipped, show a toast/banner. The check runs on a periodic interval (every 5 minutes) while the app is open.

### UI: Toast Banner

A non-intrusive banner at the bottom or top of the screen:

```
┌─────────────────────────────────────────────────────┐
│  🌅  Wie war dein Tag? → Tagesreflexion starten  ✕  │
└─────────────────────────────────────────────────────┘
```

- Dismissible (✕ button) — once dismissed, does not reappear until the next day
- Clicking "Tagesreflexion starten" opens the evening flow
- Subtle animation on appearance (slide in from bottom, ≤150ms)
- Persists dismissed state in `localStorage` for the current day

### Evening Flow UI

Same layout as morning flow, but with different content:

- Heading: "Feierabend!" or "Zeit für einen Rückblick"
- Shows the day's completions as a visual summary before the question
- The rotating evening question
- Textarea for reflection
- "Abschließen" saves, "Überspringen" dismisses

### Completion Summary (shown in evening flow)

```
Heute erledigt:
✓ COBI-1234 Auth-Token Migration     (Ticket)
✓ PR #42 reviewed                     (PR)
✓ Unit Tests schreiben                (Todo)
✓ Slack-Nachricht an Team             (Todo)
```

- Lists all `completedItems` for the day
- If empty: "Kein Problem — nicht jeder Tag ist ein Produktivitätstag." (supportive, non-blaming)

## Timeline View

### Location

A dedicated view in the Hybrid Rail navigation, accessible via the "Timeline" entry.

### UI: Scrollable Day Cards

```
┌────┬─────────────────────────────────────────────┐
│    │  Timeline                                    │
│ ⚡ │                                              │
│Arb │  ┌─ Freitag, 21. März 2026 ───────────────┐ │
│    │  │ 🎯 Fokus: "INGEST-Refactoring"         │ │
│ 📅 │  │                                         │ │
│Time│  │ Erledigt:                                │ │
│    │  │ ✓ COBI-1234 Auth-Token Migration        │ │
│    │  │ ✓ PR #42 reviewed                       │ │
│    │  │ ✓ 2 Todos                               │ │
│    │  │                                         │ │
│    │  │ 🌅 "Guter Tag, Auth-Migration war       │ │
│    │  │    schwieriger als gedacht aber fertig." │ │
│    │  └─────────────────────────────────────────┘ │
│    │                                              │
│    │  ┌─ Donnerstag, 20. März 2026 ─────────────┐ │
│    │  │ 🎯 Fokus: "PR-Backlog aufräumen"        │ │
│    │  │ ...                                      │ │
│    │  └─────────────────────────────────────────┘ │
└────┴─────────────────────────────────────────────┘
```

### Day Card Content

Each day card shows (in order):

1. **Date header**: Weekday + full date, German locale
2. **Morning focus**: The free-text focus, prefixed with a target icon. Omitted if not set.
3. **Completed items**: Grouped list of completed items. If many, show count with expandable detail.
4. **Evening reflection**: The free-text reflection, prefixed with a sunset icon. Omitted if not set.

### Design

- Cards use the existing Orbit card styling (warm stone palette, subtle borders)
- Vertical scroll, newest day at the top
- Days without any data (no focus, no completions, no reflection) are omitted
- Empty state: "Noch keine Einträge. Starte deinen ersten Tag mit einem Fokus!"

## Tracking Completed Items

### Integration Points

When any of these actions occur, append to today's `completedItems`:

- **Todo**: status changes to `'done'` → capture title
- **Ticket**: status changes to `'Done'` → capture key + summary
- **PR**: when marked as approved/merged → capture title

This requires minimal hooks in `TodoService` (todo completions), `WorkDataService` (ticket status changes), and `BitbucketService` (PR approvals/merges). Each service calls a method on a new `DayRhythmService` to record the completion.

### DayRhythmService

```typescript
@Injectable({ providedIn: 'root' })
export class DayRhythmService {
  private readonly days = signal<DayEntry[]>(this.load());

  todayEntry = computed(() => this.days().find(d => d.date === this.todayDate()));

  recordCompletion(item: CompletedItem): void { ... }
  saveMorning(focus: string, question: string): void { ... }
  saveEvening(reflection: string, question: string): void { ... }
}
```

## Accessibility

- Morning/evening flows: focus is trapped within the flow while open
- Textarea has visible label (the question serves as label, connected via `aria-labelledby`)
- Toast banner: `role="status"` with `aria-live="polite"`
- Timeline: day cards are `<article>` elements with date as heading
- All interactive elements have focus-visible styles
- Skip link or Escape to dismiss morning flow

## Scope Boundaries

**In scope:**
- `DayRhythmService` with `days.json` persistence
- Morning flow (auto-trigger, question, free text, save/skip)
- Evening nudge (toast, 17:00 trigger, dismissible)
- Evening flow (completion summary, question, free text, save/skip)
- Timeline view (scrollable day cards)
- Question pools (15 morning, 15 evening)
- Completed item tracking hooks in existing services

**Out of scope:**
- Streaks or streak visualization
- Achievements triggered by daily rhythm usage
- Weekly/monthly aggregation views
- Export or sharing of timeline data
- Customizable evening nudge time (hardcoded 17:00 for now, configurable later)
- Progress bar / momentum meter
