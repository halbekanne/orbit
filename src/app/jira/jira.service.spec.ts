import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { JiraService } from './jira.service';
import { JiraTicket } from '../shared/work-item.model';

describe('JiraService', () => {
  let service: JiraService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withFetch()), provideHttpClientTesting()],
    });
    service = TestBed.inject(JiraService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('sends request with JQL containing currentUser()', () => {
    service.getAssignedActiveTickets().subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('/rest/api/2/search'));
    expect(req.request.params.get('jql')).toContain('currentUser()');
    req.flush({ issues: [] });
  });

  it('maps a Jira issue response to a JiraTicket', () => {
    let result: JiraTicket[] | undefined;
    service.getAssignedActiveTickets().subscribe((tickets) => (result = tickets));

    const req = httpMock.expectOne((r) => r.url.includes('/rest/api/2/search'));
    req.flush({
      issues: [
        {
          id: '10001',
          key: 'VERS-1',
          self: 'http://localhost:6202/rest/api/2/issue/10001',
          fields: {
            summary: 'Test Issue',
            issuetype: { name: 'Story' },
            status: {
              name: 'In Progress',
              statusCategory: { key: 'indeterminate', name: 'In Progress' },
            },
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
            comment: [
              {
                id: 'c1',
                author: { displayName: 'Sarah K.' },
                body: 'Looks good',
                created: '2026-03-10T10:00:00.000+0000',
              },
            ],
            attachment: [],
            issuelinks: [],
            subtasks: [],
            customfield_10014: 'VERS-100',
          },
        },
      ],
    });

    expect(result).toEqual([
      {
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
        comments: [
          {
            id: 'c1',
            author: 'Sarah K.',
            body: 'Looks good',
            createdAt: '2026-03-10T10:00:00.000+0000',
          },
        ],
        attachments: [],
        relations: [],
        epicLink: 'VERS-100',
      },
    ]);
  });

  it('maps null priority to Medium and null assignee to "Nicht zugeordnet"', () => {
    let result: JiraTicket[] | undefined;
    service.getAssignedActiveTickets().subscribe((tickets) => (result = tickets));

    const req = httpMock.expectOne((r) => r.url.includes('/rest/api/2/search'));
    req.flush({
      issues: [
        {
          id: '10002',
          key: 'VERS-2',
          self: 'http://localhost:6202/rest/api/2/issue/10002',
          fields: {
            summary: 'No Priority',
            issuetype: { name: 'Task' },
            status: {
              name: 'In Review',
              statusCategory: { key: 'indeterminate', name: 'In Progress' },
            },
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
        },
      ],
    });

    expect(result![0].priority).toBe('Medium');
    expect(result![0].assignee).toBe('Nicht zugeordnet');
    expect(result![0].dueDate).toBeNull();
    expect(result![0].description).toBe('');
  });

  it('maps Highest priority to High and Lowest to Low', () => {
    let result: JiraTicket[] | undefined;
    service.getAssignedActiveTickets().subscribe((tickets) => (result = tickets));

    const req = httpMock.expectOne((r) => r.url.includes('/rest/api/2/search'));
    req.flush({
      issues: [
        {
          id: '1',
          key: 'A-1',
          self: 'http://localhost:6202/rest/api/2/issue/1',
          fields: {
            summary: 'A',
            status: {
              name: 'In Progress',
              statusCategory: { key: 'indeterminate', name: 'In Progress' },
            },
            priority: { name: 'Highest' },
            assignee: null,
            reporter: null,
            description: null,
            duedate: null,
            updated: '2026-03-13T00:00:00.000+0000',
          },
        },
        {
          id: '2',
          key: 'A-2',
          self: 'http://localhost:6202/rest/api/2/issue/2',
          fields: {
            summary: 'B',
            status: {
              name: 'In Progress',
              statusCategory: { key: 'indeterminate', name: 'In Progress' },
            },
            priority: { name: 'Lowest' },
            assignee: null,
            reporter: null,
            description: null,
            duedate: null,
            updated: '2026-03-13T00:00:00.000+0000',
          },
        },
      ],
    });

    expect(result![0].priority).toBe('High');
    expect(result![1].priority).toBe('Low');
  });

  it('propagates HTTP errors to the caller', () => {
    let error: unknown;
    service.getAssignedActiveTickets().subscribe({ error: (e) => (error = e) });
    const req = httpMock.expectOne((r) => r.url.includes('/rest/api/2/search'));
    req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });
    expect(error).toBeTruthy();
  });

  it('getTicketByKey fetches a single issue by key', () => {
    let result: JiraTicket | undefined;
    service.getTicketByKey('VERS-42').subscribe((ticket) => (result = ticket));

    const req = httpMock.expectOne((r) => r.url.includes('/rest/api/2/issue/VERS-42'));
    expect(req.request.method).toBe('GET');
    req.flush({
      id: '10042',
      key: 'VERS-42',
      self: 'http://localhost:6202/rest/api/2/issue/10042',
      fields: {
        summary: 'Fix the login',
        issuetype: { name: 'Bug' },
        status: {
          name: 'In Progress',
          statusCategory: { key: 'indeterminate', name: 'In Progress' },
        },
        priority: { name: 'High' },
        assignee: { displayName: 'Anna B.', name: 'anna' },
        reporter: null,
        creator: null,
        description: 'Some description',
        duedate: null,
        created: '2026-01-01T00:00:00.000+0000',
        updated: '2026-03-01T00:00:00.000+0000',
        labels: [],
        project: { key: 'VERS', name: 'Versicherung' },
        components: [],
        comment: [],
        attachment: [],
        issuelinks: [],
        subtasks: [],
      },
    });

    expect(result!.key).toBe('VERS-42');
    expect(result!.summary).toBe('Fix the login');
    expect(result!.issueType).toBe('Bug');
    expect(result!.assignee).toBe('Anna B.');
  });

  function makeRawIssue(
    overrides: { description?: string; comments?: { id: string; body: string }[] } = {},
  ) {
    return {
      id: '99',
      key: 'TEST-1',
      self: 'http://localhost:6202/rest/api/2/issue/99',
      fields: {
        summary: 'Test Issue',
        issuetype: { name: 'Task' },
        status: {
          name: 'In Progress',
          statusCategory: { key: 'indeterminate', name: 'In Progress' },
        },
        priority: null,
        assignee: null,
        reporter: null,
        creator: null,
        description: overrides.description ?? null,
        duedate: null,
        created: '2026-01-01T00:00:00.000+0000',
        updated: '2026-01-01T00:00:00.000+0000',
        labels: [],
        project: { key: 'TEST', name: 'Test' },
        components: [],
        comment: (overrides.comments ?? []).map((c) => ({
          id: c.id,
          author: { displayName: 'Someone' },
          body: c.body,
          created: '2026-01-01T00:00:00.000+0000',
        })),
        attachment: [],
        issuelinks: [],
        subtasks: [],
      },
    };
  }

  it('resolves user mention in description to display name', () => {
    let result: JiraTicket | undefined;
    service.getTicketByKey('TEST-1').subscribe((t) => (result = t));

    httpMock
      .expectOne((r) => r.url.includes('/issue/TEST-1'))
      .flush(makeRawIssue({ description: 'Bitte [~u99] prüfen.' }));
    httpMock
      .expectOne((r) => r.url.includes('/user') && r.params.get('username') === 'u99')
      .flush({ displayName: 'Anna Bergmann' });

    expect(result!.description).toBe('Bitte [~Anna Bergmann] prüfen.');
  });

  it('resolves user mention in comment body to display name', () => {
    let result: JiraTicket | undefined;
    service.getTicketByKey('TEST-1').subscribe((t) => (result = t));

    httpMock
      .expectOne((r) => r.url.includes('/issue/TEST-1'))
      .flush(makeRawIssue({ comments: [{ id: 'c1', body: 'FYI [~u99]' }] }));
    httpMock
      .expectOne((r) => r.url.includes('/user') && r.params.get('username') === 'u99')
      .flush({ displayName: 'Michael Braun' });

    expect(result!.comments[0].body).toBe('FYI [~Michael Braun]');
  });

  it('does not fetch a user slug that was already resolved', () => {
    service.getTicketByKey('TEST-1').subscribe();
    httpMock
      .expectOne((r) => r.url.includes('/issue/TEST-1'))
      .flush(makeRawIssue({ description: '[~u99]' }));
    httpMock.expectOne((r) => r.url.includes('/user')).flush({ displayName: 'Anna Bergmann' });

    service.getTicketByKey('TEST-1').subscribe();
    httpMock
      .expectOne((r) => r.url.includes('/issue/TEST-1'))
      .flush(makeRawIssue({ description: '[~u99] again' }));
    httpMock.expectNone((r) => r.url.includes('/user'));
  });

  it('keeps original slug when user lookup fails', () => {
    let result: JiraTicket | undefined;
    service.getTicketByKey('TEST-1').subscribe((t) => (result = t));

    httpMock
      .expectOne((r) => r.url.includes('/issue/TEST-1'))
      .flush(makeRawIssue({ description: '[~u404]' }));
    httpMock
      .expectOne((r) => r.url.includes('/user') && r.params.get('username') === 'u404')
      .flush({ errorMessages: ['User not found'] }, { status: 404, statusText: 'Not Found' });

    expect(result!.description).toBe('[~u404]');
  });

  it('resolves multiple distinct slugs in a single ticket', () => {
    let result: JiraTicket | undefined;
    service.getTicketByKey('TEST-1').subscribe((t) => (result = t));

    httpMock
      .expectOne((r) => r.url.includes('/issue/TEST-1'))
      .flush(makeRawIssue({ description: '[~ua] und [~ub] sind beteiligt.' }));

    const userReqs = httpMock.match((r) => r.url.includes('/user'));
    expect(userReqs.length).toBe(2);
    const slugs = userReqs.map((r) => r.request.params.get('username'));
    expect(slugs).toContain('ua');
    expect(slugs).toContain('ub');
    userReqs.find((r) => r.request.params.get('username') === 'ua')!.flush({ displayName: 'Anna' });
    userReqs.find((r) => r.request.params.get('username') === 'ub')!.flush({ displayName: 'Bob' });

    expect(result!.description).toBe('[~Anna] und [~Bob] sind beteiligt.');
  });

  it('makes no user API calls when there are no mentions', () => {
    service.getTicketByKey('TEST-1').subscribe();
    httpMock
      .expectOne((r) => r.url.includes('/issue/TEST-1'))
      .flush(makeRawIssue({ description: 'Kein Erwähnungen hier.' }));
    httpMock.expectNone((r) => r.url.includes('/user'));
  });
});
