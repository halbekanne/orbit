import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DayAppointment } from '../../models/day-schedule.model';

const START_HOUR = 8;
const END_HOUR = 17;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const HOUR_HEIGHT = 120;
const PADDING_TOP = 8;
const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT + PADDING_TOP * 2;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function minutesToPx(minutes: number): number {
  const offsetMinutes = minutes - START_HOUR * 60;
  return PADDING_TOP + (offsetMinutes / 60) * HOUR_HEIGHT;
}

interface DragState {
  type: 'create' | 'resize-top' | 'resize-bottom';
  startMinutes: number;
  appointment?: DayAppointment;
}

@Component({
  selector: 'app-day-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full select-none overflow-y-auto' },
  styles: [`
    .grid-container {
      position: relative;
      padding-top: 8px;
      padding-bottom: 8px;
      box-sizing: border-box;
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
      left: 44px;
      right: 0;
      border-top: 1px solid var(--color-border-default);
    }
    .quarter-line {
      position: absolute;
      left: 44px;
      right: 0;
      border-top: 1px solid var(--color-border-subtle);
    }
    .half-line {
      border-top-style: dashed;
      border-top-color: var(--color-border-default);
    }
    .hour-label {
      width: 44px;
      font-size: 11px;
      color: var(--color-text-muted);
      line-height: 1;
      transform: translateY(-5px);
      text-align: right;
      padding-right: 8px;
    }
    .appointment-block {
      position: absolute;
      left: 46px;
      right: 4px;
      background: var(--color-primary-bg);
      border: 1px solid var(--color-primary-border);
      border-left: 3px solid var(--color-primary-solid);
      border-radius: 4px;
      z-index: 2;
      overflow: hidden;
      cursor: pointer;
      transition: background 100ms ease;
    }
    .appointment-block:hover {
      background: var(--color-primary-bg-hover);
    }
    .current-time-line {
      position: absolute;
      left: 44px;
      right: 4px;
      height: 2px;
      background: var(--color-timeline-now);
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
      background: var(--color-timeline-now);
    }
    .drag-preview {
      position: absolute;
      left: 46px;
      right: 4px;
      background: color-mix(in srgb, var(--color-primary-bg) 50%, transparent);
      border: 2px dashed var(--color-primary-solid);
      border-radius: 4px;
      z-index: 3;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: var(--color-primary-solid);
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
      background: var(--color-primary-solid);
      border-radius: 1px;
      transform: translateY(-50%);
    }
    .resize-handle-top {
      top: -2px;
    }
    .resize-handle-bottom {
      bottom: -2px;
    }
    .pomodoro-block {
      position: absolute;
      left: 58px;
      right: 8px;
      border: 2px dashed var(--color-primary-solid);
      border-radius: 8px;
      background: var(--color-primary-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 3;
    }
    .pomodoro-block-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--color-primary-solid);
      opacity: 0.8;
    }
  `],
  template: `
    <div
      class="grid-container"
      [style.height.px]="GRID_HEIGHT"
      (pointerdown)="onGridPointerDown($event)"
      (pointermove)="onGridPointerMove($event)"
      (pointerup)="onGridPointerUp($event)"
    >
      @for (hour of hours; track hour) {
        <div
          class="hour-row"
          [style.top.px]="minutesToPx(hour * 60)"
          [style.height.px]="HOUR_HEIGHT"
        >
          <span class="hour-label" data-testid="hour-label">{{ formatHour(hour) }}</span>
        </div>
      }

      @for (line of quarterLines; track line.minutes) {
        <div
          class="quarter-line"
          [class.half-line]="line.isHalf"
          [style.top.px]="minutesToPx(line.minutes)"
        ></div>
      }

      @for (apt of appointments(); track apt.id) {
        <div
          class="appointment-block"
          [attr.data-testid]="'appointment-' + apt.id"
          [attr.data-appointment-id]="apt.id"
          [style.top.px]="minutesToPx(timeToMinutes(apt.startTime))"
          [style.height.px]="minutesToPx(timeToMinutes(apt.endTime)) - minutesToPx(timeToMinutes(apt.startTime))"
          (dblclick)="appointmentEdit.emit(apt)"
        >
          <div class="resize-handle resize-handle-top" data-resize="top" [attr.data-appointment-id]="apt.id"></div>
          <div style="padding: 3px 6px; pointer-events: none;">
            <div style="font-size: 12px; font-weight: 600; color: var(--color-primary-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{{ apt.title }}</div>
            <div style="font-size: 11px; color: var(--color-primary-solid);">{{ apt.startTime }} – {{ apt.endTime }}</div>
          </div>
          <div class="resize-handle resize-handle-bottom" data-resize="bottom" [attr.data-appointment-id]="apt.id"></div>
        </div>
      }

      @if (pomodoroBlockStyle(); as style) {
        <div class="pomodoro-block" [style.top]="style.top" [style.height]="style.height">
          <span class="pomodoro-block-label">Fokus</span>
        </div>
      }

      @if (dragPreview() !== null) {
        <div
          class="drag-preview"
          [style.top.px]="minutesToPx(dragPreview()!.startMinutes)"
          [style.height.px]="minutesToPx(dragPreview()!.endMinutes) - minutesToPx(dragPreview()!.startMinutes)"
        >{{ minutesToTime(dragPreview()!.startMinutes) }} – {{ minutesToTime(dragPreview()!.endMinutes) }}</div>
      }

      @if (currentTimePx() !== null) {
        <div
          class="current-time-line"
          data-testid="current-time-line"
          [style.top.px]="currentTimePx()!"
        >
          <div class="current-time-dot"></div>
        </div>
      }
    </div>
  `,
})
export class DayTimelineComponent implements OnInit, OnDestroy {
  appointments = input<DayAppointment[]>([]);
  readonly pomodoroBlock = input<{ startTime: string; endTime: string } | null>(null);
  appointmentCreate = output<{ startTime: string; endTime: string }>();
  appointmentEdit = output<DayAppointment>();
  appointmentUpdate = output<DayAppointment>();

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

  protected readonly START_HOUR = START_HOUR;
  protected readonly END_HOUR = END_HOUR;
  protected readonly HOUR_HEIGHT = HOUR_HEIGHT;
  protected readonly GRID_HEIGHT = GRID_HEIGHT;

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

  currentTimePx = signal<number | null>(null);
  dragPreview = signal<{ startMinutes: number; endMinutes: number } | null>(null);

  private readonly hostEl = inject(ElementRef<HTMLElement>);

  private dragState: DragState | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private gridEl: HTMLElement | null = null;

  readonly minutesToPx = minutesToPx;
  readonly minutesToTime = minutesToTime;
  readonly timeToMinutes = timeToMinutes;

  constructor() {
    afterNextRender(() => {
      this.scrollToCurrentTime();
    });
  }

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

  private scrollToCurrentTime(): void {
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const start = START_HOUR * 60;
    const end = END_HOUR * 60;
    if (totalMinutes < start || totalMinutes > end) return;

    const px = minutesToPx(totalMinutes);
    const host = this.hostEl.nativeElement;
    const viewportHeight = host.clientHeight;
    const scrollTarget = Math.max(0, px - viewportHeight / 3);
    host.scrollTop = scrollTarget;
  }

  private updateCurrentTime(): void {
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const start = START_HOUR * 60;
    const end = END_HOUR * 60;
    if (totalMinutes >= start && totalMinutes <= end) {
      this.currentTimePx.set(minutesToPx(totalMinutes));
    } else {
      this.currentTimePx.set(null);
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
    const relativeY = event.clientY - rect.top - PADDING_TOP;
    const clampedY = Math.max(0, Math.min(relativeY, GRID_HEIGHT - PADDING_TOP * 2));
    const rawMinutes = START_HOUR * 60 + (clampedY / ((END_HOUR - START_HOUR) * HOUR_HEIGHT)) * TOTAL_MINUTES;
    const snapped = Math.round(rawMinutes / 15) * 15;
    return Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, snapped));
  }
}
