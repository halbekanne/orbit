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
      <div class="bg-white rounded-xl shadow-lg p-5 w-[320px] pointer-events-auto" (click)="$event.stopPropagation()">

        <h3 class="text-sm font-semibold text-stone-800 mb-4">
          {{ isNew() ? 'Neuer Termin' : 'Termin bearbeiten' }}
        </h3>

        <div class="mb-3">
          <label class="text-[10px] font-medium uppercase tracking-wide text-stone-400 block mb-1.5">Name</label>
          <input
            type="text"
            class="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:border-[var(--color-primary-border)] outline-none transition-colors duration-100"
            #nameInput
            [ngModel]="name()"
            (ngModelChange)="name.set($event)"
            data-testid="apt-name"
            placeholder="Terminbezeichnung"
            (keydown.enter)="onSave()"
          />
        </div>

        <div class="mb-5">
          <label class="text-[10px] font-medium uppercase tracking-wide text-stone-400 block mb-1.5">Uhrzeit</label>
          <div class="flex items-center gap-2">
            <input
              type="text"
              class="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 text-center tabular-nums focus:bg-white focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:border-[var(--color-primary-border)] outline-none transition-colors duration-100"
              [ngModel]="startTime()"
              (ngModelChange)="startTime.set($event)"
              data-testid="apt-start"
              aria-label="Von"
            />
            <span class="text-stone-400 text-sm select-none flex-shrink-0">–</span>
            <input
              type="text"
              class="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 text-center tabular-nums focus:bg-white focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:border-[var(--color-primary-border)] outline-none transition-colors duration-100"
              [ngModel]="endTime()"
              (ngModelChange)="endTime.set($event)"
              data-testid="apt-end"
              aria-label="Bis"
            />
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex-1 rounded-lg px-3 py-2 text-xs font-medium text-white bg-[var(--color-primary-solid)] hover:bg-[var(--color-primary-solid-hover)] disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed transition-colors duration-100"
            [disabled]="!name().trim()"
            (click)="onSave()"
            data-testid="apt-save"
          >Speichern</button>
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-xs font-medium text-stone-600 bg-stone-100 border border-stone-200 hover:bg-stone-200 transition-colors duration-100"
            (click)="cancel.emit()"
            data-testid="apt-cancel"
          >Abbrechen</button>
        </div>

        @if (!isNew()) {
          <div class="mt-3 pt-3 border-t border-stone-100">
            <button
              type="button"
              class="w-full rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors duration-100"
              (click)="delete.emit(appointment().id!)"
              data-testid="apt-delete"
            >Termin löschen</button>
          </div>
        }

        <p class="text-[10px] text-stone-300 text-center mt-3 select-none">Enter speichert · Esc schließt</p>
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
