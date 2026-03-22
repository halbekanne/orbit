import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { HybridRailComponent } from './components/hybrid-rail/hybrid-rail';
import { ViewArbeitComponent } from './views/view-arbeit/view-arbeit';
import { ViewTimelineComponent } from './views/view-timeline/view-timeline';
import { QuickCaptureComponent } from './components/quick-capture/quick-capture';
import { DayRhythmService } from './services/day-rhythm.service';

const STORAGE_KEY = 'orbit.activeView';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HybridRailComponent, ViewArbeitComponent, ViewTimelineComponent, QuickCaptureComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class App {
  private readonly dayRhythm = inject(DayRhythmService);

  activeView = signal(localStorage.getItem(STORAGE_KEY) ?? 'arbeit');
  overlayOpen = signal(false);
  private previousFocus: HTMLElement | null = null;

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY, this.activeView());
    });
    this.dayRhythm.ensureToday();
    setInterval(() => this.dayRhythm.currentHour.set(new Date().getHours()), 5 * 60 * 1000);
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
      this.dayRhythm.currentHour.set(this.debugEvening ? 16 : new Date().getHours());
      console.log(`[Orbit Debug] Evening mode: ${this.debugEvening ? 'ON (16:00)' : 'OFF (real time)'}`);
    }
  }

  onOverlayClose(): void {
    this.overlayOpen.set(false);
    this.previousFocus?.focus();
  }
}
