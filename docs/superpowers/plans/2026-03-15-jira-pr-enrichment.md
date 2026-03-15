# Jira PR Enrichment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the PR detail view with Jira ticket context by detecting the issue key from the branch name or PR title and fetching the full ticket from Jira.

**Architecture:** A pure utility function extracts the Jira key from the PR. `JiraService` gains a `getTicketByKey()` method. A new `JiraPrCardComponent` renders the ticket in four states (loading / ticket / no-ticket / error). `PrDetailComponent` wires everything together using `toObservable` + `switchMap` + `toSignal`.

**Tech Stack:** Angular 20, signals (`input()`, `toSignal`, `toObservable`), RxJS (`switchMap`, `catchError`, `concat`, `of`), `HttpClient`, Vitest via `@angular/build:unit-test`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/app/components/pr-jira-key.ts` | Pure `extractJiraKey` utility — no deps, fully testable |
| Create | `src/app/components/pr-jira-key.spec.ts` | Tests for key extraction |
| Modify | `src/app/services/jira.service.ts` | Add `getTicketByKey()`, fix `'Unbeauftragt'` → `'Nicht zugeordnet'` |
| Modify | `src/app/services/jira.service.spec.ts` | Tests for `getTicketByKey()` and updated unassigned label |
| Create | `src/app/components/jira-pr-card/jira-pr-card.ts` | Standalone display component for all four states |
| Create | `src/app/components/jira-pr-card/jira-pr-card.spec.ts` | Tests for each render state |
| Modify | `src/app/components/pr-detail/pr-detail.ts` | Wire reactive Jira fetch; embed `<app-jira-pr-card>` |
| Create | `src/app/components/pr-detail/pr-detail.spec.ts` | Tests for reactive wiring in `PrDetailComponent` |

---

## Chunk 1: Data Layer

### Task 1: `extractJiraKey` utility

**Files:**
- Create: `src/app/components/pr-jira-key.ts`
- Create: `src/app/components/pr-jira-key.spec.ts`

- [ ] **Step 1.1: Write the failing tests**

Create `src/app/components/pr-jira-key.spec.ts`:

```ts
import { extractJiraKey } from './pr-jira-key';
import { PullRequest } from '../models/work-item.model';

function makePr(branch: string, title: string): PullRequest {
  return {
    type: 'pr', id: '1', prNumber: 1,
    title,
    description: '',
    state: 'OPEN', open: true, closed: false, locked: false,
    createdDate: 0, updatedDate: 0,
    fromRef: {
      id: `refs/heads/${branch}`, displayId: branch,
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
    author: { user: { id: 1, name: 'u', displayName: 'U', emailAddress: '', slug: 'u', active: true, type: 'NORMAL', profileUrl: '' }, role: 'AUTHOR', approved: false, status: 'UNAPPROVED' },
    reviewers: [], participants: [],
    commentCount: 0, openTaskCount: 0,
    url: '', myReviewStatus: 'Awaiting Review',
  };
}

describe('extractJiraKey', () => {
  it('extracts key from feature/ABCD-1234-words branch', () => {
    expect(extractJiraKey(makePr('feature/VERS-842-fix-timeout', 'some title'))).toBe('VERS-842');
  });

  it('extracts key from bare ABCD-1234-words branch', () => {
    expect(extractJiraKey(makePr('VERS-842-fix-timeout', 'some title'))).toBe('VERS-842');
  });

  it('extracts key from PR title when branch has none', () => {
    expect(extractJiraKey(makePr('fix-timeout', 'VERS-842: Fix the timeout'))).toBe('VERS-842');
  });

  it('prefers branch key over title key', () => {
    expect(extractJiraKey(makePr('feature/VERS-842-fix', 'OTHER-99: something'))).toBe('VERS-842');
  });

  it('returns null when neither branch nor title contains a key', () => {
    expect(extractJiraKey(makePr('fix-timeout', 'Fix the timeout'))).toBeNull();
  });

  it('handles multi-segment branch paths', () => {
    expect(extractJiraKey(makePr('bugfix/team/VERS-99-something', 'no key in title'))).toBe('VERS-99');
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
ng test --no-watch --include="src/app/components/pr-jira-key.spec.ts"
```

Expected: all 6 tests fail with "Cannot find module './pr-jira-key'"

- [ ] **Step 1.3: Implement `extractJiraKey`**

Create `src/app/components/pr-jira-key.ts`:

```ts
import { PullRequest } from '../models/work-item.model';

const JIRA_KEY_PATTERN = /[A-Z]+-\d+/;

export function extractJiraKey(pr: PullRequest): string | null {
  return (
    JIRA_KEY_PATTERN.exec(pr.fromRef.displayId)?.[0] ??
    JIRA_KEY_PATTERN.exec(pr.title)?.[0] ??
    null
  );
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
ng test --no-watch --include="src/app/components/pr-jira-key.spec.ts"
```

Expected: 6 tests pass

- [ ] **Step 1.5: Commit**

```bash
git add src/app/components/pr-jira-key.ts src/app/components/pr-jira-key.spec.ts
git commit -m "feat: add extractJiraKey utility"
```

---

### Task 2: `JiraService` — fix unassigned label + add `getTicketByKey`

**Files:**
- Modify: `src/app/services/jira.service.ts:198` (unassigned fallback)
- Modify: `src/app/services/jira.service.spec.ts` (update test + add new test)

- [ ] **Step 2.1: Update existing unassigned assertion in `jira.service.spec.ts`**

In `src/app/services/jira.service.spec.ts`, line 125 currently asserts `'Unbeauftragt'`. Update line 125:

```ts
// Before
expect(result![0].assignee).toBe('Unbeauftragt');
// After
expect(result![0].assignee).toBe('Nicht zugeordnet');
```

Also rename the test description at line 91 from `'maps null priority to Medium and null assignee to fallback string'` to `'maps null priority to Medium and null assignee to "Nicht zugeordnet"'`.

- [ ] **Step 2.1b: Add `getTicketByKey` test**

Append this test inside the `describe('JiraService', ...)` block in `src/app/services/jira.service.spec.ts` (before the closing `}`):

```ts
it('getTicketByKey fetches a single issue by key', () => {
  let result: JiraTicket | undefined;
  service.getTicketByKey('VERS-42').subscribe(ticket => (result = ticket));

  const req = httpMock.expectOne(r => r.url.includes('/rest/api/2/issue/VERS-42'));
  expect(req.request.method).toBe('GET');
  req.flush({
    id: '10042', key: 'VERS-42',
    self: 'http://localhost:6202/rest/api/2/issue/10042',
    fields: {
      summary: 'Fix the login', issuetype: { name: 'Bug' },
      status: { name: 'In Progress', statusCategory: { key: 'indeterminate', name: 'In Progress' } },
      priority: { name: 'High' },
      assignee: { displayName: 'Anna B.', name: 'anna' },
      reporter: null, creator: null,
      description: 'Some description', duedate: null,
      created: '2026-01-01T00:00:00.000+0000', updated: '2026-03-01T00:00:00.000+0000',
      labels: [], project: { key: 'VERS', name: 'Versicherung' },
      components: [], comment: [], attachment: [], issuelinks: [], subtasks: [],
    },
  });

  expect(result!.key).toBe('VERS-42');
  expect(result!.summary).toBe('Fix the login');
  expect(result!.issueType).toBe('Bug');
  expect(result!.assignee).toBe('Anna B.');
});
```

- [ ] **Step 2.2: Run tests to see the new tests fail**

```bash
ng test --no-watch --include="src/app/services/jira.service.spec.ts"
```

Expected: `getTicketByKey fetches a single issue by key` fails with "service.getTicketByKey is not a function"

- [ ] **Step 2.3: Fix `'Unbeauftragt'` → `'Nicht zugeordnet'` in `jira.service.ts`**

In `src/app/services/jira.service.ts`, line 198, change:

```ts
assignee: fields.assignee?.displayName ?? 'Unbeauftragt',
```

to:

```ts
assignee: fields.assignee?.displayName ?? 'Nicht zugeordnet',
```

- [ ] **Step 2.4: Add `getTicketByKey` to `JiraService`**

Add this public method directly after `getAssignedActiveTickets()` in `src/app/services/jira.service.ts`:

```ts
getTicketByKey(key: string): Observable<JiraTicket> {
  const params = new HttpParams().set(
    'fields',
    'summary,description,status,priority,issuetype,assignee,reporter,creator,duedate,created,updated,labels,project,components,comment,attachment,issuelinks,subtasks,parent,customfield_10014',
  );
  return this.http
    .get<JiraIssueRaw>(`${this.baseUrl}/issue/${key}`, { params })
    .pipe(map(issue => this.mapIssue(issue)));
}
```

- [ ] **Step 2.5: Run all JiraService tests to verify they pass**

```bash
ng test --no-watch --include="src/app/services/jira.service.spec.ts"
```

Expected: all tests pass

- [ ] **Step 2.6: Commit**

```bash
git add src/app/services/jira.service.ts src/app/services/jira.service.spec.ts
git commit -m "feat: add getTicketByKey to JiraService, fix unassigned label"
```

---

## Chunk 2: Components

### Task 3: `JiraPrCardComponent`

**Files:**
- Create: `src/app/components/jira-pr-card/jira-pr-card.ts`
- Create: `src/app/components/jira-pr-card/jira-pr-card.spec.ts`

- [ ] **Step 3.1: Write the failing tests**

Create `src/app/components/jira-pr-card/jira-pr-card.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JiraPrCardComponent } from './jira-pr-card';
import { JiraTicket } from '../../models/work-item.model';

function makeTicket(overrides: Partial<JiraTicket> = {}): JiraTicket {
  return {
    type: 'ticket', id: '1', key: 'VERS-42',
    summary: 'Fix the login flow',
    issueType: 'Bug',
    status: 'In Progress',
    priority: 'High',
    assignee: 'Anna B.',
    reporter: '', creator: '',
    description: 'This is the ticket description.',
    dueDate: null, createdAt: '', updatedAt: '',
    url: 'http://jira/browse/VERS-42',
    labels: [], project: null, components: [],
    comments: [], attachments: [], relations: [], epicLink: null,
    ...overrides,
  };
}

describe('JiraPrCardComponent', () => {
  let fixture: ComponentFixture<JiraPrCardComponent>;

  function setup(ticket: JiraTicket | 'loading' | 'no-ticket' | 'error') {
    fixture = TestBed.configureTestingModule({
      imports: [JiraPrCardComponent],
    }).createComponent(JiraPrCardComponent);
    fixture.componentRef.setInput('ticket', ticket);
    fixture.detectChanges();
  }

  it('renders skeleton with aria-busy when loading', () => {
    setup('loading');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('renders "Kein Jira-Ticket gefunden" for no-ticket state', () => {
    setup('no-ticket');
    expect(fixture.nativeElement.textContent).toContain('Kein Jira-Ticket gefunden');
  });

  it('renders "Ticket konnte nicht geladen werden" for error state', () => {
    setup('error');
    expect(fixture.nativeElement.textContent).toContain('Ticket konnte nicht geladen werden');
  });

  it('renders ticket key in the header', () => {
    setup(makeTicket());
    expect(fixture.nativeElement.textContent).toContain('VERS-42');
  });

  it('renders ticket summary', () => {
    setup(makeTicket());
    expect(fixture.nativeElement.textContent).toContain('Fix the login flow');
  });

  it('renders assignee name', () => {
    setup(makeTicket());
    expect(fixture.nativeElement.textContent).toContain('Anna B.');
  });

  it('renders "Nicht zugeordnet" when assignee is unassigned', () => {
    setup(makeTicket({ assignee: 'Nicht zugeordnet' }));
    expect(fixture.nativeElement.textContent).toContain('Nicht zugeordnet');
  });

  it('renders description via jira markup pipe', () => {
    setup(makeTicket({ description: 'This is the ticket description.' }));
    expect(fixture.nativeElement.textContent).toContain('This is the ticket description.');
  });

  it('does not render description section when description is empty', () => {
    setup(makeTicket({ description: '' }));
    const descSection = fixture.nativeElement.querySelector('[data-testid="jira-description"]');
    expect(descSection).toBeNull();
  });

  it('renders "In Jira öffnen" link with correct aria-label', () => {
    setup(makeTicket());
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a[aria-label]');
    expect(link.getAttribute('aria-label')).toBe('Öffne VERS-42 in Jira');
    expect(link.getAttribute('href')).toBe('http://jira/browse/VERS-42');
  });
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
ng test --no-watch --include="src/app/components/jira-pr-card/jira-pr-card.spec.ts"
```

Expected: all tests fail with "Cannot find module './jira-pr-card'"

- [ ] **Step 3.3: Implement `JiraPrCardComponent`**

Create `src/app/components/jira-pr-card/jira-pr-card.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { JiraMarkupPipe } from '../../pipes/jira-markup.pipe';
import { JiraTicket } from '../../models/work-item.model';

@Component({
  selector: 'app-jira-pr-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JiraMarkupPipe],
  template: `
    <section aria-label="Jira-Ticket">
      @if (ticket() === 'loading') {
        <div
          class="border border-indigo-100 bg-indigo-50/40 rounded-lg p-3"
          aria-busy="true"
          aria-label="Lade Jira-Ticket"
        >
          <div class="flex gap-2 mb-2">
            <div class="h-4 w-16 rounded bg-indigo-100 animate-pulse"></div>
            <div class="h-4 w-20 rounded bg-indigo-100 animate-pulse"></div>
          </div>
          <div class="h-4 w-3/4 rounded bg-indigo-100 animate-pulse mb-1.5"></div>
          <div class="h-4 w-1/2 rounded bg-indigo-100 animate-pulse"></div>
        </div>
      } @else if (ticket() === 'no-ticket') {
        <p
          class="text-sm text-stone-400 italic py-1"
          role="status"
        >Kein Jira-Ticket gefunden</p>
      } @else if (ticket() === 'error') {
        <p
          class="text-sm text-red-500 py-1"
          role="status"
        >Ticket konnte nicht geladen werden</p>
      } @else {
        <div class="border-[1.5px] border-indigo-100 rounded-lg overflow-hidden">

          <div class="px-3 py-2.5 bg-[#f0f3ff] border-b border-indigo-100">
            <div class="flex items-center gap-1.5 flex-wrap mb-2">
              <span
                class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold border leading-none"
                [class]="issueTypeBadgeClass()"
              >
                @switch (issueTypeKey()) {
                  @case ('bug') {
                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>
                  }
                  @case ('story') {
                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  }
                  @case ('epic') {
                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  }
                  @default {
                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  }
                }
                {{ ticketData()!.issueType }}
              </span>

              <span class="font-mono text-[11px] font-bold text-indigo-600 tracking-wide">{{ ticketData()!.key }}</span>

              <span
                class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold border leading-none"
                [class]="statusBadgeClass()"
              >
                <span class="w-1.5 h-1.5 rounded-full" [class]="statusDotClass()" aria-hidden="true"></span>
                {{ ticketData()!.status }}
              </span>

              <a
                [href]="ticketData()!.url"
                target="_blank"
                rel="noopener noreferrer"
                class="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold text-indigo-600 border border-indigo-200 rounded-md px-2 py-1 bg-white hover:bg-indigo-50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500"
                [attr.aria-label]="'Öffne ' + ticketData()!.key + ' in Jira'"
              >
                In Jira öffnen
                <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
              </a>
            </div>

            <p class="text-[13px] font-semibold text-stone-900 leading-snug mb-2">{{ ticketData()!.summary }}</p>

            <div class="flex items-center gap-1.5">
              <span class="text-[9.5px] font-semibold text-stone-400 uppercase tracking-wide">Zugewiesen</span>
              @if (ticketData()!.assignee !== 'Nicht zugeordnet') {
                <span
                  class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-[8px] font-bold shrink-0"
                  aria-hidden="true"
                >{{ assigneeInitials() }}</span>
              }
              <span class="text-[11.5px] text-stone-600 font-medium">{{ ticketData()!.assignee }}</span>
            </div>
          </div>

          @if (ticketData()!.description) {
            <div class="px-3 py-2.5" data-testid="jira-description">
              <div class="jira-markup text-sm" [innerHTML]="ticketData()!.description | jiraMarkup"></div>
            </div>
          }

        </div>
      }
    </section>
  `,
})
export class JiraPrCardComponent {
  ticket = input.required<JiraTicket | 'loading' | 'no-ticket' | 'error'>();

  // Returns the ticket only when it is a JiraTicket object, null otherwise.
  // All derived computeds guard on this to avoid accessing properties on string literals.
  // Non-null assertion (!) in the template is safe: ticketData() is only read in the @else
  // branch where ticket() is guaranteed to be a JiraTicket.
  readonly ticketData = computed(() => {
    const t = this.ticket();
    return typeof t === 'object' ? t : null;
  });

  issueTypeKey = computed(() => {
    const ticket = this.ticketData();
    if (!ticket) return 'task';
    const t = ticket.issueType.toLowerCase();
    if (t.includes('bug') || t.includes('fehler')) return 'bug';
    if (t.includes('story')) return 'story';
    if (t.includes('epic')) return 'epic';
    return 'task';
  });

  assigneeInitials = computed(() =>
    this.ticketData()?.assignee
      .split(' ')
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '',
  );

  issueTypeBadgeClass = computed(() => {
    const k = this.issueTypeKey();
    if (k === 'bug')   return 'bg-red-50 text-red-600 border-red-200';
    if (k === 'story') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (k === 'epic')  return 'bg-violet-50 text-violet-700 border-violet-200';
    return 'bg-sky-50 text-sky-700 border-sky-200';
  });

  statusBadgeClass = computed(() => {
    const status = this.ticketData()?.status;
    const map: Record<string, string> = {
      'In Progress': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'In Review':   'bg-amber-50 text-amber-700 border-amber-200',
      'Done':        'bg-emerald-50 text-emerald-700 border-emerald-200',
      'To Do':       'bg-stone-100 text-stone-500 border-stone-200',
    };
    return (status && map[status]) ?? 'bg-stone-100 text-stone-500 border-stone-200';
  });

  statusDotClass = computed(() => {
    const status = this.ticketData()?.status;
    const map: Record<string, string> = {
      'In Progress': 'bg-indigo-500',
      'In Review':   'bg-amber-400',
      'Done':        'bg-emerald-500',
      'To Do':       'bg-stone-400',
    };
    return (status && map[status]) ?? 'bg-stone-400';
  });
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
ng test --no-watch --include="src/app/components/jira-pr-card/jira-pr-card.spec.ts"
```

Expected: all 10 tests pass

- [ ] **Step 3.5: Commit**

```bash
git add src/app/components/jira-pr-card/
git commit -m "feat: add JiraPrCardComponent with all four states"
```

---

### Task 4: Wire `PrDetailComponent`

**Files:**
- Modify: `src/app/components/pr-detail/pr-detail.ts`
- Create: `src/app/components/pr-detail/pr-detail.spec.ts`

- [ ] **Step 4.1: Write the failing tests**

Create `src/app/components/pr-detail/pr-detail.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { PrDetailComponent } from './pr-detail';
import { JiraService } from '../../services/jira.service';
import { PullRequest, JiraTicket } from '../../models/work-item.model';

const basePr: PullRequest = {
  type: 'pr', id: '1', prNumber: 1,
  title: 'VERS-42: Fix login',
  description: '',
  state: 'OPEN', open: true, closed: false, locked: false,
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

describe('PrDetailComponent', () => {
  let fixture: ComponentFixture<PrDetailComponent>;
  const getTicketByKey = vi.fn();

  beforeEach(() => {
    getTicketByKey.mockReset();
    TestBed.configureTestingModule({
      imports: [PrDetailComponent],
      providers: [
        { provide: JiraService, useValue: { getTicketByKey } },
      ],
    });
  });

  it('shows the Jira card with ticket data when fetch succeeds', async () => {
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
    getTicketByKey.mockReturnValue(throwError(() => new Error('Network error')));
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', basePr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ticket konnte nicht geladen werden');
  });

  it('shows no-ticket state when PR has no Jira key', async () => {
    fixture = TestBed.createComponent(PrDetailComponent);
    fixture.componentRef.setInput('pr', noKeyPr);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Kein Jira-Ticket gefunden');
    expect(getTicketByKey).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4.2: Run tests to verify they fail**

```bash
ng test --no-watch --include="src/app/components/pr-detail/pr-detail.spec.ts"
```

Expected: tests fail — `PrDetailComponent` does not yet have the `jiraTicket` signal or `<app-jira-pr-card>` binding

- [ ] **Step 4.3: Update `PrDetailComponent`**

Replace the full content of `src/app/components/pr-detail/pr-detail.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, concat, map, of, switchMap } from 'rxjs';
import { PullRequest, JiraTicket } from '../../models/work-item.model';
import { prStatusClass } from '../pr-status-class';
import { JiraMarkupPipe } from '../../pipes/jira-markup.pipe';
import { JiraService } from '../../services/jira.service';
import { JiraPrCardComponent } from '../jira-pr-card/jira-pr-card';
import { extractJiraKey } from '../pr-jira-key';

@Component({
  selector: 'app-pr-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, JiraMarkupPipe, JiraPrCardComponent],
  template: `
    <article class="h-full flex flex-col" [attr.aria-label]="'PR #' + pr().prNumber + ': ' + pr().title">
      <header class="pb-5 border-b border-stone-200">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-stone-100 text-stone-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" x2="6" y1="9" y2="21"/></svg>
                {{ pr().fromRef.repository.slug }}
              </span>
              <span
                class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
                [class]="statusClass()"
                [attr.aria-label]="pr().myReviewStatus === 'Needs Re-review' ? 'Erneut prüfen' : null"
              >{{ pr().myReviewStatus }}</span>
            </div>
            <h1 class="text-xl font-semibold text-stone-900 leading-snug">{{ pr().title }}</h1>
          </div>
          <a
            [href]="pr().url"
            target="_blank"
            rel="noopener noreferrer"
            class="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            aria-label="Öffne PR in Bitbucket"
          >
            In Bitbucket öffnen
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          </a>
        </div>
      </header>

      <div class="py-5 border-b border-stone-200">
        <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Autor</dt>
            <dd class="text-sm text-stone-700 font-medium">{{ pr().author.user.displayName }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Branch</dt>
            <dd class="text-sm text-stone-700 font-mono truncate">{{ pr().fromRef.displayId }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Kommentare</dt>
            <dd class="text-sm text-stone-700 font-medium">{{ pr().commentCount }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Aktualisiert</dt>
            <dd class="text-sm text-stone-700">{{ pr().updatedDate | date:'dd.MM.yyyy' }}</dd>
          </div>
        </dl>
      </div>

      <div class="flex-1 py-5 overflow-y-auto space-y-5">
        <div>
          <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Jira-Ticket</h2>
          <app-jira-pr-card [ticket]="jiraTicket()" />
        </div>

        <div>
          <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Beschreibung</h2>
          <div class="jira-markup" [innerHTML]="pr().description | jiraMarkup"></div>
        </div>
      </div>
    </article>
  `,
})
export class PrDetailComponent {
  pr = input.required<PullRequest>();

  private readonly jiraService = inject(JiraService);

  readonly jiraTicket = toSignal(
    toObservable(this.pr).pipe(
      map(pr => extractJiraKey(pr)),
      switchMap(key => {
        if (!key) return of('no-ticket' as const);
        return concat(
          of('loading' as const),
          this.jiraService.getTicketByKey(key).pipe(
            map(ticket => ticket as JiraTicket),
            catchError(() => of('error' as const)),
          ),
        );
      }),
    ),
    { initialValue: 'loading' as const },
  );

  statusClass(): string {
    return prStatusClass(this.pr().myReviewStatus);
  }
}
```

- [ ] **Step 4.4: Run all tests to verify everything passes**

```bash
ng test --no-watch
```

Expected: all tests pass

- [ ] **Step 4.5: Commit**

```bash
git add src/app/components/pr-detail/pr-detail.ts src/app/components/pr-detail/pr-detail.spec.ts
git commit -m "feat: wire Jira ticket enrichment into PrDetailComponent"
```
