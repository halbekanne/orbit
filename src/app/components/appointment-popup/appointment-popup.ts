import { ChangeDetectionStrategy, Component, input, output, signal, effect, afterNextRender, viewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DayAppointment } from '../../models/day-schedule.model';

@Component({
  selector: 'app-appointment-popup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  host: {
    '(document:keydown.escape)': 'cancel.emit()',
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
            #nameInput
            [ngModel]="name()"
            (ngModelChange)="name.set($event)"
            data-testid="apt-name"
            (keydown.enter)="onSave()"
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

  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  constructor() {
    effect(() => {
      const apt = this.appointment();
      this.name.set(apt.title ?? '');
      this.startTime.set(apt.startTime ?? '');
      this.endTime.set(apt.endTime ?? '');
    });
    afterNextRender(() => {
      this.nameInput()?.nativeElement.focus();
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
