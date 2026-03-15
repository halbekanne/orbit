import { TestBed } from '@angular/core/testing';
import { of, throwError, Observable } from 'rxjs';
import { JiraTicket, PullRequest } from '../models/work-item.model';
import { JiraService } from './jira.service';
import { BitbucketService } from './bitbucket.service';
import { WorkDataService } from './work-data.service';

const mockTicket: JiraTicket = {
  type: 'ticket',
  id: '10001',
  key: 'VERS-1',
  summary: 'Test Issue',
  issueType: 'Task',
  status: 'In Progress',
  priority: 'High',
  assignee: 'Dominik M.',
  reporter: 'Sarah K.',
  creator: 'Sarah K.',
  description: '',
  dueDate: null,
  createdAt: '2026-01-01T00:00:00.000+0000',
  updatedAt: '2026-03-13T09:15:00.000+0000',
  url: 'http://localhost:6202/browse/VERS-1',
  labels: [],
  project: null,
  components: [],
  comments: [],
  attachments: [],
  relations: [],
  epicLink: null,
};

function setup(tickets$: Observable<JiraTicket[]>): WorkDataService {
  TestBed.configureTestingModule({
    providers: [
      WorkDataService,
      { provide: JiraService, useValue: { getAssignedActiveTickets: () => tickets$ } },
    ],
  });
  return TestBed.inject(WorkDataService);
}

const makePr = (myReviewStatus: PullRequest['myReviewStatus'] = 'Awaiting Review', id = 'P/repo/1'): PullRequest => ({
  type: 'pr',
  id,
  prNumber: 1,
  title: 'Test PR',
  description: '',
  state: 'OPEN',
  open: true,
  closed: false,
  locked: false,
  createdDate: 0,
  updatedDate: 0,
  fromRef: {
    id: 'refs/heads/feature/test',
    displayId: 'feature/test',
    latestCommit: 'abc',
    repository: { id: 1, slug: 'repo', name: 'repo', projectKey: 'P', projectName: 'Project', browseUrl: '' },
  },
  toRef: {
    id: 'refs/heads/main',
    displayId: 'main',
    latestCommit: 'def',
    repository: { id: 1, slug: 'repo', name: 'repo', projectKey: 'P', projectName: 'Project', browseUrl: '' },
  },
  author: {
    user: { id: 1, name: 'u', displayName: 'User', emailAddress: '', slug: 'u', active: true, type: 'NORMAL', profileUrl: '' },
    role: 'AUTHOR',
    approved: false,
    status: 'UNAPPROVED',
  },
  reviewers: [],
  participants: [],
  commentCount: 0,
  openTaskCount: 0,
  url: 'http://example.com/pr/1',
  myReviewStatus,
});

describe('WorkDataService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('populates tickets and clears loading on success', () => {
    const service = setup(of([mockTicket]));
    expect(service.ticketsLoading()).toBe(false);
    expect(service.ticketsError()).toBe(false);
    expect(service.tickets()).toEqual([mockTicket]);
  });

  it('sets ticketsError and clears loading on failure', () => {
    const service = setup(throwError(() => new Error('Network error')));
    expect(service.ticketsLoading()).toBe(false);
    expect(service.ticketsError()).toBe(true);
    expect(service.tickets()).toEqual([]);
  });

  it('starts with ticketsLoading true', () => {
    const service = setup(new Observable());
    expect(service.ticketsLoading()).toBe(true);
  });
});

describe('WorkDataService — pullRequests loading', () => {
  const mockJira = { getAssignedActiveTickets: () => of([]) };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    TestBed.overrideProvider(JiraService, { useValue: mockJira });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('pullRequestsLoading starts true and becomes false after data loads', () => {
    const mockBitbucket = { getReviewerPullRequests: () => of([makePr()]) };
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    const service = TestBed.inject(WorkDataService);
    expect(service.pullRequestsLoading()).toBe(true);
    TestBed.tick();
    expect(service.pullRequestsLoading()).toBe(false);
  });

  it('populates pullRequests from BitbucketService', () => {
    const pr = makePr('Awaiting Review');
    const mockBitbucket = { getReviewerPullRequests: () => of([pr]) };
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    const service = TestBed.inject(WorkDataService);
    TestBed.tick();
    expect(service.pullRequests()).toEqual([pr]);
  });

  it('sets pullRequestsError on BitbucketService failure', () => {
    const mockBitbucket = { getReviewerPullRequests: () => throwError(() => new Error('Network error')) };
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    const service = TestBed.inject(WorkDataService);
    TestBed.tick();
    expect(service.pullRequestsError()).toBe(true);
    expect(service.pullRequests()).toEqual([]);
  });

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
});

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
    const awaiting = makePr('Awaiting Review', 'P/repo/1');
    const changesRequested = makePr('Changes Requested', 'P/repo/2');
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
    const pr1 = makePr('Changes Requested', 'P/repo/1');
    const pr2 = makePr('Changes Requested', 'P/repo/2');
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
