import { ChangeDetectionStrategy, Component, inject, output, signal, afterNextRender, viewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PomodoroService } from '../../services/pomodoro.service';

@Component({
  selector: 'app-pomodoro-config-popup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  host: {
    '(document:keydown.escape)': 'cancel.emit()',
  },
  template: `
    <div class="fixed inset-0 bg-black/20 backdrop-blur-sm z-50" (click)="cancel.emit()"></div>
    <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div class="bg-white rounded-xl shadow-lg p-5 w-[280px] pointer-events-auto" role="dialog" aria-modal="true" aria-label="Pomodoro konfigurieren">
        <h3 class="text-sm font-semibold text-stone-800 mb-4">Pomodoro starten</h3>

        <label class="block mb-3">
          <span class="text-xs font-medium text-stone-600 mb-1 block">Fokuszeit (Minuten)</span>
          <input #focusInput type="number" min="1" max="120" [(ngModel)]="focusMinutes"
            class="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300" />
        </label>

        <label class="block mb-4">
          <span class="text-xs font-medium text-stone-600 mb-1 block">Pausenzeit (Minuten)</span>
          <input type="number" min="1" max="60" [(ngModel)]="breakMinutes"
            class="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300" />
        </label>

        <button type="button"
          class="w-full rounded-lg bg-indigo-600 text-white py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors"
          (click)="onStart()">
          Starten
        </button>
      </div>
    </div>
  `,
})
export class PomodoroConfigPopupComponent {
  private readonly pomodoro = inject(PomodoroService);
  readonly cancel = output<void>();
  readonly started = output<void>();
  readonly focusInput = viewChild<ElementRef<HTMLInputElement>>('focusInput');

  focusMinutes = this.pomodoro.defaultFocusMinutes();
  breakMinutes = this.pomodoro.defaultBreakMinutes();

  constructor() {
    afterNextRender(() => {
      this.focusInput()?.nativeElement.focus();
      this.focusInput()?.nativeElement.select();
    });
  }

  onStart(): void {
    this.pomodoro.start({ focusMinutes: this.focusMinutes, breakMinutes: this.breakMinutes });
    this.started.emit();
  }
}
