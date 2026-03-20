# CoSi Review Improvements — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pipeline transparency (SSE streaming, live timeline), redesign findings UI (file-grouped cards), and render inline code in finding descriptions.

**Architecture:** Backend switches from JSON POST to SSE streaming with `emit()` callbacks. Frontend consumes via `fetch()`+`ReadableStream`, builds pipeline state incrementally via signals. New `ReviewPipelineComponent` renders the timeline; `ReviewFindingsComponent` is rewritten with file-grouped card layout. An `InlineCodePipe` handles backtick→`<code>` rendering.

**Tech Stack:** Angular 20 (standalone, signals, zoneless), Express.js, Server-Sent Events, Tailwind CSS, Vitest

---

## Chunk 1: Backend — SSE Streaming & Consolidator Decisions

### Task 1: Refactor `runReview()` to use `emit()` callback

**Files:**
- Modify: `proxy/cosi.js`
- Test: `proxy/cosi.test.js`

- [ ] **Step 1: Write failing tests for emit-based `runReview()`**

Replace the existing `runReview` tests in `proxy/cosi.test.js`. The new tests verify that `emit()` is called with the correct event types and data at each pipeline step.

```js
// In the 'runReview' describe block, replace all existing tests with:

it('emits agent:start, agent:done for both agents and consolidator events', async () => {
  const agent1Result = { findings: [{ severity: 'critical', title: 'AK fehlt', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' }] };
  const agent2Result = { findings: [{ severity: 'minor', title: 'Naming', file: 'b.ts', line: 5, detail: 'd', suggestion: 's' }] };
  const consolidatedResult = {
    findings: [
      { severity: 'critical', category: 'ak-abgleich', title: 'AK fehlt', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' },
    ],
    summary: '1 Auffälligkeit',
    decisions: [{ action: 'kept', reason: 'Belegbar', finding: 'AK fehlt' }],
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
  const events = [];
  const emit = (type, data) => events.push({ type, data });
  await runReview('diff', { key: 'DS-1', summary: 'Test', description: 'AK' }, emit);

  const types = events.map(e => e.type);
  assert.ok(types.includes('agent:start'));
  assert.ok(types.includes('agent:done'));
  assert.ok(types.includes('consolidator:start'));
  assert.ok(types.includes('consolidator:done'));
  assert.ok(types.includes('done'));

  const agentStarts = events.filter(e => e.type === 'agent:start');
  assert.equal(agentStarts.length, 2);
  assert.equal(agentStarts[0].data.agent, 'ak-abgleich');
  assert.equal(agentStarts[1].data.agent, 'code-quality');

  const consolidatorDone = events.find(e => e.type === 'consolidator:done');
  assert.ok(consolidatorDone.data.result);
  assert.ok(Array.isArray(consolidatorDone.data.decisions));
  assert.ok(consolidatorDone.data.duration >= 0);
  assert.ok(consolidatorDone.data.result.reviewedAt);
});

it('emits warning and skips agent 1 when no jira ticket', async () => {
  const agent2Result = { findings: [] };

  mock.method(global, 'fetch', () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      candidates: [{ content: { parts: [{ text: JSON.stringify(agent2Result) }] } }],
    }),
  }));

  const { runReview } = freshRequire();
  const events = [];
  const emit = (type, data) => events.push({ type, data });
  await runReview('diff', null, emit);

  const warning = events.find(e => e.type === 'warning');
  assert.ok(warning);
  assert.match(warning.data.message, /Kein Jira-Ticket/);

  const agentStarts = events.filter(e => e.type === 'agent:start');
  assert.equal(agentStarts.length, 1);
  assert.equal(agentStarts[0].data.agent, 'code-quality');
});

it('emits agent:error when an agent fails', async () => {
  const agent2Result = { findings: [{ severity: 'minor', title: 'Test', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' }] };
  const consolidatedResult = {
    findings: [{ severity: 'minor', category: 'code-quality', title: 'Test', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' }],
    summary: '1 Auffälligkeit',
    decisions: [{ action: 'kept', reason: 'Valid', finding: 'Test' }],
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
  const events = [];
  const emit = (type, data) => events.push({ type, data });
  await runReview('diff', { key: 'DS-1', summary: 'T', description: 'd' }, emit);

  const agentError = events.find(e => e.type === 'agent:error');
  assert.ok(agentError);
  assert.equal(agentError.data.agent, 'ak-abgleich');
  assert.match(agentError.data.error, /500/);
});

it('emits done with empty result when no findings and skips consolidator', async () => {
  mock.method(global, 'fetch', () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      candidates: [{ content: { parts: [{ text: '{"findings":[]}' }] } }],
    }),
  }));

  const { runReview } = freshRequire();
  const events = [];
  const emit = (type, data) => events.push({ type, data });
  await runReview('diff', null, emit);

  const types = events.map(e => e.type);
  assert.ok(!types.includes('consolidator:start'));
  assert.ok(types.includes('done'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test proxy/cosi.test.js`
Expected: FAIL — `runReview` doesn't accept `emit` parameter yet.

- [ ] **Step 3: Implement emit-based `runReview()`**

Rewrite `runReview` in `proxy/cosi.js`:

```js
async function runReview(diff, jiraTicket, emit) {
  const warnings = [];

  if (!jiraTicket) {
    emit('warning', { message: 'Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft.' });
    warnings.push('Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft.');
  }

  const agentCalls = [];

  if (jiraTicket) {
    emit('agent:start', { agent: 'ak-abgleich', label: 'AK-Abgleich', temperature: 0.2 });
    const start = Date.now();
    agentCalls.push(
      callCoSi(buildAgent1Prompt(diff, jiraTicket), SYSTEM_PROMPTS.akAbgleich, { temperature: 0.2 })
        .then(result => {
          emit('agent:done', {
            agent: 'ak-abgleich',
            duration: Date.now() - start,
            findingCount: result.findings.length,
            summary: describeFindings(result.findings),
            rawResponse: result,
          });
          return result;
        })
        .catch(err => {
          emit('agent:error', { agent: 'ak-abgleich', error: err.message });
          warnings.push(`Agent 1 (AK-Abgleich) fehlgeschlagen: ${err.message}`);
          return { findings: [] };
        })
    );
  } else {
    agentCalls.push(Promise.resolve({ findings: [] }));
  }

  emit('agent:start', { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4 });
  const cqStart = Date.now();
  agentCalls.push(
    callCoSi(buildAgent2Prompt(diff), SYSTEM_PROMPTS.codeQuality, { temperature: 0.4 })
      .then(result => {
        emit('agent:done', {
          agent: 'code-quality',
          duration: Date.now() - cqStart,
          findingCount: result.findings.length,
          summary: describeFindings(result.findings),
          rawResponse: result,
        });
        return result;
      })
      .catch(err => {
        emit('agent:error', { agent: 'code-quality', error: err.message });
        warnings.push(`Agent 2 (Code-Qualität) fehlgeschlagen: ${err.message}`);
        return { findings: [] };
      })
  );

  const [agent1Result, agent2Result] = await Promise.all(agentCalls);

  const hasFindings = agent1Result.findings.length > 0 || agent2Result.findings.length > 0;
  if (!hasFindings) {
    // No consolidator needed — frontend handles missing consolidator:done
    // by constructing an empty ReviewResult from pipeline.warnings
    emit('done', {});
    return;
  }

  emit('consolidator:start', { temperature: 0.2 });
  const consStart = Date.now();
  const consolidated = await callCoSi(
    buildConsolidatorPrompt(agent1Result, agent2Result),
    SYSTEM_PROMPTS.consolidator,
    { temperature: 0.2 },
  );

  emit('consolidator:done', {
    duration: Date.now() - consStart,
    result: {
      findings: consolidated.findings || [],
      summary: consolidated.summary || 'Keine Auffälligkeiten',
      warnings,
      reviewedAt: new Date().toISOString(),
    },
    decisions: consolidated.decisions || [],
    summary: describeConsolidation(agent1Result, agent2Result, consolidated),
    rawResponse: consolidated,
  });

  emit('done', {});
}

function describeFindings(findings) {
  if (findings.length === 0) return 'Keine Findings';
  const titles = findings.map(f => f.title).join(', ');
  return `${findings.length} Finding${findings.length > 1 ? 's' : ''} — ${titles}`;
}

function describeConsolidation(agent1, agent2, consolidated) {
  const input = agent1.findings.length + agent2.findings.length;
  const output = (consolidated.findings || []).length;
  const removed = input - output;
  return `${input} → ${output} konsolidiert. ${removed} entfernt.`;
}
```

- [ ] **Step 4: Update consolidator prompt to request `decisions` array**

In `proxy/cosi.js`, update `SYSTEM_PROMPTS.consolidator`:

1. Add step 8 after "7. WRITE SUMMARY": `8. DECISIONS: For every finding from both agents, add a decision entry explaining what you did with it.`
2. Replace the existing OUTPUT FORMAT block (lines 129-143) with this expanded version:

```
OUTPUT FORMAT:
{
  "findings": [...],
  "summary": "German summary string",
  "decisions": [
    { "action": "kept", "reason": "Why this finding was kept", "finding": "Finding title" },
    { "action": "removed", "reason": "Why this was filtered", "finding": "Finding title" },
    { "action": "severity-changed", "reason": "Why severity changed", "finding": "Finding title", "oldSeverity": "important", "newSeverity": "minor" }
  ]
}
```

3. Keep the final line: `If no findings survive filtering, output: { "findings": [], "summary": "Keine Auffälligkeiten", "decisions": [...] }`

Note: The `module.exports` line stays as-is — `runReview` is still exported, the new `emit` parameter is just an additional argument.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test proxy/cosi.test.js`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add proxy/cosi.js proxy/cosi.test.js
git commit -m "feat(cosi): refactor runReview to emit SSE events with consolidator decisions"
```

### Task 2: Wire SSE streaming into Express endpoint

**Files:**
- Modify: `proxy/index.js`

- [ ] **Step 1: Replace JSON endpoint with SSE stream**

```js
app.post('/api/cosi/review', express.json({ limit: '2mb' }), async (req, res) => {
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
    if (COSI_API_KEY) {
      await runReview(diff, jiraTicket || null, emit);
    } else {
      await runMockReview(emit);
    }
  } catch (err) {
    console.error('[CoSi Review] Error:', err);
    emit('error', { message: 'Review fehlgeschlagen: ' + err.message });
  }

  res.end();
});
```

- [ ] **Step 2: Manually test with curl**

Run: `curl -X POST http://localhost:6201/api/cosi/review -H 'Content-Type: application/json' -d '{"diff":"test diff"}' --no-buffer`
Expected: SSE events stream in, ending with `event: done`.

- [ ] **Step 3: Commit**

```bash
git add proxy/index.js
git commit -m "feat(cosi): switch review endpoint to SSE streaming"
```

### Task 3: Refactor mock mode to emit SSE events

**Files:**
- Modify: `proxy/cosi-mock.js`
- Test: `proxy/cosi-mock.test.js`

- [ ] **Step 1: Write failing tests for emit-based mock**

Replace all tests in `proxy/cosi-mock.test.js`:

```js
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { runMockReview, setSkipDelays } = require('./cosi-mock');

describe('runMockReview', () => {
  before(() => setSkipDelays(true));
  it('emits correct event sequence', async () => {
    const events = [];
    const emit = (type, data) => events.push({ type, data });
    await runMockReview(emit);

    const types = events.map(e => e.type);
    assert.ok(types.includes('agent:start'));
    assert.ok(types.includes('done'));

    const lastEvent = events[events.length - 1];
    assert.equal(lastEvent.type, 'done');
  });

  it('emits agent:start for at least one agent', async () => {
    const events = [];
    await runMockReview((type, data) => events.push({ type, data }));

    const agentStarts = events.filter(e => e.type === 'agent:start');
    assert.ok(agentStarts.length >= 1);
    assert.ok(agentStarts.every(e => e.data.agent && e.data.label && typeof e.data.temperature === 'number'));
  });

  it('includes consolidator:done with result and decisions when findings exist', async () => {
    const allEvents = [];
    for (let i = 0; i < 20; i++) {
      const events = [];
      await runMockReview((type, data) => events.push({ type, data }));
      allEvents.push(...events);
    }

    const consolidatorDones = allEvents.filter(e => e.type === 'consolidator:done');
    assert.ok(consolidatorDones.length > 0, 'Expected at least one consolidator:done across 20 runs');
    const cd = consolidatorDones[0];
    assert.ok(cd.data.result);
    assert.ok(Array.isArray(cd.data.result.findings));
    assert.ok(Array.isArray(cd.data.decisions));
    assert.ok(typeof cd.data.duration === 'number');
    assert.ok(cd.data.result.reviewedAt);
  });

  it('emits agent:error for partial failure scenario', async () => {
    const allEvents = [];
    for (let i = 0; i < 30; i++) {
      const events = [];
      await runMockReview((type, data) => events.push({ type, data }));
      allEvents.push(...events);
    }

    const agentErrors = allEvents.filter(e => e.type === 'agent:error');
    assert.ok(agentErrors.length > 0, 'Expected at least one agent:error across 30 runs');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test proxy/cosi-mock.test.js`
Expected: FAIL — `runMockReview` doesn't accept `emit` yet.

- [ ] **Step 3: Rewrite `runMockReview()` with emit-based events**

Rewrite `proxy/cosi-mock.js` entirely:

```js
const SCENARIOS = [
  {
    name: 'Mehrere Findings (mixed)',
    agents: {
      akAbgleich: {
        findings: [
          { severity: 'critical', title: 'Hover-State für primären Button fehlt', file: 'src/components/button/button.styles.scss', line: 42, detail: 'Laut AK muss der primäre Button einen sichtbaren Hover-State haben. Die aktuelle Implementierung definiert keinen :hover-Selektor.', suggestion: 'Einen :hover-Selektor mit leicht abgedunkelter Hintergrundfarbe ergänzen.' },
        ],
      },
      codeQuality: {
        findings: [
          { severity: 'important', title: 'Typ-Assertion statt Type Guard', file: 'src/components/button/button.ts', line: 87, detail: 'Die Typ-Assertion `as ButtonVariant` umgeht die Typprüfung. Ein Type Guard wäre sicherer.', suggestion: 'Einen Type Guard `isButtonVariant()` implementieren.' },
          { severity: 'minor', title: 'Doppelte Berechnung in render()', file: 'src/components/button/button.ts', line: 112, detail: 'Die CSS-Klasse wird bei jedem Render-Zyklus neu berechnet.', suggestion: 'Berechnung in ein `willUpdate()` verschieben.' },
        ],
      },
    },
    consolidated: {
      findings: [
        { severity: 'critical', category: 'ak-abgleich', title: 'Hover-State für primären Button fehlt', file: 'src/components/button/button.styles.scss', line: 42, detail: 'Laut AK muss der primäre Button einen sichtbaren Hover-State haben. Die aktuelle Implementierung definiert keinen :hover-Selektor.', suggestion: 'Einen :hover-Selektor mit leicht abgedunkelter Hintergrundfarbe ergänzen.' },
        { severity: 'important', category: 'code-quality', title: 'Typ-Assertion statt Type Guard', file: 'src/components/button/button.ts', line: 87, detail: 'Die Typ-Assertion `as ButtonVariant` umgeht die Typprüfung.', suggestion: 'Type Guard `isButtonVariant()` implementieren.' },
        { severity: 'minor', category: 'code-quality', title: 'Doppelte Berechnung in render()', file: 'src/components/button/button.ts', line: 112, detail: 'Die CSS-Klasse wird bei jedem Render-Zyklus neu berechnet.', suggestion: 'Berechnung in `willUpdate()` verschieben.' },
      ],
      summary: '3 Auffälligkeiten: 1 Kritisch, 1 Wichtig, 1 Gering',
    },
    decisions: [
      { action: 'kept', reason: 'AK klar nicht umgesetzt, im Diff belegbar', finding: 'Hover-State für primären Button fehlt' },
      { action: 'kept', reason: 'Type-Safety-Lücke, Runtime-Risiko', finding: 'Typ-Assertion statt Type Guard' },
      { action: 'kept', reason: 'Performance-Verbesserung, klar belegbar', finding: 'Doppelte Berechnung in render()' },
      { action: 'removed', reason: 'Duplikat: Naming in beiden Agents gemeldet', finding: 'Inkonsistente Benennung' },
    ],
    warnings: [],
  },
  {
    name: 'Keine Findings',
    agents: {
      akAbgleich: { findings: [] },
      codeQuality: { findings: [] },
    },
    consolidated: null,
    decisions: [],
    warnings: [],
  },
  {
    name: 'Nur Code-Quality',
    agents: {
      akAbgleich: null,
      codeQuality: {
        findings: [
          { severity: 'important', title: 'Event-Listener wird nicht aufgeräumt', file: 'src/components/tooltip/tooltip.ts', line: 34, detail: 'Der `mouseenter`-Listener wird in `connectedCallback` registriert, aber nicht entfernt.', suggestion: 'Listener-Referenz speichern und in `disconnectedCallback` aufräumen.' },
          { severity: 'minor', title: 'Unnötiger Nullcheck', file: 'src/components/tooltip/tooltip.ts', line: 58, detail: 'Die Property `content` hat einen Default-Wert. Der Nullcheck greift nie.', suggestion: 'Nullcheck entfernen.' },
        ],
      },
    },
    consolidated: {
      findings: [
        { severity: 'important', category: 'code-quality', title: 'Event-Listener wird nicht aufgeräumt', file: 'src/components/tooltip/tooltip.ts', line: 34, detail: 'Der `mouseenter`-Listener wird nicht entfernt.', suggestion: 'In `disconnectedCallback` aufräumen.' },
        { severity: 'minor', category: 'code-quality', title: 'Unnötiger Nullcheck', file: 'src/components/tooltip/tooltip.ts', line: 58, detail: 'Default-Wert vorhanden, Nullcheck redundant.', suggestion: 'Nullcheck entfernen.' },
      ],
      summary: '2 Auffälligkeiten: 1 Wichtig, 1 Gering',
    },
    decisions: [
      { action: 'kept', reason: 'Memory Leak bestätigt', finding: 'Event-Listener wird nicht aufgeräumt' },
      { action: 'kept', reason: 'Redundanter Code, klar belegbar', finding: 'Unnötiger Nullcheck' },
    ],
    warnings: ['Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft.'],
  },
  {
    name: 'Partial Failure',
    agents: {
      akAbgleich: 'error',
      codeQuality: {
        findings: [
          { severity: 'important', title: 'Shadow DOM Styling Leak', file: 'src/components/card/card.styles.scss', line: 15, detail: 'Der `:host` Selektor fehlt.', suggestion: 'Styles in `:host { }` wrappen.' },
        ],
      },
    },
    consolidated: {
      findings: [
        { severity: 'important', category: 'code-quality', title: 'Shadow DOM Styling Leak', file: 'src/components/card/card.styles.scss', line: 15, detail: 'Der `:host` Selektor fehlt.', suggestion: 'Styles in `:host { }` wrappen.' },
      ],
      summary: '1 Auffälligkeit: 1 Wichtig',
    },
    decisions: [
      { action: 'kept', reason: 'Styling-Leak bestätigt, im Diff belegbar', finding: 'Shadow DOM Styling Leak' },
    ],
    warnings: ['Agent 1 (AK-Abgleich) fehlgeschlagen: CoSi API error: 503 — Service Unavailable'],
  },
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

// Set to true in tests to skip delays
let skipDelays = false;
function setSkipDelays(val) { skipDelays = val; }

async function maybeDelay(min, max) {
  if (!skipDelays) await delay(randomBetween(min, max));
}

async function runMockReview(emit) {
  const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
  console.log(`[CoSi Mock] Szenario: ${scenario.name}`);

  for (const warning of scenario.warnings) {
    emit('warning', { message: warning });
  }

  const hasAk = scenario.agents.akAbgleich !== null;
  const akFails = scenario.agents.akAbgleich === 'error';

  if (hasAk) {
    emit('agent:start', { agent: 'ak-abgleich', label: 'AK-Abgleich', temperature: 0.2 });
  }
  emit('agent:start', { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4 });

  if (hasAk) {
    await maybeDelay(1000, 2000);
    if (akFails) {
      emit('agent:error', { agent: 'ak-abgleich', error: 'CoSi API error: 503 — Service Unavailable' });
    } else {
      const akFindings = scenario.agents.akAbgleich.findings;
      emit('agent:done', {
        agent: 'ak-abgleich',
        duration: randomBetween(1500, 3000),
        findingCount: akFindings.length,
        summary: akFindings.length === 0 ? 'Keine Findings' : `${akFindings.length} Finding${akFindings.length > 1 ? 's' : ''} — ${akFindings.map(f => f.title).join(', ')}`,
        rawResponse: { findings: akFindings },
      });
    }
  }

  await maybeDelay(1000, 2000);
  const cqFindings = scenario.agents.codeQuality.findings;
  emit('agent:done', {
    agent: 'code-quality',
    duration: randomBetween(1500, 3000),
    findingCount: cqFindings.length,
    summary: cqFindings.length === 0 ? 'Keine Findings' : `${cqFindings.length} Finding${cqFindings.length > 1 ? 's' : ''} — ${cqFindings.map(f => f.title).join(', ')}`,
    rawResponse: { findings: cqFindings },
  });

  if (scenario.consolidated) {
    emit('consolidator:start', { temperature: 0.2 });
    await maybeDelay(500, 1000);
    emit('consolidator:done', {
      duration: randomBetween(1000, 2500),
      result: {
        ...scenario.consolidated,
        warnings: scenario.warnings,
        reviewedAt: new Date().toISOString(),
      },
      decisions: scenario.decisions,
      summary: `${cqFindings.length + (hasAk && !akFails ? scenario.agents.akAbgleich.findings.length : 0)} → ${scenario.consolidated.findings.length} konsolidiert`,
      rawResponse: scenario.consolidated,
    });
  }

  emit('done', {});
}

module.exports = { runMockReview, setSkipDelays };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test proxy/cosi-mock.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Run all backend tests**

Run: `node --test proxy/cosi.test.js proxy/cosi-mock.test.js`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add proxy/cosi-mock.js proxy/cosi-mock.test.js
git commit -m "feat(cosi): refactor mock mode to emit SSE events"
```

---

## Chunk 2: Frontend — Models, Service, and InlineCodePipe

### Task 4: Extend type model with pipeline types

**Files:**
- Modify: `src/app/models/review.model.ts`

- [ ] **Step 1: Add pipeline types and update `ReviewState`**

Replace `src/app/models/review.model.ts` entirely:

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

export interface AgentStep {
  agent: string;
  label: string;
  temperature: number;
  status: 'running' | 'done' | 'error';
  duration?: number;
  findingCount?: number;
  summary?: string;
  rawResponse?: unknown;
  error?: string;
}

export interface ConsolidatorDecision {
  action: 'kept' | 'removed' | 'severity-changed';
  reason: string;
  finding: string;
  oldSeverity?: string;
  newSeverity?: string;
}

export interface ConsolidatorStep {
  status: 'pending' | 'running' | 'done' | 'error';
  temperature?: number;
  error?: string;
  duration?: number;
  decisions?: ConsolidatorDecision[];
  summary?: string;
  rawResponse?: unknown;
}

export interface PipelineState {
  agents: AgentStep[];
  consolidator: ConsolidatorStep;
  warnings: string[];
  totalDuration?: number;
}

export type ReviewState =
  | 'idle'
  | { status: 'running'; pipeline: PipelineState }
  | { status: 'result'; pipeline: PipelineState; data: ReviewResult }
  | { status: 'error'; pipeline: PipelineState; message: string };

export function createInitialPipeline(): PipelineState {
  return { agents: [], consolidator: { status: 'pending' }, warnings: [] };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/models/review.model.ts
git commit -m "feat(cosi): add pipeline types to review model"
```

### Task 5: Rewrite `CosiReviewService` to consume SSE

**Files:**
- Modify: `src/app/services/cosi-review.service.ts`
- Test: `src/app/services/cosi-review.service.spec.ts`

- [ ] **Step 1: Write failing tests for SSE-based service**

Replace `src/app/services/cosi-review.service.spec.ts` entirely:

```typescript
import { TestBed } from '@angular/core/testing';
import { CosiReviewService } from './cosi-review.service';
import { PipelineState, ReviewState } from '../models/review.model';

function mockFetchSSE(events: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(events));
      controller.close();
    },
  });
  return vi.fn().mockResolvedValue({ ok: true, body: stream } as unknown as Response);
}

function buildSSE(...events: Array<{ event: string; data: unknown }>): string {
  return events.map(e => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join('');
}

describe('CosiReviewService', () => {
  let service: CosiReviewService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CosiReviewService);
  });

  it('starts in idle state', () => {
    expect(service.reviewState()).toBe('idle');
  });

  it('transitions to running then result on successful SSE stream', async () => {
    const sseData = buildSSE(
      { event: 'agent:start', data: { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4 } },
      { event: 'agent:done', data: { agent: 'code-quality', duration: 2000, findingCount: 0, summary: 'Keine Findings', rawResponse: { findings: [] } } },
      { event: 'consolidator:done', data: { duration: 1000, result: { findings: [], summary: 'Keine Auffälligkeiten', warnings: [], reviewedAt: '2026-03-20T10:00:00Z' }, decisions: [], summary: '0 → 0', rawResponse: {} } },
      { event: 'done', data: {} },
    );
    globalThis.fetch = mockFetchSSE(sseData);

    await service.requestReview('diff', null);

    const state = service.reviewState() as Extract<ReviewState, { status: 'result' }>;
    expect(state.status).toBe('result');
    expect(state.data.findings).toEqual([]);
    expect(state.pipeline.agents.length).toBe(1);
    expect(state.pipeline.agents[0].status).toBe('done');
  });

  it('handles agent:error events', async () => {
    const sseData = buildSSE(
      { event: 'agent:start', data: { agent: 'ak-abgleich', label: 'AK-Abgleich', temperature: 0.2 } },
      { event: 'agent:error', data: { agent: 'ak-abgleich', error: 'timeout' } },
      { event: 'agent:start', data: { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4 } },
      { event: 'agent:done', data: { agent: 'code-quality', duration: 2000, findingCount: 0, summary: 'Keine', rawResponse: { findings: [] } } },
      { event: 'done', data: {} },
    );
    globalThis.fetch = mockFetchSSE(sseData);

    await service.requestReview('diff', null);

    const state = service.reviewState() as Extract<ReviewState, { status: 'result' }>;
    expect(state.pipeline.agents[0].status).toBe('error');
    expect(state.pipeline.agents[0].error).toBe('timeout');
  });

  it('collects warnings into pipeline state', async () => {
    const sseData = buildSSE(
      { event: 'warning', data: { message: 'Kein Jira-Ticket' } },
      { event: 'agent:start', data: { agent: 'code-quality', label: 'CQ', temperature: 0.4 } },
      { event: 'agent:done', data: { agent: 'code-quality', duration: 1000, findingCount: 0, summary: '', rawResponse: {} } },
      { event: 'done', data: {} },
    );
    globalThis.fetch = mockFetchSSE(sseData);

    await service.requestReview('diff', null);

    const state = service.reviewState() as Extract<ReviewState, { status: 'result' }>;
    expect(state.pipeline.warnings).toContain('Kein Jira-Ticket');
  });

  it('transitions to error on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await service.requestReview('diff', null);

    const state = service.reviewState() as Extract<ReviewState, { status: 'error' }>;
    expect(state.status).toBe('error');
    expect(state.message).toContain('Network error');
    expect(state.pipeline).toBeDefined();
  });

  it('resets to idle via reset()', async () => {
    const sseData = buildSSE({ event: 'done', data: {} });
    globalThis.fetch = mockFetchSSE(sseData);

    await service.requestReview('diff', null);
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

Run: `npx ng test --no-watch`
Expected: FAIL — service still uses `HttpClient.post()`.

- [ ] **Step 3: Rewrite the service to consume SSE via fetch**

Replace `src/app/services/cosi-review.service.ts` entirely:

```typescript
import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { JiraTicket } from '../models/work-item.model';
import { AgentStep, ConsolidatorStep, createInitialPipeline, PipelineState, ReviewResult, ReviewState } from '../models/review.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CosiReviewService {
  private readonly baseUrl = `${environment.proxyUrl}/api/cosi/review`;
  private readonly reviewRequestedSubject = new Subject<void>();
  private abortController?: AbortController;

  readonly reviewState = signal<ReviewState>('idle');
  readonly canReview = signal(false);
  readonly reviewRequested$ = this.reviewRequestedSubject.asObservable();

  triggerReview(): void {
    this.reviewRequestedSubject.next();
  }

  async requestReview(diff: string, jiraTicket: JiraTicket | null): Promise<void> {
    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;

    const pipeline = createInitialPipeline();
    this.reviewState.set({ status: 'running', pipeline });

    const body = {
      diff,
      jiraTicket: jiraTicket
        ? { key: jiraTicket.key, summary: jiraTicket.summary, description: jiraTicket.description }
        : null,
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      await this.consumeStream(response.body, pipeline);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : 'Review fehlgeschlagen';
      this.reviewState.set({ status: 'error', pipeline, message });
    }
  }

  reset(): void {
    this.abortController?.abort();
    this.reviewState.set('idle');
  }

  private async consumeStream(body: ReadableStream<Uint8Array>, pipeline: PipelineState): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let reviewResult: ReviewResult | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop()!;

      for (const part of parts) {
        const parsed = this.parseSSEBlock(part);
        if (!parsed) continue;
        reviewResult = this.handleEvent(parsed.event, parsed.data, pipeline, reviewResult);
      }
    }

    if (reviewResult) {
      this.reviewState.set({ status: 'result', pipeline, data: reviewResult });
    } else {
      const emptyResult: ReviewResult = {
        findings: [],
        summary: 'Keine Auffälligkeiten',
        warnings: pipeline.warnings,
        reviewedAt: new Date().toISOString(),
      };
      this.reviewState.set({ status: 'result', pipeline, data: emptyResult });
    }
  }

  private parseSSEBlock(block: string): { event: string; data: unknown } | null {
    let event = '';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7);
      else if (line.startsWith('data: ')) data = line.slice(6);
    }
    if (!event || !data) return null;
    try {
      return { event, data: JSON.parse(data) };
    } catch {
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SSE data is untyped by nature, validated per-case below
  private handleEvent(event: string, data: Record<string, any>, pipeline: PipelineState, reviewResult: ReviewResult | null): ReviewResult | null {
    switch (event) {
      case 'agent:start':
        pipeline.agents.push({
          agent: data.agent,
          label: data.label,
          temperature: data.temperature,
          status: 'running',
        });
        break;
      case 'agent:done': {
        const agent = pipeline.agents.find((a: AgentStep) => a.agent === data.agent);
        if (agent) {
          agent.status = 'done';
          agent.duration = data.duration;
          agent.findingCount = data.findingCount;
          agent.summary = data.summary;
          agent.rawResponse = data.rawResponse;
        }
        break;
      }
      case 'agent:error': {
        const agent = pipeline.agents.find((a: AgentStep) => a.agent === data.agent);
        if (agent) {
          agent.status = 'error';
          agent.error = data.error;
        }
        break;
      }
      case 'consolidator:start':
        pipeline.consolidator = { status: 'running', temperature: data.temperature } as ConsolidatorStep;
        break;
      case 'consolidator:done':
        pipeline.consolidator.status = 'done';
        pipeline.consolidator.duration = data.duration;
        pipeline.consolidator.decisions = data.decisions;
        pipeline.consolidator.summary = data.summary;
        pipeline.consolidator.rawResponse = data.rawResponse;
        reviewResult = data.result;
        break;
      case 'warning':
        pipeline.warnings.push(data.message);
        break;
    }

    this.reviewState.set({ status: 'running', pipeline: { ...pipeline } });
    return reviewResult;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: Service tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/cosi-review.service.ts src/app/services/cosi-review.service.spec.ts src/app/models/review.model.ts
git commit -m "feat(cosi): rewrite review service to consume SSE stream"
```

### Task 6: Update consumers of `ReviewState`

The `ReviewState` type changed: `'loading'` is now `{ status: 'running', pipeline }`. Update all components that check for `'loading'`.

**Files:**
- Modify: `src/app/components/action-rail/action-rail.ts`
- Modify: `src/app/components/review-findings/review-findings.ts` (just the state checks — the full redesign is Task 8)

- [ ] **Step 1: Add `isRunning` helper to `review.model.ts`**

Add this utility function at the bottom of `src/app/models/review.model.ts`:

```typescript
export function isReviewRunning(state: ReviewState): boolean {
  return typeof state === 'object' && state.status === 'running';
}
```

- [ ] **Step 2: Update action-rail.ts**

Import `isReviewRunning` from the model. In the template:

- Replace `review === 'loading'` (in `[disabled]`) with `isRunning(review)`
- Replace `review === 'loading'` (in `@if`) with `isRunning(review)`
- Add `protected isRunning = isReviewRunning;` to the component class.

- [ ] **Step 3: Update review-findings.ts state checks temporarily**

Import `isReviewRunning`. In the template:

- Replace `review === 'loading'` with `isRunning(review)`
- Replace `review !== 'loading' && review.status === 'result'` with `typeof review === 'object' && review.status === 'result'`
- Add `protected isRunning = isReviewRunning;` to the component class.

- [ ] **Step 4: Update test fixtures**

In `src/app/components/review-findings/review-findings.spec.ts`, replace:
- `setup('loading')` → `setup({ status: 'running', pipeline: createInitialPipeline() })`
- Add import: `import { createInitialPipeline } from '../../models/review.model';`

In `src/app/components/action-rail/action-rail.ts` spec: replace any `reviewState.set('loading')` calls with `reviewState.set({ status: 'running', pipeline: createInitialPipeline() })` and add the `createInitialPipeline` import.

- [ ] **Step 5: Run tests**

Run: `npx ng test --no-watch`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/models/review.model.ts src/app/components/action-rail/action-rail.ts src/app/components/review-findings/review-findings.ts src/app/components/review-findings/review-findings.spec.ts
git commit -m "refactor(cosi): update ReviewState consumers for new running state"
```

### Task 7: Create InlineCodePipe

**Files:**
- Create: `src/app/pipes/inline-code.pipe.ts`
- Create: `src/app/pipes/inline-code.pipe.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/pipes/inline-code.pipe.spec.ts
import { InlineCodePipe } from './inline-code.pipe';

describe('InlineCodePipe', () => {
  const pipe = new InlineCodePipe();

  it('transforms backtick-wrapped text into <code> elements', () => {
    expect(pipe.transform('Use `ngOnInit` here')).toBe('Use <code>ngOnInit</code> here');
  });

  it('handles multiple backtick occurrences', () => {
    expect(pipe.transform('`foo` and `bar`')).toBe('<code>foo</code> and <code>bar</code>');
  });

  it('returns text unchanged when no backticks', () => {
    expect(pipe.transform('plain text')).toBe('plain text');
  });

  it('handles empty string', () => {
    expect(pipe.transform('')).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch`
Expected: FAIL — pipe doesn't exist.

- [ ] **Step 3: Implement the pipe**

```typescript
// src/app/pipes/inline-code.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'inlineCode' })
export class InlineCodePipe implements PipeTransform {
  transform(value: string): string {
    return value.replace(/`([^`]+)`/g, '<code>$1</code>');
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pipes/inline-code.pipe.ts src/app/pipes/inline-code.pipe.spec.ts
git commit -m "feat(cosi): add InlineCodePipe for backtick rendering"
```

---

## Chunk 3: Frontend — ReviewPipelineComponent & ReviewFindings Redesign

### Task 8: Create ReviewPipelineComponent

**Files:**
- Create: `src/app/components/review-pipeline/review-pipeline.ts`
- Create: `src/app/components/review-pipeline/review-pipeline.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/components/review-pipeline/review-pipeline.spec.ts
import { TestBed } from '@angular/core/testing';
import { ReviewPipelineComponent } from './review-pipeline';
import { PipelineState } from '../../models/review.model';

function makePipeline(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    agents: [],
    consolidator: { status: 'pending' },
    warnings: [],
    ...overrides,
  };
}

describe('ReviewPipelineComponent', () => {
  function setup(pipeline: PipelineState) {
    TestBed.configureTestingModule({ imports: [ReviewPipelineComponent] });
    const fixture = TestBed.createComponent(ReviewPipelineComponent);
    fixture.componentRef.setInput('pipeline', pipeline);
    fixture.detectChanges();
    return fixture;
  }

  it('renders agent steps', () => {
    const pipeline = makePipeline({
      agents: [
        { agent: 'ak-abgleich', label: 'AK-Abgleich', temperature: 0.2, status: 'done', duration: 2000, findingCount: 1, summary: '1 Finding' },
        { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4, status: 'running' },
      ],
    });
    const fixture = setup(pipeline);
    expect(fixture.nativeElement.textContent).toContain('AK-Abgleich');
    expect(fixture.nativeElement.textContent).toContain('Code-Qualität');
  });

  it('shows running indicator for active agents', () => {
    const pipeline = makePipeline({
      agents: [{ agent: 'code-quality', label: 'CQ', temperature: 0.4, status: 'running' }],
    });
    const fixture = setup(pipeline);
    const dot = fixture.nativeElement.querySelector('[data-status="running"]');
    expect(dot).toBeTruthy();
  });

  it('shows error state for failed agents', () => {
    const pipeline = makePipeline({
      agents: [{ agent: 'ak-abgleich', label: 'AK', temperature: 0.2, status: 'error', error: 'timeout' }],
    });
    const fixture = setup(pipeline);
    expect(fixture.nativeElement.textContent).toContain('timeout');
  });

  it('shows temperature badges', () => {
    const pipeline = makePipeline({
      agents: [{ agent: 'cq', label: 'CQ', temperature: 0.4, status: 'done', duration: 1000 }],
    });
    const fixture = setup(pipeline);
    expect(fixture.nativeElement.textContent).toContain('T=0.4');
  });

  it('shows consolidator decisions when present', () => {
    const pipeline = makePipeline({
      consolidator: {
        status: 'done',
        temperature: 0.2,
        duration: 1500,
        decisions: [
          { action: 'removed', reason: 'Duplikat', finding: 'Naming' },
          { action: 'kept', reason: 'Valid', finding: 'Bug' },
        ],
        summary: '3 → 2 konsolidiert',
      },
    });
    const fixture = setup(pipeline);
    expect(fixture.nativeElement.textContent).toContain('Duplikat');
    expect(fixture.nativeElement.textContent).toContain('Naming');
  });

  it('renders nothing when pipeline has no agents', () => {
    const fixture = setup(makePipeline());
    expect(fixture.nativeElement.querySelector('[data-pipeline]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement ReviewPipelineComponent**

Create `src/app/components/review-pipeline/review-pipeline.ts`. This is a sizeable component — build the vertical timeline with all agent steps, consolidator, and collapsible raw JSON sections. Use the approved mockup A design with:

- Collapsible wrapper (default open when any agent is `'running'`)
- Vertical timeline: left border, status dots (green `bg-emerald-500` for done, pulsing `bg-indigo-400 animate-pulse` for running, `bg-red-500` for error)
- Temperature pill badges
- Duration in monospace
- Summary text per agent
- Collapsible raw JSON per agent (dark bg `bg-stone-900`, monospace, `text-stone-400`)
- Consolidator section with decisions list — action badges: `bg-emerald-50 text-emerald-700` for kept, `bg-red-50 text-red-700` for removed, `bg-amber-50 text-amber-700` for severity-changed
- Total duration in header

The component should:
- Input: `pipeline: PipelineState`
- Only render when `pipeline.agents.length > 0`
- Track collapsed/expanded state for the wrapper and per-agent JSON sections via signals
- Use `@for` for agent iteration, `@if` for conditional sections

Required `data-*` attribute contracts (used by tests):
- `[data-pipeline]` on the outer wrapper (absent when no agents)
- `[data-status="running"]` / `[data-status="done"]` / `[data-status="error"]` on status dots
- Temperature text rendered as `T=0.4` format
- Error message text rendered in the DOM when `status === 'error'`
- Decision `reason` and `finding` text rendered in the DOM for consolidator decisions

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/review-pipeline/review-pipeline.ts src/app/components/review-pipeline/review-pipeline.spec.ts
git commit -m "feat(cosi): add ReviewPipelineComponent with live timeline"
```

### Task 9: Redesign ReviewFindingsComponent with file-grouped cards

**Files:**
- Modify: `src/app/components/review-findings/review-findings.ts`
- Modify: `src/app/components/review-findings/review-findings.spec.ts`

- [ ] **Step 1: Write failing tests for file-grouped layout**

Replace `src/app/components/review-findings/review-findings.spec.ts` entirely:

```typescript
import { TestBed } from '@angular/core/testing';
import { ReviewFindingsComponent } from './review-findings';
import { ReviewState, ReviewFinding, createInitialPipeline } from '../../models/review.model';

const makeFinding = (overrides: Partial<ReviewFinding> = {}): ReviewFinding => ({
  severity: 'important',
  category: 'code-quality',
  title: 'Test finding',
  file: 'src/app/test.ts',
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

  it('does not render when idle', () => {
    const fixture = setup('idle');
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });

  it('shows loading state', () => {
    const fixture = setup({ status: 'running', pipeline: createInitialPipeline() });
    expect(fixture.nativeElement.textContent).toContain('KI-Review läuft');
  });

  it('shows error state', () => {
    const fixture = setup({ status: 'error', pipeline: createInitialPipeline(), message: 'fail' });
    expect(fixture.nativeElement.textContent).toContain('Review konnte nicht durchgeführt werden');
  });

  it('shows empty state when no findings', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: { findings: [], summary: 'Keine Auffälligkeiten', warnings: [], reviewedAt: '' },
    });
    expect(fixture.nativeElement.textContent).toContain('Keine Auffälligkeiten gefunden');
  });

  it('groups findings by file', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [
          makeFinding({ file: 'src/a.ts', line: 10 }),
          makeFinding({ file: 'src/a.ts', line: 20 }),
          makeFinding({ file: 'src/b.ts', line: 5 }),
        ],
        summary: '3 Auffälligkeiten',
        warnings: [],
        reviewedAt: '',
      },
    });
    const fileGroups = fixture.nativeElement.querySelectorAll('[data-file-group]');
    expect(fileGroups.length).toBe(2);
  });

  it('expands file groups with critical findings by default', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [
          makeFinding({ file: 'src/a.ts', severity: 'critical', detail: 'Critical detail' }),
        ],
        summary: '1', warnings: [], reviewedAt: '',
      },
    });
    expect(fixture.nativeElement.textContent).toContain('Critical detail');
  });

  it('collapses file groups without critical findings by default', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [
          makeFinding({ file: 'src/a.ts', severity: 'minor', detail: 'Minor detail' }),
        ],
        summary: '1', warnings: [], reviewedAt: '',
      },
    });
    expect(fixture.nativeElement.textContent).not.toContain('Minor detail');
  });

  it('toggles file group on header click', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [makeFinding({ file: 'src/a.ts', severity: 'minor', detail: 'Toggled detail' })],
        summary: '1', warnings: [], reviewedAt: '',
      },
    });
    expect(fixture.nativeElement.textContent).not.toContain('Toggled detail');

    const button = fixture.nativeElement.querySelector('[data-file-group] button');
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Toggled detail');
  });

  it('shows severity dots in file group header', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [
          makeFinding({ file: 'src/a.ts', severity: 'critical' }),
          makeFinding({ file: 'src/a.ts', severity: 'minor' }),
        ],
        summary: '2', warnings: [], reviewedAt: '',
      },
    });
    const dots = fixture.nativeElement.querySelectorAll('[data-file-group] [data-severity-dot]');
    expect(dots.length).toBe(2);
  });

  it('shows inline code in detail text', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [makeFinding({ severity: 'critical', detail: 'Use `ngOnInit` hook', file: 'src/a.ts' })],
        summary: '1', warnings: [], reviewedAt: '',
      },
    });
    const codeEl = fixture.nativeElement.querySelector('code');
    expect(codeEl).toBeTruthy();
    expect(codeEl.textContent).toContain('ngOnInit');
  });

  it('shows warnings when present', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: { findings: [], summary: '', warnings: ['Warning text'], reviewedAt: '' },
    });
    expect(fixture.nativeElement.textContent).toContain('Warning text');
  });

  it('sorts file groups by highest severity', () => {
    const fixture = setup({
      status: 'result',
      pipeline: createInitialPipeline(),
      data: {
        findings: [
          makeFinding({ file: 'src/b.ts', severity: 'minor' }),
          makeFinding({ file: 'src/a.ts', severity: 'critical' }),
        ],
        summary: '2', warnings: [], reviewedAt: '',
      },
    });
    const groups = fixture.nativeElement.querySelectorAll('[data-file-group]');
    expect(groups[0].textContent).toContain('src/a.ts');
    expect(groups[1].textContent).toContain('src/b.ts');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch`
Expected: FAIL — component still has old structure.

- [ ] **Step 3: Rewrite ReviewFindingsComponent**

Replace `src/app/components/review-findings/review-findings.ts` entirely. The new component:

- Imports `InlineCodePipe` and `ReviewPipelineComponent`
- Groups findings by `file` using `computed()` that returns `FileGroup[]` (each with `file`, `findings`, `hasCritical`, `severityDots`)
- Sorts groups by highest severity, findings within groups by severity then line
- Uses `signal<Set<string>>` for tracking expanded file groups (files with critical findings start expanded)
- Renders file group cards matching the approved mockup:
  - White card with rounded corners
  - Header button: chevron, monospace file path (ellipsis truncation), severity dots, count
  - When expanded: findings with left severity stripe, badges, line number, title, detail box with `[innerHTML]` + `inlineCode` pipe
- Still renders the header section with "KI-Review" heading and summary
- Still renders loading/error/empty states
- Renders `<app-review-pipeline>` between header and findings when pipeline is available

Severity stripe classes: `border-l-[3px] border-red-500` (critical), `border-amber-500` (important), `border-stone-400` (minor).
Severity badge classes: `bg-red-50 text-red-700 border-red-200` (critical/Kritisch), `bg-amber-50 text-amber-700 border-amber-200` (important/Wichtig), `bg-stone-100 text-stone-500 border-stone-200` (minor/Gering).
Category badge: `bg-stone-100 text-stone-500 border-stone-200` for both values, text "AK-Abgleich" or "Code-Qualität".

Required `data-*` attribute contracts (used by tests):
- `[data-file-group]` on each file group card
- `[data-severity-dot]` on severity preview dots in the file group header
- `button` inside `[data-file-group]` for collapse/expand toggle
- Inline `<code>` elements inside detail text (rendered via `InlineCodePipe` + `[innerHTML]`)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/review-findings/review-findings.ts src/app/components/review-findings/review-findings.spec.ts
git commit -m "feat(cosi): redesign findings with file-grouped cards and pipeline timeline"
```

### Task 10: Integration — wire pipeline into pr-detail

**Files:**
- Modify: `src/app/components/pr-detail/pr-detail.ts`

- [ ] **Step 1: Verify pr-detail.ts needs no changes**

The `requestReview()` now returns `Promise<void>` instead of being Observable-based, but the call in `pr-detail.ts` is already fire-and-forget (no `.subscribe()` on the return value — it subscribes to `reviewRequested$` which triggers the call). The existing code at lines 225-233 works as-is. No changes needed.

- [ ] **Step 2: Remove HttpClient from service test (cleanup)**

In `src/app/services/cosi-review.service.spec.ts`: the new spec (from Task 5) already doesn't use `provideHttpClient()` or `provideHttpClientTesting()`. Verify no other test files provide these specifically for `CosiReviewService`.

Also remove the `HttpClient` import from `cosi-review.service.ts` if it was left behind (Task 5 Step 3 already does a full rewrite, so this should be clean).

- [ ] **Step 3: Run all frontend tests**

Run: `npx ng test --no-watch`
Expected: All PASS.

- [ ] **Step 4: Run all backend tests**

Run: `node --test proxy/cosi.test.js proxy/cosi-mock.test.js`
Expected: All PASS.

- [ ] **Step 5: Manual smoke test**

Start dev server and proxy:
```bash
npx ng serve &
node proxy/index.js &
```

Open the app, select a PR, click "KI-Review starten". Verify:
1. Pipeline timeline appears and animates (agents start → done)
2. Findings appear grouped by file after consolidator completes
3. File groups with critical findings are expanded
4. Inline code renders with monospace
5. Collapsing/expanding file groups works
6. Pipeline section is collapsible
7. Raw JSON sections are collapsible

- [ ] **Step 6: Final commit (only if Step 2 produced changes)**

If any cleanup changes were made in Step 2, commit them:

```bash
git add -u
git commit -m "chore(cosi): clean up unused HttpClient imports"
```

If no changes were needed, skip this step.
