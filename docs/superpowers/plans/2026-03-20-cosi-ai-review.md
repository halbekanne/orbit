# CoSi AI-Powered PR Review — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an on-demand AI-powered code review feature to Orbit's PR detail view, using CoSi (Gemini 2.5 Flash) to check PR diffs against Jira Akzeptanzkriterien and code quality standards.

**Architecture:** Two specialist CoSi agents (AK-Abgleich + Code Quality) run in parallel via the Express proxy, followed by a consolidation agent that deduplicates and filters findings. Results render as expandable rows in the PR detail view, triggered by a button in the action rail.

**Tech Stack:** Angular 21 (signals, OnPush, zoneless), Express.js proxy, CoSi/Gemini 2.5 Flash REST API, Vitest (frontend), Node built-in test runner (backend)

**Spec:** `docs/superpowers/specs/2026-03-18-cosi-ai-review-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `src/app/models/review.model.ts` | ReviewFinding, ReviewResult, ReviewState types | Create |
| `src/app/services/cosi-review.service.ts` | Signal-based state, HTTP call to proxy | Create |
| `src/app/services/cosi-review.service.spec.ts` | Service unit tests | Create |
| `proxy/cosi.js` | callCoSi helper, system prompts, runReview orchestration | Create |
| `proxy/cosi.test.js` | Backend orchestration tests (Node test runner) | Create |
| `proxy/index.js` | Add `/api/cosi/review` route | Modify |
| `src/app/components/action-rail/action-rail.ts` | Add KI-Review button for PRs | Modify |
| `src/app/components/action-rail/action-rail.spec.ts` | Add button tests | Modify |
| `src/app/components/review-findings/review-findings.ts` | Standalone findings section component | Create |
| `src/app/components/review-findings/review-findings.spec.ts` | Findings section tests | Create |
| `src/app/components/pr-detail/pr-detail.ts` | Wire up review trigger, embed findings component | Modify |
| `src/app/components/pr-detail/pr-detail.spec.ts` | Add review trigger tests | Modify |

---

## Chunk 1: Backend — CoSi Module & Proxy Route

### Task 1: Create `proxy/cosi.js` — callCoSi helper

**Files:**
- Create: `proxy/cosi.js`
- Create: `proxy/cosi.test.js`

- [ ] **Step 1: Write test for callCoSi helper**

Create `proxy/cosi.test.js` using Node's built-in test runner:

```js
const { describe, it, mock, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Clear module cache before each describe block to avoid stale state
function freshRequire() {
  delete require.cache[require.resolve('./cosi')];
  return require('./cosi');
}

describe('callCoSi', () => {
  beforeEach(() => {
    process.env.COSI_API_KEY = 'test-key';
    process.env.COSI_BASE_URL = 'https://cosi.test/generate';
  });

  it('sends correct request to CoSi API', async () => {
    const mockResponse = {
      candidates: [{
        content: {
          parts: [{ text: '{"findings": []}' }]
        }
      }]
    };

    const fetchMock = mock.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }));
    mock.method(global, 'fetch', fetchMock);

    const { callCoSi } = freshRequire();
    const result = await callCoSi('test prompt', 'You are a reviewer.', { temperature: 0.2 });

    assert.equal(fetchMock.mock.calls.length, 1);
    const [url, options] = fetchMock.mock.calls[0].arguments;
    assert.equal(url, 'https://cosi.test/generate');
    assert.equal(options.method, 'POST');

    const headers = options.headers;
    assert.equal(headers['x-api-key'], 'test-key');
    assert.equal(headers['Content-Type'], 'application/json');

    const body = JSON.parse(options.body);
    assert.deepEqual(body.systemInstruction, { parts: [{ text: 'You are a reviewer.' }] });
    assert.equal(body.generationConfig.temperature, 0.2);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(body.contents, [{ role: 'user', parts: [{ text: 'test prompt' }] }]);

    assert.deepEqual(result, { findings: [] });
  });

  it('throws on non-ok response', async () => {
    mock.method(global, 'fetch', () => Promise.resolve({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    }));

    const { callCoSi } = freshRequire();
    await assert.rejects(
      () => callCoSi('prompt', 'system', {}),
      (err) => {
        assert.match(err.message, /429/);
        return true;
      }
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test proxy/cosi.test.js`
Expected: FAIL — `Cannot find module './cosi'`

- [ ] **Step 3: Implement callCoSi helper**

Create `proxy/cosi.js`:

```js
const COSI_API_KEY = process.env.COSI_API_KEY;
const COSI_BASE_URL = process.env.COSI_BASE_URL ||
  'https://api.co-si.system.local/v1/models/locations/europe-west4/publishers/google/models/gemini-2.5-flash:generateContent';

async function callCoSi(userPrompt, systemInstruction, generationConfig = {}) {
  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      ...generationConfig,
      responseMimeType: 'application/json',
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const response = await fetch(COSI_BASE_URL, {
    method: 'POST',
    headers: {
      'x-api-key': COSI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CoSi API error: ${response.status} — ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('CoSi returned no content');
  }

  return JSON.parse(text);
}

module.exports = { callCoSi };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test proxy/cosi.test.js`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add proxy/cosi.js proxy/cosi.test.js
git commit -m "feat(cosi): add callCoSi helper with tests"
```

### Task 2: Add system prompts to `proxy/cosi.js`

**Files:**
- Modify: `proxy/cosi.js`

Read the spec section "CoSi Agent Prompts" thoroughly before writing the prompts. The spec contains detailed prompt engineering guidance, structure patterns, tone rules, and per-agent context templates. Do not summarize or simplify — implement the full guidance.

- [ ] **Step 1: Add SYSTEM_PROMPTS object**

Add to `proxy/cosi.js` after the `callCoSi` function. Each prompt must follow the structure pattern from the spec:

1. Shared constraint block (identical across all three)
2. Agent-specific role and task
3. Output format with JSON schema
4. Severity guide
5. Scope restriction
6. Context section placeholders (XML tags)
7. Final instruction restatement

The shared constraint block to prepend to each agent:

```
You are reviewing a pull request for a Design System built with TypeScript, Lit (Web Components), and SCSS.

RULES:
- Output valid JSON only. No markdown, no wrapping, no explanation outside the JSON.
- Never praise the code. No "looks good", no "well done", no "LGTM".
- Only report findings you are confident about. If unsure, omit.
- Every finding must reference a specific file and line number from the diff.
- Findings without a concrete location in the diff are not findings — discard them.
- Detail must be 1-3 sentences maximum.
- Titles must be in German. Detail and suggestion may use English for technical terms.
```

**Agent 1 (AK-Abgleich):** Must instruct the model to first extract/identify Akzeptanzkriterien from the Jira description text (they are embedded, not structured), then compare each against the diff. Include the edge case: if no AK are identifiable, output `{ "findings": [] }`. Use `<jira_ticket>` and `<pr_diff>` XML tags. End with a final instruction restatement.

**Agent 2 (Code Quality):** Focus areas in priority order: bugs, readability, TypeScript best practices, Lit/Web Components best practices, clean code structure. Uses `<pr_diff>` XML tag only. End with final instruction restatement.

**Agent 3 (Consolidator):** Must deduplicate, filter low-confidence, filter noise, verify grounding (file/line exists), sort by severity, add `category` field, write German summary. Uses `<agent_1_findings>` and `<agent_2_findings>` XML tags. End with final instruction restatement.

```js
const SHARED_CONSTRAINTS = `You are reviewing a pull request for a Design System built with TypeScript, Lit (Web Components), and SCSS.

RULES:
- Output valid JSON only. No markdown, no wrapping, no explanation outside the JSON.
- Never praise the code. No "looks good", no "well done", no "LGTM".
- Only report findings you are confident about. If unsure, omit.
- Every finding must reference a specific file and line number from the diff.
- Findings without a concrete location in the diff are not findings — discard them.
- Detail must be 1-3 sentences maximum.
- Titles must be in German. Detail and suggestion may use English for technical terms.`;

const SYSTEM_PROMPTS = {
  akAbgleich: `${SHARED_CONSTRAINTS}

TASK: You are the Akzeptanzkriterien (AK) reviewer. Compare the PR diff against the Jira ticket's Akzeptanzkriterien.

PROCESS:
1. Read the Jira ticket description and extract all identifiable Akzeptanzkriterien (they may appear as bullet points, numbered lists, "Given/When/Then" blocks, or prose requirements).
2. For each AK, check whether the PR diff satisfies it — fully, partially, or not at all.
3. Report only gaps: AK that are not satisfied or only partially implemented.

If the Jira ticket description contains no identifiable Akzeptanzkriterien (e.g., it is empty, purely technical notes, or just a title), output: { "findings": [] }

OUTPUT FORMAT — each finding:
{
  "severity": "critical | important | minor",
  "title": "Short German summary of the gap",
  "file": "file path from the diff",
  "line": <line number from the diff>,
  "detail": "Which AK is affected and what is missing (1-3 sentences)",
  "suggestion": "Concrete next step to close the gap"
}

SEVERITY:
- critical: AK completely unaddressed — a required feature or behavior is entirely missing
- important: AK partially addressed — main path works but a key edge case or scenario is missing
- minor: AK addressed but implementation differs from spec in a small way

SCOPE: Do NOT comment on code quality, style, structure, naming, or patterns. Only check AK coverage.

Output: { "findings": [...] }`,

  codeQuality: `${SHARED_CONSTRAINTS}

TASK: You are the code quality reviewer. Review the PR diff for code quality issues.

FOCUS AREAS (in priority order):
1. Bugs or logical errors — off-by-one, null/undefined access, race conditions, broken control flow
2. Readability and maintainability — confusing logic, deeply nested code, unclear intent, functions doing too much
3. TypeScript best practices — strict typing (no 'any'), proper generics, correct error handling, type guards over type assertions
4. Lit / Web Components best practices — proper lifecycle usage, reactive property declarations, efficient rendering, shadow DOM patterns, event handling
5. Clean code structure — single responsibility, sensible naming, DRY (not premature abstraction)

OUTPUT FORMAT — each finding:
{
  "severity": "critical | important | minor",
  "title": "Short German summary of the issue",
  "file": "file path from the diff",
  "line": <line number from the diff>,
  "detail": "What is wrong and why it matters (1-3 sentences)",
  "suggestion": "How to fix it, with a brief code hint if helpful"
}

SEVERITY:
- critical: Bug, data loss risk, or broken functionality — will fail at runtime
- important: Structural problem hurting maintainability, missing error handling for likely failures, type safety holes
- minor: Naming improvements, small readability wins, minor style inconsistencies

SCOPE: Do NOT check Akzeptanzkriterien, design tokens, or accessibility. Focus only on code quality.

Do NOT suggest features, abstractions, or patterns not needed for the current change (YAGNI).

Output: { "findings": [...] }`,

  consolidator: `${SHARED_CONSTRAINTS}

TASK: You receive findings from two code review agents. Produce the final review report.

PROCESS (in order):
1. DEDUPLICATE: If both agents flagged the same underlying issue, keep the better-written finding (clearer title, more specific detail) and discard the other.
2. FILTER LOW-CONFIDENCE: Remove anything vague, speculative, or hedging ("might cause issues", "could potentially lead to...").
3. FILTER NOISE: Remove trivial nitpicks that a senior engineer would ignore (micro-style preferences, optional semicolons, import ordering).
4. VERIFY GROUNDING: Each finding must reference a real file and line. If a finding mentions a file or line that does not exist in the provided context, the specialist agent hallucinated it — discard it.
5. SORT: critical first, then important, then minor.
6. ADD CATEGORY: Tag each finding from Agent 1 with "category": "ak-abgleich" and each finding from Agent 2 with "category": "code-quality".
7. WRITE SUMMARY: A concise German summary, e.g., "3 Auffälligkeiten: 1 Kritisch, 1 Wichtig, 1 Gering"

OUTPUT FORMAT:
{
  "findings": [
    {
      "severity": "critical | important | minor",
      "category": "ak-abgleich | code-quality",
      "title": "...",
      "file": "...",
      "line": <number>,
      "detail": "...",
      "suggestion": "..."
    }
  ],
  "summary": "German summary string"
}

If no findings survive filtering, output: { "findings": [], "summary": "Keine Auffälligkeiten" }`,
};
```

Update `module.exports` to include `SYSTEM_PROMPTS`.

- [ ] **Step 2: Commit**

```bash
git add proxy/cosi.js
git commit -m "feat(cosi): add agent system prompts"
```

### Task 3: Add `runReview` orchestration to `proxy/cosi.js`

**Files:**
- Modify: `proxy/cosi.js`
- Modify: `proxy/cosi.test.js`

- [ ] **Step 1: Write tests for runReview**

Add to `proxy/cosi.test.js`:

```js
describe('runReview', () => {
  beforeEach(() => {
    process.env.COSI_API_KEY = 'test-key';
    process.env.COSI_BASE_URL = 'https://cosi.test/generate';
  });

  it('orchestrates parallel agents and consolidation', async () => {
    const agent1Result = { findings: [{ severity: 'critical', title: 'AK #1 fehlt', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' }] };
    const agent2Result = { findings: [{ severity: 'minor', title: 'Naming', file: 'b.ts', line: 5, detail: 'd', suggestion: 's' }] };
    const consolidatedResult = {
      findings: [
        { severity: 'critical', category: 'ak-abgleich', title: 'AK #1 fehlt', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' },
        { severity: 'minor', category: 'code-quality', title: 'Naming', file: 'b.ts', line: 5, detail: 'd', suggestion: 's' },
      ],
      summary: '2 Auffälligkeiten: 1 Kritisch, 0 Wichtig, 1 Gering',
    };

    let callCount = 0;
    mock.method(global, 'fetch', () => {
      callCount++;
      const result = callCount <= 2
        ? (callCount === 1 ? agent1Result : agent2Result)
        : consolidatedResult;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }],
        }),
      });
    });

    const { runReview } = freshRequire();
    const result = await runReview('diff content', { key: 'DS-1', summary: 'Test', description: 'AK: something' });

    assert.equal(result.findings.length, 2);
    assert.equal(result.summary, '2 Auffälligkeiten: 1 Kritisch, 0 Wichtig, 1 Gering');
    assert.ok(Array.isArray(result.warnings));
    assert.equal(result.warnings.length, 0);
    assert.ok(result.reviewedAt);
    assert.equal(callCount, 3);
  });

  it('returns partial result when agent 1 fails', async () => {
    const agent2Result = { findings: [{ severity: 'minor', title: 'Test', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' }] };
    const consolidatedResult = {
      findings: [{ severity: 'minor', category: 'code-quality', title: 'Test', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' }],
      summary: '1 Auffälligkeit: 0 Kritisch, 0 Wichtig, 1 Gering',
    };

    let callCount = 0;
    mock.method(global, 'fetch', () => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('error') });
      }
      const result = callCount === 2 ? agent2Result : consolidatedResult;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }],
        }),
      });
    });

    const { runReview } = freshRequire();
    const result = await runReview('diff content', { key: 'DS-1', summary: 'Test', description: 'desc' });

    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /AK-Abgleich/);
  });

  it('skips agent 1 when no jira ticket provided', async () => {
    const agent2Result = { findings: [] };
    const consolidatedResult = { findings: [], summary: 'Keine Auffälligkeiten' };

    let callCount = 0;
    mock.method(global, 'fetch', () => {
      callCount++;
      const result = callCount === 1 ? agent2Result : consolidatedResult;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }],
        }),
      });
    });

    const { runReview } = freshRequire();
    const result = await runReview('diff content', null);

    assert.equal(callCount, 2);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /Kein Jira-Ticket/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test proxy/cosi.test.js`
Expected: FAIL — `runReview is not a function`

- [ ] **Step 3: Implement runReview**

Add to `proxy/cosi.js`:

```js
function buildAgent1Prompt(diff, jiraTicket) {
  return `<jira_ticket>
Key: ${jiraTicket.key}
Summary: ${jiraTicket.summary}
Description:
${jiraTicket.description}
</jira_ticket>

<pr_diff>
${diff}
</pr_diff>

Based on the above, identify gaps between the Akzeptanzkriterien and the implementation. Output JSON only.`;
}

function buildAgent2Prompt(diff) {
  return `<pr_diff>
${diff}
</pr_diff>

Based on the above, identify code quality issues. Output JSON only.`;
}

function buildConsolidatorPrompt(agent1Findings, agent2Findings) {
  return `<agent_1_findings>
${JSON.stringify(agent1Findings)}
</agent_1_findings>

<agent_2_findings>
${JSON.stringify(agent2Findings)}
</agent_2_findings>

Deduplicate, filter, sort, categorize, and write the summary. Output JSON only.`;
}

async function runReview(diff, jiraTicket) {
  const warnings = [];

  const agentCalls = [];

  if (jiraTicket) {
    agentCalls.push(
      callCoSi(buildAgent1Prompt(diff, jiraTicket), SYSTEM_PROMPTS.akAbgleich, { temperature: 0.2 })
        .catch((err) => {
          warnings.push(`Agent 1 (AK-Abgleich) fehlgeschlagen: ${err.message}`);
          return { findings: [] };
        })
    );
  } else {
    warnings.push('Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft.');
    agentCalls.push(Promise.resolve({ findings: [] }));
  }

  agentCalls.push(
    callCoSi(buildAgent2Prompt(diff), SYSTEM_PROMPTS.codeQuality, { temperature: 0.4 })
      .catch((err) => {
        warnings.push(`Agent 2 (Code-Qualität) fehlgeschlagen: ${err.message}`);
        return { findings: [] };
      })
  );

  const [agent1Result, agent2Result] = await Promise.all(agentCalls);

  const consolidated = await callCoSi(
    buildConsolidatorPrompt(agent1Result, agent2Result),
    SYSTEM_PROMPTS.consolidator,
    { temperature: 0.2 },
  );

  return {
    findings: consolidated.findings || [],
    summary: consolidated.summary || 'Keine Auffälligkeiten',
    warnings,
    reviewedAt: new Date().toISOString(),
  };
}
```

Update `module.exports` to include `runReview`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test proxy/cosi.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add proxy/cosi.js proxy/cosi.test.js
git commit -m "feat(cosi): add runReview orchestration with tests"
```

### Task 4: Add `/api/cosi/review` route to `proxy/index.js`

**Files:**
- Modify: `proxy/index.js`

- [ ] **Step 1: Add route**

**Important:** The global `app.use(express.json())` on line 20 of `proxy/index.js` uses the default 100KB limit. Since it fires before any route-level middleware, a route-level `express.json({ limit: '2mb' })` would be a no-op — the body is already parsed (or rejected) by the global middleware. Fix: register the CoSi route **before** the global `express.json()`, with its own body parser.

In `proxy/index.js`, add the require at the top (after existing requires):

```js
const { runReview } = require('./cosi');
```

Add the CoSi route **before** the existing `app.use(express.json())` line:

```js
// CoSi review route — registered before global express.json() to use its own 2MB limit
app.post('/api/cosi/review', express.json({ limit: '2mb' }), async (req, res) => {
  const { diff, jiraTicket } = req.body;

  if (!diff || typeof diff !== 'string') {
    return res.status(400).json({ error: 'diff is required and must be a string' });
  }

  try {
    const result = await runReview(diff, jiraTicket || null);
    res.json(result);
  } catch (err) {
    console.error('[CoSi Review] Error:', err);
    res.status(502).json({ error: 'Review fehlgeschlagen: ' + err.message });
  }
});

// Global body parser for all other routes (100KB default)
app.use(express.json());
```

Remove the existing `app.use(express.json())` line that's currently on line 20, since it's now placed after the CoSi route.

Also add a soft warning for missing `COSI_API_KEY` after the existing env validation block (not as a hard exit):

```js
if (!process.env.COSI_API_KEY) {
  console.warn('WARNING: COSI_API_KEY not set — KI-Review feature will not work');
}
```

- [ ] **Step 2: Verify the proxy starts**

Run: `node proxy/index.js` (with a `.env` that has the existing vars)
Expected: Server starts without error, warning about missing COSI_API_KEY is acceptable

- [ ] **Step 3: Commit**

```bash
git add proxy/index.js
git commit -m "feat(cosi): add /api/cosi/review route to proxy"
```

---


## Chunk 2: Frontend — Types & Service

### Task 5: Create review types

**Files:**
- Create: `src/app/models/review.model.ts`

- [ ] **Step 1: Create the types file**

```typescript
export interface ReviewFinding {
  severity: 'critical' | 'important' | 'minor';
  category: 'ak-abgleich' | 'code-quality';
  title: string;
  file: string;
  line: number;
  detail: string;
  suggestion: string;
}

export interface ReviewResult {
  findings: ReviewFinding[];
  summary: string;
  warnings: string[];
  reviewedAt: string;
}

export type ReviewState =
  | 'idle'
  | 'loading'
  | { status: 'result'; data: ReviewResult }
  | { status: 'error'; message: string };
```

- [ ] **Step 2: Commit**

```bash
git add src/app/models/review.model.ts
git commit -m "feat(cosi): add ReviewFinding, ReviewResult, ReviewState types"
```

### Task 6: Create CosiReviewService with tests

**Files:**
- Create: `src/app/services/cosi-review.service.ts`
- Create: `src/app/services/cosi-review.service.spec.ts`

The service uses a `Subject` to communicate the review trigger from the action rail to the PR detail component. This avoids a stale-trigger-signal problem where a non-zero signal value would re-fire effects on subsequent PR loads.

- [ ] **Step 1: Write failing tests**

Create `src/app/services/cosi-review.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CosiReviewService } from './cosi-review.service';
import { JiraTicket } from '../models/work-item.model';
import { ReviewResult } from '../models/review.model';

function makeTicket(overrides: Partial<JiraTicket> = {}): JiraTicket {
  return {
    type: 'ticket', id: '1', key: 'DS-1', summary: 'Test', issueType: 'Story',
    status: 'In Progress', priority: 'Medium', assignee: '', reporter: '', creator: '',
    description: 'AK: something', dueDate: null, createdAt: '', updatedAt: '',
    url: '', labels: [], project: null, components: [],
    comments: [], attachments: [], relations: [], epicLink: null,
    ...overrides,
  } as JiraTicket;
}

describe('CosiReviewService', () => {
  let service: CosiReviewService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CosiReviewService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts in idle state', () => {
    expect(service.reviewState()).toBe('idle');
  });

  it('transitions to loading then result on success', () => {
    const mockResult: ReviewResult = {
      findings: [],
      summary: 'Keine Auffälligkeiten',
      warnings: [],
      reviewedAt: '2026-03-18T14:00:00Z',
    };

    service.requestReview('diff text', makeTicket());
    expect(service.reviewState()).toBe('loading');

    const req = httpMock.expectOne(r => r.url.includes('/api/cosi/review'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.diff).toBe('diff text');
    expect(req.request.body.jiraTicket.key).toBe('DS-1');
    req.flush(mockResult);

    const state = service.reviewState();
    expect(typeof state).toBe('object');
    expect((state as any).status).toBe('result');
    expect((state as any).data.summary).toBe('Keine Auffälligkeiten');
  });

  it('transitions to error on failure', () => {
    service.requestReview('diff', makeTicket());

    const req = httpMock.expectOne(r => r.url.includes('/api/cosi/review'));
    req.flush('Server Error', { status: 502, statusText: 'Bad Gateway' });

    const state = service.reviewState();
    expect(typeof state).toBe('object');
    expect((state as any).status).toBe('error');
  });

  it('sends null jiraTicket when no ticket provided', () => {
    service.requestReview('diff', null);

    const req = httpMock.expectOne(r => r.url.includes('/api/cosi/review'));
    expect(req.request.body.jiraTicket).toBeNull();
    req.flush({ findings: [], summary: 'Keine Auffälligkeiten', warnings: ['Kein Jira-Ticket'], reviewedAt: '' });
  });

  it('resets to idle via reset()', () => {
    service.requestReview('diff', makeTicket());
    httpMock.expectOne(r => r.url.includes('/api/cosi/review')).flush({
      findings: [], summary: '', warnings: [], reviewedAt: '',
    });

    service.reset();
    expect(service.reviewState()).toBe('idle');
  });

  it('emits on reviewRequested$ when triggerReview is called', () => {
    let emitted = false;
    service.reviewRequested$.subscribe(() => emitted = true);
    service.triggerReview();
    expect(emitted).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `ng test --no-watch`
Expected: FAIL — `CosiReviewService` not found

- [ ] **Step 3: Implement the service**

Create `src/app/services/cosi-review.service.ts`:

```typescript
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { JiraTicket } from '../models/work-item.model';
import { ReviewResult, ReviewState } from '../models/review.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CosiReviewService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/api/cosi/review`;
  private readonly reviewRequestedSubject = new Subject<void>();

  readonly reviewState = signal<ReviewState>('idle');
  readonly reviewRequested$ = this.reviewRequestedSubject.asObservable();

  triggerReview(): void {
    this.reviewRequestedSubject.next();
  }

  requestReview(diff: string, jiraTicket: JiraTicket | null): void {
    this.reviewState.set('loading');

    const body = {
      diff,
      jiraTicket: jiraTicket
        ? { key: jiraTicket.key, summary: jiraTicket.summary, description: jiraTicket.description }
        : null,
    };

    this.http.post<ReviewResult>(this.baseUrl, body).subscribe({
      next: (result) => this.reviewState.set({ status: 'result', data: result }),
      error: (err) => this.reviewState.set({ status: 'error', message: err.message || 'Review fehlgeschlagen' }),
    });
  }

  reset(): void {
    this.reviewState.set('idle');
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `ng test --no-watch`
Expected: All CosiReviewService tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/services/cosi-review.service.ts src/app/services/cosi-review.service.spec.ts
git commit -m "feat(cosi): add CosiReviewService with Subject-based trigger and tests"
```

---

## Chunk 3: Frontend — UI Integration

### Task 7: Add KI-Review button to action rail

**Files:**
- Modify: `src/app/components/action-rail/action-rail.ts`
- Modify: `src/app/components/action-rail/action-rail.spec.ts`

The action rail button calls `cosiReview.triggerReview()` on click. It does NOT have access to the diff or Jira ticket data — the PR detail component subscribes to `reviewRequested$` and provides that data. The button's disable logic is based only on `reviewState` (not diff/ticket loading), since the PR detail's subscription handler guards against calling review with incomplete data (it ignores the trigger if data isn't ready yet).

- [ ] **Step 1: Write failing tests**

Add to `action-rail.spec.ts`. The existing `setup` function provides mocked providers. Add `CosiReviewService` to the mocks.

Add imports:
```typescript
import { CosiReviewService } from '../../services/cosi-review.service';
import { PullRequest } from '../../models/work-item.model';
import { ReviewState } from '../../models/review.model';
```

Add PR factory:
```typescript
const makePr = (overrides: Partial<PullRequest> = {}): PullRequest => ({
  type: 'pr', id: '1', prNumber: 1, title: 'Test PR', description: '',
  state: 'OPEN', open: true, closed: false, locked: false, isDraft: false,
  createdDate: 0, updatedDate: 0,
  fromRef: { id: 'refs/heads/feat', displayId: 'feat', latestCommit: 'abc', repository: { id: 1, slug: 'repo', name: 'repo', projectKey: 'P', projectName: 'P', browseUrl: '' } },
  toRef: { id: 'refs/heads/main', displayId: 'main', latestCommit: 'def', repository: { id: 1, slug: 'repo', name: 'repo', projectKey: 'P', projectName: 'P', browseUrl: '' } },
  author: { user: { id: 1, name: 'u', displayName: 'User', emailAddress: '', slug: 'u', active: true, type: 'NORMAL', profileUrl: '' }, role: 'AUTHOR', approved: false, status: 'UNAPPROVED' },
  reviewers: [], participants: [],
  commentCount: 0, openTaskCount: 0, url: '', myReviewStatus: 'Awaiting Review',
  ...overrides,
} as PullRequest);
```

Update the existing `setup` function to include a `CosiReviewService` mock. Add to the providers array:

```typescript
const mockCosiReview = {
  reviewState: signal<ReviewState>('idle'),
  triggerReview: vi.fn(),
};

// In providers:
{ provide: CosiReviewService, useValue: mockCosiReview },
```

Return `mockCosiReview` from `setup` alongside existing return values.

Add tests:

```typescript
it('shows KI-Review button when PR is selected', () => {
  const { fixture } = setup(makePr());
  const buttons = fixture.nativeElement.querySelectorAll('button');
  const labels = Array.from(buttons).map((b: unknown) => (b as Element).textContent?.trim());
  expect(labels.some(l => l?.includes('KI-Review starten'))).toBe(true);
});

it('shows In Bitbucket öffnen link when PR is selected', () => {
  const { fixture } = setup(makePr({ url: 'https://bb.example.com/pr/1' }));
  const link = fixture.nativeElement.querySelector('a');
  expect(link?.textContent?.trim()).toContain('In Bitbucket öffnen');
});

it('disables KI-Review button and shows loading text during review', () => {
  const { fixture, mockCosiReview } = setup(makePr());
  mockCosiReview.reviewState.set('loading');
  fixture.detectChanges();

  const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
  const reviewBtn = buttons.find(b => b.textContent?.includes('Review läuft'));
  expect(reviewBtn).toBeTruthy();
  expect(reviewBtn?.disabled).toBe(true);
});

it('shows "Erneut reviewen" after review completes', () => {
  const { fixture, mockCosiReview } = setup(makePr());
  mockCosiReview.reviewState.set({
    status: 'result',
    data: { findings: [], summary: 'Keine Auffälligkeiten', warnings: [], reviewedAt: '' },
  });
  fixture.detectChanges();

  const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
  const reviewBtn = buttons.find(b => b.textContent?.includes('Erneut reviewen'));
  expect(reviewBtn).toBeTruthy();
});

it('calls triggerReview on button click', () => {
  const { fixture, mockCosiReview } = setup(makePr());
  const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
  const reviewBtn = buttons.find(b => b.textContent?.includes('KI-Review starten'));
  reviewBtn?.click();
  expect(mockCosiReview.triggerReview).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `ng test --no-watch`
Expected: FAIL — KI-Review button doesn't exist in the template

- [ ] **Step 3: Implement the button**

Modify `action-rail.ts`:

Add import:
```typescript
import { CosiReviewService } from '../../services/cosi-review.service';
```

Add injection:
```typescript
private readonly cosiReview = inject(CosiReviewService);
```

Add template in the `@if (item?.type === 'pr')` block, **before** the Bitbucket link:

```html
@let review = cosiReview.reviewState();
<button type="button"
  class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center"
  [class]="review === 'idle' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300'"
  [disabled]="review === 'loading'"
  (click)="cosiReview.triggerReview()">
  @if (review === 'loading') {
    <span class="animate-pulse">Review läuft...</span>
  } @else if (review === 'idle') {
    KI-Review starten
  } @else {
    Erneut reviewen
  }
</button>
```

The click handler calls `cosiReview.triggerReview()` directly — no intermediate method needed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `ng test --no-watch`
Expected: All action-rail tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/components/action-rail/action-rail.ts src/app/components/action-rail/action-rail.spec.ts
git commit -m "feat(cosi): add KI-Review button to action rail"
```

### Task 8: Create ReviewFindingsComponent

**Files:**
- Create: `src/app/components/review-findings/review-findings.ts`
- Create: `src/app/components/review-findings/review-findings.spec.ts`

Extracted into its own component to keep `pr-detail.ts` focused (~320 lines already). Takes `reviewState` as an input and handles all rendering and expand/collapse logic independently.

- [ ] **Step 1: Write failing tests**

Create `src/app/components/review-findings/review-findings.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { ReviewFindingsComponent } from './review-findings';
import { ReviewState, ReviewFinding } from '../../models/review.model';

const makeFinding = (overrides: Partial<ReviewFinding> = {}): ReviewFinding => ({
  severity: 'important',
  category: 'code-quality',
  title: 'Test finding',
  file: 'test.ts',
  line: 10,
  detail: 'Some detail',
  suggestion: 'Fix it',
  ...overrides,
});

describe('ReviewFindingsComponent', () => {
  function setup(state: ReviewState) {
    TestBed.configureTestingModule({ imports: [ReviewFindingsComponent] });
    const fixture = TestBed.createComponent(ReviewFindingsComponent);
    fixture.componentRef.setInput('reviewState', state);
    fixture.detectChanges();
    return fixture;
  }

  it('does not render content when idle', () => {
    const fixture = setup('idle');
    expect(fixture.nativeElement.querySelector('[aria-labelledby="pr-review-heading"]')).toBeNull();
  });

  it('shows loading state', () => {
    const fixture = setup('loading');
    expect(fixture.nativeElement.textContent).toContain('KI-Review läuft');
  });

  it('shows error state', () => {
    const fixture = setup({ status: 'error', message: 'fail' });
    expect(fixture.nativeElement.textContent).toContain('Review konnte nicht durchgeführt werden');
  });

  it('shows empty state when no findings', () => {
    const fixture = setup({
      status: 'result',
      data: { findings: [], summary: 'Keine Auffälligkeiten', warnings: [], reviewedAt: '' },
    });
    expect(fixture.nativeElement.textContent).toContain('Keine Auffälligkeiten gefunden');
  });

  it('renders findings as list items', () => {
    const fixture = setup({
      status: 'result',
      data: {
        findings: [
          makeFinding({ severity: 'critical', title: 'Critical bug' }),
          makeFinding({ severity: 'minor', title: 'Small thing' }),
        ],
        summary: '2 Auffälligkeiten',
        warnings: [],
        reviewedAt: '',
      },
    });
    const listItems = fixture.nativeElement.querySelectorAll('[role="listitem"]');
    expect(listItems.length).toBe(2);
  });

  it('expands critical findings by default', () => {
    const fixture = setup({
      status: 'result',
      data: {
        findings: [makeFinding({ severity: 'critical', detail: 'Critical detail text' })],
        summary: '1', warnings: [], reviewedAt: '',
      },
    });
    expect(fixture.nativeElement.textContent).toContain('Critical detail text');
  });

  it('collapses non-critical findings by default', () => {
    const fixture = setup({
      status: 'result',
      data: {
        findings: [makeFinding({ severity: 'minor', detail: 'Minor detail text' })],
        summary: '1', warnings: [], reviewedAt: '',
      },
    });
    expect(fixture.nativeElement.textContent).not.toContain('Minor detail text');
  });

  it('toggles finding detail on click', () => {
    const fixture = setup({
      status: 'result',
      data: {
        findings: [makeFinding({ severity: 'minor', detail: 'Toggled detail' })],
        summary: '1', warnings: [], reviewedAt: '',
      },
    });
    expect(fixture.nativeElement.textContent).not.toContain('Toggled detail');

    const button = fixture.nativeElement.querySelector('[role="listitem"] button');
    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Toggled detail');
  });

  it('shows warnings when present', () => {
    const fixture = setup({
      status: 'result',
      data: {
        findings: [],
        summary: 'Keine Auffälligkeiten',
        warnings: ['Agent 1 fehlgeschlagen'],
        reviewedAt: '',
      },
    });
    expect(fixture.nativeElement.textContent).toContain('Agent 1 fehlgeschlagen');
  });

  it('shows summary text', () => {
    const fixture = setup({
      status: 'result',
      data: {
        findings: [makeFinding()],
        summary: '1 Auffälligkeit: 0 Kritisch, 1 Wichtig, 0 Gering',
        warnings: [],
        reviewedAt: '',
      },
    });
    expect(fixture.nativeElement.textContent).toContain('1 Auffälligkeit');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `ng test --no-watch`
Expected: FAIL — `ReviewFindingsComponent` not found

- [ ] **Step 3: Implement the component**

Create `src/app/components/review-findings/review-findings.ts`:

```typescript
import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { ReviewState } from '../../models/review.model';

@Component({
  selector: 'app-review-findings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`:host { display: block; }`],
  template: `
    @let review = reviewState();
    @if (review !== 'idle') {
      <section class="border-b border-stone-100" aria-labelledby="pr-review-heading">
        <div class="max-w-2xl mx-auto px-6 py-5">
          <div class="flex items-center justify-between mb-3">
            <h2 id="pr-review-heading" class="text-xs font-semibold text-stone-400 uppercase tracking-wider">KI-Review</h2>
            @if (review !== 'loading' && review.status === 'result') {
              <span class="text-xs text-stone-400">{{ review.data.summary }}</span>
            }
          </div>

          @if (review === 'loading') {
            <p class="text-sm text-stone-400 italic">KI-Review läuft...</p>
          } @else if (review.status === 'error') {
            <p class="text-sm text-stone-400 italic">Review konnte nicht durchgeführt werden.</p>
          } @else if (review.status === 'result') {
            @if (review.data.warnings.length > 0) {
              @for (warning of review.data.warnings; track warning) {
                <p class="text-xs text-amber-600 mb-2">{{ warning }}</p>
              }
            }

            @if (review.data.findings.length === 0) {
              <p class="text-sm text-emerald-600">Keine Auffälligkeiten gefunden.</p>
            } @else {
              <div role="list" aria-label="Review-Ergebnisse">
                @for (finding of review.data.findings; track $index) {
                  <div role="listitem" class="border-b border-stone-200 last:border-b-0">
                    <button
                      type="button"
                      class="w-full text-left py-2.5 flex items-start gap-2 cursor-pointer hover:bg-stone-50 -mx-1 px-1 rounded"
                      [attr.aria-expanded]="isFindingExpanded($index, finding.severity)"
                      (click)="toggleFinding($index, finding.severity)"
                    >
                      <span
                        class="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        [class]="severityDotClass(finding.severity)"
                        aria-hidden="true"
                      ></span>
                      <span class="text-sm font-medium text-stone-800 flex-1 min-w-0">{{ finding.title }}</span>
                      <span class="font-mono text-xs text-stone-400 shrink-0">{{ finding.file }}:{{ finding.line }}</span>
                    </button>

                    @if (isFindingExpanded($index, finding.severity)) {
                      <div class="ml-4 mb-2.5 px-3 py-2 bg-stone-100 rounded text-xs text-stone-500 leading-relaxed">
                        <p>{{ finding.detail }}</p>
                        @if (finding.suggestion) {
                          <p class="mt-1"><span class="font-medium text-stone-600">Vorschlag:</span> {{ finding.suggestion }}</p>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }
          }
        </div>
      </section>
    }
  `,
})
export class ReviewFindingsComponent {
  reviewState = input.required<ReviewState>();

  private readonly expandedNonCritical = signal<Set<number>>(new Set());
  private readonly collapsedCritical = signal<Set<number>>(new Set());

  isFindingExpanded(index: number, severity: string): boolean {
    if (severity === 'critical') {
      return !this.collapsedCritical().has(index);
    }
    return this.expandedNonCritical().has(index);
  }

  toggleFinding(index: number, severity: string): void {
    if (severity === 'critical') {
      this.collapsedCritical.update(set => {
        const next = new Set(set);
        next.has(index) ? next.delete(index) : next.add(index);
        return next;
      });
    } else {
      this.expandedNonCritical.update(set => {
        const next = new Set(set);
        next.has(index) ? next.delete(index) : next.add(index);
        return next;
      });
    }
  }

  severityDotClass(severity: string): string {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'important': return 'bg-amber-500';
      default: return 'bg-stone-400';
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `ng test --no-watch`
Expected: All ReviewFindingsComponent tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/components/review-findings/review-findings.ts src/app/components/review-findings/review-findings.spec.ts
git commit -m "feat(cosi): add ReviewFindingsComponent with expand/collapse and tests"
```

### Task 9: Wire up review trigger in PR detail

**Files:**
- Modify: `src/app/components/pr-detail/pr-detail.ts`
- Modify: `src/app/components/pr-detail/pr-detail.spec.ts`

The PR detail component subscribes to `reviewRequested$` from `CosiReviewService`, gathers the local diff and ticket data, and calls `requestReview`. It embeds the `ReviewFindingsComponent` and resets review state when the PR changes. Using `takeUntilDestroyed` and RxJS subscription (not an `effect`) avoids the stale-trigger and effect-ordering problems.

- [ ] **Step 1: Write failing tests**

Add to `pr-detail.spec.ts`. The exact test setup depends on existing patterns in the file. Add `CosiReviewService` to the test providers as a mock:

```typescript
const mockCosiReview = {
  reviewState: signal<ReviewState>('idle'),
  reviewRequested$: new Subject<void>(),
  requestReview: vi.fn(),
  reset: vi.fn(),
};

// In providers:
{ provide: CosiReviewService, useValue: mockCosiReview },
```

Tests:

```typescript
it('embeds app-review-findings component', () => {
  mockCosiReview.reviewState.set('loading');
  fixture.detectChanges();
  const el = fixture.nativeElement.querySelector('app-review-findings');
  expect(el).toBeTruthy();
});

it('resets review state when PR changes', () => {
  // Change the PR input
  fixture.componentRef.setInput('pr', makePr({ id: '2', title: 'New PR' }));
  fixture.detectChanges();
  expect(mockCosiReview.reset).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `ng test --no-watch`
Expected: FAIL — `app-review-findings` not found in template

- [ ] **Step 3: Implement the wiring**

In `pr-detail.ts`:

Add imports:
```typescript
import { CosiReviewService } from '../../services/cosi-review.service';
import { ReviewFindingsComponent } from '../review-findings/review-findings';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
```

Add `ReviewFindingsComponent` to `imports` array in `@Component` decorator:
```typescript
imports: [DatePipe, JiraMarkupPipe, JiraPrCardComponent, ReviewFindingsComponent],
```

Add injections to the component class:
```typescript
private readonly cosiReview = inject(CosiReviewService);
private readonly destroyRef = inject(DestroyRef);
```

Add subscriptions in `constructor()` (after the existing hljs registration block):

```typescript
// Handle review trigger from action rail
this.cosiReview.reviewRequested$.pipe(
  takeUntilDestroyed(this.destroyRef),
).subscribe(() => {
  const diff = this.diffData();
  if (diff === 'loading' || diff === 'error') return;

  const ticket = this.jiraTicket();
  const resolvedTicket = (ticket !== 'loading' && ticket !== 'error' && ticket !== 'no-ticket') ? ticket : null;

  this.cosiReview.requestReview(diff, resolvedTicket);
});

// Reset review state when PR changes
toObservable(this.pr).pipe(
  takeUntilDestroyed(this.destroyRef),
).subscribe(() => this.cosiReview.reset());
```

Add the findings component to the template, **before** the diff section (`aria-labelledby="pr-diff-heading"`):

```html
<app-review-findings [reviewState]="cosiReview.reviewState()" />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `ng test --no-watch`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/components/pr-detail/pr-detail.ts src/app/components/pr-detail/pr-detail.spec.ts
git commit -m "feat(cosi): wire up review trigger and findings component in PR detail"
```

### Task 10: Final integration verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `ng test --no-watch`
Expected: All tests PASS

- [ ] **Step 2: Run the app and verify visually**

Start the proxy: `node proxy/index.js`
Start the app: `ng serve`

1. Open Orbit, select a PR
2. Verify "KI-Review starten" button appears in the action rail
3. Verify button is styled indigo
4. If CoSi is not configured, clicking should show an error state gracefully

- [ ] **Step 3: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: cleanup after CoSi AI review integration"
```
