import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';
import { AppRailComponent } from './shared/app-rail/app-rail';
import { ViewArbeitComponent } from './shared/view-arbeit/view-arbeit';
import { ViewLogbuchComponent } from './shared/view-logbuch/view-logbuch';
import { ViewSettingsComponent } from './settings/view-settings/view-settings';
import { QuickCaptureComponent } from './shared/quick-capture/quick-capture';
import { WelcomeScreenComponent } from './settings/welcome-screen/welcome-screen';
import { DailyReflectionService } from './reflection/daily-reflection.service';
import { ThemeService } from './shared/theme.service';
import { SettingsService } from './settings/settings.service';
import { PomodoroProgressBarComponent } from './pomodoro/pomodoro-progress-bar/pomodoro-progress-bar';
import { PomodoroOverlayComponent } from './pomodoro/pomodoro-overlay/pomodoro-overlay';

const STORAGE_KEY = 'orbit.activeView';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppRailComponent,
    ViewArbeitComponent,
    ViewLogbuchComponent,
    ViewSettingsComponent,
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

  activeView = signal(localStorage.getItem(STORAGE_KEY) ?? 'arbeit');
  pendingViewChange = signal<string | null>(null);
  overlayOpen = signal(false);
  private previousFocus: HTMLElement | null = null;

  constructor() {
    this.settingsService.load();
    effect(() => {
      localStorage.setItem(STORAGE_KEY, this.activeView());
    });
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
    if (this.activeView() === 'einstellungen' && viewId !== 'einstellungen') {
      if (document.querySelector('[data-settings-dirty="true"]')) {
        this.pendingViewChange.set(viewId);
        return;
      }
    }
    this.activeView.set(viewId);
  }

  confirmDiscard(): void {
    const pending = this.pendingViewChange();
    if (pending) {
      this.pendingViewChange.set(null);
      this.activeView.set(pending);
    }
  }

  confirmSave(): void {
    const pending = this.pendingViewChange();
    if (pending) {
      this.pendingViewChange.set(null);
      this.activeView.set(pending);
    }
  }

  cancelNavigation(): void {
    this.pendingViewChange.set(null);
  }

  onWelcomeConfigure(): void {
    this.activeView.set('einstellungen');
  }

  onOverlayClose(): void {
    this.overlayOpen.set(false);
    this.previousFocus?.focus();
  }
}
