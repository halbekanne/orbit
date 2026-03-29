import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { TicketSubtaskService } from './ticket-subtask.service';

function setup(http: Partial<{ get: unknown; post: unknown }>) {
  TestBed.configureTestingModule({
    providers: [TicketSubtaskService, { provide: HttpClient, useValue: http }],
  });
  return TestBed.inject(TicketSubtaskService);
}

describe('TicketSubtaskService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('starts with empty subtasks', () => {
    const svc = setup({ get: () => of({ key: 'X-1', subtasks: [] }), post: () => of({}) });
    expect(svc.subtasks()).toEqual([]);
  });

  it('loadForTicket fetches and sets subtasks', () => {
    const subtasks = [{ id: 'st-1', title: 'A', status: 'open' as const, completedAt: null }];
    const getSpy = vi.fn().mockReturnValue(of({ key: 'X-1', subtasks }));
    const svc = setup({ get: getSpy, post: () => of({}) });
    svc.loadForTicket('X-1');
    expect(svc.subtasks()).toEqual(subtasks);
    expect(svc.currentKey()).toBe('X-1');
  });

  it('saveSubtasks posts data and updates signal', () => {
    const postSpy = vi.fn().mockReturnValue(of({}));
    const svc = setup({ get: () => of({ key: 'X-1', subtasks: [] }), post: postSpy });
    svc.loadForTicket('X-1');
    const newSubtasks = [{ id: 'st-1', title: 'A', status: 'open' as const, completedAt: null }];
    svc.saveSubtasks(newSubtasks);
    expect(svc.subtasks()).toEqual(newSubtasks);
    expect(postSpy).toHaveBeenCalled();
  });

  it('does not fetch again if same key is already loaded', () => {
    const getSpy = vi.fn().mockReturnValue(of({ key: 'X-1', subtasks: [] }));
    const svc = setup({ get: getSpy, post: () => of({}) });
    svc.loadForTicket('X-1');
    svc.loadForTicket('X-1');
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it('fetches again when key changes', () => {
    const getSpy = vi.fn().mockReturnValue(of({ key: 'X-2', subtasks: [] }));
    const svc = setup({ get: getSpy, post: () => of({}) });
    svc.loadForTicket('X-1');
    svc.loadForTicket('X-2');
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('doneCount and totalCount are computed correctly', () => {
    const subtasks = [
      { id: 'st-1', title: 'A', status: 'done' as const, completedAt: '2026-01-01' },
      { id: 'st-2', title: 'B', status: 'open' as const, completedAt: null },
      { id: 'st-3', title: 'C', status: 'done' as const, completedAt: '2026-01-02' },
    ];
    const svc = setup({ get: () => of({ key: 'X-1', subtasks }), post: () => of({}) });
    svc.loadForTicket('X-1');
    expect(svc.doneCount()).toBe(2);
    expect(svc.totalCount()).toBe(3);
  });
});
