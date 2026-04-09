# Auto-Refresh & Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically keep Jira and Bitbucket data fresh via polling, visibility-regain, retry-on-error, and a manual sync button — without layout shifts.

**Architecture:** A new `DataRefreshService` orchestrates all refresh logic (when to fetch). Existing `JiraService` and `BitbucketService` keep their responsibility (how to fetch). A new `SyncBarComponent` at the bottom of the navigator shows last-updated timestamp and a sync button with spinning indicator. `WorkspaceService` registers data sources with the refresh service instead of calling fetch methods directly.

**Tech Stack:** Angular 21 (signals, standalone components, OnPush), RxJS, Vitest, Tailwind CSS with semantic tokens

---

## File Structure

| File                                                  | Role                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| Create: `src/app/shared/data-refresh.service.ts`      | Central refresh orchestration — polling, visibility, retry, staleness |
| Create: `src/app/shared/data-refresh.service.spec.ts` | Tests for refresh service                                             |
| Create: `src/app/shared/sync-bar/sync-bar.ts`         | Bottom bar component with timestamp + sync button                     |
| Create: `src/app/shared/sync-bar/sync-bar.html`       | Template for sync bar                                                 |
| Create: `src/app/shared/sync-bar/sync-bar.spec.ts`    | Tests for sync bar component                                          |
| Modify: `src/app/shared/workspace.service.ts`         | Register sources with refresh service instead of direct fetch         |
| Modify: `src/app/shared/workspace.service.spec.ts`    | Update tests for new init pattern                                     |
| Modify: `src/app/bitbucket/bitbucket.service.ts`      | Make `loadAll()` return Observable; skip loading state on re-fetch    |
| Modify: `src/app/shared/navigator/navigator.html`     | Add sync bar + "Erneut versuchen" links                               |
| Modify: `src/app/shared/navigator/navigator.ts`       | Import sync bar, inject refresh service for retry links               |

---

### Task 1: DataRefreshService — Core with Registration and refreshAll()

**Files:**

- Create: `src/app/shared/data-refresh.service.ts`
- Create: `src/app/shared/data-refresh.service.spec.ts`

- [ ] **Step 1: Write failing test — register and refreshAll triggers fetch functions**

```typescript
// src/app/shared/data-refresh.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { DataRefreshService } from './data-refresh.service';

describe('DataRefreshService', () => {
  let service: DataRefreshService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataRefreshService);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('calls registered fetch functions on refreshAll with force', () => {
    let jiraCalled = false;
    let bbCalled = false;
    service.register('jira', () => {
      jiraCalled = true;
      return of(undefined);
    });
    service.register('bitbucket', () => {
      bbCalled = true;
      return of(undefined);
    });

    service.refreshAll(true);

    expect(jiraCalled).toBe(true);
    expect(bbCalled).toBe(true);
  });

  it('sets source status to refreshing during fetch', () => {
    const subject = new Subject<void>();
    service.register('jira', () => subject.asObservable());

    service.refreshAll(true);

    expect(service.sourceState('jira')().status).toBe('refreshing');

    subject.next();
    subject.complete();

    expect(service.sourceState('jira')().status).toBe('idle');
  });

  it('updates lastFetchTime on successful fetch', () => {
    service.register('jira', () => of(undefined));

    expect(service.sourceState('jira')().lastFetchTime).toBeNull();

    service.refreshAll(true);

    expect(service.sourceState('jira')().lastFetchTime).toBeGreaterThan(0);
  });

  it('sets status to error on failed fetch', () => {
    service.register('jira', () => throwError(() => new Error('fail')));

    service.refreshAll(true);

    expect(service.sourceState('jira')().status).toBe('error');
  });

  it('exposes isRefreshing as true when any source is refreshing', () => {
    const subject = new Subject<void>();
    service.register('jira', () => subject.asObservable());
    service.register('bitbucket', () => of(undefined));

    service.refreshAll(true);

    expect(service.isRefreshing()).toBe(true);

    subject.next();
    subject.complete();

    expect(service.isRefreshing()).toBe(false);
  });

  it('ignores refreshAll while already refreshing', () => {
    let callCount = 0;
    const subject = new Subject<void>();
    service.register('jira', () => {
      callCount++;
      return subject.asObservable();
    });

    service.refreshAll(true);
    service.refreshAll(true);

    expect(callCount).toBe(1);

    subject.next();
    subject.complete();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: FAIL — `DataRefreshService` does not exist

- [ ] **Step 3: Write the DataRefreshService implementation**

```typescript
// src/app/shared/data-refresh.service.ts
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

  destroy(): void {
    for (const source of this.sources.values()) {
      this.clearRetry(source);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All DataRefreshService tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/data-refresh.service.ts src/app/shared/data-refresh.service.spec.ts
git commit -m "feat: add DataRefreshService with registration, refreshAll, and retry logic"
```

---

### Task 2: DataRefreshService — Polling and Visibility Triggers

**Files:**

- Modify: `src/app/shared/data-refresh.service.ts`
- Modify: `src/app/shared/data-refresh.service.spec.ts`

- [ ] **Step 1: Write failing tests for polling and visibility**

Append to `src/app/shared/data-refresh.service.spec.ts`:

```typescript
describe('DataRefreshService — polling', () => {
  let service: DataRefreshService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataRefreshService);
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('polls at REFRESH_INTERVAL_MS', () => {
    let callCount = 0;
    service.register('jira', () => {
      callCount++;
      return of(undefined);
    });

    service.startPolling();
    expect(callCount).toBe(0);

    vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
    expect(callCount).toBe(1);

    vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
    expect(callCount).toBe(2);
  });

  it('resetPollingTimer delays next poll', () => {
    let callCount = 0;
    service.register('jira', () => {
      callCount++;
      return of(undefined);
    });

    service.startPolling();
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS / 2);
    service.resetPollingTimer();
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS / 2);

    expect(callCount).toBe(0);

    vi.advanceTimersByTime(REFRESH_INTERVAL_MS / 2);
    expect(callCount).toBe(1);
  });
});

describe('DataRefreshService — visibility', () => {
  let service: DataRefreshService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataRefreshService);
  });

  afterEach(() => {
    service.destroy();
    TestBed.resetTestingModule();
  });

  it('refreshes stale sources on visibility regain', () => {
    let callCount = 0;
    service.register('jira', () => {
      callCount++;
      return of(undefined);
    });

    service.refreshAll(true);
    callCount = 0;

    const state = service.sourceState('jira');
    expect(state().lastFetchTime).not.toBeNull();

    // Simulate stale data by moving lastFetchTime back
    (service as any).sources.get('jira')!.state.update((s: DataSourceState) => ({
      ...s,
      lastFetchTime: Date.now() - REFRESH_INTERVAL_MS - 1000,
    }));

    service.onVisibilityRegained();
    expect(callCount).toBe(1);
  });

  it('does not refresh fresh sources on visibility regain', () => {
    let callCount = 0;
    service.register('jira', () => {
      callCount++;
      return of(undefined);
    });

    service.refreshAll(true);
    callCount = 0;

    service.onVisibilityRegained();
    expect(callCount).toBe(0);
  });
});
```

Add `vi` and `REFRESH_INTERVAL_MS, DataSourceState` to the imports at the top of the spec file:

```typescript
import { vi } from 'vitest';
import { DataRefreshService, REFRESH_INTERVAL_MS, DataSourceState } from './data-refresh.service';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: FAIL — `startPolling`, `resetPollingTimer`, `onVisibilityRegained` do not exist

- [ ] **Step 3: Add polling and visibility methods to DataRefreshService**

Add these methods and properties to the `DataRefreshService` class in `src/app/shared/data-refresh.service.ts`:

```typescript
private pollingTimer: ReturnType<typeof setInterval> | null = null;
private visibilityHandler: (() => void) | null = null;

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
```

Update `destroy()` to also clean up polling and visibility:

```typescript
destroy(): void {
  this.stopPolling();
  this.stopVisibilityListener();
  for (const source of this.sources.values()) {
    this.clearRetry(source);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/data-refresh.service.ts src/app/shared/data-refresh.service.spec.ts
git commit -m "feat: add polling and visibility-regain triggers to DataRefreshService"
```

---

### Task 3: Modify BitbucketService — Return Observable from loadAll, Skip Loading on Re-fetch

**Files:**

- Modify: `src/app/bitbucket/bitbucket.service.ts`
- Modify: `src/app/bitbucket/bitbucket.service.spec.ts` (if exists, update affected tests)

- [ ] **Step 1: Write failing test — loadAll returns Observable and skips loading on re-fetch**

Create or append to `src/app/bitbucket/bitbucket.service.spec.ts`:

```typescript
// If this file doesn't exist, check existing tests and adapt.
// The key behavior to verify:
// 1. loadAll() returns an Observable (not void)
// 2. On second call, loading signal stays false
```

- [ ] **Step 2: Modify BitbucketService.loadAll() to return Observable and skip loading on re-fetch**

In `src/app/bitbucket/bitbucket.service.ts`, change the `loadAll()` method:

Change the return type from `void` to `Observable<unknown>` and replace `.subscribe()` at the end with returning the observable. Add a `hasLoadedOnce` flag to skip setting `loading` to `true` on subsequent fetches.

Add a private field:

```typescript
private hasLoadedOnce = false;
```

Change `loadAll(): void {` to `loadAll(): Observable<unknown> {` and replace the entire method body:

```typescript
loadAll(): Observable<unknown> {
  if (!this.hasLoadedOnce) {
    this.loading.set(true);
  }
  this.error.set(false);

  return forkJoin([
    this.getReviewerPullRequests(),
    this.getAuthoredPullRequests().pipe(catchError(() => of([] as PullRequest[]))),
  ]).pipe(
    tap(([reviewerPrs, authoredPrs]) => {
      this.loading.set(false);
      this.hasLoadedOnce = true;
      const reviewerIds = new Set(reviewerPrs.map((pr) => pr.id));
      const dedupedAuthored = authoredPrs.filter((pr) => !reviewerIds.has(pr.id));
      this._rawPullRequests.set([...reviewerPrs, ...dedupedAuthored]);
    }),
    switchMap(([reviewerPrs, authoredPrs]) => {
      const enrichments: Observable<unknown>[] = [];

      const needsWorkPrs = reviewerPrs.filter(
        (pr) => pr.myReviewStatus === 'Changes Requested',
      );
      if (needsWorkPrs.length > 0) {
        enrichments.push(
          forkJoin(
            needsWorkPrs.map((pr) =>
              this.getReviewerPrActivityStatus(pr).pipe(
                catchError(() => of('Changes Requested' as const)),
              ),
            ),
          ).pipe(
            tap((results) => {
              const statusById = new Map(needsWorkPrs.map((pr, i) => [pr.id, results[i]]));
              this._rawPullRequests.update((all) =>
                all.map((pr) => {
                  const enriched = statusById.get(pr.id);
                  return enriched ? { ...pr, myReviewStatus: enriched } : pr;
                }),
              );
            }),
          ),
        );
      }

      const reviewerIds = new Set(reviewerPrs.map((pr) => pr.id));
      const dedupedAuthored = authoredPrs.filter((pr) => !reviewerIds.has(pr.id));
      if (dedupedAuthored.length > 0) {
        enrichments.push(
          forkJoin(
            dedupedAuthored.map((pr) =>
              this.getBuildStatusStats(pr.fromRef.latestCommit).pipe(
                catchError(() => of({ successful: 0, failed: 0, inProgress: 0 })),
              ),
            ),
          ).pipe(
            tap((results) => {
              const buildById = new Map(dedupedAuthored.map((pr, i) => [pr.id, results[i]]));
              this._rawPullRequests.update((all) =>
                all.map((pr) => {
                  const build = buildById.get(pr.id);
                  return build ? { ...pr, buildStatus: build } : pr;
                }),
              );
            }),
          ),
        );
      }

      const allPrs = [...reviewerPrs, ...dedupedAuthored];
      if (allPrs.length > 0) {
        enrichments.push(
          forkJoin(
            allPrs.map((pr) =>
              this.getDiffstat(
                pr.fromRef.repository.projectKey,
                pr.fromRef.repository.slug,
                pr.prNumber,
              ),
            ),
          ).pipe(
            tap((results) => {
              const diffstatById = new Map(allPrs.map((pr, i) => [pr.id, results[i]]));
              this._rawPullRequests.update((all) =>
                all.map((pr) => {
                  const diffstat = diffstatById.get(pr.id);
                  return diffstat ? { ...pr, diffstat } : pr;
                }),
              );
            }),
          ),
        );
      }

      return enrichments.length > 0 ? forkJoin(enrichments) : of(null);
    }),
    catchError((err) => {
      console.error('Failed to load Bitbucket pull requests:', err);
      this.error.set(true);
      if (!this.hasLoadedOnce) {
        this.loading.set(false);
      }
      return throwError(() => err);
    }),
  );
}
```

Add `throwError` to the rxjs import at the top of the file:

```typescript
import { forkJoin, Observable, of, throwError } from 'rxjs';
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 4: Run build to check for compilation errors**

Run: `npx ng build 2>&1 | tail -20`
Expected: Build succeeds (note: `WorkspaceService` still calls `loadAll()` without subscribing — that's fine for now since it will be changed in Task 5)

- [ ] **Step 5: Commit**

```bash
git add src/app/bitbucket/bitbucket.service.ts
git commit -m "refactor: make BitbucketService.loadAll return Observable and skip loading on re-fetch"
```

---

### Task 4: Wrap JiraService Fetch for Refresh Integration

**Files:**

- Modify: `src/app/jira/jira.service.ts`

The `JiraService.getAssignedActiveTickets()` already returns an `Observable<JiraTicket[]>`, which is exactly what the refresh service needs. However, we need `WorkspaceService` to have a callable method that re-triggers the fetch. Currently the tickets observable is created once via `toSignal`. We need to add a method that can be called repeatedly.

- [ ] **Step 1: Add a loadTickets() method to JiraService that returns Observable and updates internal state**

Add a signal-based state and a `loadTickets()` method to `JiraService`. Add these to `src/app/jira/jira.service.ts`:

At the top of the class, add:

```typescript
private hasLoadedOnce = false;
readonly loading = signal(true);
readonly error = signal(false);
private readonly _tickets = signal<JiraTicket[]>([]);
readonly tickets = this._tickets.asReadonly();
```

Add the imports for `signal` from `@angular/core`.

Then add a `loadTickets()` method:

```typescript
loadTickets(): Observable<unknown> {
  if (!this.hasLoadedOnce) {
    this.loading.set(true);
  }
  this.error.set(false);

  return this.getAssignedActiveTickets().pipe(
    tap((tickets) => {
      this._tickets.set(tickets);
      this.loading.set(false);
      this.hasLoadedOnce = true;
    }),
    catchError((err) => {
      console.error('Failed to load Jira tickets:', err);
      this.error.set(true);
      if (!this.hasLoadedOnce) {
        this.loading.set(false);
      }
      return throwError(() => err);
    }),
  );
}
```

Add `throwError` to the rxjs import and `signal` to the Angular import, and add `tap` to the operators import:

```typescript
import { inject, Injectable, signal } from '@angular/core';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
```

- [ ] **Step 2: Run tests to verify nothing breaks**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/jira/jira.service.ts
git commit -m "feat: add loadTickets method and signal-based state to JiraService"
```

---

### Task 5: Rewire WorkspaceService to Use DataRefreshService

**Files:**

- Modify: `src/app/shared/workspace.service.ts`
- Modify: `src/app/shared/workspace.service.spec.ts`

- [ ] **Step 1: Write failing test — WorkspaceService registers sources with DataRefreshService**

Replace the contents of `src/app/shared/workspace.service.spec.ts`:

```typescript
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Idea, JiraTicket, PullRequest, Todo } from './work-item.model';
import { JiraService } from '../jira/jira.service';
import { BitbucketService } from '../bitbucket/bitbucket.service';
import { DataRefreshService } from './data-refresh.service';
import { WorkspaceService } from './workspace.service';
import { IdeaService } from '../ideas/idea.service';
import { TodoService } from '../todos/todo.service';

const mockJira = {
  tickets: signal<JiraTicket[]>([]),
  loading: signal(false),
  error: signal(false),
  loadTickets: () => of(undefined),
};

const mockBitbucket = {
  pullRequests: signal<PullRequest[]>([]),
  reviewPullRequests: signal<PullRequest[]>([]),
  myPullRequests: signal<PullRequest[]>([]),
  loading: signal(false),
  error: signal(false),
  awaitingReviewCount: signal(0),
  loadAll: () => of(undefined),
};

describe('WorkspaceService', () => {
  let registeredSources: Map<string, () => unknown>;
  let refreshAllCalled: boolean;

  beforeEach(() => {
    registeredSources = new Map();
    refreshAllCalled = false;

    TestBed.configureTestingModule({
      providers: [
        WorkspaceService,
        { provide: JiraService, useValue: mockJira },
        { provide: BitbucketService, useValue: mockBitbucket },
        {
          provide: DataRefreshService,
          useValue: {
            register: (name: string, fn: () => unknown) => registeredSources.set(name, fn),
            refreshAll: (force: boolean) => {
              refreshAllCalled = true;
            },
            startPolling: () => {},
            startVisibilityListener: () => {},
          },
        },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('registers jira and bitbucket sources with DataRefreshService', () => {
    TestBed.inject(WorkspaceService);
    expect(registeredSources.has('jira')).toBe(true);
    expect(registeredSources.has('bitbucket')).toBe(true);
  });

  it('triggers initial refreshAll on construction', () => {
    TestBed.inject(WorkspaceService);
    expect(refreshAllCalled).toBe(true);
  });

  it('exposes tickets from JiraService', () => {
    const service = TestBed.inject(WorkspaceService);
    expect(service.tickets).toBe(mockJira.tickets);
  });

  it('exposes pullRequests from BitbucketService', () => {
    const service = TestBed.inject(WorkspaceService);
    expect(service.pullRequests).toBe(mockBitbucket.pullRequests);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: FAIL — WorkspaceService tests fail because it doesn't use DataRefreshService yet

- [ ] **Step 3: Rewrite WorkspaceService to use DataRefreshService**

Replace `src/app/shared/workspace.service.ts`:

```typescript
import { effect, inject, Injectable, untracked } from '@angular/core';
import { Idea, JiraTicket, PullRequest, Todo, WorkItem } from './work-item.model';
import { JiraService } from '../jira/jira.service';
import { BitbucketService } from '../bitbucket/bitbucket.service';
import { TodoService } from '../todos/todo.service';
import { IdeaService } from '../ideas/idea.service';
import { TicketSubtaskService } from '../jira/ticket-subtask.service';
import { DataRefreshService } from './data-refresh.service';
import { signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly jira = inject(JiraService);
  private readonly bitbucket = inject(BitbucketService);
  private readonly todoService = inject(TodoService);
  private readonly ideaService = inject(IdeaService);
  private readonly ticketSubtasks = inject(TicketSubtaskService);
  private readonly refreshService = inject(DataRefreshService);

  readonly tickets = this.jira.tickets;
  readonly ticketsLoading = this.jira.loading;
  readonly ticketsError = this.jira.error;

  readonly pullRequests = this.bitbucket.pullRequests;
  readonly reviewPullRequests = this.bitbucket.reviewPullRequests;
  readonly myPullRequests = this.bitbucket.myPullRequests;
  readonly pullRequestsLoading = this.bitbucket.loading;
  readonly pullRequestsError = this.bitbucket.error;
  readonly awaitingReviewCount = this.bitbucket.awaitingReviewCount;

  readonly selectedItem = signal<WorkItem | null>(null);
  readonly reflectionSelected = signal(false);

  constructor() {
    this.refreshService.register('jira', () => this.jira.loadTickets());
    this.refreshService.register('bitbucket', () => this.bitbucket.loadAll());
    this.refreshService.refreshAll(true);
    this.refreshService.startPolling();
    this.refreshService.startVisibilityListener();

    effect(() => {
      const keys = this.tickets().map((t) => t.key);
      if (keys.length > 0) {
        untracked(() => this.ticketSubtasks.preloadKeys(keys));
      }
    });
  }

  select(item: WorkItem): void {
    this.reflectionSelected.set(false);
    this.selectedItem.set(item);
  }

  selectReflection(): void {
    this.selectedItem.set(null);
    this.reflectionSelected.set(true);
  }

  promoteToTodo(idea: Idea): void {
    this.ideaService.update({ ...idea, status: 'wont-do' });
    const todo = this.todoService.add(idea.title, idea.description);
    this.selectedItem.set(todo);
  }

  demoteToIdea(todo: Todo): void {
    this.todoService.remove(todo.id);
    const idea = this.ideaService.add(todo.title, todo.description);
    this.selectedItem.set(idea);
  }

  findTicketByKey(key: string): JiraTicket | undefined {
    return this.tickets().find((t) => t.key === key);
  }

  findPrByRoute(project: string, repo: string, prNumber: number): PullRequest | undefined {
    const id = `${project}/${repo}/${prNumber}`;
    return this.pullRequests().find((p) => p.id === id);
  }

  findTodoById(id: string): Todo | undefined {
    return this.todoService.todos().find((t) => t.id === id);
  }

  findIdeaById(id: string): Idea | undefined {
    return this.ideaService.ideas().find((i) => i.id === id);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Run build**

Run: `npx ng build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/workspace.service.ts src/app/shared/workspace.service.spec.ts
git commit -m "refactor: rewire WorkspaceService to use DataRefreshService for data fetching"
```

---

### Task 6: SyncBarComponent

**Files:**

- Create: `src/app/shared/sync-bar/sync-bar.ts`
- Create: `src/app/shared/sync-bar/sync-bar.html`
- Create: `src/app/shared/sync-bar/sync-bar.spec.ts`

- [ ] **Step 1: Write failing test for SyncBarComponent**

```typescript
// src/app/shared/sync-bar/sync-bar.spec.ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SyncBarComponent } from './sync-bar';
import { DataRefreshService } from '../data-refresh.service';

describe('SyncBarComponent', () => {
  let fixture: ComponentFixture<SyncBarComponent>;

  const mockRefreshService = {
    globalStatus: signal<'idle' | 'refreshing' | 'retrying' | 'error'>('idle'),
    lastGlobalFetchTime: signal<Date | null>(null),
    retryInfo: signal<{ attempt: number; maxAttempts: number } | null>(null),
    isRefreshing: signal(false),
    refreshAll: vi.fn(),
    resetPollingTimer: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [SyncBarComponent],
      providers: [{ provide: DataRefreshService, useValue: mockRefreshService }],
    });
    fixture = TestBed.createComponent(SyncBarComponent);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('renders', () => {
    expect(fixture.nativeElement).toBeTruthy();
  });

  it('shows timestamp when idle with data', () => {
    mockRefreshService.lastGlobalFetchTime.set(new Date(2026, 2, 29, 14, 32));
    mockRefreshService.globalStatus.set('idle');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('14:32');
  });

  it('shows "Aktualisiere…" when refreshing', () => {
    mockRefreshService.globalStatus.set('refreshing');
    mockRefreshService.isRefreshing.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Aktualisiere');
  });

  it('shows retry info when retrying', () => {
    mockRefreshService.globalStatus.set('retrying');
    mockRefreshService.isRefreshing.set(true);
    mockRefreshService.retryInfo.set({ attempt: 2, maxAttempts: 3 });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('2/3');
  });

  it('calls refreshAll and resetPollingTimer on sync click', () => {
    const btn = fixture.nativeElement.querySelector('button');
    btn.click();

    expect(mockRefreshService.refreshAll).toHaveBeenCalledWith(true);
    expect(mockRefreshService.resetPollingTimer).toHaveBeenCalled();
  });
});
```

Add import at the top:

```typescript
import { vi } from 'vitest';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: FAIL — SyncBarComponent does not exist

- [ ] **Step 3: Create SyncBarComponent template**

```html
<!-- src/app/shared/sync-bar/sync-bar.html -->
<div class="flex items-center justify-between">
  <span class="text-[10px] text-[var(--color-text-muted)] truncate">
    @switch (refreshService.globalStatus()) { @case ('refreshing') { Aktualisiere… } @case
    ('retrying') { @if (refreshService.retryInfo(); as info) { Erneuter Versuch {{ info.attempt
    }}/{{ info.maxAttempts }}… } } @case ('error') { Aktualisierung fehlgeschlagen } @default { @if
    (refreshService.lastGlobalFetchTime(); as time) { Zuletzt aktualisiert: {{ formattedTime() }} }
    @else { Noch nicht aktualisiert } } }
  </span>

  <button
    type="button"
    class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-[var(--color-text-body)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-card)] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
    (click)="onSync()"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      [class.animate-spin]="refreshService.isRefreshing()"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
    Sync
  </button>
</div>
```

- [ ] **Step 4: Create SyncBarComponent class**

```typescript
// src/app/shared/sync-bar/sync-bar.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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

  protected readonly formattedTime = computed(() => {
    const time = this.refreshService.lastGlobalFetchTime();
    if (!time) return '';
    return time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  });

  protected onSync(): void {
    this.refreshService.refreshAll(true);
    this.refreshService.resetPollingTimer();
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/sync-bar/
git commit -m "feat: add SyncBarComponent with timestamp display and manual sync button"
```

---

### Task 7: Integrate SyncBar into Navigator and Add "Erneut versuchen" Links

**Files:**

- Modify: `src/app/shared/navigator/navigator.html`
- Modify: `src/app/shared/navigator/navigator.ts`

- [ ] **Step 1: Add SyncBarComponent import and DataRefreshService injection to NavigatorComponent**

In `src/app/shared/navigator/navigator.ts`, add imports:

```typescript
import { SyncBarComponent } from '../sync-bar/sync-bar';
import { DataRefreshService } from '../data-refresh.service';
```

Add `SyncBarComponent` to the `imports` array in the `@Component` decorator.

Add injection in the class:

```typescript
protected readonly refreshService = inject(DataRefreshService);
```

Add a retry method:

```typescript
retrySource(name: string): void {
  this.refreshService.refreshSource(name);
}
```

- [ ] **Step 2: Add sync bar to navigator template**

In `src/app/shared/navigator/navigator.html`, change the outermost structure. The current template wraps everything in `<nav class="flex flex-col h-full">` with a header div and a scrollable content div. Add the sync bar after the scrollable div, before the closing `</nav>`:

Replace the closing `</div>` and `</nav>` at the end of the file (lines 304-305):

```html
  </div>

  <app-sync-bar />
</nav>
```

- [ ] **Step 3: Add "Erneut versuchen" links to error states**

In `src/app/shared/navigator/navigator.html`, replace the tickets error message (line 83):

```html
} @else if (data.ticketsError()) {
<div class="px-1 py-2" role="alert">
  <p class="text-xs text-[var(--color-danger-solid)]">Tickets konnten nicht geladen werden.</p>
  <button
    type="button"
    class="mt-1 text-xs text-[var(--color-primary-text)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
    (click)="retrySource('jira')"
  >
    Erneut versuchen
  </button>
</div>
```

Replace the PRs error message (line 134):

```html
} @else if (data.pullRequestsError()) {
<div class="px-1 py-2" role="alert">
  <p class="text-xs text-[var(--color-danger-solid)]">
    Pull Requests konnten nicht geladen werden.
  </p>
  <button
    type="button"
    class="mt-1 text-xs text-[var(--color-primary-text)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
    (click)="retrySource('bitbucket')"
  >
    Erneut versuchen
  </button>
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Run build**

Run: `npx ng build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/navigator/navigator.ts src/app/shared/navigator/navigator.html
git commit -m "feat: integrate SyncBar into navigator and add retry links to error states"
```

---

### Task 8: Final Integration Test and Cleanup

**Files:**

- All modified files
- Build verification

- [ ] **Step 1: Run full test suite**

Run: `npx ng test --no-watch 2>&1`
Expected: All tests PASS

- [ ] **Step 2: Run full build**

Run: `npx ng build 2>&1`
Expected: Build succeeds with no errors

- [ ] **Step 3: Manual verification checklist**

Start the app with `npm start` and verify:

1. App loads — tickets and PRs appear as before
2. Sync bar appears at the bottom of the navigator with timestamp
3. Clicking "Sync" triggers a refresh (icon spins, data reloads)
4. After 10 minutes, auto-refresh triggers
5. Switching away and back to the Orbit tab refreshes stale data
6. If Jira/Bitbucket is unreachable, retries happen (visible in sync bar)
7. After retries exhaust, error message shows with "Erneut versuchen" link
8. During refresh, old data stays visible (no layout shift)

- [ ] **Step 4: Commit any fixes**

If any issues found during manual testing, fix and commit.

- [ ] **Step 5: Final commit (if needed)**

```bash
git add -A
git commit -m "chore: final integration fixes for auto-refresh feature"
```
