import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { IdeaService } from './idea.service';
import { Idea } from '../models/work-item.model';

const makeIdea = (overrides: Partial<Idea> = {}): Idea => ({
  type: 'idea',
  id: 'id1',
  title: 'Test',
  description: '',
  status: 'active',
  createdAt: new Date().toISOString(),
  ...overrides,
});

function setup(http: Partial<{ get: unknown; post: unknown }>) {
  TestBed.configureTestingModule({
    providers: [
      IdeaService,
      { provide: HttpClient, useValue: http },
    ],
  });
  return TestBed.inject(IdeaService);
}

describe('IdeaService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('ideasLoading starts true, becomes false after load', () => {
    const svc = setup({ get: () => of([]), post: () => of([]) });
    expect(svc.ideasLoading()).toBe(true);
    TestBed.tick();
    expect(svc.ideasLoading()).toBe(false);
  });

  it('loads ideas from BFF on init', () => {
    const idea = makeIdea();
    const svc = setup({ get: () => of([idea]), post: () => of([idea]) });
    TestBed.tick();
    expect(svc.ideas()).toEqual([idea]);
  });

  it('sets ideasError on load failure', () => {
    const svc = setup({ get: () => throwError(() => new Error('fail')), post: () => of([]) });
    TestBed.tick();
    expect(svc.ideasError()).toBe(true);
  });

  it('activeIdeas contains only active ideas', () => {
    const active = makeIdea({ id: 'a', status: 'active' });
    const wont = makeIdea({ id: 'b', status: 'wont-do' });
    const svc = setup({ get: () => of([active, wont]), post: () => of([]) });
    TestBed.tick();
    expect(svc.activeIdeas()).toHaveLength(1);
    expect(svc.activeIdeas()[0].id).toBe('a');
  });

  it('wontDoIdeas contains only wont-do ideas', () => {
    const wont = makeIdea({ status: 'wont-do' });
    const svc = setup({ get: () => of([wont]), post: () => of([]) });
    TestBed.tick();
    expect(svc.wontDoIdeas()).toHaveLength(1);
  });

  it('add() prepends idea with active status and saves', () => {
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([]), post: postSpy });
    TestBed.tick();
    svc.add('New idea');
    expect(svc.ideas()[0].title).toBe('New idea');
    expect(svc.ideas()[0].status).toBe('active');
    expect(postSpy).toHaveBeenCalled();
  });

  it('update() replaces idea by id and saves', () => {
    const idea = makeIdea();
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([idea]), post: postSpy });
    TestBed.tick();
    svc.update({ ...idea, title: 'Updated' });
    expect(svc.ideas()[0].title).toBe('Updated');
  });

  it('reorder() moves item in array and saves', () => {
    const a = makeIdea({ id: 'a' });
    const b = makeIdea({ id: 'b' });
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([a, b]), post: postSpy });
    TestBed.tick();
    svc.reorder(0, 1);
    expect(svc.ideas()[0].id).toBe('b');
  });
});
