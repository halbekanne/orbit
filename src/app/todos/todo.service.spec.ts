import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { TodoService } from './todo.service';
import { Todo } from '../shared/work-item.model';

const makeTodo = (overrides: Partial<Todo> = {}): Todo => ({
  type: 'todo',
  id: 'td1',
  title: 'Test',
  description: '',
  status: 'open',
  urgent: false,
  createdAt: new Date().toISOString(),
  completedAt: null,
  ...overrides,
});

function setup(http: Partial<{ get: unknown; post: unknown }>) {
  TestBed.configureTestingModule({
    providers: [TodoService, { provide: HttpClient, useValue: http }],
  });
  return TestBed.inject(TodoService);
}

describe('TodoService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('todosLoading starts true when load is pending', () => {
    const svc = setup({ get: () => new Observable(), post: () => of([]) });
    expect(svc.todosLoading()).toBe(true);
  });

  it('todosLoading becomes false after load', () => {
    const svc = setup({ get: () => of([]), post: () => of([]) });
    expect(svc.todosLoading()).toBe(false);
  });

  it('loads todos from BFF on init', () => {
    const todo = makeTodo();
    const svc = setup({ get: () => of([todo]), post: () => of([todo]) });
    TestBed.tick();
    expect(svc.todos()).toEqual([todo]);
  });

  it('sets todosError on load failure', () => {
    const svc = setup({ get: () => throwError(() => new Error('fail')), post: () => of([]) });
    TestBed.tick();
    expect(svc.todosError()).toBe(true);
    expect(svc.todos()).toEqual([]);
  });

  it('openTodos contains open todos, urgent ones first', () => {
    const open = makeTodo({ id: 'a', status: 'open', urgent: false });
    const urgent = makeTodo({ id: 'b', status: 'open', urgent: true });
    const svc = setup({ get: () => of([open, urgent]), post: () => of([open, urgent]) });
    TestBed.tick();
    const ids = svc.openTodos().map((t) => t.id);
    expect(ids[0]).toBe('b');
    expect(ids[1]).toBe('a');
  });

  it('openTodos includes todos completed today', () => {
    const doneToday = makeTodo({ id: 'x', status: 'done', completedAt: new Date().toISOString() });
    const svc = setup({ get: () => of([doneToday]), post: () => of([doneToday]) });
    TestBed.tick();
    expect(svc.openTodos().map((t) => t.id)).toContain('x');
  });

  it('doneTodos excludes todos completed today', () => {
    const doneToday = makeTodo({ status: 'done', completedAt: new Date().toISOString() });
    const svc = setup({ get: () => of([doneToday]), post: () => of([doneToday]) });
    TestBed.tick();
    expect(svc.doneTodos()).toHaveLength(0);
  });

  it('doneTodos includes todos completed before today', () => {
    const old = makeTodo({ status: 'done', completedAt: '2026-01-01T00:00:00' });
    const svc = setup({ get: () => of([old]), post: () => of([old]) });
    TestBed.tick();
    expect(svc.doneTodos()).toHaveLength(1);
  });

  it('wontDoTodos contains wont-do todos', () => {
    const wont = makeTodo({ status: 'wont-do' });
    const svc = setup({ get: () => of([wont]), post: () => of([wont]) });
    TestBed.tick();
    expect(svc.wontDoTodos()).toHaveLength(1);
  });

  it('add() prepends todo with open status and saves', () => {
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([]), post: postSpy });
    TestBed.tick();
    svc.add('New task');
    expect(svc.todos()[0].title).toBe('New task');
    expect(svc.todos()[0].status).toBe('open');
    expect(postSpy).toHaveBeenCalled();
  });

  it('update() replaces todo by id and saves', () => {
    const todo = makeTodo();
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([todo]), post: postSpy });
    TestBed.tick();
    postSpy.mockClear();
    svc.update({ ...todo, title: 'Updated' });
    expect(svc.todos()[0].title).toBe('Updated');
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('reorder() moves item in array and saves', () => {
    const a = makeTodo({ id: 'a' });
    const b = makeTodo({ id: 'b' });
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([a, b]), post: postSpy });
    TestBed.tick();
    postSpy.mockClear();
    svc.reorder(0, 1);
    expect(svc.todos()[0].id).toBe('b');
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('pendingCount equals openTodos().length (open + today-done)', () => {
    const open = makeTodo({ id: 'a', status: 'open' });
    const doneToday = makeTodo({ id: 'b', status: 'done', completedAt: new Date().toISOString() });
    const doneOld = makeTodo({ id: 'c', status: 'done', completedAt: '2026-01-01T00:00:00' });
    const svc = setup({ get: () => of([open, doneToday, doneOld]), post: () => of([]) });
    TestBed.tick();
    expect(svc.pendingCount()).toBe(2);
  });
});
