import { computed, Injectable, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

export const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const RETRY_DELAYS = [3_000, 6_000, 12_000];

export interface DataSourceState {
  lastFetchTime: number | null;
  status: 'idle' | 'refreshing' | 'retrying' | 'error';
  retryAttempt: number;
}

function initialState(): DataSourceState {
  return { lastFetchTime: null, status: 'idle', retryAttempt: 0 };
}

interface RegisteredSource {
  fetchFn: () => Observable<unknown>;
  state: ReturnType<typeof signal<DataSourceState>>;
  subscription: Subscription | null;
  retryTimeout: ReturnType<typeof setTimeout> | null;
}

@Injectable({ providedIn: 'root' })
export class DataRefreshService {
  private readonly sources = new Map<string, RegisteredSource>();
  private refreshInProgress = false;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;

  readonly isRefreshing = computed(() =>
    [...this.sources.values()].some((s) => {
      const st = s.state();
      return st.status === 'refreshing' || st.status === 'retrying';
    }),
  );

  readonly lastGlobalFetchTime = computed(() => {
    const times = [...this.sources.values()]
      .map((s) => s.state().lastFetchTime)
      .filter((t): t is number => t !== null);
    if (times.length === 0) return null;
    return new Date(Math.min(...times));
  });

  readonly globalStatus = computed<'idle' | 'refreshing' | 'retrying' | 'error'>(() => {
    const states = [...this.sources.values()].map((s) => s.state().status);
    if (states.some((s) => s === 'refreshing')) return 'refreshing';
    if (states.some((s) => s === 'retrying')) return 'retrying';
    if (states.length > 0 && states.every((s) => s === 'error')) return 'error';
    return 'idle';
  });

  readonly retryInfo = computed(() => {
    for (const source of this.sources.values()) {
      const st = source.state();
      if (st.status === 'retrying') {
        return { attempt: st.retryAttempt, maxAttempts: RETRY_DELAYS.length };
      }
    }
    return null;
  });

  register(name: string, fetchFn: () => Observable<unknown>): void {
    this.sources.set(name, {
      fetchFn,
      state: signal(initialState()),
      subscription: null,
      retryTimeout: null,
    });
  }

  sourceState(name: string) {
    return this.sources.get(name)!.state.asReadonly();
  }

  refreshAll(force = false): void {
    if (this.refreshInProgress) return;
    this.refreshInProgress = true;

    let pending = 0;
    const done = () => {
      pending--;
      if (pending <= 0) this.refreshInProgress = false;
    };

    for (const source of this.sources.values()) {
      const st = source.state();
      if (!force && st.lastFetchTime && Date.now() - st.lastFetchTime < REFRESH_INTERVAL_MS) {
        continue;
      }
      this.clearRetry(source);
      pending++;
      this.fetchSource(source, done);
    }

    if (pending === 0) this.refreshInProgress = false;
  }

  refreshSource(name: string): void {
    const source = this.sources.get(name);
    if (!source) return;
    this.clearRetry(source);
    this.fetchSource(source, () => {});
  }

  private fetchSource(source: RegisteredSource, onDone: () => void): void {
    source.state.update((s) => ({ ...s, status: 'refreshing', retryAttempt: 0 }));
    source.subscription?.unsubscribe();
    source.subscription = source.fetchFn().subscribe({
      next: () => {
        source.state.set({ lastFetchTime: Date.now(), status: 'idle', retryAttempt: 0 });
        onDone();
      },
      error: () => {
        this.scheduleRetry(source, 0, onDone);
      },
    });
  }

  private scheduleRetry(source: RegisteredSource, attempt: number, onDone: () => void): void {
    if (attempt >= RETRY_DELAYS.length) {
      source.state.update((s) => ({ ...s, status: 'error', retryAttempt: 0 }));
      onDone();
      return;
    }
    source.state.update((s) => ({ ...s, status: 'retrying', retryAttempt: attempt + 1 }));
    source.retryTimeout = setTimeout(() => {
      source.subscription = source.fetchFn().subscribe({
        next: () => {
          source.state.set({ lastFetchTime: Date.now(), status: 'idle', retryAttempt: 0 });
          onDone();
        },
        error: () => {
          this.scheduleRetry(source, attempt + 1, onDone);
        },
      });
    }, RETRY_DELAYS[attempt]);
  }

  private clearRetry(source: RegisteredSource): void {
    if (source.retryTimeout) {
      clearTimeout(source.retryTimeout);
      source.retryTimeout = null;
    }
    source.subscription?.unsubscribe();
    source.subscription = null;
  }

  startPolling(): void {
    this.stopPolling();
    this.pollingTimer = setInterval(() => this.refreshAll(), REFRESH_INTERVAL_MS);
  }

  resetPollingTimer(): void {
    if (this.pollingTimer) {
      this.stopPolling();
      this.startPolling();
    }
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  onVisibilityRegained(): void {
    this.refreshAll();
  }

  startVisibilityListener(): void {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        this.onVisibilityRegained();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private stopVisibilityListener(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  destroy(): void {
    this.stopPolling();
    this.stopVisibilityListener();
    for (const source of this.sources.values()) {
      this.clearRetry(source);
    }
  }
}
