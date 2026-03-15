# Bitbucket Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Orbit to the Bitbucket Data Center API to display live pull requests where the current user is a reviewer.

**Architecture:** A shared Express proxy on port 6201 routes `/jira/**` to `JIRA_BASE_URL` and `/bitbucket/**` to `BITBUCKET_BASE_URL` using path-prefix stripping. A dedicated mock Bitbucket server on port 6203 serves realistic API responses in development. A new `BitbucketService` fetches `/myself` then `/dashboard/pull-requests` and maps responses to the rich `PullRequest` model. `WorkDataService` replaces its hardcoded `pullRequests` signal with live data from `BitbucketService`.

**Tech Stack:** Node.js/Express (proxy + mock), `http-proxy-middleware` v3 (`pathFilter` + `pathRewrite`), Angular `HttpClient`, RxJS `switchMap`/`map`/`catchError`/`tap`, Angular `DatePipe`, Vitest via `@angular/build:unit-test`

---

## Chunk 1: Infrastructure — proxy, mock rename, smoke test, Bitbucket mock

### Task 1: Rename mock server

**Files:**
- Rename: `mock-server/index.js` → `mock-server/jira.js`
- Modify: `package.json`

- [ ] **Step 1: Rename the file**

```bash
git mv mock-server/index.js mock-server/jira.js
```

- [ ] **Step 2: Update package.json scripts**

In `package.json`, replace the two affected scripts:

```json
"start": "concurrently \"ng serve --port 6200\" \"node proxy/index.js\" \"node mock-server/jira.js\" \"node mock-server/bitbucket.js\"",
"mock:jira": "node mock-server/jira.js",
"mock:bitbucket": "node mock-server/bitbucket.js"
```

Remove the old `"mock": "node mock-server/index.js"` script entirely.

The `start:real`, `proxy`, `build`, `watch`, `test`, and `smoke-test` scripts are unchanged.

- [ ] **Step 3: Commit**

```bash
git add mock-server/jira.js package.json
git commit -m "chore: rename mock-server/index.js to mock-server/jira.js"
```

---

### Task 2: Update proxy for dual-service routing

**Files:**
- Modify: `proxy/index.js`
- Modify: `src/app/services/jira.service.ts`
- Modify: `.env.example`

- [ ] **Step 1: Rewrite proxy/index.js**

Replace the entire file:

```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const { JIRA_BASE_URL, JIRA_API_KEY, BITBUCKET_BASE_URL, BITBUCKET_API_KEY } = process.env;

if (!JIRA_BASE_URL || !JIRA_API_KEY || !BITBUCKET_BASE_URL || !BITBUCKET_API_KEY) {
  console.error('ERROR: JIRA_BASE_URL, JIRA_API_KEY, BITBUCKET_BASE_URL and BITBUCKET_API_KEY must be set in .env');
  process.exit(1);
}

const app = express();
const PORT = 6201;

app.use(cors({ origin: 'http://localhost:6200' }));

app.use(
  createProxyMiddleware({
    target: JIRA_BASE_URL,
    changeOrigin: true,
    pathFilter: '/jira',
    pathRewrite: { '^/jira': '' },
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.setHeader('Authorization', `Bearer ${JIRA_API_KEY}`);
      },
    },
  }),
);

app.use(
  createProxyMiddleware({
    target: BITBUCKET_BASE_URL,
    changeOrigin: true,
    pathFilter: '/bitbucket',
    pathRewrite: { '^/bitbucket': '' },
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.setHeader('Authorization', `Bearer ${BITBUCKET_API_KEY}`);
      },
    },
  }),
);

app.listen(PORT, () => {
  console.log(`Proxy running at http://localhost:${PORT}`);
  console.log(`  /jira/**      → ${JIRA_BASE_URL}`);
  console.log(`  /bitbucket/** → ${BITBUCKET_BASE_URL}`);
});
```

- [ ] **Step 2: Update JiraService baseUrl**

In `src/app/services/jira.service.ts`, line 115, change:

```typescript
private readonly baseUrl = `${environment.proxyUrl}/rest/api/2`;
```

to:

```typescript
private readonly baseUrl = `${environment.proxyUrl}/jira/rest/api/2`;
```

- [ ] **Step 3: Update .env.example**

Replace the entire `.env.example` file:

```
JIRA_BASE_URL=https://jira.yourcompany.com
JIRA_API_KEY=your-jira-personal-access-token
BITBUCKET_BASE_URL=https://bitbucket.yourcompany.com
BITBUCKET_API_KEY=your-bitbucket-personal-access-token
```

- [ ] **Step 4: Update local .env to add Bitbucket vars**

Add these two lines to your local `.env` (not committed):

```
BITBUCKET_BASE_URL=http://localhost:6203
BITBUCKET_API_KEY=mock-token
```

- [ ] **Step 5: Commit**

```bash
git add proxy/index.js src/app/services/jira.service.ts .env.example
git commit -m "feat: update proxy for /jira and /bitbucket path-prefix routing"
```

---

### Task 3: Update smoke test for Jira path changes

**Files:**
- Modify: `smoke-test/index.js`

The smoke test needs 3 changes for Jira (Bitbucket assertion comes in Task 5):
1. Spawn `mock-server/jira.js` instead of `mock-server/index.js`
2. Add all 4 env vars to the proxy spawn
3. Update the Jira assertion URL from `/rest/api/2/search` to `/jira/rest/api/2/search`

- [ ] **Step 1: Update smoke-test/index.js**

Apply these three changes to `smoke-test/index.js`:

Change the mock server spawn (currently line 60):
```js
const mockServer = spawn('node', ['mock-server/jira.js'], { cwd: ROOT, stdio: 'pipe' });
```

Replace the entire proxy `spawn` call (find the block that starts with `const proxy = spawn(`) with:
```js
  const proxy = spawn('node', ['proxy/index.js'], {
    cwd: ROOT,
    stdio: 'pipe',
    env: {
      ...process.env,
      JIRA_BASE_URL: 'http://localhost:6202',
      JIRA_API_KEY: 'smoke-test-token',
      BITBUCKET_BASE_URL: 'http://localhost:6203',
      BITBUCKET_API_KEY: 'smoke-test-token',
    },
  });
```

Change the assertion URL (currently line 73):
```js
    const url =
      'http://localhost:6201/jira/rest/api/2/search?jql=assignee%20%3D%20currentUser()%20AND%20statusCategory%20%3D%20%22In%20Progress%22';
```

- [ ] **Step 2: Verify the smoke test still passes**

```bash
npm run smoke-test
```

Expected output: `✅ Smoke test passed`

Note: the smoke test passes at this stage even though `mock-server/bitbucket.js` doesn't exist yet — `waitForPort(6203)` is not added until Task 5, so port 6203 doesn't need to be running. The four env vars are supplied to satisfy the proxy's startup check, not because Bitbucket is actually needed here.

If it fails, the proxy `/jira` routing or the JiraService baseUrl change has an issue — check both.

- [ ] **Step 3: Commit**

```bash
git add smoke-test/index.js
git commit -m "test: update smoke test for /jira proxy prefix"
```

---

### Task 4: Create mock Bitbucket server

**Files:**
- Create: `mock-server/bitbucket.js`

- [ ] **Step 1: Create mock-server/bitbucket.js**

```js
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 6203;

app.use(cors());
app.use(express.json());

app.use((_req, _res, next) => {
  setTimeout(next, 3000);
});

const BASE = `http://localhost:${PORT}`;

const CURRENT_USER = {
  name: 'dominik.mueller',
  slug: 'dominik.mueller',
  displayName: 'Dominik Müller',
  emailAddress: 'dominik.mueller@example.org',
  id: 42,
  active: true,
  type: 'NORMAL',
  links: { self: [{ href: `${BASE}/users/dominik.mueller` }] },
};

const makeUser = (id, slug, displayName, email) => ({
  id,
  name: slug,
  slug,
  displayName,
  emailAddress: email,
  active: true,
  type: 'NORMAL',
  links: { self: [{ href: `${BASE}/users/${slug}` }] },
});

const makeParticipant = (user, role, status) => ({
  user,
  role,
  approved: status === 'APPROVED',
  status,
});

const makeRepo = (id, slug, projectKey, projectName) => ({
  id,
  slug,
  name: slug,
  project: { key: projectKey, id: id * 10, name: projectName },
  links: { self: [{ href: `${BASE}/projects/${projectKey}/repos/${slug}/browse` }] },
});

const makeRef = (displayId, latestCommit, repo) => ({
  id: `refs/heads/${displayId}`,
  displayId,
  latestCommit,
  repository: repo,
});

const REPO_VF = makeRepo(1, 'versicherung-frontend', 'VF', 'Versicherung Frontend');
const REPO_SL = makeRepo(2, 'versicherung-shared-lib', 'SL', 'Versicherung Shared Lib');

const SARAH = makeUser(101, 'sarah.kowalski', 'Sarah Kowalski', 'sarah.kowalski@example.org');
const THOMAS = makeUser(102, 'thomas.bauer', 'Thomas Bauer', 'thomas.bauer@example.org');
const ANNA = makeUser(103, 'anna.lehmann', 'Anna Lehmann', 'anna.lehmann@example.org');
const MICHAEL = makeUser(104, 'michael.hoffmann', 'Michael Hoffmann', 'michael.hoffmann@example.org');

const mockPullRequests = [
  {
    id: 412,
    title: 'feat: Add customer portal navigation component',
    description: 'Implementiert die neue Navigation für das Kundenportal. Beinhaltet responsive Sidebar, Breadcrumbs und Accessibility-Verbesserungen (WCAG AA).',
    state: 'OPEN',
    open: true,
    closed: false,
    locked: false,
    createdDate: 1741694400000,
    updatedDate: 1741866600000,
    fromRef: makeRef('feature/customer-portal-nav', 'a1b2c3d4', REPO_VF),
    toRef: makeRef('main', 'e5f6g7h8', REPO_VF),
    author: makeParticipant(SARAH, 'AUTHOR', 'UNAPPROVED'),
    reviewers: [makeParticipant(CURRENT_USER, 'REVIEWER', 'UNAPPROVED')],
    participants: [],
    properties: { commentCount: 2, openTaskCount: 0 },
    links: { self: [{ href: `${BASE}/projects/VF/repos/versicherung-frontend/pull-requests/412` }] },
  },
  {
    id: 415,
    title: 'fix: Resolve SSO redirect loop on session expiry',
    description: 'Behebt den SSO-Redirect-Loop (VERS-2799). Der AuthGuard wurde angepasst, um abgelaufene Sessions korrekt zu erkennen.',
    state: 'OPEN',
    open: true,
    closed: false,
    locked: false,
    createdDate: 1741780800000,
    updatedDate: 1741953000000,
    fromRef: makeRef('fix/sso-redirect-loop', 'b2c3d4e5', REPO_VF),
    toRef: makeRef('main', 'e5f6g7h8', REPO_VF),
    author: makeParticipant(THOMAS, 'AUTHOR', 'UNAPPROVED'),
    reviewers: [makeParticipant(CURRENT_USER, 'REVIEWER', 'UNAPPROVED')],
    participants: [],
    properties: { commentCount: 0, openTaskCount: 0 },
    links: { self: [{ href: `${BASE}/projects/VF/repos/versicherung-frontend/pull-requests/415` }] },
  },
  {
    id: 89,
    title: 'chore: Update Angular and dependencies to latest',
    description: 'Dependency-Updates auf die neuesten stabilen Versionen. Alle Tests laufen durch.',
    state: 'OPEN',
    open: true,
    closed: false,
    locked: false,
    createdDate: 1741608000000,
    updatedDate: 1741780800000,
    fromRef: makeRef('chore/dependency-updates', 'c3d4e5f6', REPO_SL),
    toRef: makeRef('main', 'f6g7h8i9', REPO_SL),
    author: makeParticipant(ANNA, 'AUTHOR', 'UNAPPROVED'),
    reviewers: [makeParticipant(CURRENT_USER, 'REVIEWER', 'NEEDS_WORK')],
    participants: [],
    properties: { commentCount: 5, openTaskCount: 2 },
    links: { self: [{ href: `${BASE}/projects/SL/repos/versicherung-shared-lib/pull-requests/89` }] },
  },
  {
    id: 408,
    title: 'feat: Implement SEPA mandate form with validation',
    description: 'SEPA-Lastschriftmandat Formular mit vollständiger clientseitiger Validierung. IBAN-Format, BIC, Pflichtfelder.',
    state: 'OPEN',
    open: true,
    closed: false,
    locked: false,
    createdDate: 1741521600000,
    updatedDate: 1741694400000,
    fromRef: makeRef('feature/sepa-mandate', 'd4e5f6g7', REPO_VF),
    toRef: makeRef('main', 'e5f6g7h8', REPO_VF),
    author: makeParticipant(MICHAEL, 'AUTHOR', 'UNAPPROVED'),
    reviewers: [makeParticipant(CURRENT_USER, 'REVIEWER', 'APPROVED')],
    participants: [],
    properties: { commentCount: 3, openTaskCount: 0 },
    links: { self: [{ href: `${BASE}/projects/VF/repos/versicherung-frontend/pull-requests/408` }] },
  },
];

app.get('/rest/api/1.0/myself', (_req, res) => {
  res.json(CURRENT_USER);
});

app.get('/rest/api/1.0/dashboard/pull-requests', (_req, res) => {
  res.json({
    size: mockPullRequests.length,
    limit: 25,
    isLastPage: true,
    values: mockPullRequests,
    start: 0,
  });
});

app.listen(PORT, () => {
  console.log(`Mock Bitbucket server running at http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Verify the server starts**

```bash
node mock-server/bitbucket.js
```

Expected: `Mock Bitbucket server running at http://localhost:6203`

Stop it with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add mock-server/bitbucket.js
git commit -m "feat: add mock Bitbucket server on port 6203"
```

---

### Task 5: Update smoke test to add Bitbucket assertions

**Files:**
- Modify: `smoke-test/index.js`

- [ ] **Step 1: Update smoke-test/index.js**

Add a second mock server spawn immediately after the Jira mock spawn (after line 60):

```js
  const mockBitbucket = spawn('node', ['mock-server/bitbucket.js'], { cwd: ROOT, stdio: 'pipe' });
  children.push(mockBitbucket);
  mockBitbucket.on('exit', (code) => { if (code !== null && code !== 0) fail(new Error(`mock-bitbucket exited with code ${code}`)); });
```

Update the `waitForPort` call to also wait for port 6203:

```js
    await Promise.all([waitForPort(6202), waitForPort(6203), waitForPort(6201)]);
```

After the existing Jira assertion block (after the `if (data.issues.length < 1)` check), add:

```js
    const bbUrl = 'http://localhost:6201/bitbucket/rest/api/1.0/dashboard/pull-requests?role=REVIEWER&state=OPEN&limit=50';
    const { status: bbStatus, data: bbData } = await get(bbUrl);

    if (bbStatus !== 200) {
      throw new Error(`Bitbucket: Expected status 200, got ${bbStatus}`);
    }

    if (!Array.isArray(bbData.values)) {
      throw new Error(`Bitbucket: Response missing "values" array`);
    }

    if (bbData.values.length < 1) {
      throw new Error(`Bitbucket: Expected at least 1 PR, got ${bbData.values.length}`);
    }
```

- [ ] **Step 2: Run the full smoke test**

```bash
npm run smoke-test
```

Expected output: `✅ Smoke test passed`

Note: the 3-second artificial delays in the mock servers mean this takes approximately 9 seconds (3s for `waitForPort(6203)` to resolve, then ~3s per assertion request).

- [ ] **Step 3: Commit**

```bash
git add smoke-test/index.js
git commit -m "test: extend smoke test for Bitbucket proxy + mock server"
```

---

## Chunk 2: PullRequest model and component updates

### Task 6: Replace PullRequest model

**Files:**
- Modify: `src/app/models/work-item.model.ts`
- Modify: `src/app/services/work-data.service.ts` (temporary: empty pullRequests + fix awaitingReviewCount)

This task replaces the flat `PullRequest` model with the rich Bitbucket-aligned model. The `WorkDataService` has hardcoded mock data using the old model — it is temporarily replaced with an empty signal to allow compilation. The real data wiring happens in Task 10.

- [ ] **Step 1: Replace the PullRequest interface in work-item.model.ts**

Replace everything from `export type PrStatus` through the end of `export interface PullRequest` with:

```typescript
export type PrStatus = 'Awaiting Review' | 'Changes Requested' | 'Approved';
export type PrState = 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED';

export interface PrUser {
  id: number;
  name: string;
  displayName: string;
  emailAddress: string;
  slug: string;
  active: boolean;
  type: string;
  profileUrl: string;
}

export interface PrRepository {
  id: number;
  slug: string;
  name: string;
  projectKey: string;
  projectName: string;
  browseUrl: string;
}

export interface PrRef {
  id: string;
  displayId: string;
  latestCommit: string;
  repository: PrRepository;
}

export interface PrParticipant {
  user: PrUser;
  role: 'AUTHOR' | 'REVIEWER' | 'PARTICIPANT';
  approved: boolean;
  status: 'APPROVED' | 'UNAPPROVED' | 'NEEDS_WORK';
}

export interface PullRequest {
  type: 'pr';
  id: number;
  title: string;
  description: string;
  state: PrState;
  open: boolean;
  closed: boolean;
  locked: boolean;
  createdDate: number;
  updatedDate: number;
  fromRef: PrRef;
  toRef: PrRef;
  author: PrParticipant;
  reviewers: PrParticipant[];
  participants: PrParticipant[];
  commentCount: number;
  openTaskCount: number;
  url: string;
  myReviewStatus: PrStatus;
}
```

- [ ] **Step 2: Fix WorkDataService to compile**

In `src/app/services/work-data.service.ts`:

1. Replace the entire `readonly pullRequests = signal<PullRequest[]>([...])` block (lines with the 4 hardcoded PRs) with:

```typescript
readonly pullRequests = signal<PullRequest[]>([]);
```

2. Update `awaitingReviewCount` (change `pr.status` to `pr.myReviewStatus`):

```typescript
readonly awaitingReviewCount = computed(() => this.pullRequests().filter(pr => pr.myReviewStatus === 'Awaiting Review').length);
```

- [ ] **Step 3: Verify the project compiles**

```bash
ng build --configuration development 2>&1 | head -30
```

Expected: no TypeScript errors. If there are errors, they will be in `pr-card.ts` or `pr-detail.ts` — fix them now following Tasks 7 and 8, then come back to verify.

- [ ] **Step 4: Commit**

```bash
git add src/app/models/work-item.model.ts src/app/services/work-data.service.ts
git commit -m "feat: replace PullRequest model with rich Bitbucket-aligned shape"
```

---

### Task 7: Update pr-card component

**Files:**
- Modify: `src/app/components/pr-card/pr-card.ts`

- [ ] **Step 1: Update pr-card.ts**

Replace the entire template and `statusClass()` method. The new component:

```typescript
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PullRequest } from '../../models/work-item.model';

@Component({
  selector: 'app-pr-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="group w-full text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      [class]="selected()
        ? 'bg-indigo-50 border-indigo-300 shadow-sm'
        : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-sm'"
      (click)="select.emit(pr())"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="'PR: ' + pr().title"
    >
      <div class="flex items-start justify-between gap-2">
        <span class="text-xs font-medium text-stone-400 truncate">{{ pr().fromRef.repository.slug }}</span>
        <a
          [href]="pr().url"
          target="_blank"
          rel="noopener noreferrer"
          class="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-stone-400 hover:text-indigo-500 transition-opacity p-0.5 rounded"
          [attr.aria-label]="'Öffne PR in Bitbucket'"
          (click)="$event.stopPropagation()"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
        </a>
      </div>

      <p class="mt-1 text-sm font-medium leading-snug text-stone-800 line-clamp-2">{{ pr().title }}</p>

      <div class="mt-2 flex items-center justify-between gap-2">
        <span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium" [class]="statusClass()">
          {{ pr().myReviewStatus }}
        </span>
        @if (pr().commentCount > 0) {
          <span class="flex items-center gap-1 text-xs text-stone-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {{ pr().commentCount }}
          </span>
        }
      </div>
    </button>
  `,
})
export class PrCardComponent {
  pr = input.required<PullRequest>();
  selected = input(false);
  select = output<PullRequest>();

  statusClass() {
    const map: Record<string, string> = {
      'Awaiting Review': 'bg-amber-100 text-amber-700',
      'Changes Requested': 'bg-red-100 text-red-700',
      'Approved': 'bg-emerald-100 text-emerald-700',
    };
    return map[this.pr().myReviewStatus] ?? 'bg-stone-100 text-stone-600';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/pr-card/pr-card.ts
git commit -m "feat: update pr-card for new PullRequest model"
```

---

### Task 8: Update pr-detail component

**Files:**
- Modify: `src/app/components/pr-detail/pr-detail.ts`

`pr-detail` uses a local `formatDate(iso: string)` method which must be removed. `DatePipe` is used directly in the template instead. `DatePipe` accepts a Unix millisecond timestamp (`number`) natively.

- [ ] **Step 1: Update pr-detail.ts**

Replace the entire file:

```typescript
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PullRequest } from '../../models/work-item.model';

@Component({
  selector: 'app-pr-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <article class="h-full flex flex-col" [attr.aria-label]="'PR #' + pr().id + ': ' + pr().title">
      <header class="pb-5 border-b border-stone-200">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-stone-100 text-stone-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" x2="6" y1="9" y2="21"/></svg>
                {{ pr().fromRef.repository.slug }}
              </span>
              <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium" [class]="statusClass()">{{ pr().myReviewStatus }}</span>
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

      <div class="flex-1 py-5 overflow-y-auto">
        <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Beschreibung</h2>
        <div class="text-sm text-stone-700 leading-relaxed whitespace-pre-line">{{ pr().description }}</div>
      </div>
    </article>
  `,
})
export class PrDetailComponent {
  pr = input.required<PullRequest>();

  statusClass(): string {
    const map: Record<string, string> = {
      'Awaiting Review': 'bg-amber-100 text-amber-700',
      'Changes Requested': 'bg-red-100 text-red-700',
      'Approved': 'bg-emerald-100 text-emerald-700',
    };
    return map[this.pr().myReviewStatus] ?? 'bg-stone-100 text-stone-600';
  }
}
```

- [ ] **Step 2: Verify the project compiles cleanly**

```bash
ng build --configuration development 2>&1 | head -30
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/pr-detail/pr-detail.ts
git commit -m "feat: update pr-detail for new PullRequest model"
```

---

## Chunk 3: BitbucketService and WorkDataService wiring

### Task 9: Create BitbucketService (TDD)

**Files:**
- Create: `src/app/services/bitbucket.service.spec.ts`
- Create: `src/app/services/bitbucket.service.ts`

The service calls `/myself` to get the current user's slug, then fetches `/dashboard/pull-requests?role=REVIEWER&state=OPEN&limit=50` and maps each PR to the `PullRequest` model. The `myReviewStatus` field is derived by finding the current user's entry in `reviewers[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/services/bitbucket.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BitbucketService } from './bitbucket.service';
import { PullRequest } from '../models/work-item.model';

const mockMyself = {
  id: 42,
  name: 'dominik.mueller',
  slug: 'dominik.mueller',
  displayName: 'Dominik Müller',
  emailAddress: 'dominik.mueller@example.org',
  active: true,
  type: 'NORMAL',
  links: { self: [{ href: 'http://localhost:6203/users/dominik.mueller' }] },
};

const makeRepo = () => ({
  id: 1,
  slug: 'versicherung-frontend',
  name: 'versicherung-frontend',
  project: { key: 'VF', id: 10, name: 'Versicherung Frontend' },
  links: { self: [{ href: 'http://localhost:6203/projects/VF/repos/versicherung-frontend/browse' }] },
});

const makeUser = (slug: string) => ({
  id: 101,
  name: slug,
  slug,
  displayName: 'Test User',
  emailAddress: `${slug}@example.org`,
  active: true,
  type: 'NORMAL',
  links: { self: [{ href: `http://localhost:6203/users/${slug}` }] },
});

const makePrRaw = (reviewerStatus: 'UNAPPROVED' | 'NEEDS_WORK' | 'APPROVED') => ({
  id: 412,
  title: 'feat: test PR',
  description: 'Test description',
  state: 'OPEN',
  open: true,
  closed: false,
  locked: false,
  createdDate: 1741694400000,
  updatedDate: 1741866600000,
  fromRef: {
    id: 'refs/heads/feature/test',
    displayId: 'feature/test',
    latestCommit: 'abc123',
    repository: makeRepo(),
  },
  toRef: {
    id: 'refs/heads/main',
    displayId: 'main',
    latestCommit: 'def456',
    repository: makeRepo(),
  },
  author: {
    user: makeUser('sarah.kowalski'),
    role: 'AUTHOR',
    approved: false,
    status: 'UNAPPROVED',
  },
  reviewers: [
    {
      user: makeUser('dominik.mueller'),
      role: 'REVIEWER',
      approved: reviewerStatus === 'APPROVED',
      status: reviewerStatus,
    },
  ],
  participants: [],
  properties: { commentCount: 3, openTaskCount: 1 },
  links: { self: [{ href: 'http://localhost:6203/projects/VF/repos/versicherung-frontend/pull-requests/412' }] },
});

const flushRequests = (httpTesting: HttpTestingController, reviewerStatus: 'UNAPPROVED' | 'NEEDS_WORK' | 'APPROVED') => {
  httpTesting.expectOne(req => req.url.includes('/myself')).flush(mockMyself);
  httpTesting
    .expectOne(req => req.url.includes('dashboard/pull-requests'))
    .flush({ values: [makePrRaw(reviewerStatus)], isLastPage: true });
};

describe('BitbucketService', () => {
  let service: BitbucketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BitbucketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('calls /myself then /dashboard/pull-requests', () => {
    service.getReviewerPullRequests().subscribe();
    httpTesting.expectOne(req => req.url.includes('/myself')).flush(mockMyself);
    const prReq = httpTesting.expectOne(req => req.url.includes('dashboard/pull-requests'));
    expect(prReq.request.params.get('role')).toBe('REVIEWER');
    expect(prReq.request.params.get('state')).toBe('OPEN');
    prReq.flush({ values: [], isLastPage: true });
  });

  it('maps UNAPPROVED reviewer status to Awaiting Review', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe(prs => (result = prs));
    flushRequests(httpTesting, 'UNAPPROVED');
    expect(result![0].myReviewStatus).toBe('Awaiting Review');
  });

  it('maps NEEDS_WORK reviewer status to Changes Requested', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe(prs => (result = prs));
    flushRequests(httpTesting, 'NEEDS_WORK');
    expect(result![0].myReviewStatus).toBe('Changes Requested');
  });

  it('maps APPROVED reviewer status to Approved', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe(prs => (result = prs));
    flushRequests(httpTesting, 'APPROVED');
    expect(result![0].myReviewStatus).toBe('Approved');
  });

  it('maps PullRequest fields from raw API response', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe(prs => (result = prs));
    flushRequests(httpTesting, 'UNAPPROVED');
    const pr = result![0];
    expect(pr.type).toBe('pr');
    expect(pr.id).toBe(412);
    expect(pr.title).toBe('feat: test PR');
    expect(pr.fromRef.displayId).toBe('feature/test');
    expect(pr.fromRef.repository.slug).toBe('versicherung-frontend');
    expect(pr.fromRef.repository.projectKey).toBe('VF');
    expect(pr.author.user.displayName).toBe('Test User');
    expect(pr.commentCount).toBe(3);
    expect(pr.openTaskCount).toBe(1);
    expect(pr.url).toBe('http://localhost:6203/projects/VF/repos/versicherung-frontend/pull-requests/412');
  });

  it('falls back to Awaiting Review when current user is not in reviewers', () => {
    let result: PullRequest[] | undefined;
    service.getReviewerPullRequests().subscribe(prs => (result = prs));
    httpTesting.expectOne(req => req.url.includes('/myself')).flush({
      ...mockMyself,
      slug: 'someone-else',
    });
    httpTesting
      .expectOne(req => req.url.includes('dashboard/pull-requests'))
      .flush({ values: [makePrRaw('APPROVED')], isLastPage: true });
    expect(result![0].myReviewStatus).toBe('Awaiting Review');
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
ng test --no-watch 2>&1 | grep -A 3 "BitbucketService"
```

Expected: failures because `bitbucket.service.ts` doesn't exist yet.

- [ ] **Step 3: Create bitbucket.service.ts**

Create `src/app/services/bitbucket.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
  PullRequest,
  PrStatus,
  PrUser,
  PrRepository,
  PrRef,
  PrParticipant,
} from '../models/work-item.model';
import { environment } from '../../environments/environment';

interface BitbucketLinkRaw {
  href: string;
}

interface BitbucketUserRaw {
  id: number;
  name: string;
  slug: string;
  displayName: string;
  emailAddress: string;
  active: boolean;
  type: string;
  links: { self: BitbucketLinkRaw[] };
}

interface BitbucketProjectRaw {
  key: string;
  id: number;
  name: string;
}

interface BitbucketRepositoryRaw {
  id: number;
  slug: string;
  name: string;
  project: BitbucketProjectRaw;
  links: { self: BitbucketLinkRaw[] };
}

interface BitbucketRefRaw {
  id: string;
  displayId: string;
  latestCommit: string;
  repository: BitbucketRepositoryRaw;
}

interface BitbucketParticipantRaw {
  user: BitbucketUserRaw;
  role: 'AUTHOR' | 'REVIEWER' | 'PARTICIPANT';
  approved: boolean;
  status: 'APPROVED' | 'UNAPPROVED' | 'NEEDS_WORK';
}

interface BitbucketPrRaw {
  id: number;
  title: string;
  description: string;
  state: string;
  open: boolean;
  closed: boolean;
  locked: boolean;
  createdDate: number;
  updatedDate: number;
  fromRef: BitbucketRefRaw;
  toRef: BitbucketRefRaw;
  author: BitbucketParticipantRaw;
  reviewers: BitbucketParticipantRaw[];
  participants: BitbucketParticipantRaw[];
  properties: { commentCount: number; openTaskCount: number };
  links: { self: BitbucketLinkRaw[] };
}

interface BitbucketPrPageRaw {
  values: BitbucketPrRaw[];
  isLastPage: boolean;
}

function mapReviewStatus(status: 'APPROVED' | 'UNAPPROVED' | 'NEEDS_WORK'): PrStatus {
  if (status === 'APPROVED') return 'Approved';
  if (status === 'NEEDS_WORK') return 'Changes Requested';
  return 'Awaiting Review';
}

function mapUser(raw: BitbucketUserRaw): PrUser {
  return {
    id: raw.id,
    name: raw.name,
    displayName: raw.displayName,
    emailAddress: raw.emailAddress,
    slug: raw.slug,
    active: raw.active,
    type: raw.type,
    profileUrl: raw.links?.self?.[0]?.href ?? '',
  };
}

function mapRepository(raw: BitbucketRepositoryRaw): PrRepository {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    projectKey: raw.project.key,
    projectName: raw.project.name,
    browseUrl: raw.links?.self?.[0]?.href ?? '',
  };
}

function mapRef(raw: BitbucketRefRaw): PrRef {
  return {
    id: raw.id,
    displayId: raw.displayId,
    latestCommit: raw.latestCommit,
    repository: mapRepository(raw.repository),
  };
}

function mapParticipant(raw: BitbucketParticipantRaw): PrParticipant {
  return {
    user: mapUser(raw.user),
    role: raw.role,
    approved: raw.approved,
    status: raw.status,
  };
}

@Injectable({ providedIn: 'root' })
export class BitbucketService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/bitbucket/rest/api/1.0`;

  getReviewerPullRequests(): Observable<PullRequest[]> {
    return this.http.get<BitbucketUserRaw>(`${this.baseUrl}/myself`).pipe(
      switchMap(myself =>
        this.http
          .get<BitbucketPrPageRaw>(`${this.baseUrl}/dashboard/pull-requests`, {
            params: new HttpParams()
              .set('role', 'REVIEWER')
              .set('state', 'OPEN')
              .set('limit', '50'),
          })
          .pipe(map(page => page.values.map(pr => this.mapPr(pr, myself.slug))))
      )
    );
  }

  private mapPr(raw: BitbucketPrRaw, currentUserSlug: string): PullRequest {
    const reviewer = raw.reviewers.find(r => r.user.slug === currentUserSlug);
    const myReviewStatus: PrStatus = reviewer
      ? mapReviewStatus(reviewer.status)
      : 'Awaiting Review';

    return {
      type: 'pr',
      id: raw.id,
      title: raw.title,
      description: raw.description ?? '',
      state: raw.state as PullRequest['state'],
      open: raw.open,
      closed: raw.closed,
      locked: raw.locked,
      createdDate: raw.createdDate,
      updatedDate: raw.updatedDate,
      fromRef: mapRef(raw.fromRef),
      toRef: mapRef(raw.toRef),
      author: mapParticipant(raw.author),
      reviewers: (raw.reviewers ?? []).map(mapParticipant),
      participants: (raw.participants ?? []).map(mapParticipant),
      commentCount: raw.properties?.commentCount ?? 0,
      openTaskCount: raw.properties?.openTaskCount ?? 0,
      url: raw.links?.self?.[0]?.href ?? '',
      myReviewStatus,
    };
  }
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
ng test --no-watch 2>&1 | grep -E "(PASS|FAIL|BitbucketService)"
```

Expected: all `BitbucketService` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/bitbucket.service.ts src/app/services/bitbucket.service.spec.ts
git commit -m "feat: add BitbucketService with reviewer PR fetching and mapping"
```

---

### Task 10: Wire BitbucketService into WorkDataService (TDD)

**Files:**
- Modify: `src/app/services/work-data.service.spec.ts`
- Modify: `src/app/services/work-data.service.ts`

- [ ] **Step 1: Add failing tests to work-data.service.spec.ts**

Open `src/app/services/work-data.service.spec.ts`.

Add these imports at the top of the file (only add what is not already imported — check before adding):

```typescript
import { BitbucketService } from './bitbucket.service';
import { PullRequest } from '../models/work-item.model';
```

`of`, `throwError`, and `JiraService` are already imported in the existing spec file — do not add duplicates.

Add this helper and nested `describe` block at the end of the file, **outside** any existing `describe` block:

```typescript
const makePr = (myReviewStatus: PullRequest['myReviewStatus'] = 'Awaiting Review'): PullRequest => ({
  type: 'pr',
  id: 1,
  title: 'Test PR',
  description: '',
  state: 'OPEN',
  open: true,
  closed: false,
  locked: false,
  createdDate: 0,
  updatedDate: 0,
  fromRef: {
    id: 'refs/heads/feature/test',
    displayId: 'feature/test',
    latestCommit: 'abc',
    repository: { id: 1, slug: 'repo', name: 'repo', projectKey: 'P', projectName: 'Project', browseUrl: '' },
  },
  toRef: {
    id: 'refs/heads/main',
    displayId: 'main',
    latestCommit: 'def',
    repository: { id: 1, slug: 'repo', name: 'repo', projectKey: 'P', projectName: 'Project', browseUrl: '' },
  },
  author: {
    user: { id: 1, name: 'u', displayName: 'User', emailAddress: '', slug: 'u', active: true, type: 'NORMAL', profileUrl: '' },
    role: 'AUTHOR',
    approved: false,
    status: 'UNAPPROVED',
  },
  reviewers: [],
  participants: [],
  commentCount: 0,
  openTaskCount: 0,
  url: 'http://example.com/pr/1',
  myReviewStatus,
});

describe('WorkDataService — pullRequests loading', () => {
  const mockJira = { getAssignedActiveTickets: () => of([]) };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    TestBed.overrideProvider(JiraService, { useValue: mockJira });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('pullRequestsLoading starts true and becomes false after data loads', () => {
    const mockBitbucket = { getReviewerPullRequests: () => of([makePr()]) };
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    const service = TestBed.inject(WorkDataService);
    expect(service.pullRequestsLoading()).toBe(true);
    TestBed.tick();
    expect(service.pullRequestsLoading()).toBe(false);
  });

  it('populates pullRequests from BitbucketService', () => {
    const pr = makePr('Approved');
    const mockBitbucket = { getReviewerPullRequests: () => of([pr]) };
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    const service = TestBed.inject(WorkDataService);
    TestBed.tick();
    expect(service.pullRequests()).toEqual([pr]);
  });

  it('sets pullRequestsError on BitbucketService failure', () => {
    const mockBitbucket = { getReviewerPullRequests: () => throwError(() => new Error('Network error')) };
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    const service = TestBed.inject(WorkDataService);
    TestBed.tick();
    expect(service.pullRequestsError()).toBe(true);
    expect(service.pullRequests()).toEqual([]);
  });

  it('awaitingReviewCount counts PRs with myReviewStatus Awaiting Review', () => {
    const prs = [makePr('Awaiting Review'), makePr('Awaiting Review'), makePr('Approved')];
    const mockBitbucket = { getReviewerPullRequests: () => of(prs) };
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    const service = TestBed.inject(WorkDataService);
    TestBed.tick();
    expect(service.awaitingReviewCount()).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests — expect new tests to fail**

```bash
ng test --no-watch 2>&1 | grep -E "(PASS|FAIL|pullRequests loading)"
```

Expected: new tests fail because `WorkDataService` still has the empty hardcoded signal.

- [ ] **Step 3: Update work-data.service.ts**

1. Add `BitbucketService` import:
```typescript
import { BitbucketService } from './bitbucket.service';
```

2. Add `BitbucketService` injection after the existing `jira` injection:
```typescript
private readonly bitbucket = inject(BitbucketService);
```

3. Replace `readonly pullRequests = signal<PullRequest[]>([]);` with:
```typescript
readonly pullRequestsLoading = signal(true);
readonly pullRequestsError = signal(false);

private readonly pullRequests$ = this.bitbucket.getReviewerPullRequests().pipe(
  tap(() => this.pullRequestsLoading.set(false)),
  catchError(err => {
    console.error('Failed to load Bitbucket pull requests:', err);
    this.pullRequestsError.set(true);
    this.pullRequestsLoading.set(false);
    return of([] as PullRequest[]);
  }),
);

readonly pullRequests = toSignal(this.pullRequests$, { initialValue: [] as PullRequest[] });
```

4. Remove `readonly pullRequests = signal<PullRequest[]>([]);` — this temporary empty signal from Task 6 is now replaced by the `toSignal(...)` wiring above.

The UI loading/error states for PRs — showing a loading indicator while `pullRequestsLoading` is true and an error message ("Pull Requests konnten nicht geladen werden") when `pullRequestsError` is true — are handled by the existing component that renders the PR list. Check that component and add those states if they are not yet present.

- [ ] **Step 4: Run all tests**

```bash
ng test --no-watch
```

Expected: all tests pass. If `WorkDataService` tests fail, check that `TestBed.overrideProvider(BitbucketService, ...)` is called before `TestBed.inject(WorkDataService)`.

- [ ] **Step 5: Verify the app runs end-to-end**

```bash
npm start
```

Open `http://localhost:6200`. After ~3 seconds the PR column should populate with the 4 mock PRs from `mock-server/bitbucket.js`. Click a PR card to verify the detail view shows the correct author, branch, and date.

- [ ] **Step 6: Commit**

```bash
git add src/app/services/work-data.service.ts src/app/services/work-data.service.spec.ts
git commit -m "feat: wire BitbucketService into WorkDataService for live PR data"
```

---

## Done

The Bitbucket integration is complete. The app now:
- Fetches open PRs where the current user is a reviewer from `GET /bitbucket/rest/api/1.0/dashboard/pull-requests`
- Maps the full Bitbucket API response to a rich `PullRequest` model
- Shows loading and error states in the PR column
- Uses mock data in development (`npm start`) and real Bitbucket in production (`npm run start:real`)
