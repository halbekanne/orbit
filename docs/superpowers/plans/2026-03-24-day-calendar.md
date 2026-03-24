# Day Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a day calendar with drag-to-create appointments, integrated into the morning flow and visible as a persistent right panel in the Arbeit view.

**Architecture:** A `DayTimelineComponent` handles the timeline grid rendering and pointer-event-based drag interactions (create + resize). An `AppointmentPopupComponent` provides the edit overlay. A `DayScheduleService` manages state via signals and persists to a JSON file through the Express proxy. The existing `ActionRailComponent` is replaced by a `DayCalendarPanelComponent` that combines action buttons with the timeline. The morning flow in `RhythmDetailComponent` gains a new `'calendar-setup'` step between focus and celebration.

**Tech Stack:** Angular 20 (standalone, zoneless, signals), Tailwind CSS, Vitest, Express proxy

**Spec:** `docs/superpowers/specs/2026-03-24-day-calendar-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/app/models/day-schedule.model.ts` | `DayAppointment` and `DaySchedule` interfaces |
| Create | `src/app/services/day-schedule.service.ts` | Signal-based state, CRUD, HTTP persistence, date rollover |
| Create | `src/app/services/day-schedule.service.spec.ts` | Service unit tests |
| Create | `src/app/components/day-timeline/day-timeline.ts` | Timeline grid, drag-to-create, drag-to-resize, current time line |
| Create | `src/app/components/day-timeline/day-timeline.spec.ts` | Timeline component tests |
| Create | `src/app/components/appointment-popup/appointment-popup.ts` | Edit/create popup overlay |
| Create | `src/app/components/appointment-popup/appointment-popup.spec.ts` | Popup component tests |
| Create | `src/app/components/day-calendar-panel/day-calendar-panel.ts` | Right panel wrapper (action buttons + timeline + collapse) |
| Create | `src/app/components/day-calendar-panel/day-calendar-panel.spec.ts` | Panel component tests |
| Modify | `proxy/index.js:110-135` | Add `/api/day-schedule` GET/POST routes |
| Modify | `src/app/views/view-arbeit/view-arbeit.html` | Replace `<app-action-rail />` with `<app-day-calendar-panel />` |
| Modify | `src/app/views/view-arbeit/view-arbeit.ts` | Import `DayCalendarPanelComponent` |
| Modify | `src/app/components/rhythm-detail/rhythm-detail.ts` | Add `'calendar-setup'` view state, page transition animation, "Weiter"/"Fertig" flow |

---

### Task 1: Data Model

**Files:**
- Create: `src/app/models/day-schedule.model.ts`

- [ ] **Step 1: Create the model file**

```typescript
export interface DayAppointment {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

export interface DaySchedule {
  date: string;
  appointments: DayAppointment[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/models/day-schedule.model.ts
git commit -m "feat(day-calendar): add DayAppointment and DaySchedule model"
```

---

### Task 2: Backend Route

**Files:**
- Modify: `proxy/index.js:134-135` (after the logbuch POST route)

- [ ] **Step 1: Add GET and POST routes for `/api/day-schedule`**

Add after the existing logbuch routes (line ~135 in `proxy/index.js`):

```javascript
app.get('/api/day-schedule', async (_req, res) => {
  res.json(await readJson(path.join(ORBIT_DIR, 'day-schedule.json')));
});

app.post('/api/day-schedule', async (req, res) => {
  await writeJson(path.join(ORBIT_DIR, 'day-schedule.json'), req.body);
  res.json(req.body);
});
```

Note: The `readJson` utility returns `[]` when the file doesn't exist. For the day schedule we want an object, not an array. However, the service will handle this — if it gets `[]` or an object with a stale date, it creates a fresh `DaySchedule`. No backend change needed beyond the route.

- [ ] **Step 2: Verify manually**

Run: `curl http://localhost:6201/api/day-schedule` (with proxy running)
Expected: `[]` (empty, file doesn't exist yet — service will handle this)

- [ ] **Step 3: Commit**

```bash
git add proxy/index.js
git commit -m "feat(day-calendar): add /api/day-schedule backend route"
```

---

### Task 3: DayScheduleService

**Files:**
- Create: `src/app/services/day-schedule.service.ts`
- Create: `src/app/services/day-schedule.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/services/day-schedule.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { DayScheduleService } from './day-schedule.service';
import { DaySchedule } from '../models/day-schedule.model';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const emptySchedule: DaySchedule = { date: todayStr(), appointments: [] };

function setup(getData: unknown = emptySchedule) {
  const postSpy = vi.fn().mockReturnValue(of({}));
  const getSpy = vi.fn().mockReturnValue(of(getData));
  TestBed.configureTestingModule({
    providers: [
      DayScheduleService,
      { provide: HttpClient, useValue: { get: getSpy, post: postSpy } },
    ],
  });
  const svc = TestBed.inject(DayScheduleService);
  TestBed.tick();
  return { svc, postSpy, getSpy };
}

describe('DayScheduleService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('loads today schedule on init', () => {
    const schedule: DaySchedule = { date: todayStr(), appointments: [{ id: 'apt-1', title: 'Test', startTime: '09:00', endTime: '10:00' }] };
    const { svc } = setup(schedule);
    expect(svc.appointments().length).toBe(1);
    expect(svc.appointments()[0].title).toBe('Test');
  });

  it('clears appointments when stored date does not match today', () => {
    const stale: DaySchedule = { date: '2025-01-01', appointments: [{ id: 'apt-1', title: 'Old', startTime: '09:00', endTime: '10:00' }] };
    const { svc, postSpy } = setup(stale);
    expect(svc.appointments()).toEqual([]);
    expect(postSpy).toHaveBeenCalled();
  });

  it('handles empty array response from backend (fresh install)', () => {
    const { svc } = setup([]);
    expect(svc.appointments()).toEqual([]);
  });

  it('addAppointment creates appointment with generated id and saves', () => {
    const { svc, postSpy } = setup();
    svc.addAppointment('Daily', '09:00', '09:30');
    expect(svc.appointments().length).toBe(1);
    expect(svc.appointments()[0].title).toBe('Daily');
    expect(svc.appointments()[0].id).toMatch(/^apt-/);
    expect(postSpy).toHaveBeenCalled();
  });

  it('updateAppointment replaces appointment by id and saves', () => {
    const { svc, postSpy } = setup();
    svc.addAppointment('Daily', '09:00', '09:30');
    postSpy.mockClear();
    const apt = svc.appointments()[0];
    svc.updateAppointment({ ...apt, title: 'Updated' });
    expect(svc.appointments()[0].title).toBe('Updated');
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('deleteAppointment removes appointment by id and saves', () => {
    const { svc, postSpy } = setup();
    svc.addAppointment('Daily', '09:00', '09:30');
    postSpy.mockClear();
    const id = svc.appointments()[0].id;
    svc.deleteAppointment(id);
    expect(svc.appointments()).toEqual([]);
    expect(postSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: FAIL — `DayScheduleService` not found

- [ ] **Step 3: Write the service implementation**

Create `src/app/services/day-schedule.service.ts`:

```typescript
import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { DayAppointment, DaySchedule } from '../models/day-schedule.model';

@Injectable({ providedIn: 'root' })
export class DayScheduleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/api/day-schedule`;

  private readonly schedule = signal<DaySchedule>({
    date: this.todayString(),
    appointments: [],
  });

  readonly appointments = computed(() => this.schedule().appointments);

  constructor() {
    this.load();
  }

  addAppointment(title: string, startTime: string, endTime: string): DayAppointment {
    const apt: DayAppointment = {
      id: `apt-${Date.now()}`,
      title,
      startTime,
      endTime,
    };
    this.schedule.update(s => ({
      ...s,
      appointments: [...s.appointments, apt],
    }));
    this.save();
    return apt;
  }

  updateAppointment(apt: DayAppointment): void {
    this.schedule.update(s => ({
      ...s,
      appointments: s.appointments.map(a => a.id === apt.id ? apt : a),
    }));
    this.save();
  }

  deleteAppointment(id: string): void {
    this.schedule.update(s => ({
      ...s,
      appointments: s.appointments.filter(a => a.id !== id),
    }));
    this.save();
  }

  private load(): void {
    this.http.get<DaySchedule | unknown[]>(this.baseUrl).subscribe({
      next: data => {
        if (Array.isArray(data) || !data || (data as DaySchedule).date !== this.todayString()) {
          this.schedule.set({ date: this.todayString(), appointments: [] });
          this.save();
        } else {
          this.schedule.set(data as DaySchedule);
        }
      },
      error: err => console.error('Failed to load day schedule:', err),
    });
  }

  private save(): void {
    this.http.post(this.baseUrl, this.schedule()).subscribe({
      error: err => console.error('Failed to save day schedule:', err),
    });
  }

  private todayString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All DayScheduleService tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/services/day-schedule.service.ts src/app/services/day-schedule.service.spec.ts
git commit -m "feat(day-calendar): add DayScheduleService with CRUD and date rollover"
```

---

### Task 4: AppointmentPopupComponent

**Files:**
- Create: `src/app/components/appointment-popup/appointment-popup.ts`
- Create: `src/app/components/appointment-popup/appointment-popup.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/components/appointment-popup/appointment-popup.spec.ts`:

```typescript
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppointmentPopupComponent } from './appointment-popup';
import { DayAppointment } from '../../models/day-schedule.model';

@Component({
  template: `
    <app-appointment-popup
      [appointment]="appointment()"
      [isNew]="isNew()"
      (save)="onSave($event)"
      (delete)="onDelete($event)"
      (cancel)="onCancel()"
    />
  `,
  imports: [AppointmentPopupComponent],
})
class TestHostComponent {
  appointment = signal<Partial<DayAppointment>>({ startTime: '09:00', endTime: '10:00' });
  isNew = signal(true);
  saved: DayAppointment | null = null;
  deleted: string | null = null;
  cancelled = false;
  onSave(apt: DayAppointment) { this.saved = apt; }
  onDelete(id: string) { this.deleted = id; }
  onCancel() { this.cancelled = true; }
}

describe('AppointmentPopupComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  afterEach(() => TestBed.resetTestingModule());

  it('renders name input with auto-focus attribute', () => {
    const input = el.querySelector<HTMLInputElement>('[data-testid="apt-name"]');
    expect(input).toBeTruthy();
  });

  it('renders Von and Bis time inputs with provided values', () => {
    const von = el.querySelector<HTMLInputElement>('[data-testid="apt-start"]');
    const bis = el.querySelector<HTMLInputElement>('[data-testid="apt-end"]');
    expect(von?.value).toBe('09:00');
    expect(bis?.value).toBe('10:00');
  });

  it('hides delete button when isNew is true', () => {
    const deleteBtn = el.querySelector('[data-testid="apt-delete"]');
    expect(deleteBtn).toBeNull();
  });

  it('shows delete button when isNew is false', () => {
    host.isNew.set(false);
    host.appointment.set({ id: 'apt-1', title: 'Test', startTime: '09:00', endTime: '10:00' });
    fixture.detectChanges();
    const deleteBtn = el.querySelector('[data-testid="apt-delete"]');
    expect(deleteBtn).toBeTruthy();
  });

  it('emits cancel on Escape key', () => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.cancelled).toBe(true);
  });

  it('emits save with form data on save button click', () => {
    const nameInput = el.querySelector<HTMLInputElement>('[data-testid="apt-name"]');
    nameInput!.value = 'Daily';
    nameInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const saveBtn = el.querySelector<HTMLButtonElement>('[data-testid="apt-save"]');
    saveBtn!.click();
    fixture.detectChanges();
    expect(host.saved).toBeTruthy();
    expect(host.saved!.title).toBe('Daily');
    expect(host.saved!.startTime).toBe('09:00');
    expect(host.saved!.endTime).toBe('10:00');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: FAIL — `AppointmentPopupComponent` not found

- [ ] **Step 3: Write the component**

Create `src/app/components/appointment-popup/appointment-popup.ts`:

```typescript
import { ChangeDetectionStrategy, Component, input, output, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DayAppointment } from '../../models/day-schedule.model';

@Component({
  selector: 'app-appointment-popup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  host: {
    '(keydown.escape)': 'cancel.emit()',
  },
  template: `
    <div class="fixed inset-0 bg-black/20 backdrop-blur-sm z-50" (click)="cancel.emit()"></div>
    <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div class="bg-white rounded-xl shadow-lg p-4 w-[280px] pointer-events-auto" (click)="$event.stopPropagation()">
        <h3 class="text-sm font-semibold text-stone-900 mb-3">
          {{ isNew() ? 'Neuer Termin' : 'Termin bearbeiten' }}
        </h3>

        <div class="mb-3">
          <label class="text-[10px] font-medium uppercase tracking-wide text-stone-500 block mb-1">Name</label>
          <input
            type="text"
            class="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-900 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 outline-none"
            [ngModel]="name()"
            (ngModelChange)="name.set($event)"
            data-testid="apt-name"
            (keydown.enter)="onSave()"
            autofocus
          />
        </div>

        <div class="flex gap-2 mb-4">
          <div class="flex-1">
            <label class="text-[10px] font-medium uppercase tracking-wide text-stone-500 block mb-1">Von</label>
            <input
              type="text"
              class="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-900 text-center tabular-nums focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 outline-none"
              [ngModel]="startTime()"
              (ngModelChange)="startTime.set($event)"
              data-testid="apt-start"
            />
          </div>
          <div class="flex-1">
            <label class="text-[10px] font-medium uppercase tracking-wide text-stone-500 block mb-1">Bis</label>
            <input
              type="text"
              class="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-900 text-center tabular-nums focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 outline-none"
              [ngModel]="endTime()"
              (ngModelChange)="endTime.set($event)"
              data-testid="apt-end"
            />
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            [disabled]="!name().trim()"
            (click)="onSave()"
            data-testid="apt-save"
          >Speichern</button>
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-600 bg-stone-100 border border-stone-200 hover:bg-stone-200 transition-colors"
            (click)="cancel.emit()"
            data-testid="apt-cancel"
          >Abbrechen</button>
          @if (!isNew()) {
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors ms-auto"
              (click)="delete.emit(appointment().id!)"
              data-testid="apt-delete"
            >Löschen</button>
          }
        </div>

        <p class="text-[10px] text-stone-400 text-center mt-3">Enter = Speichern · Esc = Abbrechen</p>
      </div>
    </div>
  `,
})
export class AppointmentPopupComponent {
  readonly appointment = input.required<Partial<DayAppointment>>();
  readonly isNew = input(true);

  readonly save = output<DayAppointment>();
  readonly delete = output<string>();
  readonly cancel = output<void>();

  readonly name = signal('');
  readonly startTime = signal('');
  readonly endTime = signal('');

  constructor() {
    effect(() => {
      const apt = this.appointment();
      this.name.set(apt.title ?? '');
      this.startTime.set(apt.startTime ?? '');
      this.endTime.set(apt.endTime ?? '');
    });
  }

  onSave(): void {
    const title = this.name().trim();
    if (!title) return;
    this.save.emit({
      id: this.appointment().id ?? `apt-${Date.now()}`,
      title,
      startTime: this.startTime(),
      endTime: this.endTime(),
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All AppointmentPopupComponent tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/components/appointment-popup/
git commit -m "feat(day-calendar): add AppointmentPopupComponent with create/edit/delete"
```

---

### Task 5: DayTimelineComponent — Grid Rendering

**Files:**
- Create: `src/app/components/day-timeline/day-timeline.ts`
- Create: `src/app/components/day-timeline/day-timeline.spec.ts`

This is the largest component. We split it across Tasks 5–7: rendering first, then drag-to-create, then drag-to-resize.

- [ ] **Step 1: Write the failing tests for grid rendering**

Create `src/app/components/day-timeline/day-timeline.spec.ts`:

```typescript
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { DayTimelineComponent } from './day-timeline';
import { DayAppointment } from '../../models/day-schedule.model';

@Component({
  template: `
    <div style="height: 600px;">
      <app-day-timeline
        [appointments]="appointments()"
        (appointmentCreate)="onCreate($event)"
        (appointmentEdit)="onEdit($event)"
        (appointmentUpdate)="onUpdate($event)"
      />
    </div>
  `,
  imports: [DayTimelineComponent],
})
class TestHostComponent {
  appointments = signal<DayAppointment[]>([]);
  created: { startTime: string; endTime: string } | null = null;
  edited: DayAppointment | null = null;
  updated: DayAppointment | null = null;
  onCreate(e: { startTime: string; endTime: string }) { this.created = e; }
  onEdit(apt: DayAppointment) { this.edited = apt; }
  onUpdate(apt: DayAppointment) { this.updated = apt; }
}

describe('DayTimelineComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  afterEach(() => TestBed.resetTestingModule());

  it('renders hour labels from 08:00 to 17:00', () => {
    const labels = el.querySelectorAll('[data-testid="hour-label"]');
    expect(labels.length).toBe(10);
    expect(labels[0].textContent?.trim()).toBe('08:00');
    expect(labels[9].textContent?.trim()).toBe('17:00');
  });

  it('renders appointment block with title and time', () => {
    host.appointments.set([{ id: 'apt-1', title: 'Daily', startTime: '09:00', endTime: '10:00' }]);
    fixture.detectChanges();
    const block = el.querySelector('[data-testid="appointment-apt-1"]');
    expect(block).toBeTruthy();
    expect(block!.textContent).toContain('Daily');
    expect(block!.textContent).toContain('09:00');
  });

  it('renders current time indicator', () => {
    const indicator = el.querySelector('[data-testid="current-time-line"]');
    expect(indicator).toBeTruthy();
  });

  it('emits appointmentEdit on double-click of appointment', () => {
    host.appointments.set([{ id: 'apt-1', title: 'Daily', startTime: '09:00', endTime: '10:00' }]);
    fixture.detectChanges();
    const block = el.querySelector('[data-testid="appointment-apt-1"]');
    block!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(host.edited).toBeTruthy();
    expect(host.edited!.id).toBe('apt-1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: FAIL — `DayTimelineComponent` not found

- [ ] **Step 3: Write the component (grid rendering + current time + appointment blocks)**

Create `src/app/components/day-timeline/day-timeline.ts`:

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  OnDestroy,
  OnInit,
  ElementRef,
  inject,
} from '@angular/core';
import { DayAppointment } from '../../models/day-schedule.model';

const START_HOUR = 8;
const END_HOUR = 17;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const SLOT_COUNT = TOTAL_MINUTES / 15;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function minutesToPercent(minutes: number): number {
  return ((minutes - START_HOUR * 60) / TOTAL_MINUTES) * 100;
}

@Component({
  selector: 'app-day-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full select-none' },
  styles: `
    .grid-container { position: relative; height: 100%; }
    .hour-row {
      position: absolute;
      left: 0;
      right: 0;
      display: flex;
      align-items: flex-start;
      border-top: 1px solid #f5f5f4;
    }
    .hour-row[data-half] { border-top: 1px dotted #e7e5e4; }
    .hour-label {
      width: 36px;
      flex-shrink: 0;
      font-size: 9px;
      color: #a8a29e;
      padding: 2px 4px 0;
    }
    .appointment-block {
      position: absolute;
      left: 38px;
      right: 4px;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-left: 3px solid #6366f1;
      border-radius: 4px;
      padding: 2px 6px;
      cursor: pointer;
      overflow: hidden;
      z-index: 2;
    }
    .appointment-block:hover { background: #e0e7ff; }
    .current-time-line {
      position: absolute;
      left: 36px;
      right: 4px;
      height: 2px;
      background: #ef4444;
      z-index: 5;
      pointer-events: none;
      border-radius: 1px;
    }
    .current-time-dot {
      position: absolute;
      left: -4px;
      top: -3px;
      width: 8px;
      height: 8px;
      background: #ef4444;
      border-radius: 50%;
    }
    .drag-preview {
      position: absolute;
      left: 38px;
      right: 4px;
      background: #eef2ff;
      border: 1px dashed #818cf8;
      border-radius: 4px;
      z-index: 3;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: #6366f1;
      pointer-events: none;
    }
    .resize-handle {
      position: absolute;
      left: 8px;
      right: 8px;
      height: 6px;
      cursor: ns-resize;
      z-index: 4;
    }
    .resize-handle:hover,
    .resize-handle.active {
      background: #818cf8;
      border-radius: 2px;
      opacity: 0.5;
    }
    .resize-handle-top { top: -1px; }
    .resize-handle-bottom { bottom: -1px; }
  `,
  template: `
    <div
      class="grid-container"
      (pointerdown)="onGridPointerDown($event)"
      (pointermove)="onGridPointerMove($event)"
      (pointerup)="onGridPointerUp($event)"
    >
      @for (hour of hours; track hour) {
        <div
          class="hour-row"
          [style.top.%]="minutesToPercent(hour * 60)"
          [style.height.%]="100 / (END_HOUR - START_HOUR)"
        >
          <span class="hour-label" data-testid="hour-label">{{ formatHour(hour) }}</span>
        </div>
      }

      @for (apt of appointments(); track apt.id) {
        <div
          class="appointment-block"
          [attr.data-testid]="'appointment-' + apt.id"
          [attr.data-appointment-id]="apt.id"
          [style.top.%]="minutesToPercent(timeToMinutes(apt.startTime))"
          [style.height.%]="((timeToMinutes(apt.endTime) - timeToMinutes(apt.startTime)) / TOTAL_MINUTES) * 100"
          (dblclick)="appointmentEdit.emit(apt)"
        >
          <div class="text-[10px] font-medium text-indigo-900 truncate">{{ apt.title }}</div>
          <div class="text-[9px] text-indigo-500">{{ apt.startTime }} – {{ apt.endTime }}</div>
          <div class="resize-handle resize-handle-top" data-resize="top" [attr.data-appointment-id]="apt.id"></div>
          <div class="resize-handle resize-handle-bottom" data-resize="bottom" [attr.data-appointment-id]="apt.id"></div>
        </div>
      }

      @if (dragPreview()) {
        <div
          class="drag-preview"
          [style.top.%]="minutesToPercent(dragPreview()!.startMinutes)"
          [style.height.%]="((dragPreview()!.endMinutes - dragPreview()!.startMinutes) / TOTAL_MINUTES) * 100"
        >
          {{ minutesToTime(dragPreview()!.startMinutes) }} – {{ minutesToTime(dragPreview()!.endMinutes) }}
        </div>
      }

      @if (currentTimePercent() !== null) {
        <div
          class="current-time-line"
          [style.top.%]="currentTimePercent()"
          data-testid="current-time-line"
        >
          <div class="current-time-dot"></div>
        </div>
      }
    </div>
  `,
})
export class DayTimelineComponent implements OnInit, OnDestroy {
  readonly appointments = input<DayAppointment[]>([]);

  readonly appointmentCreate = output<{ startTime: string; endTime: string }>();
  readonly appointmentEdit = output<DayAppointment>();
  readonly appointmentUpdate = output<DayAppointment>();

  protected readonly START_HOUR = START_HOUR;
  protected readonly END_HOUR = END_HOUR;
  protected readonly TOTAL_MINUTES = TOTAL_MINUTES;
  protected readonly hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  protected readonly minutesToPercent = minutesToPercent;
  protected readonly timeToMinutes = timeToMinutes;
  protected readonly minutesToTime = minutesToTime;

  protected readonly currentTimePercent = signal<number | null>(null);
  protected readonly dragPreview = signal<{ startMinutes: number; endMinutes: number } | null>(null);

  private readonly elRef = inject(ElementRef);
  private timeInterval: ReturnType<typeof setInterval> | null = null;
  private dragState: {
    type: 'create' | 'resize-top' | 'resize-bottom';
    startMinutes: number;
    appointmentId?: string;
    originalStart?: number;
    originalEnd?: number;
  } | null = null;

  ngOnInit(): void {
    this.updateCurrentTime();
    this.timeInterval = setInterval(() => this.updateCurrentTime(), 60_000);
  }

  ngOnDestroy(): void {
    if (this.timeInterval) clearInterval(this.timeInterval);
  }

  formatHour(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
  }

  private updateCurrentTime(): void {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    if (minutes < START_HOUR * 60 || minutes > END_HOUR * 60) {
      this.currentTimePercent.set(null);
    } else {
      this.currentTimePercent.set(minutesToPercent(minutes));
    }
  }

  private pointerToMinutes(event: PointerEvent): number {
    const container = this.elRef.nativeElement.querySelector('.grid-container') as HTMLElement;
    const rect = container.getBoundingClientRect();
    const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height));
    const ratio = y / rect.height;
    const rawMinutes = START_HOUR * 60 + ratio * TOTAL_MINUTES;
    const snapped = Math.round(rawMinutes / 15) * 15;
    return Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, snapped));
  }

  onGridPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement;

    const resizeHandle = target.closest('[data-resize]') as HTMLElement | null;
    if (resizeHandle) {
      const direction = resizeHandle.dataset['resize'] as 'top' | 'bottom';
      const aptId = resizeHandle.dataset['appointmentId']!;
      const apt = this.appointments().find(a => a.id === aptId);
      if (!apt) return;
      event.preventDefault();
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      this.dragState = {
        type: direction === 'top' ? 'resize-top' : 'resize-bottom',
        startMinutes: this.pointerToMinutes(event),
        appointmentId: aptId,
        originalStart: timeToMinutes(apt.startTime),
        originalEnd: timeToMinutes(apt.endTime),
      };
      return;
    }

    const aptBlock = target.closest('[data-appointment-id]') as HTMLElement | null;
    if (aptBlock) return;

    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    const minutes = this.pointerToMinutes(event);
    this.dragState = { type: 'create', startMinutes: minutes };
    this.dragPreview.set({ startMinutes: minutes, endMinutes: minutes + 15 });
  }

  onGridPointerMove(event: PointerEvent): void {
    if (!this.dragState) return;
    const currentMinutes = this.pointerToMinutes(event);

    if (this.dragState.type === 'create') {
      const start = Math.min(this.dragState.startMinutes, currentMinutes);
      const end = Math.max(this.dragState.startMinutes, currentMinutes);
      this.dragPreview.set({
        startMinutes: start,
        endMinutes: Math.max(end, start + 15),
      });
    } else if (this.dragState.type === 'resize-top') {
      const newStart = Math.min(currentMinutes, this.dragState.originalEnd! - 15);
      this.dragPreview.set({
        startMinutes: newStart,
        endMinutes: this.dragState.originalEnd!,
      });
    } else if (this.dragState.type === 'resize-bottom') {
      const newEnd = Math.max(currentMinutes, this.dragState.originalStart! + 15);
      this.dragPreview.set({
        startMinutes: this.dragState.originalStart!,
        endMinutes: newEnd,
      });
    }
  }

  onGridPointerUp(_event: PointerEvent): void {
    if (!this.dragState) return;
    const preview = this.dragPreview();
    this.dragPreview.set(null);

    if (!preview || preview.endMinutes - preview.startMinutes < 15) {
      this.dragState = null;
      return;
    }

    if (this.dragState.type === 'create') {
      this.appointmentCreate.emit({
        startTime: minutesToTime(preview.startMinutes),
        endTime: minutesToTime(preview.endMinutes),
      });
    } else {
      const apt = this.appointments().find(a => a.id === this.dragState!.appointmentId);
      if (apt) {
        this.appointmentUpdate.emit({
          ...apt,
          startTime: minutesToTime(preview.startMinutes),
          endTime: minutesToTime(preview.endMinutes),
        });
      }
    }

    this.dragState = null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All DayTimelineComponent tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/components/day-timeline/
git commit -m "feat(day-calendar): add DayTimelineComponent with grid, appointments, drag-to-create, resize"
```

---

### Task 6: DayCalendarPanelComponent

**Files:**
- Create: `src/app/components/day-calendar-panel/day-calendar-panel.ts`
- Create: `src/app/components/day-calendar-panel/day-calendar-panel.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/components/day-calendar-panel/day-calendar-panel.spec.ts`:

```typescript
import { TestBed, ComponentFixture } from '@angular/core/testing';
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
          get: () => of({ date: new Date().toISOString().slice(0, 10), appointments: [] }),
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
  afterEach(() => TestBed.resetTestingModule());

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

  it('hides timeline content when collapsed', () => {
    const { fixture, el } = setup();
    const toggle = el.querySelector<HTMLButtonElement>('[data-testid="collapse-toggle"]');
    toggle!.click();
    fixture.detectChanges();
    const timeline = el.querySelector('app-day-timeline');
    expect(timeline).toBeNull();
  });

  it('renders header with "Tagesplan"', () => {
    const { el } = setup();
    expect(el.textContent).toContain('Tagesplan');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: FAIL — `DayCalendarPanelComponent` not found

- [ ] **Step 3: Write the component**

Create `src/app/components/day-calendar-panel/day-calendar-panel.ts`:

```typescript
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DayTimelineComponent } from '../day-timeline/day-timeline';
import { AppointmentPopupComponent } from '../appointment-popup/appointment-popup';
import { ActionRailComponent } from '../action-rail/action-rail';
import { DayScheduleService } from '../../services/day-schedule.service';
import { DayAppointment } from '../../models/day-schedule.model';

@Component({
  selector: 'app-day-calendar-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DayTimelineComponent, AppointmentPopupComponent, ActionRailComponent],
  host: {
    '[class]': 'collapsed() ? "w-8 shrink-0 border-l border-stone-200 bg-stone-50 flex flex-col" : "w-[260px] shrink-0 border-l border-stone-200 bg-stone-50 flex flex-col transition-[width] duration-150"',
  },
  template: `
    @if (collapsed()) {
      <button
        type="button"
        class="h-full flex items-center justify-center text-stone-400 hover:text-stone-600 cursor-pointer"
        (click)="toggleCollapse()"
        data-testid="collapse-toggle"
        aria-label="Tagesplan einblenden"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
      </button>
    } @else {
      <div class="flex items-center justify-between px-2 py-2 border-b border-stone-100">
        <span class="text-xs font-semibold text-stone-900">Tagesplan</span>
        <button
          type="button"
          class="text-stone-400 hover:text-stone-600 cursor-pointer p-0.5"
          (click)="toggleCollapse()"
          data-testid="collapse-toggle"
          aria-label="Tagesplan ausblenden"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <app-day-timeline
          [appointments]="schedule.appointments()"
          (appointmentCreate)="onCreateRequest($event)"
          (appointmentEdit)="onEditRequest($event)"
          (appointmentUpdate)="onResizeUpdate($event)"
        />
      </div>
    }

    @if (popupState()) {
      <app-appointment-popup
        [appointment]="popupState()!.appointment"
        [isNew]="popupState()!.isNew"
        (save)="onPopupSave($event)"
        (delete)="onPopupDelete($event)"
        (cancel)="popupState.set(null)"
      />
    }
  `,
})
export class DayCalendarPanelComponent {
  protected readonly schedule = inject(DayScheduleService);

  protected readonly collapsed = signal(
    localStorage.getItem('orbit.dayCalendar.collapsed') === 'true'
  );

  protected readonly popupState = signal<{
    appointment: Partial<DayAppointment>;
    isNew: boolean;
  } | null>(null);

  toggleCollapse(): void {
    this.collapsed.update(v => !v);
    localStorage.setItem('orbit.dayCalendar.collapsed', String(this.collapsed()));
  }

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
    this.schedule.updateAppointment(apt);
  }

  onPopupSave(apt: DayAppointment): void {
    const state = this.popupState();
    if (state?.isNew) {
      this.schedule.addAppointment(apt.title, apt.startTime, apt.endTime);
    } else {
      this.schedule.updateAppointment(apt);
    }
    this.popupState.set(null);
  }

  onPopupDelete(id: string): void {
    this.schedule.deleteAppointment(id);
    this.popupState.set(null);
  }
}
```

Note: The user said "the action buttons can live above the calendar in the right panel for now and we deal with it later." The simplest approach: embed `<app-action-rail />` at the top of the expanded panel. Override the host styles by removing the action rail's `host.class` width/shrink/border-l properties and instead applying them via the parent. The action rail component's host class needs to be changed to not include layout-level styles (width, shrink, border-l, bg) — those are now controlled by the panel. Keep only the flex/padding/gap styles on the action rail host. This is a minor modification to `action-rail.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All DayCalendarPanelComponent tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/components/day-calendar-panel/
git commit -m "feat(day-calendar): add DayCalendarPanelComponent with collapse/expand and popup management"
```

---

### Task 7: Integrate Panel into Arbeit View

**Files:**
- Modify: `src/app/views/view-arbeit/view-arbeit.html`
- Modify: `src/app/views/view-arbeit/view-arbeit.ts`

- [ ] **Step 1: Read the current view files**

Read: `src/app/views/view-arbeit/view-arbeit.ts` and `src/app/views/view-arbeit/view-arbeit.html`

- [ ] **Step 2: Replace action rail with day calendar panel in the template**

In `src/app/views/view-arbeit/view-arbeit.html`, replace:

```html
  <app-action-rail />
```

with:

```html
  <app-day-calendar-panel />
```

- [ ] **Step 3: Update the component imports**

In `src/app/views/view-arbeit/view-arbeit.ts`, add `DayCalendarPanelComponent` to the imports array and remove `ActionRailComponent` (if it's no longer used elsewhere — check first; if other views use it, keep the import but remove it from this component's imports).

- [ ] **Step 4: Verify the app compiles**

Run: `npx ng build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/views/view-arbeit/
git commit -m "feat(day-calendar): replace action rail with day calendar panel in Arbeit view"
```

---

### Task 8: Morning Flow Integration

**Files:**
- Modify: `src/app/components/rhythm-detail/rhythm-detail.ts`

This is the most delicate task — modifying the existing morning flow to add the calendar setup step with a journal-like page transition.

- [ ] **Step 1: Read the current RhythmDetailComponent**

Read: `src/app/components/rhythm-detail/rhythm-detail.ts` (already read above, 385 lines)

- [ ] **Step 2: Add the calendar-setup view state and page transition animation**

Add new CSS animations for the page transition:

```css
@keyframes pageOut {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-20px); }
}
@keyframes pageIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.anim-page-out {
  animation: pageOut 400ms ease-out forwards;
}
.anim-page-in {
  animation: pageIn 400ms ease-out forwards;
}
```

- [ ] **Step 3: Update the viewState type and add calendar-setup template**

Expand the `viewState` signal type from `'input' | 'animating' | 'readonly'` to `'input' | 'calendar-setup' | 'animating' | 'readonly'`. Add a `pageTransitioning = signal(false)` for the fade-out animation on the input view.

Add a new `@case ('page-transition')` that shows the old content fading out.

Add a new `@case ('calendar-setup')` block to the template's `@switch`:

```html
@case ('calendar-setup') {
  <div class="h-full flex items-start justify-center pt-12 px-6 anim-page-in">
    <div class="w-full max-w-[520px]">
      <header class="mb-6 text-center">
        <svg class="w-9 h-9 text-indigo-400 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <h1 class="text-xl font-semibold text-stone-900">Tagesplan erstellen</h1>
        <p class="text-sm text-stone-400 mt-1">Wie sieht dein Tag heute aus?</p>
      </header>

      <div class="h-[400px] border border-stone-200 rounded-xl overflow-hidden bg-white">
        <app-day-timeline
          [appointments]="calendarAppointments()"
          (appointmentCreate)="onCalendarCreate($event)"
          (appointmentEdit)="onCalendarEdit($event)"
          (appointmentUpdate)="onCalendarResizeUpdate($event)"
        />
      </div>

      <div class="flex gap-3 mt-4">
        <button
          type="button"
          class="flex-1 rounded-xl px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          (click)="onCalendarDone()"
          data-testid="btn-calendar-done"
        >Fertig</button>
        <button
          type="button"
          class="rounded-xl px-5 py-2.5 text-sm font-medium text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400"
          (click)="onCalendarSkip()"
          data-testid="btn-calendar-skip"
        >Überspringen</button>
      </div>
    </div>
  </div>
}
```

- [ ] **Step 4: Update the submit button text and behavior for morning**

Change the morning submit button text from `'Fokus setzen'` to `'Weiter'`.

Change `onSubmit()` behavior: when `isMorning()`, save the focus quietly (no animation), then transition to the calendar setup step via page transition:

```typescript
onSubmit(): void {
  const value = this.textValue().trim();
  if (!value) return;

  const q = this.question();
  if (this.isMorning()) {
    this.rhythm.saveMorning(value, q);
    this.submitted.emit();
    this.startPageTransition();
  } else {
    this.rhythm.saveEvening(value, q);
    this.submitted.emit();
    this.startAnimation();
  }
}

private startPageTransition(): void {
  this.pageTransitioning.set(true);
  setTimeout(() => {
    this.pageTransitioning.set(false);
    this.viewState.set('calendar-setup');
  }, 400);
}
```

- [ ] **Step 5: Add calendar interaction handlers**

Add to the component class:

```typescript
private readonly daySchedule = inject(DayScheduleService);
readonly calendarAppointments = computed(() => this.daySchedule.appointments());

readonly calendarPopupState = signal<{ appointment: Partial<DayAppointment>; isNew: boolean } | null>(null);

onCalendarCreate(event: { startTime: string; endTime: string }): void {
  this.calendarPopupState.set({
    appointment: { startTime: event.startTime, endTime: event.endTime },
    isNew: true,
  });
}

onCalendarEdit(apt: DayAppointment): void {
  this.calendarPopupState.set({ appointment: apt, isNew: false });
}

onCalendarResizeUpdate(apt: DayAppointment): void {
  this.daySchedule.updateAppointment(apt);
}

onCalendarPopupSave(apt: DayAppointment): void {
  const state = this.calendarPopupState();
  if (state?.isNew) {
    this.daySchedule.addAppointment(apt.title, apt.startTime, apt.endTime);
  } else {
    this.daySchedule.updateAppointment(apt);
  }
  this.calendarPopupState.set(null);
}

onCalendarPopupDelete(id: string): void {
  this.daySchedule.deleteAppointment(id);
  this.calendarPopupState.set(null);
}

onCalendarDone(): void {
  this.startAnimation();
}

onCalendarSkip(): void {
  this.startAnimation();
}
```

Add the `AppointmentPopupComponent` and `DayTimelineComponent` to the component's imports. Add `DayScheduleService` and `DayAppointment` imports.

Add the popup to the `calendar-setup` template (inside the case block, after the buttons):

```html
@if (calendarPopupState()) {
  <app-appointment-popup
    [appointment]="calendarPopupState()!.appointment"
    [isNew]="calendarPopupState()!.isNew"
    (save)="onCalendarPopupSave($event)"
    (delete)="onCalendarPopupDelete($event)"
    (cancel)="calendarPopupState.set(null)"
  />
}
```

- [ ] **Step 6: Update syncViewState to handle the new states**

Ensure `syncViewState` doesn't override `'calendar-setup'` or `'page-transition'`:

```typescript
private syncViewState(phase: string): void {
  if (this.viewState() === 'animating' || this.viewState() === 'calendar-setup') return;
  // ... rest unchanged
}
```

- [ ] **Step 7: Implement page transition with content fade**

Instead of a separate `@case ('page-transition')`, use a CSS class approach: when transitioning, add the `anim-page-out` class to the existing `'input'` case content. After the 400ms animation completes, switch viewState to `'calendar-setup'` which has `anim-page-in`. This way the user sees the actual focus form content fading out, then the calendar content fading in.

Implementation: Add a `pageTransitioning` signal. In the `'input'` case, bind `[class.anim-page-out]="pageTransitioning()"`. In `startPageTransition()`, set `pageTransitioning(true)`, then after 400ms set `viewState('calendar-setup')` and `pageTransitioning(false)`.
```

- [ ] **Step 8: Verify the app compiles and test manually**

Run: `npx ng build 2>&1 | tail -20`
Expected: Build succeeds

Manual test: Open Orbit → click Tagesfokus card → answer question → click "Weiter" → should transition smoothly to calendar setup → create an appointment → click "Fertig" → celebration animation → readonly view

- [ ] **Step 9: Commit**

```bash
git add src/app/components/rhythm-detail/rhythm-detail.ts
git commit -m "feat(day-calendar): integrate calendar setup into morning flow with page transition"
```

---

### Task 9: Skip Flow Adjustments

**Files:**
- Modify: `src/app/components/rhythm-detail/rhythm-detail.ts`

- [ ] **Step 1: Update onSkip to skip both focus and calendar**

When the user skips the focus question in the morning, the calendar step should also be skipped. The current `onSkip()` calls `rhythm.skipMorning()` which sets the phase to `'morning-filled'`. The `syncViewState` will then pick up the phase change and go to `'readonly'`. This should already work correctly since `skipMorning()` triggers a phase change.

Verify this works: when you click "Überspringen" on the focus question, it should go straight to readonly (no calendar step).

- [ ] **Step 2: Run all tests**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 3: Commit (if any changes were needed)**

```bash
git add src/app/components/rhythm-detail/rhythm-detail.ts
git commit -m "fix(day-calendar): ensure skip on focus also skips calendar setup"
```

---

### Task 10: End-to-End Verification

- [ ] **Step 1: Run the full test suite**

Run: `npx ng test --no-watch`
Expected: All tests pass

- [ ] **Step 2: Run a build**

Run: `npx ng build`
Expected: Build succeeds (ignore bundle size warnings per CLAUDE.md)

- [ ] **Step 3: Manual smoke test**

Start the app with `npm start` and verify:

1. **Morning flow:** Tagesfokus → answer → "Weiter" → smooth page transition → "Tagesplan erstellen" view → drag to create appointment → popup appears → enter name → save → appointment visible → "Fertig" → celebration animation → readonly
2. **Right panel:** Day calendar panel visible on right with the appointments just created → drag to create another → double-click to edit → resize by dragging edge → delete via popup
3. **Collapse/expand:** Click chevron to collapse panel → panel shrinks to narrow strip → click to expand → calendar returns
4. **Date rollover:** Check that refreshing the page shows today's appointments (not stale data)
5. **Current time line:** Red line visible at correct position (if within 08:00–17:00)

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(day-calendar): address issues found during smoke test"
```
