# Jira User Mention Resolution Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve `[~slug]` user mentions in Jira ticket descriptions and comment bodies to real display names before the data reaches any component.

**Architecture:** After each Jira HTTP response, scan all description and comment body strings for mention slugs, batch-fetch unknown display names from `/rest/api/2/user`, cache them in-memory for the session, then substitute `[~slug]` → `[~DisplayName]` in-place before `mapIssue()` is called. The mock server also needs a matching `/rest/api/2/user` endpoint for local development.

**Tech Stack:** Angular 20, RxJS (`forkJoin`, `switchMap`, `catchError`), `HttpTestingController` (Vitest via `@angular/build:unit-test`)

---

## Chunk 1: Mock server endpoint + failing tests

### Task 1: Add `/rest/api/2/user` endpoint to the mock server

**Files:**
- Modify: `mock-server/jira.js`

- [ ] **Step 1: Add the user lookup route**

In `mock-server/jira.js`, add after the existing `/rest/api/2/issue/:key` route (before `app.listen`):

```js
const ALL_USERS = [U1, U2, U3, U4, U5, UNASSIGNED];

app.get('/rest/api/2/user', (req, res) => {
  const username = req.query.username;
  const user = ALL_USERS.find(u => u.name === username);
  if (!user) {
    res.status(404).json({ errorMessages: [`User '${username}' does not exist or you do not have permission to view it.`], errors: {} });
    return;
  }
  res.json(user);
});
```

- [ ] **Step 2: Commit**

```bash
git add mock-server/jira.js
git commit -m "feat(mock): add /rest/api/2/user endpoint for mention resolution"
```

---

### Task 2: Write failing tests for mention resolution in JiraService

**Files:**
- Modify: `src/app/services/jira.service.spec.ts`

The existing test suite uses `HttpTestingController`. With mention resolution, `getTicketByKey` and `getAssignedActiveTickets` will make additional HTTP calls after the main issue fetch. Tests must flush both the issue request and any subsequent user requests.

- [ ] **Step 1: Add a helper raw issue factory at the top of the describe block**

Add this helper inside the `describe('JiraService', ...)` block (after the `afterEach`):

```typescript
function makeRawIssue(overrides: { description?: string; comments?: { id: string; body: string }[] } = {}) {
  return {
    id: '99',
    key: 'TEST-1',
    self: 'http://localhost:6202/rest/api/2/issue/99',
    fields: {
      summary: 'Test Issue',
      issuetype: { name: 'Task' },
      status: { name: 'In Progress', statusCategory: { key: 'indeterminate', name: 'In Progress' } },
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
      comment: (overrides.comments ?? []).map(c => ({
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
```

- [ ] **Step 2: Add test — description mention resolved to display name**

```typescript
it('resolves user mention in description to display name', () => {
  let result: JiraTicket | undefined;
  service.getTicketByKey('TEST-1').subscribe(t => (result = t));

  httpMock.expectOne(r => r.url.includes('/issue/TEST-1')).flush(
    makeRawIssue({ description: 'Bitte [~u99] prüfen.' })
  );
  httpMock.expectOne(r => r.url.includes('/user') && r.params.get('username') === 'u99')
    .flush({ displayName: 'Anna Bergmann' });

  expect(result!.description).toBe('Bitte [~Anna Bergmann] prüfen.');
});
```

- [ ] **Step 3: Add test — comment body mention resolved to display name**

```typescript
it('resolves user mention in comment body to display name', () => {
  let result: JiraTicket | undefined;
  service.getTicketByKey('TEST-1').subscribe(t => (result = t));

  httpMock.expectOne(r => r.url.includes('/issue/TEST-1')).flush(
    makeRawIssue({ comments: [{ id: 'c1', body: 'FYI [~u99]' }] })
  );
  httpMock.expectOne(r => r.url.includes('/user') && r.params.get('username') === 'u99')
    .flush({ displayName: 'Michael Braun' });

  expect(result!.comments[0].body).toBe('FYI [~Michael Braun]');
});
```

- [ ] **Step 4: Add test — cache prevents duplicate HTTP calls**

```typescript
it('does not fetch a user slug that was already resolved', () => {
  // First fetch — resolves u99
  service.getTicketByKey('TEST-1').subscribe();
  httpMock.expectOne(r => r.url.includes('/issue/TEST-1')).flush(
    makeRawIssue({ description: '[~u99]' })
  );
  httpMock.expectOne(r => r.url.includes('/user')).flush({ displayName: 'Anna Bergmann' });

  // Second fetch — same slug, must NOT trigger another /user call
  service.getTicketByKey('TEST-1').subscribe();
  httpMock.expectOne(r => r.url.includes('/issue/TEST-1')).flush(
    makeRawIssue({ description: '[~u99] again' })
  );
  httpMock.expectNone(r => r.url.includes('/user'));
});
```

- [ ] **Step 5: Add test — failed user lookup falls back to original slug**

```typescript
it('keeps original slug when user lookup fails', () => {
  let result: JiraTicket | undefined;
  service.getTicketByKey('TEST-1').subscribe(t => (result = t));

  httpMock.expectOne(r => r.url.includes('/issue/TEST-1')).flush(
    makeRawIssue({ description: '[~u404]' })
  );
  httpMock.expectOne(r => r.url.includes('/user') && r.params.get('username') === 'u404')
    .flush({ errorMessages: ['User not found'] }, { status: 404, statusText: 'Not Found' });

  expect(result!.description).toBe('[~u404]');
});
```

- [ ] **Step 6: Add test — multiple distinct slugs resolved in parallel**

```typescript
it('resolves multiple distinct slugs in a single ticket', () => {
  let result: JiraTicket | undefined;
  service.getTicketByKey('TEST-1').subscribe(t => (result = t));

  httpMock.expectOne(r => r.url.includes('/issue/TEST-1')).flush(
    makeRawIssue({ description: '[~ua] und [~ub] sind beteiligt.' })
  );

  const userReqs = httpMock.match(r => r.url.includes('/user'));
  expect(userReqs.length).toBe(2);
  const slugs = userReqs.map(r => r.request.params.get('username'));
  expect(slugs).toContain('ua');
  expect(slugs).toContain('ub');
  userReqs.find(r => r.request.params.get('username') === 'ua')!.flush({ displayName: 'Anna' });
  userReqs.find(r => r.request.params.get('username') === 'ub')!.flush({ displayName: 'Bob' });

  expect(result!.description).toBe('[~Anna] und [~Bob] sind beteiligt.');
});
```

- [ ] **Step 7: Add test — no user calls when no mentions present**

```typescript
it('makes no user API calls when there are no mentions', () => {
  service.getTicketByKey('TEST-1').subscribe();
  httpMock.expectOne(r => r.url.includes('/issue/TEST-1')).flush(
    makeRawIssue({ description: 'Kein Erwähnungen hier.' })
  );
  httpMock.expectNone(r => r.url.includes('/user'));
});
```

- [ ] **Step 8: Run tests to verify they all fail**

```bash
ng test --no-watch
```

Expected: new tests fail with errors like "Expected one matching request for criteria..." — the service doesn't yet make user requests.

- [ ] **Step 9: Commit the failing tests**

```bash
git add src/app/services/jira.service.spec.ts
git commit -m "test(jira): add failing tests for user mention resolution"
```

---

## Chunk 2: Service implementation

### Task 3: Implement mention resolution in JiraService

**Files:**
- Modify: `src/app/services/jira.service.ts`

- [ ] **Step 1: Update imports**

Replace the existing import lines at the top of `jira.service.ts`:

```typescript
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
```

- [ ] **Step 2: Add the in-memory cache field to `JiraService`**

Add inside the `JiraService` class body, after the `baseUrl` field:

```typescript
private readonly userDisplayNameCache = new Map<string, string>();
```

- [ ] **Step 3: Add `resolveUserMentions` private method**

Add after the `userDisplayNameCache` field:

```typescript
private resolveUserMentions(texts: string[]): Observable<void> {
  const allSlugs = new Set<string>();
  for (const text of texts) {
    for (const [, slug] of text.matchAll(/\[~([^\]]+)\]/g)) {
      allSlugs.add(slug);
    }
  }
  const unknown = [...allSlugs].filter(s => !this.userDisplayNameCache.has(s));
  if (!unknown.length) return of(undefined);
  return forkJoin(
    unknown.map(slug =>
      this.http
        .get<{ displayName: string }>(`${this.baseUrl}/user`, {
          params: new HttpParams().set('username', slug),
        })
        .pipe(catchError(() => of(null)))
    )
  ).pipe(
    map(results => {
      results.forEach((result, i) => {
        if (result) this.userDisplayNameCache.set(unknown[i], result.displayName);
      });
    })
  );
}
```

- [ ] **Step 4: Add `resolveMentionsInText` private method**

Add after `resolveUserMentions`:

```typescript
private resolveMentionsInText(text: string): string {
  return text.replace(/\[~([^\]]+)\]/g, (match, slug) => {
    const name = this.userDisplayNameCache.get(slug);
    return name ? `[~${name}]` : match;
  });
}
```

- [ ] **Step 5: Wire into `getTicketByKey`**

Replace the existing `getTicketByKey` implementation:

```typescript
getTicketByKey(key: string): Observable<JiraTicket> {
  const params = new HttpParams().set(
    'fields',
    'summary,description,status,priority,issuetype,assignee,reporter,creator,duedate,created,updated,labels,project,components,comment,attachment,issuelinks,subtasks,parent,customfield_10014',
  );
  return this.http.get<JiraIssueRaw>(`${this.baseUrl}/issue/${key}`, { params }).pipe(
    switchMap(issue => {
      const texts = [
        issue.fields.description ?? '',
        ...extractComments(issue.fields.comment).map(c => c.body),
      ];
      return this.resolveUserMentions(texts).pipe(map(() => issue));
    }),
    map(issue => {
      if (issue.fields.description) {
        issue.fields.description = this.resolveMentionsInText(issue.fields.description);
      }
      for (const comment of extractComments(issue.fields.comment)) {
        comment.body = this.resolveMentionsInText(comment.body);
      }
      return this.mapIssue(issue);
    }),
  );
}
```

- [ ] **Step 6: Wire into `getAssignedActiveTickets`**

Replace the existing `getAssignedActiveTickets` implementation:

```typescript
getAssignedActiveTickets(): Observable<JiraTicket[]> {
  const params = new HttpParams()
    .set('jql', 'assignee = currentUser() AND statusCategory = "In Progress"')
    .set('maxResults', '50')
    .set('fields', 'summary,description,status,priority,issuetype,assignee,reporter,creator,duedate,created,updated,labels,project,components,comment,attachment,issuelinks,subtasks,parent,customfield_10014');

  return this.http.get<JiraSearchResponse>(`${this.baseUrl}/search`, { params }).pipe(
    switchMap(response => {
      const texts = response.issues.flatMap(issue => [
        issue.fields.description ?? '',
        ...extractComments(issue.fields.comment).map(c => c.body),
      ]);
      return this.resolveUserMentions(texts).pipe(map(() => response));
    }),
    map(response => {
      for (const issue of response.issues) {
        if (issue.fields.description) {
          issue.fields.description = this.resolveMentionsInText(issue.fields.description);
        }
        for (const comment of extractComments(issue.fields.comment)) {
          comment.body = this.resolveMentionsInText(comment.body);
        }
      }
      return response.issues.map(issue => this.mapIssue(issue));
    }),
  );
}
```

- [ ] **Step 7: Run all tests**

```bash
ng test --no-watch
```

Expected: all tests pass, including the new mention resolution tests.

- [ ] **Step 8: Commit**

```bash
git add src/app/services/jira.service.ts
git commit -m "feat(jira): resolve user mentions to display names with session cache"
```
