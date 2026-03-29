import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { Idea, JiraTicket, PullRequest, Todo } from './work-item.model';
import { JiraService } from '../jira/jira.service';
import { BitbucketService } from '../bitbucket/bitbucket.service';
import { WorkspaceService } from './workspace.service';
import { IdeaService } from '../ideas/idea.service';
import { TodoService } from '../todos/todo.service';

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

const mockBitbucket = {
  pullRequests: signal<PullRequest[]>([]),
  loading: signal(false),
  error: signal(false),
  awaitingReviewCount: signal(0),
  loadAll: () => {},
};

function setup(tickets$: Observable<JiraTicket[]>): WorkspaceService {
  TestBed.configureTestingModule({
    providers: [
      WorkspaceService,
      { provide: JiraService, useValue: { getAssignedActiveTickets: () => tickets$ } },
      { provide: BitbucketService, useValue: mockBitbucket },
    ],
  });
  return TestBed.inject(WorkspaceService);
}

describe('WorkspaceService', () => {
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

  it('delegates pullRequests to BitbucketService', () => {
    const service = setup(of([]));
    expect(service.pullRequests).toBe(mockBitbucket.pullRequests);
    expect(service.pullRequestsLoading).toBe(mockBitbucket.loading);
    expect(service.pullRequestsError).toBe(mockBitbucket.error);
    expect(service.awaitingReviewCount).toBe(mockBitbucket.awaitingReviewCount);
  });
});

describe('WorkspaceService — coordinator', () => {
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
    const mockTodo = {
      add: mockIdea.add,
    };

    TestBed.configureTestingModule({});
    TestBed.overrideProvider(JiraService, { useValue: { getAssignedActiveTickets: () => of([]) } });
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
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

    const mockTodo = {
      remove: (id: string) => removedIds.push(id),
    };
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
    TestBed.overrideProvider(JiraService, { useValue: { getAssignedActiveTickets: () => of([]) } });
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    TestBed.overrideProvider(IdeaService, { useValue: mockIdea });
    TestBed.overrideProvider(TodoService, { useValue: mockTodo });

    const svc = TestBed.inject(WorkspaceService);
    svc.demoteToIdea(todo);

    expect(removedIds).toContain('td1');
    expect(addedIdeas[0].title).toBe('Task');
  });
});
