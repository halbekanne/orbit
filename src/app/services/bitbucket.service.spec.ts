import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BitbucketService } from './bitbucket.service';
import { PullRequest } from '../models/work-item.model';

const makeRepo = () => ({
  id: 1,
  slug: 'versicherung-frontend',
  name: 'versicherung-frontend',
  project: { key: 'VF', id: 10, name: 'Versicherung Frontend' },
  links: { self: [{ href: 'http://localhost:6203/projects/VF/repos/versicherung-frontend/browse' }] },
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
  links: { self: [{ href: 'http://localhost:6203/projects/VF/repos/versicherung-frontend/pull-requests/412' }] },
});

const flushRequests = (
  httpTesting: HttpTestingController,
  reviewerStatus: 'UNAPPROVED' | 'NEEDS_WORK' | 'APPROVED',
  slug = 'dominik.mueller',
) => {
  httpTesting.expectOne(req => req.url.endsWith('/config')).flush({ bitbucketUserSlug: slug });
  httpTesting
    .expectOne(req => req.url.includes('dashboard/pull-requests'))
    .flush({ values: [makePrRaw(reviewerStatus)], isLastPage: true });
};

describe('BitbucketService', () => {
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

  it('calls /config then /dashboard/pull-requests with correct params', () => {
    service.getReviewerPullRequests().subscribe();
    httpTesting.expectOne(req => req.url.endsWith('/config')).flush({ bitbucketUserSlug: 'dominik.mueller' });
    const prReq = httpTesting.expectOne(req => req.url.includes('dashboard/pull-requests'));
    expect(prReq.request.params.get('role')).toBe('REVIEWER');
    expect(prReq.request.params.get('state')).toBe('OPEN');
    prReq.flush({ values: [], isLastPage: true });
  });

  it('maps UNAPPROVED reviewer status to Awaiting Review', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe(prs => (result = prs));
    flushRequests(httpTesting, 'UNAPPROVED');
    expect(result![0].myReviewStatus).toBe('Awaiting Review');
  });

  it('maps NEEDS_WORK reviewer status to Changes Requested', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe(prs => (result = prs));
    flushRequests(httpTesting, 'NEEDS_WORK');
    expect(result![0].myReviewStatus).toBe('Changes Requested');
  });

  it('maps APPROVED reviewer status to Approved', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe(prs => (result = prs));
    flushRequests(httpTesting, 'APPROVED');
    expect(result![0].myReviewStatus).toBe('Approved');
  });

  it('maps PullRequest fields from raw API response', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe(prs => (result = prs));
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
    expect(pr.url).toBe('http://localhost:6203/projects/VF/repos/versicherung-frontend/pull-requests/412');
  });

  it('returns Approved by Others when configured slug is not in reviewers but another reviewer approved', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe(prs => (result = prs));
    flushRequests(httpTesting, 'APPROVED', 'someone-else');
    expect(result![0].myReviewStatus).toBe('Approved by Others');
  });

  it('sets isAuthoredByMe to false for reviewer PRs', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe(prs => (result = prs));
    flushRequests(httpTesting, 'UNAPPROVED');
    expect(result![0].isAuthoredByMe).toBe(false);
  });
});

describe('BitbucketService — getAuthoredPullRequests', () => {
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

  const flushAuthoredRequests = (
    reviewerStatus: 'UNAPPROVED' | 'NEEDS_WORK' | 'APPROVED',
    allApproved = false,
  ) => {
    httpTesting.expectOne(req => req.url.endsWith('/config')).flush({ bitbucketUserSlug: 'dominik.mueller' });
    const raw = makePrRaw(reviewerStatus);
    if (allApproved) {
      raw.reviewers = raw.reviewers.map(r => ({ ...r, approved: true, status: 'APPROVED' as const }));
    }
    httpTesting
      .expectOne(req => req.url.includes('dashboard/pull-requests'))
      .flush({ values: [raw], isLastPage: true });
  };

  it('calls dashboard/pull-requests with role=AUTHOR', () => {
    service.getAuthoredPullRequests().subscribe();
    httpTesting.expectOne(req => req.url.endsWith('/config')).flush({ bitbucketUserSlug: 'dominik.mueller' });
    const prReq = httpTesting.expectOne(req => req.url.includes('dashboard/pull-requests'));
    expect(prReq.request.params.get('role')).toBe('AUTHOR');
    prReq.flush({ values: [], isLastPage: true });
  });

  it('sets isAuthoredByMe to true', () => {
    let result: PullRequest[] | undefined;
    service.getAuthoredPullRequests().subscribe(prs => (result = prs));
    flushAuthoredRequests('UNAPPROVED');
    expect(result![0].isAuthoredByMe).toBe(true);
  });

  it('maps to In Review when no reviewer has NEEDS_WORK and not all approved', () => {
    let result: PullRequest[] | undefined;
    service.getAuthoredPullRequests().subscribe(prs => (result = prs));
    flushAuthoredRequests('UNAPPROVED');
    expect(result![0].myReviewStatus).toBe('In Review');
  });

  it('maps to Changes Requested when a reviewer has NEEDS_WORK', () => {
    let result: PullRequest[] | undefined;
    service.getAuthoredPullRequests().subscribe(prs => (result = prs));
    flushAuthoredRequests('NEEDS_WORK');
    expect(result![0].myReviewStatus).toBe('Changes Requested');
  });

  it('maps to Ready to Merge when all reviewers approved and no open tasks', () => {
    let result: PullRequest[] | undefined;
    service.getAuthoredPullRequests().subscribe(prs => (result = prs));
    httpTesting.expectOne(req => req.url.endsWith('/config')).flush({ bitbucketUserSlug: 'dominik.mueller' });
    const raw = makePrRaw('APPROVED');
    raw.reviewers = [{ ...raw.reviewers[0], approved: true, status: 'APPROVED' }];
    raw.properties = { commentCount: 0, openTaskCount: 0 };
    httpTesting
      .expectOne(req => req.url.includes('dashboard/pull-requests'))
      .flush({ values: [raw], isLastPage: true });
    expect(result![0].myReviewStatus).toBe('Ready to Merge');
  });

  it('maps to In Review when all approved but has open tasks', () => {
    let result: PullRequest[] | undefined;
    service.getAuthoredPullRequests().subscribe(prs => (result = prs));
    httpTesting.expectOne(req => req.url.endsWith('/config')).flush({ bitbucketUserSlug: 'dominik.mueller' });
    const raw = makePrRaw('APPROVED');
    raw.reviewers = [{ ...raw.reviewers[0], approved: true, status: 'APPROVED' }];
    raw.properties = { commentCount: 0, openTaskCount: 2 };
    httpTesting
      .expectOne(req => req.url.includes('dashboard/pull-requests'))
      .flush({ values: [raw], isLastPage: true });
    expect(result![0].myReviewStatus).toBe('In Review');
  });
});

describe('BitbucketService — getBuildStatusStats', () => {
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

  it('returns build stats for a commit', () => {
    let result: import('../models/work-item.model').BuildStatusSummary | undefined;
    service.getBuildStatusStats('abc123').subscribe(s => (result = s));
    httpTesting
      .expectOne(req => req.url.includes('/commits/stats/abc123'))
      .flush({ successful: 3, failed: 1, inProgress: 0 });
    expect(result).toEqual({ successful: 3, failed: 1, inProgress: 0 });
  });

  it('returns zeros on error', () => {
    let result: import('../models/work-item.model').BuildStatusSummary | undefined;
    service.getBuildStatusStats('abc123').subscribe(s => (result = s));
    httpTesting
      .expectOne(req => req.url.includes('/commits/stats/abc123'))
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

describe('BitbucketService — getPullRequestDiff', () => {
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

  it('requests the correct diff URL with text responseType', () => {
    let result: string | undefined;
    service.getPullRequestDiff(makePrRef()).subscribe(d => (result = d));
    const req = httpTesting.expectOne(r => r.url.includes('pull-requests/89.diff'));
    expect(req.request.url).toContain('/projects/SL/repos/versicherung-shared-lib/pull-requests/89.diff');
    expect(req.request.responseType).toBe('text');
    req.flush('diff --git a/file.ts b/file.ts');
    expect(result).toBe('diff --git a/file.ts b/file.ts');
  });

  it('propagates errors', () => {
    let error: unknown;
    service.getPullRequestDiff(makePrRef()).subscribe({ error: e => (error = e) });
    httpTesting
      .expectOne(r => r.url.includes('pull-requests/89.diff'))
      .flush('error', { status: 500, statusText: 'Internal Server Error' });
    expect(error).toBeTruthy();
  });
});
