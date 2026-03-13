# Collapsible Navigator Sections Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add collapse/expand to the three navigator sections with localStorage persistence and unfinished-count badges always visible.

**Architecture:** Three boolean signals in `NavigatorComponent` (initialized from localStorage) drive `[hidden]` on section content and chevron rotation. An `effect()` writes state back to localStorage on every change. No new service or component needed.

**Tech Stack:** Angular 20+ signals, `effect()`, `[hidden]` binding, Tailwind CSS, Karma/Jasmine

---

## Chunk 1: TypeScript logic and template

### Task 1: Write failing tests for `NavigatorComponent` collapse logic

**Files:**
- Create: `src/app/components/navigator/navigator.spec.ts`

- [ ] **Step 1: Create the spec file**

```ts
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Component } from '@angular/core';
import { NavigatorComponent } from './navigator';

describe('NavigatorComponent – collapse logic', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [NavigatorComponent],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  it('defaults all sections to expanded when localStorage is empty', () => {
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    expect(comp.ticketsCollapsed()).toBe(false);
    expect(comp.prsCollapsed()).toBe(false);
    expect(comp.todosCollapsed()).toBe(false);
  });

  it('reads initial collapsed state from localStorage', () => {
    localStorage.setItem(
      'orbit.navigator.collapsed',
      JSON.stringify({ tickets: true, prs: false, todos: true })
    );
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    expect(comp.ticketsCollapsed()).toBe(true);
    expect(comp.prsCollapsed()).toBe(false);
    expect(comp.todosCollapsed()).toBe(true);
  });

  it('falls back to all-expanded when localStorage value is invalid JSON', () => {
    localStorage.setItem('orbit.navigator.collapsed', 'not-json');
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    expect(comp.ticketsCollapsed()).toBe(false);
    expect(comp.prsCollapsed()).toBe(false);
    expect(comp.todosCollapsed()).toBe(false);
  });

  it('persists collapsed state to localStorage when toggleTickets is called', fakeAsync(() => {
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    comp.toggleTickets();
    tick();
    const saved = JSON.parse(localStorage.getItem('orbit.navigator.collapsed')!);
    expect(saved.tickets).toBe(true);
  }));

  it('persists collapsed state to localStorage when togglePrs is called', fakeAsync(() => {
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    comp.togglePrs();
    tick();
    const saved = JSON.parse(localStorage.getItem('orbit.navigator.collapsed')!);
    expect(saved.prs).toBe(true);
  }));

  it('persists collapsed state to localStorage when toggleTodos is called', fakeAsync(() => {
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    comp.toggleTodos();
    tick();
    const saved = JSON.parse(localStorage.getItem('orbit.navigator.collapsed')!);
    expect(saved.todos).toBe(true);
  }));

  it('toggles signal back to false on second call', fakeAsync(() => {
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    comp.toggleTickets();
    tick();
    comp.toggleTickets();
    tick();
    expect(comp.ticketsCollapsed()).toBe(false);
  }));
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
ng test --include="**/navigator.spec.ts" --watch=false
```

Expected: FAIL — `NavigatorComponent` exists but `ticketsCollapsed`, `prsCollapsed`, `todosCollapsed`, `toggleTickets`, `togglePrs`, `toggleTodos` are not yet defined.

---

### Task 2: Add collapse signals and localStorage logic to `NavigatorComponent`

**Files:**
- Modify: `src/app/components/navigator/navigator.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { WorkDataService } from '../../services/work-data.service';
import { WorkItem } from '../../models/work-item.model';
import { TicketCardComponent } from '../ticket-card/ticket-card';
import { PrCardComponent } from '../pr-card/pr-card';
import { TodoCardComponent } from '../todo-card/todo-card';
import { TodoInlineInputComponent } from '../todo-inline-input/todo-inline-input';

const STORAGE_KEY = 'orbit.navigator.collapsed';

interface CollapsedState {
  tickets: boolean;
  prs: boolean;
  todos: boolean;
}

@Component({
  selector: 'app-navigator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TicketCardComponent, PrCardComponent, TodoCardComponent, TodoInlineInputComponent],
  templateUrl: './navigator.html',
  host: { class: 'flex flex-col h-full' },
})
export class NavigatorComponent {
  protected readonly data = inject(WorkDataService);

  private readonly savedCollapsed = this.loadCollapsed();

  ticketsCollapsed = signal(this.savedCollapsed.tickets);
  prsCollapsed = signal(this.savedCollapsed.prs);
  todosCollapsed = signal(this.savedCollapsed.todos);

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tickets: this.ticketsCollapsed(),
        prs: this.prsCollapsed(),
        todos: this.todosCollapsed(),
      }));
    });
  }

  private loadCollapsed(): CollapsedState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as CollapsedState;
    } catch {}
    return { tickets: false, prs: false, todos: false };
  }

  toggleTickets(): void {
    this.ticketsCollapsed.update(v => !v);
  }

  togglePrs(): void {
    this.prsCollapsed.update(v => !v);
  }

  toggleTodos(): void {
    this.todosCollapsed.update(v => !v);
  }

  isSelected(item: WorkItem): boolean {
    return this.data.selectedItem()?.id === item.id;
  }

  selectItem(item: WorkItem): void {
    this.data.select(item);
  }

  toggleTodo(id: string): void {
    this.data.toggleTodo(id);
  }

  addTodo(title: string): void {
    this.data.addTodo(title);
  }
}
```

- [ ] **Step 2: Run the tests — they should now pass**

```bash
ng test --include="**/navigator.spec.ts" --watch=false
```

Expected: All 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/navigator/navigator.ts src/app/components/navigator/navigator.spec.ts
git commit -m "feat: Add collapse signals and localStorage persistence to NavigatorComponent"
```

---

### Task 3: Update the navigator template

**Files:**
- Modify: `src/app/components/navigator/navigator.html`

- [ ] **Step 1: Replace the template with the updated version**

Key changes:
- Each `<section>` header row becomes a `<button type="button">` with `aria-expanded` and `aria-controls`
- Chevron SVG added to the right of each header; rotates `-90deg` when collapsed via Tailwind class
- Section content wrapped in a `<div>` with `[hidden]` and matching `id`
- Tickets badge added (indigo, matches Todos style)
- `bg-stone-100` background on header when collapsed

```html
<nav class="flex flex-col h-full" aria-label="Arbeits-Navigator">
  <div class="px-4 py-3 border-b border-stone-200">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center shrink-0" aria-hidden="true">
          <div class="w-2.5 h-2.5 rounded-full border-2 border-white"></div>
        </div>
        <span class="font-semibold text-stone-800 text-sm tracking-wide">Orbit</span>
      </div>
      <span class="text-xs text-stone-400">Dein Command Center</span>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto px-3 py-4 space-y-6">

    <section aria-labelledby="tickets-heading">
      <button
        type="button"
        class="flex items-center justify-between w-full mb-2 px-1 py-1 rounded-md transition-colors duration-100 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        [class.bg-stone-100]="ticketsCollapsed()"
        (click)="toggleTickets()"
        [attr.aria-expanded]="!ticketsCollapsed()"
        aria-controls="navigator-tickets-content"
      >
        <div class="flex items-center gap-2">
          <h2 id="tickets-heading" class="text-xs font-semibold text-stone-500 uppercase tracking-wider">Aktuelle Tickets</h2>
          @if (data.tickets().length > 0) {
            <span
              class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold"
              [attr.aria-label]="data.tickets().length + ' aktive Tickets'"
            >{{ data.tickets().length }}</span>
          }
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-stone-400">Jira</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12" height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-stone-400 transition-transform duration-100 [@media(prefers-reduced-motion:reduce)]:transition-none"
            [class.-rotate-90]="ticketsCollapsed()"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      </button>
      <div id="navigator-tickets-content" [hidden]="ticketsCollapsed()">
        <ul class="space-y-1.5" role="list">
          @for (ticket of data.tickets(); track ticket.id) {
            <li>
              <app-ticket-card
                [ticket]="ticket"
                [selected]="isSelected(ticket)"
                (select)="selectItem($event)"
              />
            </li>
          }
        </ul>
      </div>
    </section>

    <section aria-labelledby="prs-heading">
      <button
        type="button"
        class="flex items-center justify-between w-full mb-2 px-1 py-1 rounded-md transition-colors duration-100 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        [class.bg-stone-100]="prsCollapsed()"
        (click)="togglePrs()"
        [attr.aria-expanded]="!prsCollapsed()"
        aria-controls="navigator-prs-content"
      >
        <div class="flex items-center gap-2">
          <h2 id="prs-heading" class="text-xs font-semibold text-stone-500 uppercase tracking-wider">Pull Requests</h2>
          @if (data.awaitingReviewCount() > 0) {
            <span
              class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold"
              [attr.aria-label]="data.awaitingReviewCount() + ' ausstehende Reviews'"
            >{{ data.awaitingReviewCount() }}</span>
          }
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-stone-400">Bitbucket</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12" height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-stone-400 transition-transform duration-100 [@media(prefers-reduced-motion:reduce)]:transition-none"
            [class.-rotate-90]="prsCollapsed()"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      </button>
      <div id="navigator-prs-content" [hidden]="prsCollapsed()">
        <ul class="space-y-1.5" role="list">
          @for (pr of data.pullRequests(); track pr.id) {
            <li>
              <app-pr-card
                [pr]="pr"
                [selected]="isSelected(pr)"
                (select)="selectItem($event)"
              />
            </li>
          }
        </ul>
      </div>
    </section>

    <section aria-labelledby="todos-heading">
      <button
        type="button"
        class="flex items-center justify-between w-full mb-2 px-1 py-1 rounded-md transition-colors duration-100 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        [class.bg-stone-100]="todosCollapsed()"
        (click)="toggleTodos()"
        [attr.aria-expanded]="!todosCollapsed()"
        aria-controls="navigator-todos-content"
      >
        <div class="flex items-center gap-2">
          <h2 id="todos-heading" class="text-xs font-semibold text-stone-500 uppercase tracking-wider">Meine Todos</h2>
          @if (data.pendingTodoCount() > 0) {
            <span
              class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold"
              [attr.aria-label]="data.pendingTodoCount() + ' offene Todos'"
            >{{ data.pendingTodoCount() }}</span>
          }
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12" height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-stone-400 transition-transform duration-100 [@media(prefers-reduced-motion:reduce)]:transition-none"
          [class.-rotate-90]="todosCollapsed()"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      <div id="navigator-todos-content" [hidden]="todosCollapsed()">
        <app-todo-inline-input (add)="addTodo($event)" class="block mb-2" />
        <ul class="space-y-1.5" role="list">
          @for (todo of data.todos(); track todo.id) {
            <li>
              <app-todo-card
                [todo]="todo"
                [selected]="isSelected(todo)"
                [highlighted]="data.lastAddedId() === todo.id"
                (select)="selectItem($event)"
                (toggle)="toggleTodo($event)"
              />
            </li>
          }
        </ul>
      </div>
    </section>

  </div>
</nav>
```

- [ ] **Step 2: Run the full test suite to confirm nothing is broken**

```bash
ng test --watch=false
```

Expected: All tests PASS (navigator spec + existing app spec).

- [ ] **Step 3: Build to confirm no TypeScript or template errors**

```bash
ng build
```

Expected: Build completes with no errors.

- [ ] **Step 4: Manually verify in the browser**

```bash
ng serve
```

Open the app. Verify:
- All three sections start expanded
- Clicking a section header collapses it; chevron points right
- Clicking again expands it; chevron points down
- Badge remains visible when collapsed and count matches items shown in expanded state
- Reload the page — collapsed state is preserved
- Open DevTools → Application → localStorage → confirm `orbit.navigator.collapsed` key exists

- [ ] **Step 5: Commit**

```bash
git add src/app/components/navigator/navigator.html
git commit -m "feat: Add collapsible sections to navigator with badges and chevron"
```
