import { ChangeDetectionStrategy, Component, effect, signal } from '@angular/core';
import { HybridRailComponent } from './components/hybrid-rail/hybrid-rail';
import { ViewArbeitComponent } from './views/view-arbeit/view-arbeit';
import { ViewTimelineComponent } from './views/view-timeline/view-timeline';
import { QuickCaptureComponent } from './components/quick-capture/quick-capture';

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
  activeView = signal(localStorage.getItem(STORAGE_KEY) ?? 'arbeit');
  overlayOpen = signal(false);
  private previousFocus: HTMLElement | null = null;

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY, this.activeView());
    });
  }

  onKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      this.previousFocus = document.activeElement as HTMLElement;
      this.overlayOpen.set(true);
    }
  }

  onOverlayClose(): void {
    this.overlayOpen.set(false);
    this.previousFocus?.focus();
  }
}
