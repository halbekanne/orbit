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
            refreshAll: (force: boolean) => { refreshAllCalled = true; },
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
