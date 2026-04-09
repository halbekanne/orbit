# Jenkins Build KI-Analyse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user opens a failed Jenkins build, automatically analyze the failure using Vertex AI and display a concise diagnosis (cause, solution, evidence).

**Architecture:** New server endpoint `POST /api/ai/build-analysis` receives build context from frontend, fetches Jenkinsfile from Bitbucket (via config.xml repo-mapping), builds a prompt, calls Vertex AI, returns structured JSON. Frontend `BuildAnalysisService` manages state/cache, `BuildAnalysisComponent` renders results. Falls back to mock when Vertex AI is unconfigured.

**Tech Stack:** Angular 21 (signals, standalone, OnPush), Express.js, Vertex AI, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-04-02-jenkins-build-analysis-design.md`

---

## File Structure

**New files:**
| File | Responsibility |
|------|---------------|
| `server/build-analysis.js` | Config.xml parsing, Jenkinsfile fetching, prompt building, Vertex AI call |
| `server/routes/build-analysis-routes.js` | Express route for `POST /api/ai/build-analysis` |
| `src/app/builds/build-analysis.service.ts` | Frontend service: HTTP call, in-memory cache, state signals |
| `src/app/builds/build-analysis/build-analysis.ts` | UI component: renders analysis result, loading, error, not-configured states |

**Modified files:**
| File | Change |
|------|--------|
| `src/app/builds/jenkins.model.ts` | Add `BuildAnalysisResult` and `BuildAnalysisRequest` interfaces |
| `src/app/builds/build-detail/build-detail.ts` | Inject `BuildAnalysisService`, trigger analysis on failed builds |
| `src/app/builds/build-detail/build-detail.html` | Insert `<app-build-analysis>` in overview tab |
| `server/index.js` | Register build-analysis routes |
| `server/ai-mock.js` | Add `runMockBuildAnalysis()` with mock scenarios |
| `mock-server/jenkins.js` | Add `GET /job/{name}/config.xml` endpoint |
| `mock-server/bitbucket.js` | Add `GET /rest/api/latest/projects/{proj}/repos/{repo}/browse/{path}` endpoint |

---

### Task 1: Add TypeScript Interfaces

**Files:**

- Modify: `src/app/builds/jenkins.model.ts`

- [ ] **Step 1: Add BuildAnalysisResult and BuildAnalysisRequest interfaces**

Add at the end of `src/app/builds/jenkins.model.ts`:

```typescript
export interface BuildAnalysisRequest {
  jobPath: string;
  branch: string;
  buildNumber: number;
  failedStage: {
    name: string;
    nodeId: string;
    status: string;
    durationMillis: number;
  };
  stageLog: string;
}

export interface BuildAnalysisEvidence {
  source: 'stage-log' | 'jenkinsfile';
  snippet: string;
}

export interface BuildAnalysisResult {
  cause: string;
  solution: string;
  evidence: BuildAnalysisEvidence;
  jenkinsfileAvailable: boolean;
}

export type BuildAnalysisState =
  | { status: 'idle' }
  | { status: 'not-configured' }
  | { status: 'loading' }
  | { status: 'result'; data: BuildAnalysisResult }
  | { status: 'error'; message: string };
```

- [ ] **Step 2: Commit**

```bash
git add src/app/builds/jenkins.model.ts
git commit -m "feat(builds): add build analysis interfaces"
```

---

### Task 2: Server — Build Analysis Orchestration

**Files:**

- Create: `server/build-analysis.js`

- [ ] **Step 1: Create build-analysis.js**

```javascript
const { callAi } = require('./ai');

const repoMappingCache = new Map();

const BUILD_ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    cause: {
      type: 'STRING',
      description: 'Fehlerursache, 1-2 Sätze, extrem prägnant mit technischen Details',
    },
    solution: {
      type: 'STRING',
      description: 'Lösungsvorschlag, konkret und direkt umsetzbar',
    },
    evidence: {
      type: 'OBJECT',
      properties: {
        source: {
          type: 'STRING',
          enum: ['stage-log', 'jenkinsfile'],
          description: 'Woher der Beleg stammt',
        },
        snippet: {
          type: 'STRING',
          description: 'Relevanter Ausschnitt, wenige Zeilen',
        },
      },
      required: ['source', 'snippet'],
      propertyOrdering: ['source', 'snippet'],
    },
  },
  required: ['cause', 'solution', 'evidence'],
  propertyOrdering: ['cause', 'solution', 'evidence'],
};

function buildSystemPrompt(hasJenkinsfile) {
  const context = hasJenkinsfile
    ? 'Du erhältst das Jenkinsfile einer Pipeline und das Log einer fehlgeschlagenen Stage.'
    : 'Du erhältst das Log einer fehlgeschlagenen Stage. Das Jenkinsfile war nicht verfügbar.';

  return `Du bist ein Build-Fehler-Analyst. ${context} Analysiere die Fehlerursache.

Regeln:
- Fehlerursache: Maximal 1-2 Sätze. Extrem prägnant. Technische Details (Paketnamen, Pfade, Fehlercodes) einbauen.
- Lösungsvorschlag: Konkrete Handlungsanweisung, die der Entwickler sofort umsetzen kann. Kein "prüf ob..." sondern "mach X".
- Beleg: Exakt die relevanten Zeilen aus dem Log oder Jenkinsfile zitieren, nicht paraphrasieren. Wenige Zeilen, nur das Wesentliche.
- Sprache: Deutsch, informell (Du-Form).`;
}

function buildUserPrompt(jenkinsfile, stageName, stageLog) {
  let prompt = '';
  if (jenkinsfile) {
    prompt += `Jenkinsfile:\n---\n${jenkinsfile}\n---\n\n`;
  }
  prompt += `Fehlgeschlagene Stage: "${stageName}"\nStage-Log:\n---\n${stageLog}\n---`;
  return prompt;
}

function parseRepoMapping(configXml) {
  const browserUrlMatch = configXml.match(
    /<browser class="[^"]*BitbucketServer">\s*<url>([^<]+)<\/url>/,
  );
  const scriptPathMatch = configXml.match(/<scriptPath>([^<]+)<\/scriptPath>/);

  if (!browserUrlMatch) return null;

  const browserUrl = browserUrlMatch[1];
  const repoMatch = browserUrl.match(/\/projects\/([^/]+)\/repos\/([^/]+)/);
  if (!repoMatch) return null;

  return {
    project: repoMatch[1],
    repo: repoMatch[2],
    scriptPath: scriptPathMatch ? scriptPathMatch[1] : 'Jenkinsfile',
  };
}

async function fetchRepoMapping(jobPath, { getSettings }) {
  if (repoMappingCache.has(jobPath)) {
    return repoMappingCache.get(jobPath);
  }

  const s = getSettings();
  const jenkins = s?.connections?.jenkins;
  if (!jenkins?.baseUrl) return null;

  const { username, apiToken, baseUrl } = jenkins;
  const auth = Buffer.from(`${username}:${apiToken}`).toString('base64');

  try {
    const response = await fetch(`${baseUrl}/job/${encodeURIComponent(jobPath)}/config.xml`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const xml = await response.text();
    const mapping = parseRepoMapping(xml);
    if (mapping) {
      repoMappingCache.set(jobPath, mapping);
    }
    return mapping;
  } catch {
    return null;
  }
}

async function fetchJenkinsfile(mapping, branch, { getSettings }) {
  const s = getSettings();
  const bitbucket = s?.connections?.bitbucket;
  if (!bitbucket?.baseUrl) return null;

  const encodedPath = encodeURIComponent(mapping.scriptPath);
  const url = `${bitbucket.baseUrl}/rest/api/latest/projects/${mapping.project}/repos/${mapping.repo}/browse/${encodedPath}?at=refs/heads/${branch}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${bitbucket.apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.lines) {
      return data.lines.map((l) => l.text).join('\n');
    }
    return null;
  } catch {
    return null;
  }
}

async function runBuildAnalysis({ jobPath, branch, failedStage, stageLog }, { getSettings }) {
  const s = getSettings();
  const vertexAi = s?.connections?.vertexAi;

  const mapping = await fetchRepoMapping(jobPath, { getSettings });
  let jenkinsfile = null;
  if (mapping) {
    jenkinsfile = await fetchJenkinsfile(mapping, branch, { getSettings });
  }

  const systemPrompt = buildSystemPrompt(!!jenkinsfile);
  const userPrompt = buildUserPrompt(jenkinsfile, failedStage.name, stageLog);

  const { result } = await callAi(
    userPrompt,
    systemPrompt,
    {
      temperature: 0.2,
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingBudget: 8192, includeThoughts: false },
      responseSchema: BUILD_ANALYSIS_SCHEMA,
    },
    { vertexAi },
  );

  return {
    ...result,
    jenkinsfileAvailable: !!jenkinsfile,
  };
}

module.exports = { runBuildAnalysis, parseRepoMapping };
```

- [ ] **Step 2: Verify file was created correctly**

Run: `node -e "require('./server/build-analysis.js'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add server/build-analysis.js
git commit -m "feat(server): add build analysis orchestration with config.xml parsing"
```

---

### Task 3: Server — Build Analysis Route

**Files:**

- Create: `server/routes/build-analysis-routes.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create build-analysis-routes.js**

```javascript
const { Router, json } = require('express');
const { runBuildAnalysis } = require('../build-analysis');
const { runMockBuildAnalysis } = require('../ai-mock');

function createBuildAnalysisRoutes({ getSettings }) {
  const router = Router();

  router.post('/api/ai/build-analysis', json({ limit: '2mb' }), async (req, res) => {
    const { jobPath, branch, buildNumber, failedStage, stageLog } = req.body;
    if (!jobPath || !branch || !buildNumber || !failedStage || !stageLog) {
      return res
        .status(400)
        .json({ error: 'jobPath, branch, buildNumber, failedStage and stageLog are required' });
    }

    try {
      const s = getSettings();
      const vertexAi = s?.connections?.vertexAi;
      if (vertexAi?.url) {
        const result = await runBuildAnalysis(req.body, { getSettings });
        return res.json(result);
      } else {
        const result = await runMockBuildAnalysis();
        return res.json(result);
      }
    } catch (err) {
      console.error('[Build Analysis] Error:', err);
      return res.status(500).json({ error: 'Analyse fehlgeschlagen: ' + err.message });
    }
  });

  return router;
}

module.exports = { createBuildAnalysisRoutes };
```

- [ ] **Step 2: Register route in server/index.js**

Add import at the top of `server/index.js`, after the existing `createAiRoutes` import:

```javascript
const { createBuildAnalysisRoutes } = require('./routes/build-analysis-routes');
```

Add route registration after `app.use(createAiRoutes({ getSettings }));`:

```javascript
app.use(createBuildAnalysisRoutes({ getSettings }));
```

- [ ] **Step 3: Verify server starts**

Run: `node server/index.js` (Ctrl+C after it starts)
Expected: `Server running at http://localhost:6201`

- [ ] **Step 4: Commit**

```bash
git add server/routes/build-analysis-routes.js server/index.js
git commit -m "feat(server): add build analysis route POST /api/ai/build-analysis"
```

---

### Task 4: Mock — Build Analysis Scenarios

**Files:**

- Modify: `server/ai-mock.js`
- Modify: `mock-server/jenkins.js`
- Modify: `mock-server/bitbucket.js`

- [ ] **Step 1: Add mock build analysis to server/ai-mock.js**

Add at the end of the file, before the final `module.exports`:

```javascript
const BUILD_ANALYSIS_SCENARIOS = [
  {
    cause:
      'npm-Dependency @angular/core@19.2.0 nicht auflösbar — Version existiert nicht in der Registry.',
    solution:
      'Korrigiere die Version in package.json auf 19.1.4 und generiere package-lock.json neu mit npm install.',
    evidence: {
      source: 'stage-log',
      snippet:
        '[10:23:15] npm ERR! ERESOLVE could not resolve\nnpm ERR! Found: @angular/core@19.2.0\nnpm ERR! No matching version found for @angular/core@19.2.0',
    },
    jenkinsfileAvailable: true,
  },
  {
    cause:
      'Unit-Test LoginComponent fehlgeschlagen — erwarteter Redirect zu /dashboard, tatsächlich /home.',
    solution:
      'Passe den erwarteten Redirect-Pfad im Test login.component.spec.ts auf /home an, oder korrigiere die Route in app.routes.ts.',
    evidence: {
      source: 'stage-log',
      snippet:
        'FAILED LoginComponent > should redirect after login\n  Expected: "/dashboard"\n  Received: "/home"',
    },
    jenkinsfileAvailable: true,
  },
  {
    cause:
      'Deploy-Server test-server-03.internal:8443 nicht erreichbar — Connection refused nach 3 Versuchen.',
    solution: 'Prüfe ob test-server-03 läuft und Port 8443 offen ist. Starte den Build danach neu.',
    evidence: {
      source: 'stage-log',
      snippet:
        '[14:24:23] ERROR: Connection refused: test-server-03.internal:8443\n[14:24:23] ERROR: Deploy failed after 3 retries',
    },
    jenkinsfileAvailable: false,
  },
];

async function runMockBuildAnalysis() {
  await delay(1500, 2500);
  const scenario =
    BUILD_ANALYSIS_SCENARIOS[Math.floor(Math.random() * BUILD_ANALYSIS_SCENARIOS.length)];
  return { ...scenario };
}
```

Update the `module.exports` to include `runMockBuildAnalysis`:

```javascript
module.exports = { runMockReview, setSkipDelays, runMockBuildAnalysis };
```

- [ ] **Step 2: Add config.xml endpoint to mock-server/jenkins.js**

Add before the `app.use((req, res, next) => {` main router (right before line 264):

```javascript
const CONFIG_XML = `<?xml version="1.0" encoding="UTF-8"?>
<org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject>
  <sources class="jenkins.branch.MultiBranchProject$BranchSourceList">
    <data>
      <jenkins.branch.BranchSource>
        <source class="jenkins.plugins.git.GitSCMSource">
          <remote>ssh://git@localhost:7999/proj/my-repo.git</remote>
          <traits>
            <jenkins.plugins.git.traits.GitBrowserSCMSourceTrait>
              <browser class="hudson.plugins.git.browser.BitbucketServer">
                <url>http://localhost:6203/projects/PROJ/repos/my-repo/</url>
              </browser>
            </jenkins.plugins.git.traits.GitBrowserSCMSourceTrait>
          </traits>
        </source>
      </jenkins.branch.BranchSource>
    </data>
  </sources>
  <factory class="org.jenkinsci.plugins.workflow.multibranch.WorkflowBranchProjectFactory">
    <scriptPath>Jenkinsfile</scriptPath>
  </factory>
</org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject>`;

app.get('/job/:jobName/config.xml', (_req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.send(CONFIG_XML);
});
```

- [ ] **Step 3: Add Jenkinsfile browse endpoint to mock-server/bitbucket.js**

Add a new route handler for the browse endpoint. Find an appropriate location in the bitbucket mock (after existing route handlers) and add:

```javascript
app.get('/rest/api/latest/projects/:project/repos/:repo/browse/:path(*)', (req, res) => {
  const mockJenkinsfile = `pipeline {
  agent any
  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }
    stage('Install') {
      steps {
        sh 'npm ci'
      }
    }
    stage('Build') {
      steps {
        sh 'npm run build'
      }
    }
    stage('Test') {
      steps {
        sh 'npm run test -- --ci --coverage'
      }
    }
    stage('Deploy') {
      steps {
        sh './scripts/deploy.sh'
      }
    }
  }
}`;
  res.json({
    lines: mockJenkinsfile.split('\n').map((text, i) => ({ text, line: i + 1 })),
    start: 0,
    size: mockJenkinsfile.split('\n').length,
    isLastPage: true,
  });
});
```

- [ ] **Step 4: Verify mocks load**

Run: `node -e "require('./server/ai-mock.js'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add server/ai-mock.js mock-server/jenkins.js mock-server/bitbucket.js
git commit -m "feat(mocks): add build analysis mock scenarios and Jenkins/Bitbucket endpoints"
```

---

### Task 5: Frontend — BuildAnalysisService

**Files:**

- Create: `src/app/builds/build-analysis.service.ts`

- [ ] **Step 1: Create the service**

```typescript
import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { SettingsService } from '../settings/settings.service';
import { BuildAnalysisRequest, BuildAnalysisResult, BuildAnalysisState } from './jenkins.model';

@Injectable({ providedIn: 'root' })
export class BuildAnalysisService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);
  private readonly baseUrl = `${environment.proxyUrl}/api/ai/build-analysis`;
  private readonly cache = new Map<string, BuildAnalysisResult>();

  readonly state = signal<BuildAnalysisState>({ status: 'idle' });

  private cacheKey(req: BuildAnalysisRequest): string {
    return `${req.jobPath}/${req.branch}/${req.buildNumber}`;
  }

  analyze(req: BuildAnalysisRequest): void {
    const vertexAi = this.settings.vertexAiConfig();
    if (!vertexAi.url.trim()) {
      this.state.set({ status: 'not-configured' });
      return;
    }

    const key = this.cacheKey(req);
    const cached = this.cache.get(key);
    if (cached) {
      this.state.set({ status: 'result', data: cached });
      return;
    }

    this.state.set({ status: 'loading' });

    this.http.post<BuildAnalysisResult>(this.baseUrl, req).subscribe({
      next: (result) => {
        this.cache.set(key, result);
        this.state.set({ status: 'result', data: result });
      },
      error: (err) => {
        const message = err.error?.error ?? 'Analyse fehlgeschlagen';
        this.state.set({ status: 'error', message });
      },
    });
  }

  reanalyze(req: BuildAnalysisRequest): void {
    const key = this.cacheKey(req);
    this.cache.delete(key);
    this.analyze(req);
  }

  reset(): void {
    this.state.set({ status: 'idle' });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/builds/build-analysis.service.ts
git commit -m "feat(builds): add BuildAnalysisService with cache and state management"
```

---

### Task 6: Frontend — BuildAnalysisComponent

**Files:**

- Create: `src/app/builds/build-analysis/build-analysis.ts`

- [ ] **Step 1: Create the component**

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { BuildAnalysisService } from '../build-analysis.service';
import { BuildAnalysisRequest } from '../jenkins.model';
import { BadgeComponent } from '../../shared/badge/badge';

@Component({
  selector: 'app-build-analysis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `
    @switch (analysisService.state().status) {
      @case ('not-configured') {
        <div
          class="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5"
        >
          <div class="flex items-center gap-2 mb-3">
            <span
              class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
              >KI-Analyse</span
            >
            <orbit-badge color="primary" size="sm">Beta</orbit-badge>
          </div>
          <p class="text-sm text-[var(--color-text-muted)] mb-3">
            Vertex AI ist nicht konfiguriert.
          </p>
          <button
            type="button"
            class="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-all bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-body)] hover:border-[var(--color-border-default)] hover:shadow-sm active:scale-[0.97]"
            (click)="openSettings()"
          >
            Einstellungen öffnen
          </button>
        </div>
      }
      @case ('loading') {
        <div
          class="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5"
        >
          <div class="flex items-center gap-2 mb-3">
            <span
              class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
              >KI-Analyse</span
            >
            <orbit-badge color="primary" size="sm">Beta</orbit-badge>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-[var(--color-primary-solid)] animate-pulse"></span>
            <span class="text-sm text-[var(--color-text-muted)]"
              >Fehlerursache wird analysiert…</span
            >
          </div>
        </div>
      }
      @case ('result') {
        <div
          class="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] overflow-hidden"
        >
          <div
            class="flex items-center gap-2 px-5 py-3 border-b border-[var(--color-border-subtle)]"
          >
            <span
              class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
              >KI-Analyse</span
            >
            <orbit-badge color="primary" size="sm">Beta</orbit-badge>
          </div>
          <div class="px-5 py-4 space-y-4">
            <div>
              <h4
                class="text-xs font-semibold text-[var(--color-text-heading)] uppercase tracking-wider mb-1"
              >
                Ursache
              </h4>
              <p class="text-sm text-[var(--color-text-body)] leading-relaxed">
                {{ result().cause }}
              </p>
            </div>
            <div>
              <h4
                class="text-xs font-semibold text-[var(--color-text-heading)] uppercase tracking-wider mb-1"
              >
                Lösung
              </h4>
              <p class="text-sm text-[var(--color-text-body)] leading-relaxed">
                {{ result().solution }}
              </p>
            </div>
            <div>
              <h4
                class="text-xs font-semibold text-[var(--color-text-heading)] uppercase tracking-wider mb-1"
              >
                Betroffene Stelle
              </h4>
              <div
                class="rounded-lg bg-[var(--color-bg-page)] border border-[var(--color-danger-border)] border-l-4 border-l-[var(--color-danger-solid)] overflow-hidden"
              >
                <div
                  class="p-3 text-xs font-mono text-[var(--color-text-body)] whitespace-pre-wrap leading-5"
                >
                  {{ result().evidence.snippet }}
                </div>
              </div>
              <span class="text-[10px] text-[var(--color-text-muted)] mt-1 block"
                >Quelle:
                {{ result().evidence.source === 'stage-log' ? 'Stage-Log' : 'Jenkinsfile' }}</span
              >
            </div>
          </div>
          <div
            class="flex items-center justify-between px-5 py-2.5 border-t border-[var(--color-border-subtle)]"
          >
            <span class="text-[10px] text-[var(--color-text-muted)]">
              @if (!result().jenkinsfileAvailable) {
                Analyse ohne Jenkinsfile-Kontext
              } @else {
                Analysiert: Stage-Log + Jenkinsfile
              }
            </span>
            <button
              type="button"
              class="px-2 py-0.5 rounded text-[10px] bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)] cursor-pointer hover:text-[var(--color-text-heading)] transition-colors"
              (click)="onReanalyze()"
            >
              ↻ Neu analysieren
            </button>
          </div>
        </div>
      }
      @case ('error') {
        <div
          class="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5"
        >
          <div class="flex items-center gap-2 mb-3">
            <span
              class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
              >KI-Analyse</span
            >
            <orbit-badge color="primary" size="sm">Beta</orbit-badge>
          </div>
          <p class="text-sm text-[var(--color-danger-text)] mb-3">{{ errorMessage() }}</p>
          <button
            type="button"
            class="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-all bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-body)] hover:border-[var(--color-border-default)] hover:shadow-sm active:scale-[0.97]"
            (click)="onReanalyze()"
          >
            Erneut versuchen
          </button>
        </div>
      }
    }
  `,
})
export class BuildAnalysisComponent {
  protected readonly analysisService = inject(BuildAnalysisService);
  private readonly router = inject(Router);

  readonly request = input.required<BuildAnalysisRequest>();

  protected readonly result = computed(() => {
    const state = this.analysisService.state();
    return state.status === 'result' ? state.data : null!;
  });

  protected readonly errorMessage = computed(() => {
    const state = this.analysisService.state();
    return state.status === 'error' ? state.message : '';
  });

  protected openSettings(): void {
    this.router.navigate(['/settings']);
  }

  protected onReanalyze(): void {
    this.analysisService.reanalyze(this.request());
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/builds/build-analysis/build-analysis.ts
git commit -m "feat(builds): add BuildAnalysisComponent with all UI states"
```

---

### Task 7: Frontend — Integrate into BuildDetailComponent

**Files:**

- Modify: `src/app/builds/build-detail/build-detail.ts`
- Modify: `src/app/builds/build-detail/build-detail.html`

- [ ] **Step 1: Update build-detail.ts**

Add imports at the top of `build-detail.ts`:

```typescript
import { BuildAnalysisService } from '../build-analysis.service';
import { BuildAnalysisComponent } from '../build-analysis/build-analysis';
import { BuildAnalysisRequest } from '../jenkins.model';
```

Add `BuildAnalysisComponent` to the `imports` array in the `@Component` decorator:

```typescript
imports: [CollapsibleSectionComponent, RestartDialogComponent, BadgeComponent, BuildAnalysisComponent],
```

Add service injection after existing injects:

```typescript
protected readonly analysisService = inject(BuildAnalysisService);
```

Add a signal for the analysis request and a computed for whether to show analysis:

```typescript
readonly analysisRequest = signal<BuildAnalysisRequest | null>(null);
```

In the `loadFailedStageLogs` method, after loading stage logs for failed stages, trigger the build analysis. Replace the entire `loadFailedStageLogs` method:

```typescript
private loadFailedStageLogs(b: BranchBuild, detail: JenkinsBuildDetail, run: JenkinsRun): void {
  const failedStages = run.stages.filter(s => s.status === 'FAILED');
  for (const stage of failedStages) {
    this.jenkins.loadStageDetail(b.jobPath, b.branchName, detail.number, stage.id).subscribe({
      next: (stageDetail) => {
        const failedNode = stageDetail.stageFlowNodes.find(n => n.status === 'FAILED');
        if (!failedNode) return;
        this.jenkins.loadStageLog(b.jobPath, b.branchName, detail.number, failedNode.id).subscribe({
          next: (log) => {
            this.stageLogs.update(m => {
              const next = new Map(m);
              next.set(stage.id, log);
              return next;
            });
            if (!this.analysisRequest()) {
              const stripped = log.text.replace(/<[^>]+>/g, '');
              const req: BuildAnalysisRequest = {
                jobPath: b.jobPath,
                branch: b.branchName,
                buildNumber: detail.number,
                failedStage: {
                  name: stage.name,
                  nodeId: failedNode.id,
                  status: stage.status,
                  durationMillis: stage.durationMillis,
                },
                stageLog: stripped,
              };
              this.analysisRequest.set(req);
              this.analysisService.analyze(req);
            }
          },
        });
      },
    });
  }
}
```

In the `loadDetail` method, reset analysis state at the beginning (after `this.logService.clear();`):

```typescript
this.analysisService.reset();
this.analysisRequest.set(null);
```

- [ ] **Step 2: Update build-detail.html**

Insert the build analysis component in the overview tab, between the description section and the pipeline section. After the closing `}` of the description `@if` block (after line 92) and before `@if (stages(); as run)` (line 94), add:

```html
@if (analysisRequest(); as req) {
<app-build-analysis [request]="req" />
}
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx ng build --configuration development 2>&1 | tail -5`
Expected: Build should succeed

- [ ] **Step 4: Commit**

```bash
git add src/app/builds/build-detail/build-detail.ts src/app/builds/build-detail/build-detail.html
git commit -m "feat(builds): integrate build analysis into build detail view"
```

---

### Task 8: Unit Tests

**Files:**

- Create: `src/app/builds/build-analysis.service.spec.ts`
- Create: `server/build-analysis.spec.js`

- [ ] **Step 1: Create frontend service test**

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BuildAnalysisService } from './build-analysis.service';
import { SettingsService } from '../settings/settings.service';
import { BuildAnalysisRequest, BuildAnalysisResult } from './jenkins.model';

describe('BuildAnalysisService', () => {
  let service: BuildAnalysisService;
  let httpMock: HttpTestingController;
  let settingsService: SettingsService;

  const mockRequest: BuildAnalysisRequest = {
    jobPath: 'frontend-app',
    branch: 'feature/test',
    buildNumber: 42,
    failedStage: { name: 'Test', nodeId: '5', status: 'FAILED', durationMillis: 45000 },
    stageLog: 'npm ERR! test failed',
  };

  const mockResult: BuildAnalysisResult = {
    cause: 'Test failed',
    solution: 'Fix the test',
    evidence: { source: 'stage-log', snippet: 'npm ERR! test failed' },
    jenkinsfileAvailable: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BuildAnalysisService);
    httpMock = TestBed.inject(HttpTestingController);
    settingsService = TestBed.inject(SettingsService);
  });

  afterEach(() => httpMock.verify());

  it('should set not-configured when vertex AI url is empty', () => {
    service.analyze(mockRequest);
    expect(service.state().status).toBe('not-configured');
  });

  it('should fetch analysis and cache result', () => {
    (settingsService as any)._settings.set({
      ...settingsService.settings(),
      connections: {
        ...settingsService.settings().connections,
        vertexAi: { url: 'http://vertex.test', customHeaders: [] },
      },
    });

    service.analyze(mockRequest);
    expect(service.state().status).toBe('loading');

    const req = httpMock.expectOne('http://localhost:6201/api/ai/build-analysis');
    req.flush(mockResult);
    TestBed.tick();

    expect(service.state().status).toBe('result');

    service.analyze(mockRequest);
    httpMock.expectNone('http://localhost:6201/api/ai/build-analysis');
    expect(service.state().status).toBe('result');
  });

  it('should clear cache on reanalyze', () => {
    (settingsService as any)._settings.set({
      ...settingsService.settings(),
      connections: {
        ...settingsService.settings().connections,
        vertexAi: { url: 'http://vertex.test', customHeaders: [] },
      },
    });

    service.analyze(mockRequest);
    httpMock.expectOne('http://localhost:6201/api/ai/build-analysis').flush(mockResult);
    TestBed.tick();

    service.reanalyze(mockRequest);
    expect(service.state().status).toBe('loading');
    httpMock.expectOne('http://localhost:6201/api/ai/build-analysis').flush(mockResult);
  });

  it('should set error state on failure', () => {
    (settingsService as any)._settings.set({
      ...settingsService.settings(),
      connections: {
        ...settingsService.settings().connections,
        vertexAi: { url: 'http://vertex.test', customHeaders: [] },
      },
    });

    service.analyze(mockRequest);
    httpMock
      .expectOne('http://localhost:6201/api/ai/build-analysis')
      .flush(
        { error: 'Vertex AI nicht erreichbar' },
        { status: 500, statusText: 'Internal Server Error' },
      );
    TestBed.tick();

    const state = service.state();
    expect(state.status).toBe('error');
  });
});
```

- [ ] **Step 2: Create server-side parseRepoMapping test**

```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parseRepoMapping } = require('./build-analysis');

describe('parseRepoMapping', () => {
  it('extracts project, repo and scriptPath from config.xml', () => {
    const xml = `<root>
      <sources><data><jenkins.branch.BranchSource>
        <source><traits>
          <jenkins.plugins.git.traits.GitBrowserSCMSourceTrait>
            <browser class="hudson.plugins.git.browser.BitbucketServer">
              <url>https://git.example.com/projects/DSYS/repos/design-system/</url>
            </browser>
          </jenkins.plugins.git.traits.GitBrowserSCMSourceTrait>
        </traits></source>
      </jenkins.branch.BranchSource></data></sources>
      <factory><scriptPath>Jenkinsfile</scriptPath></factory>
    </root>`;

    const result = parseRepoMapping(xml);
    assert.deepStrictEqual(result, {
      project: 'DSYS',
      repo: 'design-system',
      scriptPath: 'Jenkinsfile',
    });
  });

  it('defaults scriptPath to Jenkinsfile when missing', () => {
    const xml = `<root>
      <sources><data><jenkins.branch.BranchSource>
        <source><traits>
          <jenkins.plugins.git.traits.GitBrowserSCMSourceTrait>
            <browser class="hudson.plugins.git.browser.BitbucketServer">
              <url>https://git.example.com/projects/PROJ/repos/my-repo/</url>
            </browser>
          </jenkins.plugins.git.traits.GitBrowserSCMSourceTrait>
        </traits></source>
      </jenkins.branch.BranchSource></data></sources>
    </root>`;

    const result = parseRepoMapping(xml);
    assert.strictEqual(result.scriptPath, 'Jenkinsfile');
  });

  it('returns null when no BitbucketServer browser found', () => {
    const xml = `<root><sources><data></data></sources></root>`;
    assert.strictEqual(parseRepoMapping(xml), null);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/app/builds/build-analysis.service.spec.ts`
Expected: All tests pass

Run: `node --test server/build-analysis.spec.js`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/app/builds/build-analysis.service.spec.ts server/build-analysis.spec.js
git commit -m "test(builds): add unit tests for BuildAnalysisService and parseRepoMapping"
```

---

### Task 9: End-to-End Verification

- [ ] **Step 1: Start all services**

Run in separate terminals or background:

```bash
node mock-server/jenkins.js &
node mock-server/bitbucket.js &
node server/index.js &
npx ng serve
```

- [ ] **Step 2: Verify mock config.xml endpoint**

Run: `curl -s http://localhost:6204/job/frontend-app/config.xml | head -5`
Expected: XML output starting with `<?xml version`

- [ ] **Step 3: Verify mock Jenkinsfile browse endpoint**

Run: `curl -s 'http://localhost:6203/rest/api/latest/projects/PROJ/repos/my-repo/browse/Jenkinsfile' | head -3`
Expected: JSON with `lines` array

- [ ] **Step 4: Verify build analysis endpoint (mock mode)**

Run: `curl -s -X POST http://localhost:6201/api/ai/build-analysis -H 'Content-Type: application/json' -d '{"jobPath":"frontend-app","branch":"feature/test","buildNumber":42,"failedStage":{"name":"Test","nodeId":"5","status":"FAILED","durationMillis":45000},"stageLog":"npm ERR test failed"}' | python3 -m json.tool`
Expected: JSON with `cause`, `solution`, `evidence` fields

- [ ] **Step 5: Manual UI verification**

Open http://localhost:6200 → Builds → Click on a failed build (red status).
Verify:

1. KI-Analyse section appears in Overview tab with loading animation
2. After ~2s, analysis result shows: Ursache, Lösung, Betroffene Stelle
3. "Neu analysieren" button works
4. Navigating away and back shows cached result instantly
5. Footer shows whether Jenkinsfile was available
