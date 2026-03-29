import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DataRefreshService } from '../data-refresh.service';

@Component({
  selector: 'app-sync-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sync-bar.html',
  host: {
    class: 'block px-4 py-2 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-page)]',
  },
})
export class SyncBarComponent {
  protected readonly refreshService = inject(DataRefreshService);

  readonly sources = input<string[]>();

  protected readonly formattedTime = computed(() => {
    const time = this.refreshService.lastGlobalFetchTime();
    if (!time) return '';
    return time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  });

  protected onSync(): void {
    const s = this.sources();
    if (s && s.length > 0) {
      this.refreshService.refreshSources(s);
    } else {
      this.refreshService.refreshAll(true);
    }
    this.refreshService.resetPollingTimer();
  }
}
