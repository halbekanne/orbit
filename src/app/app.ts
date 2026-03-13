import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NavigatorComponent } from './components/navigator/navigator';
import { WorkbenchComponent } from './components/workbench/workbench';
import { QuickCaptureComponent } from './components/quick-capture/quick-capture';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavigatorComponent, WorkbenchComponent, QuickCaptureComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class App {
  overlayOpen = signal(false);
  private previousFocus: HTMLElement | null = null;

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
