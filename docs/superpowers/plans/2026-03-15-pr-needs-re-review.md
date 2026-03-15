# PR "Needs Re-review" Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change "Changes Requested" PRs to show grey by default, and amber "Needs Re-review" when any activity occurred after the user's NEEDS_WORK review.

**Architecture:** Two-phase load in `WorkDataService`: initial PR list loads immediately, then a background enrichment pass fires parallel activity API calls for NEEDS_WORK PRs and patches the signal by PR id. All new data flows through `BitbucketService` via the existing `config$` pattern.

**Tech Stack:** Angular 20 (signals, zoneless), RxJS (`forkJoin`, `switchMap`, `catchError`), Vitest via `@angular/build:unit-test`, `HttpTestingController` for HTTP mocks.

---

## File Map

| File | Change |
|---|---|
| `src/app/models/work-item.model.ts` | Add `'Needs Re-review'` to `PrStatus` union |
| `src/app/services/bitbucket.service.ts` | Add raw interfaces + `getReviewerPrActivityStatus()` method |
| `src/app/services/bitbucket.service.spec.ts` | Add tests for new method |
| `src/app/services/work-data.service.ts` | Add enrichment pass in subscribe; update sort order + `awaitingReviewCount` |
| `src/app/services/work-data.service.spec.ts` | Add enrichment tests; update `awaitingReviewCount` test |
| `src/app/components/pr-card/pr-card.ts` | Update `statusClass()` map type and values; add `aria-label` to badge |
| `mock-server/bitbucket.js` | Add second NEEDS_WORK PR + activities endpoint |

---

## Chunk 1: Data Model + BitbucketService

### Task 1: Extend PrStatus type

**Files:**
- Modify: `src/app/models/work-item.model.ts:3`

- [ ] **Step 1: Add `'Needs Re-review'` to the `PrStatus` union**

Replace line 3:
```ts
export type PrStatus = 'Awaiting Review' | 'Changes Requested' | 'Needs Re-review' | 'Approved' | 'Approved by Others';
```

- [ ] **Step 2: Verify the project still compiles (TypeScript will show exhaustiveness errors in files that use `Record<PrStatus, ...>`)**

```bash
cd /Users/dominik/dev/other/orbit && npx tsc --noEmit
```

Expected: errors in `work-data.service.ts` and `pr-card.ts` about missing `'Needs Re-review'` key. Those are fixed in later tasks. If errors appear in unexpected files, investigate before continuing.

---

### Task 2: Add `getReviewerPrActivityStatus` to BitbucketService — test first

**Files:**
- Modify: `src/app/services/bitbucket.service.spec.ts`
- Modify: `src/app/services/bitbucket.service.ts`

- [ ] **Step 1: Add test helpers and test cases to `bitbucket.service.spec.ts`**

Add after the closing `});` of the existing `describe('BitbucketService', ...)` block:

```ts
const makePrRef = (): Pick<PullRequest, 'prNumber' | 'toRef'> => ({
  prNumber: 89,
  toRef: {
    id: 'refs/heads/main',
    displayId: 'main',
    latestCommit: 'f6g7h8i9',
    repository: {
      id: 2,
      slug: 'versicherung-shared-lib',
      name: 'versicherung-shared-lib',
      projectKey: 'SL',
      projectName: 'Versicherung Shared Lib',
      browseUrl: '',
    },
  },
});

const makeActivity = (action: string, slug: string, reviewedStatus?: 'APPROVED' | 'NEEDS_WORK' | 'UNAPPROVED') => ({
  action,
  user: { id: 1, name: slug, slug, displayName: 'User', emailAddress: `${slug}@example.org`, active: true, type: 'NORMAL' },
  ...(reviewedStatus !== undefined ? { reviewedStatus } : {}),
});

const flushActivity = (httpTesting: HttpTestingController, activities: ReturnType<typeof makeActivity>[]) => {
  httpTesting.expectOne(req => req.url.endsWith('/config')).flush({ bitbucketUserSlug: 'dominik.mueller' });
  httpTesting
    .expectOne(req => req.url.includes('/activities'))
    .flush({ values: activities, isLastPage: true });
};

describe('BitbucketService — getReviewerPrActivityStatus', () => {
  let service: BitbucketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BitbucketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('returns Changes Requested when NEEDS_WORK is the newest activity', () => {
    let result: string | undefined;
    service.getReviewerPrActivityStatus(makePrRef()).subscribe(s => (result = s));
    flushActivity(httpTesting, [
      makeActivity('REVIEWED', 'dominik.mueller', 'NEEDS_WORK'),
      makeActivity('COMMENTED', 'sarah.kowalski'),
    ]);
    expect(result).toBe('Changes Requested');
  });

  it('returns Needs Re-review when a newer activity follows the NEEDS_WORK review', () => {
    let result: string | undefined;
    service.getReviewerPrActivityStatus(makePrRef()).subscribe(s => (result = s));
    flushActivity(httpTesting, [
      makeActivity('COMMENTED', 'anna.lehmann'),
      makeActivity('REVIEWED', 'dominik.mueller', 'NEEDS_WORK'),
    ]);
    expect(result).toBe('Needs Re-review');
  });

  it('returns Changes Requested when no NEEDS_WORK review exists', () => {
    let result: string | undefined;
    service.getReviewerPrActivityStatus(makePrRef()).subscribe(s => (result = s));
    flushActivity(httpTesting, [
      makeActivity('COMMENTED', 'dominik.mueller'),
    ]);
    expect(result).toBe('Changes Requested');
  });

  it('returns Changes Requested on API error', () => {
    let result: string | undefined;
    service.getReviewerPrActivityStatus(makePrRef()).subscribe(s => (result = s));
    httpTesting.expectOne(req => req.url.endsWith('/config')).flush({ bitbucketUserSlug: 'dominik.mueller' });
    httpTesting
      .expectOne(req => req.url.includes('/activities'))
      .flush('error', { status: 500, statusText: 'Internal Server Error' });
    expect(result).toBe('Changes Requested');
  });

  it('requests the correct activities URL', () => {
    service.getReviewerPrActivityStatus(makePrRef()).subscribe();
    httpTesting.expectOne(req => req.url.endsWith('/config')).flush({ bitbucketUserSlug: 'dominik.mueller' });
    const req = httpTesting.expectOne(req => req.url.includes('/activities'));
    expect(req.request.url).toContain('/projects/SL/repos/versicherung-shared-lib/pull-requests/89/activities');
    req.flush({ values: [], isLastPage: true });
  });
});
```

- [ ] **Step 2: Run tests to confirm they all fail (method doesn't exist yet)**

```bash
cd /Users/dominik/dev/other/orbit && ng test --no-watch 2>&1 | grep -E "(FAIL|PASS|getReviewerPrActivityStatus)"
```

Expected: multiple failures mentioning `getReviewerPrActivityStatus is not a function`.

- [ ] **Step 3: Add raw interfaces and implement `getReviewerPrActivityStatus` in `bitbucket.service.ts`**

First, update the imports. The current `bitbucket.service.ts` imports are:
```ts
import { Observable } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
```

Update them to:
```ts
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
```

Then add these two interfaces after the existing `BitbucketPrPageRaw` interface (after line 80):

```ts
interface BitbucketActivityRaw {
  action: string;
  user: BitbucketUserRaw;
  reviewedStatus?: 'APPROVED' | 'NEEDS_WORK' | 'UNAPPROVED';
}

interface BitbucketActivityPageRaw {
  values: BitbucketActivityRaw[];
  isLastPage: boolean;
}
```

Add the following method to `BitbucketService`, after `getReviewerPullRequests()`:

```ts
getReviewerPrActivityStatus(pr: Pick<PullRequest, 'prNumber' | 'toRef'>): Observable<'Changes Requested' | 'Needs Re-review'> {
  const { projectKey } = pr.toRef.repository;
  const repoSlug = pr.toRef.repository.slug;
  const prId = pr.prNumber;

  return this.config$.pipe(
    switchMap(config =>
      this.http
        .get<BitbucketActivityPageRaw>(
          `${this.baseUrl}/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}/activities`
        )
        .pipe(
          map(page => {
            const activities = page.values;
            const needsWorkIndex = activities.findIndex(
              a =>
                a.action === 'REVIEWED' &&
                a.user.slug === config.bitbucketUserSlug &&
                a.reviewedStatus === 'NEEDS_WORK'
            );
            if (needsWorkIndex === -1) return 'Changes Requested' as const;
            return needsWorkIndex > 0 ? ('Needs Re-review' as const) : ('Changes Requested' as const);
          }),
          catchError(() => of('Changes Requested' as const))
        )
    )
  );
}
```

- [ ] **Step 4: Run the new tests**

```bash
cd /Users/dominik/dev/other/orbit && ng test --no-watch 2>&1 | grep -E "(FAIL|PASS|✓|✗)"
```

Expected: all 5 new tests pass. All existing tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/dominik/dev/other/orbit && git add src/app/models/work-item.model.ts src/app/services/bitbucket.service.ts src/app/services/bitbucket.service.spec.ts && git commit -m "feat: add getReviewerPrActivityStatus to BitbucketService"
```

---

## Chunk 2: WorkDataService Enrichment

### Task 3: Add enrichment pass — test first

**Files:**
- Modify: `src/app/services/work-data.service.spec.ts`
- Modify: `src/app/services/work-data.service.ts`

- [ ] **Step 1: Add enrichment tests to `work-data.service.spec.ts`**

First, update the existing `awaitingReviewCount` test to also count `'Needs Re-review'` (find and replace the test body):

```ts
it('awaitingReviewCount counts Awaiting Review and Needs Re-review PRs', () => {
  const prs = [makePr('Awaiting Review'), makePr('Needs Re-review'), makePr('Approved')];
  const mockBitbucket = {
    getReviewerPullRequests: () => of(prs),
    getReviewerPrActivityStatus: () => of('Changes Requested' as const),
  };
  TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
  const service = TestBed.inject(WorkDataService);
  TestBed.tick();
  expect(service.awaitingReviewCount()).toBe(2);
});
```

Then add a new `describe` block after the existing `'WorkDataService — pullRequests loading'` block:

```ts
describe('WorkDataService — enrichment', () => {
  const mockJira = { getAssignedActiveTickets: () => of([]) };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    TestBed.overrideProvider(JiraService, { useValue: mockJira });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('patches a Changes Requested PR to Needs Re-review when activity check returns Needs Re-review', () => {
    const pr = makePr('Changes Requested');
    const mockBitbucket = {
      getReviewerPullRequests: () => of([pr]),
      getReviewerPrActivityStatus: () => of('Needs Re-review' as const),
    };
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    const service = TestBed.inject(WorkDataService);
    TestBed.tick();
    expect(service.pullRequests()[0].myReviewStatus).toBe('Needs Re-review');
  });

  it('keeps a Changes Requested PR as Changes Requested when activity check returns Changes Requested', () => {
    const pr = makePr('Changes Requested');
    const mockBitbucket = {
      getReviewerPullRequests: () => of([pr]),
      getReviewerPrActivityStatus: () => of('Changes Requested' as const),
    };
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    const service = TestBed.inject(WorkDataService);
    TestBed.tick();
    expect(service.pullRequests()[0].myReviewStatus).toBe('Changes Requested');
  });

  it('does not affect PRs with other statuses during enrichment', () => {
    const awaiting = makePr('Awaiting Review');
    const changesRequested = makePr('Changes Requested');
    const mockBitbucket = {
      getReviewerPullRequests: () => of([awaiting, changesRequested]),
      getReviewerPrActivityStatus: () => of('Needs Re-review' as const),
    };
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    const service = TestBed.inject(WorkDataService);
    TestBed.tick();
    const statuses = service.pullRequests().map(pr => pr.myReviewStatus);
    expect(statuses).toContain('Awaiting Review');
    expect(statuses).toContain('Needs Re-review');
    expect(statuses).not.toContain('Changes Requested');
  });

  it('does not call getReviewerPrActivityStatus when no Changes Requested PRs exist', () => {
    const activitySpy = vi.fn().mockReturnValue(of('Changes Requested' as const));
    const mockBitbucket = {
      getReviewerPullRequests: () => of([makePr('Awaiting Review')]),
      getReviewerPrActivityStatus: activitySpy,
    };
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    TestBed.inject(WorkDataService);
    TestBed.tick();
    expect(activitySpy).not.toHaveBeenCalled();
  });

  it('sorts Needs Re-review before Changes Requested after enrichment promotes one PR', () => {
    // Both PRs start as 'Changes Requested'; enrichment promotes pr2 to 'Needs Re-review'
    const pr1 = { ...makePr('Changes Requested'), id: 'P/repo/1' };
    const pr2 = { ...makePr('Changes Requested'), id: 'P/repo/2' };
    const mockBitbucket = {
      getReviewerPullRequests: () => of([pr1, pr2]),
      getReviewerPrActivityStatus: (pr: Pick<PullRequest, 'prNumber' | 'toRef'>) =>
        of((pr as PullRequest).id === 'P/repo/2' ? ('Needs Re-review' as const) : ('Changes Requested' as const)),
    };
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    const service = TestBed.inject(WorkDataService);
    TestBed.tick();
    const sorted = service.pullRequests();
    expect(sorted[0].myReviewStatus).toBe('Needs Re-review');
    expect(sorted[1].myReviewStatus).toBe('Changes Requested');
  });
});
```

Note: `vi` is the Vitest global for spies — it is available in this test environment without import.

- [ ] **Step 2: Run tests to confirm new tests fail**

```bash
cd /Users/dominik/dev/other/orbit && ng test --no-watch 2>&1 | grep -E "(FAIL|PASS|enrichment)"
```

Expected: the enrichment describe block tests fail.

- [ ] **Step 3: Update `work-data.service.ts`**

**3a.** Add `forkJoin` to the RxJS imports at the top:

```ts
import { catchError, tap } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
```

(Replace `import { of } from 'rxjs';` with `import { forkJoin, of } from 'rxjs';`)

**3b.** Update the `statusOrder` map in the `pullRequests` computed signal (currently lines 34–39). Replace:

```ts
const statusOrder: Record<PrStatus, number> = {
  'Awaiting Review': 0,
  'Changes Requested': 1,
  'Approved by Others': 2,
  'Approved': 3,
};
```

With:

```ts
const statusOrder: Record<PrStatus, number> = {
  'Awaiting Review': 0,
  'Needs Re-review': 1,
  'Changes Requested': 2,
  'Approved by Others': 3,
  'Approved': 4, // filtered out before sort; present only for Record<PrStatus, number> exhaustiveness
};
```

**3c.** Update `awaitingReviewCount` (currently line 101):

```ts
readonly awaitingReviewCount = computed(() =>
  this.pullRequests().filter(
    pr => pr.myReviewStatus === 'Awaiting Review' || pr.myReviewStatus === 'Needs Re-review'
  ).length
);
```

**3d.** Update the subscribe callback in the constructor to add the enrichment pass. Replace the current `.subscribe(prs => this._rawPullRequests.set(prs));` with:

```ts
.subscribe(prs => {
  this._rawPullRequests.set(prs);

  const needsWorkPrs = prs.filter(pr => pr.myReviewStatus === 'Changes Requested');
  if (needsWorkPrs.length === 0) return;

  forkJoin(
    needsWorkPrs.map(pr =>
      this.bitbucket.getReviewerPrActivityStatus(pr).pipe(
        catchError(() => of('Changes Requested' as const))
      )
    )
  ).subscribe(results => {
    const statusById = new Map(needsWorkPrs.map((pr, i) => [pr.id, results[i]]));
    this._rawPullRequests.update(all =>
      all.map(pr => {
        const enriched = statusById.get(pr.id);
        return enriched ? { ...pr, myReviewStatus: enriched } : pr;
      })
    );
  });
});
```

- [ ] **Step 4: Run all tests**

```bash
cd /Users/dominik/dev/other/orbit && ng test --no-watch 2>&1 | grep -E "(FAIL|PASS|✓|✗)"
```

Expected: all tests pass, including the 5 new enrichment tests and the updated `awaitingReviewCount` test.

- [ ] **Step 5: Commit**

```bash
cd /Users/dominik/dev/other/orbit && git add src/app/services/work-data.service.ts src/app/services/work-data.service.spec.ts && git commit -m "feat: enrich Changes Requested PRs with activity check in WorkDataService"
```

---

## Chunk 3: Visual Layer + Mock Server

### Task 4: Update PrCardComponent badge styles

**Files:**
- Modify: `src/app/components/pr-card/pr-card.ts`

The badge `<span>` currently has no `aria-label`. For the `'Needs Re-review'` status, add a German `aria-label` since the label text is English in a German-language UI.

- [ ] **Step 1: Update `statusClass()` and the badge span in `pr-card.ts`**

Replace the entire `statusClass()` method:

```ts
statusClass(): string {
  const map: Record<PrStatus, string> = {
    'Awaiting Review': 'bg-amber-100 text-amber-700',
    'Needs Re-review': 'bg-amber-100 text-amber-700',
    'Changes Requested': 'bg-stone-100 text-stone-500',
    'Approved': 'bg-emerald-100 text-emerald-700',
    'Approved by Others': 'bg-stone-100 text-stone-500',
  };
  return map[this.pr().myReviewStatus];
}
```

Add `PrStatus` to the import at the top of the file:

```ts
import { PullRequest, PrStatus } from '../../models/work-item.model';
```

Update the badge `<span>` in the template to include an `aria-label` for the `'Needs Re-review'` status:

```html
<span
  class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
  [class]="statusClass()"
  [attr.aria-label]="pr().myReviewStatus === 'Needs Re-review' ? 'Erneut prüfen' : null"
>
  {{ pr().myReviewStatus }}
</span>
```

- [ ] **Step 2: Compile-check**

```bash
cd /Users/dominik/dev/other/orbit && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
cd /Users/dominik/dev/other/orbit && ng test --no-watch 2>&1 | grep -E "(FAIL|PASS|✓|✗)"
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/dominik/dev/other/orbit && git add src/app/components/pr-card/pr-card.ts && git commit -m "fix: change Changes Requested badge to grey; add Needs Re-review amber badge"
```

---

### Task 5: Update mock server

**Files:**
- Modify: `mock-server/bitbucket.js`

- [ ] **Step 1: Add a second NEEDS_WORK PR to `mockPullRequests`**

Add the following entry to the `mockPullRequests` array after PR `89`:

```js
{
  id: 91,
  title: 'refactor: Extract policy calculation to shared service',
  description: 'Refactoring der Berechnungslogik in einen gemeinsamen Service. Ermöglicht Wiederverwendung in anderen Formularen.',
  state: 'OPEN',
  open: true,
  closed: false,
  locked: false,
  createdDate: 1741521600000,
  updatedDate: 1741953000000,
  fromRef: makeRef('refactor/policy-calculation', 'd4e5f6a1', REPO_SL),
  toRef: makeRef('main', 'f6g7h8i9', REPO_SL),
  author: makeParticipant(MICHAEL, 'AUTHOR', 'UNAPPROVED'),
  reviewers: [makeParticipant(CURRENT_USER, 'REVIEWER', 'NEEDS_WORK')],
  participants: [],
  properties: { commentCount: 3, openTaskCount: 0 },
  links: { self: [{ href: `${BASE}/projects/SL/repos/versicherung-shared-lib/pull-requests/91` }] },
},
```

- [ ] **Step 2: Add the activities endpoint**

Add after the existing `app.get('/rest/api/latest/dashboard/pull-requests', ...)` handler and **before** the `app.listen(PORT, ...)` call:

```js
const ACTIVITIES_FIXTURES = {
  // PR 89: NEEDS_WORK is the newest activity → should stay "Changes Requested"
  89: {
    values: [
      {
        action: 'REVIEWED',
        user: CURRENT_USER,
        reviewedStatus: 'NEEDS_WORK',
      },
      {
        action: 'COMMENTED',
        user: ANNA,
      },
      {
        action: 'OPENED',
        user: ANNA,
      },
    ],
    isLastPage: true,
  },
  // PR 91: a comment was added after the NEEDS_WORK review → should become "Needs Re-review"
  91: {
    values: [
      {
        action: 'COMMENTED',
        user: MICHAEL,
      },
      {
        action: 'REVIEWED',
        user: CURRENT_USER,
        reviewedStatus: 'NEEDS_WORK',
      },
      {
        action: 'OPENED',
        user: MICHAEL,
      },
    ],
    isLastPage: true,
  },
};

app.get(
  '/rest/api/latest/projects/:projectKey/repos/:repoSlug/pull-requests/:prId/activities',
  (req, res) => {
    const prId = parseInt(req.params.prId, 10);
    const fixture = ACTIVITIES_FIXTURES[prId];
    if (fixture) {
      res.json(fixture);
    } else {
      res.json({ values: [], isLastPage: true });
    }
  }
);
```

- [ ] **Step 3: Manual smoke test (if mock server is running)**

Start the mock server if not running:
```bash
node /Users/dominik/dev/other/orbit/mock-server/bitbucket.js &
```

Verify the activities endpoint works:
```bash
curl -s "http://localhost:6203/rest/api/latest/projects/SL/repos/versicherung-shared-lib/pull-requests/89/activities" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).values[0].action)"
```
Expected output: `REVIEWED`

```bash
curl -s "http://localhost:6203/rest/api/latest/projects/SL/repos/versicherung-shared-lib/pull-requests/91/activities" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).values[0].action)"
```
Expected output: `COMMENTED`

- [ ] **Step 4: Run full test suite one final time**

```bash
cd /Users/dominik/dev/other/orbit && ng test --no-watch 2>&1 | grep -E "(FAIL|PASS|✓|✗|Test Files)"
```

Expected: all test files pass, no failures.

- [ ] **Step 5: Final commit**

```bash
cd /Users/dominik/dev/other/orbit && git add mock-server/bitbucket.js && git commit -m "feat: add activities mock endpoint for PR needs-re-review feature"
```
