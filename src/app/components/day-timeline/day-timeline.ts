import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  input,
  output,
  signal,
} from '@angular/core';
import { DayAppointment } from '../../models/day-schedule.model';

const START_HOUR = 8;
const END_HOUR = 17;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

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
  const offsetMinutes = minutes - START_HOUR * 60;
  return (offsetMinutes / TOTAL_MINUTES) * 100;
}

interface DragState {
  type: 'create' | 'resize-top' | 'resize-bottom';
  startMinutes: number;
  appointment?: DayAppointment;
}

@Component({
  selector: 'app-day-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full select-none' },
  styles: [`
    .grid-container {
      position: relative;
      height: 100%;
    }
    .hour-row {
      position: absolute;
      width: 100%;
      display: flex;
      align-items: flex-start;
    }
    .hour-row::before {
      content: '';
      position: absolute;
      top: 0;
      left: 36px;
      right: 0;
      border-top: 1px solid #d6d3d1;
    }
    .quarter-line {
      position: absolute;
      left: 36px;
      right: 0;
      border-top: 1px solid #f0efed;
    }
    .half-line {
      border-top-style: dashed;
      border-top-color: #e7e5e4;
    }
    .hour-label {
      width: 36px;
      font-size: 9px;
      color: #a8a29e;
      line-height: 1;
      transform: translateY(-4px);
      text-align: right;
      padding-right: 6px;
    }
    .appointment-block {
      position: absolute;
      left: 38px;
      right: 4px;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-left: 3px solid #6366f1;
      border-radius: 4px;
      z-index: 2;
      overflow: hidden;
      cursor: pointer;
      transition: background 100ms ease;
    }
    .appointment-block:hover {
      background: #e0e7ff;
    }
    .current-time-line {
      position: absolute;
      left: 36px;
      right: 4px;
      height: 2px;
      background: #ef4444;
      z-index: 5;
      pointer-events: none;
    }
    .current-time-dot {
      position: absolute;
      left: -4px;
      top: -3px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
    }
    .drag-preview {
      position: absolute;
      left: 38px;
      right: 4px;
      background: #eef2ff80;
      border: 2px dashed #818cf8;
      border-radius: 4px;
      z-index: 3;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: #6366f1;
      font-weight: 500;
    }
    .resize-handle {
      position: absolute;
      left: 4px;
      right: 4px;
      height: 8px;
      cursor: ns-resize;
      z-index: 4;
    }
    .resize-handle:hover::after {
      content: '';
      position: absolute;
      left: 25%;
      right: 25%;
      top: 50%;
      height: 2px;
      background: #818cf8;
      border-radius: 1px;
      transform: translateY(-50%);
    }
    .resize-handle-top {
      top: -2px;
    }
    .resize-handle-bottom {
      bottom: -2px;
    }
  `],
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

      @for (line of quarterLines; track line.minutes) {
        <div
          class="quarter-line"
          [class.half-line]="line.isHalf"
          [style.top.%]="minutesToPercent(line.minutes)"
        ></div>
      }

      @for (apt of appointments(); track apt.id) {
        <div
          class="appointment-block"
          [attr.data-testid]="'appointment-' + apt.id"
          [attr.data-appointment-id]="apt.id"
          [style.top.%]="minutesToPercent(timeToMinutes(apt.startTime))"
          [style.height.%]="minutesToPercent(timeToMinutes(apt.endTime)) - minutesToPercent(timeToMinutes(apt.startTime))"
          (dblclick)="appointmentEdit.emit(apt)"
        >
          <div class="resize-handle resize-handle-top" data-resize="top" [attr.data-appointment-id]="apt.id"></div>
          <div style="padding: 2px 4px; pointer-events: none;">
            <div style="font-size: 11px; font-weight: 600; color: #4338ca; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{{ apt.title }}</div>
            <div style="font-size: 10px; color: #6366f1;">{{ apt.startTime }} – {{ apt.endTime }}</div>
          </div>
          <div class="resize-handle resize-handle-bottom" data-resize="bottom" [attr.data-appointment-id]="apt.id"></div>
        </div>
      }

      @if (dragPreview() !== null) {
        <div
          class="drag-preview"
          [style.top.%]="minutesToPercent(dragPreview()!.startMinutes)"
          [style.height.%]="minutesToPercent(dragPreview()!.endMinutes) - minutesToPercent(dragPreview()!.startMinutes)"
        >{{ minutesToTime(dragPreview()!.startMinutes) }} – {{ minutesToTime(dragPreview()!.endMinutes) }}</div>
      }

      @if (currentTimePercent() !== null) {
        <div
          class="current-time-line"
          data-testid="current-time-line"
          [style.top.%]="currentTimePercent()!"
        >
          <div class="current-time-dot"></div>
        </div>
      }
    </div>
  `,
})
export class DayTimelineComponent implements OnInit, OnDestroy {
  appointments = input<DayAppointment[]>([]);
  appointmentCreate = output<{ startTime: string; endTime: string }>();
  appointmentEdit = output<DayAppointment>();
  appointmentUpdate = output<DayAppointment>();

  protected readonly START_HOUR = START_HOUR;
  protected readonly END_HOUR = END_HOUR;
  readonly hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  readonly quarterLines = (() => {
    const lines: { minutes: number; isHalf: boolean }[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      lines.push({ minutes: h * 60 + 15, isHalf: false });
      lines.push({ minutes: h * 60 + 30, isHalf: true });
      lines.push({ minutes: h * 60 + 45, isHalf: false });
    }
    return lines;
  })();

  currentTimePercent = signal<number | null>(null);
  dragPreview = signal<{ startMinutes: number; endMinutes: number } | null>(null);

  private dragState: DragState | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private gridEl: HTMLElement | null = null;

  readonly minutesToPercent = minutesToPercent;
  readonly minutesToTime = minutesToTime;
  readonly timeToMinutes = timeToMinutes;

  formatHour(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
  }

  ngOnInit(): void {
    this.updateCurrentTime();
    this.intervalId = setInterval(() => this.updateCurrentTime(), 60_000);
  }

  ngOnDestroy(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
  }

  private updateCurrentTime(): void {
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const start = START_HOUR * 60;
    const end = END_HOUR * 60;
    if (totalMinutes >= start && totalMinutes <= end) {
      this.currentTimePercent.set(minutesToPercent(totalMinutes));
    } else {
      this.currentTimePercent.set(null);
    }
  }

  onGridPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement;

    const resizeAttr = target.getAttribute('data-resize');
    if (resizeAttr) {
      const aptId = target.getAttribute('data-appointment-id');
      const apt = this.appointments().find(a => a.id === aptId);
      if (!apt) return;
      this.gridEl = (event.currentTarget as HTMLElement);
      this.dragState = {
        type: resizeAttr === 'top' ? 'resize-top' : 'resize-bottom',
        startMinutes: this.pointerToMinutes(event),
        appointment: apt,
      };
      const startMin = timeToMinutes(apt.startTime);
      const endMin = timeToMinutes(apt.endTime);
      this.dragPreview.set({ startMinutes: startMin, endMinutes: endMin });
      target.setPointerCapture(event.pointerId);
      event.stopPropagation();
      return;
    }

    if (target.closest('[data-appointment-id]') && !resizeAttr) {
      return;
    }

    this.gridEl = (event.currentTarget as HTMLElement);
    const snapped = this.pointerToMinutes(event);
    this.dragState = { type: 'create', startMinutes: snapped };
    this.dragPreview.set({ startMinutes: snapped, endMinutes: snapped + 15 });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  onGridPointerMove(event: PointerEvent): void {
    if (!this.dragState) return;
    const currentMinutes = this.pointerToMinutes(event);

    if (this.dragState.type === 'create') {
      const start = Math.min(this.dragState.startMinutes, currentMinutes);
      const end = Math.max(this.dragState.startMinutes, currentMinutes);
      this.dragPreview.set({ startMinutes: start, endMinutes: Math.max(end, start + 15) });
    } else if (this.dragState.type === 'resize-top' && this.dragState.appointment) {
      const endMin = timeToMinutes(this.dragState.appointment.endTime);
      const newStart = Math.min(currentMinutes, endMin - 15);
      this.dragPreview.set({ startMinutes: newStart, endMinutes: endMin });
    } else if (this.dragState.type === 'resize-bottom' && this.dragState.appointment) {
      const startMin = timeToMinutes(this.dragState.appointment.startTime);
      const newEnd = Math.max(currentMinutes, startMin + 15);
      this.dragPreview.set({ startMinutes: startMin, endMinutes: newEnd });
    }
  }

  onGridPointerUp(event: PointerEvent): void {
    if (!this.dragState) return;

    const preview = this.dragPreview();
    this.dragPreview.set(null);

    if (preview && (preview.endMinutes - preview.startMinutes) >= 15) {
      if (this.dragState.type === 'create') {
        this.appointmentCreate.emit({
          startTime: minutesToTime(preview.startMinutes),
          endTime: minutesToTime(preview.endMinutes),
        });
      } else if (this.dragState.appointment) {
        this.appointmentUpdate.emit({
          ...this.dragState.appointment,
          startTime: minutesToTime(preview.startMinutes),
          endTime: minutesToTime(preview.endMinutes),
        });
      }
    }

    this.dragState = null;
  }

  private pointerToMinutes(event: PointerEvent): number {
    const grid = this.gridEl ?? (event.currentTarget as HTMLElement);
    const rect = grid.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const ratio = Math.max(0, Math.min(1, relativeY / rect.height));
    const rawMinutes = START_HOUR * 60 + ratio * TOTAL_MINUTES;
    const snapped = Math.round(rawMinutes / 15) * 15;
    return Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, snapped));
  }
}
