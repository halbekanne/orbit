# Jira Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Orbit to a real Jira Server REST API via a local Express proxy and a mock Jira server for development, displaying active tickets assigned to the current user.

**Architecture:** Angular (port 6200) calls an Express proxy (port 6201) which forwards requests with a PAT auth header to either a mock Jira server (port 6202, dev) or a real Jira Server (prod). The Angular app never changes — only `.env` changes when switching between mock and real.

**Tech Stack:** Angular 21 (signals, zoneless, `toSignal`, `HttpClient` with `withFetch`), Express 4, `http-proxy-middleware`, `dotenv`, `cors`, `concurrently`

**Spec:** `docs/superpowers/specs/2026-03-14-jira-integration-design.md`

---

## Chunk 1: Infrastructure

### Task 1: Install dependencies and update npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install new dependencies**

```bash
npm install --save-dev express dotenv http-proxy-middleware cors concurrently
```

Expected: packages added to `devDependencies` in `package.json`, `package-lock.json` updated.

- [ ] **Step 2: Update scripts in `package.json`**

Replace the existing `"scripts"` block with:

```json
"scripts": {
  "ng": "ng",
  "start": "concurrently \"ng serve --port 6200\" \"node proxy/index.js\" \"node mock-server/index.js\"",
  "start:real": "concurrently \"ng serve --port 6200\" \"node proxy/index.js\"",
  "proxy": "node proxy/index.js",
  "mock": "node mock-server/index.js",
  "build": "ng build",
  "watch": "ng build --watch --configuration development",
  "test": "ng test"
}
```

- [ ] **Step 3: Verify scripts are wired**

```bash
node -e "const p = require('./package.json'); console.log(p.scripts)"
```

Expected: output shows all new scripts (`start`, `start:real`, `proxy`, `mock`). Full verification deferred to Task 4 when the server files exist.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: Add Express, concurrently, dotenv, cors, http-proxy-middleware"
```

---

### Task 2: Create .env files and update .gitignore

**Files:**
- Create: `.env.example`
- Create: `.env`
- Modify: `.gitignore`

- [ ] **Step 1: Create `.env.example`**

```
JIRA_BASE_URL=https://jira.yourcompany.com
JIRA_API_KEY=your-personal-access-token-here
```

- [ ] **Step 2: Create `.env` (dev defaults pointing at mock server)**

```
JIRA_BASE_URL=http://localhost:6202
JIRA_API_KEY=dev-token
```

- [ ] **Step 3: Ensure `.env` is in `.gitignore`**

Open `.gitignore` and add if not present:

```
.env
```

- [ ] **Step 4: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: Add .env.example and ensure .env is gitignored"
```

---

### Task 3: Generate Angular environments

**Files:**
- Create: `src/environments/environment.ts`
- Create: `src/environments/environment.development.ts`
- Modify: `angular.json`

- [ ] **Step 1: Generate environment files**

```bash
ng generate environments
```

Expected output: creates `src/environments/environment.ts` and `src/environments/environment.development.ts`, updates `angular.json` with `fileReplacements` in the `development` build configuration.

- [ ] **Step 2: Set contents of `src/environments/environment.ts` (production)**

```typescript
export const environment = {
  proxyUrl: '',
};
```

- [ ] **Step 3: Set contents of `src/environments/environment.development.ts`**

```typescript
export const environment = {
  proxyUrl: 'http://localhost:6201',
};
```

- [ ] **Step 4: Verify `angular.json` has fileReplacements**

Open `angular.json` and confirm the `development` configuration under `build` contains:

```json
"fileReplacements": [
  {
    "replace": "src/environments/environment.ts",
    "with": "src/environments/environment.development.ts"
  }
]
```

If missing, add it manually under `projects.orbit.architect.build.configurations.development`.

- [ ] **Step 5: Commit**

```bash
git add src/environments/ angular.json
git commit -m "chore: Add Angular environment files for proxy URL configuration"
```

---

## Chunk 2: Servers

### Task 4: Create mock Jira server

**Files:**
- Create: `mock-server/index.js`

- [ ] **Step 1: Create `mock-server/index.js`**

```javascript
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 6202;

app.use(cors());
app.use(express.json());

const mockUser = {
  self: `http://localhost:${PORT}/rest/api/2/user?username=dominik`,
  name: 'dominik',
  emailAddress: 'dominik@example.com',
  displayName: 'Dominik M.',
  active: true,
  timeZone: 'Europe/Berlin',
  avatarUrls: { '48x48': '', '32x32': '', '24x24': '', '16x16': '' },
};

const makeUser = (name, displayName, email) => ({
  self: `http://localhost:${PORT}/rest/api/2/user?username=${name}`,
  name,
  displayName,
  emailAddress: email,
  active: true,
  avatarUrls: { '48x48': '', '32x32': '', '24x24': '', '16x16': '' },
});

const mockIssues = [
  {
    id: '10001',
    key: 'VERS-2847',
    self: `http://localhost:${PORT}/rest/api/2/issue/10001`,
    fields: {
      summary: 'Frontend-Integration: Neues Kunden-Dashboard',
      description: 'Implementierung des neuen Kunden-Dashboards gemäß Figma-Design. Anbindung an die bestehende REST-API für Vertragsdaten.\n\nAkzeptanzkriterien:\n- Dashboard lädt in unter 2 Sekunden\n- Alle Vertragsdaten werden korrekt angezeigt',
      issuetype: { id: '3', name: 'Task', subtask: false },
      project: { id: '10000', key: 'VERS', name: 'Versicherung Frontend' },
      status: {
        id: '3',
        name: 'In Progress',
        statusCategory: { id: 4, key: 'indeterminate', colorName: 'yellow', name: 'In Progress' },
      },
      priority: { id: '2', name: 'High', iconUrl: '' },
      assignee: makeUser('dominik', 'Dominik M.', 'dominik@example.com'),
      reporter: makeUser('sarah.k', 'Sarah K.', 'sarah@example.com'),
      creator: makeUser('sarah.k', 'Sarah K.', 'sarah@example.com'),
      created: '2026-02-01T09:00:00.000+0100',
      updated: '2026-03-13T09:15:00.000+0100',
      duedate: '2026-03-13',
      resolutiondate: null,
      resolution: null,
      labels: ['frontend', 'dashboard'],
      components: [{ id: '10001', name: 'Frontend', self: '' }],
      fixVersions: [{ id: '10001', name: '2.0.0', released: false, archived: false }],
      environment: null,
      timetracking: {
        originalEstimate: '5d',
        remainingEstimate: '2d',
        timeSpent: '3d',
        originalEstimateSeconds: 144000,
        remainingEstimateSeconds: 57600,
        timeSpentSeconds: 86400,
      },
      comment: {
        startAt: 0, maxResults: 10, total: 1,
        comments: [{
          id: '20001',
          author: makeUser('sarah.k', 'Sarah K.', 'sarah@example.com'),
          body: 'Bitte das Figma-Design nochmal prüfen.',
          created: '2026-03-12T10:00:00.000+0100',
          updated: '2026-03-12T10:00:00.000+0100',
        }],
      },
      attachment: [],
      subtasks: [],
      issuelinks: [],
      parent: null,
      watches: { self: '', watchCount: 1, isWatching: true },
      votes: { self: '', votes: 0, hasVoted: false },
      customfield_10020: { id: 1, name: 'Sprint 42', state: 'active', startDate: '2026-03-07', endDate: '2026-03-20', completeDate: null },
      customfield_10014: null,
      customfield_10016: 5,
    },
  },
  {
    id: '10002',
    key: 'VERS-2801',
    self: `http://localhost:${PORT}/rest/api/2/issue/10002`,
    fields: {
      summary: 'API-Anbindung: Schadensmeldung Formular',
      description: 'REST-API Integration für das Schadensmeldungs-Formular.\n\nEndpoints:\n- POST /api/v2/claims\n- GET /api/v2/claims/{id}/status',
      issuetype: { id: '72', name: 'Story', subtask: false },
      project: { id: '10000', key: 'VERS', name: 'Versicherung Frontend' },
      status: {
        id: '3',
        name: 'In Progress',
        statusCategory: { id: 4, key: 'indeterminate', colorName: 'yellow', name: 'In Progress' },
      },
      priority: { id: '3', name: 'Medium', iconUrl: '' },
      assignee: makeUser('dominik', 'Dominik M.', 'dominik@example.com'),
      reporter: makeUser('thomas.b', 'Thomas B.', 'thomas@example.com'),
      creator: makeUser('thomas.b', 'Thomas B.', 'thomas@example.com'),
      created: '2026-01-15T14:00:00.000+0100',
      updated: '2026-03-12T16:30:00.000+0100',
      duedate: '2026-03-20',
      resolutiondate: null,
      resolution: null,
      labels: ['api', 'forms'],
      components: [{ id: '10002', name: 'Backend Integration', self: '' }],
      fixVersions: [],
      environment: 'staging',
      timetracking: {
        originalEstimate: '3d',
        remainingEstimate: '1d',
        timeSpent: '2d',
        originalEstimateSeconds: 86400,
        remainingEstimateSeconds: 28800,
        timeSpentSeconds: 57600,
      },
      comment: { startAt: 0, maxResults: 10, total: 0, comments: [] },
      attachment: [],
      subtasks: [],
      issuelinks: [
        {
          id: '30001',
          type: { id: '10000', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
          outwardIssue: { id: '10005', key: 'VERS-2823', self: '', fields: { summary: 'Unit Tests: PolicyService Coverage erhöhen', status: { name: 'In Progress' }, priority: { name: 'Medium' }, issuetype: { name: 'Task' } } },
        },
      ],
      parent: null,
      watches: { self: '', watchCount: 2, isWatching: true },
      votes: { self: '', votes: 1, hasVoted: false },
      customfield_10020: { id: 1, name: 'Sprint 42', state: 'active', startDate: '2026-03-07', endDate: '2026-03-20', completeDate: null },
      customfield_10014: 'VERS-2790',
      customfield_10016: 8,
    },
  },
  {
    id: '10003',
    key: 'VERS-2799',
    self: `http://localhost:${PORT}/rest/api/2/issue/10003`,
    fields: {
      summary: 'Bug: Login-Fehler bei SSO-Weiterleitung',
      description: 'Nach dem SSO-Login über Azure AD werden Nutzer nicht korrekt weitergeleitet.\n\nReproduktion:\n1. Session ablaufen lassen\n2. Auf geschützte Seite navigieren\n3. SSO-Login durchführen\n4. → Redirect-Loop tritt auf',
      issuetype: { id: '1', name: 'Bug', subtask: false },
      project: { id: '10000', key: 'VERS', name: 'Versicherung Frontend' },
      status: {
        id: '10001',
        name: 'In Review',
        statusCategory: { id: 4, key: 'indeterminate', colorName: 'yellow', name: 'In Progress' },
      },
      priority: { id: '2', name: 'High', iconUrl: '' },
      assignee: makeUser('dominik', 'Dominik M.', 'dominik@example.com'),
      reporter: makeUser('anna.l', 'Anna L.', 'anna@example.com'),
      creator: makeUser('anna.l', 'Anna L.', 'anna@example.com'),
      created: '2026-03-05T11:00:00.000+0100',
      updated: '2026-03-13T08:00:00.000+0100',
      duedate: '2026-03-10',
      resolutiondate: null,
      resolution: null,
      labels: ['bug', 'sso', 'auth'],
      components: [{ id: '10003', name: 'Authentication', self: '' }],
      fixVersions: [{ id: '10001', name: '2.0.0', released: false, archived: false }],
      environment: 'production',
      timetracking: {
        originalEstimate: '1d',
        remainingEstimate: '0h',
        timeSpent: '1d',
        originalEstimateSeconds: 28800,
        remainingEstimateSeconds: 0,
        timeSpentSeconds: 28800,
      },
      comment: {
        startAt: 0, maxResults: 10, total: 2,
        comments: [
          {
            id: '20002',
            author: makeUser('anna.l', 'Anna L.', 'anna@example.com'),
            body: 'Reproduziert auf Chrome 122 und Firefox 123.',
            created: '2026-03-06T09:00:00.000+0100',
            updated: '2026-03-06T09:00:00.000+0100',
          },
          {
            id: '20003',
            author: makeUser('dominik', 'Dominik M.', 'dominik@example.com'),
            body: 'Fix implementiert, PR erstellt: #415',
            created: '2026-03-13T08:00:00.000+0100',
            updated: '2026-03-13T08:00:00.000+0100',
          },
        ],
      },
      attachment: [
        { id: '40001', filename: 'screenshot-loop.png', size: 145000, mimeType: 'image/png', created: '2026-03-06T09:05:00.000+0100', author: makeUser('anna.l', 'Anna L.', 'anna@example.com') },
      ],
      subtasks: [],
      issuelinks: [],
      parent: null,
      watches: { self: '', watchCount: 4, isWatching: true },
      votes: { self: '', votes: 2, hasVoted: false },
      customfield_10020: { id: 1, name: 'Sprint 42', state: 'active', startDate: '2026-03-07', endDate: '2026-03-20', completeDate: null },
      customfield_10014: null,
      customfield_10016: 2,
    },
  },
  {
    id: '10004',
    key: 'VERS-2756',
    self: `http://localhost:${PORT}/rest/api/2/issue/10004`,
    fields: {
      summary: 'Refactoring: Angular 21 Migration',
      description: 'Schrittweise Migration auf Angular 21.\n\nFortschritt:\n- ✓ Core-Module migriert\n- ✓ Routing auf neue API umgestellt\n- → Komponenten-Migration läuft',
      issuetype: { id: '3', name: 'Task', subtask: false },
      project: { id: '10000', key: 'VERS', name: 'Versicherung Frontend' },
      status: {
        id: '3',
        name: 'In Progress',
        statusCategory: { id: 4, key: 'indeterminate', colorName: 'yellow', name: 'In Progress' },
      },
      priority: { id: '4', name: 'Low', iconUrl: '' },
      assignee: makeUser('dominik', 'Dominik M.', 'dominik@example.com'),
      reporter: makeUser('dominik', 'Dominik M.', 'dominik@example.com'),
      creator: makeUser('dominik', 'Dominik M.', 'dominik@example.com'),
      created: '2026-01-10T10:00:00.000+0100',
      updated: '2026-03-11T14:20:00.000+0100',
      duedate: '2026-04-01',
      resolutiondate: null,
      resolution: null,
      labels: ['refactoring', 'angular', 'migration'],
      components: [{ id: '10001', name: 'Frontend', self: '' }],
      fixVersions: [{ id: '10002', name: '3.0.0', released: false, archived: false }],
      environment: null,
      timetracking: {
        originalEstimate: '10d',
        remainingEstimate: '4d',
        timeSpent: '6d',
        originalEstimateSeconds: 288000,
        remainingEstimateSeconds: 115200,
        timeSpentSeconds: 172800,
      },
      comment: { startAt: 0, maxResults: 10, total: 0, comments: [] },
      attachment: [],
      subtasks: [
        { id: '10041', key: 'VERS-2757', self: '', fields: { summary: 'Migrate AuthModule', status: { name: 'Done' }, priority: { name: 'Low' }, issuetype: { name: 'Sub-task' } } },
        { id: '10042', key: 'VERS-2758', self: '', fields: { summary: 'Migrate SharedModule', status: { name: 'In Progress' }, priority: { name: 'Low' }, issuetype: { name: 'Sub-task' } } },
      ],
      issuelinks: [],
      parent: null,
      watches: { self: '', watchCount: 1, isWatching: true },
      votes: { self: '', votes: 0, hasVoted: false },
      customfield_10020: { id: 2, name: 'Sprint 43', state: 'future', startDate: '2026-03-21', endDate: '2026-04-03', completeDate: null },
      customfield_10014: 'VERS-2700',
      customfield_10016: 13,
    },
  },
  {
    id: '10005',
    key: 'VERS-2823',
    self: `http://localhost:${PORT}/rest/api/2/issue/10005`,
    fields: {
      summary: 'Unit Tests: PolicyService Coverage erhöhen',
      description: 'Test-Coverage für den PolicyService von aktuell 42% auf mindestens 80% erhöhen.',
      issuetype: { id: '3', name: 'Task', subtask: false },
      project: { id: '10000', key: 'VERS', name: 'Versicherung Frontend' },
      status: {
        id: '3',
        name: 'In Progress',
        statusCategory: { id: 4, key: 'indeterminate', colorName: 'yellow', name: 'In Progress' },
      },
      priority: { id: '3', name: 'Medium', iconUrl: '' },
      assignee: makeUser('dominik', 'Dominik M.', 'dominik@example.com'),
      reporter: makeUser('sarah.k', 'Sarah K.', 'sarah@example.com'),
      creator: makeUser('sarah.k', 'Sarah K.', 'sarah@example.com'),
      created: '2026-02-20T09:00:00.000+0100',
      updated: '2026-03-10T11:00:00.000+0100',
      duedate: '2026-03-25',
      resolutiondate: null,
      resolution: null,
      labels: ['testing', 'coverage'],
      components: [{ id: '10004', name: 'Testing', self: '' }],
      fixVersions: [],
      environment: null,
      timetracking: {
        originalEstimate: '2d',
        remainingEstimate: '1d',
        timeSpent: '1d',
        originalEstimateSeconds: 57600,
        remainingEstimateSeconds: 28800,
        timeSpentSeconds: 28800,
      },
      comment: { startAt: 0, maxResults: 10, total: 0, comments: [] },
      attachment: [],
      subtasks: [],
      issuelinks: [],
      parent: null,
      watches: { self: '', watchCount: 1, isWatching: true },
      votes: { self: '', votes: 0, hasVoted: false },
      customfield_10020: { id: 1, name: 'Sprint 42', state: 'active', startDate: '2026-03-07', endDate: '2026-03-20', completeDate: null },
      customfield_10014: null,
      customfield_10016: 3,
    },
  },
];

app.get('/rest/api/2/myself', (_req, res) => {
  res.json(mockUser);
});

app.get('/rest/api/2/search', (_req, res) => {
  res.json({
    startAt: 0,
    maxResults: 50,
    total: mockIssues.length,
    issues: mockIssues,
  });
});

app.listen(PORT, () => {
  console.log(`Mock Jira server running at http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Verify mock server starts and responds**

```bash
node mock-server/index.js &
sleep 1
curl -s http://localhost:6202/rest/api/2/myself | python3 -m json.tool | head -10
curl -s "http://localhost:6202/rest/api/2/search" | python3 -m json.tool | head -20
kill %1
```

Expected: JSON responses with `name: "dominik"` for `/myself` and `total: 5` for `/search`.

- [ ] **Step 3: Commit**

```bash
git add mock-server/index.js
git commit -m "feat: Add mock Jira server with full issue field set"
```

---

### Task 5: Create Express proxy

**Files:**
- Create: `proxy/index.js`

- [ ] **Step 1: Create `proxy/index.js`**

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const { JIRA_BASE_URL, JIRA_API_KEY } = process.env;

if (!JIRA_BASE_URL || !JIRA_API_KEY) {
  console.error('ERROR: JIRA_BASE_URL and JIRA_API_KEY must be set in .env');
  process.exit(1);
}

const app = express();
const PORT = 6201;

app.use(cors({ origin: 'http://localhost:6200' }));

app.use(
  '/rest',
  createProxyMiddleware({
    target: JIRA_BASE_URL,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.setHeader('Authorization', `Bearer ${JIRA_API_KEY}`);
      },
    },
  }),
);

app.listen(PORT, () => {
  console.log(`Proxy running at http://localhost:${PORT} → ${JIRA_BASE_URL}`);
});
```

- [ ] **Step 2: Verify proxy proxies through mock server**

Start both servers together:

```bash
node mock-server/index.js &
node proxy/index.js &
sleep 1
curl -s http://localhost:6201/rest/api/2/myself | python3 -m json.tool | head -10
kill %1 %2
```

Expected: `{"name": "dominik", ...}` — response proxied from mock server through the proxy.

- [ ] **Step 3: Commit**

```bash
git add proxy/index.js
git commit -m "feat: Add Express proxy server with PAT auth injection"
```

---

## Chunk 3: Angular service layer (TDD)

### Task 6: Update JiraTicket model

**Files:**
- Modify: `src/app/models/work-item.model.ts`

- [ ] **Step 1: Remove `overdue` from the `JiraTicket` interface**

In `src/app/models/work-item.model.ts`, change:

```typescript
export interface JiraTicket {
  type: 'ticket';
  id: string;
  key: string;
  summary: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: string;
  reporter: string;
  description: string;
  dueDate: string | null;
  updatedAt: string;
  url: string;
  overdue: boolean;
}
```

to:

```typescript
export interface JiraTicket {
  type: 'ticket';
  id: string;
  key: string;
  summary: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: string;
  reporter: string;
  description: string;
  dueDate: string | null;
  updatedAt: string;
  url: string;
}
```

- [ ] **Step 2: Run tests to see what breaks**

```bash
ng test --no-watch 2>&1 | tail -30
```

Expected: TypeScript errors in `work-data.service.ts` (hardcoded data has `overdue`) and `ticket-card.ts` (template uses `ticket().overdue`). Note these — they will be fixed in Tasks 9 and 10.

- [ ] **Step 3: Commit**

```bash
git add src/app/models/work-item.model.ts
git commit -m "refactor: Remove overdue field from JiraTicket model"
```

---

### Task 7: Update app.config.ts

**Files:**
- Modify: `src/app/app.config.ts`

- [ ] **Step 1: Add `provideHttpClient(withFetch())`**

Replace the contents of `src/app/app.config.ts` with:

```typescript
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
  ]
};
```

- [ ] **Step 2: Verify build compiles**

```bash
ng build 2>&1 | tail -20
```

Expected: build succeeds (TypeScript errors from `overdue` removal in service/component are expected — those get fixed in Tasks 9 and 10).

- [ ] **Step 3: Commit**

```bash
git add src/app/app.config.ts
git commit -m "feat: Configure HttpClient with withFetch for zoneless compatibility"
```

---

### Task 8: Create JiraService (TDD)

**Files:**
- Create: `src/app/services/jira.service.spec.ts`
- Create: `src/app/services/jira.service.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/services/jira.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { JiraService } from './jira.service';
import { JiraTicket } from '../models/work-item.model';

describe('JiraService', () => {
  let service: JiraService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withFetch()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(JiraService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('sends request with JQL containing currentUser()', () => {
    service.getAssignedActiveTickets().subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/rest/api/2/search'));
    expect(req.request.params.get('jql')).toContain('currentUser()');
    req.flush({ issues: [] });
  });

  it('maps a Jira issue response to a JiraTicket', () => {
    let result: JiraTicket[] | undefined;
    service.getAssignedActiveTickets().subscribe(tickets => (result = tickets));

    const req = httpMock.expectOne(r => r.url.includes('/rest/api/2/search'));
    req.flush({
      issues: [{
        id: '10001',
        key: 'VERS-1',
        self: 'http://localhost:6202/rest/api/2/issue/10001',
        fields: {
          summary: 'Test Issue',
          status: { name: 'In Progress', statusCategory: { key: 'indeterminate', name: 'In Progress' } },
          priority: { name: 'High' },
          assignee: { displayName: 'Dominik M.', name: 'dominik' },
          reporter: { displayName: 'Sarah K.' },
          description: 'Test description',
          duedate: '2026-03-20',
          updated: '2026-03-13T09:15:00.000+0000',
        },
      }],
    });

    expect(result).toEqual([{
      type: 'ticket',
      id: '10001',
      key: 'VERS-1',
      summary: 'Test Issue',
      status: 'In Progress',
      priority: 'High',
      assignee: 'Dominik M.',
      reporter: 'Sarah K.',
      description: 'Test description',
      dueDate: '2026-03-20',
      updatedAt: '2026-03-13T09:15:00.000+0000',
      url: 'http://localhost:6202/browse/VERS-1',
    }]);
  });

  it('maps null priority to Medium and null assignee to fallback string', () => {
    let result: JiraTicket[] | undefined;
    service.getAssignedActiveTickets().subscribe(tickets => (result = tickets));

    const req = httpMock.expectOne(r => r.url.includes('/rest/api/2/search'));
    req.flush({
      issues: [{
        id: '10002',
        key: 'VERS-2',
        self: 'http://localhost:6202/rest/api/2/issue/10002',
        fields: {
          summary: 'No Priority',
          status: { name: 'In Review', statusCategory: { key: 'indeterminate', name: 'In Progress' } },
          priority: null,
          assignee: null,
          reporter: null,
          description: null,
          duedate: null,
          updated: '2026-03-13T09:15:00.000+0000',
        },
      }],
    });

    expect(result![0].priority).toBe('Medium');
    expect(result![0].assignee).toBe('Unbeauftragt');
    expect(result![0].dueDate).toBeNull();
    expect(result![0].description).toBe('');
  });

  it('maps Highest priority to High and Lowest to Low', () => {
    let result: JiraTicket[] | undefined;
    service.getAssignedActiveTickets().subscribe(tickets => (result = tickets));

    const req = httpMock.expectOne(r => r.url.includes('/rest/api/2/search'));
    req.flush({
      issues: [
        {
          id: '1', key: 'A-1', self: 'http://localhost:6202/rest/api/2/issue/1',
          fields: { summary: 'A', status: { name: 'In Progress', statusCategory: { key: 'indeterminate', name: 'In Progress' } }, priority: { name: 'Highest' }, assignee: null, reporter: null, description: null, duedate: null, updated: '2026-03-13T00:00:00.000+0000' },
        },
        {
          id: '2', key: 'A-2', self: 'http://localhost:6202/rest/api/2/issue/2',
          fields: { summary: 'B', status: { name: 'In Progress', statusCategory: { key: 'indeterminate', name: 'In Progress' } }, priority: { name: 'Lowest' }, assignee: null, reporter: null, description: null, duedate: null, updated: '2026-03-13T00:00:00.000+0000' },
        },
      ],
    });

    expect(result![0].priority).toBe('High');
    expect(result![1].priority).toBe('Low');
  });

  it('propagates HTTP errors to the caller', () => {
    let error: unknown;
    service.getAssignedActiveTickets().subscribe({ error: e => (error = e) });
    const req = httpMock.expectOne(r => r.url.includes('/rest/api/2/search'));
    req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });
    expect(error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
ng test --no-watch 2>&1 | grep -E "(FAIL|PASS|Cannot find module|Error)"
```

Expected: errors about `JiraService` not existing.

- [ ] **Step 3: Implement `JiraService`**

Create `src/app/services/jira.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { JiraTicket, TicketPriority, TicketStatus } from '../models/work-item.model';
import { environment } from '../../environments/environment';

interface JiraIssueFields {
  summary: string;
  description: string | null;
  status: { name: string; statusCategory: { key: string; name: string } };
  priority: { name: string } | null;
  assignee: { displayName: string; name: string } | null;
  reporter: { displayName: string } | null;
  duedate: string | null;
  updated: string;
}

interface JiraIssueRaw {
  id: string;
  key: string;
  self: string;
  fields: JiraIssueFields;
}

interface JiraSearchResponse {
  issues: JiraIssueRaw[];
}

function mapPriority(name: string | undefined): TicketPriority {
  if (name === 'Highest' || name === 'High') return 'High';
  if (name === 'Lowest' || name === 'Low') return 'Low';
  return 'Medium';
}

@Injectable({ providedIn: 'root' })
export class JiraService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/rest/api/2`;

  getAssignedActiveTickets(): Observable<JiraTicket[]> {
    const params = new HttpParams()
      .set('jql', 'assignee = currentUser() AND statusCategory = "In Progress"')
      .set('maxResults', '50');

    return this.http
      .get<JiraSearchResponse>(`${this.baseUrl}/search`, { params })
      .pipe(map(response => response.issues.map(issue => this.mapIssue(issue))));
  }

  private mapIssue(issue: JiraIssueRaw): JiraTicket {
    const baseUrl = issue.self.split('/rest/')[0];
    return {
      type: 'ticket',
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name as TicketStatus,
      priority: mapPriority(issue.fields.priority?.name),
      assignee: issue.fields.assignee?.displayName ?? 'Unbeauftragt',
      reporter: issue.fields.reporter?.displayName ?? '',
      description: issue.fields.description ?? '',
      dueDate: issue.fields.duedate ?? null,
      updatedAt: issue.fields.updated,
      url: `${baseUrl}/browse/${issue.key}`,
    };
  }
}
```

- [ ] **Step 4: Run tests — all JiraService tests must pass**

```bash
ng test --no-watch 2>&1 | tail -30
```

Expected: all 5 JiraService tests pass. Other failures (from `overdue` removal) are still expected.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/jira.service.ts src/app/services/jira.service.spec.ts
git commit -m "feat: Add JiraService with HTTP mapping and tests"
```

---

### Task 9: Update WorkDataService (TDD)

**Files:**
- Create: `src/app/services/work-data.service.spec.ts`
- Modify: `src/app/services/work-data.service.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/services/work-data.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { of, throwError, Observable } from 'rxjs';
import { JiraTicket } from '../models/work-item.model';
import { JiraService } from './jira.service';
import { WorkDataService } from './work-data.service';

const mockTicket: JiraTicket = {
  type: 'ticket',
  id: '10001',
  key: 'VERS-1',
  summary: 'Test Issue',
  status: 'In Progress',
  priority: 'High',
  assignee: 'Dominik M.',
  reporter: 'Sarah K.',
  description: '',
  dueDate: null,
  updatedAt: '2026-03-13T09:15:00.000+0000',
  url: 'http://localhost:6202/browse/VERS-1',
};

function setup(tickets$: Observable<JiraTicket[]>): WorkDataService {
  TestBed.configureTestingModule({
    providers: [
      WorkDataService,
      { provide: JiraService, useValue: { getAssignedActiveTickets: () => tickets$ } },
    ],
  });
  return TestBed.inject(WorkDataService);
}

describe('WorkDataService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('populates tickets and clears loading on success', () => {
    const service = setup(of([mockTicket]));
    expect(service.ticketsLoading()).toBe(false);
    expect(service.ticketsError()).toBe(false);
    expect(service.tickets()).toEqual([mockTicket]);
  });

  it('sets ticketsError and clears loading on failure', () => {
    const service = setup(throwError(() => new Error('Network error')));
    expect(service.ticketsLoading()).toBe(false);
    expect(service.ticketsError()).toBe(true);
    expect(service.tickets()).toEqual([]);
  });

  it('starts with ticketsLoading true', () => {
    const service = setup(new Observable());
    expect(service.ticketsLoading()).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
ng test --no-watch 2>&1 | grep -E "ticketsLoading|ticketsError|WorkDataService" | head -20
```

Expected: errors about `ticketsLoading` and `ticketsError` not existing on `WorkDataService`.

- [ ] **Step 3: Rewrite `WorkDataService`**

Replace the full contents of `src/app/services/work-data.service.ts` with:

```typescript
import { Injectable, signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { JiraTicket, PullRequest, Todo, WorkItem } from '../models/work-item.model';
import { JiraService } from './jira.service';

@Injectable({ providedIn: 'root' })
export class WorkDataService {
  private readonly jira = inject(JiraService);

  readonly ticketsLoading = signal(true);
  readonly ticketsError = signal(false);

  private readonly tickets$ = this.jira.getAssignedActiveTickets().pipe(
    tap(() => this.ticketsLoading.set(false)),
    catchError(err => {
      console.error('Failed to load Jira tickets:', err);
      this.ticketsError.set(true);
      this.ticketsLoading.set(false);
      return of([] as JiraTicket[]);
    }),
  );

  readonly tickets = toSignal(this.tickets$, { initialValue: [] as JiraTicket[] });

  readonly pullRequests = signal<PullRequest[]>([
    {
      type: 'pr',
      id: 'pr1',
      title: 'feat: Add customer portal navigation component',
      repo: 'versicherung-frontend',
      branch: 'feature/customer-portal-nav',
      author: 'sarah.kowalski',
      status: 'Awaiting Review',
      commentCount: 2,
      updatedAt: '2026-03-13T10:30:00',
      url: 'https://bitbucket.example.com/projects/VF/repos/versicherung-frontend/pull-requests/412',
      description: 'Implementiert die neue Navigation für das Kundenportal. Beinhaltet responsive Sidebar, Breadcrumbs und Accessibility-Verbesserungen (WCAG AA).',
    },
    {
      type: 'pr',
      id: 'pr2',
      title: 'fix: Resolve SSO redirect loop on session expiry',
      repo: 'versicherung-frontend',
      branch: 'fix/sso-redirect-loop',
      author: 'thomas.bauer',
      status: 'Awaiting Review',
      commentCount: 0,
      updatedAt: '2026-03-13T08:45:00',
      url: 'https://bitbucket.example.com/projects/VF/repos/versicherung-frontend/pull-requests/415',
      description: 'Behebt den SSO-Redirect-Loop (VERS-2799). Der AuthGuard wurde angepasst, um abgelaufene Sessions korrekt zu erkennen.',
    },
    {
      type: 'pr',
      id: 'pr3',
      title: 'chore: Update Angular and dependencies to latest',
      repo: 'versicherung-shared-lib',
      branch: 'chore/dependency-updates',
      author: 'anna.lehmann',
      status: 'Changes Requested',
      commentCount: 5,
      updatedAt: '2026-03-12T15:00:00',
      url: 'https://bitbucket.example.com/projects/VF/repos/versicherung-shared-lib/pull-requests/89',
      description: 'Dependency-Updates auf die neuesten stabilen Versionen.',
    },
    {
      type: 'pr',
      id: 'pr4',
      title: 'feat: Implement SEPA mandate form with validation',
      repo: 'versicherung-frontend',
      branch: 'feature/sepa-mandate',
      author: 'michael.hoffmann',
      status: 'Approved',
      commentCount: 3,
      updatedAt: '2026-03-11T17:20:00',
      url: 'https://bitbucket.example.com/projects/VF/repos/versicherung-frontend/pull-requests/408',
      description: 'SEPA-Lastschriftmandat Formular mit vollständiger Validierung.',
    },
  ]);

  readonly todos = signal<Todo[]>([
    {
      type: 'todo',
      id: 'td1',
      title: 'Standup-Notizen vorbereiten',
      description: 'Kurze Zusammenfassung der gestrigen Arbeit und heutige Ziele für das Team-Standup um 09:30 Uhr.',
      done: false,
      createdAt: '2026-03-13T07:00:00',
    },
    {
      type: 'todo',
      id: 'td2',
      title: 'PR-Review Block im Kalender eintragen',
      description: 'Täglich 14:00-15:00 Uhr als festen Block für Code Reviews reservieren.',
      done: false,
      createdAt: '2026-03-12T16:00:00',
    },
    {
      type: 'todo',
      id: 'td3',
      title: 'API-Spec mit Thomas abstimmen',
      description: 'Offene Fragen zur Schadensmeldungs-API klären: Fehler-Codes, Rate-Limiting, Auth-Header Format.',
      done: false,
      createdAt: '2026-03-12T10:00:00',
    },
    {
      type: 'todo',
      id: 'td4',
      title: 'Code-Review Checkliste aktualisieren',
      description: 'Checkliste um Punkte für Accessibility und Performance-Budget erweitern.',
      done: true,
      createdAt: '2026-03-11T09:00:00',
    },
  ]);

  readonly selectedItem = signal<WorkItem | null>(null);
  readonly lastAddedId = signal<string | null>(null);
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;

  readonly pendingTodoCount = computed(() => this.todos().filter(t => !t.done).length);
  readonly awaitingReviewCount = computed(() => this.pullRequests().filter(pr => pr.status === 'Awaiting Review').length);

  select(item: WorkItem): void {
    this.selectedItem.set(item);
  }

  addTodo(title: string, description?: string): void {
    const todo: Todo = {
      type: 'todo',
      id: `td-${Date.now()}`,
      title,
      description: description ?? '',
      done: false,
      createdAt: new Date().toISOString(),
    };
    this.todos.update(todos => [todo, ...todos]);
    if (this.highlightTimer !== null) clearTimeout(this.highlightTimer);
    this.lastAddedId.set(todo.id);
    this.highlightTimer = setTimeout(() => this.lastAddedId.set(null), 500);
  }

  toggleTodo(id: string): void {
    this.todos.update(todos =>
      todos.map(t => t.id === id ? { ...t, done: !t.done } : t)
    );
    const updated = this.todos().find(t => t.id === id);
    if (updated && this.selectedItem()?.id === id) {
      this.selectedItem.set(updated);
    }
  }
}
```

- [ ] **Step 4: Update navigator.spec.ts to use a mock WorkDataService**

`WorkDataService` now injects `JiraService` → `HttpClient`. The navigator spec creates a `NavigatorComponent` without providing `HttpClient`, so it will throw `NullInjectorError`. Fix by providing a mock `WorkDataService` that has no HTTP dependency.

Replace the full contents of `src/app/components/navigator/navigator.spec.ts` with:

```typescript
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WorkDataService } from '../../services/work-data.service';
import { NavigatorComponent } from './navigator';

const mockWorkDataService = {
  tickets: signal([]),
  ticketsLoading: signal(false),
  ticketsError: signal(false),
  pullRequests: signal([]),
  todos: signal([]),
  selectedItem: signal(null),
  lastAddedId: signal(null),
  pendingTodoCount: signal(0),
  awaitingReviewCount: signal(0),
  select: () => {},
  addTodo: () => {},
  toggleTodo: () => {},
};

describe('NavigatorComponent – collapse logic', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [NavigatorComponent],
      providers: [
        { provide: WorkDataService, useValue: mockWorkDataService },
      ],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  it('defaults all sections to expanded when localStorage is empty', () => {
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    expect(comp.ticketsCollapsed()).toBe(false);
    expect(comp.prsCollapsed()).toBe(false);
    expect(comp.todosCollapsed()).toBe(false);
  });

  it('reads initial collapsed state from localStorage', () => {
    localStorage.setItem(
      'orbit.navigator.collapsed',
      JSON.stringify({ tickets: true, prs: false, todos: true })
    );
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    expect(comp.ticketsCollapsed()).toBe(true);
    expect(comp.prsCollapsed()).toBe(false);
    expect(comp.todosCollapsed()).toBe(true);
  });

  it('falls back to all-expanded when localStorage value is invalid JSON', () => {
    localStorage.setItem('orbit.navigator.collapsed', 'not-json');
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    expect(comp.ticketsCollapsed()).toBe(false);
    expect(comp.prsCollapsed()).toBe(false);
    expect(comp.todosCollapsed()).toBe(false);
  });

  it('persists collapsed state to localStorage when toggleTickets is called', () => {
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    comp.toggleTickets();
    TestBed.tick();
    const saved = JSON.parse(localStorage.getItem('orbit.navigator.collapsed')!);
    expect(saved.tickets).toBe(true);
  });

  it('persists collapsed state to localStorage when togglePrs is called', () => {
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    comp.togglePrs();
    TestBed.tick();
    const saved = JSON.parse(localStorage.getItem('orbit.navigator.collapsed')!);
    expect(saved.prs).toBe(true);
  });

  it('persists collapsed state to localStorage when toggleTodos is called', () => {
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    comp.toggleTodos();
    TestBed.tick();
    const saved = JSON.parse(localStorage.getItem('orbit.navigator.collapsed')!);
    expect(saved.todos).toBe(true);
  });

  it('toggles signal back to false on second call', () => {
    const fixture = TestBed.createComponent(NavigatorComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    comp.toggleTickets();
    TestBed.tick();
    comp.toggleTickets();
    TestBed.tick();
    expect(comp.ticketsCollapsed()).toBe(false);
  });
});
```

- [ ] **Step 5: Run all tests — WorkDataService tests must pass**

```bash
ng test --no-watch 2>&1 | tail -30
```

Expected: all WorkDataService and navigator tests pass. The `ticket-card.ts` failure about `overdue` is still expected — fixed next.

- [ ] **Step 6: Commit**

```bash
git add src/app/services/work-data.service.ts src/app/services/work-data.service.spec.ts src/app/components/navigator/navigator.spec.ts
git commit -m "feat: Wire WorkDataService to JiraService with loading and error signals"
```

---

## Chunk 4: UI

### Task 10: Fix ticket-card — compute overdue locally

**Files:**
- Modify: `src/app/components/ticket-card/ticket-card.ts`

- [ ] **Step 1: Replace `ticket().overdue` with a `computed()` signal**

In `src/app/components/ticket-card/ticket-card.ts`, add a `computed` import and add the `isOverdue` computed property, then update the template. Replace the full file with:

```typescript
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { JiraTicket } from '../../models/work-item.model';

@Component({
  selector: 'app-ticket-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="group w-full text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      [class]="selected()
        ? 'bg-indigo-50 border-indigo-300 shadow-sm'
        : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-sm'"
      (click)="select.emit(ticket())"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="ticket().key + ': ' + ticket().summary"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="font-mono text-xs font-semibold tracking-wide" [class]="selected() ? 'text-indigo-600' : 'text-stone-400'">
            {{ ticket().key }}
          </span>
          @if (isOverdue()) {
            <span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700">Überfällig</span>
          }
        </div>
        <a
          [href]="ticket().url"
          target="_blank"
          rel="noopener noreferrer"
          class="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-stone-400 hover:text-indigo-500 transition-opacity p-0.5 rounded"
          [attr.aria-label]="'Öffne ' + ticket().key + ' in Jira'"
          (click)="$event.stopPropagation()"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
        </a>
      </div>

      <p class="mt-1 text-sm font-medium leading-snug text-stone-800 line-clamp-2">{{ ticket().summary }}</p>

      <div class="mt-2 flex items-center gap-2 flex-wrap">
        <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium" [class]="statusClass()">
          {{ ticket().status }}
        </span>
        <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium" [class]="priorityClass()">
          {{ ticket().priority }}
        </span>
      </div>
    </button>
  `,
})
export class TicketCardComponent {
  ticket = input.required<JiraTicket>();
  selected = input(false);
  select = output<JiraTicket>();

  protected readonly isOverdue = computed(() => {
    const dueDate = this.ticket().dueDate;
    return !!dueDate && new Date(dueDate).getTime() < Date.now();
  });

  statusClass() {
    const map: Record<string, string> = {
      'In Progress': 'bg-blue-100 text-blue-700',
      'In Review': 'bg-purple-100 text-purple-700',
      'Done': 'bg-emerald-100 text-emerald-700',
      'To Do': 'bg-stone-100 text-stone-600',
    };
    return map[this.ticket().status] ?? 'bg-stone-100 text-stone-600';
  }

  priorityClass() {
    const map: Record<string, string> = {
      'High': 'bg-red-100 text-red-700',
      'Medium': 'bg-amber-100 text-amber-700',
      'Low': 'bg-stone-100 text-stone-500',
    };
    return map[this.ticket().priority] ?? 'bg-stone-100 text-stone-500';
  }
}
```

- [ ] **Step 2: Run tests — all tests must pass now**

```bash
ng test --no-watch 2>&1 | tail -30
```

Expected: all tests pass with 0 failures.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/ticket-card/ticket-card.ts
git commit -m "refactor: Compute overdue from dueDate in ticket-card instead of model field"
```

---

### Task 11: Add loading and error states to navigator

**Files:**
- Modify: `src/app/components/navigator/navigator.html`

- [ ] **Step 1: Add loading and error states to the tickets section**

In `src/app/components/navigator/navigator.html`, find the `<div id="navigator-tickets-content" ...>` block and replace it with:

```html
      <div id="navigator-tickets-content" [hidden]="ticketsCollapsed()">
        @if (data.ticketsLoading()) {
          <p class="px-1 py-2 text-xs text-stone-400" aria-live="polite">Tickets werden geladen…</p>
        } @else if (data.ticketsError()) {
          <p class="px-1 py-2 text-xs text-red-500" role="alert">Tickets konnten nicht geladen werden.</p>
        } @else {
          <ul class="space-y-1.5" role="list">
            @for (ticket of data.tickets(); track ticket.id) {
              <li>
                <app-ticket-card
                  [ticket]="ticket"
                  [selected]="isSelected(ticket)"
                  (select)="selectItem($event)"
                />
              </li>
            }
          </ul>
        }
      </div>
```

- [ ] **Step 2: Run tests**

```bash
ng test --no-watch 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/navigator/navigator.html
git commit -m "feat: Show loading and error states for Jira tickets in navigator"
```

---

### Task 12: Full integration smoke test

- [ ] **Step 1: Start all three processes**

```bash
npm start
```

Expected: terminal shows three concurrent processes starting on ports 6200, 6201, 6202.

- [ ] **Step 2: Open the browser**

Navigate to `http://localhost:6200`.

Expected:
- Navigator shows "Tickets werden geladen…" briefly
- Then shows 5 tickets loaded from the mock server via the proxy
- Tickets include VERS-2847, VERS-2801, VERS-2799, VERS-2756, VERS-2823
- VERS-2799 (duedate: 2026-03-10) shows "Überfällig" badge since it is past due
- Clicking a ticket opens the detail panel
- PRs and todos still display (hardcoded data unchanged)

- [ ] **Step 3: Test error state**

Stop the mock server (Ctrl+C on its process or `kill` it). Reload the page.

Expected: "Tickets konnten nicht geladen werden." appears in the navigator tickets section.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Complete Jira Server integration with mock server and Express proxy"
```
