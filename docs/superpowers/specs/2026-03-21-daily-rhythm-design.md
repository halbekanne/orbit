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

## Rhythm Card (Navigator Integration)

The daily rhythm is surfaced as a special card at the very top of the navigator sidebar, above all work-item sections. This card lives alongside tickets, PRs, and todos — the user can browse other items first and come back to fill in the focus when ready. No forced overlays, no context switching.

### Card States

The card transitions through four visual states during the day:

| State | Visual | Left Stripe | Icon | When |
|-------|--------|-------------|------|------|
| **Morning open** | Indigo gradient bg, pulsing border | Indigo gradient (4px) | Sun ☀ | No morning focus set |
| **Morning filled** | White bg, indigo border | Solid indigo (4px) | Sun ☀ | Morning focus saved |
| **Evening open** | Amber gradient bg, pulsing border | Amber gradient (4px) | Moon 🌙 | After 15:00, morning done, no evening reflection |
| **Evening filled** | White bg, stone border | Indigo→Amber gradient (4px) | Checkmark ✓ | Both morning and evening complete |

### Card Content by State

**Morning open:** Label "TAGESFOKUS" + weekday + CTA "Fokus setzen →". No question shown (question appears only in detail view).

**Morning filled:** Label "TAGESFOKUS" + weekday + question text (italic, Instrument Serif) + answer text.

**Evening open:** Label "TAGESREFLEKTION" + weekday + CTA "Tag reflektieren →". No question shown.

**Evening filled:** Label "TAG ABGESCHLOSSEN" + weekday + question text + answer text + completion chips (e.g. "2 Aufgaben", "1 PR").

### Card Visual Distinction

The rhythm card is visually distinct from work-item cards:
- **4px stripe** (vs 3px on tickets) — slightly bolder
- **Gradient background** when open (vs flat white)
- **Instrument Serif** for question/answer text — journalhafte Anmutung
- **Subtle pulsing border glow** when open — draws attention without being disruptive, stops on hover
- **Rounded 10px** (vs 8px on tickets) — softer, more personal

### Card Interaction

Clicking the rhythm card selects it (like any other navigator item). The workbench then shows the rhythm detail view.

### Transition from Morning to Evening

At 15:00, if the morning has been completed/skipped and the evening has not been completed, the card visually transitions from the morning-filled state to the evening-open state. This is checked via a `currentHour` signal updated by `setInterval` every 5 minutes.

The card itself serves as the evening nudge — no separate toast component is needed. The amber gradient background and pulsing border naturally draw the user's attention.

## Rhythm Detail View (Workbench)

When the rhythm card is selected, the workbench shows a centered detail view. The content depends on the card state.

### Input View (morning or evening open)

```
┌────┬──────────┬──────────────────────────────────┐
│    │ [rhythm] │                                   │
│ ⚡ │ [ticket] │    ☀ Tagesfokus                   │
│Arb │ [ticket] │    Sonntag, 22. März 2026         │
│    │ [ticket] │                                   │
│ 📅 │ [todos]  │    « rotierende Frage (Serif) »   │
│Time│          │                                   │
│    │          │    ┌──────────────────────────┐   │
│    │          │    │ Freitext-Eingabe        │   │
│    │          │    └──────────────────────────┘   │
│    │          │                                   │
│    │          │    [Fokus setzen]  [Überspringen] │
│    │          │                                   │
└────┴──────────┴──────────────────────────────────┘
```

- Centered content, max-width ~460px, generous whitespace
- Header: Icon (sun/moon) + title + date
- Question in Instrument Serif italic with indigo/amber gradient accent line
- Textarea for free text (placeholder: "Dein Fokus für heute..." / "Deine Gedanken zum Tag...")
- "Fokus setzen" / "Abschließen" button (indigo for morning, stone-800 for evening)
- "Überspringen" secondary button
- Escape key triggers skip

For the evening input view, a completion summary is shown above the question:
- Lists all `completedItems` for the day
- If empty: "Kein Problem — nicht jeder Tag ist ein Produktivitätstag." (supportive, non-blaming)

### Read-Only View (morning or evening filled)

Same layout as input view but without the textarea and buttons. Shows question + answer in read-only form. The answer is displayed in an Instrument Serif card with subtle stone background.

For the evening filled view, the completion summary ("Heute geschafft") is shown below the answer with individual items and timestamps.

## Submit Animation ("Fokus-Moment")

When the user submits the morning focus or evening reflection, a choreographed animation plays across both the detail view and the navigator card (~4 seconds total). This provides the dopamine-closing reward.

### Detail View Animation Sequence

1. **Form fade-out** (0–400ms): The input form fades out and slides up slightly
2. **Success circle pop** (550ms): An indigo circle (morning) or stone circle (evening) pops in at center with spring easing
3. **Checkmark draw** (850ms): A white checkmark draws itself inside the circle
4. **"Fokus gesetzt!" text** (1200ms): Success text fades in below the circle in Instrument Serif
5. **Hold** (1200–2600ms): The success message stays visible for ~1.4s
6. **Fade out** (2600ms): Success overlay fades out
7. **Read-only view fade-in** (3050ms): The filled detail view slides in from below

### Navigator Card Animation Sequence (starts at 1600ms, slightly after detail)

1. **Content fade-out** (1600ms): Card content and header fade out
2. **Stripe expand** (1600ms): The 4px stripe expands to cover the entire card with indigo/amber fill
3. **Checkmark draw** (2100ms): A white checkmark draws itself centered on the expanded stripe
4. **Stripe collapse** (2800ms): Checkmark fades, stripe collapses back to 4px. **Important:** The checkmark SVG must be set to `display: none` after fading out to prevent it from overlaying the new content.
5. **Content swap** (3200ms): Card header fades back in, new content (question + answer) slides up into view. Card visual state switches (e.g. `rhythm-open` → `rhythm-filled`).

### Timing Principle

The two animations are **staggered, not simultaneous**: detail view leads (primary focus), navigator card follows (peripheral perception). This avoids sensory overload while still creating a cohesive moment.

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

- Rhythm card: `aria-pressed` for selection state, descriptive `aria-label` (e.g. "Tagesfokus: noch nicht ausgefüllt")
- Textarea has visible label (the question serves as label, connected via `aria-labelledby`)
- Timeline: day cards are `<article>` elements with date as heading
- All interactive elements have focus-visible styles
- Escape key triggers skip in the detail input view
- Submit animation: purely decorative, does not block keyboard interaction — the read-only view receives focus after the animation completes

## Scope Boundaries

**In scope:**
- `DayRhythmService` with `days.json` persistence
- Rhythm card component (navigator integration, 4 visual states, pulsing animation)
- Rhythm detail component (input view, read-only view, success animation)
- Submit animation (stripe-expand + checkmark on card, success-flash on detail)
- Timeline view (scrollable day cards)
- Question pools (15 morning, 15 evening)
- Completed item tracking hooks in existing services
- Card transition from morning to evening (at 15:00, via `currentHour` signal)

**Out of scope:**
- Streaks or streak visualization
- Achievements triggered by daily rhythm usage
- Weekly/monthly aggregation views
- Export or sharing of timeline data
- Customizable evening transition time (hardcoded 15:00 for now, configurable later)
- Progress bar / momentum meter
