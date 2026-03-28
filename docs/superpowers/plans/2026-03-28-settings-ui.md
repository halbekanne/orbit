# Settings UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings UI as a third view in Orbit, backed by `~/.orbit/settings.json`, replacing all `.env`-based configuration. Includes an onboarding welcome screen for first-time users and renaming all CoSi references to AI/VertexAI.

**Architecture:** New `settings-routes.js` on the server reads/writes `~/.orbit/settings.json`. New `SettingsService` in the frontend provides signals for all settings. `ViewSettingsComponent` renders the settings form. `WelcomeScreenComponent` gates the app when settings are missing. Existing services (Theme, Pomodoro, Bitbucket, Jira, CoSi→AI) are updated to read from `SettingsService`.

**Tech Stack:** Angular 21 (signals, standalone, OnPush), Express 5, Tailwind CSS 4, Vitest

**Spec:** `docs/superpowers/specs/2026-03-28-settings-ui-design.md`

---

### Task 1: Server — Settings Routes

**Files:**
- Create: `server/routes/settings-routes.js`
- Modify: `server/lib/json-store.js` (add `readJsonObject` that returns `null` instead of `[]` on missing file)

- [ ] **Step 1: Add `readJsonObject` to json-store**

In `server/lib/json-store.js`, add a function that returns `null` for missing files (unlike `readJson` which returns `[]`):

```js
async function readJsonObject(file) {
  try {
    const data = await fsp.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}
```

Export it alongside existing functions:

```js
module.exports = { ORBIT_DIR, TICKETS_DIR, readJson, readJsonObject, writeJson };
```

- [ ] **Step 2: Create settings-routes.js**

```js
const { Router, json } = require('express');
const path = require('path');
const { ORBIT_DIR, readJsonObject, writeJson } = require('../lib/json-store');

const SETTINGS_FILE = path.join(ORBIT_DIR, 'settings.json');

const REQUIRED_FIELDS = [
  'connections.jira.baseUrl',
  'connections.jira.apiKey',
  'connections.bitbucket.baseUrl',
  'connections.bitbucket.apiKey',
  'connections.bitbucket.userSlug',
];

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function isConfigured(settings) {
  if (!settings) return false;
  return REQUIRED_FIELDS.every(f => {
    const val = getNestedValue(settings, f);
    return typeof val === 'string' && val.trim().length > 0;
  });
}

function createSettingsRoutes() {
  const router = Router();

  router.get('/api/settings/status', async (_req, res) => {
    const settings = await readJsonObject(SETTINGS_FILE);
    res.json({ configured: isConfigured(settings) });
  });

  router.get('/api/settings', async (_req, res) => {
    const settings = await readJsonObject(SETTINGS_FILE);
    if (!settings) return res.json({ exists: false });
    res.json(settings);
  });

  router.put('/api/settings', json(), async (req, res) => {
    const settings = req.body;
    const missing = REQUIRED_FIELDS.filter(f => {
      const val = getNestedValue(settings, f);
      return !val || typeof val !== 'string' || val.trim().length === 0;
    });
    if (missing.length > 0) {
      return res.status(400).json({ error: 'Missing required fields', fields: missing });
    }
    await writeJson(SETTINGS_FILE, settings);
    res.json(settings);
  });

  return router;
}

module.exports = { createSettingsRoutes, SETTINGS_FILE, isConfigured };
```

- [ ] **Step 3: Verify manually**

Run: `node -e "require('./server/routes/settings-routes.js')"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add server/lib/json-store.js server/routes/settings-routes.js
git commit -m "feat: add settings-routes with GET/PUT/status endpoints"
```

---

### Task 2: Server — Replace `.env` with `settings.json`

**Files:**
- Modify: `server/index.js`
- Modify: `server/routes/proxy-routes.js`

- [ ] **Step 1: Rewrite `server/index.js`**

Remove `dotenv`, load settings from JSON, pass to routes. Server must start even without settings (user configures via UI):

```js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createProxyRoutes } = require('./routes/proxy-routes');
const { createReviewRoutes } = require('./routes/review-routes');
const localDataRoutes = require('./routes/local-data-routes');
const { createSettingsRoutes, SETTINGS_FILE } = require('./routes/settings-routes');
const { readJsonObject } = require('./lib/json-store');

let settings = null;

async function loadSettings() {
  settings = await readJsonObject(SETTINGS_FILE);
  return settings;
}

function getSettings() {
  return settings;
}

(async () => {
  await loadSettings();

  const app = express();
  const PORT = 6201;

  app.use(cors({ origin: 'http://localhost:6200' }));
  app.use(createSettingsRoutes());
  app.use(createReviewRoutes({ getSettings }));
  app.use(express.json());
  app.use(createProxyRoutes({ getSettings }));
  app.use(localDataRoutes);

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    if (settings?.connections?.jira?.baseUrl) {
      console.log(`  /jira/**      → ${settings.connections.jira.baseUrl}`);
    }
    if (settings?.connections?.bitbucket?.baseUrl) {
      console.log(`  /bitbucket/** → ${settings.connections.bitbucket.baseUrl}`);
    }
    if (!settings) {
      console.log('  No settings.json found — configure via UI');
    }
  });
})();
```

- [ ] **Step 2: Update `proxy-routes.js`**

Change from static env vars to dynamic `getSettings()`. Remove `/config` endpoint. Return `503` when not configured:

```js
const { Router } = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

function parseDiffStats(diffText) {
  let additions = 0;
  let deletions = 0;
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++;
    else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
  }
  return { additions, deletions, total: additions + deletions };
}

function createProxyRoutes({ getSettings }) {
  const router = Router();

  const requireSettings = (req, res, next) => {
    const s = getSettings();
    if (!s?.connections) return res.status(503).json({ error: 'Settings not configured' });
    next();
  };

  router.get('/bitbucket/diffstat/:projectKey/:repoSlug/:prId', requireSettings, async (req, res) => {
    const s = getSettings();
    const { projectKey, repoSlug, prId } = req.params;
    const url = `${s.connections.bitbucket.baseUrl}/rest/api/latest/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}.diff`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${s.connections.bitbucket.apiKey}` },
      });
      if (!response.ok) return res.status(response.status).json({ error: `Bitbucket responded with ${response.status}` });
      const diffText = await response.text();
      res.json(parseDiffStats(diffText));
    } catch (err) {
      res.status(502).json({ error: 'Failed to fetch diff from Bitbucket' });
    }
  });

  router.use('/jira', requireSettings, (req, res, next) => {
    const s = getSettings();
    createProxyMiddleware({
      target: s.connections.jira.baseUrl,
      changeOrigin: true,
      pathRewrite: { '^/jira': '' },
      on: {
        proxyReq: (proxyReq) => {
          proxyReq.setHeader('Authorization', `Bearer ${s.connections.jira.apiKey}`);
        },
      },
    })(req, res, next);
  });

  router.use('/bitbucket', requireSettings, (req, res, next) => {
    const s = getSettings();
    createProxyMiddleware({
      target: s.connections.bitbucket.baseUrl,
      changeOrigin: true,
      pathRewrite: { '^/bitbucket': '' },
      on: {
        proxyReq: (proxyReq) => {
          proxyReq.setHeader('Authorization', `Bearer ${s.connections.bitbucket.apiKey}`);
        },
      },
    })(req, res, next);
  });

  return router;
}

module.exports = { createProxyRoutes };
```

- [ ] **Step 3: Delete `.env.example`**

```bash
rm .env.example
```

- [ ] **Step 4: Remove `dotenv` dependency**

```bash
npm uninstall dotenv
```

- [ ] **Step 5: Verify server starts without settings**

Run: `node server/index.js`
Expected: Server starts, logs "No settings.json found — configure via UI"

- [ ] **Step 6: Commit**

```bash
git add server/index.js server/routes/proxy-routes.js package.json package-lock.json
git rm .env.example
git commit -m "feat: replace .env with settings.json for all server config"
```

---

### Task 3: Server — Rename CoSi to AI

**Files:**
- Rename: `server/cosi.js` → `server/ai.js`
- Rename: `server/cosi-mock.js` → `server/ai-mock.js`
- Rename: `server/cosi.test.js` → `server/ai.test.js`
- Rename: `server/cosi-mock.test.js` → `server/ai-mock.test.js`
- Modify: `server/routes/review-routes.js` → `server/routes/ai-routes.js`
- Modify: `server/index.js`

- [ ] **Step 1: Rename server files**

```bash
git mv server/cosi.js server/ai.js
git mv server/cosi-mock.js server/ai-mock.js
git mv server/cosi.test.js server/ai.test.js
git mv server/cosi-mock.test.js server/ai-mock.test.js
git mv server/routes/review-routes.js server/routes/ai-routes.js
```

- [ ] **Step 2: Update `server/routes/ai-routes.js`**

Update imports and read Vertex AI config from settings:

```js
const { Router, json } = require('express');
const { runReview } = require('../ai');
const { runMockReview } = require('../ai-mock');

function createAiRoutes({ getSettings }) {
  const router = Router();

  router.post('/api/ai/review', json({ limit: '2mb' }), async (req, res) => {
    const { diff, jiraTicket } = req.body;
    if (!diff || typeof diff !== 'string') {
      return res.status(400).json({ error: 'diff is required and must be a string' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const emit = (eventType, data) => {
      res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const s = getSettings();
      const vertexAi = s?.connections?.vertexAi;
      if (vertexAi?.url) {
        await runReview(diff, jiraTicket || null, emit, { vertexAi });
      } else {
        await runMockReview(emit);
      }
    } catch (err) {
      console.error('[AI Review] Error:', err);
      emit('error', { message: 'Review fehlgeschlagen: ' + err.message });
    }

    res.end();
  });

  return router;
}

module.exports = { createAiRoutes };
```

- [ ] **Step 3: Update `server/ai.js`**

Update the `runReview` function signature to accept `{ vertexAi }` options. Replace hard-coded CoSi URL/key with `vertexAi.url` and `vertexAi.customHeaders`. Find the existing `fetch` call in `server/ai.js` that calls the CoSi API and update:
- URL: `vertexAi.url + ':generateContent'` instead of the hard-coded CoSi URL
- Headers: Iterate over `vertexAi.customHeaders` and set each `{ name, value }` pair as a request header, instead of the hard-coded `x-api-key` header
- Remove any `COSI_API_KEY` or `COSI_BASE_URL` references

- [ ] **Step 4: Update `server/index.js`**

Replace the review-routes import:

```js
const { createAiRoutes } = require('./routes/ai-routes');
```

And in the route registration:

```js
app.use(createAiRoutes({ getSettings }));
```

- [ ] **Step 5: Update test files**

In `server/ai.test.js` and `server/ai-mock.test.js`, update `require` paths from `'../cosi'`/`'../cosi-mock'` to `'../ai'`/`'../ai-mock'`.

- [ ] **Step 6: Run server tests**

Run: `npx vitest run server/ --reporter=verbose`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: rename cosi to ai throughout server"
```

---

### Task 4: Frontend — Rename CoSi to AI

**Files:**
- Rename: `src/app/services/cosi-review.service.ts` → `src/app/services/ai-review.service.ts`
- Rename: `src/app/services/cosi-review.service.spec.ts` → `src/app/services/ai-review.service.spec.ts`
- Modify: `src/app/components/pr-detail/pr-detail.ts`
- Modify: `src/app/components/pr-detail/pr-detail.spec.ts`
- Modify: `src/app/components/detail-action-bar/detail-action-bar.ts`
- Modify: `src/app/components/detail-action-bar/detail-action-bar.spec.ts`
- Modify: `src/app/components/review-findings/review-findings.ts`
- Modify: `src/app/components/review-findings/review-findings.spec.ts`
- Modify: `src/app/views/view-arbeit/view-arbeit.spec.ts`

- [ ] **Step 1: Rename service files**

```bash
git mv src/app/services/cosi-review.service.ts src/app/services/ai-review.service.ts
git mv src/app/services/cosi-review.service.spec.ts src/app/services/ai-review.service.spec.ts
```

- [ ] **Step 2: Update the service class**

In `src/app/services/ai-review.service.ts`:
- Rename class `CosiReviewService` → `AiReviewService`
- Change `baseUrl` from `/api/cosi/review` to `/api/ai/review`

```ts
@Injectable({ providedIn: 'root' })
export class AiReviewService {
  private readonly baseUrl = `${environment.proxyUrl}/api/ai/review`;
  // ... rest unchanged
}
```

- [ ] **Step 3: Update all imports across the codebase**

In every file that imports `CosiReviewService` (pr-detail.ts, pr-detail.spec.ts, detail-action-bar.ts, detail-action-bar.spec.ts, review-findings.ts, review-findings.spec.ts, view-arbeit.spec.ts):
- Change import path from `'../../services/cosi-review.service'` to `'../../services/ai-review.service'`
- Change class name from `CosiReviewService` to `AiReviewService`
- Change any `inject(CosiReviewService)` to `inject(AiReviewService)`

- [ ] **Step 4: Update the spec file**

In `src/app/services/ai-review.service.spec.ts`:
- Update import path and class name references

- [ ] **Step 5: Run frontend tests**

Run: `npx ng test --watch=false`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: rename CosiReviewService to AiReviewService"
```

---

### Task 5: Frontend — SettingsService

**Files:**
- Create: `src/app/services/settings.service.ts`
- Create: `src/app/services/settings.service.spec.ts`
- Create: `src/app/models/settings.model.ts`

- [ ] **Step 1: Create settings model**

```ts
export interface OrbitSettings {
  connections: {
    jira: {
      baseUrl: string;
      apiKey: string;
    };
    bitbucket: {
      baseUrl: string;
      apiKey: string;
      userSlug: string;
    };
    vertexAi: {
      url: string;
      customHeaders: { name: string; value: string }[];
    };
  };
  features: {
    pomodoro: {
      enabled: boolean;
      focusMinutes: number;
      breakMinutes: number;
    };
    aiReviews: {
      enabled: boolean;
    };
    dayCalendar: {
      enabled: boolean;
    };
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
  };
}

export function createDefaultSettings(): OrbitSettings {
  return {
    connections: {
      jira: { baseUrl: '', apiKey: '' },
      bitbucket: { baseUrl: '', apiKey: '', userSlug: '' },
      vertexAi: { url: '', customHeaders: [] },
    },
    features: {
      pomodoro: { enabled: true, focusMinutes: 25, breakMinutes: 5 },
      aiReviews: { enabled: false },
      dayCalendar: { enabled: true },
    },
    appearance: { theme: 'system' },
  };
}
```

- [ ] **Step 2: Create SettingsService**

```ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { OrbitSettings, createDefaultSettings } from '../models/settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/api/settings`;

  private readonly _settings = signal<OrbitSettings>(createDefaultSettings());
  private readonly _isConfigured = signal(false);
  private readonly _loaded = signal(false);

  readonly settings = this._settings.asReadonly();
  readonly isConfigured = this._isConfigured.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  readonly jiraConfig = computed(() => this._settings().connections.jira);
  readonly bitbucketConfig = computed(() => this._settings().connections.bitbucket);
  readonly vertexAiConfig = computed(() => this._settings().connections.vertexAi);
  readonly pomodoroDefaults = computed(() => ({
    focusMinutes: this._settings().features.pomodoro.focusMinutes,
    breakMinutes: this._settings().features.pomodoro.breakMinutes,
  }));
  readonly theme = computed(() => this._settings().appearance.theme);
  readonly pomodoroEnabled = computed(() => this._settings().features.pomodoro.enabled);
  readonly aiReviewsEnabled = computed(() => this._settings().features.aiReviews.enabled);
  readonly dayCalendarEnabled = computed(() => this._settings().features.dayCalendar.enabled);

  async load(): Promise<void> {
    const status = await firstValueFrom(
      this.http.get<{ configured: boolean }>(`${this.baseUrl}/status`)
    );
    this._isConfigured.set(status.configured);

    if (status.configured) {
      const settings = await firstValueFrom(
        this.http.get<OrbitSettings>(this.baseUrl)
      );
      this._settings.set(settings);
    }
    this._loaded.set(true);
  }

  async save(settings: OrbitSettings): Promise<void> {
    const result = await firstValueFrom(
      this.http.put<OrbitSettings>(this.baseUrl, settings)
    );
    this._settings.set(result);
    this._isConfigured.set(true);
  }
}
```

- [ ] **Step 3: Write tests**

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SettingsService } from './settings.service';
import { createDefaultSettings } from '../models/settings.model';

describe('SettingsService', () => {
  let service: SettingsService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SettingsService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should start with defaults and not configured', () => {
    expect(service.isConfigured()).toBe(false);
    expect(service.loaded()).toBe(false);
    expect(service.settings()).toEqual(createDefaultSettings());
  });

  it('should load status and settings when configured', async () => {
    const settings = {
      ...createDefaultSettings(),
      connections: {
        ...createDefaultSettings().connections,
        jira: { baseUrl: 'https://jira.test', apiKey: 'key' },
        bitbucket: { baseUrl: 'https://bb.test', apiKey: 'key', userSlug: 'user' },
      },
    };

    const loadPromise = service.load();
    httpTesting.expectOne('/api/settings/status').flush({ configured: true });
    httpTesting.expectOne('/api/settings').flush(settings);
    await loadPromise;

    expect(service.isConfigured()).toBe(true);
    expect(service.loaded()).toBe(true);
    expect(service.jiraConfig().baseUrl).toBe('https://jira.test');
  });

  it('should not load settings when not configured', async () => {
    const loadPromise = service.load();
    httpTesting.expectOne('/api/settings/status').flush({ configured: false });
    await loadPromise;

    expect(service.isConfigured()).toBe(false);
    expect(service.loaded()).toBe(true);
  });

  it('should save settings and update state', async () => {
    const settings = {
      ...createDefaultSettings(),
      connections: {
        ...createDefaultSettings().connections,
        jira: { baseUrl: 'https://jira.test', apiKey: 'key' },
        bitbucket: { baseUrl: 'https://bb.test', apiKey: 'key', userSlug: 'user' },
      },
    };

    const savePromise = service.save(settings);
    httpTesting.expectOne({ method: 'PUT', url: '/api/settings' }).flush(settings);
    await savePromise;

    expect(service.isConfigured()).toBe(true);
    expect(service.jiraConfig().baseUrl).toBe('https://jira.test');
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx ng test --watch=false`
Expected: SettingsService tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/models/settings.model.ts src/app/services/settings.service.ts src/app/services/settings.service.spec.ts
git commit -m "feat: add SettingsService with signals and API communication"
```

---

### Task 6: Frontend — Integrate SettingsService into Existing Services

**Files:**
- Modify: `src/app/services/theme.service.ts`
- Modify: `src/app/services/theme.service.spec.ts`
- Modify: `src/app/services/pomodoro.service.ts`
- Modify: `src/app/services/bitbucket.service.ts`
- Modify: `src/app/services/bitbucket.service.spec.ts`
- Modify: `src/app/services/jira.service.ts`
- Modify: `src/app/services/ai-review.service.ts`

- [ ] **Step 1: Update ThemeService**

Replace localStorage-based preference with SettingsService. Keep the media query listener and `applyTheme` logic. Remove `setPreference`, `cycle`, `loadPreference` — theme is now set only via Settings UI.

```ts
import { Injectable, effect, inject } from '@angular/core';
import { SettingsService } from './settings.service';

export type ThemePreference = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly settingsService = inject(SettingsService);
  private readonly mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  readonly preference = this.settingsService.theme;

  constructor() {
    effect(() => {
      this.applyTheme(this.preference());
    });

    this.mediaQuery.addEventListener('change', () => {
      if (this.preference() === 'system') {
        this.applyTheme('system');
      }
    });
  }

  private applyTheme(pref: ThemePreference) {
    const isDark = pref === 'dark' || (pref === 'system' && this.mediaQuery.matches);
    document.documentElement.classList.toggle('dark', isDark);
  }
}
```

- [ ] **Step 2: Update PomodoroService**

Replace localStorage defaults with SettingsService. Keep session state in localStorage:

In `pomodoro.service.ts`, add the SettingsService injection and update `loadDefaults()`:

```ts
private readonly settingsService = inject(SettingsService);
```

Replace the `loadDefaults` method:

```ts
private loadDefaults(): PomodoroDefaults {
  return {
    focusMinutes: this.settingsService.pomodoroDefaults().focusMinutes,
    breakMinutes: this.settingsService.pomodoroDefaults().breakMinutes,
  };
}
```

Remove `DEFAULTS_KEY` constant and the `localStorage.setItem(DEFAULTS_KEY, ...)` call in the `start()` method. Keep the `defaults` signal but initialize it from SettingsService.

- [ ] **Step 3: Update BitbucketService**

Remove the `config$` observable that fetches from `/config`. Instead inject `SettingsService` and use `settingsService.bitbucketConfig()` to get the user slug.

Find the line (around line 150-152) where `config$` is defined:
```ts
private readonly config$ = this.http.get<{ bitbucketUserSlug: string }>(`${environment.proxyUrl}/config`).pipe(shareReplay(1));
```

Replace it with:
```ts
private readonly settingsService = inject(SettingsService);
```

Then everywhere `config$` is used via `switchMap` (e.g., around lines 293-305, 355), replace the pattern. Instead of:
```ts
this.config$.pipe(switchMap(config => ... config.bitbucketUserSlug ...))
```
Use:
```ts
this.settingsService.bitbucketConfig().userSlug
```

Adapt each usage site accordingly. The `mapPr` method that takes `userSlug` as parameter should get it from `this.settingsService.bitbucketConfig().userSlug`.

- [ ] **Step 4: Update JiraService**

No direct changes needed — JiraService already uses `environment.proxyUrl` which goes through the server proxy. The server proxy now reads credentials from settings.json. JiraService doesn't need to know about credentials.

- [ ] **Step 5: Update AiReviewService**

The service already calls `/api/ai/review` (after the rename in Task 4). The server handles Vertex AI config. No frontend changes needed for the service itself.

- [ ] **Step 6: Update affected test files**

For `theme.service.spec.ts`: Provide `SettingsService` in the test, mock the `theme` signal.

For `bitbucket.service.spec.ts`: Remove all `httpTesting.expectOne(req => req.url.endsWith('/config'))` calls. Provide a mock `SettingsService` with `bitbucketConfig` returning `{ baseUrl: '', apiKey: '', userSlug: 'dominik.mueller' }`.

For `pomodoro.service.spec.ts`: Provide a mock `SettingsService` with `pomodoroDefaults` returning `{ focusMinutes: 25, breakMinutes: 5 }`.

- [ ] **Step 7: Run all tests**

Run: `npx ng test --watch=false`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: integrate SettingsService into Theme, Pomodoro, Bitbucket services"
```

---

### Task 7: Frontend — WelcomeScreenComponent

**Files:**
- Create: `src/app/components/welcome-screen/welcome-screen.ts`

- [ ] **Step 1: Create the component**

This is a fullscreen component with the 2D orbit animation. See spec section 3 for exact visual details. Key elements:

```ts
import { ChangeDetectionStrategy, Component, output } from '@angular/core';

@Component({
  selector: 'app-welcome-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fixed inset-0 z-50',
  },
  template: `
    <div class="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden"
         style="background: #0c0a09; background-image: radial-gradient(ellipse 100% 80% at 50% 30%, rgba(124,58,237,0.18) 0%, rgba(91,33,182,0.08) 35%, transparent 65%), radial-gradient(ellipse 60% 50% at 20% 80%, rgba(91,33,182,0.06) 0%, transparent 50%), radial-gradient(ellipse 50% 40% at 80% 75%, rgba(167,139,250,0.04) 0%, transparent 50%)">

      <!-- Stars background -->
      <div class="absolute inset-0 animate-twinkle" aria-hidden="true"
           style="background-image: radial-gradient(1px 1px at 15% 25%, rgba(231,229,228,0.25) 0%, transparent 100%), radial-gradient(1px 1px at 45% 15%, rgba(231,229,228,0.15) 0%, transparent 100%), radial-gradient(1px 1px at 72% 42%, rgba(231,229,228,0.2) 0%, transparent 100%), radial-gradient(1px 1px at 88% 18%, rgba(231,229,228,0.12) 0%, transparent 100%), radial-gradient(1px 1px at 25% 65%, rgba(231,229,228,0.18) 0%, transparent 100%), radial-gradient(1px 1px at 55% 78%, rgba(231,229,228,0.1) 0%, transparent 100%), radial-gradient(1px 1px at 82% 72%, rgba(231,229,228,0.22) 0%, transparent 100%), radial-gradient(1.5px 1.5px at 35% 88%, rgba(167,139,250,0.2) 0%, transparent 100%), radial-gradient(1px 1px at 92% 55%, rgba(231,229,228,0.14) 0%, transparent 100%), radial-gradient(1.5px 1.5px at 8% 48%, rgba(167,139,250,0.15) 0%, transparent 100%)">
      </div>

      <!-- 2D Orbit illustration -->
      <div class="relative w-[260px] h-[260px] mb-8 animate-fade-in" aria-hidden="true">
        <!-- Rings -->
        <div class="absolute inset-0 m-auto w-[258px] h-[258px] rounded-full border border-dashed" style="border-color: rgba(120,113,108,0.08)"></div>
        <div class="absolute inset-0 m-auto w-[210px] h-[210px] rounded-full border" style="border-color: rgba(167,139,250,0.1)"></div>
        <div class="absolute inset-0 m-auto w-[140px] h-[140px] rounded-full border border-dashed" style="border-color: rgba(167,139,250,0.18)"></div>

        <!-- Planet -->
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full animate-planet-pulse"
             style="background: radial-gradient(circle at 38% 34%, #c4b5fd 0%, #a78bfa 22%, #7c3aed 50%, #5b21b6 75%, #3b0764 100%); box-shadow: 0 0 30px rgba(167,139,250,0.3), 0 0 60px rgba(124,58,237,0.12)">
          <div class="absolute top-[10px] left-[14px] w-4 h-[10px] rounded-full -rotate-[20deg]"
               style="background: radial-gradient(ellipse, rgba(255,255,255,0.3) 0%, transparent 70%)"></div>
        </div>

        <!-- Satellite tracks with orbiting bodies -->
        <div class="absolute top-1/2 left-1/2 w-[140px] h-[140px] -translate-x-1/2 -translate-y-1/2 rounded-full animate-orbit-1">
          <div class="absolute -top-[9px] left-1/2 -translate-x-1/2 w-[18px] h-[18px] rounded-full"
               style="background: radial-gradient(circle at 36% 32%, #fafaf9 0%, #d6d3d1 40%, #a8a29e 80%); box-shadow: 0 0 10px rgba(167,139,250,0.35), 0 0 20px rgba(167,139,250,0.12)"></div>
        </div>
        <div class="absolute top-1/2 left-1/2 w-[210px] h-[210px] -translate-x-1/2 -translate-y-1/2 rounded-full animate-orbit-2">
          <div class="absolute -top-[5px] left-1/2 -translate-x-1/2 w-[10px] h-[10px] rounded-full"
               style="background: radial-gradient(circle at 35% 30%, #c4b5fd 0%, #8b5cf6 60%, #6d28d9 100%); box-shadow: 0 0 8px rgba(139,92,246,0.4)"></div>
        </div>
        <div class="absolute top-1/2 left-1/2 w-[258px] h-[258px] -translate-x-1/2 -translate-y-1/2 rounded-full animate-orbit-3">
          <div class="absolute -top-[3px] left-1/2 -translate-x-1/2 w-[6px] h-[6px] rounded-full"
               style="background: radial-gradient(circle, #a8a29e 0%, #78716c 100%); box-shadow: 0 0 6px rgba(168,162,158,0.25)"></div>
        </div>

        <!-- Decorative dots -->
        <div class="absolute top-5 left-[45px] w-[3px] h-[3px] rounded-full bg-violet-400/25"></div>
        <div class="absolute top-[60px] right-[30px] w-[2px] h-[2px] rounded-full bg-violet-400/25"></div>
        <div class="absolute bottom-10 left-[35px] w-1 h-1 rounded-full bg-stone-400/20"></div>
        <div class="absolute bottom-[25px] right-[55px] w-[2px] h-[2px] rounded-full bg-violet-400/25"></div>
        <div class="absolute top-[45px] right-[60px] w-[3px] h-[3px] rounded-full bg-stone-400/15"></div>
      </div>

      <!-- Text content -->
      <div class="relative z-10 max-w-[440px] w-full px-8 flex flex-col items-center">
        <h1 class="text-[30px] font-[800] text-stone-50 text-center mb-2.5 tracking-tight leading-tight animate-fade-up-1"
            style="font-family: 'Nunito', system-ui, sans-serif">
          Willkommen bei <span class="bg-gradient-to-r from-violet-400 via-violet-300 to-violet-400 bg-clip-text text-transparent">Orbit</span>
        </h1>
        <p class="text-[15px] text-stone-400 text-center leading-relaxed mb-8 animate-fade-up-2"
           style="font-family: 'Nunito', system-ui, sans-serif">
          Deine persönliche Kommandozentrale für den Arbeitsalltag — gebaut für Fokus, Struktur und Orientierung.
        </p>

        <!-- Feature chips -->
        <div class="flex flex-wrap justify-center gap-2 mb-9 animate-fade-up-3">
          <div class="inline-flex items-center gap-[7px] px-3.5 py-2 rounded-full text-[12.5px] font-medium text-stone-300 border border-stone-800 backdrop-blur-sm" style="background: rgba(28,25,23,0.7)">
            <svg class="w-3.5 h-3.5 stroke-violet-400" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            Alles an einem Ort
          </div>
          <div class="inline-flex items-center gap-[7px] px-3.5 py-2 rounded-full text-[12.5px] font-medium text-stone-300 border border-stone-800 backdrop-blur-sm" style="background: rgba(28,25,23,0.7)">
            <svg class="w-3.5 h-3.5 stroke-amber-400" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Gebaut für Fokus
          </div>
          <div class="inline-flex items-center gap-[7px] px-3.5 py-2 rounded-full text-[12.5px] font-medium text-stone-300 border border-stone-800 backdrop-blur-sm" style="background: rgba(28,25,23,0.7)">
            <svg class="w-3.5 h-3.5 stroke-emerald-400" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Deine Daten, lokal
          </div>
        </div>

        <!-- CTA -->
        <div class="flex flex-col items-center gap-2.5 animate-fade-up-4">
          <button
            type="button"
            (click)="configure.emit()"
            class="inline-flex items-center gap-2.5 px-9 py-3.5 rounded-full text-[15px] font-bold text-white cursor-pointer transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0"
            style="font-family: 'Nunito', system-ui, sans-serif; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); box-shadow: 0 2px 4px rgba(0,0,0,0.3), 0 6px 24px rgba(124,58,237,0.25), inset 0 1px 0 rgba(255,255,255,0.12)"
          >
            Einstellungen festlegen
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <span class="text-xs text-stone-700" style="font-family: 'Nunito', system-ui, sans-serif">Dauert nur wenige Minuten</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes twinkle { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
    @keyframes fade-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
    @keyframes fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes planet-pulse {
      0%, 100% { box-shadow: 0 0 30px rgba(167,139,250,0.3), 0 0 60px rgba(124,58,237,0.12); }
      50% { box-shadow: 0 0 40px rgba(167,139,250,0.4), 0 0 80px rgba(124,58,237,0.18); }
    }
    @keyframes orbit-1 { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }
    @keyframes orbit-2 { from { transform: translate(-50%,-50%) rotate(60deg); } to { transform: translate(-50%,-50%) rotate(420deg); } }
    @keyframes orbit-3 { from { transform: translate(-50%,-50%) rotate(180deg); } to { transform: translate(-50%,-50%) rotate(540deg); } }

    .animate-twinkle { animation: twinkle 12s ease-in-out infinite alternate; }
    .animate-fade-in { animation: fade-in 1.2s cubic-bezier(0.16,1,0.3,1) forwards; opacity: 0; }
    .animate-planet-pulse { animation: planet-pulse 6s ease-in-out infinite; }
    .animate-orbit-1 { animation: orbit-1 12s linear infinite; }
    .animate-orbit-2 { animation: orbit-2 20s linear infinite; }
    .animate-orbit-3 { animation: orbit-3 30s linear infinite reverse; }
    .animate-fade-up-1 { animation: fade-up 0.8s cubic-bezier(0.16,1,0.3,1) 0.3s forwards; opacity: 0; }
    .animate-fade-up-2 { animation: fade-up 0.8s cubic-bezier(0.16,1,0.3,1) 0.4s forwards; opacity: 0; }
    .animate-fade-up-3 { animation: fade-up 0.8s cubic-bezier(0.16,1,0.3,1) 0.55s forwards; opacity: 0; }
    .animate-fade-up-4 { animation: fade-up 0.8s cubic-bezier(0.16,1,0.3,1) 0.7s forwards; opacity: 0; }
  `],
})
export class WelcomeScreenComponent {
  configure = output<void>();
}
```

- [ ] **Step 2: Add Nunito font**

In `src/index.html`, add to `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

- [ ] **Step 3: Commit**

```bash
git add src/app/components/welcome-screen/welcome-screen.ts src/index.html
git commit -m "feat: add WelcomeScreenComponent with 2D orbit animation"
```

---

### Task 8: Frontend — ViewSettingsComponent

**Files:**
- Create: `src/app/views/view-settings/view-settings.ts`
- Create: `src/app/views/view-settings/view-settings.html`

- [ ] **Step 1: Create the component class**

```ts
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../services/settings.service';
import { OrbitSettings, createDefaultSettings } from '../../models/settings.model';

@Component({
  selector: 'app-view-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './view-settings.html',
  host: {
    class: 'flex h-full overflow-hidden',
  },
})
export class ViewSettingsComponent {
  private readonly settingsService = inject(SettingsService);

  readonly draft = signal<OrbitSettings>(structuredClone(this.settingsService.settings()));
  private readonly savedSnapshot = signal(JSON.stringify(this.settingsService.settings()));

  readonly isDirty = computed(() => JSON.stringify(this.draft()) !== this.savedSnapshot());
  readonly canSave = computed(() => {
    const d = this.draft();
    return this.isDirty() &&
      d.connections.jira.baseUrl.trim() !== '' &&
      d.connections.jira.apiKey.trim() !== '' &&
      d.connections.bitbucket.baseUrl.trim() !== '' &&
      d.connections.bitbucket.apiKey.trim() !== '' &&
      d.connections.bitbucket.userSlug.trim() !== '';
  });

  readonly saveState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly activeSection = signal('verbindungen');

  readonly sections = [
    { id: 'verbindungen', label: 'Verbindungen', children: [
      { id: 'jira', label: 'Jira' },
      { id: 'bitbucket', label: 'Bitbucket' },
      { id: 'vertex-ai', label: 'Vertex AI Proxy' },
    ]},
    { id: 'funktionen', label: 'Funktionen', children: [
      { id: 'pomodoro', label: 'Pomodoro-Timer' },
      { id: 'ai-reviews', label: 'KI-Reviews' },
      { id: 'kalender', label: 'Tageskalender' },
    ]},
    { id: 'darstellung', label: 'Darstellung', children: [] },
  ];

  constructor() {
    effect(() => {
      const settings = this.settingsService.settings();
      this.draft.set(structuredClone(settings));
      this.savedSnapshot.set(JSON.stringify(settings));
    });
  }

  updateDraft(mutator: (draft: OrbitSettings) => void): void {
    const clone = structuredClone(this.draft());
    mutator(clone);
    this.draft.set(clone);
  }

  addCustomHeader(): void {
    this.updateDraft(d => d.connections.vertexAi.customHeaders.push({ name: '', value: '' }));
  }

  removeCustomHeader(index: number): void {
    this.updateDraft(d => d.connections.vertexAi.customHeaders.splice(index, 1));
  }

  setTheme(theme: 'light' | 'dark' | 'system'): void {
    this.updateDraft(d => d.appearance.theme = theme);
  }

  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saveState.set('saving');
    try {
      await this.settingsService.save(this.draft());
      this.savedSnapshot.set(JSON.stringify(this.draft()));
      this.saveState.set('saved');
      setTimeout(() => this.saveState.set('idle'), 2000);
    } catch {
      this.saveState.set('error');
      setTimeout(() => this.saveState.set('idle'), 3000);
    }
  }

  scrollTo(sectionId: string): void {
    document.getElementById('section-' + sectionId)?.scrollIntoView({ behavior: 'smooth' });
  }

  onContentScroll(event: Event): void {
    const container = event.target as HTMLElement;
    const sectionElements = container.querySelectorAll('[data-section]');
    let currentSection = 'verbindungen';
    for (const el of Array.from(sectionElements)) {
      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (rect.top - containerRect.top <= 100) {
        currentSection = (el as HTMLElement).dataset['section']!;
      }
    }
    this.activeSection.set(currentSection);
  }

  discard(): void {
    this.draft.set(structuredClone(this.settingsService.settings()));
  }
}
```

- [ ] **Step 2: Create the template**

Create the HTML template in `src/app/views/view-settings/view-settings.html`. This should implement the two-column layout (sticky nav left, scrollable content right) with all three sections (Verbindungen, Funktionen, Darstellung) as described in the spec section 4.

The template should use:
- Tailwind classes matching Orbit's design tokens (`var(--color-bg-card)`, `var(--color-text-heading)`, etc.)
- `(scroll)="onContentScroll($event)"` on the scrollable content container
- `(click)="scrollTo('sectionId')"` on navigation items
- `[class.text-violet-400]="activeSection() === 'sectionId'"` for active nav highlighting
- `[(ngModel)]` bindings via `draft()` properties and `updateDraft()` for mutations
- Toggle switches using checkbox inputs styled as switches
- Required field markers with `<span class="text-red-500">*</span>`
- The theme mini-previews with `(click)="setTheme('light')"` etc., with `[class.border-violet-400]` on the selected one
- The sticky footer with save button using `[disabled]="!canSave()"` and save state feedback

- [ ] **Step 3: Commit**

```bash
git add src/app/views/view-settings/
git commit -m "feat: add ViewSettingsComponent with form, nav, and footer"
```

---

### Task 9: Frontend — App Integration & Onboarding Gate

**Files:**
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`
- Modify: `src/app/components/app-rail/app-rail.ts`

- [ ] **Step 1: Update AppComponent**

Add SettingsService injection, load settings on init, add onboarding gate logic and unsaved-changes guard:

```ts
import { ApplicationRef, ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { AppRailComponent } from './components/app-rail/app-rail';
import { ViewArbeitComponent } from './views/view-arbeit/view-arbeit';
import { ViewLogbuchComponent } from './views/view-logbuch/view-logbuch';
import { ViewSettingsComponent } from './views/view-settings/view-settings';
import { WelcomeScreenComponent } from './components/welcome-screen/welcome-screen';
import { QuickCaptureComponent } from './components/quick-capture/quick-capture';
import { DailyReflectionService } from './services/daily-reflection.service';
import { ThemeService } from './services/theme.service';
import { SettingsService } from './services/settings.service';
import { PomodoroProgressBarComponent } from './components/pomodoro-progress-bar/pomodoro-progress-bar';
import { PomodoroOverlayComponent } from './components/pomodoro-overlay/pomodoro-overlay';

const STORAGE_KEY = 'orbit.activeView';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppRailComponent, ViewArbeitComponent, ViewLogbuchComponent, ViewSettingsComponent, WelcomeScreenComponent, QuickCaptureComponent, PomodoroProgressBarComponent, PomodoroOverlayComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class App {
  private readonly reflectionService = inject(DailyReflectionService);
  private readonly appRef = inject(ApplicationRef);
  private theme = inject(ThemeService);
  readonly settingsService = inject(SettingsService);

  activeView = signal(localStorage.getItem(STORAGE_KEY) ?? 'arbeit');
  overlayOpen = signal(false);
  private previousFocus: HTMLElement | null = null;

  constructor() {
    this.settingsService.load();

    effect(() => {
      localStorage.setItem(STORAGE_KEY, this.activeView());
    });
    setInterval(() => {
      if (!this.debugEvening) this.reflectionService.currentHour.set(new Date().getHours());
    }, 5 * 60 * 1000);
  }

  private debugEvening = false;

  onWelcomeConfigure(): void {
    this.activeView.set('einstellungen');
  }

  onKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      this.previousFocus = document.activeElement as HTMLElement;
      this.overlayOpen.set(true);
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      this.debugEvening = !this.debugEvening;
      if (this.debugEvening) {
        const entry = this.reflectionService.todayEntry();
        if (!entry || entry.morningAnsweredAt === null) {
          this.reflectionService.skipMorning();
        }
        this.reflectionService.currentHour.set(16);
      } else {
        this.reflectionService.currentHour.set(new Date().getHours());
      }
      console.log(`[Orbit Debug] Evening mode: ${this.debugEvening ? 'ON' : 'OFF'} | phase: ${this.reflectionService.reflectionPhase()}`);
      this.appRef.tick();
    }
  }

  onOverlayClose(): void {
    this.overlayOpen.set(false);
    this.previousFocus?.focus();
  }
}
```

- [ ] **Step 2: Update app.html**

```html
@if (!settingsService.isConfigured() && settingsService.loaded() && activeView() !== 'einstellungen') {
  <app-welcome-screen (configure)="onWelcomeConfigure()" />
} @else {
  <app-pomodoro-progress-bar />
  <div class="flex h-screen overflow-hidden">
    <app-rail
      [activeView]="activeView()"
      (viewChange)="activeView.set($event)"
    />

    @switch (activeView()) {
      @case ('arbeit') {
        <app-view-arbeit class="flex-1 overflow-hidden" />
      }
      @case ('logbuch') {
        <app-view-logbuch class="flex-1 overflow-hidden bg-[var(--color-bg-page)]" />
      }
      @case ('einstellungen') {
        <app-view-settings class="flex-1 overflow-hidden bg-[var(--color-bg-page)]" />
      }
    }
  </div>
  <app-quick-capture [open]="overlayOpen()" (close)="onOverlayClose()" />
  <app-pomodoro-overlay />
}
```

- [ ] **Step 3: Update AppRailComponent**

Add the settings view to the VIEWS array and replace the theme toggle button with a settings gear icon:

In `src/app/components/app-rail/app-rail.ts`:

Update the VIEWS constant:
```ts
const VIEWS: OrbitView[] = [
  { id: 'arbeit', label: 'Arbeit' },
  { id: 'logbuch', label: 'Logbuch' },
];
```

Remove the theme cycle button at the bottom of the template (the entire `<button>` block from line 56-79). Replace it with a settings gear button:

```html
<button
  type="button"
  class="w-10 h-10 mb-3 flex items-center justify-center rounded-lg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
  [class.bg-violet-500]="activeView() === 'einstellungen'"
  [class.text-white]="activeView() === 'einstellungen'"
  [class.text-stone-400]="activeView() !== 'einstellungen'"
  [class.hover:text-stone-200]="activeView() !== 'einstellungen'"
  [class.hover:bg-stone-800]="activeView() !== 'einstellungen'"
  aria-label="Einstellungen"
  (click)="viewChange.emit('einstellungen')"
>
  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
</button>
```

Remove the `ThemeService` injection and the `themeLabel` computed since the rail no longer manages themes.

- [ ] **Step 4: Run all tests**

Run: `npx ng test --watch=false`
Expected: All tests pass (some existing tests may need minor updates for the new imports)

- [ ] **Step 5: Commit**

```bash
git add src/app/app.ts src/app/app.html src/app/components/app-rail/app-rail.ts
git commit -m "feat: integrate settings view, welcome screen, and onboarding gate"
```

---

### Task 10: Frontend — Unsaved Changes Guard

**Files:**
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`

- [ ] **Step 1: Add unsaved changes dialog state to App**

In `src/app/app.ts`, add:

```ts
pendingViewChange = signal<string | null>(null);
```

Add a method to handle view changes with the guard:

```ts
onViewChange(viewId: string): void {
  if (this.activeView() === 'einstellungen' && viewId !== 'einstellungen') {
    const settingsView = document.querySelector('app-view-settings');
    // Check dirty state via a ViewChild or by querying the SettingsService
    // For simplicity, check if there's a dirty indicator in the DOM
    if (document.querySelector('[data-settings-dirty="true"]')) {
      this.pendingViewChange.set(viewId);
      return;
    }
  }
  this.activeView.set(viewId);
}

confirmDiscard(): void {
  const pending = this.pendingViewChange();
  if (pending) {
    this.pendingViewChange.set(null);
    this.activeView.set(pending);
  }
}

confirmSave(): void {
  // Trigger save on the settings view, then navigate
  const pending = this.pendingViewChange();
  if (pending) {
    this.pendingViewChange.set(null);
    // Save will be handled by ViewSettingsComponent
    this.activeView.set(pending);
  }
}

cancelNavigation(): void {
  this.pendingViewChange.set(null);
}
```

- [ ] **Step 2: Update app.html**

Replace `(viewChange)="activeView.set($event)"` with `(viewChange)="onViewChange($event)"`.

Add the unsaved changes dialog:

```html
@if (pendingViewChange()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
    <div class="bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] rounded-xl p-6 max-w-sm shadow-xl">
      <h3 class="text-[var(--color-text-heading)] font-semibold mb-2">Ungespeicherte Änderungen</h3>
      <p class="text-[var(--color-text-secondary)] text-sm mb-5">Du hast ungespeicherte Änderungen in den Einstellungen. Möchtest du speichern oder verwerfen?</p>
      <div class="flex gap-2 justify-end">
        <button (click)="cancelNavigation()" class="px-4 py-2 text-sm rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer">Abbrechen</button>
        <button (click)="confirmDiscard()" class="px-4 py-2 text-sm rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer">Verwerfen</button>
        <button (click)="confirmSave()" class="px-4 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors cursor-pointer">Speichern</button>
      </div>
    </div>
  </div>
}
```

- [ ] **Step 3: Add dirty state data attribute to ViewSettingsComponent**

In `ViewSettingsComponent`, add to host:

```ts
host: {
  class: 'flex h-full overflow-hidden',
  '[attr.data-settings-dirty]': 'isDirty()',
},
```

- [ ] **Step 4: Commit**

```bash
git add src/app/app.ts src/app/app.html src/app/views/view-settings/view-settings.ts
git commit -m "feat: add unsaved changes guard for settings navigation"
```

---

### Task 11: Feature Toggle Integration

**Files:**
- Modify: `src/app/views/view-arbeit/view-arbeit.ts` (conditionally render DayCalendarPanel)
- Modify: `src/app/components/pr-detail/pr-detail.ts` (conditionally show AI review button)
- Modify: relevant components that use Pomodoro features

- [ ] **Step 1: Conditionally render DayCalendarPanel**

In `src/app/views/view-arbeit/view-arbeit.ts`, inject `SettingsService` and wrap the `<app-day-calendar-panel>` in `@if (settingsService.dayCalendarEnabled())`.

- [ ] **Step 2: Conditionally show AI review trigger**

In `src/app/components/detail-action-bar/detail-action-bar.ts` (or wherever the review button lives), inject `SettingsService` and conditionally render the AI review button only when `settingsService.aiReviewsEnabled()` is true.

- [ ] **Step 3: Conditionally render Pomodoro UI**

In `src/app/app.html`, wrap `<app-pomodoro-progress-bar />` and `<app-pomodoro-overlay />` in `@if (settingsService.pomodoroEnabled())`.

- [ ] **Step 4: Run all tests**

Run: `npx ng test --watch=false`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: integrate feature toggles for calendar, AI reviews, and pomodoro"
```

---

### Task 12: Server Settings Hot-Reload

**Files:**
- Modify: `server/index.js`
- Modify: `server/routes/settings-routes.js`

- [ ] **Step 1: Reload settings after PUT**

When the frontend saves settings via `PUT /api/settings`, the server's in-memory settings object must update. In `settings-routes.js`, accept a `reloadSettings` callback:

```js
function createSettingsRoutes({ onSettingsSaved } = {}) {
  // ... existing routes from Task 1 ...

  // Update the PUT handler to call onSettingsSaved after writing:
  router.put('/api/settings', json(), async (req, res) => {
    const settings = req.body;
    const missing = REQUIRED_FIELDS.filter(f => {
      const val = getNestedValue(settings, f);
      return !val || typeof val !== 'string' || val.trim().length === 0;
    });
    if (missing.length > 0) {
      return res.status(400).json({ error: 'Missing required fields', fields: missing });
    }
    await writeJson(SETTINGS_FILE, settings);
    if (onSettingsSaved) await onSettingsSaved();
    res.json(settings);
  });

  return router;
}
```

In `server/index.js`, pass the reload callback:

```js
app.use(createSettingsRoutes({ onSettingsSaved: loadSettings }));
```

- [ ] **Step 2: Verify**

Start server, PUT new settings via curl, verify that subsequent proxy requests use the new credentials.

- [ ] **Step 3: Commit**

```bash
git add server/index.js server/routes/settings-routes.js
git commit -m "feat: hot-reload server settings after save"
```

---

### Task 13: Final Cleanup & Verification

**Files:**
- Remove: `.env.example` (if not already removed)
- Modify: `AGENTS.md` or other docs if they reference `.env`
- Verify: `.gitignore` includes `.env` (for safety, in case someone creates one)

- [ ] **Step 1: Search for remaining CoSi/cosi references**

```bash
grep -ri "cosi" src/ server/ --include="*.ts" --include="*.js" --include="*.html" -l
```

Expected: No results. If any found, update them.

- [ ] **Step 2: Search for remaining .env references**

```bash
grep -ri "dotenv\|process\.env\|\.env" server/ --include="*.js" -l
```

Expected: No results (except possibly `.gitignore`).

- [ ] **Step 3: Run full test suite**

```bash
npx ng test --watch=false && npx vitest run server/
```

Expected: All tests pass.

- [ ] **Step 4: Manual verification**

1. Delete `~/.orbit/settings.json` if it exists
2. Start Orbit (`npm start`)
3. Verify: Welcome screen appears
4. Click "Einstellungen festlegen"
5. Verify: Settings view opens with required fields marked
6. Fill in Jira + Bitbucket credentials, save
7. Verify: Can navigate to Arbeit/Logbuch views
8. Verify: Tickets and PRs load correctly
9. Toggle theme in settings, verify it applies
10. Toggle features, verify UI updates

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: final cleanup — remove remaining cosi/env references"
```
