# Tagesrhythmus-System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a daily rhythm system with morning focus prompt, evening reflection nudge, completion tracking, and a journal-style Timeline view.

**Architecture:** A `DayRhythmService` manages `DayEntry` objects persisted to `~/.orbit/days.json`. The daily rhythm is surfaced via a `RhythmCardComponent` at the top of the navigator sidebar (integrated like tickets/PRs/todos). Clicking the card shows a `RhythmDetailComponent` in the workbench with input or read-only view. Submitting triggers a choreographed animation across both card and detail (~4s). The card transitions through 4 states during the day: morning-open → morning-filled → evening-open → evening-filled. No separate overlay or toast components. Question pools are static constants with localStorage-based rotation tracking.

**Tech Stack:** Angular 21 (standalone, zoneless, signals), Tailwind CSS, Vitest, Instrument Serif font

**Spec:** `docs/superpowers/specs/2026-03-21-daily-rhythm-design.md`

**Design Mockups:** `.superpowers/brainstorm/84490-1774128488/rhythm-cards.html` (card states), `focus-moment.html` (submit animation), `timeline-view-v2.html` (timeline)

**Prerequisite:** Hybrid Rail Navigation must be implemented first (provides the view switching infrastructure and ViewTimelineComponent placeholder).

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/app/models/day-entry.model.ts` | DayEntry, CompletedItem interfaces |
| Create | `src/app/data/daily-questions.ts` | Morning + evening question pools, selection algorithm |
| Create | `src/app/services/day-rhythm.service.ts` | Core service: persistence, completions, morning/evening save, rhythm phase |
| Create | `src/app/services/day-rhythm.service.spec.ts` | Service tests |
| Create | `src/app/components/rhythm-card/rhythm-card.ts` | Navigator card with 4 visual states + stripe-expand animation |
| Create | `src/app/components/rhythm-card/rhythm-card.spec.ts` | Card tests |
| Create | `src/app/components/rhythm-detail/rhythm-detail.ts` | Workbench detail view: input form, read-only view, success animation |
| Create | `src/app/components/rhythm-detail/rhythm-detail.spec.ts` | Detail tests |
| Modify | `src/app/views/view-timeline/view-timeline.ts` | Replace placeholder with journal timeline |
| Create | `src/app/views/view-timeline/view-timeline.spec.ts` | Timeline view tests |
| Create | `src/app/views/view-timeline/view-timeline.html` | Timeline template with journal layout |
| Modify | `src/app/components/navigator/navigator.ts` | Add RhythmCardComponent import, rhythm card at top |
| Modify | `src/app/components/navigator/navigator.html` | Add rhythm card section above tickets |
| Modify | `src/app/components/workbench/workbench.ts` | Add RhythmDetailComponent import, handle 'rhythm' item type |
| Modify | `src/app/components/workbench/workbench.html` | Add @case for rhythm detail view |
| Modify | `src/app/services/todo.service.ts:84-93` | Hook into update() to record todo completions |
| Modify | `src/app/services/work-data.service.ts` | Track ticket status changes to record ticket completions |
| Modify | `src/styles.css` | Import Instrument Serif, add stagger + card animations |

---

### Task 1: Data model and question pools

**Files:**
- Create: `src/app/models/day-entry.model.ts`
- Create: `src/app/data/daily-questions.ts`

- [ ] **Step 1: Create the DayEntry model**

```typescript
// src/app/models/day-entry.model.ts
export interface CompletedItem {
  type: 'todo' | 'ticket' | 'pr';
  id: string;
  title: string;
  completedAt: string;
}

export interface DayEntry {
  date: string;
  morningQuestion: string | null;
  morningFocus: string | null;
  morningAnsweredAt: string | null;
  eveningQuestion: string | null;
  eveningReflection: string | null;
  eveningAnsweredAt: string | null;
  completedItems: CompletedItem[];
}
```

- [ ] **Step 2: Create question pools with selection algorithm**

```typescript
// src/app/data/daily-questions.ts
const STORAGE_KEY_MORNING = 'orbit.questions.morning.recent';
const STORAGE_KEY_EVENING = 'orbit.questions.evening.recent';

export const MORNING_QUESTIONS: string[] = [
  'Was wäre das Beste, was du heute schaffen könntest?',
  'Worauf möchtest du dich heute konzentrieren?',
  'Was würde den heutigen Tag zu einem guten Tag machen?',
  'Welche eine Sache würdest du heute gerne abschließen?',
  'Was ist heute wirklich wichtig — nicht nur dringend?',
  'Wenn du heute nur eine Sache schaffst, welche soll es sein?',
  'Was würde dich heute Abend zufrieden auf den Tag zurückblicken lassen?',
  'Worauf freust du dich heute?',
  'Was brauchst du heute, um gut arbeiten zu können?',
  'Welches Thema verdient heute deine beste Energie?',
  'Was hast du gestern angefangen, das du heute weiterführen möchtest?',
  'Wie möchtest du dich heute Abend fühlen?',
  'Was steht heute an, das du am liebsten schnell hinter dich bringen würdest?',
  'Gibt es etwas, das du heute bewusst loslassen möchtest?',
  'Was wäre ein kleiner Gewinn, der deinen Tag besser machen würde?',
];

export const EVENING_QUESTIONS: string[] = [
  'Was hat heute gut geklappt?',
  'Worauf bist du heute stolz?',
  'Was hast du heute gelernt?',
  'Was hat dich heute überrascht?',
  'Was würdest du morgen anders machen?',
  'Wofür bist du heute dankbar?',
  'Was hat dir heute Energie gegeben?',
  'Was hat dich heute gebremst?',
  'Gab es einen Moment heute, der sich gut angefühlt hat?',
  'Was war heute leichter als erwartet?',
  'Hast du heute jemandem geholfen oder hat dir jemand geholfen?',
  'Was kannst du von heute mitnehmen?',
  'Was hättest du heute gebraucht, das dir gefehlt hat?',
  'Welchen Fortschritt hast du heute gemacht, auch wenn er klein war?',
  'Was möchtest du morgen als erstes angehen?',
];

export function pickQuestion(pool: string[], storageKey: string): string {
  let recent: number[] = [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) recent = JSON.parse(raw);
  } catch {}

  const eligible = pool
    .map((q, i) => ({ q, i }))
    .filter(({ i }) => !recent.includes(i));

  const pick = eligible.length > 0
    ? eligible[Math.floor(Math.random() * eligible.length)]
    : { q: pool[0], i: 0 };

  const updated = [pick.i, ...recent].slice(0, 5);
  localStorage.setItem(storageKey, JSON.stringify(updated));

  return pick.q;
}

export function pickMorningQuestion(): string {
  return pickQuestion(MORNING_QUESTIONS, STORAGE_KEY_MORNING);
}

export function pickEveningQuestion(): string {
  return pickQuestion(EVENING_QUESTIONS, STORAGE_KEY_EVENING);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/models/day-entry.model.ts src/app/data/daily-questions.ts
git commit -m "feat(daily-rhythm): add DayEntry model and question pools"
```

---

### Task 2: DayRhythmService with tests

**Files:**
- Create: `src/app/services/day-rhythm.service.ts`
- Create: `src/app/services/day-rhythm.service.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/app/services/day-rhythm.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DayRhythmService } from './day-rhythm.service';

describe('DayRhythmService', () => {
  let service: DayRhythmService;
  let httpMock: HttpTestingController;
  const todayISO = new Date().toISOString().split('T')[0];

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DayRhythmService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with empty days from API', () => {
    httpMock.expectOne('/api/days').flush([]);
    expect(service.days().length).toBe(0);
  });

  it('should return null for todayEntry when no data', () => {
    httpMock.expectOne('/api/days').flush([]);
    expect(service.todayEntry()).toBeNull();
  });

  it('should create today entry via ensureToday', () => {
    httpMock.expectOne('/api/days').flush([]);
    service.ensureToday();
    httpMock.expectOne('/api/days').flush([]);
    const entry = service.todayEntry();
    expect(entry).toBeTruthy();
    expect(entry!.date).toBe(todayISO);
    expect(entry!.morningAnsweredAt).toBeNull();
  });

  it('should save morning focus', () => {
    httpMock.expectOne('/api/days').flush([]);
    service.ensureToday();
    httpMock.expectOne('/api/days').flush([]);
    service.saveMorning('Mein Fokus', 'Test-Frage?');
    httpMock.expectOne('/api/days').flush([]);
    const entry = service.todayEntry();
    expect(entry!.morningFocus).toBe('Mein Fokus');
    expect(entry!.morningQuestion).toBe('Test-Frage?');
    expect(entry!.morningAnsweredAt).toBeTruthy();
  });

  it('should save evening reflection', () => {
    httpMock.expectOne('/api/days').flush([]);
    service.ensureToday();
    httpMock.expectOne('/api/days').flush([]);
    service.saveEvening('Guter Tag', 'Abend-Frage?');
    httpMock.expectOne('/api/days').flush([]);
    const entry = service.todayEntry();
    expect(entry!.eveningReflection).toBe('Guter Tag');
    expect(entry!.eveningQuestion).toBe('Abend-Frage?');
    expect(entry!.eveningAnsweredAt).toBeTruthy();
  });

  it('should record a completion', () => {
    httpMock.expectOne('/api/days').flush([]);
    service.ensureToday();
    httpMock.expectOne('/api/days').flush([]);
    service.recordCompletion({ type: 'todo', id: 'td-1', title: 'Test', completedAt: new Date().toISOString() });
    httpMock.expectOne('/api/days').flush([]);
    expect(service.todayEntry()!.completedItems.length).toBe(1);
    expect(service.todayEntry()!.completedItems[0].title).toBe('Test');
  });

  it('should skip morning via skipMorning', () => {
    httpMock.expectOne('/api/days').flush([]);
    service.ensureToday();
    httpMock.expectOne('/api/days').flush([]);
    service.skipMorning();
    const entry = service.todayEntry();
    expect(entry!.morningAnsweredAt).toBe('skipped');
  });

  it('should report needsMorning correctly', () => {
    httpMock.expectOne('/api/days').flush([]);
    expect(service.needsMorning()).toBe(true);
    service.ensureToday();
    httpMock.expectOne('/api/days').flush([]);
    expect(service.needsMorning()).toBe(true);
    service.saveMorning('Focus', 'Q?');
    httpMock.expectOne('/api/days').flush([]);
    expect(service.needsMorning()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch`
Expected: FAIL — `DayRhythmService` does not exist yet.

- [ ] **Step 3: Implement DayRhythmService**

```typescript
// src/app/services/day-rhythm.service.ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DayEntry, CompletedItem } from '../models/day-entry.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DayRhythmService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/api/days`;

  readonly days = signal<DayEntry[]>([]);

  readonly todayEntry = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.days().find(d => d.date === today) ?? null;
  });

  readonly needsMorning = computed(() => {
    const entry = this.todayEntry();
    return !entry || entry.morningAnsweredAt === null;
  });

  readonly needsEvening = computed(() => {
    const entry = this.todayEntry();
    if (!entry) return false;
    if (entry.morningAnsweredAt === null) return false;
    return entry.eveningAnsweredAt === null;
  });

  // Accepts a reactive currentHour signal from the app (updated by setInterval)
  // to determine when the card should transition from morning-filled to evening-open.
  readonly currentHour = signal(new Date().getHours());

  // Determines which of the 4 card states to show:
  // 'morning-open' | 'morning-filled' | 'evening-open' | 'evening-filled'
  readonly rhythmPhase = computed<'morning-open' | 'morning-filled' | 'evening-open' | 'evening-filled'>(() => {
    const entry = this.todayEntry();
    if (!entry || entry.morningAnsweredAt === null) return 'morning-open';
    if (entry.eveningAnsweredAt !== null) return 'evening-filled';
    if (this.currentHour() >= 15 && entry.morningAnsweredAt !== null) return 'evening-open';
    return 'morning-filled';
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.http.get<DayEntry[]>(this.baseUrl).subscribe({
      next: days => this.days.set(days),
      error: err => console.error('Failed to load days:', err),
    });
  }

  ensureToday(): void {
    if (this.todayEntry()) return;
    const today = new Date().toISOString().split('T')[0];
    const entry: DayEntry = {
      date: today,
      morningQuestion: null,
      morningFocus: null,
      morningAnsweredAt: null,
      eveningQuestion: null,
      eveningReflection: null,
      eveningAnsweredAt: null,
      completedItems: [],
    };
    this.days.update(days => [entry, ...days]);
    this.save();
  }

  saveMorning(focus: string, question: string): void {
    this.updateToday(entry => ({
      ...entry,
      morningFocus: focus,
      morningQuestion: question,
      morningAnsweredAt: new Date().toISOString(),
    }));
  }

  skipMorning(): void {
    this.updateToday(entry => ({
      ...entry,
      morningAnsweredAt: 'skipped',
    }));
  }

  saveEvening(reflection: string, question: string): void {
    this.updateToday(entry => ({
      ...entry,
      eveningReflection: reflection,
      eveningQuestion: question,
      eveningAnsweredAt: new Date().toISOString(),
    }));
  }

  skipEvening(): void {
    this.updateToday(entry => ({
      ...entry,
      eveningAnsweredAt: 'skipped',
    }));
  }

  recordCompletion(item: CompletedItem): void {
    this.ensureToday();
    this.updateToday(entry => ({
      ...entry,
      completedItems: [...entry.completedItems, item],
    }));
  }

  private updateToday(fn: (entry: DayEntry) => DayEntry): void {
    const today = new Date().toISOString().split('T')[0];
    this.days.update(days =>
      days.map(d => d.date === today ? fn(d) : d)
    );
    this.save();
  }

  private save(): void {
    this.http.post<DayEntry[]>(this.baseUrl, this.days()).subscribe({
      error: err => console.error('Failed to save days:', err),
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: All DayRhythmService tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/day-rhythm.service.ts src/app/services/day-rhythm.service.spec.ts
git commit -m "feat(daily-rhythm): add DayRhythmService with persistence and completion tracking"
```

---

### Task 3: Global styles (Instrument Serif + animations)

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add Instrument Serif font and animations to global styles**

Append to `src/styles.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');

@keyframes fadeUp {
  0% { opacity: 0; transform: translateY(16px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInUp {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes gentlePulse {
  0%, 100% { box-shadow: 0 0 0 1px rgba(99,102,241,0.04), 0 2px 8px rgba(99,102,241,0.06); }
  50% { box-shadow: 0 0 0 2px rgba(99,102,241,0.08), 0 2px 12px rgba(99,102,241,0.1); }
}

@keyframes gentlePulseAmber {
  0%, 100% { box-shadow: 0 0 0 1px rgba(251,191,36,0.04), 0 2px 8px rgba(251,191,36,0.06); }
  50% { box-shadow: 0 0 0 2px rgba(251,191,36,0.08), 0 2px 12px rgba(251,191,36,0.1); }
}

@keyframes stripeExpand {
  0% { width: 4px; }
  100% { width: 100%; }
}

@keyframes stripeCollapse {
  0% { width: 100%; }
  100% { width: 4px; }
}

@keyframes drawCheck {
  0% { stroke-dashoffset: 36; }
  100% { stroke-dashoffset: 0; }
}

@keyframes successCirclePop {
  0% { opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; transform: scale(1.1); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes successCheckDraw {
  0% { stroke-dashoffset: 44; }
  100% { stroke-dashoffset: 0; }
}

@keyframes successTextFade {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}

@layer utilities {
  .stagger { opacity: 0; animation: fadeUp 0.5s ease-out both; }
  .font-serif { font-family: 'Instrument Serif', Georgia, serif; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat(daily-rhythm): add Instrument Serif font and rhythm animations to global styles"
```

---

### Task 4: RhythmCardComponent (navigator card)

**Files:**
- Create: `src/app/components/rhythm-card/rhythm-card.ts`
- Create: `src/app/components/rhythm-card/rhythm-card.spec.ts`

This is the special card at the top of the navigator that transitions through 4 states during the day. It includes the stripe-expand + checkmark animation triggered from the outside.

- [ ] **Step 1: Write the test file**

```typescript
// src/app/components/rhythm-card/rhythm-card.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RhythmCardComponent } from './rhythm-card';

describe('RhythmCardComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RhythmCardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(RhythmCardComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show morning-open state with CTA when no morning focus set', () => {
    const fixture = TestBed.createComponent(RhythmCardComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Tagesfokus');
    expect(text).toContain('Fokus setzen');
  });

  it('should emit select on click', () => {
    const fixture = TestBed.createComponent(RhythmCardComponent);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.select.subscribe(spy);
    fixture.nativeElement.querySelector('button').click();
    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch`
Expected: FAIL — component does not exist yet.

- [ ] **Step 3: Implement RhythmCardComponent**

The component reads from `DayRhythmService` and exposes a `rhythmPhase` computed that determines which of the 4 states to render. It has a public `playSubmitAnimation()` method that can be called by the parent to trigger the stripe-expand + checkmark animation.

Key design points from the validated mockup (`.superpowers/brainstorm/84490-1774128488/rhythm-cards.html`):
- 4px left stripe (gradient for open states, solid for filled)
- Gradient background for open states (indigo-50 for morning, amber-50 for evening), white for filled
- Subtle pulsing border glow for open states (`gentlePulse` / `gentlePulseAmber`), stops on hover
- Sun icon for morning, moon icon for evening, checkmark for day-complete
- Instrument Serif italic for question and answer text
- Weekday displayed in top-right corner
- Completion chips (emerald for tasks, indigo for PRs) in evening-filled state
- `selected` input for visual selection state (like ticket cards)
- `select` output emitted on click

The stripe-expand animation:
1. Card content + header fade to opacity 0 (250ms)
2. A `stripe-expand` overlay div transitions `width` from 4px to 100% with `cubic-bezier(0.22, 1, 0.36, 1)` (500ms)
3. A white SVG checkmark (`stroke-dasharray: 36; stroke-dashoffset: 36`) draws itself via `drawCheck` animation (350ms)
4. After a hold, checkmark fades to opacity 0 and **must be set to `display: none`** to prevent overlaying new content
5. Stripe collapses back to 4px (400ms)
6. Card content swaps to filled state and fades in via `fadeInUp` (450ms)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: All RhythmCardComponent tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/rhythm-card/
git commit -m "feat(daily-rhythm): add RhythmCardComponent with 4 states and stripe-expand animation"
```

---

### Task 5: RhythmDetailComponent (workbench detail view)

**Files:**
- Create: `src/app/components/rhythm-detail/rhythm-detail.ts`
- Create: `src/app/components/rhythm-detail/rhythm-detail.spec.ts`

This component is shown in the workbench when the rhythm card is selected. It has two modes: **input** (form with question + textarea + submit/skip) and **read-only** (question + answer display). On submit, it plays the success-flash animation before transitioning to read-only, and emits an event so the parent can trigger the card animation in parallel.

- [ ] **Step 1: Write the test file**

```typescript
// src/app/components/rhythm-detail/rhythm-detail.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RhythmDetailComponent } from './rhythm-detail';

describe('RhythmDetailComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RhythmDetailComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(RhythmDetailComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show input form when morning is not filled', () => {
    const fixture = TestBed.createComponent(RhythmDetailComponent);
    fixture.detectChanges();
    const textarea = fixture.nativeElement.querySelector('textarea');
    expect(textarea).toBeTruthy();
  });

  it('should have textarea with aria-labelledby', () => {
    const fixture = TestBed.createComponent(RhythmDetailComponent);
    fixture.detectChanges();
    const textarea = fixture.nativeElement.querySelector('textarea');
    const labelId = textarea?.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    const label = fixture.nativeElement.querySelector(`#${labelId}`);
    expect(label).toBeTruthy();
  });

  it('should emit submitted event on submit', () => {
    const fixture = TestBed.createComponent(RhythmDetailComponent);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.submitted.subscribe(spy);
    const textarea = fixture.nativeElement.querySelector('textarea');
    textarea.value = 'Mein Fokus';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('[data-testid="btn-submit"]');
    btn?.click();
    expect(spy).toHaveBeenCalled();
  });

  it('should emit skipped event on skip', () => {
    const fixture = TestBed.createComponent(RhythmDetailComponent);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.skipped.subscribe(spy);
    const btn = fixture.nativeElement.querySelector('[data-testid="btn-skip"]');
    btn?.click();
    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch`

- [ ] **Step 3: Implement RhythmDetailComponent**

The component reads `DayRhythmService.todayEntry()` and the `rhythmPhase` to decide what to show. Key design points from the validated mockup (`.superpowers/brainstorm/84490-1774128488/focus-moment.html`):

**Input view (morning or evening open):**
- Centered content, max-width ~460px, generous whitespace, `bg-stone-50` background
- Header: icon (sun 36px indigo / moon 36px amber) + "Tagesfokus" / "Tagesreflektion" + date
- Question in Instrument Serif italic 20px with indigo/amber gradient accent line (3px, left)
- Textarea with rounded-xl, focus ring matching phase color
- "Fokus setzen" / "Abschließen" primary button + "Überspringen" secondary
- For evening: completion summary above the question (stone-100/60 rounded box, green checks)
- Escape key triggers skip

**Read-only view (morning or evening filled):**
- Same header layout
- Question displayed (Instrument Serif italic 16px, with accent line)
- Answer in a white card with stone-50 bg, rounded-xl, Instrument Serif italic 18px
- For evening: "Heute geschafft" list below with items + timestamps

**Success animation (triggered on submit):**
1. Form fades out + slides up (400ms)
2. Indigo circle pops in at center (550ms, `successCirclePop`)
3. White checkmark draws itself (850ms, `successCheckDraw` 500ms)
4. "Fokus gesetzt!" / "Reflektion gespeichert!" text fades in (1200ms, Instrument Serif)
5. Holds for ~1.4s
6. Flash fades out (2600ms, 500ms)
7. Read-only view fades in (3050ms, `fadeInUp` 600ms)

The component emits `submitted` at the start of the animation (not at the end) so the parent can trigger the card animation in parallel.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: All RhythmDetailComponent tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/rhythm-detail/
git commit -m "feat(daily-rhythm): add RhythmDetailComponent with input/readonly views and success animation"
```

---

### Task 6: Timeline View (replace placeholder)

**Files:**
- Modify: `src/app/views/view-timeline/view-timeline.ts`
- Create: `src/app/views/view-timeline/view-timeline.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/app/views/view-timeline/view-timeline.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ViewTimelineComponent } from './view-timeline';

describe('ViewTimelineComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewTimelineComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ViewTimelineComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show empty state when no entries', () => {
    const fixture = TestBed.createComponent(ViewTimelineComponent);
    httpMock.expectOne('/api/days').flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Noch keine Einträge');
  });

  it('should render day entries', () => {
    const fixture = TestBed.createComponent(ViewTimelineComponent);
    httpMock.expectOne('/api/days').flush([{
      date: '2026-03-21',
      morningQuestion: 'Test-Frage?',
      morningFocus: 'Mein Fokus',
      morningAnsweredAt: '2026-03-21T08:00:00Z',
      eveningQuestion: null,
      eveningReflection: null,
      eveningAnsweredAt: null,
      completedItems: [],
    }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Mein Fokus');
    expect(fixture.nativeElement.textContent).toContain('Test-Frage?');
  });

  it('should show evening question and reflection when present', () => {
    const fixture = TestBed.createComponent(ViewTimelineComponent);
    httpMock.expectOne('/api/days').flush([{
      date: '2026-03-20',
      morningQuestion: 'Morgen-Frage?',
      morningFocus: 'Fokus',
      morningAnsweredAt: '2026-03-20T08:00:00Z',
      eveningQuestion: 'Abend-Frage?',
      eveningReflection: 'Guter Tag',
      eveningAnsweredAt: '2026-03-20T17:30:00Z',
      completedItems: [],
    }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Abend-Frage?');
    expect(fixture.nativeElement.textContent).toContain('Guter Tag');
  });

  it('should render day cards as article elements', () => {
    const fixture = TestBed.createComponent(ViewTimelineComponent);
    httpMock.expectOne('/api/days').flush([{
      date: '2026-03-21',
      morningQuestion: 'Q?', morningFocus: 'F', morningAnsweredAt: '2026-03-21T08:00:00Z',
      eveningQuestion: null, eveningReflection: null, eveningAnsweredAt: null,
      completedItems: [],
    }]);
    fixture.detectChanges();
    const articles = fixture.nativeElement.querySelectorAll('article');
    expect(articles.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch`

- [ ] **Step 3: Implement ViewTimelineComponent**

Replace the placeholder with the full journal-style timeline. Key design points from the validated mockup:
- Instrument Serif italic for focus and reflection texts
- Indigo gradient line for morning sections, amber gradient for evening
- Questions shown above answers in colored italic
- Completions in a stone-50 inset box with green checks
- Minimal cards for days with only focus or only completions
- "Heute" badge on today's entry
- Date lines as horizontal rules with the date text

```typescript
// src/app/views/view-timeline/view-timeline.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DayRhythmService } from '../../services/day-rhythm.service';
import { DayEntry } from '../../models/day-entry.model';

@Component({
  selector: 'app-view-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col h-full' },
  templateUrl: './view-timeline.html',
})
export class ViewTimelineComponent {
  protected readonly dayRhythm = inject(DayRhythmService);
  private readonly todayISO = new Date().toISOString().split('T')[0];

  readonly entries = computed(() =>
    this.dayRhythm.days().filter(d => this.hasMeaningfulContent(d))
  );

  isToday(date: string): boolean {
    return date === this.todayISO;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  hasMorning(entry: DayEntry): boolean {
    return entry.morningFocus !== null && entry.morningAnsweredAt !== 'skipped';
  }

  hasEvening(entry: DayEntry): boolean {
    return entry.eveningReflection !== null && entry.eveningAnsweredAt !== 'skipped';
  }

  isFull(entry: DayEntry): boolean {
    return this.hasMorning(entry) || this.hasEvening(entry);
  }

  private hasMeaningfulContent(entry: DayEntry): boolean {
    return this.hasMorning(entry) || this.hasEvening(entry) || entry.completedItems.length > 0;
  }
}
```

- [ ] **Step 4: Create the timeline template**

Create `src/app/views/view-timeline/view-timeline.html` with the journal layout from the validated mockup. Use `@for` to iterate over `entries()`, `@if` to conditionally show morning/evening/completions sections. Each day is an `<article>` with the date as heading. Morning sections have indigo left border, evening sections have amber. Completions are shown in a subtle inset box. Refer to `.superpowers/brainstorm/84490-1774128488/timeline-view-v2.html` for the exact markup and styling.

```html
<div class="flex flex-col h-full">
  <div class="px-12 pt-5 pb-4 border-b border-stone-200 shrink-0">
    <h1 class="font-serif text-[26px] text-stone-800">Dein Journal</h1>
    <p class="text-sm text-stone-400 font-medium mt-0.5">Tage, Fokus, Reflexionen — dein persönlicher Rückblick</p>
  </div>

  <div class="flex-1 overflow-y-auto px-12 py-8">
    @if (entries().length === 0) {
      <div class="flex items-center justify-center h-full">
        <div class="text-center max-w-sm">
          <div class="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-400"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
          </div>
          <h2 class="text-lg font-semibold text-stone-800 mb-1">Noch keine Einträge</h2>
          <p class="text-sm text-stone-400 leading-relaxed">Starte deinen ersten Tag mit einem Fokus!</p>
        </div>
      </div>
    } @else {
      <div class="max-w-[580px] mx-auto flex flex-col gap-10">
        @for (entry of entries(); track entry.date) {
          <article>
            <div class="flex items-center gap-3 mb-4">
              <span class="text-sm font-semibold whitespace-nowrap" [class]="isToday(entry.date) ? 'text-indigo-600' : 'text-stone-500'">
                {{ formatDate(entry.date) }}
              </span>
              @if (isToday(entry.date)) {
                <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded uppercase tracking-wide shrink-0">Heute</span>
              }
              <div class="flex-1 h-px bg-stone-200"></div>
            </div>

            @if (isFull(entry)) {
              <div class="bg-white rounded-2xl border overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
                [class]="isToday(entry.date) ? 'border-indigo-200 shadow-[0_1px_4px_rgba(99,102,241,0.06)]' : 'border-stone-200'">
                <div class="p-5 flex flex-col gap-5">

                  @if (hasMorning(entry)) {
                    <div class="pl-5 relative">
                      <span class="absolute left-0 top-0.5 bottom-0.5 w-[3px] rounded-sm bg-gradient-to-b from-indigo-400 to-indigo-200" aria-hidden="true"></span>
                      <div class="text-xs font-medium italic text-indigo-400 mb-1">{{ entry.morningQuestion }}</div>
                      <div class="font-serif text-base italic text-stone-600 leading-relaxed">{{ entry.morningFocus }}</div>
                    </div>
                  }

                  @if (entry.completedItems.length > 0) {
                    <div class="p-3.5 bg-stone-50 rounded-xl">
                      <div class="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        Erledigt
                        <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded">{{ entry.completedItems.length }}</span>
                      </div>
                      @for (item of entry.completedItems; track item.id; let i = $index) {
                        @if (i < 3) {
                          <div class="flex items-center gap-2 py-1">
                            <div class="w-3.5 h-3.5 rounded bg-emerald-500 flex items-center justify-center shrink-0">
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                            </div>
                            <span class="text-sm text-stone-600 font-medium flex-1">{{ item.title }}</span>
                            <span class="text-[9px] font-bold text-stone-400 bg-white px-1.5 py-0.5 rounded border border-stone-200 uppercase tracking-wide shrink-0">{{ item.type }}</span>
                          </div>
                        }
                      }
                      @if (entry.completedItems.length > 3) {
                        <div class="text-xs text-stone-400 font-medium mt-1 pl-[22px]">+ {{ entry.completedItems.length - 3 }} weitere</div>
                      }
                    </div>
                  }

                  @if (hasEvening(entry)) {
                    <div class="h-px bg-stone-100"></div>
                    <div class="pl-5 relative">
                      <span class="absolute left-0 top-0.5 bottom-0.5 w-[3px] rounded-sm bg-gradient-to-b from-amber-400 to-amber-300" aria-hidden="true"></span>
                      <div class="text-xs font-medium italic text-amber-500 mb-1">{{ entry.eveningQuestion }}</div>
                      <div class="font-serif text-base italic text-stone-600 leading-relaxed">{{ entry.eveningReflection }}</div>
                    </div>
                  }

                </div>
              </div>
            } @else {
              <div class="bg-white rounded-2xl border border-stone-200 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                @for (item of entry.completedItems; track item.id) {
                  <div class="flex items-center gap-2 py-1">
                    <div class="w-3.5 h-3.5 rounded bg-emerald-500 flex items-center justify-center shrink-0">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                    </div>
                    <span class="text-sm text-stone-600 font-medium flex-1">{{ item.title }}</span>
                    <span class="text-[9px] font-bold text-stone-400 bg-white px-1.5 py-0.5 rounded border border-stone-200 uppercase tracking-wide shrink-0">{{ item.type }}</span>
                  </div>
                }
              </div>
            }
          </article>
        }
      </div>
    }
  </div>
</div>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: All ViewTimelineComponent tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/views/view-timeline/
git commit -m "feat(daily-rhythm): implement journal-style Timeline view"
```

---

### Task 7: Hook completion tracking into TodoService

**Files:**
- Modify: `src/app/services/todo.service.ts:84-93`

- [ ] **Step 1: Add completion recording to TodoService.update()**

In `src/app/services/todo.service.ts`, inject `DayRhythmService` and call `recordCompletion` when a todo is marked as done:

```typescript
// Add import at top:
import { DayRhythmService } from './day-rhythm.service';

// Add to class:
private readonly dayRhythm = inject(DayRhythmService);

// In update() method, after line 88 (this.lastCompletedId.set(todo.id)):
this.dayRhythm.recordCompletion({
  type: 'todo',
  id: todo.id,
  title: todo.title,
  completedAt: todo.completedAt!,
});
```

- [ ] **Step 2: Run existing TodoService tests**

Run: `npx ng test --no-watch`
Expected: Tests pass (DayRhythmService is providedIn root, HttpClient is available in test setup).

- [ ] **Step 3: Commit**

```bash
git add src/app/services/todo.service.ts
git commit -m "feat(daily-rhythm): hook todo completion tracking into DayRhythmService"
```

---

### Task 8: Hook ticket completion tracking into WorkDataService

**Files:**
- Modify: `src/app/services/work-data.service.ts`

Tickets and PRs are fetched from external APIs — there is no local "mark as done" action. To track completions, `WorkDataService` needs to detect state changes between API fetches using an effect that compares previous and current ticket data.

- [ ] **Step 1: Add ticket completion detection**

In `src/app/services/work-data.service.ts`, inject `DayRhythmService`. Add an effect that watches `tickets()` and detects tickets that changed status to `'Done'` compared to a stored previous snapshot:

```typescript
// Add import:
import { DayRhythmService } from './day-rhythm.service';

// Add to class:
private readonly dayRhythm = inject(DayRhythmService);
private previousTicketStatuses = new Map<string, string>();

// In constructor, add effect:
effect(() => {
  const current = this.tickets();
  for (const ticket of current) {
    const prev = this.previousTicketStatuses.get(ticket.key);
    if (prev && prev !== 'Done' && ticket.status === 'Done') {
      untracked(() => {
        this.dayRhythm.recordCompletion({
          type: 'ticket',
          id: ticket.key,
          title: `${ticket.key} ${ticket.summary}`,
          completedAt: new Date().toISOString(),
        });
      });
    }
  }
  this.previousTicketStatuses = new Map(current.map(t => [t.key, t.status]));
});
```

Note: PR completions (approved/merged) are harder to detect since PR status is derived from API data and the user doesn't explicitly "complete" a PR in Orbit. For the initial implementation, track only todo and ticket completions. PR tracking can be added later when the approval workflow is clearer.

- [ ] **Step 2: Run tests**

Run: `npx ng test --no-watch`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/services/work-data.service.ts
git commit -m "feat(daily-rhythm): detect and track ticket completions on status change"
```

---

### Task 9: Wire rhythm card into Navigator and rhythm detail into Workbench

**Files:**
- Modify: `src/app/components/navigator/navigator.ts`
- Modify: `src/app/components/navigator/navigator.html`
- Modify: `src/app/components/workbench/workbench.ts`
- Modify: `src/app/components/workbench/workbench.html`
- Modify: `src/app/app.ts`

- [ ] **Step 1: Add RhythmCardComponent to Navigator**

In `navigator.ts`, import `RhythmCardComponent` and `DayRhythmService`. Add the rhythm card section to `navigator.html` above the tickets section — separated by a gradient divider.

The rhythm card is treated as a selectable item. When clicked, it emits `selectItem({ type: 'rhythm', id: 'rhythm' })` (or a similar sentinel value) so the workbench can render the detail view. The navigator needs a `ViewChild` reference to the rhythm card so it can call `playSubmitAnimation()` when triggered.

```html
<!-- Add at the top of .nav-scroll, before the tickets section -->
<app-rhythm-card
  [selected]="isSelected({ type: 'rhythm', id: 'rhythm' })"
  (select)="selectItem({ type: 'rhythm', id: 'rhythm' })"
/>
<div class="h-px mx-4 my-2 bg-gradient-to-r from-transparent via-stone-200 to-transparent"></div>
```

- [ ] **Step 2: Add RhythmDetailComponent to Workbench**

In `workbench.ts`, import `RhythmDetailComponent`. In `workbench.html`, add a `@case` for the rhythm item type:

```html
@case ('rhythm') {
  <app-rhythm-detail
    (submitted)="onRhythmSubmitted()"
    (skipped)="onRhythmSkipped()"
  />
}
```

The `submitted` event triggers `DayRhythmService.saveMorning()` or `saveEvening()` (based on current phase), then tells the navigator's rhythm card to play the stripe-expand animation. The `skipped` event calls `skipMorning()` or `skipEvening()`.

- [ ] **Step 3: Ensure DayRhythmService.ensureToday() is called on app init**

In `app.ts`, inject `DayRhythmService` and call `ensureToday()` in the constructor. Also add the `currentHour` signal with 5-minute interval for the evening transition:

```typescript
private readonly dayRhythm = inject(DayRhythmService);
currentHour = signal(new Date().getHours());

constructor() {
  this.dayRhythm.ensureToday();
  setInterval(() => this.currentHour.set(new Date().getHours()), 5 * 60 * 1000);
}
```

The `DayRhythmService` should expose `currentHour` (or accept it as input) so `rhythmPhase` can react to time changes for the morning→evening transition at 15:00.

- [ ] **Step 4: Run full test suite**

Run: `npx ng test --no-watch`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/navigator/ src/app/components/workbench/ src/app/app.ts
git commit -m "feat(daily-rhythm): wire rhythm card into navigator and detail into workbench"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx ng test --no-watch`
Expected: All tests pass, zero failures.

- [ ] **Step 2: Run the app and verify**

Run: `npm start`

Verify checklist:
- Rhythm card appears at top of navigator, above tickets section
- Morning-open state: indigo gradient bg, sun icon, "TAGESFOKUS" label, "Fokus setzen →" CTA, pulsing border
- Clicking the rhythm card shows the detail view in the workbench
- Detail view shows question in Instrument Serif italic with indigo accent line
- Textarea works, submit button is functional
- On submit: detail view plays success animation (circle pop, checkmark draw, "Fokus gesetzt!", ~4s total)
- In parallel (slightly delayed): navigator card plays stripe-expand + checkmark animation
- After animation: card shows question + answer text (morning-filled state)
- After animation: detail view shows read-only view with question + answer
- **Critical**: white checkmark SVG is hidden (`display: none`) after card animation — does not overlay text
- "Überspringen" skips without saving, card transitions to morning-filled (with `skipped` status)
- After 15:00 with morning done: card transitions to evening-open (amber gradient, moon icon, "TAGESREFLEKTION")
- Evening detail view shows completion summary + reflection question
- Evening submit animation works (same choreography, amber colors)
- Evening-filled state: emerald checkmark icon, "TAG ABGESCHLOSSEN", question + answer + completion chips
- Timeline view still works with journal entries
- Completing a todo records it in today's completions and shows in evening summary
- Escape key triggers skip in detail view
- Keyboard navigation and focus management works (focus-visible outlines, aria attributes)
- `prefers-reduced-motion` respected (pulsing animation disabled)

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(daily-rhythm): address verification issues"
```
