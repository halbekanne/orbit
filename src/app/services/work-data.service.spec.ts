import { TestBed } from '@angular/core/testing';
import { of, throwError, Observable } from 'rxjs';
import { JiraTicket } from '../models/work-item.model';
import { JiraService } from './jira.service';
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
