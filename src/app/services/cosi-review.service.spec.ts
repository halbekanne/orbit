import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CosiReviewService } from './cosi-review.service';
import { JiraTicket } from '../models/work-item.model';
import { ReviewResult } from '../models/review.model';

function makeTicket(overrides: Partial<JiraTicket> = {}): JiraTicket {
  return {
    type: 'ticket', id: '1', key: 'DS-1', summary: 'Test', issueType: 'Story',
    status: 'In Progress', priority: 'Medium', assignee: '', reporter: '', creator: '',
    description: 'AK: something', dueDate: null, createdAt: '', updatedAt: '',
    url: '', labels: [], project: null, components: [],
    comments: [], attachments: [], relations: [], epicLink: null,
    ...overrides,
  } as JiraTicket;
}

describe('CosiReviewService', () => {
  let service: CosiReviewService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CosiReviewService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts in idle state', () => {
    expect(service.reviewState()).toBe('idle');
  });

  it('transitions to loading then result on success', () => {
    const mockResult: ReviewResult = {
      findings: [],
      summary: 'Keine Auffälligkeiten',
      warnings: [],
      reviewedAt: '2026-03-18T14:00:00Z',
    };

    service.requestReview('diff text', makeTicket());
    expect(service.reviewState()).toBe('loading');

    const req = httpMock.expectOne(r => r.url.includes('/api/cosi/review'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.diff).toBe('diff text');
    expect(req.request.body.jiraTicket.key).toBe('DS-1');
    req.flush(mockResult);

    const state = service.reviewState();
    expect(typeof state).toBe('object');
    expect((state as any).status).toBe('result');
    expect((state as any).data.summary).toBe('Keine Auffälligkeiten');
  });

  it('transitions to error on failure', () => {
    service.requestReview('diff', makeTicket());

    const req = httpMock.expectOne(r => r.url.includes('/api/cosi/review'));
    req.flush('Server Error', { status: 502, statusText: 'Bad Gateway' });

    const state = service.reviewState();
    expect(typeof state).toBe('object');
    expect((state as any).status).toBe('error');
  });

  it('sends null jiraTicket when no ticket provided', () => {
    service.requestReview('diff', null);

    const req = httpMock.expectOne(r => r.url.includes('/api/cosi/review'));
    expect(req.request.body.jiraTicket).toBeNull();
    req.flush({ findings: [], summary: 'Keine Auffälligkeiten', warnings: ['Kein Jira-Ticket'], reviewedAt: '' });
  });

  it('resets to idle via reset()', () => {
    service.requestReview('diff', makeTicket());
    httpMock.expectOne(r => r.url.includes('/api/cosi/review')).flush({
      findings: [], summary: '', warnings: [], reviewedAt: '',
    });

    service.reset();
    expect(service.reviewState()).toBe('idle');
  });

  it('emits on reviewRequested$ when triggerReview is called', () => {
    let emitted = false;
    service.reviewRequested$.subscribe(() => emitted = true);
    service.triggerReview();
    expect(emitted).toBe(true);
  });
});
