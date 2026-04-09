# Collapsible Side Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both side panels (Navigator left, Tagesplan right) collapsible with a polished, Sunsama-inspired UX — panels disappear completely when collapsed, subtle toggle buttons in the workbench corners to reopen.

**Architecture:** Collapse state lives in `ViewArbeitComponent` as signals persisted to localStorage. The `<aside>` and calendar panel are conditionally rendered via `@if`. When collapsed, small toggle buttons render inside the workbench wrapper area. Lucide `PanelLeft*`/`PanelRight*` icons indicate the action. The existing calendar collapse (8px strip with single chevron) is replaced entirely.

**Tech Stack:** Angular 21 (signals, zoneless, OnPush), Tailwind CSS 4.1, Lucide Angular icons, Vitest

**Spec:** `docs/superpowers/specs/2026-04-09-collapsible-panels-design.md`

---

## File Map

| File                                                             | Action | Responsibility                                                                          |
| ---------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| `src/app/shared/view-arbeit/view-arbeit.ts`                      | Modify | Add collapse signals, toggle methods, localStorage persistence, Lucide imports          |
| `src/app/shared/view-arbeit/view-arbeit.html`                    | Modify | Conditional rendering of panels, toggle buttons in workbench area                       |
| `src/app/shared/view-arbeit/view-arbeit.spec.ts`                 | Modify | Tests for collapse/expand behavior and persistence                                      |
| `src/app/shared/navigator/navigator.html`                        | Modify | Add collapse button in navigator header                                                 |
| `src/app/shared/navigator/navigator.ts`                          | Modify | Add output event for collapse, Lucide import                                            |
| `src/app/calendar/day-calendar-panel/day-calendar-panel.ts`      | Modify | Remove internal collapse logic entirely, add output + input for collapse, replace icons |
| `src/app/calendar/day-calendar-panel/day-calendar-panel.spec.ts` | Modify | Update tests to match new collapse pattern                                              |

---

### Task 1: Add collapse state and toggle methods to ViewArbeitComponent

**Files:**

- Modify: `src/app/shared/view-arbeit/view-arbeit.ts`
- Test: `src/app/shared/view-arbeit/view-arbeit.spec.ts`

- [ ] **Step 1: Write failing tests for sidebar collapse**

Add these tests to `view-arbeit.spec.ts`:

```typescript
it('should have sidebarCollapsed default to false', () => {
  const fixture = TestBed.createComponent(ViewArbeitComponent);
  expect(fixture.componentInstance.sidebarCollapsed()).toBe(false);
});

it('should toggle sidebarCollapsed', () => {
  const fixture = TestBed.createComponent(ViewArbeitComponent);
  fixture.componentInstance.toggleSidebar();
  expect(fixture.componentInstance.sidebarCollapsed()).toBe(true);
  fixture.componentInstance.toggleSidebar();
  expect(fixture.componentInstance.sidebarCollapsed()).toBe(false);
});

it('should persist sidebarCollapsed to localStorage', () => {
  const fixture = TestBed.createComponent(ViewArbeitComponent);
  fixture.componentInstance.toggleSidebar();
  TestBed.flushEffects();
  expect(localStorage.getItem('orbit.sidebar.collapsed')).toBe('true');
});

it('should restore sidebarCollapsed from localStorage', async () => {
  localStorage.setItem('orbit.sidebar.collapsed', 'true');
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [ViewArbeitComponent],
    providers: [
      { provide: WorkspaceService, useValue: mockWorkspaceService },
      { provide: TodoService, useValue: mockTodoService },
      { provide: IdeaService, useValue: mockIdeaService },
      { provide: AiReviewService, useValue: mockAiReviewService },
      { provide: HttpClient, useValue: { get: () => of([]), post: () => of({}) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ViewArbeitComponent);
  expect(fixture.componentInstance.sidebarCollapsed()).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch`
Expected: FAIL — `sidebarCollapsed` and `toggleSidebar` don't exist yet.

- [ ] **Step 3: Implement collapse state in ViewArbeitComponent**

In `src/app/shared/view-arbeit/view-arbeit.ts`, add signals and toggle methods:

```typescript
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { NavigatorComponent } from '../navigator/navigator';
import { WorkbenchComponent } from '../workbench/workbench';
import { DayCalendarPanelComponent } from '../../calendar/day-calendar-panel/day-calendar-panel';
import { SettingsService } from '../../settings/settings.service';
import {
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucidePanelRightClose,
  LucidePanelRightOpen,
} from '@lucide/angular';

const SIDEBAR_KEY = 'orbit.sidebar.collapsed';
const CALENDAR_KEY = 'orbit.dayCalendar.collapsed';

@Component({
  selector: 'app-view-arbeit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NavigatorComponent,
    WorkbenchComponent,
    DayCalendarPanelComponent,
    LucidePanelLeftClose,
    LucidePanelLeftOpen,
    LucidePanelRightClose,
    LucidePanelRightOpen,
  ],
  templateUrl: './view-arbeit.html',
  host: { class: 'flex flex-1 h-full overflow-hidden' },
})
export class ViewArbeitComponent {
  readonly settingsService = inject(SettingsService);

  readonly sidebarCollapsed = signal(localStorage.getItem(SIDEBAR_KEY) === 'true');
  readonly calendarCollapsed = signal(localStorage.getItem(CALENDAR_KEY) === 'true');

  constructor() {
    effect(() => {
      localStorage.setItem(SIDEBAR_KEY, String(this.sidebarCollapsed()));
    });
    effect(() => {
      localStorage.setItem(CALENDAR_KEY, String(this.calendarCollapsed()));
    });
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  toggleCalendar(): void {
    this.calendarCollapsed.update((v) => !v);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/view-arbeit/view-arbeit.ts src/app/shared/view-arbeit/view-arbeit.spec.ts
git commit -m "feat(view-arbeit): add collapse state signals for sidebar and calendar"
```

---

### Task 2: Update view-arbeit template with conditional rendering and toggle buttons

**Files:**

- Modify: `src/app/shared/view-arbeit/view-arbeit.html`
- Test: `src/app/shared/view-arbeit/view-arbeit.spec.ts`

- [ ] **Step 1: Write failing tests for template behavior**

Add to `view-arbeit.spec.ts`:

```typescript
it('should hide aside when sidebarCollapsed is true', () => {
  const fixture = TestBed.createComponent(ViewArbeitComponent);
  fixture.componentInstance.sidebarCollapsed.set(true);
  fixture.detectChanges();
  const aside = fixture.nativeElement.querySelector('aside[aria-label="Navigator"]');
  expect(aside).toBeNull();
});

it('should show sidebar open button when collapsed', () => {
  const fixture = TestBed.createComponent(ViewArbeitComponent);
  fixture.componentInstance.sidebarCollapsed.set(true);
  fixture.detectChanges();
  const btn = fixture.nativeElement.querySelector('[data-testid="sidebar-open"]');
  expect(btn).toBeTruthy();
});

it('should show calendar open button when calendar collapsed', () => {
  const fixture = TestBed.createComponent(ViewArbeitComponent);
  fixture.componentInstance.calendarCollapsed.set(true);
  fixture.detectChanges();
  const btn = fixture.nativeElement.querySelector('[data-testid="calendar-open"]');
  expect(btn).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch`
Expected: FAIL — aside is always rendered, toggle buttons don't exist.

- [ ] **Step 3: Update the template**

Replace `src/app/shared/view-arbeit/view-arbeit.html` with:

```html
@if (!sidebarCollapsed()) {
<aside
  class="w-[360px] xl:w-[400px] shrink-0 border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-page)] overflow-hidden flex flex-col transition-[width] duration-150 [@media(prefers-reduced-motion:reduce)]:transition-none"
  aria-label="Navigator"
>
  <app-navigator (collapseSidebar)="toggleSidebar()" />
</aside>
}

<div class="flex-1 overflow-hidden flex relative">
  @if (sidebarCollapsed()) {
  <button
    type="button"
    class="absolute top-3 left-3 z-10 p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-bg-surface)] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
    (click)="toggleSidebar()"
    data-testid="sidebar-open"
    aria-label="Navigator einblenden"
  >
    <svg lucidePanelLeftOpen [size]="18" [strokeWidth]="1.75"></svg>
  </button>
  } @if (settingsService.dayCalendarEnabled() && calendarCollapsed()) {
  <button
    type="button"
    class="absolute top-3 right-3 z-10 p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-bg-surface)] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
    (click)="toggleCalendar()"
    data-testid="calendar-open"
    aria-label="Tagesplan einblenden"
  >
    <svg lucidePanelRightOpen [size]="18" [strokeWidth]="1.75"></svg>
  </button>
  }

  <div class="flex-1 overflow-hidden bg-[var(--color-bg-page)]">
    <app-workbench />
  </div>

  @if (settingsService.dayCalendarEnabled() && !calendarCollapsed()) {
  <app-day-calendar-panel (collapseCalendar)="toggleCalendar()" />
  }
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/view-arbeit/view-arbeit.html src/app/shared/view-arbeit/view-arbeit.spec.ts
git commit -m "feat(view-arbeit): conditional panel rendering with toggle buttons"
```

---

### Task 3: Add collapse button to Navigator header

**Files:**

- Modify: `src/app/shared/navigator/navigator.ts`
- Modify: `src/app/shared/navigator/navigator.html`

- [ ] **Step 1: Add output and icon import to NavigatorComponent**

In `src/app/shared/navigator/navigator.ts`:

Add `output` to the Angular import:

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
```

Add `LucidePanelLeftClose` to the Lucide import:

```typescript
import { LucideChevronDown, LucidePanelLeftClose } from '@lucide/angular';
```

Add `LucidePanelLeftClose` to the `imports` array in the component decorator.

Add the output to the class body:

```typescript
readonly collapseSidebar = output();
```

- [ ] **Step 2: Add collapse button to navigator header**

In `src/app/shared/navigator/navigator.html`, modify the header `<div>` (lines 2–9). Replace:

```html
<div class="px-4 py-3 border-b border-[var(--color-border-subtle)]">
  <div class="flex items-center justify-between">
    <span class="font-semibold text-[var(--color-text-heading)] text-sm tracking-wide">Arbeit</span>
    <span class="text-xs text-[var(--color-text-muted)]">Dein Command Center</span>
  </div>
</div>
```

With:

```html
<div class="px-4 py-3 border-b border-[var(--color-border-subtle)]">
  <div class="flex items-center justify-between">
    <span class="font-semibold text-[var(--color-text-heading)] text-sm tracking-wide">Arbeit</span>
    <div class="flex items-center gap-2">
      <span class="text-xs text-[var(--color-text-muted)]">Dein Command Center</span>
      <button
        type="button"
        class="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-bg-surface)] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        (click)="collapseSidebar.emit()"
        data-testid="sidebar-collapse"
        aria-label="Navigator ausblenden"
      >
        <svg lucidePanelLeftClose [size]="16" [strokeWidth]="1.75"></svg>
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Run tests**

Run: `npx ng test --no-watch`
Expected: PASS (existing navigator tests should still pass)

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/navigator/navigator.ts src/app/shared/navigator/navigator.html
git commit -m "feat(navigator): add sidebar collapse button in header"
```

---

### Task 4: Refactor DayCalendarPanelComponent — remove internal collapse, add output

**Files:**

- Modify: `src/app/calendar/day-calendar-panel/day-calendar-panel.ts`
- Modify: `src/app/calendar/day-calendar-panel/day-calendar-panel.spec.ts`

- [ ] **Step 1: Update tests to match new behavior**

Replace `src/app/calendar/day-calendar-panel/day-calendar-panel.spec.ts` with:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { DayCalendarPanelComponent } from './day-calendar-panel';

function setup() {
  TestBed.configureTestingModule({
    imports: [DayCalendarPanelComponent],
    providers: [
      {
        provide: HttpClient,
        useValue: {
          get: (url: string) => {
            if (url.includes('/api/logbuch')) {
              return of([]);
            }
            return of({ date: new Date().toISOString().slice(0, 10), appointments: [] });
          },
          post: () => of({}),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(DayCalendarPanelComponent);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('DayCalendarPanelComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the timeline', () => {
    const { el } = setup();
    const timeline = el.querySelector('app-day-timeline');
    expect(timeline).toBeTruthy();
  });

  it('renders collapse toggle button', () => {
    const { el } = setup();
    const toggle = el.querySelector('[data-testid="collapse-toggle"]');
    expect(toggle).toBeTruthy();
  });

  it('renders header with "Tagesplan"', () => {
    const { el } = setup();
    expect(el.textContent).toContain('Tagesplan');
  });

  it('emits collapseCalendar when toggle is clicked', () => {
    const { fixture, el } = setup();
    const spy = vi.fn();
    fixture.componentInstance.collapseCalendar.subscribe(spy);
    const toggle = el.querySelector<HTMLButtonElement>('[data-testid="collapse-toggle"]');
    toggle!.click();
    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch`
Expected: FAIL — `collapseCalendar` output doesn't exist yet.

- [ ] **Step 3: Refactor DayCalendarPanelComponent**

Replace `src/app/calendar/day-calendar-panel/day-calendar-panel.ts`. Key changes:

- Remove `collapsed` signal, `STORAGE_KEY`, `hostClass` computed, `toggleCollapse()` method
- Remove the `@if (collapsed())` branch (the 8px strip)
- Add `collapseCalendar = output()`
- Replace `LucideChevronLeft`/`LucideChevronRight` with `LucidePanelRightClose`
- Set fixed host class (always expanded — parent handles hiding)
- The collapse toggle button in the header now emits the output instead of toggling internal state

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { LucidePanelRightClose, LucidePlay, LucideSquare } from '@lucide/angular';
import { DayTimelineComponent } from '../day-timeline/day-timeline';
import { AppointmentPopupComponent } from '../appointment-popup/appointment-popup';
import { PomodoroConfigPopupComponent } from '../../pomodoro/pomodoro-config-popup/pomodoro-config-popup';
import { DayScheduleService } from '../day-schedule.service';
import { PomodoroService } from '../../pomodoro/pomodoro.service';
import { SettingsService } from '../../settings/settings.service';
import { DayAppointment } from '../day-schedule.model';

@Component({
  selector: 'app-day-calendar-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucidePanelRightClose,
    LucidePlay,
    LucideSquare,
    DayTimelineComponent,
    AppointmentPopupComponent,
    PomodoroConfigPopupComponent,
  ],
  host: {
    class:
      'w-[260px] shrink-0 border-l border-[var(--color-border-subtle)] bg-[var(--color-bg-page)] flex flex-col',
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    <div
      class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)]"
    >
      <span class="font-semibold text-[var(--color-text-heading)] text-sm tracking-wide"
        >Tagesplan</span
      >
      <button
        type="button"
        class="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-bg-surface)] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        (click)="collapseCalendar.emit()"
        data-testid="collapse-toggle"
        aria-label="Tagesplan ausblenden"
      >
        <svg lucidePanelRightClose [size]="16" [strokeWidth]="1.75"></svg>
      </button>
    </div>
    @if (settingsService.pomodoroEnabled()) {
      <div class="shrink-0 p-3 border-b border-[var(--color-border-subtle)]">
        @if (pomodoro.state() === 'idle') {
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-[var(--color-primary-bg)] border-[var(--color-primary-border)] text-[var(--color-primary-text)] hover:bg-[var(--color-primary-bg-hover)]"
            (click)="showPomodoroConfig.set(true)"
          >
            <svg lucidePlay [size]="12" [strokeWidth]="2.5"></svg>
            Pomodoro starten
          </button>
        } @else if (pomodoro.state() === 'running') {
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-1.5">
              <span class="relative flex h-2 w-2">
                <span
                  class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-primary-solid)] opacity-75"
                ></span>
                <span
                  class="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-primary-solid)]"
                ></span>
              </span>
              <span class="text-xs font-medium text-[var(--color-primary-text)]">Fokus läuft</span>
            </div>
            <span class="text-xs text-[var(--color-text-muted)] tabular-nums">{{
              pomodoroRemainingLabel()
            }}</span>
          </div>
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:border-red-300 hover:text-red-600 hover:bg-red-50"
            (click)="showCancelConfirm.set(true)"
          >
            <svg lucideSquare [size]="12" [strokeWidth]="2.5"></svg>
            Pomodoro abbrechen
          </button>
        }
      </div>
    }
    <div class="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
      <app-day-timeline
        [appointments]="service.appointments()"
        [pomodoroBlock]="pomodoro.timelineBlock()"
        (appointmentCreate)="onCreateRequest($event)"
        (appointmentEdit)="onEditRequest($event)"
        (appointmentUpdate)="onResizeUpdate($event)"
      />
    </div>

    @if (popupState() !== null) {
      <app-appointment-popup
        [appointment]="popupState()!.appointment"
        [isNew]="popupState()!.isNew"
        (save)="onPopupSave($event)"
        (delete)="onPopupDelete($event)"
        (cancel)="popupState.set(null)"
      />
    }

    @if (showPomodoroConfig() && settingsService.pomodoroEnabled()) {
      <app-pomodoro-config-popup
        (started)="showPomodoroConfig.set(false)"
        (cancel)="showPomodoroConfig.set(false)"
      />
    }

    @if (showCancelConfirm()) {
      <div
        class="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
        (click)="showCancelConfirm.set(false)"
      ></div>
      <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          class="bg-[var(--color-bg-card)] rounded-xl shadow-lg p-5 w-[280px] pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Pomodoro abbrechen"
        >
          <h3 class="text-sm font-semibold text-[var(--color-text-heading)] mb-2">
            Pomodoro abbrechen?
          </h3>
          <p class="text-xs text-[var(--color-text-muted)] mb-4">
            Deine aktuelle Fokuszeit wird beendet.
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-lg border border-[var(--color-border-subtle)] text-[var(--color-text-body)] py-2 text-sm font-medium hover:bg-[var(--color-bg-surface)] transition-colors"
              (click)="showCancelConfirm.set(false)"
            >
              Weiterarbeiten
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg bg-red-600 text-white py-2 text-sm font-semibold hover:bg-red-700 transition-colors"
              (click)="confirmCancel()"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DayCalendarPanelComponent {
  readonly service = inject(DayScheduleService);
  readonly pomodoro = inject(PomodoroService);
  readonly settingsService = inject(SettingsService);

  readonly collapseCalendar = output();
  readonly showPomodoroConfig = signal(false);
  readonly showCancelConfirm = signal(false);

  readonly popupState = signal<{ appointment: Partial<DayAppointment>; isNew: boolean } | null>(
    null,
  );

  onCreateRequest(event: { startTime: string; endTime: string }): void {
    this.popupState.set({
      appointment: { startTime: event.startTime, endTime: event.endTime },
      isNew: true,
    });
  }

  onEditRequest(apt: DayAppointment): void {
    this.popupState.set({ appointment: apt, isNew: false });
  }

  onResizeUpdate(apt: DayAppointment): void {
    this.service.updateAppointment(apt);
  }

  onPopupSave(apt: DayAppointment): void {
    if (this.popupState()?.isNew) {
      this.service.addAppointment(apt.title, apt.startTime, apt.endTime);
    } else {
      this.service.updateAppointment(apt);
    }
    this.popupState.set(null);
  }

  onPopupDelete(id: string): void {
    this.service.deleteAppointment(id);
    this.popupState.set(null);
  }

  readonly pomodoroRemainingLabel = computed(() => {
    const mins = Math.ceil(this.pomodoro.remainingMinutes());
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins} Min`;
  });

  confirmCancel(): void {
    this.pomodoro.cancel();
    this.showCancelConfirm.set(false);
  }

  onEscape(): void {
    if (this.showCancelConfirm()) this.showCancelConfirm.set(false);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/calendar/day-calendar-panel/day-calendar-panel.ts src/app/calendar/day-calendar-panel/day-calendar-panel.spec.ts
git commit -m "refactor(day-calendar-panel): remove internal collapse, emit output to parent"
```

---

### Task 5: Update existing tests for changed template structure

**Files:**

- Modify: `src/app/shared/view-arbeit/view-arbeit.spec.ts`

- [ ] **Step 1: Fix the "should render navigator aside" test**

The existing test `'should render navigator aside'` checks for `aside[aria-label="Navigator"]`. This still works when sidebar is not collapsed (default). However, test `'should render navigator, workbench, and day-calendar-panel'` checks for `app-day-calendar-panel` which now depends on `settingsService.dayCalendarEnabled()` AND `!calendarCollapsed()`. Add a mock for `SettingsService` if not already present, ensuring `dayCalendarEnabled` returns `signal(true)`.

Check if `SettingsService` is already mocked in the test. If not, add:

```typescript
import { SettingsService } from '../../settings/settings.service';

const mockSettingsService = {
  dayCalendarEnabled: signal(true),
  pomodoroEnabled: signal(false),
  notizenEnabled: signal(false),
};
```

And add to providers:

```typescript
{ provide: SettingsService, useValue: mockSettingsService },
```

- [ ] **Step 2: Run all tests**

Run: `npx ng test --no-watch`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/shared/view-arbeit/view-arbeit.spec.ts
git commit -m "test(view-arbeit): fix tests for new panel collapse structure"
```

---

### Task 6: Build verification and cleanup

- [ ] **Step 1: Run full test suite**

Run: `npx ng test --no-watch`
Expected: All tests PASS

- [ ] **Step 2: Run production build**

Run: `npx ng build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Run Prettier**

Run: `npx prettier --write "src/app/shared/view-arbeit/**" "src/app/shared/navigator/**" "src/app/calendar/day-calendar-panel/**"`

- [ ] **Step 4: Clean up old localStorage key usage**

The old `orbit.dayCalendar.collapsed` key was read by `DayCalendarPanelComponent` — now it's read by `ViewArbeitComponent`. No migration needed since the key name is the same. Verify by searching for the key:

Run: `grep -r "orbit.dayCalendar.collapsed" src/`
Expected: Only `view-arbeit.ts` references it.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "style: format collapsible panels code"
```

---

## Verification Checklist

1. `npx ng test --no-watch` — all green
2. `npx ng build` — succeeds
3. Manual: click sidebar collapse button → sidebar disappears, `PanelLeftOpen` button appears top-left
4. Manual: click `PanelLeftOpen` → sidebar slides back in
5. Manual: click calendar collapse button → calendar disappears, `PanelRightOpen` button appears top-right
6. Manual: click `PanelRightOpen` → calendar slides back in
7. Manual: collapse both → full workbench width, both toggle buttons visible
8. Manual: reload page → collapse state preserved
9. Manual: dark mode → buttons use correct token colors
10. Manual: `prefers-reduced-motion` → no animation
