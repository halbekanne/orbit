# Tagesrhythmus-System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a daily rhythm system with morning focus prompt, evening reflection nudge, completion tracking, and a journal-style Timeline view.

**Architecture:** A `DayRhythmService` manages `DayEntry` objects persisted to `~/.orbit/days.json`. Morning and evening flows are standalone components rendered conditionally by `AppComponent`. The Timeline view replaces the placeholder in the Hybrid Rail. Question pools are static constants with localStorage-based rotation tracking.

**Tech Stack:** Angular 21 (standalone, zoneless, signals), Tailwind CSS, Vitest, Instrument Serif font

**Spec:** `docs/superpowers/specs/2026-03-21-daily-rhythm-design.md`

**Design Mockups:** `.superpowers/brainstorm/84490-1774128488/morning-flow.html`, `evening-nudge-and-flow.html`, `timeline-view-v2.html`

**Prerequisite:** Hybrid Rail Navigation must be implemented first (provides the view switching infrastructure and ViewTimelineComponent placeholder).

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/app/models/day-entry.model.ts` | DayEntry, CompletedItem interfaces |
| Create | `src/app/data/daily-questions.ts` | Morning + evening question pools, selection algorithm |
| Create | `src/app/services/day-rhythm.service.ts` | Core service: persistence, completions, morning/evening save |
| Create | `src/app/services/day-rhythm.service.spec.ts` | Service tests |
| Create | `src/app/components/morning-flow/morning-flow.ts` | Morning greeting + question + textarea overlay |
| Create | `src/app/components/morning-flow/morning-flow.spec.ts` | Morning flow tests |
| Create | `src/app/components/evening-nudge/evening-nudge.ts` | Toast banner component |
| Create | `src/app/components/evening-nudge/evening-nudge.spec.ts` | Nudge tests |
| Create | `src/app/components/evening-flow/evening-flow.ts` | Evening reflection + completions overlay |
| Create | `src/app/components/evening-flow/evening-flow.spec.ts` | Evening flow tests |
| Modify | `src/app/views/view-timeline/view-timeline.ts` | Replace placeholder with journal timeline |
| Create | `src/app/views/view-timeline/view-timeline.spec.ts` | Timeline view tests |
| Modify | `src/app/app.ts` | Wire up morning flow, evening nudge, evening flow |
| Modify | `src/app/app.html` | Add morning/evening overlays and nudge toast |
| Modify | `src/app/services/todo.service.ts:84-93` | Hook into update() to record todo completions |
| Modify | `src/app/services/work-data.service.ts` | Track ticket status changes to record ticket completions |
| Create | `src/app/views/view-timeline/view-timeline.html` | Timeline template with journal layout |
| Modify | `src/styles.css` | Import Instrument Serif, add stagger animations |

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

### Task 3: Morning Flow component

**Files:**
- Create: `src/app/components/morning-flow/morning-flow.ts`
- Create: `src/app/components/morning-flow/morning-flow.spec.ts`
- Modify: `src/styles.css` (add Instrument Serif import and stagger animations)

- [ ] **Step 1: Add Instrument Serif font and animations to global styles**

Append to `src/styles.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');

@keyframes fadeUp {
  0% { opacity: 0; transform: translateY(16px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes handWave {
  0%, 100% { transform: rotate(0deg); }
  15% { transform: rotate(14deg); }
  30% { transform: rotate(-8deg); }
  45% { transform: rotate(14deg); }
  60% { transform: rotate(-4deg); }
  75% { transform: rotate(10deg); }
}

@layer utilities {
  .stagger { opacity: 0; animation: fadeUp 0.5s ease-out both; }
  .font-serif { font-family: 'Instrument Serif', Georgia, serif; }
  .wave { display: inline-block; animation: handWave 2s ease-in-out 0.6s 1; transform-origin: 70% 70%; }
}
```

- [ ] **Step 2: Write the test file**

```typescript
// src/app/components/morning-flow/morning-flow.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MorningFlowComponent } from './morning-flow';

describe('MorningFlowComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [MorningFlowComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MorningFlowComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display a greeting', () => {
    const fixture = TestBed.createComponent(MorningFlowComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toMatch(/Guten (Morgen|Tag)/);
  });

  it('should display a question', () => {
    const fixture = TestBed.createComponent(MorningFlowComponent);
    fixture.detectChanges();
    const question = fixture.nativeElement.querySelector('[data-testid="morning-question"]');
    expect(question?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('should emit save with focus text on submit', () => {
    const fixture = TestBed.createComponent(MorningFlowComponent);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.complete.subscribe(spy);
    fixture.componentInstance.focusText.set('Mein Fokus');
    const btn = fixture.nativeElement.querySelector('[data-testid="btn-start"]');
    btn.click();
    expect(spy).toHaveBeenCalled();
  });

  it('should emit skip on skip button', () => {
    const fixture = TestBed.createComponent(MorningFlowComponent);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.skip.subscribe(spy);
    const btn = fixture.nativeElement.querySelector('[data-testid="btn-skip"]');
    btn.click();
    expect(spy).toHaveBeenCalled();
  });

  it('should have textarea with aria-labelledby pointing to question', () => {
    const fixture = TestBed.createComponent(MorningFlowComponent);
    fixture.detectChanges();
    const textarea = fixture.nativeElement.querySelector('textarea');
    const labelId = textarea.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    const label = fixture.nativeElement.querySelector(`#${labelId}`);
    expect(label).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx ng test --no-watch`
Expected: FAIL — component does not exist yet.

- [ ] **Step 4: Implement MorningFlowComponent**

```typescript
// src/app/components/morning-flow/morning-flow.ts
import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { pickMorningQuestion } from '../../data/daily-questions';

@Component({
  selector: 'app-morning-flow',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  host: {
    class: 'flex-1 flex items-center justify-center bg-stone-50 relative overflow-hidden',
    '(keydown.escape)': 'skip.emit()',
  },
  template: `
    <div class="max-w-[480px] w-full px-8">
      <div class="font-serif text-[32px] text-stone-800 mb-1 stagger" style="animation-delay:0.2s">
        {{ greeting() }} <span class="wave">👋</span>
      </div>
      <div class="text-sm text-stone-400 font-medium mb-8 stagger" style="animation-delay:2.6s">
        {{ dateString() }}
      </div>

      <div
        id="morning-q"
        data-testid="morning-question"
        class="font-serif text-[22px] italic text-stone-600 leading-relaxed mb-5 pl-4 relative stagger"
        style="animation-delay:2.8s"
      >
        <span class="absolute left-0 top-1 bottom-1 w-[3px] rounded-sm bg-gradient-to-b from-indigo-400 to-indigo-200" aria-hidden="true"></span>
        {{ question }}
      </div>

      <textarea
        class="w-full min-h-[80px] p-3.5 border border-stone-200 rounded-xl bg-white text-[15px] text-stone-800 leading-relaxed resize-none outline-none transition-all duration-150 shadow-sm focus:border-indigo-400 focus:ring-3 focus:ring-indigo-500/[0.08] placeholder:text-stone-300 stagger"
        style="animation-delay:3.0s"
        placeholder="Dein Fokus für heute..."
        aria-labelledby="morning-q"
        [(ngModel)]="focusText"
        rows="3"
      ></textarea>

      <div class="mt-4 flex items-center justify-between stagger" style="animation-delay:3.2s">
        <button
          type="button"
          data-testid="btn-start"
          class="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 shadow-sm hover:bg-indigo-700 hover:-translate-y-px hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          (click)="onSubmit()"
        >
          Tag starten
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
        <button
          type="button"
          data-testid="btn-skip"
          class="px-4 py-2.5 text-stone-400 text-sm font-medium rounded-lg cursor-pointer transition-all duration-120 hover:text-stone-600 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          (click)="skip.emit()"
        >
          Überspringen
        </button>
      </div>
    </div>
  `,
})
export class MorningFlowComponent {
  complete = output<{ focus: string; question: string }>();
  skip = output<void>();

  readonly question = pickMorningQuestion();
  focusText = signal('');

  greeting = signal(new Date().getHours() < 12 ? 'Guten Morgen' : 'Guten Tag');

  dateString = signal(
    new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  );

  onSubmit(): void {
    this.complete.emit({ focus: this.focusText(), question: this.question });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: All MorningFlowComponent tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/components/morning-flow/ src/styles.css
git commit -m "feat(daily-rhythm): add MorningFlowComponent with staggered animations"
```

---

### Task 4: Evening Nudge component (toast)

**Files:**
- Create: `src/app/components/evening-nudge/evening-nudge.ts`
- Create: `src/app/components/evening-nudge/evening-nudge.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/app/components/evening-nudge/evening-nudge.spec.ts
import { TestBed } from '@angular/core/testing';
import { EveningNudgeComponent } from './evening-nudge';

describe('EveningNudgeComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [EveningNudgeComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(EveningNudgeComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should emit startReflection on action click', () => {
    const fixture = TestBed.createComponent(EveningNudgeComponent);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.startReflection.subscribe(spy);
    const btn = fixture.nativeElement.querySelector('[data-testid="nudge-action"]');
    btn.click();
    expect(spy).toHaveBeenCalled();
  });

  it('should emit dismiss on close click', () => {
    const fixture = TestBed.createComponent(EveningNudgeComponent);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.dismiss.subscribe(spy);
    const btn = fixture.nativeElement.querySelector('[data-testid="nudge-close"]');
    btn.click();
    expect(spy).toHaveBeenCalled();
  });

  it('should have role=status for accessibility', () => {
    const fixture = TestBed.createComponent(EveningNudgeComponent);
    fixture.detectChanges();
    const toast = fixture.nativeElement.querySelector('[role="status"]');
    expect(toast).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch`

- [ ] **Step 3: Implement EveningNudgeComponent**

```typescript
// src/app/components/evening-nudge/evening-nudge.ts
import { ChangeDetectionStrategy, Component, output } from '@angular/core';

@Component({
  selector: 'app-evening-nudge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fixed bottom-5 left-1/2 -translate-x-1/2 z-50',
    style: 'animation: toastSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both;',
  },
  template: `
    <div
      role="status"
      aria-live="polite"
      class="flex items-center gap-3 bg-stone-800 text-white px-5 pl-5 py-3 rounded-2xl shadow-lg whitespace-nowrap"
      style="box-shadow: 0 8px 24px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(255,255,255,0.08);"
    >
      <span class="text-lg leading-none shrink-0">🌅</span>
      <span class="text-sm font-medium">Wie war dein Tag?</span>
      <button
        type="button"
        data-testid="nudge-action"
        class="text-sm font-semibold text-indigo-400 px-3 py-1.5 rounded-lg transition-all duration-120 hover:bg-indigo-500/15 hover:text-indigo-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        (click)="startReflection.emit()"
      >
        Tagesreflexion starten →
      </button>
      <button
        type="button"
        data-testid="nudge-close"
        class="text-stone-500 p-1 rounded-md transition-all duration-120 hover:text-stone-300 hover:bg-white/[0.08] cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        aria-label="Schließen"
        (click)="dismiss.emit()"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
  `,
})
export class EveningNudgeComponent {
  startReflection = output<void>();
  dismiss = output<void>();
}
```

- [ ] **Step 4: Add toastSlideUp animation to global styles**

Append to `src/styles.css`:

```css
@keyframes toastSlideUp {
  0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
  100% { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: All EveningNudgeComponent tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/components/evening-nudge/ src/styles.css
git commit -m "feat(daily-rhythm): add EveningNudgeComponent toast banner"
```

---

### Task 5: Evening Flow component

**Files:**
- Create: `src/app/components/evening-flow/evening-flow.ts`
- Create: `src/app/components/evening-flow/evening-flow.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/app/components/evening-flow/evening-flow.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EveningFlowComponent } from './evening-flow';

describe('EveningFlowComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [EveningFlowComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(EveningFlowComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display greeting', () => {
    const fixture = TestBed.createComponent(EveningFlowComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Feierabend');
  });

  it('should display a question', () => {
    const fixture = TestBed.createComponent(EveningFlowComponent);
    fixture.detectChanges();
    const question = fixture.nativeElement.querySelector('[data-testid="evening-question"]');
    expect(question?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('should show empty state when no completions', () => {
    const fixture = TestBed.createComponent(EveningFlowComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Produktivitätstag');
  });

  it('should emit complete on submit', () => {
    const fixture = TestBed.createComponent(EveningFlowComponent);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.complete.subscribe(spy);
    fixture.componentInstance.reflectionText.set('Guter Tag');
    const btn = fixture.nativeElement.querySelector('[data-testid="btn-finish"]');
    btn.click();
    expect(spy).toHaveBeenCalled();
  });

  it('should emit skip on skip button', () => {
    const fixture = TestBed.createComponent(EveningFlowComponent);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.skip.subscribe(spy);
    const btn = fixture.nativeElement.querySelector('[data-testid="btn-skip"]');
    btn.click();
    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch`

- [ ] **Step 3: Implement EveningFlowComponent**

```typescript
// src/app/components/evening-flow/evening-flow.ts
import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DayRhythmService } from '../../services/day-rhythm.service';
import { pickEveningQuestion } from '../../data/daily-questions';
import { CompletedItem } from '../../models/day-entry.model';

@Component({
  selector: 'app-evening-flow',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  host: {
    class: 'flex-1 flex items-center justify-center bg-stone-50 relative overflow-hidden',
    '(keydown.escape)': 'skip.emit()',
  },
  template: `
    <div class="max-w-[520px] w-full px-8">
      <div class="font-serif text-[32px] text-stone-800 mb-1 stagger" style="animation-delay:0.2s">
        Feierabend! 🌅
      </div>
      <div class="text-sm text-stone-400 font-medium mb-7 stagger" style="animation-delay:2.6s">
        Zeit für einen Rückblick auf deinen Tag.
      </div>

      <div class="mb-7 stagger" style="animation-delay:2.8s">
        <div class="p-3.5 bg-stone-100/60 rounded-xl">
          <div class="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            Heute erledigt
            @if (completions().length > 0) {
              <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded">{{ completions().length }}</span>
            }
          </div>
          @if (completions().length === 0) {
            <p class="text-sm text-stone-400 italic">Kein Problem — nicht jeder Tag ist ein Produktivitätstag.</p>
          } @else {
            @for (item of completions(); track item.id) {
              <div class="flex items-center gap-2 py-1">
                <div class="w-3.5 h-3.5 rounded bg-emerald-500 flex items-center justify-center shrink-0">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <span class="text-sm text-stone-600 font-medium flex-1">{{ item.title }}</span>
                <span class="text-[9px] font-bold text-stone-400 bg-white px-1.5 py-0.5 rounded border border-stone-200 uppercase tracking-wide shrink-0">{{ item.type }}</span>
              </div>
            }
          }
        </div>
      </div>

      <div
        id="evening-q"
        data-testid="evening-question"
        class="font-serif text-[22px] italic text-stone-600 leading-relaxed mb-4 pl-4 relative stagger"
        style="animation-delay:3.2s"
      >
        <span class="absolute left-0 top-1 bottom-1 w-[3px] rounded-sm bg-gradient-to-b from-amber-400 to-amber-300" aria-hidden="true"></span>
        {{ question }}
      </div>

      <textarea
        class="w-full min-h-[72px] p-3.5 border border-stone-200 rounded-xl bg-white text-[15px] text-stone-800 leading-relaxed resize-none outline-none transition-all duration-150 shadow-sm focus:border-amber-400 focus:ring-3 focus:ring-amber-400/10 placeholder:text-stone-300 stagger"
        style="animation-delay:3.5s"
        placeholder="Deine Gedanken zum Tag..."
        aria-labelledby="evening-q"
        [(ngModel)]="reflectionText"
        rows="3"
      ></textarea>

      <div class="mt-4 flex items-center justify-between stagger" style="animation-delay:3.8s">
        <button
          type="button"
          data-testid="btn-finish"
          class="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-800 text-white rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 shadow-sm hover:bg-stone-900 hover:-translate-y-px hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          (click)="onSubmit()"
        >
          Abschließen
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
        </button>
        <button
          type="button"
          data-testid="btn-skip"
          class="px-4 py-2.5 text-stone-400 text-sm font-medium rounded-lg cursor-pointer transition-all duration-120 hover:text-stone-600 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          (click)="skip.emit()"
        >
          Überspringen
        </button>
      </div>
    </div>
  `,
})
export class EveningFlowComponent {
  complete = output<{ reflection: string; question: string }>();
  skip = output<void>();

  private readonly dayRhythm = inject(DayRhythmService);

  readonly question = pickEveningQuestion();
  reflectionText = signal('');

  readonly completions = signal<CompletedItem[]>(
    this.dayRhythm.todayEntry()?.completedItems ?? []
  );

  onSubmit(): void {
    this.complete.emit({ reflection: this.reflectionText(), question: this.question });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: All EveningFlowComponent tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/evening-flow/
git commit -m "feat(daily-rhythm): add EveningFlowComponent with completion summary"
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

### Task 9: Wire everything into AppComponent

**Files:**
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`

- [ ] **Step 1: Update AppComponent class**

Add morning/evening flow state management. The morning flow shows when `needsMorning()` is true. The evening nudge shows after 17:00 when `needsEvening()` is true and not dismissed. The evening flow shows when the user clicks "Tagesreflexion starten".

Add imports for `MorningFlowComponent`, `EveningFlowComponent`, `EveningNudgeComponent`, and `DayRhythmService`. Add signals: `showEveningFlow`, `nudgeDismissed`. Add an interval check for the evening nudge trigger. Add handler methods for morning/evening complete and skip events.

```typescript
// Key additions to AppComponent:

import { MorningFlowComponent } from './components/morning-flow/morning-flow';
import { EveningFlowComponent } from './components/evening-flow/evening-flow';
import { EveningNudgeComponent } from './components/evening-nudge/evening-nudge';
import { DayRhythmService } from './services/day-rhythm.service';

// In class:
private readonly dayRhythm = inject(DayRhythmService);
showEveningFlow = signal(false);
nudgeDismissed = signal(this.isNudgeDismissedToday());
private nudgeInterval: ReturnType<typeof setInterval> | null = null;

currentHour = signal(new Date().getHours());

showNudge = computed(() => {
  if (this.nudgeDismissed() || this.showEveningFlow()) return false;
  if (this.currentHour() < 17) return false;
  return this.dayRhythm.needsEvening();
});

constructor() {
  // existing effect for activeView persistence...

  this.dayRhythm.ensureToday();

  this.nudgeInterval = setInterval(() => {
    this.currentHour.set(new Date().getHours());
  }, 5 * 60 * 1000);
}

onMorningComplete(event: { focus: string; question: string }): void {
  this.dayRhythm.saveMorning(event.focus, event.question);
}

onMorningSkip(): void {
  this.dayRhythm.skipMorning();
}

onEveningComplete(event: { reflection: string; question: string }): void {
  this.dayRhythm.saveEvening(event.reflection, event.question);
  this.showEveningFlow.set(false);
}

onEveningSkip(): void {
  this.dayRhythm.skipEvening();
  this.showEveningFlow.set(false);
}

onNudgeStart(): void {
  this.showEveningFlow.set(true);
}

onNudgeDismiss(): void {
  this.nudgeDismissed.set(true);
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem('orbit.nudge.dismissed', today);
}

private isNudgeDismissedToday(): boolean {
  const today = new Date().toISOString().split('T')[0];
  return localStorage.getItem('orbit.nudge.dismissed') === today;
}
```

- [ ] **Step 2: Update app.html template**

Add morning flow overlay (replaces content when `needsMorning()`), evening flow overlay, and evening nudge toast:

```html
<div class="flex h-screen overflow-hidden">
  <app-hybrid-rail
    [activeView]="activeView()"
    (viewChange)="activeView.set($event)"
  />

  @if (dayRhythm.needsMorning()) {
    <app-morning-flow
      class="flex-1 overflow-hidden"
      (complete)="onMorningComplete($event)"
      (skip)="onMorningSkip()"
    />
  } @else if (showEveningFlow()) {
    <app-evening-flow
      class="flex-1 overflow-hidden"
      (complete)="onEveningComplete($event)"
      (skip)="onEveningSkip()"
    />
  } @else {
    @switch (activeView()) {
      @case ('arbeit') {
        <app-view-arbeit class="flex-1 overflow-hidden" />
      }
      @case ('timeline') {
        <app-view-timeline class="flex-1 overflow-hidden" />
      }
    }
  }
</div>

@if (showNudge()) {
  <app-evening-nudge
    (startReflection)="onNudgeStart()"
    (dismiss)="onNudgeDismiss()"
  />
}

<app-quick-capture [open]="overlayOpen()" (close)="onOverlayClose()" />
```

- [ ] **Step 3: Run full test suite**

Run: `npx ng test --no-watch`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/app.ts src/app/app.html
git commit -m "feat(daily-rhythm): wire morning/evening flows and nudge into AppComponent"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx ng test --no-watch`
Expected: All tests pass, zero failures.

- [ ] **Step 2: Run the app and verify**

Run: `npm start`

Verify checklist:
- Morning flow appears automatically on first visit (no entry for today)
- Greeting shows correct time-of-day variant
- Question is displayed, textarea works
- "Tag starten" saves focus and dismisses to normal view
- "Überspringen" dismisses without saving
- Staggered fade-in animations play correctly
- After 17:00: toast nudge appears at bottom
- Toast "Tagesreflexion starten" opens evening flow
- Toast "✕" dismisses and doesn't reappear
- Evening flow shows completed items from the day
- Evening flow shows supportive message if no completions
- "Abschließen" saves reflection and returns to normal view
- Timeline view shows journal entries with questions + answers
- Timeline shows indigo line for morning, amber for evening
- Completing a todo records it in today's completions
- Escape key dismisses morning/evening flows
- All keyboard navigation and focus management works

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(daily-rhythm): address verification issues"
```
