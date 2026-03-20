import { TestBed } from '@angular/core/testing';
import { CosiReviewService } from './cosi-review.service';
import { JiraTicket } from '../models/work-item.model';
import { ReviewState } from '../models/review.model';

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

function buildSSE(...events: Array<{ event: string; data: unknown }>): string {
  return events.map(e => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join('');
}

function mockFetchSSE(events: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(events));
      controller.close();
    },
  });
  return vi.fn().mockResolvedValue({ ok: true, body: stream } as unknown as Response);
}

describe('CosiReviewService', () => {
  let service: CosiReviewService;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    TestBed.configureTestingModule({});
    service = TestBed.inject(CosiReviewService);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('starts in idle state', () => {
    expect(service.reviewState()).toBe('idle');
  });

  it('transitions to running then result on successful SSE stream', async () => {
    const ssePayload = buildSSE(
      { event: 'agent:start', data: { agent: 'ak-check', label: 'AK-Abgleich', temperature: 0.2 } },
      { event: 'agent:done', data: { agent: 'ak-check', duration: 1200, findingCount: 1, summary: 'Found 1 issue' } },
      { event: 'consolidator:start', data: { temperature: 0.1 } },
      {
        event: 'consolidator:done', data: {
          duration: 800,
          decisions: [],
          summary: 'Consolidated',
          result: {
            findings: [{ severity: 'minor', category: 'ak-abgleich', title: 'Test', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' }],
            summary: 'Keine Auffälligkeiten',
            warnings: [],
            reviewedAt: '2026-03-18T14:00:00Z',
          },
        },
      },
      { event: 'done', data: { totalDuration: 2000 } },
    );

    globalThis.fetch = mockFetchSSE(ssePayload);
    const promise = service.requestReview('diff text', makeTicket());

    const runningState = service.reviewState();
    expect(typeof runningState).toBe('object');
    expect((runningState as Exclude<ReviewState, 'idle'>).status).toBe('running');

    await promise;

    const state = service.reviewState() as Extract<ReviewState, { status: 'result' }>;
    expect(state.status).toBe('result');
    expect(state.data.summary).toBe('Keine Auffälligkeiten');
    expect(state.data.findings).toHaveLength(1);
    expect(state.pipeline.agents).toHaveLength(1);
    expect(state.pipeline.agents[0].status).toBe('done');
    expect(state.pipeline.consolidator.status).toBe('done');
    expect(state.pipeline.totalDuration).toBe(2000);
  });

  it('handles agent:error events', async () => {
    const ssePayload = buildSSE(
      { event: 'agent:start', data: { agent: 'ak-check', label: 'AK-Abgleich', temperature: 0.2 } },
      { event: 'agent:error', data: { agent: 'ak-check', error: 'LLM timeout' } },
      { event: 'done', data: { totalDuration: 500 } },
    );

    globalThis.fetch = mockFetchSSE(ssePayload);
    await service.requestReview('diff', makeTicket());

    const state = service.reviewState() as Extract<ReviewState, { status: 'result' }>;
    expect(state.pipeline.agents).toHaveLength(1);
    expect(state.pipeline.agents[0].status).toBe('error');
    expect(state.pipeline.agents[0].error).toBe('LLM timeout');
  });

  it('collects warnings into pipeline state', async () => {
    const ssePayload = buildSSE(
      { event: 'warning', data: { message: 'Kein Jira-Ticket' } },
      { event: 'warning', data: { message: 'Diff ist sehr lang' } },
      { event: 'done', data: { totalDuration: 100 } },
    );

    globalThis.fetch = mockFetchSSE(ssePayload);
    await service.requestReview('diff', null);

    const state = service.reviewState() as Extract<ReviewState, { status: 'result' }>;
    expect(state.pipeline.warnings).toEqual(['Kein Jira-Ticket', 'Diff ist sehr lang']);
  });

  it('transitions to error on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await service.requestReview('diff', makeTicket());

    const state = service.reviewState() as Extract<ReviewState, { status: 'error' }>;
    expect(state.status).toBe('error');
    expect(state.message).toBe('Network error');
    expect(state.pipeline).toBeDefined();
  });

  it('resets to idle via reset()', async () => {
    const ssePayload = buildSSE(
      { event: 'done', data: { totalDuration: 100 } },
    );
    globalThis.fetch = mockFetchSSE(ssePayload);
    await service.requestReview('diff', makeTicket());

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
