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
      <app-action-rail class="shrink-0 border-b border-stone-200" />
      <div class="flex-1 overflow-y-auto">
        <app-day-timeline
          [appointments]="service.appointments()"
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

  confirmCancel(): void {
    this.pomodoro.cancel();
    this.showCancelConfirm.set(false);
  }
}
