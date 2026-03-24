import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DayTimelineComponent } from '../day-timeline/day-timeline';
import { AppointmentPopupComponent } from '../appointment-popup/appointment-popup';
import { DayScheduleService } from '../../services/day-schedule.service';
import { DayAppointment } from '../../models/day-schedule.model';

const STORAGE_KEY = 'orbit.dayCalendar.collapsed';

@Component({
  selector: 'app-day-calendar-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DayTimelineComponent, AppointmentPopupComponent],
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
      <div class="flex items-center justify-between px-2 py-2 border-b border-stone-100">
        <span class="text-xs font-semibold text-stone-900">Tagesplan</span>
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
  `,
})
export class DayCalendarPanelComponent {
  readonly service = inject(DayScheduleService);

  readonly collapsed = signal<boolean>(localStorage.getItem(STORAGE_KEY) === 'true');

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
}
