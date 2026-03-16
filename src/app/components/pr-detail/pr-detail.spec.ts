import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { PrDetailComponent } from './pr-detail';
import { JiraService } from '../../services/jira.service';
import { BitbucketService } from '../../services/bitbucket.service';
import { PullRequest, JiraTicket } from '../../models/work-item.model';

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

  beforeEach(() => {
    getTicketByKey.mockReset();
    getPullRequestDiff.mockReset();
    TestBed.configureTestingModule({
      imports: [PrDetailComponent],
      providers: [
        { provide: JiraService, useValue: { getTicketByKey } },
        { provide: BitbucketService, useValue: { getPullRequestDiff } },
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

    expect(fixture.nativeElement.textContent).toContain('Ticket konnte nicht geladen werden');
  });

  it('shows no-ticket state when PR has no Jira key', async () => {
    getPullRequestDiff.mockReturnValue(of(''));
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', noKeyPr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Kein Jira-Ticket gefunden');
    expect(getTicketByKey).not.toHaveBeenCalled();
  });

  it('shows loading state for diff initially', async () => {
    getTicketByKey.mockReturnValue(of(mockTicket));
    const diffSubject = new Subject<string>();
    getPullRequestDiff.mockReturnValue(diffSubject.asObservable());
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', basePr);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Änderungen laden');
  });

  it('shows toggle button with file count after diff loads', async () => {
    getTicketByKey.mockReturnValue(of(mockTicket));
    getPullRequestDiff.mockReturnValue(of(SAMPLE_DIFF));
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', basePr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Änderungen anzeigen (1 Datei)');
  });

  it('shows error state when diff fetch fails', async () => {
    getTicketByKey.mockReturnValue(of(mockTicket));
    getPullRequestDiff.mockReturnValue(throwError(() => new Error('fail')));
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', basePr);
    fixture.detectChanges();
    await fixture.whenStable();
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

    const toggleBtn = fixture.nativeElement.querySelector('button[aria-controls="pr-diff-content"]') as HTMLButtonElement;
    expect(toggleBtn).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#pr-diff-content')).toBeNull();

    toggleBtn.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#pr-diff-content')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Änderungen ausblenden');

    toggleBtn.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#pr-diff-content')).toBeNull();
  });

  it('shows empty diff message when diff has no files', async () => {
    getTicketByKey.mockReturnValue(of(mockTicket));
    getPullRequestDiff.mockReturnValue(of(''));
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', basePr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Keine Änderungen vorhanden');
  });
});
