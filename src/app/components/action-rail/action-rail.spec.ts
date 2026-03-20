import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { WorkDataService } from '../../services/work-data.service';
import { TodoService } from '../../services/todo.service';
import { IdeaService } from '../../services/idea.service';
import { CosiReviewService } from '../../services/cosi-review.service';
import { ActionRailComponent } from './action-rail';
import { Todo, Idea, JiraTicket, PullRequest } from '../../models/work-item.model';
import { ReviewState } from '../../models/review.model';

const makeTodo = (overrides: Partial<Todo> = {}): Todo => ({
  type: 'todo', id: 'td1', title: 'Test', description: '',
  status: 'open', urgent: false, createdAt: '', completedAt: null, ...overrides,
});

const makeIdea = (overrides: Partial<Idea> = {}): Idea => ({
  type: 'idea', id: 'id1', title: 'Test', description: '',
  status: 'active', createdAt: '', ...overrides,
});

const makePr = (overrides: Partial<PullRequest> = {}): PullRequest => ({
  type: 'pr', id: '1', prNumber: 1, title: 'Test PR', description: '',
  state: 'OPEN', open: true, closed: false, locked: false, isDraft: false,
  createdDate: 0, updatedDate: 0,
  fromRef: { id: 'refs/heads/feat', displayId: 'feat', latestCommit: 'abc', repository: { id: 1, slug: 'repo', name: 'repo', projectKey: 'P', projectName: 'P', browseUrl: '' } },
  toRef: { id: 'refs/heads/main', displayId: 'main', latestCommit: 'def', repository: { id: 1, slug: 'repo', name: 'repo', projectKey: 'P', projectName: 'P', browseUrl: '' } },
  author: { user: { id: 1, name: 'u', displayName: 'User', emailAddress: '', slug: 'u', active: true, type: 'NORMAL', profileUrl: '' }, role: 'AUTHOR', approved: false, status: 'UNAPPROVED' },
  reviewers: [], participants: [],
  commentCount: 0, openTaskCount: 0, url: '', myReviewStatus: 'Awaiting Review',
  ...overrides,
} as PullRequest);

describe('ActionRailComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(selectedItem: unknown) {
    const mockData = { selectedItem: signal(selectedItem) };
    const updateSpy = vi.fn();
    const promoteSpy = vi.fn();
    const demoteSpy = vi.fn();
    const mockCosiReview = {
      reviewState: signal<ReviewState>('idle'),
      canReview: signal(true),
      triggerReview: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [ActionRailComponent],
      providers: [
        { provide: WorkDataService, useValue: { selectedItem: mockData.selectedItem, promoteToTodo: promoteSpy, demoteToIdea: demoteSpy } },
        { provide: TodoService, useValue: { update: updateSpy, todos: signal([]) } },
        { provide: IdeaService, useValue: { update: vi.fn() } },
        { provide: CosiReviewService, useValue: mockCosiReview },
      ],
    });
    const fixture = TestBed.createComponent(ActionRailComponent);
    fixture.detectChanges();
    return { fixture, updateSpy, promoteSpy, demoteSpy, mockCosiReview };
  }

  it('renders nothing meaningful when no item selected', () => {
    const { fixture } = setup(null);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('button').length).toBe(0);
  });

  it('shows Erledigt button for open todo', () => {
    const { fixture } = setup(makeTodo({ status: 'open' }));
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const labels = Array.from(buttons).map((b: unknown) => (b as Element).textContent?.trim());
    expect(labels).toContain('Erledigt');
  });

  it('shows Wieder öffnen for done todo', () => {
    const { fixture } = setup(makeTodo({ status: 'done', completedAt: '2026-03-16T00:00:00' }));
    const labels = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .map((b: unknown) => (b as Element).textContent?.trim());
    expect(labels.some(l => l?.includes('Wieder öffnen'))).toBe(true);
  });

  it('shows Zur Aufgabe machen for active idea', () => {
    const { fixture } = setup(makeIdea({ status: 'active' }));
    const labels = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .map((b: unknown) => (b as Element).textContent?.trim());
    expect(labels.some(l => l?.includes('Zur Aufgabe machen'))).toBe(true);
  });

  it('shows In Jira öffnen link for ticket', () => {
    const ticket: Partial<JiraTicket> = { type: 'ticket', url: 'https://jira.example.com/browse/T-1' };
    const { fixture } = setup(ticket);
    const link = fixture.nativeElement.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('https://jira.example.com/browse/T-1');
  });

  it('shows KI-Review button when PR is selected', () => {
    const { fixture } = setup(makePr());
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const labels = Array.from(buttons).map((b: unknown) => (b as Element).textContent?.trim());
    expect(labels.some(l => l?.includes('KI-Review starten'))).toBe(true);
  });

  it('shows In Bitbucket öffnen link when PR is selected', () => {
    const { fixture } = setup(makePr({ url: 'https://bb.example.com/pr/1' }));
    const link = fixture.nativeElement.querySelector('a');
    expect(link?.textContent?.trim()).toContain('In Bitbucket öffnen');
  });

  it('disables KI-Review button and shows loading text during review', () => {
    const { fixture, mockCosiReview } = setup(makePr());
    mockCosiReview.reviewState.set('loading');
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const reviewBtn = buttons.find(b => b.textContent?.includes('Review läuft'));
    expect(reviewBtn).toBeTruthy();
    expect(reviewBtn?.disabled).toBe(true);
  });

  it('shows "Erneut reviewen" after review completes', () => {
    const { fixture, mockCosiReview } = setup(makePr());
    mockCosiReview.reviewState.set({
      status: 'result',
      data: { findings: [], summary: 'Keine Auffälligkeiten', warnings: [], reviewedAt: '' },
    });
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const reviewBtn = buttons.find(b => b.textContent?.includes('Erneut reviewen'));
    expect(reviewBtn).toBeTruthy();
  });

  it('disables KI-Review button when canReview is false', () => {
    const { fixture, mockCosiReview } = setup(makePr());
    mockCosiReview.canReview.set(false);
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const reviewBtn = buttons.find(b => b.textContent?.includes('KI-Review starten'));
    expect(reviewBtn?.disabled).toBe(true);
  });

  it('calls triggerReview on button click', () => {
    const { fixture, mockCosiReview } = setup(makePr());
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const reviewBtn = buttons.find(b => b.textContent?.includes('KI-Review starten'));
    reviewBtn?.click();
    expect(mockCosiReview.triggerReview).toHaveBeenCalled();
  });
});
