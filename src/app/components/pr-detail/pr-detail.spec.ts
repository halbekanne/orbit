import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { PrDetailComponent } from './pr-detail';
import { JiraService } from '../../services/jira.service';
import { BitbucketService } from '../../services/bitbucket.service';
import { AiReviewService } from '../../services/ai-review.service';
import { WorkspaceService } from '../../services/workspace.service';
import { FocusService } from '../../services/focus.service';
import { TodoService } from '../../services/todo.service';
import { IdeaService } from '../../services/idea.service';
import { SettingsService } from '../../services/settings.service';
import { PullRequest, JiraTicket } from '../../models/work-item.model';
import { signal } from '@angular/core';

const basePr: PullRequest = {
  type: 'pr', id: '1', prNumber: 1,
  title: 'VERS-42: Fix login',
  description: '',
  state: 'OPEN', open: true, closed: false, locked: false, isDraft: false,
  createdDate: 0, updatedDate: 0,
  fromRef: {
    id: 'refs/heads/feature/VERS-42-fix', displayId: 'feature/VERS-42-fix',
    latestCommit: 'abc', repository: {
      id: 1, slug: 'repo', name: 'repo',
      projectKey: 'PROJ', projectName: 'Project', browseUrl: '',
    },
  },
  toRef: {
    id: 'refs/heads/main', displayId: 'main',
    latestCommit: 'def', repository: {
      id: 1, slug: 'repo', name: 'repo',
      projectKey: 'PROJ', projectName: 'Project', browseUrl: '',
    },
  },
  author: {
    user: { id: 1, name: 'u', displayName: 'User', emailAddress: '', slug: 'u', active: true, type: 'NORMAL', profileUrl: '' },
    role: 'AUTHOR', approved: false, status: 'UNAPPROVED',
  },
  reviewers: [], participants: [],
  commentCount: 0, openTaskCount: 0,
  url: '', myReviewStatus: 'Awaiting Review',
  isAuthoredByMe: false,
};

const noKeyPr: PullRequest = {
  ...basePr,
  title: 'Fix some stuff',
  fromRef: { ...basePr.fromRef, displayId: 'fix-some-stuff' },
};

const mockTicket: JiraTicket = {
  type: 'ticket', id: '1', key: 'VERS-42',
  summary: 'Fix the login flow', issueType: 'Bug',
  status: 'In Progress', priority: 'High', assignee: 'Anna B.',
  reporter: '', creator: '', description: '', dueDate: null,
  createdAt: '', updatedAt: '', url: '', labels: [],
  project: null, components: [], comments: [], attachments: [],
  relations: [], epicLink: null,
};

const SAMPLE_DIFF = `diff --git a/file.ts b/file.ts
index 0000001..0000002 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 const a = 1;
-const b = 2;
+const b = 3;
 const c = 4;`;

describe('PrDetailComponent', () => {
  let fixture: ComponentFixture<PrDetailComponent>;
  const getTicketByKey = vi.fn();
  const getPullRequestDiff = vi.fn();
  const mockAiReview = {
    reviewState: signal<import('../../models/review.model').ReviewState>('idle'),
    canReview: signal(false),
    reviewRequested$: new Subject<void>(),
    triggerReview: vi.fn(),
    requestReview: vi.fn(),
    reset: vi.fn(),
  };

  beforeEach(() => {
    getTicketByKey.mockReset();
    getPullRequestDiff.mockReset();
    mockAiReview.reset.mockReset();
    mockAiReview.requestReview.mockReset();
    mockAiReview.reviewState.set('idle');
    mockAiReview.canReview.set(false);
    TestBed.configureTestingModule({
      imports: [PrDetailComponent],
      providers: [
        { provide: JiraService, useValue: { getTicketByKey } },
        { provide: BitbucketService, useValue: { getPullRequestDiff } },
        { provide: AiReviewService, useValue: mockAiReview },
        { provide: WorkspaceService, useValue: { selectedItem: signal(null), demoteToIdea: vi.fn(), promoteToTodo: vi.fn() } },
        { provide: FocusService, useValue: { isFocused: () => false, setFocus: vi.fn(), clearFocus: vi.fn() } },
        { provide: TodoService, useValue: { update: vi.fn(), todos: signal([]) } },
        { provide: IdeaService, useValue: { update: vi.fn() } },
        { provide: SettingsService, useValue: { aiReviewsEnabled: signal(true), theme: signal('system') } },
      ],
    });
  });

  it('shows the Jira card with ticket data when fetch succeeds', async () => {
    getPullRequestDiff.mockReturnValue(of(''));
    getTicketByKey.mockReturnValue(of(mockTicket));
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', basePr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('VERS-42');
    expect(getTicketByKey).toHaveBeenCalledWith('VERS-42');
  });

  it('shows error state when fetch fails', async () => {
    getPullRequestDiff.mockReturnValue(of(''));
    getTicketByKey.mockReturnValue(throwError(() => new Error('Network error')));
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', basePr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const jiraButton = Array.from<Element>(fixture.nativeElement.querySelectorAll('button')).find(b => b.textContent!.includes('Jira-Ticket')) as HTMLButtonElement;
    jiraButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ticket konnte nicht geladen werden');
  });

  it('shows no-ticket state when PR has no Jira key', async () => {
    getPullRequestDiff.mockReturnValue(of(''));
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', noKeyPr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const jiraButton = Array.from<Element>(fixture.nativeElement.querySelectorAll('button')).find(b => b.textContent!.includes('Jira-Ticket')) as HTMLButtonElement;
    jiraButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Kein Jira-Ticket gefunden');
    expect(getTicketByKey).not.toHaveBeenCalled();
  });

  it('shows loading state for diff when expanded', async () => {
    getTicketByKey.mockReturnValue(of(mockTicket));
    const diffSubject = new Subject<string>();
    getPullRequestDiff.mockReturnValue(diffSubject.asObservable());
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', basePr);
    fixture.detectChanges();

    const diffButton = Array.from<Element>(fixture.nativeElement.querySelectorAll('button')).find(b => b.textContent!.includes('Änderungen')) as HTMLButtonElement;
    diffButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Änderungen laden');
  });

  it('shows file count in diff card header after diff loads', async () => {
    getTicketByKey.mockReturnValue(of(mockTicket));
    getPullRequestDiff.mockReturnValue(of(SAMPLE_DIFF));
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', basePr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const diffButton = Array.from<Element>(fixture.nativeElement.querySelectorAll('button')).find(b => b.textContent!.includes('Änderungen')) as HTMLButtonElement;
    expect(diffButton.textContent).toContain('1 Datei');
  });

  it('shows error state when diff fetch fails', async () => {
    getTicketByKey.mockReturnValue(of(mockTicket));
    getPullRequestDiff.mockReturnValue(throwError(() => new Error('fail')));
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', basePr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const diffButton = Array.from<Element>(fixture.nativeElement.querySelectorAll('button')).find(b => b.textContent!.includes('Änderungen')) as HTMLButtonElement;
    diffButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Änderungen konnten nicht geladen werden');
  });

  it('expands and collapses diff on toggle click', async () => {
    getTicketByKey.mockReturnValue(of(mockTicket));
    getPullRequestDiff.mockReturnValue(of(SAMPLE_DIFF));
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', basePr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const diffButton = Array.from<Element>(fixture.nativeElement.querySelectorAll('button')).find(b => b.textContent!.includes('Änderungen')) as HTMLButtonElement;
    expect(diffButton).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.overflow-x-auto')).toBeNull();

    diffButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.overflow-x-auto')).toBeTruthy();

    diffButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.overflow-x-auto')).toBeNull();
  });

  it('shows empty diff message when diff has no files', async () => {
    getTicketByKey.mockReturnValue(of(mockTicket));
    getPullRequestDiff.mockReturnValue(of(''));
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', basePr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const diffButton = Array.from<Element>(fixture.nativeElement.querySelectorAll('button')).find(b => b.textContent!.includes('Änderungen')) as HTMLButtonElement;
    diffButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Keine Änderungen vorhanden');
  });

  it('renders the review findings component', async () => {
    getTicketByKey.mockReturnValue(of(mockTicket));
    getPullRequestDiff.mockReturnValue(of(SAMPLE_DIFF));
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', basePr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-review-findings')).toBeTruthy();
  });

  it('resets review state when PR changes', async () => {
    getTicketByKey.mockReturnValue(of(mockTicket));
    getPullRequestDiff.mockReturnValue(of(SAMPLE_DIFF));
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', basePr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const updatedPr = { ...basePr, title: 'VERS-99: Another PR' };
    fixture.componentRef.setInput('pr', updatedPr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockAiReview.reset).toHaveBeenCalled();
  });

  it('sets canReview to true when diff and ticket are loaded', async () => {
    getTicketByKey.mockReturnValue(of(mockTicket));
    getPullRequestDiff.mockReturnValue(of(SAMPLE_DIFF));
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', basePr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    TestBed.tick();

    expect(mockAiReview.canReview()).toBe(true);
  });

  it('shows merge banner when PR is Ready to Merge', async () => {
    getTicketByKey.mockReturnValue(of(mockTicket));
    getPullRequestDiff.mockReturnValue(of(SAMPLE_DIFF));
    const readyPr = { ...basePr, myReviewStatus: 'Ready to Merge' as const, isAuthoredByMe: true };
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', readyPr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('bereit zum Mergen');
  });

  it('shows "Dein PR" badge for authored PRs', async () => {
    getTicketByKey.mockReturnValue(of(mockTicket));
    getPullRequestDiff.mockReturnValue(of(SAMPLE_DIFF));
    const authoredPr = { ...basePr, isAuthoredByMe: true };
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', authoredPr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Dein PR');
  });

  it('shows reviewer status badges for authored PRs', async () => {
    getTicketByKey.mockReturnValue(of(mockTicket));
    getPullRequestDiff.mockReturnValue(of(SAMPLE_DIFF));
    const authoredPr: PullRequest = {
      ...basePr,
      isAuthoredByMe: true,
      reviewers: [
        { user: { id: 2, name: 'r', displayName: 'Reviewer One', emailAddress: '', slug: 'r', active: true, type: 'NORMAL', profileUrl: '' }, role: 'REVIEWER', approved: true, status: 'APPROVED' },
      ],
    };
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', authoredPr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Reviewer:');
    expect(fixture.nativeElement.textContent).toContain('Reviewer One');
  });
});
