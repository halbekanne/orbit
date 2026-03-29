import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PomodoroService } from '../pomodoro.service';

@Component({
  selector: 'app-pomodoro-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        class="fixed top-0 left-0 h-[3px] bg-[var(--color-pomodoro-accent)] z-50 transition-[width] duration-1000 ease-linear"
        [style.width.%]="progressPercent()"
        role="progressbar"
        [attr.aria-valuenow]="progressPercent()"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Fokuszeit-Fortschritt"
      ></div>
    }
  `,
})
export class PomodoroProgressBarComponent {
  private readonly pomodoro = inject(PomodoroService);

  readonly visible = computed(() => this.pomodoro.state() === 'running');
  readonly progressPercent = computed(() => Math.round(this.pomodoro.progress() * 100));
}
