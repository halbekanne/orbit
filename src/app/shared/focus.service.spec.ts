import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FocusService } from './focus.service';
import { WorkspaceService } from './workspace.service';
import { TodoService } from '../todos/todo.service';
import { IdeaService } from '../ideas/idea.service';
import { Idea, JiraTicket, Todo } from './work-item.model';

function makeTodo(id: string): Todo {
  return {
    type: 'todo',
    id,
    title: 'Test',
    description: '',
    status: 'open',
    urgent: false,
    createdAt: '',
    completedAt: null,
  };
}

function makeIdea(id: string): Idea {
  return { type: 'idea', id, title: 'Test Idea', description: '', status: 'active', createdAt: '' };
}

function makeTicket(id: string): JiraTicket {
  return {
    type: 'ticket',
    id,
    key: 'TEST-1',
    summary: 'Test',
    issueType: 'Task',
    status: 'To Do',
    priority: 'Medium',
    assignee: '',
    reporter: '',
    creator: '',
    description: '',
    dueDate: null,
    createdAt: '',
    updatedAt: '',
    url: '',
    labels: [],
    project: null,
    components: [],
    comments: [],
    attachments: [],
    relations: [],
    epicLink: null,
  };
}

describe('FocusService', () => {
  let service: FocusService;
  const todosSignal = signal<Todo[]>([makeTodo('td-1')]);
  const ideasSignal = signal<Idea[]>([makeIdea('id-1')]);
  const ticketsSignal = signal<JiraTicket[]>([makeTicket('tk-1')]);
  const pullRequestsSignal = signal<any[]>([]);
  const ticketsLoadingSignal = signal(false);
  const pullRequestsLoadingSignal = signal(false);

  beforeEach(() => {
    localStorage.clear();
    todosSignal.set([makeTodo('td-1')]);
    ideasSignal.set([makeIdea('id-1')]);
    ticketsSignal.set([makeTicket('tk-1')]);
    pullRequestsSignal.set([]);
    ticketsLoadingSignal.set(false);
    pullRequestsLoadingSignal.set(false);
    TestBed.configureTestingModule({
      providers: [
        FocusService,
        { provide: TodoService, useValue: { todos: todosSignal } },
        { provide: IdeaService, useValue: { ideas: ideasSignal } },
        {
          provide: WorkspaceService,
          useValue: {
            tickets: ticketsSignal,
            pullRequests: pullRequestsSignal,
            ticketsLoading: ticketsLoadingSignal,
            pullRequestsLoading: pullRequestsLoadingSignal,
          },
        },
      ],
    });
    service = TestBed.inject(FocusService);
  });

  it('starts with no focus', () => {
    expect(service.focusTarget()).toBeNull();
  });

  it('sets focus on a work item', () => {
    service.setFocus({ id: 'td-1', type: 'todo' });
    expect(service.focusTarget()).toEqual({ id: 'td-1', type: 'todo' });
  });

  it('clears focus', () => {
    service.setFocus({ id: 'td-1', type: 'todo' });
    service.clearFocus();
    expect(service.focusTarget()).toBeNull();
  });

  it('replaces focus when setting a different item', () => {
    service.setFocus({ id: 'td-1', type: 'todo' });
    service.setFocus({ id: 'id-1', type: 'idea' });
    expect(service.focusTarget()).toEqual({ id: 'id-1', type: 'idea' });
  });

  it('resolves a focused todo to the full item', () => {
    service.setFocus({ id: 'td-1', type: 'todo' });
    expect(service.focusedItem()).toEqual(makeTodo('td-1'));
  });

  it('resolves a focused idea to the full item', () => {
    service.setFocus({ id: 'id-1', type: 'idea' });
    expect(service.focusedItem()).toEqual(makeIdea('id-1'));
  });

  it('resolves a focused ticket to the full item', () => {
    service.setFocus({ id: 'tk-1', type: 'ticket' });
    expect(service.focusedItem()).toEqual(makeTicket('tk-1'));
  });

  it('clears focus when the resolved item disappears', () => {
    service.setFocus({ id: 'td-1', type: 'todo' });
    todosSignal.set([]);
    TestBed.tick();
    expect(service.focusTarget()).toBeNull();
  });

  it('reports whether a given item is the focused one', () => {
    service.setFocus({ id: 'td-1', type: 'todo' });
    expect(service.isFocused('td-1')).toBe(true);
    expect(service.isFocused('td-2')).toBe(false);
  });

  it('persists focus to localStorage', () => {
    service.setFocus({ id: 'td-1', type: 'todo' });
    TestBed.tick();
    expect(localStorage.getItem('orbit.focus.state')).toEqual(
      JSON.stringify({ id: 'td-1', type: 'todo' }),
    );
  });

  it('preserves focus when data is not loaded yet', () => {
    // Set focus on a ticket
    service.setFocus({ id: 'tk-1', type: 'ticket' });
    TestBed.tick();

    // Verify focus is set
    expect(service.focusTarget()).toEqual({ id: 'tk-1', type: 'ticket' });
    expect(service.focusedItem()).toEqual(makeTicket('tk-1'));

    // Simulate data being cleared (but loading is complete)
    ticketsSignal.set([]);
    TestBed.tick();

    // Focus should be cleared because data is loaded and item doesn't exist
    expect(service.focusTarget()).toBeNull();

    // Now simulate the actual issue: focus loaded from storage but data not loaded yet
    ticketsLoadingSignal.set(true);

    // Set focus again and clear data
    service.setFocus({ id: 'tk-1', type: 'ticket' });
    ticketsSignal.set([]);
    TestBed.tick();

    // Focus should be preserved because data is still loading
    expect(service.focusTarget()).toEqual({ id: 'tk-1', type: 'ticket' });
    expect(service.focusedItem()).toBeNull();

    // Now mark data as loaded
    ticketsLoadingSignal.set(false);
    TestBed.tick();

    // Focus should be cleared because data is loaded and item doesn't exist
    expect(service.focusTarget()).toBeNull();
  });

  it('clears focus when item no longer exists after data is loaded', () => {
    service.setFocus({ id: 'tk-1', type: 'ticket' });
    TestBed.tick();

    // Remove the ticket from data
    ticketsSignal.set([]);
    TestBed.tick();

    // Focus should be cleared because data is loaded and item doesn't exist
    expect(service.focusTarget()).toBeNull();
  });
});
