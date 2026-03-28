import { ApplicationRef, ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { AppRailComponent } from './components/app-rail/app-rail';
import { ViewArbeitComponent } from './views/view-arbeit/view-arbeit';
import { ViewLogbuchComponent } from './views/view-logbuch/view-logbuch';
import { ViewSettingsComponent } from './views/view-settings/view-settings';
import { QuickCaptureComponent } from './components/quick-capture/quick-capture';
import { WelcomeScreenComponent } from './components/welcome-screen/welcome-screen';
import { DailyReflectionService } from './services/daily-reflection.service';
import { ThemeService } from './services/theme.service';
import { SettingsService } from './services/settings.service';
import { PomodoroProgressBarComponent } from './components/pomodoro-progress-bar/pomodoro-progress-bar';
import { PomodoroOverlayComponent } from './components/pomodoro-overlay/pomodoro-overlay';

const STORAGE_KEY = 'orbit.activeView';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppRailComponent, ViewArbeitComponent, ViewLogbuchComponent, ViewSettingsComponent, QuickCaptureComponent, WelcomeScreenComponent, PomodoroProgressBarComponent, PomodoroOverlayComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class App {
  private readonly reflectionService = inject(DailyReflectionService);
  private readonly appRef = inject(ApplicationRef);
  private theme = inject(ThemeService);
  readonly settingsService = inject(SettingsService);

  activeView = signal(localStorage.getItem(STORAGE_KEY) ?? 'arbeit');
  overlayOpen = signal(false);
  private previousFocus: HTMLElement | null = null;

  constructor() {
    this.settingsService.load();
    effect(() => {
      localStorage.setItem(STORAGE_KEY, this.activeView());
    });
    setInterval(() => {
      if (!this.debugEvening) this.reflectionService.currentHour.set(new Date().getHours());
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
        const entry = this.reflectionService.todayEntry();
        if (!entry || entry.morningAnsweredAt === null) {
          this.reflectionService.skipMorning();
        }
        this.reflectionService.currentHour.set(16);
      } else {
        this.reflectionService.currentHour.set(new Date().getHours());
      }
      console.log(`[Orbit Debug] Evening mode: ${this.debugEvening ? 'ON' : 'OFF'} | phase: ${this.reflectionService.reflectionPhase()}`);
      this.appRef.tick();
    }
  }

  onWelcomeConfigure(): void {
    this.activeView.set('einstellungen');
  }

  onOverlayClose(): void {
    this.overlayOpen.set(false);
    this.previousFocus?.focus();
  }
}
