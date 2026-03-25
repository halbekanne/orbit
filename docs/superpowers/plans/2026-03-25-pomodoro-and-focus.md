# Pomodoro Timer & Focus Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two independent features — a Focus Marker (cognitive anchor promoting one work item to a pinned navigator section) and a Pomodoro Timer (focus timer with timeline visualization, progress bar, and animated break overlay).

**Architecture:** Two independent services (`FocusService`, `PomodoroService`) with no coupling. Focus Marker modifies the navigator and action rail. Pomodoro Timer adds a progress bar to the app root, a start button to the Tagesplan panel, a timeline overlay block, and three overlay screens (focus-end, break, break-end).

**Tech Stack:** Angular 20+ (standalone components, signals, zoneless), Tailwind CSS, Vitest, localStorage persistence.

**Spec:** `docs/superpowers/specs/2026-03-24-pomodoro-and-focus-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/app/services/focus.service.ts` | Focus state management (focused item ID+type, resolve, persist) |
| `src/app/services/focus.service.spec.ts` | Unit tests for FocusService |
| `src/app/services/pomodoro.service.ts` | Timer state machine (idle/running/break), timestamp-based, persist |
| `src/app/services/pomodoro.service.spec.ts` | Unit tests for PomodoroService |
| `src/app/components/pomodoro-config-popup/pomodoro-config-popup.ts` | Config popup (duration inputs + start button) |
| `src/app/components/pomodoro-progress-bar/pomodoro-progress-bar.ts` | Thin top bar showing session progress |
| `src/app/components/pomodoro-overlay/pomodoro-overlay.ts` | Focus-end popup, break screen with astronaut, break-end popup |
| `src/app/components/pomodoro-overlay/pomodoro-overlay.spec.ts` | Tests for overlay state transitions |

### Modified Files

| File | Changes |
|------|---------|
| `src/app/models/work-item.model.ts` | Add `FocusTarget` type alias |
| `src/app/components/action-rail/action-rail.ts` | Add focus toggle button at top of template |
| `src/app/components/navigator/navigator.ts` | Add focus section below rhythm card |
| `src/app/components/navigator/navigator.html` | Render pinned focus card |
| `src/app/components/day-calendar-panel/day-calendar-panel.ts` | Add Pomodoro start/cancel button in header, pass pomodoro block to timeline |
| `src/app/components/day-timeline/day-timeline.ts` | Add `pomodoroBlock` input, render overlay block |
| `src/app/app.ts` | Import progress bar and overlay components |
| `src/app/app.html` | Add progress bar and overlay to root template |

---

## Task 1: FocusService

**Files:**
- Create: `src/app/services/focus.service.ts`
- Create: `src/app/services/focus.service.spec.ts`
- Modify: `src/app/models/work-item.model.ts`

- [ ] **Step 1: Add FocusTarget type**

In `src/app/models/work-item.model.ts`, add at the bottom:

```typescript
export interface FocusTarget {
  id: string;
  type: 'ticket' | 'pr' | 'todo' | 'idea';
}
```

- [ ] **Step 2: Write failing tests for FocusService**

Create `src/app/services/focus.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FocusService } from './focus.service';
import { WorkDataService } from './work-data.service';
import { TodoService } from './todo.service';
import { IdeaService } from './idea.service';
import { Todo, Idea, JiraTicket } from '../models/work-item.model';

function makeTodo(id: string): Todo {
  return { type: 'todo', id, title: 'Test', description: '', status: 'open', urgent: false, createdAt: '', completedAt: null };
}

function makeIdea(id: string): Idea {
  return { type: 'idea', id, title: 'Test Idea', description: '', status: 'active', createdAt: '' };
}

function makeTicket(id: string): JiraTicket {
  return {
    type: 'ticket', id, key: 'TEST-1', summary: 'Test', issueType: 'Task',
    status: 'To Do', priority: 'Medium', assignee: '', reporter: '', creator: '',
    description: '', dueDate: null, createdAt: '', updatedAt: '', url: '',
    labels: [], project: null, components: [], comments: [], attachments: [],
    relations: [], epicLink: null,
  };
}

describe('FocusService', () => {
  let service: FocusService;
  const todosSignal = signal<Todo[]>([makeTodo('td-1')]);
  const ideasSignal = signal<Idea[]>([makeIdea('id-1')]);
  const ticketsSignal = signal<JiraTicket[]>([makeTicket('tk-1')]);
  const pullRequestsSignal = signal<any[]>([]);

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        FocusService,
        { provide: TodoService, useValue: { todos: todosSignal } },
        { provide: IdeaService, useValue: { ideas: ideasSignal } },
        { provide: WorkDataService, useValue: { tickets: ticketsSignal, pullRequests: pullRequestsSignal } },
      ],
    });
    service = TestBed.inject(FocusService);
  });

  it('starts with no focus', () => {
    expect(service.focusTarget()).toBeNull();
  });

  it('sets focus on a work item', () => {
    service.setFocus({ id: 'td-1', type: 'todo' });
    expect(service.focusTarget()).toEqual({ id: 'td-1', type: 'todo' });
  });

  it('clears focus', () => {
    service.setFocus({ id: 'td-1', type: 'todo' });
    service.clearFocus();
    expect(service.focusTarget()).toBeNull();
  });

  it('replaces focus when setting a different item', () => {
    service.setFocus({ id: 'td-1', type: 'todo' });
    service.setFocus({ id: 'id-1', type: 'idea' });
    expect(service.focusTarget()).toEqual({ id: 'id-1', type: 'idea' });
  });

  it('resolves a focused todo to the full item', () => {
    service.setFocus({ id: 'td-1', type: 'todo' });
    expect(service.focusedItem()).toEqual(makeTodo('td-1'));
  });

  it('resolves a focused idea to the full item', () => {
    service.setFocus({ id: 'id-1', type: 'idea' });
    expect(service.focusedItem()).toEqual(makeIdea('id-1'));
  });

  it('resolves a focused ticket to the full item', () => {
    service.setFocus({ id: 'tk-1', type: 'ticket' });
    expect(service.focusedItem()).toEqual(makeTicket('tk-1'));
  });

  it('clears focus when the resolved item disappears', () => {
    service.setFocus({ id: 'td-1', type: 'todo' });
    todosSignal.set([]);
    TestBed.tick();
    expect(service.focusTarget()).toBeNull();
  });

  it('reports whether a given item is the focused one', () => {
    service.setFocus({ id: 'td-1', type: 'todo' });
    expect(service.isFocused('td-1')).toBe(true);
    expect(service.isFocused('td-2')).toBe(false);
  });

  it('persists focus to localStorage', () => {
    service.setFocus({ id: 'td-1', type: 'todo' });
    TestBed.tick();
    expect(localStorage.getItem('orbit.focus.state')).toEqual(JSON.stringify({ id: 'td-1', type: 'todo' }));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx ng test --no-watch 2>&1 | head -60`
Expected: FAIL — `focus.service` not found.

- [ ] **Step 4: Implement FocusService**

Create `src/app/services/focus.service.ts`:

```typescript
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { FocusTarget, WorkItem } from '../models/work-item.model';
import { WorkDataService } from './work-data.service';
import { TodoService } from './todo.service';
import { IdeaService } from './idea.service';

const STORAGE_KEY = 'orbit.focus.state';

@Injectable({ providedIn: 'root' })
export class FocusService {
  private readonly data = inject(WorkDataService);
  private readonly todoService = inject(TodoService);
  private readonly ideaService = inject(IdeaService);

  readonly focusTarget = signal<FocusTarget | null>(this.loadFromStorage());

  readonly focusedItem = computed<WorkItem | null>(() => {
    const target = this.focusTarget();
    if (!target) return null;
    return this.resolve(target);
  });

  constructor() {
    effect(() => {
      const item = this.focusedItem();
      const target = this.focusTarget();
      if (target && !item) {
        this.focusTarget.set(null);
      }
    });

    effect(() => {
      const target = this.focusTarget();
      if (target) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(target));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    });
  }

  setFocus(target: FocusTarget): void {
    this.focusTarget.set(target);
  }

  clearFocus(): void {
    this.focusTarget.set(null);
  }

  isFocused(id: string): boolean {
    return this.focusTarget()?.id === id;
  }

  private resolve(target: FocusTarget): WorkItem | null {
    switch (target.type) {
      case 'ticket':
        return this.data.tickets().find(t => t.id === target.id) ?? null;
      case 'pr':
        return this.data.pullRequests().find(p => p.id === target.id) ?? null;
      case 'todo':
        return this.todoService.todos().find(t => t.id === target.id) ?? null;
      case 'idea':
        return this.ideaService.ideas().find(i => i.id === target.id) ?? null;
    }
  }

  private loadFromStorage(): FocusTarget | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | head -60`
Expected: All FocusService tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/models/work-item.model.ts src/app/services/focus.service.ts src/app/services/focus.service.spec.ts
git commit -m "feat: add FocusService for work item focus marker"
```

---

## Task 2: Focus Marker UI — Action Rail Button

**Files:**
- Modify: `src/app/components/action-rail/action-rail.ts`

- [ ] **Step 1: Add focus toggle button to action rail**

In `src/app/components/action-rail/action-rail.ts`, add the `FocusService` import and inject it:

```typescript
import { FocusService } from '../../services/focus.service';
```

Add to the class body:

```typescript
protected readonly focusService = inject(FocusService);
```

Add at the very top of the template, before `@if (item?.type === 'todo')`:

```html
@if (item) {
  <button type="button"
    class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center"
    [class]="focusService.isFocused(item.id) ? 'bg-indigo-100 border-indigo-300 text-indigo-700 hover:bg-indigo-200' : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300'"
    (click)="toggleFocus(item)">
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
    {{ focusService.isFocused(item.id) ? 'Fokus entfernen' : 'Fokus setzen' }}
  </button>
}
```

Add to the class body:

```typescript
toggleFocus(item: WorkItem): void {
  if (this.focusService.isFocused(item.id)) {
    this.focusService.clearFocus();
  } else {
    this.focusService.setFocus({ id: item.id, type: item.type });
  }
}
```

Add the `WorkItem` import to the existing imports from `work-item.model`.

- [ ] **Step 2: Verify manually that the button renders**

Run: `npx ng serve` and check that the focus button appears in the action rail when any work item is selected.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/action-rail/action-rail.ts
git commit -m "feat: add focus toggle button to action rail"
```

---

## Task 3: Focus Marker UI — Navigator Pinned Section

**Files:**
- Modify: `src/app/components/navigator/navigator.ts`
- Modify: `src/app/components/navigator/navigator.html`

- [ ] **Step 1: Inject FocusService in navigator**

In `src/app/components/navigator/navigator.ts`, add import:

```typescript
import { FocusService } from '../../services/focus.service';
```

Add to the class:

```typescript
protected readonly focusService = inject(FocusService);
```

- [ ] **Step 2: Add focus section to navigator template**

In `src/app/components/navigator/navigator.html`, insert the focus section after the rhythm card and before the gradient divider (between lines 14 and 15). The section shows the focused item's card, promoted from its original list:

```html
@if (focusService.focusedItem(); as focusedItem) {
  <section aria-labelledby="focus-heading" class="mb-2">
    <div class="flex items-center gap-2 mb-2 px-1">
      <span id="focus-heading" class="text-xs font-semibold text-indigo-600 uppercase tracking-wider">🎯 Fokus</span>
      <div class="flex-1 h-px bg-gradient-to-r from-indigo-200 to-transparent"></div>
    </div>
    <ul class="space-y-1.5" role="list">
      <li>
        @switch (focusedItem.type) {
          @case ('ticket') {
            <app-ticket-card [ticket]="$any(focusedItem)" [selected]="isSelected(focusedItem)" (select)="selectItem($event)" />
          }
          @case ('pr') {
            <app-pr-card [pr]="$any(focusedItem)" [selected]="isSelected(focusedItem)" (select)="selectItem($event)" />
          }
          @case ('todo') {
            <app-todo-card [todo]="$any(focusedItem)" [selected]="isSelected(focusedItem)" (select)="selectItem($event)" />
          }
          @case ('idea') {
            <app-idea-card [idea]="$any(focusedItem)" [selected]="isSelected(focusedItem)" (select)="selectItem($event)" />
          }
        }
      </li>
    </ul>
  </section>
}
```

- [ ] **Step 3: Filter focused item from original lists**

In `src/app/components/navigator/navigator.ts`, add computed signals that exclude the focused item from their original lists. The navigator currently reads tickets and PRs from `data` (WorkDataService) and todos/ideas from their services. Add filtered computeds:

```typescript
readonly filteredTickets = computed(() =>
  this.data.tickets().filter(t => !this.focusService.isFocused(t.id))
);
readonly filteredPullRequests = computed(() =>
  this.data.pullRequests().filter(p => !this.focusService.isFocused(p.id))
);
readonly filteredOpenTodos = computed(() =>
  this.todoService.openTodos().filter(t => !this.focusService.isFocused(t.id))
);
readonly filteredActiveIdeas = computed(() =>
  this.ideaService.activeIdeas().filter(i => !this.focusService.isFocused(i.id))
);
```

Then update the template to use these filtered signals instead of the originals:
- Replace `data.tickets()` with `filteredTickets()`
- Replace `data.pullRequests()` with `filteredPullRequests()`
- Replace `todoService.openTodos()` with `filteredOpenTodos()`
- Replace `ideaService.activeIdeas()` with `filteredActiveIdeas()`

Also update the count badges to use the filtered counts where appropriate.

- [ ] **Step 4: Verify manually**

Run: `npx ng serve` and verify:
1. Setting focus on a todo promotes it to the focus section
2. The todo disappears from the Aufgaben list
3. Removing focus returns it to the list
4. Same for tickets, PRs, and ideas

- [ ] **Step 5: Commit**

```bash
git add src/app/components/navigator/navigator.ts src/app/components/navigator/navigator.html
git commit -m "feat: add pinned focus section to navigator"
```

---

## Task 4: PomodoroService

**Files:**
- Create: `src/app/services/pomodoro.service.ts`
- Create: `src/app/services/pomodoro.service.spec.ts`

- [ ] **Step 1: Write failing tests for PomodoroService**

Create `src/app/services/pomodoro.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { PomodoroService, PomodoroState } from './pomodoro.service';

describe('PomodoroService', () => {
  let service: PomodoroService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [PomodoroService] });
    service = TestBed.inject(PomodoroService);
  });

  it('starts in idle state', () => {
    expect(service.state()).toBe('idle');
  });

  it('transitions to running on start', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    expect(service.state()).toBe('running');
    expect(service.focusMinutes()).toBe(25);
    expect(service.breakMinutes()).toBe(5);
  });

  it('stores startedAt timestamp on start', () => {
    const before = Date.now();
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    expect(service.startedAt()).toBeGreaterThanOrEqual(before);
    expect(service.startedAt()).toBeLessThanOrEqual(Date.now());
  });

  it('computes elapsed and remaining correctly', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    expect(service.remainingMinutes()).toBeCloseTo(25, 0);
    expect(service.progress()).toBeCloseTo(0, 1);
  });

  it('returns to idle on cancel', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    service.cancel();
    expect(service.state()).toBe('idle');
    expect(service.startedAt()).toBeNull();
  });

  it('transitions to break state', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    service.startBreak();
    expect(service.state()).toBe('break');
  });

  it('snooze extends focus by 5 minutes', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    const originalMinutes = service.focusMinutes();
    service.snooze();
    expect(service.focusMinutes()).toBe(originalMinutes + 5);
    expect(service.state()).toBe('running');
  });

  it('finishes break and returns to idle', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    service.startBreak();
    service.finishBreak();
    expect(service.state()).toBe('idle');
  });

  it('starts new round from break', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    service.startBreak();
    service.startNewRound();
    expect(service.state()).toBe('running');
  });

  it('persists session to localStorage', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    TestBed.tick();
    const stored = JSON.parse(localStorage.getItem('orbit.pomodoro.session')!);
    expect(stored.state).toBe('running');
    expect(stored.focusMinutes).toBe(25);
  });

  it('persists default durations to localStorage', () => {
    service.start({ focusMinutes: 30, breakMinutes: 10 });
    TestBed.tick();
    const defaults = JSON.parse(localStorage.getItem('orbit.pomodoro.defaults')!);
    expect(defaults.focusMinutes).toBe(30);
    expect(defaults.breakMinutes).toBe(10);
  });

  it('loads default durations from localStorage', () => {
    localStorage.setItem('orbit.pomodoro.defaults', JSON.stringify({ focusMinutes: 45, breakMinutes: 10 }));
    const freshService = TestBed.inject(PomodoroService);
    expect(freshService.defaultFocusMinutes()).toBe(45);
    expect(freshService.defaultBreakMinutes()).toBe(10);
  });

  it('computes timeline block from running session', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    const block = service.timelineBlock();
    expect(block).not.toBeNull();
    expect(block!.endTime).toBeDefined();
    expect(block!.startTime).toBeDefined();
  });

  it('returns null timeline block when idle', () => {
    expect(service.timelineBlock()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch 2>&1 | head -60`
Expected: FAIL — `pomodoro.service` not found.

- [ ] **Step 3: Implement PomodoroService**

Create `src/app/services/pomodoro.service.ts`:

```typescript
import { Injectable, computed, effect, signal } from '@angular/core';

export type PomodoroState = 'idle' | 'running' | 'break';

interface PomodoroSession {
  state: PomodoroState;
  startedAt: number;
  focusMinutes: number;
  breakMinutes: number;
  breakStartedAt: number | null;
}

interface PomodoroDefaults {
  focusMinutes: number;
  breakMinutes: number;
}

const SESSION_KEY = 'orbit.pomodoro.session';
const DEFAULTS_KEY = 'orbit.pomodoro.defaults';

function minutesToTimeStr(totalMinutes: number): string {
  const date = new Date(totalMinutes * 60_000);
  const h = date.getUTCHours();
  const m = date.getUTCMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function nowToTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class PomodoroService {
  private readonly session = signal<PomodoroSession | null>(this.loadSession());
  private readonly defaults = signal<PomodoroDefaults>(this.loadDefaults());
  readonly tick = signal(Date.now());
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  readonly state = computed<PomodoroState>(() => this.session()?.state ?? 'idle');
  readonly startedAt = computed(() => this.session()?.startedAt ?? null);
  readonly focusMinutes = computed(() => this.session()?.focusMinutes ?? 0);
  readonly breakMinutes = computed(() => this.session()?.breakMinutes ?? 0);
  readonly defaultFocusMinutes = computed(() => this.defaults().focusMinutes);
  readonly defaultBreakMinutes = computed(() => this.defaults().breakMinutes);

  readonly elapsedMs = computed(() => {
    this.tick();
    const s = this.session();
    if (!s) return 0;
    if (s.state === 'break' && s.breakStartedAt) {
      return Date.now() - s.breakStartedAt;
    }
    return Date.now() - s.startedAt;
  });

  readonly remainingMinutes = computed(() => {
    const s = this.session();
    if (!s) return 0;
    const totalMs = (s.state === 'break' ? s.breakMinutes : s.focusMinutes) * 60_000;
    const remaining = totalMs - this.elapsedMs();
    return Math.max(0, remaining / 60_000);
  });

  readonly progress = computed(() => {
    const s = this.session();
    if (!s) return 0;
    const totalMs = (s.state === 'break' ? s.breakMinutes : s.focusMinutes) * 60_000;
    if (totalMs === 0) return 0;
    return Math.min(1, this.elapsedMs() / totalMs);
  });

  readonly isComplete = computed(() => {
    const s = this.session();
    if (!s) return false;
    return this.progress() >= 1;
  });

  readonly timelineBlock = computed<{ startTime: string; endTime: string } | null>(() => {
    const s = this.session();
    if (!s || s.state !== 'running') return null;
    const startDate = new Date(s.startedAt);
    const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
    const endMinutes = startMinutes + s.focusMinutes;
    const startH = Math.floor(startMinutes / 60);
    const startM = startMinutes % 60;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    return {
      startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
      endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
    };
  });

  constructor() {
    effect(() => {
      const s = this.session();
      if (s) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    });

    this.recoverSession();
  }

  start(config: { focusMinutes: number; breakMinutes: number }): void {
    this.session.set({
      state: 'running',
      startedAt: Date.now(),
      focusMinutes: config.focusMinutes,
      breakMinutes: config.breakMinutes,
      breakStartedAt: null,
    });
    this.defaults.set(config);
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(config));
    this.startTicking();
  }

  cancel(): void {
    this.session.set(null);
    this.stopTicking();
  }

  snooze(): void {
    const s = this.session();
    if (!s || s.state !== 'running') return;
    this.session.set({ ...s, focusMinutes: s.focusMinutes + 5 });
  }

  startBreak(): void {
    const s = this.session();
    if (!s) return;
    this.session.set({ ...s, state: 'break', breakStartedAt: Date.now() });
  }

  finishBreak(): void {
    this.session.set(null);
    this.stopTicking();
  }

  startNewRound(): void {
    const s = this.session();
    if (!s) return;
    const d = this.defaults();
    this.session.set({
      state: 'running',
      startedAt: Date.now(),
      focusMinutes: d.focusMinutes,
      breakMinutes: d.breakMinutes,
      breakStartedAt: null,
    });
  }

  private startTicking(): void {
    this.stopTicking();
    this.tickInterval = setInterval(() => this.tick.set(Date.now()), 1000);
  }

  private stopTicking(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private recoverSession(): void {
    const s = this.session();
    if (!s) return;

    const now = Date.now();
    if (s.state === 'running') {
      const elapsed = now - s.startedAt;
      if (elapsed >= s.focusMinutes * 60_000) {
        this.session.set(null);
        return;
      }
      this.startTicking();
    } else if (s.state === 'break') {
      if (!s.breakStartedAt) { this.session.set(null); return; }
      const elapsed = now - s.breakStartedAt;
      if (elapsed >= s.breakMinutes * 60_000) {
        this.session.set(null);
        return;
      }
      this.startTicking();
    }
  }

  private loadSession(): PomodoroSession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  private loadDefaults(): PomodoroDefaults {
    try {
      const raw = localStorage.getItem(DEFAULTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { focusMinutes: 25, breakMinutes: 5 };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | head -60`
Expected: All PomodoroService tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/pomodoro.service.ts src/app/services/pomodoro.service.spec.ts
git commit -m "feat: add PomodoroService with timer state machine"
```

---

## Task 5: Pomodoro Config Popup

**Files:**
- Create: `src/app/components/pomodoro-config-popup/pomodoro-config-popup.ts`

- [ ] **Step 1: Create the config popup component**

Create `src/app/components/pomodoro-config-popup/pomodoro-config-popup.ts`:

```typescript
import { ChangeDetectionStrategy, Component, inject, output, signal, afterNextRender, viewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PomodoroService } from '../../services/pomodoro.service';

@Component({
  selector: 'app-pomodoro-config-popup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  host: {
    '(document:keydown.escape)': 'cancel.emit()',
  },
  template: `
    <div class="fixed inset-0 bg-black/20 backdrop-blur-sm z-50" (click)="cancel.emit()"></div>
    <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div class="bg-white rounded-xl shadow-lg p-5 w-[280px] pointer-events-auto" role="dialog" aria-modal="true" aria-label="Pomodoro konfigurieren">
        <h3 class="text-sm font-semibold text-stone-800 mb-4">Pomodoro starten</h3>

        <label class="block mb-3">
          <span class="text-xs font-medium text-stone-600 mb-1 block">Fokuszeit (Minuten)</span>
          <input #focusInput type="number" min="1" max="120" [(ngModel)]="focusMinutes"
            class="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300" />
        </label>

        <label class="block mb-4">
          <span class="text-xs font-medium text-stone-600 mb-1 block">Pausenzeit (Minuten)</span>
          <input type="number" min="1" max="60" [(ngModel)]="breakMinutes"
            class="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300" />
        </label>

        <button type="button"
          class="w-full rounded-lg bg-indigo-600 text-white py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors"
          (click)="onStart()">
          Starten
        </button>
      </div>
    </div>
  `,
})
export class PomodoroConfigPopupComponent {
  private readonly pomodoro = inject(PomodoroService);
  readonly cancel = output<void>();
  readonly started = output<void>();
  readonly focusInput = viewChild<ElementRef<HTMLInputElement>>('focusInput');

  focusMinutes = this.pomodoro.defaultFocusMinutes();
  breakMinutes = this.pomodoro.defaultBreakMinutes();

  constructor() {
    afterNextRender(() => {
      this.focusInput()?.nativeElement.focus();
      this.focusInput()?.nativeElement.select();
    });
  }

  onStart(): void {
    this.pomodoro.start({ focusMinutes: this.focusMinutes, breakMinutes: this.breakMinutes });
    this.started.emit();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/pomodoro-config-popup/pomodoro-config-popup.ts
git commit -m "feat: add Pomodoro config popup component"
```

---

## Task 6: Pomodoro Button in Tagesplan Panel

**Files:**
- Modify: `src/app/components/day-calendar-panel/day-calendar-panel.ts`

- [ ] **Step 1: Add Pomodoro button and popup integration**

In `src/app/components/day-calendar-panel/day-calendar-panel.ts`:

Add imports:
```typescript
import { PomodoroService } from '../../services/pomodoro.service';
import { PomodoroConfigPopupComponent } from '../pomodoro-config-popup/pomodoro-config-popup';
```

Add to `imports` array: `PomodoroConfigPopupComponent`

Inject the service:
```typescript
readonly pomodoro = inject(PomodoroService);
readonly showPomodoroConfig = signal(false);
readonly showCancelConfirm = signal(false);
```

In the template, modify the header section (the `@else` branch, the `<div>` with "Tagesplan") to add the Pomodoro button between the title and collapse button:

```html
<div class="flex items-center justify-between px-4 py-3 border-b border-stone-200">
  <span class="font-semibold text-stone-800 text-sm tracking-wide">Tagesplan</span>
  <div class="flex items-center gap-1">
    @if (pomodoro.state() === 'idle') {
      <button
        class="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded p-1 transition-colors text-xs font-medium"
        (click)="showPomodoroConfig.set(true)"
        aria-label="Pomodoro starten"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>
      </button>
    } @else if (pomodoro.state() === 'running') {
      @if (showCancelConfirm()) {
        <div class="flex items-center gap-1">
          <span class="text-xs text-stone-500">Abbrechen?</span>
          <button class="text-xs text-red-600 hover:text-red-800 font-medium px-1" (click)="confirmCancel()">Ja</button>
          <button class="text-xs text-stone-400 hover:text-stone-600 font-medium px-1" (click)="showCancelConfirm.set(false)">Nein</button>
        </div>
      } @else {
        <button
          class="text-red-400 hover:text-red-600 hover:bg-red-50 rounded p-1 transition-colors text-xs font-medium"
          (click)="showCancelConfirm.set(true)"
          aria-label="Pomodoro abbrechen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
        </button>
      }
    }
    <button
      class="text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded p-0.5 transition-colors"
      (click)="toggleCollapse()"
      data-testid="collapse-toggle"
      aria-label="Tagesplan ausblenden"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </button>
  </div>
</div>
```

Add the config popup rendering at the end of the template (next to the appointment popup):

```html
@if (showPomodoroConfig()) {
  <app-pomodoro-config-popup
    (started)="showPomodoroConfig.set(false)"
    (cancel)="showPomodoroConfig.set(false)"
  />
}
```

Add the method:

```typescript
confirmCancel(): void {
  this.pomodoro.cancel();
  this.showCancelConfirm.set(false);
}
```

Also pass the pomodoro timeline block to the day-timeline component. Update the `<app-day-timeline>` tag:

```html
<app-day-timeline
  [appointments]="service.appointments()"
  [pomodoroBlock]="pomodoro.timelineBlock()"
  (appointmentCreate)="onCreateRequest($event)"
  (appointmentEdit)="onEditRequest($event)"
  (appointmentUpdate)="onResizeUpdate($event)"
/>
```

- [ ] **Step 2: Verify manually**

Run: `npx ng serve` and verify:
1. Play button appears in Tagesplan header when idle
2. Clicking it opens the config popup
3. Escape closes the popup
4. Starting shows a stop button
5. Stop button shows "Abbrechen?" confirmation

- [ ] **Step 3: Commit**

```bash
git add src/app/components/day-calendar-panel/day-calendar-panel.ts
git commit -m "feat: add Pomodoro start/cancel button to Tagesplan panel"
```

---

## Task 7: Pomodoro Timeline Block

**Files:**
- Modify: `src/app/components/day-timeline/day-timeline.ts`

- [ ] **Step 1: Add pomodoroBlock input and rendering**

In `src/app/components/day-timeline/day-timeline.ts`:

Add a new input:

```typescript
readonly pomodoroBlock = input<{ startTime: string; endTime: string } | null>(null);
```

Add a computed for the block's pixel position:

```typescript
readonly pomodoroBlockStyle = computed(() => {
  const block = this.pomodoroBlock();
  if (!block) return null;
  const startMins = timeToMinutes(block.startTime);
  const endMins = Math.min(timeToMinutes(block.endTime), END_HOUR * 60);
  const clampedStart = Math.max(startMins, START_HOUR * 60);
  if (clampedStart >= END_HOUR * 60) return null;
  const top = minutesToPx(clampedStart);
  const height = minutesToPx(endMins) - top;
  return { top: `${top}px`, height: `${Math.max(height, 4)}px` };
});
```

Add to the template, inside the `.grid-container` div, after the appointment blocks and before the current-time line. Add a CSS class for the pomodoro block in the styles section:

```css
.pomodoro-block {
  position: absolute;
  left: 58px;
  right: 8px;
  border: 2px dashed #818cf8;
  border-radius: 8px;
  background: rgba(238, 242, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 3;
}
.pomodoro-block-label {
  font-size: 11px;
  font-weight: 600;
  color: #6366f1;
  opacity: 0.8;
}
```

Add the template block:

```html
@if (pomodoroBlockStyle(); as style) {
  <div class="pomodoro-block" [style.top]="style.top" [style.height]="style.height">
    <span class="pomodoro-block-label">Fokus</span>
  </div>
}
```

- [ ] **Step 2: Verify manually**

Start a Pomodoro session and verify the dashed indigo block appears on the timeline at the correct time position.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/day-timeline/day-timeline.ts
git commit -m "feat: render Pomodoro block on day timeline"
```

---

## Task 8: Top Progress Bar

**Files:**
- Create: `src/app/components/pomodoro-progress-bar/pomodoro-progress-bar.ts`
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`

- [ ] **Step 1: Create the progress bar component**

Create `src/app/components/pomodoro-progress-bar/pomodoro-progress-bar.ts`:

```typescript
import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { PomodoroService } from '../../services/pomodoro.service';

@Component({
  selector: 'app-pomodoro-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        class="fixed top-0 left-0 h-[3px] bg-indigo-500 z-50 transition-[width] duration-1000 ease-linear"
        [style.width.%]="progressPercent()"
        role="progressbar"
        [attr.aria-valuenow]="progressPercent()"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Fokuszeit-Fortschritt"
      ></div>
    }
  `,
})
export class PomodoroProgressBarComponent {
  private readonly pomodoro = inject(PomodoroService);

  readonly visible = computed(() => this.pomodoro.state() === 'running');
  readonly progressPercent = computed(() => Math.round(this.pomodoro.progress() * 100));
}
```

- [ ] **Step 2: Add to app root**

In `src/app/app.ts`, add the import:

```typescript
import { PomodoroProgressBarComponent } from './components/pomodoro-progress-bar/pomodoro-progress-bar';
```

Add `PomodoroProgressBarComponent` to the `imports` array.

In `src/app/app.html`, add as the first line before the flex container:

```html
<app-pomodoro-progress-bar />
```

- [ ] **Step 3: Verify manually**

Start a Pomodoro and verify the thin indigo bar appears at the top and slowly fills.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/pomodoro-progress-bar/pomodoro-progress-bar.ts src/app/app.ts src/app/app.html
git commit -m "feat: add Pomodoro progress bar at top of app"
```

---

## Task 9: Pomodoro Overlay — Focus End & Break End Popups

**Files:**
- Create: `src/app/components/pomodoro-overlay/pomodoro-overlay.ts`
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`

- [ ] **Step 1: Create the overlay component**

Create `src/app/components/pomodoro-overlay/pomodoro-overlay.ts`. This is a large component that handles three states: focus-end popup, break screen, and break-end popup.

```typescript
import { ChangeDetectionStrategy, Component, inject, computed, signal, effect, OnDestroy } from '@angular/core';
import { PomodoroService } from '../../services/pomodoro.service';

const FOCUS_END_MESSAGES = [
  'Gut gemacht!',
  'Super Arbeit!',
  'Stark durchgehalten!',
  'Toll fokussiert!',
  'Klasse gemacht!',
];

const BREAK_SUGGESTIONS = [
  'Steh auf und streck dich kurz',
  'Trink ein Glas Wasser',
  'Schau kurz aus dem Fenster',
  'Mach ein paar tiefe Atemzüge',
  'Roll die Schultern ein paar Mal',
  'Steh auf und geh ein paar Schritte',
];

type OverlayState = 'hidden' | 'focus-end' | 'break-active' | 'break-end';

@Component({
  selector: 'app-pomodoro-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.hidden]': 'overlayState() === "hidden"' },
  template: `
    @switch (overlayState()) {
      @case ('focus-end') {
        <div class="fixed inset-0 bg-black/40 backdrop-blur-[3px] z-[60] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Fokuszeit beendet">
          <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div class="w-12 h-12 mx-auto mb-4 bg-amber-50 rounded-full flex items-center justify-center text-2xl">☀️</div>
            <h2 class="text-lg font-semibold text-stone-900 mb-1">{{ congratsMessage() }}</h2>
            <p class="text-sm text-stone-500 mb-5">{{ focusMinutes() }} Minuten Fokuszeit geschafft.</p>
            <div class="bg-indigo-50 rounded-lg px-4 py-2.5 mb-5 text-sm text-indigo-700">💡 {{ breakSuggestion() }}</div>
            <div class="flex flex-col gap-2">
              <button type="button"
                class="w-full rounded-xl bg-indigo-600 text-white py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
                (click)="startBreak()">
                Pause starten ({{ breakMinutes() }} Min)
              </button>
              <button type="button"
                class="w-full rounded-xl border border-stone-200 text-stone-500 py-2 text-sm hover:border-stone-300 hover:text-stone-700 transition-colors"
                (click)="snooze()">
                Noch 5 Minuten arbeiten
              </button>
            </div>
          </div>
        </div>
      }

      @case ('break-active') {
        <div class="fixed inset-0 z-[60] flex flex-col items-center justify-center"
          style="background: linear-gradient(135deg, #312e81 0%, #1e1b4b 40%, #0c0a09 100%)"
          role="dialog" aria-modal="true" aria-label="Pause">

          <div class="relative w-32 h-32 mb-8" aria-hidden="true">
            <!-- Astronaut SVG placeholder — will be replaced with actual animated SVG -->
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-300 to-indigo-600 opacity-30"
                style="animation: float 8s ease-in-out infinite;"></div>
            </div>
            <div class="absolute inset-0 flex items-center justify-center text-4xl"
              style="animation: float 8s ease-in-out infinite;">🧑‍🚀</div>
          </div>

          <p class="text-xl font-light text-indigo-100 mb-1 tracking-wide">Pause</p>
          <p class="text-xs text-indigo-300/40 mb-4 tracking-widest">schwerelos treiben lassen …</p>

          <div class="w-40 h-[3px] bg-white/10 rounded-full mb-3 overflow-hidden">
            <div class="h-full bg-gradient-to-r from-indigo-400 to-indigo-300 rounded-full transition-[width] duration-1000 ease-linear"
              [style.width.%]="breakProgress()"
              role="progressbar"
              [attr.aria-valuenow]="breakProgress()"
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
          </div>
          <p class="text-xs text-indigo-300/60 mb-6">noch {{ breakRemainingMinutes() }} Minuten</p>

          <div class="bg-white/5 rounded-xl px-5 py-2.5 text-sm text-indigo-200 mb-8">💡 {{ breakSuggestion() }}</div>

          <button type="button"
            class="text-xs text-indigo-300/40 border border-indigo-300/15 rounded-lg px-4 py-1.5 hover:text-indigo-200 hover:border-indigo-300/30 transition-colors"
            (click)="cancelBreak()">
            Pause beenden
          </button>
        </div>
      }

      @case ('break-end') {
        <div class="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[60] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Pause beendet">
          <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div class="w-12 h-12 mx-auto mb-4 bg-emerald-50 rounded-full flex items-center justify-center text-2xl">🚀</div>
            <h2 class="text-lg font-semibold text-stone-900 mb-1">Pause vorbei!</h2>
            <p class="text-sm text-stone-500 mb-5">Bereit für die nächste Runde?</p>
            <div class="flex flex-col gap-2">
              <button type="button"
                class="w-full rounded-xl bg-indigo-600 text-white py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
                (click)="startNewRound()">
                Neue Fokuszeit starten
              </button>
              <button type="button"
                class="w-full rounded-xl border border-stone-200 text-stone-500 py-2 text-sm hover:border-stone-300 hover:text-stone-700 transition-colors"
                (click)="finish()">
                Fertig für jetzt
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
  styles: [`
    @keyframes float {
      0%, 100% { transform: translateY(0) rotate(-3deg); }
      25% { transform: translateY(-6px) rotate(0deg); }
      50% { transform: translateY(2px) rotate(3deg); }
      75% { transform: translateY(-3px) rotate(1deg); }
    }
    :host.hidden { display: none; }

    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: 0.01ms !important; }
    }
  `],
})
export class PomodoroOverlayComponent implements OnDestroy {
  private readonly pomodoro = inject(PomodoroService);
  private chimeAudio: HTMLAudioElement | null = null;

  readonly overlayState = signal<OverlayState>('hidden');
  readonly congratsMessage = signal(this.pickRandom(FOCUS_END_MESSAGES));
  readonly breakSuggestion = signal(this.pickRandom(BREAK_SUGGESTIONS));
  readonly focusMinutes = computed(() => this.pomodoro.focusMinutes());
  readonly breakMinutes = computed(() => this.pomodoro.breakMinutes());
  readonly breakProgress = computed(() => {
    if (this.pomodoro.state() !== 'break') return 0;
    return Math.round(this.pomodoro.progress() * 100);
  });
  readonly breakRemainingMinutes = computed(() => Math.ceil(this.pomodoro.remainingMinutes()));

  constructor() {
    effect(() => {
      const state = this.pomodoro.state();
      const complete = this.pomodoro.isComplete();

      if (state === 'running' && complete) {
        this.congratsMessage.set(this.pickRandom(FOCUS_END_MESSAGES));
        this.breakSuggestion.set(this.pickRandom(BREAK_SUGGESTIONS));
        this.overlayState.set('focus-end');
        this.playChime();
      } else if (state === 'break' && complete) {
        this.overlayState.set('break-end');
        this.playSoftChime();
      } else if (state === 'break' && !complete) {
        if (this.overlayState() !== 'break-active') {
          this.overlayState.set('break-active');
        }
      } else if (state === 'idle') {
        this.overlayState.set('hidden');
      } else if (state === 'running' && !complete) {
        this.overlayState.set('hidden');
      }
    });
  }

  ngOnDestroy(): void {
    this.chimeAudio?.pause();
  }

  startBreak(): void {
    this.pomodoro.startBreak();
  }

  snooze(): void {
    this.pomodoro.snooze();
    this.overlayState.set('hidden');
  }

  cancelBreak(): void {
    this.pomodoro.finishBreak();
  }

  startNewRound(): void {
    this.pomodoro.startNewRound();
  }

  finish(): void {
    this.pomodoro.finishBreak();
  }

  private playChime(): void {
    try {
      // TODO: Replace with actual chime audio file
      // this.chimeAudio = new Audio('assets/sounds/chime.mp3');
      // this.chimeAudio.play().catch(() => {});
    } catch {}
  }

  private playSoftChime(): void {
    try {
      // TODO: Replace with actual soft chime audio file
      // this.chimeAudio = new Audio('assets/sounds/soft-chime.mp3');
      // this.chimeAudio.play().catch(() => {});
    } catch {}
  }

  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
```

- [ ] **Step 2: Add to app root**

In `src/app/app.ts`, add the import:

```typescript
import { PomodoroOverlayComponent } from './components/pomodoro-overlay/pomodoro-overlay';
```

Add `PomodoroOverlayComponent` to the `imports` array.

In `src/app/app.html`, add after the quick-capture line:

```html
<app-pomodoro-overlay />
```

- [ ] **Step 3: Verify manually**

Start a short Pomodoro (e.g. 1 minute) and verify:
1. After 1 minute, the focus-end popup appears
2. "Noch 5 Minuten arbeiten" dismisses it (snooze)
3. "Pause starten" shows the break screen
4. Break screen shows astronaut, progress bar, suggestion
5. "Pause beenden" ends the break
6. When break timer ends, break-end popup appears
7. "Fertig für jetzt" closes everything

- [ ] **Step 4: Commit**

```bash
git add src/app/components/pomodoro-overlay/pomodoro-overlay.ts src/app/app.ts src/app/app.html
git commit -m "feat: add Pomodoro overlay with focus-end, break, and break-end screens"
```

---

## Task 10: Astronaut SVG Animation

**Files:**
- Modify: `src/app/components/pomodoro-overlay/pomodoro-overlay.ts`

- [ ] **Step 1: Replace emoji astronaut with proper SVG**

Replace the astronaut placeholder in the `break-active` template section with a proper SVG astronaut that has idle animations (floating, waving, relaxing). The SVG should:
- Be approximately 120x150px
- Use indigo/stone color palette
- Have a floating animation (8-12s cycle, ease-in-out)
- Cycle through idle poses with CSS animation keyframes
- Include twinkling stars and nebula clouds in the background
- Show Earth curve glow at the bottom
- Respect `prefers-reduced-motion`

This step requires creative SVG work — build the astronaut with basic geometric shapes (circles for helmet, rectangles for body/limbs, rounded corners). Add keyframe animations for:
- `float`: gentle vertical bobbing (8s)
- `wave`: arm raises and lowers (10s)
- `twinkle`: star opacity pulsing (4-6s, varied per star)

- [ ] **Step 2: Verify the animation looks good**

Run `npx ng serve`, start a Pomodoro with a 1-minute focus time, then start the break to see the animation.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/pomodoro-overlay/pomodoro-overlay.ts
git commit -m "feat: add animated astronaut SVG to break screen"
```

---

## Task 11: Sound Effects

**Files:**
- Create: `src/assets/sounds/chime.mp3` (or `.wav`)
- Create: `src/assets/sounds/soft-chime.mp3` (or `.wav`)
- Modify: `src/app/components/pomodoro-overlay/pomodoro-overlay.ts`

- [ ] **Step 1: Add sound files**

Source or generate two short sound files:
- `chime.mp3`: A distinct bell/chime, ~1-2 seconds. For focus session end.
- `soft-chime.mp3`: A softer, gentler tone, ~1-2 seconds. For break end.

Place them in `src/assets/sounds/`.

- [ ] **Step 2: Uncomment and update sound playback**

In `src/app/components/pomodoro-overlay/pomodoro-overlay.ts`, update the `playChime()` and `playSoftChime()` methods to use the actual files:

```typescript
private playChime(): void {
  try {
    this.chimeAudio = new Audio('assets/sounds/chime.mp3');
    this.chimeAudio.play().catch(() => {});
  } catch {}
}

private playSoftChime(): void {
  try {
    this.chimeAudio = new Audio('assets/sounds/soft-chime.mp3');
    this.chimeAudio.play().catch(() => {});
  } catch {}
}
```

- [ ] **Step 3: Commit**

```bash
git add src/assets/sounds/ src/app/components/pomodoro-overlay/pomodoro-overlay.ts
git commit -m "feat: add sound effects for Pomodoro notifications"
```

---

## Task 12: Final Integration Test

- [ ] **Step 1: Run all tests**

Run: `npx ng test --no-watch`
Expected: All tests pass.

- [ ] **Step 2: Full manual walkthrough**

Test the complete flow:
1. Set focus on a ticket → appears in focus section, disappears from ticket list
2. Switch focus to a todo → ticket returns, todo promotes
3. Remove focus → todo returns to list, focus section gone
4. Start Pomodoro (25 min focus, 5 min break) → progress bar appears, timeline block appears
5. Cancel Pomodoro → confirm → everything clears
6. Start a short Pomodoro (1 min) → wait for focus-end popup → snooze → wait again
7. Start break → verify astronaut animation, dimmed app, break suggestion
8. Cancel break early → app returns
9. Start another short Pomodoro → let break run to completion → break-end popup → start new round
10. Collapse Tagesplan → verify progress bar still visible
11. Refresh page during running session → verify session resumes

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Pomodoro timer and focus marker integration"
```
