import { ApplicationRef, ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { AppRailComponent } from './components/app-rail/app-rail';
import { ViewArbeitComponent } from './views/view-arbeit/view-arbeit';
import { ViewLogbuchComponent } from './views/view-logbuch/view-logbuch';
import { QuickCaptureComponent } from './components/quick-capture/quick-capture';
import { DayRhythmService } from './services/day-rhythm.service';
import { ThemeService } from './services/theme.service';
import { PomodoroProgressBarComponent } from './components/pomodoro-progress-bar/pomodoro-progress-bar';
import { PomodoroOverlayComponent } from './components/pomodoro-overlay/pomodoro-overlay';

const STORAGE_KEY = 'orbit.activeView';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppRailComponent, ViewArbeitComponent, ViewLogbuchComponent, QuickCaptureComponent, PomodoroProgressBarComponent, PomodoroOverlayComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class App {
  private readonly dayRhythm = inject(DayRhythmService);
  private readonly appRef = inject(ApplicationRef);
  private theme = inject(ThemeService);

  activeView = signal(localStorage.getItem(STORAGE_KEY) ?? 'arbeit');
  overlayOpen = signal(false);
  private previousFocus: HTMLElement | null = null;

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY, this.activeView());
    });
    setInterval(() => {
      if (!this.debugEvening) this.dayRhythm.currentHour.set(new Date().getHours());
    }, 5 * 60 * 1000);
  }

  private debugEvening = false;

  onKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      this.previousFocus = document.activeElement as HTMLElement;
      this.overlayOpen.set(true);
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      this.debugEvening = !this.debugEvening;
      if (this.debugEvening) {
        const entry = this.dayRhythm.todayEntry();
        if (!entry || entry.morningAnsweredAt === null) {
          this.dayRhythm.skipMorning();
        }
        this.dayRhythm.currentHour.set(16);
      } else {
        this.dayRhythm.currentHour.set(new Date().getHours());
      }
      console.log(`[Orbit Debug] Evening mode: ${this.debugEvening ? 'ON' : 'OFF'} | phase: ${this.dayRhythm.rhythmPhase()}`);
      this.appRef.tick();
    }
  }

  onOverlayClose(): void {
    this.overlayOpen.set(false);
    this.previousFocus?.focus();
  }
}
