import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppRailComponent } from './shared/app-rail/app-rail';
import { QuickCaptureComponent } from './shared/quick-capture/quick-capture';
import { WelcomeScreenComponent } from './settings/welcome-screen/welcome-screen';
import { DailyReflectionService } from './reflection/daily-reflection.service';
import { ThemeService } from './shared/theme.service';
import { SettingsService } from './settings/settings.service';
import { PomodoroProgressBarComponent } from './pomodoro/pomodoro-progress-bar/pomodoro-progress-bar';
import { PomodoroOverlayComponent } from './pomodoro/pomodoro-overlay/pomodoro-overlay';
import { RouterSyncService } from './shared/router-sync.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    AppRailComponent,
    QuickCaptureComponent,
    WelcomeScreenComponent,
    PomodoroProgressBarComponent,
    PomodoroOverlayComponent,
  ],
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
  readonly routerSync = inject(RouterSyncService);

  overlayOpen = signal(false);
  private previousFocus: HTMLElement | null = null;

  constructor() {
    this.settingsService.load();
    setInterval(
      () => {
        if (!this.debugEvening) this.reflectionService.currentHour.set(new Date().getHours());
      },
      5 * 60 * 1000,
    );
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
      console.log(
        `[Orbit Debug] Evening mode: ${this.debugEvening ? 'ON' : 'OFF'} | phase: ${this.reflectionService.reflectionPhase()}`,
      );
      this.appRef.tick();
    }
  }

  onViewChange(viewId: string): void {
    this.routerSync.navigateToView(viewId);
  }

  onWelcomeConfigure(): void {
    this.routerSync.navigateToView('einstellungen');
  }

  onOverlayClose(): void {
    this.overlayOpen.set(false);
    this.previousFocus?.focus();
  }
}
