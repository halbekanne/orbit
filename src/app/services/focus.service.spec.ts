import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FocusService } from './focus.service';
import { WorkspaceService } from './workspace.service';
import { TodoService } from './todo.service';
import { IdeaService } from './idea.service';
import { Todo, Idea, JiraTicket } from '../models/work-item.model';

function makeTodo(id: string): Todo {
  return { type: 'todo', id, title: 'Test', description: '', status: 'open', urgent: false, createdAt: '', completedAt: null };
}

function makeIdea(id: string): Idea {
  return { type: 'idea', id, title: 'Test Idea', description: '', status: 'active', createdAt: '' };
}

function makeTicket(id: string): JiraTicket {
  return {
    type: 'ticket', id, key: 'TEST-1', summary: 'Test', issueType: 'Task',
    status: 'To Do', priority: 'Medium', assignee: '', reporter: '', creator: '',
    description: '', dueDate: null, createdAt: '', updatedAt: '', url: '',
    labels: [], project: null, components: [], comments: [], attachments: [],
    relations: [], epicLink: null,
  };
}

describe('FocusService', () => {
  let service: FocusService;
  const todosSignal = signal<Todo[]>([makeTodo('td-1')]);
  const ideasSignal = signal<Idea[]>([makeIdea('id-1')]);
  const ticketsSignal = signal<JiraTicket[]>([makeTicket('tk-1')]);
  const pullRequestsSignal = signal<any[]>([]);

  beforeEach(() => {
    localStorage.clear();
    todosSignal.set([makeTodo('td-1')]);
    ideasSignal.set([makeIdea('id-1')]);
    ticketsSignal.set([makeTicket('tk-1')]);
    pullRequestsSignal.set([]);
    TestBed.configureTestingModule({
      providers: [
        FocusService,
        { provide: TodoService, useValue: { todos: todosSignal } },
        { provide: IdeaService, useValue: { ideas: ideasSignal } },
        { provide: WorkspaceService, useValue: { tickets: ticketsSignal, pullRequests: pullRequestsSignal } },
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
    expect(localStorage.getItem('orbit.focus.state')).toEqual(JSON.stringify({ id: 'td-1', type: 'todo' }));
  });
});
