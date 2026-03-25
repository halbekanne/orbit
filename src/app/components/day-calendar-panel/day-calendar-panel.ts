import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DayTimelineComponent } from '../day-timeline/day-timeline';
import { AppointmentPopupComponent } from '../appointment-popup/appointment-popup';
import { ActionRailComponent } from '../action-rail/action-rail';
import { PomodoroConfigPopupComponent } from '../pomodoro-config-popup/pomodoro-config-popup';
import { DayScheduleService } from '../../services/day-schedule.service';
import { PomodoroService } from '../../services/pomodoro.service';
import { DayAppointment } from '../../models/day-schedule.model';

const STORAGE_KEY = 'orbit.dayCalendar.collapsed';

@Component({
  selector: 'app-day-calendar-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DayTimelineComponent, AppointmentPopupComponent, ActionRailComponent, PomodoroConfigPopupComponent],
  host: {
    '[class]': 'hostClass()',
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    @if (collapsed()) {
      <button
        class="h-full w-full flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
        (click)="toggleCollapse()"
        data-testid="collapse-toggle"
        aria-label="Tagesplan einblenden"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
    } @else {
      <div class="flex items-center justify-between px-4 py-3 border-b border-stone-200">
        <span class="font-semibold text-stone-800 text-sm tracking-wide">Tagesplan</span>
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
      <app-action-rail class="shrink-0 border-b border-stone-200" />
      <div class="shrink-0 p-3 border-b border-stone-200">
        @if (pomodoro.state() === 'idle') {
          <button type="button"
            class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
            (click)="showPomodoroConfig.set(true)">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>
            Pomodoro starten
          </button>
        } @else if (pomodoro.state() === 'running') {
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-1.5">
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span class="text-xs font-medium text-indigo-700">Fokus läuft</span>
            </div>
            <span class="text-xs text-stone-400 tabular-nums">{{ pomodoroRemainingLabel() }}</span>
          </div>
          <button type="button"
            class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-stone-50 border-stone-200 text-stone-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50"
            (click)="showCancelConfirm.set(true)">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            Pomodoro abbrechen
          </button>
        }
      </div>
      <div class="flex-1 overflow-y-auto">
        <app-day-timeline
          [appointments]="service.appointments()"
          [pomodoroBlock]="pomodoro.timelineBlock()"
          (appointmentCreate)="onCreateRequest($event)"
          (appointmentEdit)="onEditRequest($event)"
          (appointmentUpdate)="onResizeUpdate($event)"
        />
      </div>
    }

    @if (popupState() !== null) {
      <app-appointment-popup
        [appointment]="popupState()!.appointment"
        [isNew]="popupState()!.isNew"
        (save)="onPopupSave($event)"
        (delete)="onPopupDelete($event)"
        (cancel)="popupState.set(null)"
      />
    }

    @if (showPomodoroConfig()) {
      <app-pomodoro-config-popup
        (started)="showPomodoroConfig.set(false)"
        (cancel)="showPomodoroConfig.set(false)"
      />
    }

    @if (showCancelConfirm()) {
      <div class="fixed inset-0 bg-black/20 backdrop-blur-sm z-50" (click)="showCancelConfirm.set(false)"></div>
      <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div class="bg-white rounded-xl shadow-lg p-5 w-[280px] pointer-events-auto" role="dialog" aria-modal="true" aria-label="Pomodoro abbrechen">
          <h3 class="text-sm font-semibold text-stone-800 mb-2">Pomodoro abbrechen?</h3>
          <p class="text-xs text-stone-500 mb-4">Deine aktuelle Fokuszeit wird beendet.</p>
          <div class="flex gap-2">
            <button type="button"
              class="flex-1 rounded-lg border border-stone-200 text-stone-600 py-2 text-sm font-medium hover:bg-stone-50 transition-colors"
              (click)="showCancelConfirm.set(false)">
              Weiterarbeiten
            </button>
            <button type="button"
              class="flex-1 rounded-lg bg-red-600 text-white py-2 text-sm font-semibold hover:bg-red-700 transition-colors"
              (click)="confirmCancel()">
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

  readonly collapsed = signal<boolean>(localStorage.getItem(STORAGE_KEY) === 'true');
  readonly showPomodoroConfig = signal(false);
  readonly showCancelConfirm = signal(false);

  readonly popupState = signal<{ appointment: Partial<DayAppointment>; isNew: boolean } | null>(null);

  readonly hostClass = computed(() =>
    this.collapsed()
      ? 'w-8 shrink-0 border-l border-stone-200 bg-stone-50 flex flex-col'
      : 'w-[260px] shrink-0 border-l border-stone-200 bg-stone-50 flex flex-col transition-[width] duration-150'
  );

  toggleCollapse(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  onCreateRequest(event: { startTime: string; endTime: string }): void {
    this.popupState.set({ appointment: { startTime: event.startTime, endTime: event.endTime }, isNew: true });
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
