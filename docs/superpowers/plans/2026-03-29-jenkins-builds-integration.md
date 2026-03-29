# Jenkins Builds Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Builds" view to Orbit that shows Jenkins CI/CD pipeline status, lets users inspect build details, read console logs with ANSI rendering, and restart builds with parameters — all without leaving Orbit.

**Architecture:** A new BFF proxy route `/jenkins/*` forwards requests to the Jenkins server with HTTP Basic Auth injection. A mock server on port 6204 provides realistic Jenkins API responses for development. An Angular `JenkinsService` (signal-based, registered with `DataRefreshService`) fetches branches and builds for configured multibranch jobs. A `BuildLogService` handles console log fetching and progressive streaming. The `ViewBuildsComponent` reuses Orbit's master-detail layout pattern (sidebar + detail area). Settings are extended with Jenkins connection fields and a dynamic job list.

**Tech Stack:** Angular 21 (zoneless, signals, OnPush), Express (proxy + mock), `http-proxy-middleware` v3, `ansi_up` v6.0.6 (ANSI→HTML), Vitest, RxJS

**Spec:** `docs/superpowers/specs/2026-03-29-jenkins-builds-integration-design.md`
**API Reference:** `docs/jenkins-integration-reference/Jenkins-Integration-Guide.md`
**Prototype:** `docs/jenkins-integration-reference/prototype.html`

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `src/app/builds/jenkins.model.ts` | TypeScript interfaces for all Jenkins API responses |
| `src/app/builds/jenkins.service.ts` | Branch/build fetching, trigger, stop, PR matching |
| `src/app/builds/build-log.service.ts` | Console log loading + progressive streaming |
| `src/app/builds/builds-sidebar/builds-sidebar.ts` | Sidebar component with branch cards grouped by job |
| `src/app/builds/builds-sidebar/builds-sidebar.html` | Sidebar template |
| `src/app/builds/build-detail/build-detail.ts` | Detail component with tabs (overview + log) |
| `src/app/builds/build-detail/build-detail.html` | Detail template |
| `src/app/builds/restart-dialog/restart-dialog.ts` | Modal with dynamic parameter form |
| `src/app/builds/restart-dialog/restart-dialog.html` | Restart dialog template |
| `src/app/builds/view-builds/view-builds.ts` | Top-level view (sidebar + detail, like view-arbeit) |
| `src/app/builds/view-builds/view-builds.html` | View template |
| `mock-server/jenkins.js` | Mock Jenkins API server on port 6204 |

### Modified files

| File | Change |
|------|--------|
| `src/app/settings/settings.model.ts` | Add `jenkins` to `connections` |
| `src/app/settings/settings.service.ts` | Add `jenkinsConfig` computed signal |
| `src/app/settings/view-settings/view-settings.ts` | Add Jenkins section logic + job list management |
| `src/app/settings/view-settings/view-settings.html` | Add Jenkins connection card + jobs UI |
| `server/routes/proxy-routes.js` | Add `/jenkins/*` proxy route |
| `server/routes/settings-routes.js` | Add Jenkins fields to validation |
| `server/index.js` | Log Jenkins proxy target on startup |
| `src/app/app.routes.ts` | Add `/builds` route |
| `src/app/shared/app-rail/app-rail.ts` | Add "Builds" nav item |
| `src/app/shared/sync-bar/sync-bar.ts` | Add `sources` input for selective refresh |
| `src/app/shared/sync-bar/sync-bar.html` | Use source-specific refresh |
| `src/app/shared/router-sync.service.ts` | Add `builds` to `activeView` |
| `package.json` | Add `mock:jenkins` script, update `start:mock` |

---

## Chunk 1: Backend Infrastructure

### Task 1: Add Jenkins to settings model

**Files:**
- Modify: `src/app/settings/settings.model.ts`

- [ ] **Step 1: Write the test**

Create `src/app/builds/jenkins.model.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createDefaultSettings } from '../settings/settings.model';

describe('settings model — Jenkins defaults', () => {
  it('includes jenkins connection with empty defaults', () => {
    const settings = createDefaultSettings();
    expect(settings.connections.jenkins).toEqual({
      baseUrl: '',
      username: '',
      apiToken: '',
      jobs: [],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --watch=false 2>&1 | grep -A 2 'jenkins'`
Expected: FAIL — `jenkins` property does not exist

- [ ] **Step 3: Update settings model**

In `src/app/settings/settings.model.ts`, add to the `OrbitSettings` interface inside `connections`:

```typescript
jenkins: {
  baseUrl: string;
  username: string;
  apiToken: string;
  jobs: JenkinsJobConfig[];
};
```

Add the interface after `OrbitSettings`:

```typescript
export interface JenkinsJobConfig {
  displayName: string;
  jobPath: string;
}
```

Update `createDefaultSettings()` — add to `connections`:

```typescript
jenkins: { baseUrl: '', username: '', apiToken: '', jobs: [] },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --watch=false 2>&1 | tail -5`
Expected: PASS

- [ ] **Step 5: Add jenkinsConfig computed to SettingsService**

In `src/app/settings/settings.service.ts`, add after the existing computed signals:

```typescript
readonly jenkinsConfig = computed(() => this._settings().connections.jenkins);
readonly jenkinsConfigured = computed(() => {
  const j = this._settings().connections.jenkins;
  return j.baseUrl.trim() !== '' && j.username.trim() !== '' && j.apiToken.trim() !== '' && j.jobs.length > 0;
});
```

- [ ] **Step 6: Run all tests**

Run: `npx ng test --watch=false 2>&1 | tail -5`
Expected: All pass (existing settings tests still green)

- [ ] **Step 7: Commit**

```bash
git add src/app/settings/settings.model.ts src/app/settings/settings.service.ts src/app/builds/jenkins.model.spec.ts
git commit -m "feat(settings): add Jenkins connection model and defaults"
```

---

### Task 2: Add Jenkins proxy route to BFF

**Files:**
- Modify: `server/routes/proxy-routes.js`
- Modify: `server/index.js`

- [ ] **Step 1: Add Jenkins proxy in proxy-routes.js**

Add after the existing Bitbucket proxy route:

```javascript
router.use('/jenkins', requireSettings, (req, res, next) => {
  const s = getSettings();
  if (!s.connections.jenkins?.baseUrl) {
    return res.status(503).json({ error: 'Jenkins not configured' });
  }
  const { username, apiToken } = s.connections.jenkins;
  const basicAuth = Buffer.from(`${username}:${apiToken}`).toString('base64');
  createProxyMiddleware({
    target: s.connections.jenkins.baseUrl,
    changeOrigin: true,
    pathRewrite: { '^/jenkins': '' },
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.setHeader('Authorization', `Basic ${basicAuth}`);
      },
      proxyRes: (proxyRes, req, res) => {
        const textSize = proxyRes.headers['x-text-size'];
        const moreData = proxyRes.headers['x-more-data'];
        if (textSize) res.setHeader('X-Text-Size', textSize);
        if (moreData) res.setHeader('X-More-Data', moreData);
      },
    },
  })(req, res, next);
});
```

- [ ] **Step 2: Log Jenkins target on startup in server/index.js**

Add after the Bitbucket log line:

```javascript
if (settings?.connections?.jenkins?.baseUrl) {
  console.log(`  /jenkins/**   → ${settings.connections.jenkins.baseUrl}`);
}
```

- [ ] **Step 3: Test manually**

Run: `npm run server` — verify no startup errors. Jenkins route won't be hit without settings, but the server should start cleanly.

- [ ] **Step 4: Commit**

```bash
git add server/routes/proxy-routes.js server/index.js
git commit -m "feat(bff): add Jenkins proxy route with Basic Auth and header passthrough"
```

---

### Task 3: Update BFF settings validation for Jenkins

**Files:**
- Modify: `server/routes/settings-routes.js`

- [ ] **Step 1: Update validation logic**

The current `REQUIRED_FIELDS` and `isConfigured()` check Jira/Bitbucket. Jenkins is optional — if `jenkins.baseUrl` is set, the other Jenkins fields must also be set. Replace `isConfigured` function:

```javascript
function isConfigured(settings) {
  if (!settings) return false;
  const coreConfigured = REQUIRED_FIELDS.every(f => {
    const val = getNestedValue(settings, f);
    return typeof val === 'string' && val.trim().length > 0;
  });
  if (!coreConfigured) return false;

  const jenkins = settings.connections?.jenkins;
  if (jenkins?.baseUrl?.trim()) {
    if (!jenkins.username?.trim() || !jenkins.apiToken?.trim()) return false;
    if (!Array.isArray(jenkins.jobs) || jenkins.jobs.length === 0) return false;
    if (jenkins.jobs.some(j => !j.displayName?.trim() || !j.jobPath?.trim())) return false;
  }

  return true;
}
```

- [ ] **Step 2: Test manually**

Start BFF, hit `GET /api/settings/status` — should still return `{ configured: true }` if Jira/Bitbucket are configured (Jenkins is optional).

- [ ] **Step 3: Commit**

```bash
git add server/routes/settings-routes.js
git commit -m "feat(bff): validate Jenkins settings when baseUrl is provided"
```

---

### Task 4: Create Jenkins mock server

**Files:**
- Create: `mock-server/jenkins.js`
- Modify: `package.json`

- [ ] **Step 1: Create mock-server/jenkins.js**

```javascript
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 6204;

app.use(cors());
app.use(express.json());

const MOCK_DELAY = parseInt(process.env.MOCK_DELAY ?? '300', 10);
app.use((_req, _res, next) => {
  setTimeout(next, MOCK_DELAY);
});

const BRANCHES = {
  'frontend-app': [
    { name: 'main', color: 'blue' },
    { name: 'develop', color: 'blue' },
    { name: 'feature%2FORBIT-189-dashboard', color: 'red' },
    { name: 'feature%2FORBIT-234-user-auth', color: 'blue' },
    { name: 'bugfix%2FORBIT-301-login-fix', color: 'blue_anime' },
  ],
  'backend-api': [
    { name: 'main', color: 'blue' },
    { name: 'develop', color: 'blue' },
    { name: 'feature%2FORBIT-210-api-cache', color: 'red' },
  ],
};

const now = Date.now();
const hour = 3600000;
const minute = 60000;

const BUILDS = {
  'frontend-app': {
    'main': [
      { number: 142, result: 'SUCCESS', timestamp: now - 12 * minute, duration: 245832, building: false },
      { number: 141, result: 'FAILURE', timestamp: now - 2 * hour, duration: 89234, building: false },
    ],
    'develop': [
      { number: 312, result: 'SUCCESS', timestamp: now - 3 * hour, duration: 198000, building: false },
    ],
    'feature%2FORBIT-189-dashboard': [
      { number: 45, result: 'FAILURE', timestamp: now - 1 * hour, duration: 178000, building: false },
    ],
    'feature%2FORBIT-234-user-auth': [
      { number: 47, result: 'SUCCESS', timestamp: now - 30 * minute, duration: 210000, building: false },
    ],
    'bugfix%2FORBIT-301-login-fix': [
      { number: 48, result: null, timestamp: now - 4 * minute, duration: 0, building: true },
    ],
  },
  'backend-api': {
    'main': [
      { number: 89, result: 'SUCCESS', timestamp: now - 2 * hour, duration: 312000, building: false },
    ],
    'develop': [
      { number: 156, result: 'SUCCESS', timestamp: now - 5 * hour, duration: 280000, building: false },
    ],
    'feature%2FORBIT-210-api-cache': [
      { number: 23, result: 'FAILURE', timestamp: now - 45 * minute, duration: 95000, building: false },
    ],
  },
};

const DESCRIPTIONS = {
  142: '<b>Release 2.4.1</b> — deployed to <a href="https://staging.example.com">staging.example.com</a>',
  45: '<b>Dashboard Feature</b> — Test-Fehler in login.spec.ts',
  89: '<b>API v3.1.0</b> — deployed to <a href="https://api-staging.example.com">api-staging</a>',
};

const STAGES = {
  142: [
    { id: '6', name: 'Checkout', status: 'SUCCESS', startTimeMillis: now - 12 * minute, durationMillis: 3200 },
    { id: '14', name: 'Build', status: 'SUCCESS', startTimeMillis: now - 12 * minute + 3200, durationMillis: 120000 },
    { id: '27', name: 'Test', status: 'SUCCESS', startTimeMillis: now - 12 * minute + 123200, durationMillis: 85000 },
    { id: '45', name: 'Deploy', status: 'SUCCESS', startTimeMillis: now - 12 * minute + 208200, durationMillis: 37632 },
  ],
  45: [
    { id: '6', name: 'Checkout', status: 'SUCCESS', startTimeMillis: now - 1 * hour, durationMillis: 2800 },
    { id: '14', name: 'Build', status: 'SUCCESS', startTimeMillis: now - 1 * hour + 2800, durationMillis: 95000 },
    { id: '27', name: 'Test', status: 'FAILED', startTimeMillis: now - 1 * hour + 97800, durationMillis: 73000 },
    { id: '45', name: 'Deploy', status: 'NOT_EXECUTED', startTimeMillis: now - 1 * hour + 170800, durationMillis: 0 },
  ],
  48: [
    { id: '6', name: 'Checkout', status: 'SUCCESS', startTimeMillis: now - 4 * minute, durationMillis: 3100 },
    { id: '14', name: 'Build', status: 'SUCCESS', startTimeMillis: now - 4 * minute + 3100, durationMillis: 110000 },
    { id: '27', name: 'Test', status: 'IN_PROGRESS', startTimeMillis: now - 4 * minute + 113100, durationMillis: 0 },
    { id: '45', name: 'Deploy', status: 'NOT_EXECUTED', startTimeMillis: 0, durationMillis: 0 },
  ],
  23: [
    { id: '6', name: 'Checkout', status: 'SUCCESS', startTimeMillis: now - 45 * minute, durationMillis: 2500 },
    { id: '14', name: 'Build', status: 'SUCCESS', startTimeMillis: now - 45 * minute + 2500, durationMillis: 60000 },
    { id: '27', name: 'Test', status: 'FAILED', startTimeMillis: now - 45 * minute + 62500, durationMillis: 32500 },
    { id: '45', name: 'Deploy', status: 'NOT_EXECUTED', startTimeMillis: 0, durationMillis: 0 },
  ],
};

const STAGE_FLOW_NODES = {
  '27_45': [
    { id: '28', name: 'Shell Script', status: 'SUCCESS', parameterDescription: 'npm run lint', durationMillis: 12000, parentNodes: ['27'] },
    { id: '31', name: 'Shell Script', status: 'FAILED', parameterDescription: 'npm test', durationMillis: 73000, parentNodes: ['28'], error: { message: 'script returned exit code 1', type: 'hudson.AbortException' } },
  ],
  '27_23': [
    { id: '28', name: 'Shell Script', status: 'SUCCESS', parameterDescription: 'mvn compile', durationMillis: 20000, parentNodes: ['27'] },
    { id: '31', name: 'Shell Script', status: 'FAILED', parameterDescription: 'mvn test', durationMillis: 12500, parentNodes: ['28'], error: { message: 'script returned exit code 1', type: 'hudson.AbortException' } },
  ],
};

const STAGE_LOGS = {
  '31_45': {
    nodeId: '31', nodeStatus: 'FAILED', length: 842, hasMore: false,
    text: '<span class="pipeline-node-31">\u001b[31mFAIL\u001b[0m src/app/login.spec.ts\n  \u001b[31m● Login component › should validate email\u001b[0m\n    Expected: true\n    Received: false\n\n    at Object.&lt;anonymous&gt; (src/app/login.spec.ts:42:18)\n</span>',
  },
  '31_23': {
    nodeId: '31', nodeStatus: 'FAILED', length: 520, hasMore: false,
    text: '<span class="pipeline-node-31">\u001b[31m[ERROR]\u001b[0m Tests run: 15, Failures: 2, Errors: 0\n\u001b[31mFailed tests:\u001b[0m\n  CacheServiceTest.testEviction\n  CacheServiceTest.testConcurrentAccess\n</span>',
  },
};

const CONSOLE_LOG = `\u001b[36m[Pipeline]\u001b[0m Start of Pipeline
\u001b[36m[Pipeline]\u001b[0m node
Running on Jenkins in /var/jenkins_home/workspace/frontend-app/main
\u001b[36m[Pipeline]\u001b[0m {
\u001b[36m[Pipeline]\u001b[0m stage
\u001b[36m[Pipeline]\u001b[0m { (Checkout)
\u001b[32m[Checkout]\u001b[0m Cloning repository https://bitbucket.example.com/scm/VF/frontend-app.git
\u001b[32m[Checkout]\u001b[0m > git fetch --tags --progress -- https://bitbucket.example.com/scm/VF/frontend-app.git
\u001b[32m[Checkout]\u001b[0m Checking out Revision abc123def456
\u001b[36m[Pipeline]\u001b[0m }
\u001b[36m[Pipeline]\u001b[0m stage
\u001b[36m[Pipeline]\u001b[0m { (Build)
\u001b[1m> npm ci\u001b[0m
added 1523 packages in 45s
\u001b[1m> npm run build\u001b[0m
\u001b[32mCompilation complete. Watching for file changes.\u001b[0m
\u001b[32m✓ Built successfully in 38.2s\u001b[0m
\u001b[36m[Pipeline]\u001b[0m }
\u001b[36m[Pipeline]\u001b[0m stage
\u001b[36m[Pipeline]\u001b[0m { (Test)
\u001b[1m> npm test\u001b[0m
\u001b[32m PASS \u001b[0m src/app/app.spec.ts
\u001b[32m PASS \u001b[0m src/app/shared/utils.spec.ts
\u001b[32m PASS \u001b[0m src/app/dashboard/dashboard.spec.ts
\u001b[32m PASS \u001b[0m src/app/auth/auth.service.spec.ts

Test Suites: \u001b[32m4 passed\u001b[0m, 4 total
Tests:       \u001b[32m23 passed\u001b[0m, 23 total
\u001b[36m[Pipeline]\u001b[0m }
\u001b[36m[Pipeline]\u001b[0m stage
\u001b[36m[Pipeline]\u001b[0m { (Deploy)
Deploying to staging.example.com...
\u001b[32mDeployment successful\u001b[0m
\u001b[36m[Pipeline]\u001b[0m }
\u001b[36m[Pipeline]\u001b[0m End of Pipeline
\u001b[32mFinished: SUCCESS\u001b[0m
`;

const CONSOLE_LOG_FAILED = `\u001b[36m[Pipeline]\u001b[0m Start of Pipeline
\u001b[36m[Pipeline]\u001b[0m node
\u001b[36m[Pipeline]\u001b[0m { (Checkout)
\u001b[32m[Checkout]\u001b[0m Cloning repository...
\u001b[36m[Pipeline]\u001b[0m }
\u001b[36m[Pipeline]\u001b[0m { (Build)
\u001b[1m> npm ci\u001b[0m
added 1523 packages in 42s
\u001b[1m> npm run build\u001b[0m
\u001b[32m✓ Built successfully\u001b[0m
\u001b[36m[Pipeline]\u001b[0m }
\u001b[36m[Pipeline]\u001b[0m { (Test)
\u001b[1m> npm test\u001b[0m
\u001b[32m PASS \u001b[0m src/app/app.spec.ts
\u001b[32m PASS \u001b[0m src/app/shared/utils.spec.ts
\u001b[31m FAIL \u001b[0m src/app/login.spec.ts
  \u001b[31m● Login component › should validate email\u001b[0m

    expect(received).toBe(expected)

    Expected: true
    Received: false

      40 |   it('should validate email', () => {
      41 |     const result = component.validateEmail('invalid');
    \u001b[31m> 42 |     expect(result).toBe(true);\u001b[0m
      43 |   });

\u001b[31mTest Suites: 1 failed\u001b[0m, 2 passed, 3 total
\u001b[31mTests:       1 failed\u001b[0m, 22 passed, 23 total
\u001b[31mERROR: npm test returned exit code 1\u001b[0m
\u001b[36m[Pipeline]\u001b[0m }
\u001b[31mFinished: FAILURE\u001b[0m
`;

let progressiveOffset = 0;

const PARAMETER_DEFINITIONS = [
  { name: 'DEPLOY_ENV', type: 'ChoiceParameterDefinition', description: 'Target environment', defaultParameterValue: { value: 'staging' }, choices: ['staging', 'production'] },
  { name: 'DRY_RUN', type: 'BooleanParameterDefinition', description: 'Skip actual deployment', defaultParameterValue: { value: true } },
  { name: 'VERSION', type: 'StringParameterDefinition', description: 'Version to deploy (leave empty for latest)', defaultParameterValue: { value: '' } },
  { name: 'RELEASE_NOTES', type: 'TextParameterDefinition', description: 'Release notes for this deployment', defaultParameterValue: { value: '' } },
  { name: 'SECRET_KEY', type: 'PasswordParameterDefinition', description: 'Deployment secret', defaultParameterValue: { value: '' } },
];

function getBranch(jobName) {
  return BRANCHES[jobName] || [];
}

function getBuilds(jobName, branchName) {
  return BUILDS[jobName]?.[branchName] || [];
}

function getBuild(jobName, branchName, buildNumber) {
  const builds = getBuilds(jobName, branchName);
  return builds.find(b => b.number === buildNumber);
}

app.get('/job/:jobName/api/json', (req, res) => {
  const branches = getBranch(req.params.jobName);
  res.json({
    jobs: branches.map(b => ({
      name: b.name,
      color: b.color,
      url: `http://localhost:${PORT}/job/${req.params.jobName}/job/${b.name}/`,
    })),
  });
});

app.get('/job/:jobName/job/:branch/api/json', (req, res) => {
  const { jobName, branch } = req.params;
  const builds = getBuilds(jobName, branch);
  const tree = req.query.tree || '';

  if (tree.includes('property')) {
    res.json({
      property: [{ parameterDefinitions: PARAMETER_DEFINITIONS }],
    });
    return;
  }

  if (tree.includes('builds')) {
    res.json({ builds: builds.map(b => ({ ...b, url: `http://localhost:${PORT}/job/${jobName}/job/${branch}/${b.number}/` })) });
    return;
  }

  const build = builds[0];
  if (!build) return res.status(404).json({ error: 'No builds' });

  res.json({
    ...build,
    description: DESCRIPTIONS[build.number] || null,
    estimatedDuration: 240000,
    url: `http://localhost:${PORT}/job/${jobName}/job/${branch}/${build.number}/`,
    actions: [
      { _class: 'hudson.model.ParametersAction', parameters: [{ name: 'DEPLOY_ENV', value: 'staging' }, { name: 'DRY_RUN', value: 'false' }] },
      { _class: 'hudson.model.CauseAction' },
    ],
  });
});

app.get('/job/:jobName/job/:branch/:buildNumber/api/json', (req, res) => {
  const { jobName, branch, buildNumber } = req.params;
  const build = getBuild(jobName, branch, parseInt(buildNumber));
  if (!build) return res.status(404).json({ error: 'Build not found' });

  res.json({
    ...build,
    description: DESCRIPTIONS[build.number] || null,
    estimatedDuration: 240000,
    url: `http://localhost:${PORT}/job/${jobName}/job/${branch}/${build.number}/`,
    actions: [
      { _class: 'hudson.model.ParametersAction', parameters: [{ name: 'DEPLOY_ENV', value: 'staging' }] },
      { _class: 'hudson.model.CauseAction' },
    ],
  });
});

app.get('/job/:jobName/job/:branch/:buildNumber/wfapi/describe', (req, res) => {
  const buildNumber = parseInt(req.params.buildNumber);
  const stages = STAGES[buildNumber];
  if (!stages) return res.json({ id: String(buildNumber), name: `#${buildNumber}`, status: 'SUCCESS', stages: [] });

  const overallStatus = stages.some(s => s.status === 'FAILED') ? 'FAILED'
    : stages.some(s => s.status === 'IN_PROGRESS') ? 'IN_PROGRESS' : 'SUCCESS';

  res.json({
    id: String(buildNumber),
    name: `#${buildNumber}`,
    status: overallStatus,
    startTimeMillis: stages[0].startTimeMillis,
    durationMillis: stages.reduce((sum, s) => sum + s.durationMillis, 0),
    stages: stages.map(s => ({ ...s, execNode: '' })),
  });
});

app.get('/job/:jobName/job/:branch/:buildNumber/execution/node/:nodeId/wfapi/describe', (req, res) => {
  const { buildNumber, nodeId } = req.params;
  const key = `${nodeId}_${buildNumber}`;
  const flowNodes = STAGE_FLOW_NODES[key];
  if (!flowNodes) return res.json({ id: nodeId, name: 'Unknown', status: 'SUCCESS', stageFlowNodes: [] });

  res.json({
    id: nodeId,
    name: 'Test',
    status: 'FAILED',
    stageFlowNodes: flowNodes,
  });
});

app.get('/job/:jobName/job/:branch/:buildNumber/execution/node/:nodeId/wfapi/log', (req, res) => {
  const { buildNumber, nodeId } = req.params;
  const key = `${nodeId}_${buildNumber}`;
  const log = STAGE_LOGS[key];
  if (!log) return res.json({ nodeId, nodeStatus: 'SUCCESS', length: 0, hasMore: false, text: '' });
  res.json(log);
});

app.get('/job/:jobName/job/:branch/:buildNumber/consoleText', (req, res) => {
  const buildNumber = parseInt(req.params.buildNumber);
  const build = Object.values(BUILDS).flatMap(job => Object.values(job).flat()).find(b => b.number === buildNumber);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  if (build?.result === 'FAILURE') {
    res.send(CONSOLE_LOG_FAILED);
  } else {
    res.send(CONSOLE_LOG);
  }
});

app.get('/job/:jobName/job/:branch/:buildNumber/logText/progressiveText', (req, res) => {
  const start = parseInt(req.query.start || '0');
  const buildNumber = parseInt(req.params.buildNumber);
  const build = Object.values(BUILDS).flatMap(job => Object.values(job).flat()).find(b => b.number === buildNumber);
  const fullLog = build?.result === 'FAILURE' ? CONSOLE_LOG_FAILED : CONSOLE_LOG;

  if (start >= fullLog.length) {
    res.setHeader('X-Text-Size', String(fullLog.length));
    res.setHeader('X-More-Data', build?.building ? 'true' : 'false');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send('');
  } else {
    const chunk = fullLog.substring(start);
    res.setHeader('X-Text-Size', String(fullLog.length));
    res.setHeader('X-More-Data', build?.building ? 'true' : 'false');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(chunk);
  }
});

app.post('/job/:jobName/job/:branch/build', (_req, res) => {
  res.status(201).setHeader('Location', `http://localhost:${PORT}/queue/item/12345/`).send();
});

app.post('/job/:jobName/job/:branch/buildWithParameters', (_req, res) => {
  res.status(201).setHeader('Location', `http://localhost:${PORT}/queue/item/12346/`).send();
});

app.post('/job/:jobName/job/:branch/:buildNumber/stop', (_req, res) => {
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Jenkins mock server running at http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Update package.json scripts**

Add `mock:jenkins` script and update `start:mock`:

```json
"mock:jenkins": "node mock-server/jenkins.js",
"start:mock": "concurrently \"ng serve --port 6200\" \"node server/index.js\" \"node mock-server/jira.js\" \"node mock-server/bitbucket.js\" \"node mock-server/jenkins.js\""
```

- [ ] **Step 3: Test mock server**

```bash
node mock-server/jenkins.js &
curl -s http://localhost:6204/job/frontend-app/api/json | head -c 200
kill %1
```

Expected: JSON with `jobs` array containing branch objects.

- [ ] **Step 4: Commit**

```bash
git add mock-server/jenkins.js package.json
git commit -m "feat: add Jenkins mock server on port 6204"
```

---

### Task 5: Install ansi_up dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install ansi_up@6.0.6
```

- [ ] **Step 2: Verify**

```bash
node -e "const AnsiUp = require('ansi_up').default; console.log('ansi_up loaded:', typeof AnsiUp)"
```

Expected: `ansi_up loaded: function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add ansi_up@6.0.6 for ANSI log rendering"
```

---

## Chunk 2: Angular Services

### Task 6: Create Jenkins model interfaces

**Files:**
- Create: `src/app/builds/jenkins.model.ts`

- [ ] **Step 1: Create the models file**

```typescript
export interface JenkinsBranch {
  name: string;
  color: string;
  url: string;
}

export interface JenkinsBuild {
  number: number;
  result: 'SUCCESS' | 'FAILURE' | 'UNSTABLE' | 'ABORTED' | 'NOT_BUILT' | null;
  timestamp: number;
  duration: number;
  url: string;
}

export interface JenkinsBuildDetail {
  number: number;
  result: 'SUCCESS' | 'FAILURE' | 'UNSTABLE' | 'ABORTED' | 'NOT_BUILT' | null;
  duration: number;
  timestamp: number;
  building: boolean;
  estimatedDuration: number;
  description: string | null;
  url: string;
  actions: JenkinsBuildAction[];
}

export interface JenkinsBuildAction {
  _class: string;
  parameters?: JenkinsBuildParameter[];
}

export interface JenkinsBuildParameter {
  name: string;
  value: string | boolean | number;
}

export type JenkinsStageStatus = 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' | 'PAUSED_PENDING_INPUT' | 'NOT_EXECUTED';

export interface JenkinsStage {
  id: string;
  name: string;
  status: JenkinsStageStatus;
  startTimeMillis: number;
  durationMillis: number;
  execNode: string;
}

export interface JenkinsRun {
  id: string;
  name: string;
  status: JenkinsStageStatus;
  startTimeMillis: number;
  endTimeMillis: number;
  durationMillis: number;
  stages: JenkinsStage[];
}

export interface JenkinsStageDetail {
  id: string;
  name: string;
  status: JenkinsStageStatus;
  stageFlowNodes: JenkinsStageFlowNode[];
}

export interface JenkinsStageFlowNode {
  id: string;
  name: string;
  status: JenkinsStageStatus;
  parameterDescription: string;
  startTimeMillis: number;
  durationMillis: number;
  parentNodes: string[];
  error?: JenkinsStageError;
}

export interface JenkinsStageError {
  message: string;
  type: string;
}

export interface JenkinsStageLog {
  nodeId: string;
  nodeStatus: string;
  length: number;
  hasMore: boolean;
  text: string;
  consoleUrl: string;
}

export type JenkinsParameterDefinition =
  | JenkinsStringParameter
  | JenkinsBooleanParameter
  | JenkinsChoiceParameter
  | JenkinsTextParameter
  | JenkinsPasswordParameter;

interface JenkinsParameterBase {
  name: string;
  description: string;
}

export interface JenkinsStringParameter extends JenkinsParameterBase {
  type: 'StringParameterDefinition';
  defaultParameterValue: { value: string };
}

export interface JenkinsBooleanParameter extends JenkinsParameterBase {
  type: 'BooleanParameterDefinition';
  defaultParameterValue: { value: boolean };
}

export interface JenkinsChoiceParameter extends JenkinsParameterBase {
  type: 'ChoiceParameterDefinition';
  defaultParameterValue: { value: string };
  choices: string[];
}

export interface JenkinsTextParameter extends JenkinsParameterBase {
  type: 'TextParameterDefinition';
  defaultParameterValue: { value: string };
}

export interface JenkinsPasswordParameter extends JenkinsParameterBase {
  type: 'PasswordParameterDefinition';
  defaultParameterValue: { value: string };
}

export interface BranchBuild {
  jobDisplayName: string;
  jobPath: string;
  branchName: string;
  branchColor: string;
  lastBuild: JenkinsBuild | null;
  prNumber: number | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/builds/jenkins.model.ts
git commit -m "feat(builds): add Jenkins API model interfaces"
```

---

### Task 7: Create JenkinsService

**Files:**
- Create: `src/app/builds/jenkins.service.ts`
- Create: `src/app/builds/jenkins.service.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { JenkinsService } from './jenkins.service';
import { SettingsService } from '../settings/settings.service';
import { DataRefreshService } from '../shared/data-refresh.service';

describe('JenkinsService', () => {
  let service: JenkinsService;
  let httpMock: HttpTestingController;

  const mockSettings = {
    jenkinsConfigured: () => true,
    jenkinsConfig: () => ({
      baseUrl: 'http://localhost:6204',
      username: 'user',
      apiToken: 'token',
      jobs: [{ displayName: 'frontend-app', jobPath: 'job/frontend-app' }],
    }),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withFetch()),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: mockSettings },
        DataRefreshService,
      ],
    });
    service = TestBed.inject(JenkinsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads branches for configured jobs', () => {
    service.loadBranches().subscribe();

    const req = httpMock.expectOne(r => r.url.includes('/jenkins/job/frontend-app/api/json'));
    expect(req.request.params.get('tree')).toContain('jobs[name,color,url]');
    req.flush({
      jobs: [
        { name: 'main', color: 'blue', url: 'http://localhost:6204/job/frontend-app/job/main/' },
      ],
    });
  });

  it('loads build detail for a branch', () => {
    service.loadBuildDetail('job/frontend-app', 'main').subscribe();

    const detailReq = httpMock.expectOne(r => r.url.includes('/jenkins/job/frontend-app/job/main/api/json'));
    detailReq.flush({
      number: 142,
      result: 'SUCCESS',
      duration: 245832,
      timestamp: Date.now(),
      building: false,
      estimatedDuration: 240000,
      description: '<b>Release</b>',
      url: 'http://localhost:6204/job/frontend-app/job/main/142/',
      actions: [],
    });

    const stagesReq = httpMock.expectOne(r => r.url.includes('wfapi/describe'));
    stagesReq.flush({ id: '142', name: '#142', status: 'SUCCESS', stages: [] });
  });

  it('triggers a build', () => {
    service.triggerBuild('job/frontend-app', 'main', {}).subscribe();
    const req = httpMock.expectOne(r => r.url.includes('buildWithParameters') && r.method === 'POST');
    req.flush(null, { status: 201, statusText: 'Created' });
  });

  it('stops a build', () => {
    service.stopBuild('job/frontend-app', 'main', 142).subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/142/stop') && r.method === 'POST');
    req.flush(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --watch=false 2>&1 | grep -A 2 'JenkinsService'`
Expected: FAIL — `JenkinsService` not found

- [ ] **Step 3: Create the service**

```typescript
import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin, Observable, of, switchMap, tap, catchError, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { SettingsService } from '../settings/settings.service';
import { DataRefreshService } from '../shared/data-refresh.service';
import { BitbucketService } from '../bitbucket/bitbucket.service';
import {
  BranchBuild,
  JenkinsBranch,
  JenkinsBuild,
  JenkinsBuildDetail,
  JenkinsParameterDefinition,
  JenkinsRun,
  JenkinsStageDetail,
  JenkinsStageLog,
} from './jenkins.model';

@Injectable({ providedIn: 'root' })
export class JenkinsService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);
  private readonly refreshService = inject(DataRefreshService);
  private readonly bitbucket = inject(BitbucketService);
  private readonly base = `${environment.proxyUrl}/jenkins`;

  private readonly _branches = signal<BranchBuild[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);

  readonly branches = this._branches.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly branchesByJob = computed(() => {
    const grouped = new Map<string, BranchBuild[]>();
    for (const b of this._branches()) {
      const list = grouped.get(b.jobDisplayName) ?? [];
      list.push(b);
      grouped.set(b.jobDisplayName, list);
    }
    for (const [key, list] of grouped) {
      list.sort((a, b) => {
        const aTime = a.lastBuild?.timestamp ?? 0;
        const bTime = b.lastBuild?.timestamp ?? 0;
        return bTime - aTime;
      });
    }
    return grouped;
  });

  constructor() {
    this.refreshService.register('jenkins', () => this.loadBranches());
  }

  loadBranches(): Observable<void> {
    if (!this.settings.jenkinsConfigured()) {
      this._branches.set([]);
      return of(undefined);
    }
    this._loading.set(true);
    this._error.set(false);

    const jobs = this.settings.jenkinsConfig().jobs;
    const requests = jobs.map(job => this.loadJobBranches(job.jobPath, job.displayName));

    return forkJoin(requests).pipe(
      map(results => results.flat()),
      tap(branches => {
        this._branches.set(this.enrichWithPrs(branches));
        this._loading.set(false);
      }),
      map(() => undefined),
      catchError(() => {
        this._error.set(true);
        this._loading.set(false);
        throw new Error('Failed to load Jenkins branches');
      }),
    );
  }

  private loadJobBranches(jobPath: string, displayName: string): Observable<BranchBuild[]> {
    const params = new HttpParams().set('tree', 'jobs[name,color,url]');
    return this.http.get<{ jobs: JenkinsBranch[] }>(`${this.base}/${jobPath}/api/json`, { params }).pipe(
      switchMap(response => {
        if (response.jobs.length === 0) return of([]);

        const buildRequests = response.jobs.map(branch =>
          this.loadLatestBuild(jobPath, branch.name).pipe(
            map(build => ({
              jobDisplayName: displayName,
              jobPath,
              branchName: branch.name,
              branchColor: branch.color,
              lastBuild: build,
              prNumber: null,
            } as BranchBuild)),
          ),
        );

        return forkJoin(buildRequests);
      }),
      catchError(() => of([])),
    );
  }

  private loadLatestBuild(jobPath: string, branch: string): Observable<JenkinsBuild | null> {
    const params = new HttpParams().set('tree', 'builds[number,result,timestamp,duration,url]{0,1}');
    return this.http.get<{ builds: JenkinsBuild[] }>(`${this.base}/${jobPath}/job/${branch}/api/json`, { params }).pipe(
      map(res => res.builds?.[0] ?? null),
      catchError(() => of(null)),
    );
  }

  private enrichWithPrs(branches: BranchBuild[]): BranchBuild[] {
    const prs = this.bitbucket.pullRequests();
    if (prs.length === 0) return branches;

    return branches.map(b => {
      const decodedBranch = decodeURIComponent(b.branchName);
      const matchingPr = prs.find(pr => pr.fromRef.displayId === decodedBranch);
      return matchingPr ? { ...b, prNumber: matchingPr.prNumber } : b;
    });
  }

  loadBuildDetail(jobPath: string, branch: string): Observable<{ detail: JenkinsBuildDetail; stages: JenkinsRun }> {
    const detailParams = new HttpParams().set('tree', 'description,result,duration,timestamp,building,estimatedDuration,number,url,actions[parameters[name,value]]');
    return this.http.get<JenkinsBuildDetail>(`${this.base}/${jobPath}/job/${branch}/api/json`, { params: detailParams }).pipe(
      switchMap(detail => {
        return this.http.get<JenkinsRun>(`${this.base}/${jobPath}/job/${branch}/${detail.number}/wfapi/describe`).pipe(
          map(stages => ({ detail, stages })),
        );
      }),
    );
  }

  loadStageDetail(jobPath: string, branch: string, buildNumber: number, stageId: string): Observable<JenkinsStageDetail> {
    return this.http.get<JenkinsStageDetail>(`${this.base}/${jobPath}/job/${branch}/${buildNumber}/execution/node/${stageId}/wfapi/describe`);
  }

  loadStageLog(jobPath: string, branch: string, buildNumber: number, nodeId: string): Observable<JenkinsStageLog> {
    return this.http.get<JenkinsStageLog>(`${this.base}/${jobPath}/job/${branch}/${buildNumber}/execution/node/${nodeId}/wfapi/log`);
  }

  loadParameters(jobPath: string, branch: string): Observable<JenkinsParameterDefinition[]> {
    const params = new HttpParams().set('tree', 'property[parameterDefinitions[name,type,description,defaultParameterValue[value],choices]]');
    return this.http.get<{ property: { parameterDefinitions?: JenkinsParameterDefinition[] }[] }>(`${this.base}/${jobPath}/job/${branch}/api/json`, { params }).pipe(
      map(res => {
        const prop = res.property?.find(p => p.parameterDefinitions);
        return prop?.parameterDefinitions ?? [];
      }),
    );
  }

  triggerBuild(jobPath: string, branch: string, params: Record<string, string>): Observable<unknown> {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      body.set(key, value);
    }
    return this.http.post(
      `${this.base}/${jobPath}/job/${branch}/buildWithParameters`,
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, observe: 'response' },
    );
  }

  stopBuild(jobPath: string, branch: string, buildNumber: number): Observable<unknown> {
    return this.http.post(`${this.base}/${jobPath}/job/${branch}/${buildNumber}/stop`, null);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --watch=false 2>&1 | tail -5`
Expected: All JenkinsService tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/builds/jenkins.service.ts src/app/builds/jenkins.service.spec.ts
git commit -m "feat(builds): add JenkinsService for branch/build fetching and actions"
```

---

### Task 8: Create BuildLogService

**Files:**
- Create: `src/app/builds/build-log.service.ts`
- Create: `src/app/builds/build-log.service.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BuildLogService } from './build-log.service';

describe('BuildLogService', () => {
  let service: BuildLogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withFetch()), provideHttpClientTesting()],
    });
    service = TestBed.inject(BuildLogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.stopStreaming();
    httpMock.verify();
  });

  it('loads full console log', () => {
    service.loadFullLog('job/frontend-app', 'main', 142);
    const req = httpMock.expectOne(r => r.url.includes('/142/consoleText'));
    req.flush('[Pipeline] Start of Pipeline\n[Pipeline] End', { headers: {} });
    expect(service.logText()).toContain('Start of Pipeline');
  });

  it('signals not streaming after full load', () => {
    service.loadFullLog('job/frontend-app', 'main', 142);
    const req = httpMock.expectOne(r => r.url.includes('consoleText'));
    req.flush('log text');
    expect(service.isStreaming()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --watch=false 2>&1 | grep -A 2 'BuildLogService'`
Expected: FAIL

- [ ] **Step 3: Create the service**

```typescript
import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BuildLogService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.proxyUrl}/jenkins`;

  private readonly _logText = signal('');
  private readonly _isStreaming = signal(false);
  private readonly _error = signal(false);

  readonly logText = this._logText.asReadonly();
  readonly isStreaming = this._isStreaming.asReadonly();
  readonly error = this._error.asReadonly();

  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private currentOffset = 0;
  private currentPath = '';

  loadFullLog(jobPath: string, branch: string, buildNumber: number): void {
    this.stopStreaming();
    this._logText.set('');
    this._error.set(false);
    this.currentPath = `${this.base}/${jobPath}/job/${branch}/${buildNumber}`;

    this.http.get(`${this.currentPath}/consoleText`, { responseType: 'text' }).subscribe({
      next: (text) => {
        this._logText.set(text);
        this.currentOffset = new Blob([text]).size;
      },
      error: () => this._error.set(true),
    });
  }

  startStreaming(jobPath: string, branch: string, buildNumber: number): void {
    this.loadFullLog(jobPath, branch, buildNumber);
    this._isStreaming.set(true);

    this.pollingTimer = setInterval(() => {
      this.http.get(`${this.currentPath}/logText/progressiveText`, {
        params: { start: String(this.currentOffset) },
        responseType: 'text',
        observe: 'response',
      }).subscribe({
        next: (response) => {
          const newText = response.body ?? '';
          if (newText.length > 0) {
            this._logText.update(current => current + newText);
          }
          const textSize = response.headers.get('X-Text-Size');
          if (textSize) this.currentOffset = parseInt(textSize, 10);

          const moreData = response.headers.get('X-More-Data');
          if (moreData !== 'true') {
            this.stopStreaming();
          }
        },
        error: () => this._error.set(true),
      });
    }, 5000);
  }

  stopStreaming(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this._isStreaming.set(false);
  }

  clear(): void {
    this.stopStreaming();
    this._logText.set('');
    this._error.set(false);
    this.currentOffset = 0;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --watch=false 2>&1 | tail -5`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/app/builds/build-log.service.ts src/app/builds/build-log.service.spec.ts
git commit -m "feat(builds): add BuildLogService with progressive log streaming"
```

---

## Chunk 3: Settings UI

### Task 9: Add Jenkins section to settings view

**Files:**
- Modify: `src/app/settings/view-settings/view-settings.ts`
- Modify: `src/app/settings/view-settings/view-settings.html`

- [ ] **Step 1: Update view-settings.ts**

Add to the `sections` array — insert a new child under `verbindungen`:

```typescript
{ id: 'jenkins', label: 'Jenkins' },
```

So the children become: `[{ id: 'jira', ... }, { id: 'bitbucket', ... }, { id: 'jenkins', label: 'Jenkins' }, { id: 'vertex-ai', ... }]`

Add show/hide token signal:

```typescript
readonly showJenkinsToken = signal(false);
```

Add job management methods:

```typescript
addJenkinsJob(): void {
  this.updateDraft(d => d.connections.jenkins.jobs.push({ displayName: '', jobPath: '' }));
}

removeJenkinsJob(index: number): void {
  this.updateDraft(d => d.connections.jenkins.jobs.splice(index, 1));
}
```

Update `canSave()` — Jenkins validation is optional (only if baseUrl is filled). Replace the existing `canSave` computed:

```typescript
readonly canSave = computed(() => {
  const d = this.draft();
  if (!this.isDirty()) return false;

  const jiraOk = d.connections.jira.baseUrl.trim() !== '' && d.connections.jira.apiKey.trim() !== '';
  const bbOk = d.connections.bitbucket.baseUrl.trim() !== '' && d.connections.bitbucket.apiKey.trim() !== '' && d.connections.bitbucket.userSlug.trim() !== '';
  if (!jiraOk || !bbOk) return false;

  const j = d.connections.jenkins;
  if (j.baseUrl.trim() !== '') {
    if (j.username.trim() === '' || j.apiToken.trim() === '') return false;
    if (j.jobs.length === 0) return false;
    if (j.jobs.some(job => job.displayName.trim() === '' || job.jobPath.trim() === '')) return false;
  }

  return true;
});
```

- [ ] **Step 2: Add Jenkins HTML section**

In `view-settings.html`, add after the Bitbucket card and before the Vertex AI card:

```html
<!-- Jenkins -->
<div data-section="jenkins" id="section-jenkins" class="bg-[var(--color-bg-card)] rounded-xl p-5 mb-4">
  <div class="flex items-center justify-between mb-4">
    <h4 class="font-bold text-[var(--color-text-heading)]">Jenkins</h4>
    <span class="text-xs px-2.5 py-0.5 rounded-full bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]">Optional</span>
  </div>

  <div class="mb-4">
    <label class="block text-sm text-[var(--color-text-body)] mb-1.5">Server-URL</label>
    <input
      type="text"
      class="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-heading)] text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400"
      placeholder="https://jenkins.example.com"
      [value]="draft().connections.jenkins.baseUrl"
      (input)="updateDraft(d => d.connections.jenkins.baseUrl = $any($event.target).value)">
  </div>

  <div class="mb-4">
    <label class="block text-sm text-[var(--color-text-body)] mb-1.5">Benutzername</label>
    <input
      type="text"
      class="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-heading)] text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400"
      [value]="draft().connections.jenkins.username"
      (input)="updateDraft(d => d.connections.jenkins.username = $any($event.target).value)">
  </div>

  <div class="mb-4">
    <label class="block text-sm text-[var(--color-text-body)] mb-1.5">API-Token</label>
    <div class="relative">
      <input
        [type]="showJenkinsToken() ? 'text' : 'password'"
        class="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-heading)] text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 pr-20"
        [value]="draft().connections.jenkins.apiToken"
        (input)="updateDraft(d => d.connections.jenkins.apiToken = $any($event.target).value)">
      <button
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-body)] transition-colors cursor-pointer"
        (click)="showJenkinsToken.set(!showJenkinsToken())">
        {{ showJenkinsToken() ? 'Verbergen' : 'Anzeigen' }}
      </button>
    </div>
    <p class="text-xs text-[var(--color-text-muted)] mt-1.5">Erstelle einen Token in deinen Jenkins-Benutzereinstellungen unter Konfigurieren → API Token</p>
  </div>

  <div class="border-t border-[var(--color-border-subtle)] pt-4">
    <label class="block text-sm text-[var(--color-text-body)] mb-2">Multibranch-Jobs</label>

    @for (job of draft().connections.jenkins.jobs; track $index) {
      <div class="flex items-center gap-2 mb-2">
        <input
          type="text"
          class="flex-1 px-3 py-2 rounded-lg bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-heading)] text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400"
          placeholder="Anzeigename"
          [value]="job.displayName"
          (input)="updateDraft(d => d.connections.jenkins.jobs[$index].displayName = $any($event.target).value)">
        <input
          type="text"
          class="flex-1 px-3 py-2 rounded-lg bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-heading)] text-sm font-mono placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400"
          placeholder="job/my-project"
          [value]="job.jobPath"
          (input)="updateDraft(d => d.connections.jenkins.jobs[$index].jobPath = $any($event.target).value)">
        <button
          type="button"
          class="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)] transition-colors cursor-pointer"
          (click)="removeJenkinsJob($index)">
          &times;
        </button>
      </div>
    }

    <button
      type="button"
      class="text-sm text-[var(--color-primary-text)] hover:underline cursor-pointer"
      (click)="addJenkinsJob()">
      + Job hinzufügen
    </button>
  </div>
</div>
```

- [ ] **Step 3: Run all tests**

Run: `npx ng test --watch=false 2>&1 | tail -5`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/view-settings/view-settings.ts src/app/settings/view-settings/view-settings.html
git commit -m "feat(settings): add Jenkins connection section with job list"
```

---

## Chunk 4: Routing & Navigation

### Task 10: Add builds route and rail item

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/shared/app-rail/app-rail.ts`
- Modify: `src/app/shared/router-sync.service.ts`

- [ ] **Step 1: Add builds route**

In `src/app/app.routes.ts`, add the import and route before the `einstellungen` route:

```typescript
import { ViewBuildsComponent } from './builds/view-builds/view-builds';
```

Add route:

```typescript
{
  path: 'builds',
  component: ViewBuildsComponent,
  children: [
    { path: '**', children: [] },
  ],
},
```

- [ ] **Step 2: Add Builds to the rail**

In `src/app/shared/app-rail/app-rail.ts`, update the `VIEWS` array:

```typescript
const VIEWS: OrbitView[] = [
  { id: 'arbeit', label: 'Arbeit' },
  { id: 'builds', label: 'Builds' },
  { id: 'logbuch', label: 'Logbuch' },
];
```

Add a new `@case` in the template's `@switch (view.id)` block, after the `arbeit` case:

```typescript
@case ('builds') {
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
  </svg>
}
```

- [ ] **Step 3: Update RouterSyncService activeView**

In `src/app/shared/router-sync.service.ts`, update the `activeView` computed to include builds:

```typescript
readonly activeView = computed<'arbeit' | 'builds' | 'logbuch' | 'einstellungen'>(() => {
  const u = this.url();
  if (u.startsWith('/builds')) return 'builds';
  if (u.startsWith('/logbuch')) return 'logbuch';
  if (u.startsWith('/einstellungen')) return 'einstellungen';
  return 'arbeit';
});
```

- [ ] **Step 4: Commit (ViewBuildsComponent doesn't exist yet — it'll be created in the next task. The route will cause a compile error until then. Commit the rail and router-sync changes first, then create the component.)**

Actually, let's create a minimal ViewBuildsComponent first to keep builds compiling. Create `src/app/builds/view-builds/view-builds.ts`:

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-view-builds',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>Builds View — coming soon</p>`,
  host: { class: 'flex flex-1 h-full overflow-hidden' },
})
export class ViewBuildsComponent {}
```

- [ ] **Step 5: Run build check**

Run: `npx ng build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/app/app.routes.ts src/app/shared/app-rail/app-rail.ts src/app/shared/router-sync.service.ts src/app/builds/view-builds/view-builds.ts
git commit -m "feat: add builds route, rail nav item, and router-sync support"
```

---

### Task 11: Add sources input to SyncBar

**Files:**
- Modify: `src/app/shared/sync-bar/sync-bar.ts`
- Modify: `src/app/shared/sync-bar/sync-bar.html`
- Modify: `src/app/shared/data-refresh.service.ts`
- Modify: `src/app/shared/navigator/navigator.html`

- [ ] **Step 1: Add refreshSources method to DataRefreshService**

In `src/app/shared/data-refresh.service.ts`, add after `refreshSource`:

```typescript
refreshSources(names: string[]): void {
  for (const name of names) {
    this.refreshSource(name);
  }
}
```

- [ ] **Step 2: Add sources input to SyncBar**

In `src/app/shared/sync-bar/sync-bar.ts`, add the import and input:

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
```

Add inside the class:

```typescript
readonly sources = input<string[]>();
```

Update `onSync()`:

```typescript
protected onSync(): void {
  const s = this.sources();
  if (s && s.length > 0) {
    this.refreshService.refreshSources(s);
  } else {
    this.refreshService.refreshAll(true);
  }
  this.refreshService.resetPollingTimer();
}
```

- [ ] **Step 3: Pass sources in navigator**

In `src/app/shared/navigator/navigator.html`, update the sync-bar at the bottom:

```html
<app-sync-bar [sources]="['jira', 'bitbucket']" />
```

- [ ] **Step 4: Run tests**

Run: `npx ng test --watch=false 2>&1 | tail -5`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/sync-bar/sync-bar.ts src/app/shared/data-refresh.service.ts src/app/shared/navigator/navigator.html
git commit -m "feat(sync-bar): add sources input for view-specific refresh"
```

---

## Chunk 5: UI Components

### Task 12: Build the Builds Sidebar

**Files:**
- Create: `src/app/builds/builds-sidebar/builds-sidebar.ts`
- Create: `src/app/builds/builds-sidebar/builds-sidebar.html`

- [ ] **Step 1: Create builds-sidebar.ts**

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { JenkinsService } from '../jenkins.service';
import { BranchBuild } from '../jenkins.model';
import { SyncBarComponent } from '../../shared/sync-bar/sync-bar';
import { BadgeComponent } from '../../shared/badge/badge';

@Component({
  selector: 'app-builds-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SyncBarComponent, BadgeComponent],
  templateUrl: './builds-sidebar.html',
  host: { class: 'flex flex-col h-full' },
})
export class BuildsSidebarComponent {
  protected readonly jenkins = inject(JenkinsService);

  readonly selectedBranch = input<string | null>(null);
  readonly branchSelect = output<BranchBuild>();

  protected readonly jobEntries = computed(() => [...this.jenkins.branchesByJob().entries()]);

  protected isSelected(branch: BranchBuild): boolean {
    return this.selectedBranch() === `${branch.jobDisplayName}/${branch.branchName}`;
  }

  protected getStatusColor(color: string): 'success' | 'danger' | 'info' {
    if (color.startsWith('red')) return 'danger';
    if (color.endsWith('_anime')) return 'info';
    return 'success';
  }

  protected getStatusLabel(color: string): string {
    if (color.startsWith('red')) return 'Fehler';
    if (color.endsWith('_anime')) return 'Läuft';
    if (color === 'yellow' || color === 'yellow_anime') return 'Instabil';
    if (color === 'aborted') return 'Abgebrochen';
    return 'Erfolg';
  }

  protected decodeBranch(name: string): string {
    return decodeURIComponent(name);
  }

  protected timeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'gerade eben';
    if (minutes < 60) return `vor ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `vor ${hours}h`;
    const days = Math.floor(hours / 24);
    return `vor ${days}d`;
  }
}
```

- [ ] **Step 2: Create builds-sidebar.html**

```html
<nav class="flex flex-col h-full" aria-label="Builds-Navigator">
  <div class="px-4 py-3 border-b border-[var(--color-border-subtle)]">
    <div class="flex items-center justify-between">
      <span class="font-semibold text-[var(--color-text-heading)] text-sm tracking-wide">Builds</span>
      <span class="text-xs text-[var(--color-text-muted)]">Deine CI/CD Pipelines</span>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto [scrollbar-gutter:stable] px-3 py-4 space-y-6">
    @if (jenkins.loading()) {
      <p class="px-1 py-2 text-xs text-[var(--color-text-muted)]" aria-live="polite">Branches werden geladen…</p>
    } @else if (jenkins.error()) {
      <div class="px-1 py-2" role="alert">
        <p class="text-xs text-[var(--color-danger-solid)]">Branches konnten nicht geladen werden.</p>
      </div>
    } @else {
      @for (entry of jobEntries(); track entry[0]) {
        <section>
          <div class="flex items-center gap-2 mb-2 px-1">
            <span class="text-xs font-semibold text-[var(--color-primary-text)] uppercase tracking-wider">{{ entry[0] }}</span>
            <orbit-badge color="primary" [counter]="true">{{ entry[1].length }}</orbit-badge>
          </div>
          <ul class="space-y-1.5" role="list">
            @for (branch of entry[1]; track branch.branchName) {
              <li>
                <button
                  type="button"
                  class="w-full text-left rounded-lg p-3 transition-colors cursor-pointer border"
                  [class.border-[var(--color-primary-border)]]="isSelected(branch)"
                  [class.bg-[var(--color-bg-surface)]]="isSelected(branch)"
                  [class.border-transparent]="!isSelected(branch)"
                  [class.bg-[var(--color-bg-card)]]="!isSelected(branch)"
                  [class.hover:bg-[var(--color-bg-surface)]]="!isSelected(branch)"
                  [class.border-l-[var(--color-danger-solid)]]="branch.branchColor.startsWith('red')"
                  [class.border-l-4]="branch.branchColor.startsWith('red')"
                  (click)="branchSelect.emit(branch)"
                >
                  <div class="text-xs font-semibold font-mono text-[var(--color-text-heading)] truncate">
                    {{ decodeBranch(branch.branchName) }}
                  </div>
                  <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    @switch (getStatusColor(branch.branchColor)) {
                      @case ('danger') {
                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] flex items-center gap-1">
                          <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-danger-solid)]"></span>
                          {{ getStatusLabel(branch.branchColor) }}
                        </span>
                      }
                      @case ('info') {
                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info-text)] flex items-center gap-1">
                          <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-info-solid)] animate-pulse"></span>
                          {{ getStatusLabel(branch.branchColor) }}
                        </span>
                      }
                      @default {
                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success-text)] flex items-center gap-1">
                          <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-success-solid)]"></span>
                          {{ getStatusLabel(branch.branchColor) }}
                        </span>
                      }
                    }
                    @if (branch.lastBuild) {
                      <span class="text-[10px] text-[var(--color-text-muted)]">
                        #{{ branch.lastBuild.number }} · {{ timeAgo(branch.lastBuild.timestamp) }}
                      </span>
                    }
                    @if (branch.prNumber) {
                      <span class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-primary-bg)] text-[var(--color-primary-text)]">
                        PR #{{ branch.prNumber }}
                      </span>
                    }
                  </div>
                </button>
              </li>
            }
          </ul>
        </section>
      }
    }
  </div>

  <app-sync-bar [sources]="['jenkins']" />
</nav>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/builds/builds-sidebar/
git commit -m "feat(builds): add builds sidebar with branch cards and job groups"
```

---

### Task 13: Build the Build Detail component

**Files:**
- Create: `src/app/builds/build-detail/build-detail.ts`
- Create: `src/app/builds/build-detail/build-detail.html`

- [ ] **Step 1: Create build-detail.ts**

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import AnsiUp from 'ansi_up';
import { JenkinsService } from '../jenkins.service';
import { BuildLogService } from '../build-log.service';
import { BranchBuild, JenkinsBuildDetail, JenkinsRun, JenkinsStage, JenkinsStageLog } from '../jenkins.model';
import { CollapsibleSectionComponent } from '../../shared/collapsible-section/collapsible-section';

@Component({
  selector: 'app-build-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CollapsibleSectionComponent],
  templateUrl: './build-detail.html',
  host: { class: 'flex flex-col h-full' },
})
export class BuildDetailComponent {
  private readonly jenkins = inject(JenkinsService);
  protected readonly logService = inject(BuildLogService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly ansi = new AnsiUp();

  readonly branch = input.required<BranchBuild>();

  protected readonly activeTab = signal<'overview' | 'log'>('overview');
  protected readonly buildDetail = signal<JenkinsBuildDetail | null>(null);
  protected readonly stages = signal<JenkinsRun | null>(null);
  protected readonly stageLogs = signal<Map<string, JenkinsStageLog>>(new Map());
  protected readonly loadingDetail = signal(false);
  protected readonly showRestartDialog = signal(false);

  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.ansi.use_classes = true;

    effect(() => {
      const b = this.branch();
      this.activeTab.set('overview');
      this.loadDetail(b);
    });
  }

  private loadDetail(b: BranchBuild): void {
    this.stopPolling();
    this.loadingDetail.set(true);
    this.stageLogs.set(new Map());
    this.logService.clear();

    this.jenkins.loadBuildDetail(b.jobPath, b.branchName).subscribe({
      next: ({ detail, stages }) => {
        this.buildDetail.set(detail);
        this.stages.set(stages);
        this.loadingDetail.set(false);
        this.loadFailedStageLogs(b, detail, stages);

        if (detail.building) {
          this.startPolling(b);
          this.logService.startStreaming(b.jobPath, b.branchName, detail.number);
        }
      },
      error: () => this.loadingDetail.set(false),
    });
  }

  private loadFailedStageLogs(b: BranchBuild, detail: JenkinsBuildDetail, run: JenkinsRun): void {
    const failedStages = run.stages.filter(s => s.status === 'FAILED');
    for (const stage of failedStages) {
      this.jenkins.loadStageDetail(b.jobPath, b.branchName, detail.number, stage.id).subscribe(stageDetail => {
        const failedNode = stageDetail.stageFlowNodes.find(n => n.error);
        if (failedNode) {
          this.jenkins.loadStageLog(b.jobPath, b.branchName, detail.number, failedNode.id).subscribe(log => {
            this.stageLogs.update(map => {
              const updated = new Map(map);
              updated.set(stage.id, log);
              return updated;
            });
          });
        }
      });
    }
  }

  private startPolling(b: BranchBuild): void {
    this.pollingTimer = setInterval(() => {
      this.jenkins.loadBuildDetail(b.jobPath, b.branchName).subscribe(({ detail, stages }) => {
        this.buildDetail.set(detail);
        this.stages.set(stages);
        if (!detail.building) {
          this.stopPolling();
          this.loadFailedStageLogs(b, detail, stages);
        }
      });
    }, 5000);
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  protected sanitizedDescription(): SafeHtml | null {
    const desc = this.buildDetail()?.description;
    if (!desc) return null;
    return this.sanitizer.bypassSecurityTrustHtml(desc);
  }

  protected stageLog(stageId: string): SafeHtml | null {
    const log = this.stageLogs().get(stageId);
    if (!log) return null;
    return this.sanitizer.bypassSecurityTrustHtml(this.ansi.ansi_to_html(log.text));
  }

  protected renderedLog(): SafeHtml {
    const raw = this.logService.logText();
    if (!raw) return '';
    const lines = raw.split('\n');
    const html = lines.map((line, i) => {
      const num = i + 1;
      const rendered = this.ansi.ansi_to_html(line);
      const isError = /\bERROR\b|\bException\b|\bFAILED\b/.test(line);
      const cls = isError ? 'border-l-2 border-l-[var(--color-danger-solid)]' : '';
      return `<div class="flex ${cls}"><span class="select-none text-[var(--color-text-muted)] w-12 text-right pr-3 shrink-0">${num}</span><span class="flex-1 whitespace-pre-wrap break-all">${rendered}</span></div>`;
    }).join('');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  protected onLoadLog(): void {
    const detail = this.buildDetail();
    const b = this.branch();
    if (!detail) return;

    if (detail.building) {
      this.logService.startStreaming(b.jobPath, b.branchName, detail.number);
    } else {
      this.logService.loadFullLog(b.jobPath, b.branchName, detail.number);
    }
  }

  protected switchTab(tab: 'overview' | 'log'): void {
    this.activeTab.set(tab);
    if (tab === 'log' && !this.logService.logText()) {
      this.onLoadLog();
    }
  }

  protected onStop(): void {
    const detail = this.buildDetail();
    const b = this.branch();
    if (!detail) return;
    this.jenkins.stopBuild(b.jobPath, b.branchName, detail.number).subscribe();
  }

  protected timeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'gerade eben';
    if (minutes < 60) return `vor ${minutes} Min.`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `vor ${hours} Std.`;
    const days = Math.floor(hours / 24);
    return `vor ${days} Tagen`;
  }

  protected formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
  }

  protected stageIcon(status: string): string {
    switch (status) {
      case 'SUCCESS': return '✓';
      case 'FAILED': return '✗';
      case 'IN_PROGRESS': return '●';
      default: return '○';
    }
  }

  protected stageSince(stage: JenkinsStage): string {
    const diff = Date.now() - stage.startTimeMillis;
    return `seit ${Math.floor(diff / 60000)} Min.`;
  }
}
```

- [ ] **Step 2: Create build-detail.html**

```html
@if (loadingDetail()) {
  <div class="flex-1 flex items-center justify-center">
    <p class="text-sm text-[var(--color-text-muted)]">Build-Details werden geladen…</p>
  </div>
} @else if (buildDetail(); as detail) {
  <!-- Header -->
  <div class="px-6 pt-6 pb-0">
    <div class="max-w-2xl mx-auto">
      <h2 class="text-lg font-bold font-mono text-[var(--color-text-heading)]">{{ decodeBranch(branch().branchName) }}</h2>
      <div class="flex items-center gap-2 mt-1 flex-wrap text-xs text-[var(--color-text-muted)]">
        <span>{{ branch().jobDisplayName }}</span>
        <span class="text-[var(--color-text-muted)]">·</span>
        <span>#{{ detail.number }}</span>
        <span class="text-[var(--color-text-muted)]">·</span>
        @if (detail.building) {
          <span class="px-2 py-0.5 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info-text)] flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-info-solid)] animate-pulse"></span>
            Läuft
          </span>
        } @else if (detail.result === 'SUCCESS') {
          <span class="px-2 py-0.5 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success-text)] flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-success-solid)]"></span>
            Erfolg
          </span>
        } @else if (detail.result === 'FAILURE') {
          <span class="px-2 py-0.5 rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-danger-solid)]"></span>
            Fehler
          </span>
        }
        <span class="text-[var(--color-text-muted)]">·</span>
        <span>{{ timeAgo(detail.timestamp) }}</span>
        @if (!detail.building && detail.duration) {
          <span class="text-[var(--color-text-muted)]">·</span>
          <span>{{ formatDuration(detail.duration) }}</span>
        }
      </div>

      <!-- Action Bar -->
      <div class="flex gap-2 mt-4 pb-4 border-b border-[var(--color-border-subtle)]">
        @if (detail.building) {
          <button
            type="button"
            class="px-4 py-1.5 text-sm rounded-lg bg-[var(--color-danger-solid)] text-white hover:opacity-90 transition-opacity cursor-pointer"
            (click)="onStop()">
            Abbrechen
          </button>
        } @else {
          <button
            type="button"
            class="px-4 py-1.5 text-sm rounded-lg bg-violet-500 text-white hover:bg-violet-600 transition-colors cursor-pointer"
            (click)="showRestartDialog.set(true)">
            Neu starten
          </button>
        }
        <a
          [href]="detail.url"
          target="_blank"
          rel="noopener"
          class="px-4 py-1.5 text-sm rounded-lg border border-[var(--color-border-subtle)] text-[var(--color-text-body)] hover:bg-[var(--color-bg-surface)] transition-colors">
          In Jenkins öffnen ↗
        </a>
      </div>

      <!-- Tabs -->
      <div class="flex gap-4 mt-4 border-b border-[var(--color-border-subtle)]">
        <button
          type="button"
          class="pb-2 text-sm font-medium transition-colors cursor-pointer"
          [class.text-[var(--color-primary-text)]]="activeTab() === 'overview'"
          [class.border-b-2]="activeTab() === 'overview'"
          [class.border-[var(--color-primary-solid)]]="activeTab() === 'overview'"
          [class.text-[var(--color-text-muted)]]="activeTab() !== 'overview'"
          (click)="switchTab('overview')">
          Übersicht
        </button>
        <button
          type="button"
          class="pb-2 text-sm font-medium transition-colors cursor-pointer"
          [class.text-[var(--color-primary-text)]]="activeTab() === 'log'"
          [class.border-b-2]="activeTab() === 'log'"
          [class.border-[var(--color-primary-solid)]]="activeTab() === 'log'"
          [class.text-[var(--color-text-muted)]]="activeTab() !== 'log'"
          (click)="switchTab('log')">
          Log
        </button>
      </div>
    </div>
  </div>

  <!-- Tab Content -->
  <div class="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
    @if (activeTab() === 'overview') {
      <div class="max-w-2xl mx-auto px-6 py-4 space-y-3">
        @if (sanitizedDescription()) {
          <app-collapsible-section label="Beschreibung" [expanded]="true">
            <div class="text-sm text-[var(--color-text-body)] leading-relaxed [&_a]:text-[var(--color-info-text)] [&_a]:underline" [innerHTML]="sanitizedDescription()"></div>
          </app-collapsible-section>
        }

        @if (stages(); as run) {
          <app-collapsible-section label="Pipeline" [expanded]="true">
            <div class="space-y-1">
              @for (stage of run.stages; track stage.id) {
                <div>
                  <div class="flex items-center gap-3 py-1.5">
                    @switch (stage.status) {
                      @case ('SUCCESS') {
                        <div class="w-[22px] h-[22px] rounded-full bg-[var(--color-success-bg)] flex items-center justify-center text-[var(--color-success-text)] text-xs shrink-0">✓</div>
                      }
                      @case ('FAILED') {
                        <div class="w-[22px] h-[22px] rounded-full bg-[var(--color-danger-bg)] flex items-center justify-center text-[var(--color-danger-text)] text-xs shrink-0">✗</div>
                      }
                      @case ('IN_PROGRESS') {
                        <div class="w-[22px] h-[22px] rounded-full bg-[var(--color-info-bg)] flex items-center justify-center text-[var(--color-info-text)] text-xs shrink-0 animate-pulse">●</div>
                      }
                      @default {
                        <div class="w-[22px] h-[22px] rounded-full bg-[var(--color-bg-surface)] flex items-center justify-center text-[var(--color-text-muted)] text-xs shrink-0 opacity-50">○</div>
                      }
                    }
                    <span class="text-sm text-[var(--color-text-body)]"
                      [class.opacity-50]="stage.status === 'NOT_EXECUTED'">{{ stage.name }}</span>
                    <span class="text-xs text-[var(--color-text-muted)] ml-auto">
                      @if (stage.status === 'IN_PROGRESS') {
                        {{ stageSince(stage) }}
                      } @else if (stage.durationMillis > 0) {
                        {{ formatDuration(stage.durationMillis) }}
                      }
                    </span>
                  </div>
                  @if (stageLog(stage.id)) {
                    <div class="ml-[34px] mb-2 rounded-lg bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] p-3 font-mono text-xs leading-relaxed overflow-x-auto" [innerHTML]="stageLog(stage.id)"></div>
                  }
                </div>
              }
            </div>
          </app-collapsible-section>
        }
      </div>
    }

    @if (activeTab() === 'log') {
      <div class="px-6 py-4">
        <div class="flex items-center justify-end mb-3">
          <a
            [href]="buildDetail()?.url + 'console'"
            target="_blank"
            rel="noopener"
            class="text-xs text-[var(--color-info-text)] hover:underline">
            In Jenkins öffnen ↗
          </a>
        </div>
        @if (logService.logText()) {
          <div class="font-mono text-xs leading-5 bg-[var(--color-bg-card)] rounded-lg border border-[var(--color-border-subtle)] p-4 overflow-x-auto" [innerHTML]="renderedLog()"></div>
        } @else {
          <p class="text-sm text-[var(--color-text-muted)]">Log wird geladen…</p>
        }
        @if (logService.isStreaming()) {
          <p class="text-xs text-[var(--color-text-muted)] mt-2 animate-pulse">Live-Log wird aktualisiert…</p>
        }
      </div>
    }
  </div>
}

@if (showRestartDialog()) {
  <app-restart-dialog
    [branch]="branch()"
    (close)="showRestartDialog.set(false)"
  />
}
```

Add the missing `decodeBranch` method and the RestartDialog import. Update the component:

In `build-detail.ts`, add to imports array:
```typescript
import { RestartDialogComponent } from '../restart-dialog/restart-dialog';
```

Add `RestartDialogComponent` to the component's `imports` array.

Add method:
```typescript
protected decodeBranch(name: string): string {
  return decodeURIComponent(name);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/builds/build-detail/
git commit -m "feat(builds): add build detail component with overview and log tabs"
```

---

### Task 14: Build the Restart Dialog

**Files:**
- Create: `src/app/builds/restart-dialog/restart-dialog.ts`
- Create: `src/app/builds/restart-dialog/restart-dialog.html`

- [ ] **Step 1: Create restart-dialog.ts**

```typescript
import { ChangeDetectionStrategy, Component, inject, input, output, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JenkinsService } from '../jenkins.service';
import { BranchBuild, JenkinsParameterDefinition } from '../jenkins.model';

@Component({
  selector: 'app-restart-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './restart-dialog.html',
  host: { class: 'fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm' },
})
export class RestartDialogComponent implements OnInit {
  private readonly jenkins = inject(JenkinsService);

  readonly branch = input.required<BranchBuild>();
  readonly close = output<void>();

  protected readonly params = signal<JenkinsParameterDefinition[]>([]);
  protected readonly values = signal<Record<string, string>>({});
  protected readonly loading = signal(true);
  protected readonly triggering = signal(false);

  ngOnInit(): void {
    const b = this.branch();
    this.jenkins.loadParameters(b.jobPath, b.branchName).subscribe({
      next: (defs) => {
        this.params.set(defs);
        const defaults: Record<string, string> = {};
        for (const p of defs) {
          defaults[p.name] = String(p.defaultParameterValue.value);
        }
        this.values.set(defaults);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected updateValue(name: string, value: string): void {
    this.values.update(v => ({ ...v, [name]: value }));
  }

  protected onSubmit(): void {
    this.triggering.set(true);
    const b = this.branch();
    this.jenkins.triggerBuild(b.jobPath, b.branchName, this.values()).subscribe({
      next: () => this.close.emit(),
      error: () => this.triggering.set(false),
    });
  }

  protected decodeBranch(name: string): string {
    return decodeURIComponent(name);
  }
}
```

- [ ] **Step 2: Create restart-dialog.html**

```html
<div class="bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col" (click)="$event.stopPropagation()">
  <div class="px-6 py-4 border-b border-[var(--color-border-subtle)]">
    <h3 class="font-semibold text-[var(--color-text-heading)]">Build neu starten</h3>
    <p class="text-sm text-[var(--color-text-muted)] mt-0.5 font-mono">{{ decodeBranch(branch().branchName) }}</p>
  </div>

  <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
    @if (loading()) {
      <p class="text-sm text-[var(--color-text-muted)]">Parameter werden geladen…</p>
    } @else if (params().length === 0) {
      <p class="text-sm text-[var(--color-text-body)]">Dieser Job hat keine Parameter. Build wird mit Standardwerten gestartet.</p>
    } @else {
      @for (param of params(); track param.name) {
        <div>
          <label class="block text-sm font-medium text-[var(--color-text-body)] mb-1">{{ param.name }}</label>
          @if (param.description) {
            <p class="text-xs text-[var(--color-text-muted)] mb-1.5">{{ param.description }}</p>
          }

          @switch (param.type) {
            @case ('BooleanParameterDefinition') {
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" class="sr-only peer"
                  [checked]="values()[param.name] === 'true'"
                  (change)="updateValue(param.name, $any($event.target).checked ? 'true' : 'false')">
                <div class="w-9 h-5 bg-[var(--color-bg-surface)] rounded-full peer peer-checked:bg-violet-500
                  after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-[var(--color-bg-card)]
                  after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4">
                </div>
              </label>
            }
            @case ('ChoiceParameterDefinition') {
              <select
                class="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-heading)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                [value]="values()[param.name]"
                (change)="updateValue(param.name, $any($event.target).value)">
                @for (choice of $any(param).choices; track choice) {
                  <option [value]="choice">{{ choice }}</option>
                }
              </select>
            }
            @case ('TextParameterDefinition') {
              <textarea
                class="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-heading)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50 resize-y min-h-[80px]"
                [value]="values()[param.name]"
                (input)="updateValue(param.name, $any($event.target).value)"></textarea>
            }
            @case ('PasswordParameterDefinition') {
              <input
                type="password"
                class="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-heading)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                [value]="values()[param.name]"
                (input)="updateValue(param.name, $any($event.target).value)">
            }
            @default {
              <input
                type="text"
                class="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-heading)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                [value]="values()[param.name]"
                (input)="updateValue(param.name, $any($event.target).value)">
            }
          }
        </div>
      }
    }
  </div>

  <div class="px-6 py-4 border-t border-[var(--color-border-subtle)] flex justify-end gap-2">
    <button
      type="button"
      class="px-4 py-2 text-sm rounded-lg text-[var(--color-text-body)] hover:bg-[var(--color-bg-surface)] transition-colors cursor-pointer"
      (click)="close.emit()">
      Abbrechen
    </button>
    <button
      type="button"
      class="px-5 py-2 text-sm rounded-lg bg-violet-500 text-white hover:bg-violet-600 transition-colors cursor-pointer font-medium"
      [disabled]="triggering()"
      (click)="onSubmit()">
      {{ triggering() ? 'Wird gestartet…' : 'Starten' }}
    </button>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/builds/restart-dialog/
git commit -m "feat(builds): add restart dialog with dynamic parameter form"
```

---

### Task 15: Wire up ViewBuildsComponent

**Files:**
- Modify: `src/app/builds/view-builds/view-builds.ts`
- Create: `src/app/builds/view-builds/view-builds.html`

- [ ] **Step 1: Rewrite view-builds.ts**

```typescript
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BuildsSidebarComponent } from '../builds-sidebar/builds-sidebar';
import { BuildDetailComponent } from '../build-detail/build-detail';
import { JenkinsService } from '../jenkins.service';
import { SettingsService } from '../../settings/settings.service';
import { BranchBuild } from '../jenkins.model';

@Component({
  selector: 'app-view-builds',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BuildsSidebarComponent, BuildDetailComponent],
  templateUrl: './view-builds.html',
  host: { class: 'flex flex-1 h-full overflow-hidden' },
})
export class ViewBuildsComponent {
  private readonly router = inject(Router);
  protected readonly settings = inject(SettingsService);
  protected readonly jenkins = inject(JenkinsService);

  readonly selectedBranch = signal<BranchBuild | null>(null);
  readonly selectedKey = signal<string | null>(null);

  protected onBranchSelect(branch: BranchBuild): void {
    this.selectedBranch.set(branch);
    this.selectedKey.set(`${branch.jobDisplayName}/${branch.branchName}`);
  }

  protected navigateToSettings(): void {
    this.router.navigate(['/einstellungen']);
  }
}
```

- [ ] **Step 2: Create view-builds.html**

```html
<aside
  class="w-[360px] xl:w-[400px] shrink-0 border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-page)] overflow-hidden flex flex-col"
  aria-label="Builds-Navigator"
>
  <app-builds-sidebar
    [selectedBranch]="selectedKey()"
    (branchSelect)="onBranchSelect($event)"
  />
</aside>

<div class="flex-1 overflow-hidden bg-[var(--color-bg-page)]">
  @if (!settings.jenkinsConfigured()) {
    <div class="flex-1 flex items-center justify-center h-full">
      <div class="text-center max-w-sm">
        <div class="w-14 h-14 rounded-2xl bg-[var(--color-primary-bg)] flex items-center justify-center mx-auto mb-4" aria-hidden="true">
          <svg class="w-7 h-7 text-[var(--color-primary-solid)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
          </svg>
        </div>
        <h2 class="text-lg font-semibold text-[var(--color-text-heading)] mb-1">Jenkins nicht konfiguriert</h2>
        <p class="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">Richte eine Jenkins-Verbindung ein, um deine Build-Pipelines hier zu sehen.</p>
        <button
          type="button"
          class="px-4 py-2 text-sm rounded-lg bg-violet-500 text-white hover:bg-violet-600 transition-colors cursor-pointer"
          (click)="navigateToSettings()">
          Verbindung einrichten →
        </button>
      </div>
    </div>
  } @else if (!selectedBranch()) {
    <div class="flex-1 flex items-center justify-center h-full">
      <div class="text-center max-w-sm">
        <div class="w-14 h-14 rounded-2xl bg-[var(--color-primary-bg)] flex items-center justify-center mx-auto mb-4" aria-hidden="true">
          <svg class="w-7 h-7 text-[var(--color-primary-solid)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
          </svg>
        </div>
        <h2 class="text-lg font-semibold text-[var(--color-text-heading)] mb-1">Build auswählen</h2>
        <p class="text-sm text-[var(--color-text-muted)] leading-relaxed">Wähle einen Branch aus der linken Spalte, um die Build-Details hier anzuzeigen.</p>
      </div>
    </div>
  } @else {
    <app-build-detail [branch]="selectedBranch()!" />
  }
</div>
```

- [ ] **Step 3: Run build**

Run: `npx ng build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/builds/view-builds/
git commit -m "feat(builds): wire up ViewBuildsComponent with sidebar, detail, and empty states"
```

---

## Chunk 6: Integration Test

### Task 16: Smoke test with mock servers

- [ ] **Step 1: Start mock servers and verify**

```bash
npm run start:mock
```

- [ ] **Step 2: Open browser and test**

Navigate to `http://localhost:6200/builds`:
1. Verify the Rail shows "Builds" as second nav item
2. Verify "Jenkins nicht konfiguriert" empty state appears
3. Go to Settings → Jenkins → configure mock server URL (`http://localhost:6204`), username, token, add a job
4. Save settings, navigate back to Builds
5. Verify branches load in sidebar grouped by job
6. Click a branch → verify detail loads with header, stages
7. Click Log tab → verify ANSI-colored console log renders
8. Click "Neu starten" → verify parameter dialog appears
9. Check failed build → verify red left-border, error log in stage
10. Check running build → verify pulsing indicator

- [ ] **Step 3: Fix any issues found during testing**

Address any visual or functional issues.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(builds): address issues found during integration testing"
```

---

## Chunk 7: ANSI CSS Classes

### Task 17: Add ansi_up CSS classes for light/dark mode

**Files:**
- Modify: `src/styles/styles.css` (or create `src/styles/ansi.css` and import it)

- [ ] **Step 1: Add ANSI color classes**

Add to the global styles (or a new `ansi.css` imported in `styles.css`):

```css
.ansi-black-fg { color: #3c3836; }
.ansi-red-fg { color: #cc241d; }
.ansi-green-fg { color: #98971a; }
.ansi-yellow-fg { color: #d79921; }
.ansi-blue-fg { color: #458588; }
.ansi-magenta-fg { color: #b16286; }
.ansi-cyan-fg { color: #689d6a; }
.ansi-white-fg { color: #a89984; }
.ansi-bright-black-fg { color: #928374; }
.ansi-bright-red-fg { color: #fb4934; }
.ansi-bright-green-fg { color: #b8bb26; }
.ansi-bright-yellow-fg { color: #fabd2f; }
.ansi-bright-blue-fg { color: #83a598; }
.ansi-bright-magenta-fg { color: #d3869b; }
.ansi-bright-cyan-fg { color: #8ec07c; }
.ansi-bright-white-fg { color: #ebdbb2; }
.ansi-bold { font-weight: bold; }

:root.light .ansi-black-fg { color: #1d2021; }
:root.light .ansi-red-fg { color: #9d0006; }
:root.light .ansi-green-fg { color: #79740e; }
:root.light .ansi-yellow-fg { color: #b57614; }
:root.light .ansi-blue-fg { color: #076678; }
:root.light .ansi-magenta-fg { color: #8f3f71; }
:root.light .ansi-cyan-fg { color: #427b58; }
:root.light .ansi-white-fg { color: #7c6f64; }
```

- [ ] **Step 2: Verify in both modes**

Toggle light/dark mode in settings, check log tab readability.

- [ ] **Step 3: Commit**

```bash
git add src/styles/
git commit -m "feat(builds): add ANSI color CSS classes for light and dark mode"
```
