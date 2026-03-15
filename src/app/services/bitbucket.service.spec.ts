import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BitbucketService } from './bitbucket.service';
import { PullRequest } from '../models/work-item.model';

const mockMyself = {
  id: 42,
  name: 'dominik.mueller',
  slug: 'dominik.mueller',
  displayName: 'Dominik Müller',
  emailAddress: 'dominik.mueller@example.org',
  active: true,
  type: 'NORMAL',
  links: { self: [{ href: 'http://localhost:6203/users/dominik.mueller' }] },
};

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

const flushRequests = (httpTesting: HttpTestingController, reviewerStatus: 'UNAPPROVED' | 'NEEDS_WORK' | 'APPROVED') => {
  httpTesting.expectOne(req => req.url.includes('/myself')).flush(mockMyself);
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

  it('calls /myself then /dashboard/pull-requests', () => {
    service.getReviewerPullRequests().subscribe();
    httpTesting.expectOne(req => req.url.includes('/myself')).flush(mockMyself);
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
    expect(pr.id).toBe(412);
    expect(pr.title).toBe('feat: test PR');
    expect(pr.fromRef.displayId).toBe('feature/test');
    expect(pr.fromRef.repository.slug).toBe('versicherung-frontend');
    expect(pr.fromRef.repository.projectKey).toBe('VF');
    expect(pr.author.user.displayName).toBe('Test User');
    expect(pr.commentCount).toBe(3);
    expect(pr.openTaskCount).toBe(1);
    expect(pr.url).toBe('http://localhost:6203/projects/VF/repos/versicherung-frontend/pull-requests/412');
  });

  it('falls back to Awaiting Review when current user is not in reviewers', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe(prs => (result = prs));
    httpTesting.expectOne(req => req.url.includes('/myself')).flush({
      ...mockMyself,
      slug: 'someone-else',
    });
    httpTesting
      .expectOne(req => req.url.includes('dashboard/pull-requests'))
      .flush({ values: [makePrRaw('APPROVED')], isLastPage: true });
    expect(result![0].myReviewStatus).toBe('Awaiting Review');
  });
});
