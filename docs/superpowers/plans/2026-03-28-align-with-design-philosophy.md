# Align with Design Philosophy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move action buttons from the calendar sidebar into the workbench detail views with a collapsing header, and sort the PR list by urgency with new badges.

**Architecture:** Two independent changes. Change 1 creates a shared action bar and compact header bar, integrates them into all four detail views, and removes the action rail from the calendar sidebar. Change 2 refactors PR sorting in BitbucketService, extends the PR card with new states/badges, adds diffstat fetching for the "Kleine Änderung" badge, and splits the navigator PR list into two labeled subgroups.

**Tech Stack:** Angular 21 (signals, OnPush, standalone components), Vitest, Express BFF, Bitbucket REST API

**Spec:** `docs/superpowers/specs/2026-03-28-align-with-design-philosophy-design.md`

---

## File Structure

### Change 1: Collapsing Header with Action Bar

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/app/components/detail-action-bar/detail-action-bar.ts` | Shared action bar showing context-dependent buttons per item type |
| Create | `src/app/components/compact-header-bar/compact-header-bar.ts` | Thin 36px sticky bar with truncated title + status badge |
| Modify | `src/app/components/ticket-detail/ticket-detail.ts` | Add action bar below header, add compact bar with scroll logic |
| Modify | `src/app/components/pr-detail/pr-detail.ts` | Same integration |
| Modify | `src/app/components/todo-detail/todo-detail.ts` | Same integration |
| Modify | `src/app/components/idea-detail/idea-detail.ts` | Same integration |
| Modify | `src/app/components/day-calendar-panel/day-calendar-panel.ts` | Remove ActionRailComponent import and usage |
| Delete | `src/app/components/action-rail/action-rail.ts` | Replaced by detail-action-bar |

### Change 2: PR Sorting by Urgency

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/app/utils/business-days.ts` | Business day calculation (Mon-Fri) |
| Modify | `server/routes/bitbucket.ts` | Add `/diffstat/:projectKey/:repoSlug/:prId` endpoint |
| Modify | `src/app/models/work-item.model.ts` | Add `diffstat` field to PullRequest interface |
| Modify | `src/app/services/bitbucket.service.ts` | Fetch diffstat, new sorting logic with two groups |
| Modify | `src/app/components/pr-card/pr-card.ts` | Add red attention state, new badges |
| Modify | `src/app/components/navigator/navigator.html` | Two subgroup labels, split @for loops |
| Modify | `src/app/components/navigator/navigator.ts` | Two computed signals for reviewer/authored PRs |
| Modify | `src/styles/tokens.css` | Add `--color-card-attention-bar-danger` token |

---

## Task 1: Create DetailActionBarComponent

**Files:**
- Create: `src/app/components/detail-action-bar/detail-action-bar.ts`
- Test: `src/app/components/detail-action-bar/detail-action-bar.spec.ts`

This component replaces the action-rail. It receives a WorkItem input and shows context-dependent buttons.

- [ ] **Step 1: Write failing test for todo actions**

```typescript
// detail-action-bar.spec.ts
import { TestBed } from '@angular/core/testing';
import { DetailActionBarComponent } from './detail-action-bar';
import { TodoService } from '../../services/todo.service';
import { IdeaService } from '../../services/idea.service';
import { FocusService } from '../../services/focus.service';
import { WorkspaceService } from '../../services/workspace.service';
import { CosiReviewService } from '../../services/cosi-review.service';
import { Todo } from '../../models/work-item.model';

describe('DetailActionBarComponent', () => {
  function setup(item: unknown) {
    TestBed.configureTestingModule({
      imports: [DetailActionBarComponent],
      providers: [
        { provide: TodoService, useValue: { update: vi.fn() } },
        { provide: IdeaService, useValue: { update: vi.fn() } },
        { provide: FocusService, useValue: { focusedItem: () => null, setFocus: vi.fn(), clearFocus: vi.fn() } },
        { provide: WorkspaceService, useValue: { selectedItem: { set: vi.fn() }, promoteToTodo: vi.fn(), demoteToIdea: vi.fn() } },
        { provide: CosiReviewService, useValue: { triggerReview: vi.fn(), status: () => 'idle' } },
      ],
    });
    const fixture = TestBed.createComponent(DetailActionBarComponent);
    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows todo open actions', () => {
    const todo: Todo = { type: 'todo', id: '1', title: 'Test', description: '', status: 'open', urgent: false, order: 0, createdAt: '' };
    const { el } = setup(todo);
    expect(el.textContent).toContain('Fokus setzen');
    expect(el.textContent).toContain('Erledigt');
    expect(el.textContent).toContain('Dringend');
    expect(el.textContent).toContain('Zur Idee machen');
    expect(el.textContent).toContain('Nicht erledigen');
  });

  it('shows ticket actions', () => {
    const ticket = { type: 'ticket', key: 'PROJ-1', url: 'http://jira/PROJ-1', summary: 'Test' };
    const { el } = setup(ticket);
    expect(el.textContent).toContain('Fokus setzen');
    expect(el.textContent).toContain('In Jira öffnen');
  });

  it('shows pr actions', () => {
    const pr = { type: 'pr', id: 'p1', title: 'Test PR', url: 'http://bb/pr/1' };
    const { el } = setup(pr);
    expect(el.textContent).toContain('Fokus setzen');
    expect(el.textContent).toContain('In Bitbucket öffnen');
  });

  it('shows idea actions', () => {
    const idea = { type: 'idea', id: '1', title: 'Test', description: '', status: 'active', order: 0, createdAt: '' };
    const { el } = setup(idea);
    expect(el.textContent).toContain('Fokus setzen');
    expect(el.textContent).toContain('Zur Aufgabe machen');
    expect(el.textContent).toContain('Nicht verfolgen');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --no-watch`
Expected: FAIL — DetailActionBarComponent does not exist

- [ ] **Step 3: Implement DetailActionBarComponent**

Create `src/app/components/detail-action-bar/detail-action-bar.ts`. Port the template and logic from `action-rail.ts` (lines 13-191). Key changes:
- Add `item = input.required<WorkItem>()` instead of reading from WorkspaceService
- Keep the same injected services: `TodoService`, `IdeaService`, `FocusService`, `WorkspaceService`, `CosiReviewService`
- Keep all type guard methods and action methods (completeTodo, toggleUrgent, wontDo, reopenTodo, wontFollowIdea, reviveIdea, toggleFocus)
- Change host class to `'flex items-center gap-1.5 px-4 py-2 bg-[var(--color-bg-surface)] border-b border-[var(--color-border-default)]'`
- Layout buttons horizontally with flex-wrap
- Add a divider `<div class="w-px h-[18px] bg-[var(--color-border-default)]"></div>` between primary and secondary actions
- Focus button: use `computed(() => this.focusService.focusedItem()?.id === this.item().id)` to determine toggle state
- Button styles follow spec: primary uses `bg-[var(--color-primary-solid)] text-white`, success uses `bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-text)]/20`, etc.

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { WorkItem, Todo, Idea, JiraTicket, PullRequest } from '../../models/work-item.model';
import { TodoService } from '../../services/todo.service';
import { IdeaService } from '../../services/idea.service';
import { FocusService } from '../../services/focus.service';
import { WorkspaceService } from '../../services/workspace.service';
import { CosiReviewService } from '../../services/cosi-review.service';

@Component({
  selector: 'app-detail-action-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex items-center gap-1.5 flex-wrap px-4 py-2 bg-[var(--color-bg-surface)] border-b border-[var(--color-border-default)]',
  },
  template: `
    @if (item(); as item) {
      <!-- Focus button (all types) -->
      @if (isFocused()) {
        <button (click)="toggleFocus()" class="action-btn bg-[var(--color-bg-surface)] text-[var(--color-text-body)] border border-[var(--color-border-default)]">
          ★ Fokus entfernen
        </button>
      } @else {
        <button (click)="toggleFocus()" class="action-btn bg-[var(--color-primary-solid)] text-white">
          ☆ Fokus setzen
        </button>
      }

      @switch (item.type) {
        @case ('todo') {
          @if (asTodo(item).status === 'open') {
            <button (click)="completeTodo()" class="action-btn bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-text)]/20">
              ✓ Erledigt
            </button>
            <div class="w-px h-[18px] bg-[var(--color-border-default)]"></div>
            <button (click)="toggleUrgent()" [class]="asTodo(item).urgent
              ? 'action-btn bg-[var(--color-signal-bg)] text-[var(--color-signal-text)] border border-[var(--color-signal-text)]/20'
              : 'action-btn bg-[var(--color-bg-surface)] text-[var(--color-text-body)] border border-[var(--color-border-default)]'">
              ⚡ Dringend
            </button>
            <button (click)="demoteToIdea()" class="action-btn bg-[var(--color-bg-surface)] text-[var(--color-text-body)] border border-[var(--color-border-default)]">
              → Zur Idee machen
            </button>
            <button (click)="wontDo()" class="action-btn bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-text)]/20">
              ✗ Nicht erledigen
            </button>
          }
          @if (asTodo(item).status === 'done') {
            <button (click)="reopenTodo()" class="action-btn bg-[var(--color-bg-surface)] text-[var(--color-text-body)] border border-[var(--color-border-default)]">
              Wieder öffnen
            </button>
            <button (click)="demoteToIdea()" class="action-btn bg-[var(--color-bg-surface)] text-[var(--color-text-body)] border border-[var(--color-border-default)]">
              → Zur Idee machen
            </button>
          }
          @if (asTodo(item).status === 'wont-do') {
            <button (click)="reopenTodo()" class="action-btn bg-[var(--color-bg-surface)] text-[var(--color-text-body)] border border-[var(--color-border-default)]">
              Wieder öffnen
            </button>
          }
        }
        @case ('idea') {
          @if (asIdea(item).status === 'active') {
            <button (click)="promoteToTodo()" class="action-btn bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-text)]/20">
              → Zur Aufgabe machen
            </button>
            <div class="w-px h-[18px] bg-[var(--color-border-default)]"></div>
            <button (click)="wontFollowIdea()" class="action-btn bg-[var(--color-bg-surface)] text-[var(--color-text-body)] border border-[var(--color-border-default)]">
              ✗ Nicht verfolgen
            </button>
          }
          @if (asIdea(item).status === 'wont-do') {
            <button (click)="reviveIdea()" class="action-btn bg-[var(--color-bg-surface)] text-[var(--color-text-body)] border border-[var(--color-border-default)]">
              Wieder aufgreifen
            </button>
          }
        }
        @case ('ticket') {
          <div class="w-px h-[18px] bg-[var(--color-border-default)]"></div>
          <a [href]="asTicket(item).url" target="_blank" rel="noopener noreferrer"
             class="action-btn bg-[var(--color-bg-surface)] text-[var(--color-text-body)] border border-[var(--color-border-default)]">
            In Jira öffnen ↗
          </a>
        }
        @case ('pr') {
          <div class="w-px h-[18px] bg-[var(--color-border-default)]"></div>
          @if (cosiReview.status() === 'idle' || cosiReview.status() === 'done') {
            <button (click)="cosiReview.triggerReview()" class="action-btn bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-text)]/20">
              🤖 {{ cosiReview.status() === 'done' ? 'Erneut reviewen' : 'KI-Review starten' }}
            </button>
          } @else {
            <button disabled class="action-btn bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-border-default)] opacity-60">
              Review läuft…
            </button>
          }
          <a [href]="asPr(item).url" target="_blank" rel="noopener noreferrer"
             class="action-btn bg-[var(--color-bg-surface)] text-[var(--color-text-body)] border border-[var(--color-border-default)]">
            In Bitbucket öffnen ↗
          </a>
        }
      }
    }
  `,
  styles: [`
    .action-btn {
      @apply text-xs font-semibold px-3 py-1.5 rounded-md whitespace-nowrap cursor-pointer transition-colors;
    }
    .action-btn:disabled {
      @apply cursor-not-allowed;
    }
  `],
})
export class DetailActionBarComponent {
  item = input.required<WorkItem>();

  protected readonly focusService = inject(FocusService);
  protected readonly cosiReview = inject(CosiReviewService);
  private readonly todoService = inject(TodoService);
  private readonly ideaService = inject(IdeaService);
  private readonly workData = inject(WorkspaceService);

  readonly isFocused = computed(() => this.focusService.focusedItem()?.id === this.item().id);

  asTodo(item: unknown): Todo { return item as Todo; }
  asIdea(item: unknown): Idea { return item as Idea; }
  asTicket(item: unknown): JiraTicket { return item as JiraTicket; }
  asPr(item: unknown): PullRequest { return item as PullRequest; }

  toggleFocus() {
    if (this.isFocused()) {
      this.focusService.clearFocus();
    } else {
      this.focusService.setFocus(this.item());
    }
  }

  completeTodo() {
    const updated = { ...this.asTodo(this.item()), status: 'done' as const, completedAt: new Date().toISOString() };
    this.todoService.update(updated);
    this.workData.selectedItem.set(updated);
  }

  toggleUrgent() {
    const todo = this.asTodo(this.item());
    const updated = { ...todo, urgent: !todo.urgent };
    this.todoService.update(updated);
    this.workData.selectedItem.set(updated);
  }

  wontDo() {
    const updated = { ...this.asTodo(this.item()), status: 'wont-do' as const };
    this.todoService.update(updated);
    this.workData.selectedItem.set(updated);
  }

  reopenTodo() {
    const updated = { ...this.asTodo(this.item()), status: 'open' as const, completedAt: undefined };
    this.todoService.update(updated);
    this.workData.selectedItem.set(updated);
  }

  wontFollowIdea() {
    const updated = { ...this.asIdea(this.item()), status: 'wont-do' as const };
    this.ideaService.update(updated);
    this.workData.selectedItem.set(updated);
  }

  reviveIdea() {
    const updated = { ...this.asIdea(this.item()), status: 'active' as const };
    this.ideaService.update(updated);
    this.workData.selectedItem.set(updated);
  }

  promoteToTodo() { this.workData.promoteToTodo(this.asIdea(this.item())); }
  demoteToIdea() { this.workData.demoteToIdea(this.asTodo(this.item())); }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch`

- [ ] **Step 5: Commit**

```bash
git add src/app/components/detail-action-bar/
git commit -m "feat: create DetailActionBarComponent"
```

---

## Task 2: Create CompactHeaderBarComponent

**Files:**
- Create: `src/app/components/compact-header-bar/compact-header-bar.ts`
- Test: `src/app/components/compact-header-bar/compact-header-bar.spec.ts`

A thin 36px sticky bar showing truncated title + status badge. Receives inputs for all display fields.

- [ ] **Step 1: Write failing test**

```typescript
// compact-header-bar.spec.ts
import { TestBed } from '@angular/core/testing';
import { CompactHeaderBarComponent } from './compact-header-bar';

describe('CompactHeaderBarComponent', () => {
  function setup(inputs: { visible: boolean; title: string; statusLabel: string; statusClass: string; stripeColor: string; prefix?: string }) {
    TestBed.configureTestingModule({ imports: [CompactHeaderBarComponent] });
    const fixture = TestBed.createComponent(CompactHeaderBarComponent);
    fixture.componentRef.setInput('visible', inputs.visible);
    fixture.componentRef.setInput('title', inputs.title);
    fixture.componentRef.setInput('statusLabel', inputs.statusLabel);
    fixture.componentRef.setInput('statusClass', inputs.statusClass);
    fixture.componentRef.setInput('stripeColor', inputs.stripeColor);
    if (inputs.prefix) fixture.componentRef.setInput('prefix', inputs.prefix);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('hides when not visible', () => {
    const { el } = setup({ visible: false, title: 'Test', statusLabel: 'Open', statusClass: '', stripeColor: 'bg-violet-500' });
    const bar = el.querySelector('[data-testid="compact-bar"]') as HTMLElement;
    expect(bar.classList.contains('-translate-y-full')).toBe(true);
  });

  it('shows when visible', () => {
    const { el } = setup({ visible: true, title: 'Test', statusLabel: 'Open', statusClass: '', stripeColor: 'bg-violet-500' });
    const bar = el.querySelector('[data-testid="compact-bar"]') as HTMLElement;
    expect(bar.classList.contains('translate-y-0')).toBe(true);
  });

  it('displays title and prefix', () => {
    const { el } = setup({ visible: true, title: 'Login-Fehler', statusLabel: 'In Arbeit', statusClass: '', stripeColor: 'bg-violet-500', prefix: 'PROJ-142' });
    expect(el.textContent).toContain('PROJ-142');
    expect(el.textContent).toContain('Login-Fehler');
    expect(el.textContent).toContain('In Arbeit');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --no-watch`

- [ ] **Step 3: Implement CompactHeaderBarComponent**

```typescript
// compact-header-bar.ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-compact-header-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block sticky top-0 z-20' },
  template: `
    <div data-testid="compact-bar"
         class="flex items-center gap-2 px-4 h-9 bg-[var(--color-bg-card)] border-b border-[var(--color-border-default)] shadow-sm transition-transform duration-150 ease-out"
         [class.-translate-y-full]="!visible()"
         [class.opacity-0]="!visible()"
         [class.translate-y-0]="visible()"
         [class.opacity-100]="visible()">
      <div class="w-[3px] h-[18px] rounded-sm" [class]="stripeColor()"></div>
      @if (prefix()) {
        <span class="font-mono text-[10px] text-[var(--color-text-muted)] shrink-0">{{ prefix() }}</span>
      }
      <span class="text-xs font-semibold text-[var(--color-text-heading)] truncate min-w-0 flex-1">{{ title() }}</span>
      <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" [class]="statusClass()">{{ statusLabel() }}</span>
    </div>
  `,
})
export class CompactHeaderBarComponent {
  visible = input.required<boolean>();
  title = input.required<string>();
  statusLabel = input.required<string>();
  statusClass = input.required<string>();
  stripeColor = input.required<string>();
  prefix = input<string>('');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch`

- [ ] **Step 5: Commit**

```bash
git add src/app/components/compact-header-bar/
git commit -m "feat: create CompactHeaderBarComponent"
```

---

## Task 3: Integrate into Ticket Detail

**Files:**
- Modify: `src/app/components/ticket-detail/ticket-detail.ts`

Add the compact header bar and action bar to the ticket detail view. Add IntersectionObserver to detect when the full header scrolls out of view.

- [ ] **Step 1: Add imports and signals for scroll state**

In `ticket-detail.ts`, add imports for the new components and a signal for compact bar visibility:

```typescript
// Add to imports array in @Component
imports: [JiraMarkupPipe, SubTaskListComponent, DetailActionBarComponent, CompactHeaderBarComponent],

// Add signal in class body
readonly showCompactBar = signal(false);
private headerSentinel!: ElementRef<HTMLElement>;
```

- [ ] **Step 2: Add compact bar and action bar to template**

Before the existing sticky header, add the compact bar. After the header's closing div, add the action bar. Remove `sticky top-0 z-10` from the existing header (it now scrolls away).

Add at the very top of the template (before the existing header):
```html
<app-compact-header-bar
  [visible]="showCompactBar()"
  [title]="ticket().summary"
  [statusLabel]="ticket().status"
  [statusClass]="statusBadgeClass()"
  [stripeColor]="statusStripeClass()"
  [prefix]="ticket().key"
/>
```

Add a sentinel `<div #headerSentinel></div>` right after the existing header's closing tag.

Add after the sentinel:
```html
<app-detail-action-bar [item]="ticket()" />
```

Remove `sticky top-0 z-10` from the existing header div class, keeping all other classes.

- [ ] **Step 3: Add IntersectionObserver logic**

```typescript
// Add to class
private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('headerSentinel');

constructor() {
  // existing effect for subtask loading...

  afterNextRender(() => {
    const sentinel = this.scrollSentinel()?.nativeElement;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => this.showCompactBar.set(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  });
}
```

Add `afterNextRender` and `DestroyRef` to the imports from `@angular/core`, and `viewChild, ElementRef` if not already imported.

- [ ] **Step 4: Run tests and build**

```bash
npx ng test --no-watch && npx ng build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/components/ticket-detail/
git commit -m "feat: add action bar and compact header to ticket detail"
```

---

## Task 4: Integrate into PR Detail

**Files:**
- Modify: `src/app/components/pr-detail/pr-detail.ts`

Same pattern as ticket detail. The PR detail already has a sticky header.

- [ ] **Step 1: Add imports and compact bar signal**

Add `DetailActionBarComponent, CompactHeaderBarComponent` to imports. Add `showCompactBar = signal(false)`.

- [ ] **Step 2: Add compact bar at top of template, action bar after header, remove sticky from header**

Compact bar inputs:
- `title`: `pr().title`
- `statusLabel`: `statusLabel()` (already a computed)
- `statusClass`: `statusBadgeClass()` (already a computed)
- `stripeColor`: `stripeClass()` (already a computed)
- `prefix`: `pr().fromRef.repository.slug`

Add `#headerSentinel` div after the header. Add `<app-detail-action-bar [item]="pr()" />` after sentinel. Remove `sticky top-0 z-10 shadow-sm` from the existing header.

- [ ] **Step 3: Add IntersectionObserver (same pattern as Task 3)**

Use `viewChild`, `afterNextRender`, `IntersectionObserver` — identical pattern.

- [ ] **Step 4: Run tests and build**

```bash
npx ng test --no-watch && npx ng build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/components/pr-detail/
git commit -m "feat: add action bar and compact header to PR detail"
```

---

## Task 5: Integrate into Todo Detail

**Files:**
- Modify: `src/app/components/todo-detail/todo-detail.ts`

Todo detail currently has no sticky header and no status stripe. The compact bar will use a violet stripe for open, emerald for done, stone for wont-do.

- [ ] **Step 1: Add computed signals for compact bar**

```typescript
readonly statusStripeClass = computed(() => {
  const s = this.todo().status;
  if (s === 'done') return 'bg-emerald-500';
  if (s === 'wont-do') return 'bg-stone-400';
  return 'bg-violet-500';
});

readonly statusLabelText = computed(() => {
  const s = this.todo().status;
  if (s === 'done') return 'Erledigt';
  if (s === 'wont-do') return 'Nicht erledigt';
  return 'Offen';
});
```

Note: `statusBadgeClass()` already exists in the component — reuse it.

- [ ] **Step 2: Add compact bar, sentinel, and action bar to template**

Add at the top of the template:
```html
<app-compact-header-bar
  [visible]="showCompactBar()"
  [title]="todo().title"
  [statusLabel]="statusLabelText()"
  [statusClass]="statusBadgeClass()"
  [stripeColor]="statusStripeClass()"
/>
```

After the existing header section (the `<div class="pb-5 border-b ...">` block):
```html
<div #headerSentinel></div>
<app-detail-action-bar [item]="todo()" />
```

- [ ] **Step 3: Add imports, showCompactBar signal, IntersectionObserver (same pattern)**

- [ ] **Step 4: Run tests and build**

```bash
npx ng test --no-watch && npx ng build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/components/todo-detail/
git commit -m "feat: add action bar and compact header to todo detail"
```

---

## Task 6: Integrate into Idea Detail

**Files:**
- Modify: `src/app/components/idea-detail/idea-detail.ts`

Same pattern. Stripe: amber for active ideas, stone for wont-do.

- [ ] **Step 1: Add computed signals**

```typescript
readonly statusStripeClass = computed(() =>
  this.idea().status === 'wont-do' ? 'bg-stone-400' : 'bg-amber-500'
);

readonly statusLabelText = computed(() =>
  this.idea().status === 'wont-do' ? 'Nicht verfolgt' : 'Aktiv'
);
```

- [ ] **Step 2: Add compact bar, sentinel, action bar to template**

Compact bar `prefix`: `'💡'`. Otherwise same pattern.

- [ ] **Step 3: Add imports, showCompactBar, IntersectionObserver**

- [ ] **Step 4: Run tests and build**

```bash
npx ng test --no-watch && npx ng build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/components/idea-detail/
git commit -m "feat: add action bar and compact header to idea detail"
```

---

## Task 7: Remove Action Rail from Calendar Sidebar

**Files:**
- Modify: `src/app/components/day-calendar-panel/day-calendar-panel.ts`
- Delete: `src/app/components/action-rail/action-rail.ts`

- [ ] **Step 1: Remove ActionRailComponent from day-calendar-panel**

In `day-calendar-panel.ts`:
- Remove `ActionRailComponent` from the `imports` array (line 14)
- Remove `<app-action-rail class="shrink-0 border-b..."/>` from the template (line 46)
- Remove the import statement for `ActionRailComponent`

- [ ] **Step 2: Delete the action-rail component file**

```bash
rm src/app/components/action-rail/action-rail.ts
```

Also check if there's a spec file to remove:
```bash
rm -f src/app/components/action-rail/action-rail.spec.ts
```

- [ ] **Step 3: Search for any remaining references**

Search for `action-rail` or `ActionRailComponent` across the codebase and remove any stale imports.

- [ ] **Step 4: Run tests and build**

```bash
npx ng test --no-watch && npx ng build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove action rail from calendar sidebar"
```

---

## Task 8: Add Danger Attention Token

**Files:**
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Add the red attention bar token**

In `tokens.css`, find the existing `--color-card-attention-bar` token and add a danger variant nearby:

```css
--color-card-attention-bar-danger: theme(colors.red.500);
```

Add the same token in the `.dark` block:
```css
--color-card-attention-bar-danger: theme(colors.red.500);
```

- [ ] **Step 2: Build to verify**

```bash
npx ng build
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens.css
git commit -m "feat: add danger attention bar color token"
```

---

## Task 9: Add Diffstat Endpoint to BFF

**Files:**
- Modify: `server/routes/bitbucket.ts`
- Test: verify via mock server or manual test

The Bitbucket REST API endpoint `/rest/api/latest/projects/{key}/repos/{slug}/pull-requests/{id}/changes` returns file change metadata. We need a BFF route that fetches this and returns a total lines-changed count.

- [ ] **Step 1: Read the existing bitbucket route file to understand patterns**

Read `server/routes/bitbucket.ts` to see how other endpoints are structured (auth injection, error handling, response mapping).

- [ ] **Step 2: Add diffstat endpoint**

Add a new route that fetches PR changes and sums up line counts. Follow the existing pattern for auth header injection and error handling. The Bitbucket `/changes` endpoint returns `values[].path` and line count info. Alternatively use the `/diff` endpoint with `?contextLines=0` and count +/- lines, or use the simpler approach of fetching `/changes?limit=999` which includes `srcPath`, `path`, and `properties` with line info.

The exact endpoint depends on the Bitbucket Server version in use. Check the existing routes in `server/routes/bitbucket.ts` for how the base URL and auth are configured. The new route should:
1. Accept `projectKey`, `repoSlug`, `prId` as URL params
2. Fetch the PR changes from Bitbucket
3. Return `{ additions: number, deletions: number, total: number }`

- [ ] **Step 3: Add mock server response**

Add a matching mock endpoint in the mock Bitbucket server that returns test diffstat data.

- [ ] **Step 4: Test manually or with existing test patterns**

- [ ] **Step 5: Commit**

```bash
git add server/routes/bitbucket.ts mock-server/
git commit -m "feat: add PR diffstat endpoint to BFF"
```

---

## Task 10: Add Diffstat to PullRequest Model and Service

**Files:**
- Modify: `src/app/models/work-item.model.ts`
- Modify: `src/app/services/bitbucket.service.ts`

- [ ] **Step 1: Add diffstat to PullRequest interface**

In `work-item.model.ts`, add to the `PullRequest` interface:

```typescript
diffstat?: { additions: number; deletions: number; total: number };
```

- [ ] **Step 2: Fetch diffstat in BitbucketService.loadAll()**

In `bitbucket.service.ts`, after the existing enrichment (activity status + build status), add a third enrichment step that fetches diffstat for each PR. Use the same `forkJoin` + `map` pattern used for build status enrichment (around lines 219-239).

For each PR, call the new BFF endpoint `/api/bitbucket/diffstat/{projectKey}/{repoSlug}/{prId}` and merge the result into the PR object.

- [ ] **Step 3: Run tests and build**

```bash
npx ng test --no-watch && npx ng build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/models/work-item.model.ts src/app/services/bitbucket.service.ts
git commit -m "feat: fetch PR diffstat for small change detection"
```

---

## Task 11: Add Business Day Utility

**Files:**
- Create: `src/app/utils/business-days.ts`
- Test: `src/app/utils/business-days.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// business-days.spec.ts
import { businessDaysSince } from './business-days';

describe('businessDaysSince', () => {
  it('counts only weekdays', () => {
    // Wednesday March 25 to Friday March 28 = 3 business days
    const wed = new Date(2026, 2, 25).getTime();
    const fri = new Date(2026, 2, 28).getTime();
    expect(businessDaysSince(wed, fri)).toBe(3);
  });

  it('skips weekends', () => {
    // Friday March 27 to Monday March 30 = 1 business day (only Friday counts, Mon is "now")
    const fri = new Date(2026, 2, 27).getTime();
    const mon = new Date(2026, 2, 30).getTime();
    expect(businessDaysSince(fri, mon)).toBe(1);
  });

  it('returns 0 for same day', () => {
    const now = new Date(2026, 2, 28).getTime();
    expect(businessDaysSince(now, now)).toBe(0);
  });

  it('handles full week', () => {
    // Monday March 23 to Monday March 30 = 5 business days
    const mon1 = new Date(2026, 2, 23).getTime();
    const mon2 = new Date(2026, 2, 30).getTime();
    expect(businessDaysSince(mon1, mon2)).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch`

- [ ] **Step 3: Implement**

```typescript
// business-days.ts
export function businessDaysSince(timestampMs: number, nowMs: number = Date.now()): number {
  const start = new Date(timestampMs);
  const end = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let count = 0;
  const current = new Date(start);
  while (current < end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch`

- [ ] **Step 5: Commit**

```bash
git add src/app/utils/business-days.ts src/app/utils/business-days.spec.ts
git commit -m "feat: add business day calculation utility"
```

---

## Task 12: Refactor PR Sorting in BitbucketService

**Files:**
- Modify: `src/app/services/bitbucket.service.ts`
- Modify: `src/app/services/bitbucket.service.spec.ts` (add/update sorting tests)

Replace the single `pullRequests` computed with two: `reviewPullRequests` and `myPullRequests`.

- [ ] **Step 1: Write failing tests for new sorting**

```typescript
// Add to bitbucket.service.spec.ts
describe('PR sorting', () => {
  it('sorts review PRs: waiting longest first, already reviewed last', () => {
    // Setup PRs with different wait times and review statuses
    // Assert order: long-waiting > normal > already-reviewed
  });

  it('sorts my PRs: build fail > changes requested > approved > in review', () => {
    // Setup authored PRs with different states
    // Assert the exact order
  });

  it('marks already-reviewed PRs when another reviewer approved', () => {
    // Setup PR where reviewer A approved, user is reviewer B
    // Assert PR appears in review list with 'Approved by Others' status
  });
});
```

Write concrete test implementations using the existing mock PR factory patterns from the spec file (lines 26-65).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch`

- [ ] **Step 3: Replace sorting logic**

In `bitbucket.service.ts`, replace the single `pullRequests` computed (lines 157-172) with two new computed signals:

```typescript
import { businessDaysSince } from '../utils/business-days';

readonly reviewPullRequests = computed(() => {
  const prs = this._rawPullRequests().filter(pr => !pr.isAuthoredByMe && pr.state === 'OPEN');

  const sortOrder = (pr: PullRequest): number => {
    if (pr.myReviewStatus === 'Approved by Others') return 3;
    const days = businessDaysSince(pr.createdDate);
    if (days >= 2 && pr.myReviewStatus !== 'Approved by Others') return 0;
    return 1;
  };

  return prs.sort((a, b) => {
    const orderDiff = sortOrder(a) - sortOrder(b);
    if (orderDiff !== 0) return orderDiff;
    return a.createdDate - b.createdDate; // oldest first within same priority
  });
});

readonly myPullRequests = computed(() => {
  const prs = this._rawPullRequests().filter(pr => pr.isAuthoredByMe && pr.state === 'OPEN');

  const sortOrder = (pr: PullRequest): number => {
    if (pr.buildStatus && pr.buildStatus.failed > 0) return 0;
    if (pr.myReviewStatus === 'Changes Requested' || pr.myReviewStatus === 'Needs Re-review') return 1;
    if (pr.myReviewStatus === 'Ready to Merge' || pr.myReviewStatus === 'Approved') return 2;
    return 3;
  };

  return prs.sort((a, b) => sortOrder(a) - sortOrder(b));
});

// Keep a combined signal for backward compatibility (e.g. awaitingReviewCount)
readonly pullRequests = computed(() => [...this.reviewPullRequests(), ...this.myPullRequests()]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch`

- [ ] **Step 5: Commit**

```bash
git add src/app/services/bitbucket.service.ts src/app/services/bitbucket.service.spec.ts
git commit -m "feat: refactor PR sorting into two groups by urgency"
```

---

## Task 13: Update PR Card with Red Attention and New Badges

**Files:**
- Modify: `src/app/components/pr-card/pr-card.ts`
- Modify: `src/app/components/pr-card/pr-card.spec.ts` (if exists)

- [ ] **Step 1: Add red attention state to cardState computed**

In the `cardState` computed (lines 125-139), the existing `'attention'` return value is used for both amber and red cases. Extend it to distinguish:

```typescript
cardState = computed<'inactive' | 'normal' | 'attention' | 'attention-danger'>(() => {
  const pr = this.pr();
  if (pr.state === 'MERGED' || pr.state === 'DECLINED') return 'inactive';
  if (!pr.isAuthoredByMe && pr.myReviewStatus === 'Approved by Others') return 'inactive';

  if (pr.isAuthoredByMe) {
    if (pr.buildStatus && pr.buildStatus.failed > 0) return 'attention-danger';
    if (pr.myReviewStatus === 'Needs Re-review') return 'attention';
    if (pr.myReviewStatus === 'Changes Requested') return 'attention';
  }

  if (!pr.isAuthoredByMe) {
    const days = businessDaysSince(pr.createdDate);
    if (days >= 2 && pr.myReviewStatus !== 'Approved by Others') return 'attention';
  }

  return 'normal';
});
```

- [ ] **Step 2: Update cardClasses to handle attention-danger**

In the `cardClasses` computed (lines 141-159), add handling for the new state:

```typescript
if (state === 'attention-danger') {
  classes += ' border-l-4 border-l-[var(--color-card-attention-bar-danger)]';
  classes = classes.replace('rounded-lg', 'rounded-r-lg rounded-l-none');
}
```

- [ ] **Step 3: Add new badge computed signals**

```typescript
import { businessDaysSince } from '../../utils/business-days';

readonly isSmallChange = computed(() => {
  const ds = this.pr().diffstat;
  return ds ? ds.total < 50 : false;
});

readonly waitingDays = computed(() => {
  if (this.pr().isAuthoredByMe) return 0;
  return businessDaysSince(this.pr().createdDate);
});

readonly showChangesRequested = computed(() =>
  this.pr().isAuthoredByMe &&
  (this.pr().myReviewStatus === 'Changes Requested' || this.pr().myReviewStatus === 'Needs Re-review')
);

readonly showBuildFailed = computed(() =>
  this.pr().isAuthoredByMe && (this.pr().buildStatus?.failed ?? 0) > 0
);

readonly showAlreadyReviewed = computed(() =>
  !this.pr().isAuthoredByMe && this.pr().myReviewStatus === 'Approved by Others'
);

readonly showApproved = computed(() =>
  this.pr().isAuthoredByMe &&
  (this.pr().myReviewStatus === 'Ready to Merge' || this.pr().myReviewStatus === 'Approved')
);
```

- [ ] **Step 4: Add badges to template**

In the badges area of the template, add the new badges after the existing "Mein PR" / "Entwurf" badges:

```html
@if (showBuildFailed()) {
  <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]">
    ✗ Build fehlgeschlagen
  </span>
}
@if (showChangesRequested()) {
  <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-signal-bg)] text-[var(--color-signal-text)]">
    Änderungen angefordert
  </span>
}
@if (waitingDays() >= 2 && !showAlreadyReviewed()) {
  <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-signal-bg)] text-[var(--color-signal-text)]">
    Review seit {{ waitingDays() }} Tagen
  </span>
}
@if (showAlreadyReviewed()) {
  <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-success-bg)] text-[var(--color-success-text)]">
    ✓ Bereits reviewed
  </span>
}
@if (showApproved()) {
  <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-success-bg)] text-[var(--color-success-text)]">
    ✓ Approved
  </span>
}
@if (isSmallChange()) {
  <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-success-bg)] text-[var(--color-success-text)]">
    Kleine Änderung
  </span>
}
```

- [ ] **Step 5: Run tests and build**

```bash
npx ng test --no-watch && npx ng build
```

- [ ] **Step 6: Commit**

```bash
git add src/app/components/pr-card/
git commit -m "feat: add red attention state and urgency badges to PR cards"
```

---

## Task 14: Split Navigator PR List into Two Subgroups

**Files:**
- Modify: `src/app/components/navigator/navigator.ts`
- Modify: `src/app/components/navigator/navigator.html`

- [ ] **Step 1: Add two computed signals in navigator.ts**

Replace the single `filteredPullRequests` computed with two:

```typescript
readonly filteredReviewPrs = computed(() =>
  this.data.reviewPullRequests().filter(p => !this.focusService.isFocused(p.id))
);

readonly filteredMyPrs = computed(() =>
  this.data.myPullRequests().filter(p => !this.focusService.isFocused(p.id))
);
```

Expose `reviewPullRequests` and `myPullRequests` from `WorkspaceService` (which gets them from `BitbucketService`). In `workspace.service.ts`, add:

```typescript
readonly reviewPullRequests = this.bitbucket.reviewPullRequests;
readonly myPullRequests = this.bitbucket.myPullRequests;
```

- [ ] **Step 2: Update navigator.html PR section**

Replace the single `@for` loop (lines 142-154) with two subgroups:

```html
<div id="navigator-prs-content" [hidden]="prsCollapsed()">
  @if (data.pullRequestsLoading()) {
    <p class="px-4 py-3 text-sm text-[var(--color-text-muted)]">Pull Requests werden geladen…</p>
  } @else if (data.pullRequestsError()) {
    <p role="alert" class="px-4 py-3 text-sm text-[var(--color-danger-text)]">Pull Requests konnten nicht geladen werden.</p>
  } @else {
    @if (filteredReviewPrs().length > 0) {
      <div class="px-3 pt-3 pb-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] tracking-wide">
        Wartet auf dein Review
      </div>
      <ul class="space-y-1.5 px-1" role="list">
        @for (pr of filteredReviewPrs(); track pr.id) {
          <li>
            <app-pr-card [pr]="pr" [selected]="isSelected(pr)" (select)="selectItem($event)" />
          </li>
        }
      </ul>
    }
    @if (filteredMyPrs().length > 0) {
      <div class="px-3 pt-3 pb-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] tracking-wide">
        Deine PRs
      </div>
      <ul class="space-y-1.5 px-1" role="list">
        @for (pr of filteredMyPrs(); track pr.id) {
          <li>
            <app-pr-card [pr]="pr" [selected]="isSelected(pr)" (select)="selectItem($event)" />
          </li>
        }
      </ul>
    }
  }
</div>
```

- [ ] **Step 3: Update the PR count badge in the section header**

The navigator section header shows a count badge. Update it to use the total of both groups (or keep using the existing `awaitingReviewCount` — check what the current badge shows and preserve the behavior).

- [ ] **Step 4: Run tests and build**

```bash
npx ng test --no-watch && npx ng build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/components/navigator/ src/app/services/workspace.service.ts
git commit -m "feat: split PR list into two subgroups with smart sorting"
```

---

## Task 15: Final Integration Test

- [ ] **Step 1: Run full test suite**

```bash
npx ng test --no-watch
```

- [ ] **Step 2: Run build**

```bash
npx ng build
```

- [ ] **Step 3: Manual smoke test**

Start the app with mock data (`npm start`) and verify:
1. Select a ticket → action bar visible below header, scroll to see compact bar slide in
2. Select a PR → action bar with KI-Review and Bitbucket link, compact bar on scroll
3. Select a todo → all 5 action buttons visible, compact bar on scroll
4. Select an idea → promote/dismiss buttons visible
5. Calendar sidebar → no action rail, only pomodoro + timeline
6. PR list → two subgroups, urgent items at top, correct badges and attention borders

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes from smoke test"
```
