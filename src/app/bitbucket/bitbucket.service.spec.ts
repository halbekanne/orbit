import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { BitbucketService } from './bitbucket.service';
import { SettingsService } from '../settings/settings.service';
import { PullRequest } from '../shared/work-item.model';

const mockSettingsService = {
  bitbucketConfig: signal({ baseUrl: '', apiKey: '', userSlug: 'dominik.mueller' }),
};

const makeRepo = () => ({
  id: 1,
  slug: 'versicherung-frontend',
  name: 'versicherung-frontend',
  project: { key: 'VF', id: 10, name: 'Versicherung Frontend' },
  links: {
    self: [{ href: 'http://localhost:6203/projects/VF/repos/versicherung-frontend/browse' }],
  },
});

const makeUser = (slug: string) => ({
  id: 101,
  name: slug,
  slug,
  displayName: 'Test User',
  emailAddress: `${slug}@example.org`,
  active: true,
  type: 'NORMAL',
  links: { self: [{ href: `http://localhost:6203/users/${slug}` }] },
});

const makePrRaw = (reviewerStatus: 'UNAPPROVED' | 'NEEDS_WORK' | 'APPROVED') => ({
  id: 412,
  title: 'feat: test PR',
  description: 'Test description',
  state: 'OPEN',
  open: true,
  closed: false,
  locked: false,
  createdDate: 1741694400000,
  updatedDate: 1741866600000,
  fromRef: {
    id: 'refs/heads/feature/test',
    displayId: 'feature/test',
    latestCommit: 'abc123',
    repository: makeRepo(),
  },
  toRef: {
    id: 'refs/heads/main',
    displayId: 'main',
    latestCommit: 'def456',
    repository: makeRepo(),
  },
  author: {
    user: makeUser('sarah.kowalski'),
    role: 'AUTHOR',
    approved: false,
    status: 'UNAPPROVED',
  },
  reviewers: [
    {
      user: makeUser('dominik.mueller'),
      role: 'REVIEWER',
      approved: reviewerStatus === 'APPROVED',
      status: reviewerStatus,
    },
  ],
  participants: [],
  properties: { commentCount: 3, openTaskCount: 1 },
  links: {
    self: [
      { href: 'http://localhost:6203/projects/VF/repos/versicherung-frontend/pull-requests/412' },
    ],
  },
});

const flushRequests = (
  httpTesting: HttpTestingController,
  reviewerStatus: 'UNAPPROVED' | 'NEEDS_WORK' | 'APPROVED',
) => {
  httpTesting
    .expectOne((req) => req.url.includes('dashboard/pull-requests'))
    .flush({ values: [makePrRaw(reviewerStatus)], isLastPage: true });
};

describe('BitbucketService', () => {
  let service: BitbucketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });
    service = TestBed.inject(BitbucketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('calls /dashboard/pull-requests with correct params', () => {
    service.getReviewerPullRequests().subscribe();
    const prReq = httpTesting.expectOne((req) => req.url.includes('dashboard/pull-requests'));
    expect(prReq.request.params.get('role')).toBe('REVIEWER');
    expect(prReq.request.params.get('state')).toBe('OPEN');
    prReq.flush({ values: [], isLastPage: true });
  });

  it('maps UNAPPROVED reviewer status to Awaiting Review', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe((prs) => (result = prs));
    flushRequests(httpTesting, 'UNAPPROVED');
    expect(result![0].myReviewStatus).toBe('Awaiting Review');
  });

  it('maps NEEDS_WORK reviewer status to Changes Requested', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe((prs) => (result = prs));
    flushRequests(httpTesting, 'NEEDS_WORK');
    expect(result![0].myReviewStatus).toBe('Changes Requested');
  });

  it('maps APPROVED reviewer status to Approved', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe((prs) => (result = prs));
    flushRequests(httpTesting, 'APPROVED');
    expect(result![0].myReviewStatus).toBe('Approved');
  });

  it('maps PullRequest fields from raw API response', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe((prs) => (result = prs));
    flushRequests(httpTesting, 'UNAPPROVED');
    const pr = result![0];
    expect(pr.type).toBe('pr');
    expect(pr.id).toBe('VF/versicherung-frontend/412');
    expect(pr.prNumber).toBe(412);
    expect(pr.title).toBe('feat: test PR');
    expect(pr.fromRef.displayId).toBe('feature/test');
    expect(pr.fromRef.repository.slug).toBe('versicherung-frontend');
    expect(pr.fromRef.repository.projectKey).toBe('VF');
    expect(pr.author.user.displayName).toBe('Test User');
    expect(pr.commentCount).toBe(3);
    expect(pr.openTaskCount).toBe(1);
    expect(pr.url).toBe(
      'http://localhost:6203/projects/VF/repos/versicherung-frontend/pull-requests/412',
    );
  });

  it('returns Approved by Others when configured slug is not in reviewers but another reviewer approved', () => {
    mockSettingsService.bitbucketConfig.set({ baseUrl: '', apiKey: '', userSlug: 'someone-else' });
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe((prs) => (result = prs));
    flushRequests(httpTesting, 'APPROVED');
    expect(result![0].myReviewStatus).toBe('Approved by Others');
    mockSettingsService.bitbucketConfig.set({
      baseUrl: '',
      apiKey: '',
      userSlug: 'dominik.mueller',
    });
  });

  it('sets isAuthoredByMe to false for reviewer PRs', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe((prs) => (result = prs));
    flushRequests(httpTesting, 'UNAPPROVED');
    expect(result![0].isAuthoredByMe).toBe(false);
  });
});

describe('BitbucketService — getAuthoredPullRequests', () => {
  let service: BitbucketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });
    service = TestBed.inject(BitbucketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  const flushAuthoredRequests = (
    reviewerStatus: 'UNAPPROVED' | 'NEEDS_WORK' | 'APPROVED',
    allApproved = false,
  ) => {
    const raw = makePrRaw(reviewerStatus);
    if (allApproved) {
      raw.reviewers = raw.reviewers.map((r) => ({
        ...r,
        approved: true,
        status: 'APPROVED' as const,
      }));
    }
    httpTesting
      .expectOne((req) => req.url.includes('dashboard/pull-requests'))
      .flush({ values: [raw], isLastPage: true });
  };

  it('calls dashboard/pull-requests with role=AUTHOR', () => {
    service.getAuthoredPullRequests().subscribe();
    const prReq = httpTesting.expectOne((req) => req.url.includes('dashboard/pull-requests'));
    expect(prReq.request.params.get('role')).toBe('AUTHOR');
    prReq.flush({ values: [], isLastPage: true });
  });

  it('sets isAuthoredByMe to true', () => {
    let result: PullRequest[] | undefined;
    service.getAuthoredPullRequests().subscribe((prs) => (result = prs));
    flushAuthoredRequests('UNAPPROVED');
    expect(result![0].isAuthoredByMe).toBe(true);
  });

  it('maps to In Review when no reviewer has NEEDS_WORK and not all approved', () => {
    let result: PullRequest[] | undefined;
    service.getAuthoredPullRequests().subscribe((prs) => (result = prs));
    flushAuthoredRequests('UNAPPROVED');
    expect(result![0].myReviewStatus).toBe('In Review');
  });

  it('maps to Changes Requested when a reviewer has NEEDS_WORK', () => {
    let result: PullRequest[] | undefined;
    service.getAuthoredPullRequests().subscribe((prs) => (result = prs));
    flushAuthoredRequests('NEEDS_WORK');
    expect(result![0].myReviewStatus).toBe('Changes Requested');
  });

  it('maps to Ready to Merge when all reviewers approved and no open tasks', () => {
    let result: PullRequest[] | undefined;
    service.getAuthoredPullRequests().subscribe((prs) => (result = prs));
    const raw = makePrRaw('APPROVED');
    raw.reviewers = [{ ...raw.reviewers[0], approved: true, status: 'APPROVED' }];
    raw.properties = { commentCount: 0, openTaskCount: 0 };
    httpTesting
      .expectOne((req) => req.url.includes('dashboard/pull-requests'))
      .flush({ values: [raw], isLastPage: true });
    expect(result![0].myReviewStatus).toBe('Ready to Merge');
  });

  it('maps to In Review when all approved but has open tasks', () => {
    let result: PullRequest[] | undefined;
    service.getAuthoredPullRequests().subscribe((prs) => (result = prs));
    const raw = makePrRaw('APPROVED');
    raw.reviewers = [{ ...raw.reviewers[0], approved: true, status: 'APPROVED' }];
    raw.properties = { commentCount: 0, openTaskCount: 2 };
    httpTesting
      .expectOne((req) => req.url.includes('dashboard/pull-requests'))
      .flush({ values: [raw], isLastPage: true });
    expect(result![0].myReviewStatus).toBe('In Review');
  });
});

describe('BitbucketService — getBuildStatusStats', () => {
  let service: BitbucketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });
    service = TestBed.inject(BitbucketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('returns build stats for a commit', () => {
    let result: import('../shared/work-item.model').BuildStatusSummary | undefined;
    service.getBuildStatusStats('abc123').subscribe((s) => (result = s));
    httpTesting
      .expectOne((req) => req.url.includes('/commits/stats/abc123'))
      .flush({ successful: 3, failed: 1, inProgress: 0 });
    expect(result).toEqual({ successful: 3, failed: 1, inProgress: 0 });
  });

  it('returns zeros on error', () => {
    let result: import('../shared/work-item.model').BuildStatusSummary | undefined;
    service.getBuildStatusStats('abc123').subscribe((s) => (result = s));
    httpTesting
      .expectOne((req) => req.url.includes('/commits/stats/abc123'))
      .flush('error', { status: 500, statusText: 'Internal Server Error' });
    expect(result).toEqual({ successful: 0, failed: 0, inProgress: 0 });
  });
});

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

const makeActivity = (
  action: string,
  slug: string,
  reviewedStatus?: 'APPROVED' | 'NEEDS_WORK' | 'UNAPPROVED',
) => ({
  action,
  user: {
    id: 1,
    name: slug,
    slug,
    displayName: 'User',
    emailAddress: `${slug}@example.org`,
    active: true,
    type: 'NORMAL',
  },
  ...(reviewedStatus !== undefined ? { reviewedStatus } : {}),
});

const flushActivity = (
  httpTesting: HttpTestingController,
  activities: ReturnType<typeof makeActivity>[],
) => {
  httpTesting
    .expectOne((req) => req.url.includes('/activities'))
    .flush({ values: activities, isLastPage: true });
};

describe('BitbucketService — getReviewerPrActivityStatus', () => {
  let service: BitbucketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });
    service = TestBed.inject(BitbucketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('returns Changes Requested when NEEDS_WORK is the newest activity', () => {
    let result: string | undefined;
    service.getReviewerPrActivityStatus(makePrRef()).subscribe((s) => (result = s));
    flushActivity(httpTesting, [
      makeActivity('REVIEWED', 'dominik.mueller', 'NEEDS_WORK'),
      makeActivity('COMMENTED', 'sarah.kowalski'),
    ]);
    expect(result).toBe('Changes Requested');
  });

  it('returns Needs Re-review when a newer activity follows the NEEDS_WORK review', () => {
    let result: string | undefined;
    service.getReviewerPrActivityStatus(makePrRef()).subscribe((s) => (result = s));
    flushActivity(httpTesting, [
      makeActivity('COMMENTED', 'anna.lehmann'),
      makeActivity('REVIEWED', 'dominik.mueller', 'NEEDS_WORK'),
    ]);
    expect(result).toBe('Needs Re-review');
  });

  it('returns Changes Requested when no NEEDS_WORK review exists', () => {
    let result: string | undefined;
    service.getReviewerPrActivityStatus(makePrRef()).subscribe((s) => (result = s));
    flushActivity(httpTesting, [makeActivity('COMMENTED', 'dominik.mueller')]);
    expect(result).toBe('Changes Requested');
  });

  it('returns Changes Requested on API error', () => {
    let result: string | undefined;
    service.getReviewerPrActivityStatus(makePrRef()).subscribe((s) => (result = s));
    httpTesting
      .expectOne((req) => req.url.includes('/activities'))
      .flush('error', { status: 500, statusText: 'Internal Server Error' });
    expect(result).toBe('Changes Requested');
  });

  it('requests the correct activities URL', () => {
    service.getReviewerPrActivityStatus(makePrRef()).subscribe();
    const req = httpTesting.expectOne((req) => req.url.includes('/activities'));
    expect(req.request.url).toContain(
      '/projects/SL/repos/versicherung-shared-lib/pull-requests/89/activities',
    );
    req.flush({ values: [], isLastPage: true });
  });
});

describe('BitbucketService — getPullRequestDiff', () => {
  let service: BitbucketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });
    service = TestBed.inject(BitbucketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('requests the correct diff URL with text responseType', () => {
    let result: string | undefined;
    service.getPullRequestDiff(makePrRef()).subscribe((d) => (result = d));
    const req = httpTesting.expectOne((r) => r.url.includes('pull-requests/89.diff'));
    expect(req.request.url).toContain(
      '/projects/SL/repos/versicherung-shared-lib/pull-requests/89.diff',
    );
    expect(req.request.responseType).toBe('text');
    req.flush('diff --git a/file.ts b/file.ts');
    expect(result).toBe('diff --git a/file.ts b/file.ts');
  });

  it('propagates errors', () => {
    let error: unknown;
    service.getPullRequestDiff(makePrRef()).subscribe({ error: (e) => (error = e) });
    httpTesting
      .expectOne((r) => r.url.includes('pull-requests/89.diff'))
      .flush('error', { status: 500, statusText: 'Internal Server Error' });
    expect(error).toBeTruthy();
  });
});

const makePrRawWithId = (
  id: number,
  reviewerStatus: 'UNAPPROVED' | 'NEEDS_WORK' | 'APPROVED',
  overrides: Partial<{
    authorSlug: string;
    reviewerSlug: string;
    reviewers: ReturnType<typeof makePrRaw>['reviewers'];
    draft: boolean;
    openTaskCount: number;
    latestCommit: string;
  }> = {},
) => {
  const raw = makePrRaw(reviewerStatus);
  raw.id = id;
  if (overrides.authorSlug) {
    raw.author = { ...raw.author, user: makeUser(overrides.authorSlug) };
  }
  if (overrides.reviewerSlug) {
    raw.reviewers = [
      {
        user: makeUser(overrides.reviewerSlug),
        role: 'REVIEWER' as const,
        approved: reviewerStatus === 'APPROVED',
        status: reviewerStatus,
      },
    ];
  }
  if (overrides.reviewers) {
    raw.reviewers = overrides.reviewers;
  }
  if (overrides.draft !== undefined) {
    (raw as Record<string, unknown>)['draft'] = overrides.draft;
  }
  if (overrides.openTaskCount !== undefined) {
    raw.properties = { ...raw.properties, openTaskCount: overrides.openTaskCount };
  }
  if (overrides.latestCommit) {
    raw.fromRef = { ...raw.fromRef, latestCommit: overrides.latestCommit };
  }
  return raw;
};

const flushDiffstats = (httpTesting: HttpTestingController) => {
  httpTesting
    .match((req) => req.url.includes('/bitbucket/diffstat/'))
    .forEach((req) => req.flush({ additions: 10, deletions: 5, total: 15 }));
};

const flushLoadAll = (
  httpTesting: HttpTestingController,
  reviewerPrs: ReturnType<typeof makePrRaw>[],
  authoredPrs: ReturnType<typeof makePrRaw>[],
) => {
  const dashboardReqs = httpTesting.match((req) => req.url.includes('dashboard/pull-requests'));
  expect(dashboardReqs.length).toBe(2);
  const reviewerReq = dashboardReqs.find((r) => r.request.params.get('role') === 'REVIEWER')!;
  const authorReq = dashboardReqs.find((r) => r.request.params.get('role') === 'AUTHOR')!;
  reviewerReq.flush({ values: reviewerPrs, isLastPage: true });
  authorReq.flush({ values: authoredPrs, isLastPage: true });
};

describe('BitbucketService — loadAll loading state', () => {
  let service: BitbucketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });
    service = TestBed.inject(BitbucketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('starts with loading=true and sets loading=false after data loads', () => {
    expect(service.loading()).toBe(true);
    expect(service.error()).toBe(false);

    service.loadAll().subscribe();
    flushLoadAll(httpTesting, [], []);
    TestBed.tick();

    expect(service.loading()).toBe(false);
    expect(service.error()).toBe(false);
  });

  it('sets error=true on failure', () => {
    service.loadAll().subscribe({ error: () => {} });
    const dashboardReqs = httpTesting.match((req) => req.url.includes('dashboard/pull-requests'));
    dashboardReqs[0].flush('error', { status: 500, statusText: 'Internal Server Error' });

    expect(service.error()).toBe(true);
    expect(service.loading()).toBe(false);
  });
});

describe('BitbucketService — pullRequests computed', () => {
  let service: BitbucketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });
    service = TestBed.inject(BitbucketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('combines reviewPullRequests and myPullRequests', () => {
    const reviewerPr = makePrRawWithId(1, 'UNAPPROVED');
    const authoredPr = makePrRawWithId(2, 'UNAPPROVED');

    service.loadAll().subscribe();
    flushLoadAll(httpTesting, [reviewerPr], [authoredPr]);

    httpTesting
      .match((req) => req.url.includes('/commits/stats/'))
      .forEach((req) => req.flush({ successful: 0, failed: 0, inProgress: 0 }));
    flushDiffstats(httpTesting);
    TestBed.tick();

    const prs = service.pullRequests();
    expect(prs.length).toBe(2);
    expect(prs[0].isAuthoredByMe).toBe(false);
    expect(prs[1].isAuthoredByMe).toBe(true);
  });
});

describe('BitbucketService — reviewPullRequests', () => {
  let service: BitbucketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });
    service = TestBed.inject(BitbucketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('only includes PRs not authored by me', () => {
    const reviewerPr = makePrRawWithId(1, 'UNAPPROVED');
    const authoredPr = makePrRawWithId(2, 'UNAPPROVED');

    service.loadAll().subscribe();
    flushLoadAll(httpTesting, [reviewerPr], [authoredPr]);

    httpTesting
      .match((req) => req.url.includes('/commits/stats/'))
      .forEach((req) => req.flush({ successful: 0, failed: 0, inProgress: 0 }));
    flushDiffstats(httpTesting);
    TestBed.tick();

    const prs = service.reviewPullRequests();
    expect(prs.length).toBe(1);
    expect(prs[0].isAuthoredByMe).toBe(false);
  });

  it('sorts long-waiting PRs first and already-reviewed last', () => {
    const twoDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const oldPr = makePrRawWithId(1, 'UNAPPROVED');
    oldPr.createdDate = twoDaysAgo;

    const recentPr = makePrRawWithId(2, 'UNAPPROVED');
    recentPr.createdDate = now;

    const approvedByOthersPr = makePrRawWithId(3, 'UNAPPROVED', {
      reviewers: [
        {
          user: makeUser('dominik.mueller'),
          role: 'REVIEWER' as const,
          approved: false,
          status: 'UNAPPROVED' as const,
        },
        {
          user: makeUser('another'),
          role: 'REVIEWER' as const,
          approved: true,
          status: 'APPROVED' as const,
        },
      ],
    });
    approvedByOthersPr.createdDate = twoDaysAgo;

    service.loadAll().subscribe();
    flushLoadAll(httpTesting, [recentPr, approvedByOthersPr, oldPr], []);
    flushDiffstats(httpTesting);
    TestBed.tick();

    const prs = service.reviewPullRequests();
    expect(prs.map((pr) => pr.prNumber)).toEqual([1, 2, 3]);
  });
});

describe('BitbucketService — myPullRequests', () => {
  let service: BitbucketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });
    service = TestBed.inject(BitbucketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('only includes PRs authored by me', () => {
    const reviewerPr = makePrRawWithId(1, 'UNAPPROVED');
    const authoredPr = makePrRawWithId(2, 'UNAPPROVED');

    service.loadAll().subscribe();
    flushLoadAll(httpTesting, [reviewerPr], [authoredPr]);

    httpTesting
      .match((req) => req.url.includes('/commits/stats/'))
      .forEach((req) => req.flush({ successful: 0, failed: 0, inProgress: 0 }));
    flushDiffstats(httpTesting);
    TestBed.tick();

    const prs = service.myPullRequests();
    expect(prs.length).toBe(1);
    expect(prs[0].isAuthoredByMe).toBe(true);
  });

  it('sorts build fail > changes requested > approved > in review', () => {
    const inReviewPr = makePrRawWithId(1, 'UNAPPROVED');
    const readyToMergePr = makePrRawWithId(2, 'APPROVED', {
      openTaskCount: 0,
      reviewers: [
        {
          user: makeUser('reviewer1'),
          role: 'REVIEWER' as const,
          approved: true,
          status: 'APPROVED' as const,
        },
      ],
    });
    const changesRequestedPr = makePrRawWithId(3, 'NEEDS_WORK');
    const buildFailPr = makePrRawWithId(4, 'UNAPPROVED', { latestCommit: 'fail-commit' });

    service.loadAll().subscribe();
    flushLoadAll(httpTesting, [], [inReviewPr, readyToMergePr, changesRequestedPr, buildFailPr]);

    httpTesting
      .match((req) => req.url.includes('/commits/stats/'))
      .forEach((req) => {
        if (req.request.url.includes('fail-commit')) {
          req.flush({ successful: 0, failed: 2, inProgress: 0 });
        } else {
          req.flush({ successful: 0, failed: 0, inProgress: 0 });
        }
      });
    flushDiffstats(httpTesting);
    TestBed.tick();

    const prs = service.myPullRequests();
    expect(prs.map((pr) => pr.prNumber)).toEqual([4, 3, 2, 1]);
  });
});

describe('BitbucketService — awaitingReviewCount', () => {
  let service: BitbucketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });
    service = TestBed.inject(BitbucketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('counts Awaiting Review PRs', () => {
    const pr1 = makePrRawWithId(1, 'UNAPPROVED');
    const pr2 = makePrRawWithId(2, 'UNAPPROVED');
    const pr3 = makePrRawWithId(3, 'APPROVED');

    service.loadAll().subscribe();
    flushLoadAll(httpTesting, [pr1, pr2, pr3], []);
    flushDiffstats(httpTesting);
    TestBed.tick();

    expect(service.awaitingReviewCount()).toBe(2);
  });

  it('does not count authored PRs in awaitingReviewCount', () => {
    const reviewerPr = makePrRawWithId(1, 'UNAPPROVED');
    const authoredPr = makePrRawWithId(2, 'UNAPPROVED');

    service.loadAll().subscribe();
    flushLoadAll(httpTesting, [reviewerPr], [authoredPr]);

    httpTesting
      .match((req) => req.url.includes('/commits/stats/'))
      .forEach((req) => req.flush({ successful: 0, failed: 0, inProgress: 0 }));
    flushDiffstats(httpTesting);
    TestBed.tick();

    expect(service.awaitingReviewCount()).toBe(1);
  });
});

describe('BitbucketService — loadAll deduplication', () => {
  let service: BitbucketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });
    service = TestBed.inject(BitbucketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('keeps only the reviewer version when a PR appears in both lists', () => {
    const reviewerVersion = makePrRawWithId(412, 'UNAPPROVED');
    const authoredVersion = makePrRawWithId(412, 'UNAPPROVED');

    service.loadAll().subscribe();
    flushLoadAll(httpTesting, [reviewerVersion], [authoredVersion]);
    flushDiffstats(httpTesting);
    TestBed.tick();

    const prs = service.pullRequests();
    expect(prs.length).toBe(1);
    expect(prs[0].isAuthoredByMe).toBe(false);
  });
});

describe('BitbucketService — loadAll enrichment (activity status)', () => {
  let service: BitbucketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });
    service = TestBed.inject(BitbucketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('enriches Changes Requested reviewer PRs to Needs Re-review when activity indicates it', () => {
    const needsWorkPr = makePrRawWithId(10, 'NEEDS_WORK');

    service.loadAll().subscribe();
    flushLoadAll(httpTesting, [needsWorkPr], []);

    httpTesting
      .expectOne((req) => req.url.includes('/activities'))
      .flush({
        values: [
          makeActivity('COMMENTED', 'sarah.kowalski'),
          makeActivity('REVIEWED', 'dominik.mueller', 'NEEDS_WORK'),
        ],
        isLastPage: true,
      });
    flushDiffstats(httpTesting);
    TestBed.tick();

    expect(service.pullRequests()[0].myReviewStatus).toBe('Needs Re-review');
  });

  it('keeps Changes Requested when activity confirms it', () => {
    const needsWorkPr = makePrRawWithId(10, 'NEEDS_WORK');

    service.loadAll().subscribe();
    flushLoadAll(httpTesting, [needsWorkPr], []);

    httpTesting
      .expectOne((req) => req.url.includes('/activities'))
      .flush({
        values: [makeActivity('REVIEWED', 'dominik.mueller', 'NEEDS_WORK')],
        isLastPage: true,
      });
    flushDiffstats(httpTesting);
    TestBed.tick();

    expect(service.pullRequests()[0].myReviewStatus).toBe('Changes Requested');
  });
});

describe('BitbucketService — loadAll enrichment (build status)', () => {
  let service: BitbucketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });
    service = TestBed.inject(BitbucketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('enriches authored PRs with build status', () => {
    const authoredPr = makePrRawWithId(20, 'UNAPPROVED', { latestCommit: 'commit-abc' });

    service.loadAll().subscribe();
    flushLoadAll(httpTesting, [], [authoredPr]);
    TestBed.tick();

    httpTesting
      .expectOne((req) => req.url.includes('/commits/stats/commit-abc'))
      .flush({
        successful: 5,
        failed: 1,
        inProgress: 2,
      });
    flushDiffstats(httpTesting);
    TestBed.tick();

    const pr = service.pullRequests()[0];
    expect(pr.buildStatus).toEqual({ successful: 5, failed: 1, inProgress: 2 });
  });
});
