import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { JiraService } from './jira.service';
import { JiraTicket } from '../models/work-item.model';

describe('JiraService', () => {
  let service: JiraService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withFetch()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(JiraService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('sends request with JQL containing currentUser()', () => {
    service.getAssignedActiveTickets().subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/rest/api/2/search'));
    expect(req.request.params.get('jql')).toContain('currentUser()');
    req.flush({ issues: [] });
  });

  it('maps a Jira issue response to a JiraTicket', () => {
    let result: JiraTicket[] | undefined;
    service.getAssignedActiveTickets().subscribe(tickets => (result = tickets));

    const req = httpMock.expectOne(r => r.url.includes('/rest/api/2/search'));
    req.flush({
      issues: [{
        id: '10001',
        key: 'VERS-1',
        self: 'http://localhost:6202/rest/api/2/issue/10001',
        fields: {
          summary: 'Test Issue',
          issuetype: { name: 'Story' },
          status: { name: 'In Progress', statusCategory: { key: 'indeterminate', name: 'In Progress' } },
          priority: { name: 'High' },
          assignee: { displayName: 'Dominik M.', name: 'dominik' },
          reporter: { displayName: 'Sarah K.' },
          creator: { displayName: 'Sarah K.' },
          description: 'Test description',
          duedate: '2026-03-20',
          created: '2026-01-01T00:00:00.000+0000',
          updated: '2026-03-13T09:15:00.000+0000',
          labels: ['prio-high'],
          project: { key: 'VERS', name: 'Versicherung' },
          components: [{ name: 'Backend' }],
          comment: [{ id: 'c1', author: { displayName: 'Sarah K.' }, body: 'Looks good', created: '2026-03-10T10:00:00.000+0000' }],
          attachment: [],
          issuelinks: [],
          subtasks: [],
          customfield_10014: 'VERS-100',
        },
      }],
    });

    expect(result).toEqual([{
      type: 'ticket',
      id: '10001',
      key: 'VERS-1',
      summary: 'Test Issue',
      issueType: 'Story',
      status: 'In Progress',
      priority: 'High',
      assignee: 'Dominik M.',
      reporter: 'Sarah K.',
      creator: 'Sarah K.',
      description: 'Test description',
      dueDate: '2026-03-20',
      createdAt: '2026-01-01T00:00:00.000+0000',
      updatedAt: '2026-03-13T09:15:00.000+0000',
      url: 'http://localhost:6202/browse/VERS-1',
      labels: ['prio-high'],
      project: { key: 'VERS', name: 'Versicherung' },
      components: ['Backend'],
      comments: [{ id: 'c1', author: 'Sarah K.', body: 'Looks good', createdAt: '2026-03-10T10:00:00.000+0000' }],
      attachments: [],
      relations: [],
      epicLink: 'VERS-100',
    }]);
  });

  it('maps null priority to Medium and null assignee to fallback string', () => {
    let result: JiraTicket[] | undefined;
    service.getAssignedActiveTickets().subscribe(tickets => (result = tickets));

    const req = httpMock.expectOne(r => r.url.includes('/rest/api/2/search'));
    req.flush({
      issues: [{
        id: '10002',
        key: 'VERS-2',
        self: 'http://localhost:6202/rest/api/2/issue/10002',
        fields: {
          summary: 'No Priority',
          issuetype: { name: 'Task' },
          status: { name: 'In Review', statusCategory: { key: 'indeterminate', name: 'In Progress' } },
          priority: null,
          assignee: null,
          reporter: null,
          creator: null,
          description: null,
          duedate: null,
          created: '2026-01-01T00:00:00.000+0000',
          updated: '2026-03-13T09:15:00.000+0000',
          labels: [],
          project: { key: 'VERS', name: 'Versicherung' },
          components: [],
          comment: null,
          attachment: [],
          issuelinks: [],
          subtasks: [],
        },
      }],
    });

    expect(result![0].priority).toBe('Medium');
    expect(result![0].assignee).toBe('Unbeauftragt');
    expect(result![0].dueDate).toBeNull();
    expect(result![0].description).toBe('');
  });

  it('maps Highest priority to High and Lowest to Low', () => {
    let result: JiraTicket[] | undefined;
    service.getAssignedActiveTickets().subscribe(tickets => (result = tickets));

    const req = httpMock.expectOne(r => r.url.includes('/rest/api/2/search'));
    req.flush({
      issues: [
        {
          id: '1', key: 'A-1', self: 'http://localhost:6202/rest/api/2/issue/1',
          fields: { summary: 'A', status: { name: 'In Progress', statusCategory: { key: 'indeterminate', name: 'In Progress' } }, priority: { name: 'Highest' }, assignee: null, reporter: null, description: null, duedate: null, updated: '2026-03-13T00:00:00.000+0000' },
        },
        {
          id: '2', key: 'A-2', self: 'http://localhost:6202/rest/api/2/issue/2',
          fields: { summary: 'B', status: { name: 'In Progress', statusCategory: { key: 'indeterminate', name: 'In Progress' } }, priority: { name: 'Lowest' }, assignee: null, reporter: null, description: null, duedate: null, updated: '2026-03-13T00:00:00.000+0000' },
        },
      ],
    });

    expect(result![0].priority).toBe('High');
    expect(result![1].priority).toBe('Low');
  });

  it('propagates HTTP errors to the caller', () => {
    let error: unknown;
    service.getAssignedActiveTickets().subscribe({ error: e => (error = e) });
    const req = httpMock.expectOne(r => r.url.includes('/rest/api/2/search'));
    req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });
    expect(error).toBeTruthy();
  });
});
