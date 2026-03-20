# CoSi Mock Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return realistic mock review data from `/api/cosi/review` when no `COSI_API_KEY` is configured, enabling local UI development without API access.

**Architecture:** New `proxy/cosi-mock.js` exports `runMockReview()` which returns one of 4 hardcoded scenarios after a 2–3s delay. The existing endpoint in `proxy/index.js` branches on `COSI_API_KEY` presence.

**Tech Stack:** Node.js, Express, Node built-in test runner

**Spec:** `docs/superpowers/specs/2026-03-20-cosi-mock-mode-design.md`

---

## Chunk 1: Implementation

### Task 1: Mock module (`proxy/cosi-mock.js`)

**Files:**
- Create: `proxy/cosi-mock.js`
- Create: `proxy/cosi-mock.test.js`

- [ ] **Step 1: Write the failing test**

Create `proxy/cosi-mock.test.js`:

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { runMockReview } = require('./cosi-mock');

describe('runMockReview', () => {
  it('returns a valid ReviewResult shape', async () => {
    const result = await runMockReview();

    assert.ok(Array.isArray(result.findings));
    assert.equal(typeof result.summary, 'string');
    assert.ok(Array.isArray(result.warnings));
    assert.equal(typeof result.reviewedAt, 'string');
    assert.ok(!isNaN(Date.parse(result.reviewedAt)));
  });

  it('delays between 2 and 3.5 seconds', async () => {
    const start = Date.now();
    await runMockReview();
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 2000, `Expected >= 2000ms, got ${elapsed}ms`);
    assert.ok(elapsed < 3500, `Expected < 3500ms, got ${elapsed}ms`);
  });

  it('returns findings with correct field types when present', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => runMockReview())
    );
    const withFindings = results.filter((r) => r.findings.length > 0);
    assert.ok(withFindings.length > 0, 'Expected at least one result with findings after 20 calls');

    for (const finding of withFindings[0].findings) {
      assert.ok(['critical', 'important', 'minor'].includes(finding.severity));
      assert.ok(['ak-abgleich', 'code-quality'].includes(finding.category));
      assert.equal(typeof finding.title, 'string');
      assert.equal(typeof finding.file, 'string');
      assert.equal(typeof finding.line, 'number');
      assert.equal(typeof finding.detail, 'string');
      assert.equal(typeof finding.suggestion, 'string');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test proxy/cosi-mock.test.js`
Expected: FAIL — `Cannot find module './cosi-mock'`

- [ ] **Step 3: Write implementation**

Create `proxy/cosi-mock.js`:

```js
const SCENARIOS = [
  {
    name: 'Mehrere Findings (mixed)',
    data: {
      findings: [
        {
          severity: 'critical',
          category: 'ak-abgleich',
          title: 'Hover-State für primären Button fehlt',
          file: 'src/components/button/button.styles.scss',
          line: 42,
          detail: 'Laut AK muss der primäre Button einen sichtbaren Hover-State haben. Die aktuelle Implementierung definiert keinen :hover-Selektor.',
          suggestion: 'Einen :hover-Selektor mit leicht abgedunkelter Hintergrundfarbe ergänzen.',
        },
        {
          severity: 'important',
          category: 'code-quality',
          title: 'Typ-Assertion statt Type Guard',
          file: 'src/components/button/button.ts',
          line: 87,
          detail: 'Die Typ-Assertion `as ButtonVariant` umgeht die Typprüfung. Ein Type Guard wäre sicherer und erkennt ungültige Werte zur Laufzeit.',
          suggestion: 'Einen Type Guard `isButtonVariant()` implementieren und vor dem Zugriff prüfen.',
        },
        {
          severity: 'minor',
          category: 'code-quality',
          title: 'Doppelte Berechnung in render()',
          file: 'src/components/button/button.ts',
          line: 112,
          detail: 'Die CSS-Klasse wird bei jedem Render-Zyklus neu berechnet, obwohl sich die Inputs nicht geändert haben.',
          suggestion: 'Berechnung in ein `willUpdate()` mit Dirty-Check verschieben.',
        },
      ],
      summary: '3 Auffälligkeiten: 1 Kritisch, 1 Wichtig, 1 Gering',
      warnings: [],
    },
  },
  {
    name: 'Keine Findings',
    data: {
      findings: [],
      summary: 'Keine Auffälligkeiten',
      warnings: [],
    },
  },
  {
    name: 'Nur Code-Quality',
    data: {
      findings: [
        {
          severity: 'important',
          category: 'code-quality',
          title: 'Event-Listener wird nicht aufgeräumt',
          file: 'src/components/tooltip/tooltip.ts',
          line: 34,
          detail: 'Der `mouseenter`-Listener wird in `connectedCallback` registriert, aber in `disconnectedCallback` nicht entfernt. Das führt zu Memory Leaks bei häufigem Mount/Unmount.',
          suggestion: 'Listener-Referenz speichern und in `disconnectedCallback` via `removeEventListener` aufräumen.',
        },
        {
          severity: 'minor',
          category: 'code-quality',
          title: 'Unnötiger Nullcheck',
          file: 'src/components/tooltip/tooltip.ts',
          line: 58,
          detail: 'Die Property `content` ist als `@property()` deklariert und hat einen Default-Wert. Der Nullcheck in Zeile 58 greift nie.',
          suggestion: 'Nullcheck entfernen, da `content` immer definiert ist.',
        },
      ],
      summary: '2 Auffälligkeiten: 1 Wichtig, 1 Gering',
      warnings: ['Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft.'],
    },
  },
  {
    name: 'Partial Failure',
    data: {
      findings: [
        {
          severity: 'important',
          category: 'code-quality',
          title: 'Shadow DOM Styling Leak',
          file: 'src/components/card/card.styles.scss',
          line: 15,
          detail: 'Der `:host` Selektor fehlt. Styles können in den umgebenden DOM leaken wenn die Komponente ohne Shadow DOM genutzt wird.',
          suggestion: 'Alle Top-Level-Styles in `:host { }` wrappen.',
        },
      ],
      summary: '1 Auffälligkeit: 1 Wichtig',
      warnings: ['Agent 1 (AK-Abgleich) fehlgeschlagen: CoSi API error: 503 — Service Unavailable'],
    },
  },
];

function randomDelay() {
  const ms = Math.random() * 1000 + 2000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMockReview() {
  const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
  console.log(`[CoSi Mock] Szenario: ${scenario.name}`);
  await randomDelay();
  return {
    ...scenario.data,
    reviewedAt: new Date().toISOString(),
  };
}

module.exports = { runMockReview };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test proxy/cosi-mock.test.js`
Expected: 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add proxy/cosi-mock.js proxy/cosi-mock.test.js
git commit -m "feat(cosi): add mock review module with 4 scenarios"
```

---

### Task 2: Wire mock into endpoint (`proxy/index.js`)

**Files:**
- Modify: `proxy/index.js:8,17-19,26-38`

- [ ] **Step 1: Add import**

At `proxy/index.js:8`, after the existing `require('./cosi')` line, add:

```js
const { runMockReview } = require('./cosi-mock');
```

- [ ] **Step 2: Update startup warning**

Replace `proxy/index.js:17-19`:

```js
if (!COSI_API_KEY) {
  console.warn('WARNING: COSI_API_KEY is not set — /api/cosi/review will not work');
}
```

With:

```js
if (!COSI_API_KEY) {
  console.warn('[CoSi] Mock-Modus aktiv — kein API Key gesetzt');
}
```

- [ ] **Step 3: Branch endpoint handler**

Replace the route handler body at `proxy/index.js:26-38`. Change:

```js
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
```

To:

```js
app.post('/api/cosi/review', express.json({ limit: '2mb' }), async (req, res) => {
  const { diff, jiraTicket } = req.body;
  if (!diff || typeof diff !== 'string') {
    return res.status(400).json({ error: 'diff is required and must be a string' });
  }
  try {
    const result = COSI_API_KEY
      ? await runReview(diff, jiraTicket || null)
      : await runMockReview();
    res.json(result);
  } catch (err) {
    console.error('[CoSi Review] Error:', err);
    res.status(502).json({ error: 'Review fehlgeschlagen: ' + err.message });
  }
});
```

- [ ] **Step 4: Run all proxy tests**

Run: `node --test proxy/cosi-mock.test.js && node --test proxy/cosi.test.js`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add proxy/index.js
git commit -m "feat(cosi): wire mock mode into review endpoint when no API key"
```
