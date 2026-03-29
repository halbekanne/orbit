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
            destroy: () => {},
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

describe('WorkspaceService — coordinator', () => {
  const mockRefresh = {
    register: () => {},
    refreshAll: () => {},
    startPolling: () => {},
    startVisibilityListener: () => {},
    destroy: () => {},
  };

  afterEach(() => TestBed.resetTestingModule());

  it('promoteToTodo marks idea as wont-do and adds a new todo', () => {
    const idea: Idea = {
      type: 'idea',
      id: 'i1',
      title: 'Idea',
      description: 'desc',
      status: 'active',
      createdAt: '2026-03-16T00:00:00',
    };

    const updatedIdeas: Idea[] = [];
    const addedTodos: Todo[] = [];

    const mockIdea = {
      update: (i: Idea) => updatedIdeas.push(i),
      add: (_title: string, _desc: string): Todo => {
        const t: Todo = {
          type: 'todo',
          id: 'new1',
          title: _title,
          description: _desc,
          status: 'open',
          urgent: false,
          createdAt: '',
          completedAt: null,
        };
        addedTodos.push(t);
        return t;
      },
    };
    const mockTodo = { add: mockIdea.add };

    TestBed.configureTestingModule({});
    TestBed.overrideProvider(JiraService, { useValue: { ...mockJira } });
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    TestBed.overrideProvider(DataRefreshService, { useValue: mockRefresh });
    TestBed.overrideProvider(IdeaService, { useValue: mockIdea });
    TestBed.overrideProvider(TodoService, { useValue: mockTodo });

    const svc = TestBed.inject(WorkspaceService);
    svc.promoteToTodo(idea);

    expect(updatedIdeas[0]).toEqual({ ...idea, status: 'wont-do' });
    expect(addedTodos[0].title).toBe('Idea');
  });

  it('demoteToIdea removes todo and adds a new idea', () => {
    const todo: Todo = {
      type: 'todo',
      id: 'td1',
      title: 'Task',
      description: 'desc',
      status: 'open',
      urgent: false,
      createdAt: '',
      completedAt: null,
    };

    const removedIds: string[] = [];
    const addedIdeas: Idea[] = [];

    const mockTodo = { remove: (id: string) => removedIds.push(id) };
    const mockIdea = {
      add: (_title: string, _desc: string): Idea => {
        const i: Idea = {
          type: 'idea',
          id: 'new1',
          title: _title,
          description: _desc,
          status: 'active',
          createdAt: '',
        };
        addedIdeas.push(i);
        return i;
      },
    };

    TestBed.configureTestingModule({});
    TestBed.overrideProvider(JiraService, { useValue: { ...mockJira } });
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    TestBed.overrideProvider(DataRefreshService, { useValue: mockRefresh });
    TestBed.overrideProvider(IdeaService, { useValue: mockIdea });
    TestBed.overrideProvider(TodoService, { useValue: mockTodo });

    const svc = TestBed.inject(WorkspaceService);
    svc.demoteToIdea(todo);

    expect(removedIds).toContain('td1');
    expect(addedIdeas[0].title).toBe('Task');
  });
});
