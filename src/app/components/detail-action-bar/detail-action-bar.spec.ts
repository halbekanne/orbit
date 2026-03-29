import { Component, signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { WorkspaceService } from '../../services/workspace.service';
import { TodoService } from '../../services/todo.service';
import { IdeaService } from '../../services/idea.service';
import { AiReviewService } from '../../services/ai-review.service';
import { FocusService } from '../../services/focus.service';
import { SettingsService } from '../../services/settings.service';
import { DetailActionBarComponent } from './detail-action-bar';
import { Todo, Idea, JiraTicket, PullRequest, WorkItem } from '../../models/work-item.model';
import { ReviewState } from '../../models/review.model';

const makeTodo = (overrides: Partial<Todo> = {}): Todo => ({
  type: 'todo', id: 'td1', title: 'Test', description: '',
  status: 'open', urgent: false, createdAt: '', completedAt: null, ...overrides,
});

const makeIdea = (overrides: Partial<Idea> = {}): Idea => ({
  type: 'idea', id: 'id1', title: 'Test', description: '',
  status: 'active', createdAt: '', ...overrides,
});

const makeTicket = (overrides: Partial<JiraTicket> = {}): JiraTicket => ({
  type: 'ticket', id: 'tk1', key: 'T-1', summary: 'Test', issueType: 'Bug',
  status: 'In Progress', priority: 'Medium', assignee: '', reporter: '', creator: '',
  description: '', dueDate: null, createdAt: '', updatedAt: '', url: 'https://jira.example.com/T-1',
  labels: [], project: null, components: [], comments: [], attachments: [], relations: [], epicLink: null,
  ...overrides,
});

const makePr = (overrides: Partial<PullRequest> = {}): PullRequest => ({
  type: 'pr', id: '1', prNumber: 1, title: 'Test PR', description: '',
  state: 'OPEN', open: true, closed: false, locked: false, isDraft: false,
  createdDate: 0, updatedDate: 0,
  fromRef: { id: 'refs/heads/feat', displayId: 'feat', latestCommit: 'abc', repository: { id: 1, slug: 'repo', name: 'repo', projectKey: 'P', projectName: 'P', browseUrl: '' } },
  toRef: { id: 'refs/heads/main', displayId: 'main', latestCommit: 'def', repository: { id: 1, slug: 'repo', name: 'repo', projectKey: 'P', projectName: 'P', browseUrl: '' } },
  author: { user: { id: 1, name: 'u', displayName: 'User', emailAddress: '', slug: 'u', active: true, type: 'NORMAL', profileUrl: '' }, role: 'AUTHOR', approved: false, status: 'UNAPPROVED' },
  reviewers: [], participants: [],
  commentCount: 0, openTaskCount: 0, url: 'https://bb.example.com/pr/1', myReviewStatus: 'Awaiting Review',
  isAuthoredByMe: false,
  ...overrides,
} as PullRequest);

@Component({
  template: `<app-detail-action-bar [item]="item()" />`,
  imports: [DetailActionBarComponent],
})
class TestHost {
  item = signal<WorkItem>(makeTodo());
}

describe('DetailActionBarComponent', () => {
  let fixture: ComponentFixture<TestHost>;
  let el: HTMLElement;
  let updateTodoSpy: ReturnType<typeof vi.fn>;
  let updateIdeaSpy: ReturnType<typeof vi.fn>;
  let promoteSpy: ReturnType<typeof vi.fn>;
  let demoteSpy: ReturnType<typeof vi.fn>;
  let mockFocus: { isFocused: ReturnType<typeof vi.fn>; setFocus: ReturnType<typeof vi.fn>; clearFocus: ReturnType<typeof vi.fn> };
  let mockAiReview: { reviewState: ReturnType<typeof signal<ReviewState>>; canReview: ReturnType<typeof signal<boolean>>; triggerReview: ReturnType<typeof vi.fn> };

  function setup(item: WorkItem) {
    updateTodoSpy = vi.fn();
    updateIdeaSpy = vi.fn();
    promoteSpy = vi.fn();
    demoteSpy = vi.fn();
    mockFocus = { isFocused: vi.fn().mockReturnValue(false), setFocus: vi.fn(), clearFocus: vi.fn() };
    mockAiReview = { reviewState: signal<ReviewState>('idle'), canReview: signal(true), triggerReview: vi.fn() };

    TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [
        { provide: WorkspaceService, useValue: { selectedItem: signal(null), promoteToTodo: promoteSpy, demoteToIdea: demoteSpy } },
        { provide: TodoService, useValue: { update: updateTodoSpy, todos: signal([]) } },
        { provide: IdeaService, useValue: { update: updateIdeaSpy } },
        { provide: FocusService, useValue: mockFocus },
        { provide: AiReviewService, useValue: mockAiReview },
        { provide: SettingsService, useValue: { aiReviewsEnabled: signal(true) } },
      ],
    });

    fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.item.set(item);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  afterEach(() => TestBed.resetTestingModule());

  function buttonLabels(): string[] {
    return Array.from(el.querySelectorAll('button')).map(b => b.textContent!.trim());
  }

  function linkLabels(): string[] {
    return Array.from(el.querySelectorAll('a')).map(a => a.textContent!.trim());
  }

  function clickButton(label: string): void {
    const btn = Array.from(el.querySelectorAll('button')).find(b => b.textContent!.trim().includes(label));
    btn?.click();
    fixture.detectChanges();
  }

  describe('Ticket', () => {
    it('shows Focus and In Jira öffnen', () => {
      setup(makeTicket());
      expect(buttonLabels()).toContain('Fokus setzen');
      expect(linkLabels().some(l => l.includes('In Jira öffnen'))).toBe(true);
    });

    it('links to the ticket URL', () => {
      setup(makeTicket({ url: 'https://jira.example.com/T-99' }));
      const link = el.querySelector('a') as HTMLAnchorElement;
      expect(link.href).toBe('https://jira.example.com/T-99');
      expect(link.target).toBe('_blank');
    });
  });

  describe('PR', () => {
    it('shows Focus, KI-Review starten, and In Bitbucket öffnen', () => {
      setup(makePr());
      expect(buttonLabels()).toContain('Fokus setzen');
      expect(buttonLabels().some(l => l.includes('KI-Review starten'))).toBe(true);
      expect(linkLabels().some(l => l.includes('In Bitbucket öffnen'))).toBe(true);
    });

    it('shows "Review läuft..." and disables button during review', () => {
      setup(makePr());
      mockAiReview.reviewState.set({ status: 'running', pipeline: { agents: [], consolidator: { status: 'pending' }, warnings: [] } });
      fixture.detectChanges();
      const btn = Array.from(el.querySelectorAll('button')).find(b => b.textContent!.includes('Review läuft'));
      expect(btn).toBeTruthy();
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    it('shows "Erneut reviewen" after review completes', () => {
      setup(makePr());
      mockAiReview.reviewState.set({
        status: 'result',
        pipeline: { agents: [], consolidator: { status: 'pending' }, warnings: [] },
        data: { findings: [], summary: '', warnings: [], reviewedAt: '' },
      });
      fixture.detectChanges();
      expect(buttonLabels().some(l => l.includes('Erneut reviewen'))).toBe(true);
    });

    it('disables KI-Review when canReview is false', () => {
      setup(makePr());
      mockAiReview.canReview.set(false);
      fixture.detectChanges();
      const btn = Array.from(el.querySelectorAll('button')).find(b => b.textContent!.includes('KI-Review starten')) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('calls triggerReview on click', () => {
      setup(makePr());
      clickButton('KI-Review starten');
      expect(mockAiReview.triggerReview).toHaveBeenCalled();
    });

    it('links to the PR URL', () => {
      setup(makePr({ url: 'https://bb.example.com/pr/42' }));
      const link = el.querySelector('a') as HTMLAnchorElement;
      expect(link.href).toBe('https://bb.example.com/pr/42');
    });
  });

  describe('Todo (open)', () => {
    it('shows Focus, Erledigt, Dringend, Zur Idee machen, Nicht erledigen', () => {
      setup(makeTodo({ status: 'open' }));
      const labels = buttonLabels();
      expect(labels).toContain('Fokus setzen');
      expect(labels).toContain('Erledigt');
      expect(labels).toContain('Dringend');
      expect(labels).toContain('Zur Idee machen');
      expect(labels).toContain('Nicht erledigen');
    });

    it('calls todoService.update with done status on Erledigt click', () => {
      setup(makeTodo({ id: 'td1', status: 'open' }));
      clickButton('Erledigt');
      expect(updateTodoSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'td1', status: 'done' }));
    });

    it('toggles urgent on Dringend click', () => {
      setup(makeTodo({ id: 'td1', status: 'open', urgent: false }));
      clickButton('Dringend');
      expect(updateTodoSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'td1', urgent: true }));
    });

    it('calls demoteToIdea on Zur Idee machen click', () => {
      const todo = makeTodo({ status: 'open' });
      setup(todo);
      clickButton('Zur Idee machen');
      expect(demoteSpy).toHaveBeenCalledWith(todo);
    });

    it('sets wont-do status on Nicht erledigen click', () => {
      setup(makeTodo({ id: 'td1', status: 'open' }));
      clickButton('Nicht erledigen');
      expect(updateTodoSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'td1', status: 'wont-do' }));
    });

    it('shows Dringend button with warning style when urgent', () => {
      setup(makeTodo({ status: 'open', urgent: true }));
      const btn = Array.from(el.querySelectorAll('button')).find(b => b.textContent!.trim() === 'Dringend') as HTMLButtonElement;
      expect(btn.getAttribute('aria-pressed')).toBe('true');
      expect(btn.className).toContain('signal-text');
    });
  });

  describe('Todo (done)', () => {
    it('shows Wieder öffnen and Zur Idee machen only', () => {
      setup(makeTodo({ status: 'done', completedAt: '2026-03-16T00:00:00' }));
      const labels = buttonLabels();
      expect(labels).toContain('Wieder öffnen');
      expect(labels).toContain('Zur Idee machen');
      expect(labels).not.toContain('Erledigt');
      expect(labels).not.toContain('Fokus setzen');
    });

    it('reopens todo on Wieder öffnen click', () => {
      setup(makeTodo({ id: 'td1', status: 'done', completedAt: '2026-03-16T00:00:00' }));
      clickButton('Wieder öffnen');
      expect(updateTodoSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'td1', status: 'open', completedAt: null }));
    });
  });

  describe('Todo (wont-do)', () => {
    it('shows only Wieder öffnen', () => {
      setup(makeTodo({ status: 'wont-do' }));
      const labels = buttonLabels();
      expect(labels).toEqual(['Wieder öffnen']);
    });

    it('reopens todo on click', () => {
      setup(makeTodo({ id: 'td1', status: 'wont-do' }));
      clickButton('Wieder öffnen');
      expect(updateTodoSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'td1', status: 'open' }));
    });
  });

  describe('Idea (active)', () => {
    it('shows Focus, Zur Aufgabe machen, Nicht verfolgen', () => {
      setup(makeIdea({ status: 'active' }));
      const labels = buttonLabels();
      expect(labels).toContain('Fokus setzen');
      expect(labels).toContain('Zur Aufgabe machen');
      expect(labels).toContain('Nicht verfolgen');
    });

    it('calls promoteToTodo on Zur Aufgabe machen click', () => {
      const idea = makeIdea({ status: 'active' });
      setup(idea);
      clickButton('Zur Aufgabe machen');
      expect(promoteSpy).toHaveBeenCalledWith(idea);
    });

    it('sets wont-do on Nicht verfolgen click', () => {
      setup(makeIdea({ id: 'id1', status: 'active' }));
      clickButton('Nicht verfolgen');
      expect(updateIdeaSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'id1', status: 'wont-do' }));
    });
  });

  describe('Idea (wont-do)', () => {
    it('shows only Wieder aufgreifen', () => {
      setup(makeIdea({ status: 'wont-do' }));
      const labels = buttonLabels();
      expect(labels).toEqual(['Wieder aufgreifen']);
    });

    it('revives idea on click', () => {
      setup(makeIdea({ id: 'id1', status: 'wont-do' }));
      clickButton('Wieder aufgreifen');
      expect(updateIdeaSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'id1', status: 'active' }));
    });
  });

  describe('Focus toggle', () => {
    it('shows "Fokus entfernen" when item is focused', () => {
      mockFocus = { isFocused: vi.fn().mockReturnValue(true), setFocus: vi.fn(), clearFocus: vi.fn() };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [TestHost],
        providers: [
          { provide: WorkspaceService, useValue: { selectedItem: signal(null), promoteToTodo: vi.fn(), demoteToIdea: vi.fn() } },
          { provide: TodoService, useValue: { update: vi.fn(), todos: signal([]) } },
          { provide: IdeaService, useValue: { update: vi.fn() } },
          { provide: FocusService, useValue: mockFocus },
          { provide: AiReviewService, useValue: { reviewState: signal<ReviewState>('idle'), canReview: signal(true), triggerReview: vi.fn() } },
          { provide: SettingsService, useValue: { aiReviewsEnabled: signal(true) } },
        ],
      });

      fixture = TestBed.createComponent(TestHost);
      fixture.componentInstance.item.set(makeTicket());
      fixture.detectChanges();
      el = fixture.nativeElement;

      expect(buttonLabels()).toContain('Fokus entfernen');
    });

    it('calls clearFocus when already focused', () => {
      mockFocus = { isFocused: vi.fn().mockReturnValue(true), setFocus: vi.fn(), clearFocus: vi.fn() };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [TestHost],
        providers: [
          { provide: WorkspaceService, useValue: { selectedItem: signal(null), promoteToTodo: vi.fn(), demoteToIdea: vi.fn() } },
          { provide: TodoService, useValue: { update: vi.fn(), todos: signal([]) } },
          { provide: IdeaService, useValue: { update: vi.fn() } },
          { provide: FocusService, useValue: mockFocus },
          { provide: AiReviewService, useValue: { reviewState: signal<ReviewState>('idle'), canReview: signal(true), triggerReview: vi.fn() } },
          { provide: SettingsService, useValue: { aiReviewsEnabled: signal(true) } },
        ],
      });

      fixture = TestBed.createComponent(TestHost);
      fixture.componentInstance.item.set(makeTicket());
      fixture.detectChanges();
      el = fixture.nativeElement;

      clickButton('Fokus entfernen');
      expect(mockFocus.clearFocus).toHaveBeenCalled();
    });

    it('calls setFocus when not focused', () => {
      setup(makeTicket({ id: 'tk1' }));
      clickButton('Fokus setzen');
      expect(mockFocus.setFocus).toHaveBeenCalledWith({ id: 'tk1', type: 'ticket' });
    });
  });

  describe('Host element', () => {
    it('has toolbar role', () => {
      setup(makeTodo());
      const bar = el.querySelector('app-detail-action-bar');
      expect(bar?.getAttribute('role')).toBe('toolbar');
    });
  });
});
