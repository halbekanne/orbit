# CoSi A11y Agent & Registry Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the CoSi review pipeline to use a file-per-agent registry, generalize the Consolidator, and add an Accessibility review agent.

**Architecture:** Each review agent is defined in its own file under `proxy/agents/` implementing a shared `AgentDefinition` JSDoc interface. The orchestrator (`cosi.js`) iterates over a registry array. The Consolidator receives a dynamic agent results array instead of hardcoded references.

**Tech Stack:** Node.js (Express proxy), Angular (frontend components), Gemini 2.5 Flash via CoSi API

**Spec:** `docs/superpowers/specs/2026-03-21-cosi-a11y-agent-and-registry-design.md`

---

## Chunk 1: Agent Definition Interface & Extraction

### Task 1: Create AgentDefinition typedef and SHARED_CONSTRAINTS

**Files:**
- Create: `proxy/agents/agent-definition.js`

- [ ] **Step 1: Create `proxy/agents/agent-definition.js`**

```js
// @ts-check

/**
 * @typedef {Object} AgentDefinition
 * @property {string} id
 * @property {string} label
 * @property {string} systemPrompt
 * @property {Object} responseSchema
 * @property {number} temperature
 * @property {number} thinkingBudget
 * @property {(diff: string, jiraTicket?: JiraTicketInput) => string} buildUserPrompt
 * @property {(jiraTicket?: JiraTicketInput) => boolean} [isApplicable]
 * @property {string} [skipMessage]
 *   — Optional German message emitted as warning when this agent is skipped.
 *     If not set, no warning is emitted when the agent is skipped.
 */

/**
 * @typedef {Object} JiraTicketInput
 * @property {string} key
 * @property {string} summary
 * @property {string} description
 */

const SHARED_CONSTRAINTS = `You are reviewing a pull request for a Design System built with TypeScript, Lit (Web Components), and SCSS.

Every line in the diff starts with [line_number]. Use this number directly as the "line" value.

RULES:
- Report only problems. Every finding must describe a concrete deficiency.
- No praise, no "looks good", no "well done", no "LGTM".
- Report a finding ONLY if you can point to a specific added line in the diff. Without an exact codeSnippet, the finding does not exist.
- CRITICAL: Only review ADDED lines (lines starting with '+' in the diff). Lines starting with '-' are removed code — do not review them. Context lines (no prefix) are for understanding only — do not create findings for them.
- An empty findings array is a valid result, not an error. Do not manufacture issues to fill the output — but when in doubt, report one finding too many rather than miss one.
- All textual fields (title, detail, suggestion) must be in German. English technical terms (e.g. "null check", "race condition", "lifecycle hook") may be used inline.

THINKING PHASE INSTRUCTIONS:
You have a dedicated thinking phase before generating the JSON. You MUST use this phase to perform a step-by-step analysis. Do NOT use the thinking phase to draft JSON syntax. Use it to reason about the code, cross-reference requirements, and verify your claims. Only after completing your analysis should you write the JSON output.`;

module.exports = { SHARED_CONSTRAINTS };
```

This is a verbatim extraction of `SHARED_CONSTRAINTS` from `proxy/cosi.js:198-211`.

- [ ] **Step 2: Verify the file loads without errors**

Run: `node -e "require('./proxy/agents/agent-definition')"`
Expected: No output, no errors.

- [ ] **Step 3: Commit**

```bash
git add proxy/agents/agent-definition.js
git commit -m "feat(cosi): add AgentDefinition typedef and SHARED_CONSTRAINTS"
```

---

### Task 2: Extract AK-Abgleich agent

**Files:**
- Create: `proxy/agents/ak-abgleich.js`
- Reference: `proxy/cosi.js:84-112` (schema), `proxy/cosi.js:213-240` (prompt), `proxy/cosi.js:328-341` (buildUserPrompt)

- [ ] **Step 1: Create `proxy/agents/ak-abgleich.js`**

Extract `AK_FINDING_SCHEMA`, `SYSTEM_PROMPTS.akAbgleich`, and `buildAgent1Prompt` from `proxy/cosi.js` into a file implementing `AgentDefinition`. The system prompt, schema, and prompt builder must be copied verbatim — no rewording.

```js
// @ts-check
const { SHARED_CONSTRAINTS } = require('./agent-definition');

const SYSTEM_PROMPT = `${SHARED_CONSTRAINTS}

TASK: You are the Akzeptanzkriterien (AK) reviewer. Compare the PR diff against the Jira ticket's Akzeptanzkriterien.

YOUR THINKING PROCESS (use your internal reasoning for these steps before generating JSON):
1. EXTRACT: List every Akzeptanzkriterium from the Jira ticket as AK-1, AK-2, etc. For each, write a one-sentence testable assertion.
2. CLASSIFY: For each AK, determine if it requires a code change at all. Some AKs are non-code tasks (e.g., "Barrierefreiheits-Audit durchführen", "Team über Bugfix informieren", "Meeting mit Stakeholdern organisieren"). Mark these as NOT_CODE_RELEVANT and skip them — they cannot have gaps in a PR diff.
3. TRACE: For each code-relevant AK, scan the diff file by file. Write one of:
   - FOUND: [file]:[line] — how the code implements it
   - PARTIAL: [file]:[line] — what is implemented, what is missing
   - NOT FOUND: no added code addresses this AK
4. FORMULATE: Only for AKs marked PARTIAL or NOT FOUND, create a finding.

EXAMPLE (for calibration — do not copy):
{
  "severity": "important",
  "title": "AK 'Fehlermeldung bei ungültiger Eingabe' nur teilweise umgesetzt",
  "file": "src/components/input-field.ts",
  "line": 87,
  "codeSnippet": "+    if (!value) return;",
  "detail": "Das AK verlangt eine sichtbare Fehlermeldung bei ungültiger Eingabe. Der Code prüft zwar auf leere Werte, zeigt aber keine Meldung an — der Nutzer bekommt kein Feedback.",
  "suggestion": "Fehlertext über das bestehende error-Slot anzeigen, z.B. this.errorMessage = 'Bitte gültigen Wert eingeben'."
}

If the Jira ticket description contains no identifiable Akzeptanzkriterien (e.g., it is empty, purely technical notes, or just a title), return an empty findings array.

SCOPE: Do NOT comment on code quality, style, structure, naming, or patterns. Only check AK coverage.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    findings: {
      type: "ARRAY",
      description: "List of found issues. Empty array if no issues found.",
      items: {
        type: "OBJECT",
        properties: {
          severity: {
            type: "STRING",
            enum: ["critical", "important", "minor"],
            description: "critical = AK completely unaddressed, important = AK partially addressed but key scenario missing, minor = AK addressed but deviates from spec in a small detail",
          },
          title: { type: "STRING", description: "Short German summary of the issue" },
          file: { type: "STRING", description: "File path from the diff" },
          line: { type: "INTEGER", description: "Line number from the diff (the number in square brackets)" },
          codeSnippet: { type: "STRING", description: "The exact 1-2 lines from the diff that this finding targets, copied verbatim" },
          detail: { type: "STRING", description: "What the problem is and why it matters (1-3 sentences, in German)" },
          suggestion: { type: "STRING", description: "Concrete improvement suggestion (in German, English technical terms allowed inline)" },
        },
        required: ["severity", "title", "file", "line", "codeSnippet", "detail", "suggestion"],
        propertyOrdering: ["severity", "title", "file", "line", "codeSnippet", "detail", "suggestion"],
      },
    },
  },
  required: ["findings"],
  propertyOrdering: ["findings"],
};

/** @type {import('./agent-definition').AgentDefinition} */
module.exports = {
  id: 'ak-abgleich',
  label: 'AK-Abgleich',
  systemPrompt: SYSTEM_PROMPT,
  responseSchema: RESPONSE_SCHEMA,
  temperature: 0.2,
  thinkingBudget: 16384,
  isApplicable(jiraTicket) {
    return !!jiraTicket;
  },
  skipMessage: 'Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft.',
  buildUserPrompt(diff, jiraTicket) {
    return `<jira_ticket>
Key: ${jiraTicket.key}
Summary: ${jiraTicket.summary}
Description:
${jiraTicket.description}
</jira_ticket>

<pr_diff>
${diff}
</pr_diff>

Follow your thinking process step by step: EXTRACT, CLASSIFY, TRACE, FORMULATE.`;
  },
};
```

- [ ] **Step 2: Verify the file loads**

Run: `node -e "const a = require('./proxy/agents/ak-abgleich'); console.log(a.id, a.label, typeof a.buildUserPrompt)"`
Expected: `ak-abgleich AK-Abgleich function`

- [ ] **Step 3: Commit**

```bash
git add proxy/agents/ak-abgleich.js
git commit -m "feat(cosi): extract ak-abgleich agent to own file"
```

---

### Task 3: Extract Code Quality agent

**Files:**
- Create: `proxy/agents/code-quality.js`
- Reference: `proxy/cosi.js:114-142` (schema), `proxy/cosi.js:242-275` (prompt), `proxy/cosi.js:343-349` (buildUserPrompt)

- [ ] **Step 1: Create `proxy/agents/code-quality.js`**

Same pattern as Task 2. Extract `CODE_QUALITY_FINDING_SCHEMA`, `SYSTEM_PROMPTS.codeQuality`, and `buildAgent2Prompt`.

```js
// @ts-check
const { SHARED_CONSTRAINTS } = require('./agent-definition');

const SYSTEM_PROMPT = `${SHARED_CONSTRAINTS}

TASK: You are the code quality reviewer. Review the PR diff for code quality issues.

YOUR THINKING PROCESS (use your internal reasoning for these steps before generating JSON):
1. SCAN: Go through the added lines ('+' lines) across all files. Focus on logic, not listing files. For each block of added code that catches your attention, check:
   - Could this cause problems at runtime? (race conditions, broken control flow, unhandled edge cases)
   - Is there a Lit / Web Components anti-pattern? (missing cleanup, inefficient rendering, lifecycle errors)
   - Would a new team member understand this in under 10 seconds?
   Only note files and lines where you actually find something worth reporting.
2. FORMULATE: For each confirmed issue, draft the finding with the exact codeSnippet.

EXAMPLE (for calibration — do not copy):
{
  "severity": "important",
  "title": "Event Listener wird bei Disconnect nicht aufgeräumt",
  "file": "src/components/tooltip.ts",
  "line": 34,
  "codeSnippet": "+    window.addEventListener('scroll', this.handleScroll);",
  "detail": "Der Scroll-Listener wird in connectedCallback registriert, aber in disconnectedCallback nicht entfernt. Bei mehrfachem Mount/Unmount sammeln sich Listener an und verursachen Memory Leaks.",
  "suggestion": "In disconnectedCallback ergänzen: window.removeEventListener('scroll', this.handleScroll);"
}

FOCUS AREAS (in priority order):
Ignore issues that TypeScript strict mode or ESLint would already catch (type errors, null access on strict types, unused variables, import order, formatting). Focus on problems that only a human reviewer would find:

1. Logic errors that compile but behave incorrectly — race conditions, off-by-one, wrong conditions, unhandled edge cases
2. Readability and maintainability — convoluted logic, deep nesting, unclear intent, functions doing too much
3. Lit / Web Components best practices — lifecycle errors, missing cleanup logic (event listeners, subscriptions), inefficient rendering, incorrect reactive property usage
4. Clean code structure — single responsibility, sensible naming, DRY (no premature abstraction)

SCOPE: Do NOT check Akzeptanzkriterien, design tokens, or accessibility. Focus only on code quality.

Do NOT suggest features, abstractions, or patterns not needed for the current change (YAGNI).`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    findings: {
      type: "ARRAY",
      description: "List of found issues. Empty array if no issues found.",
      items: {
        type: "OBJECT",
        properties: {
          severity: {
            type: "STRING",
            enum: ["critical", "important", "minor"],
            description: "critical = runtime error or broken functionality, important = structural problem hurting maintainability or missing cleanup logic, minor = readability improvement or small inconsistency",
          },
          title: { type: "STRING", description: "Short German summary of the issue" },
          file: { type: "STRING", description: "File path from the diff" },
          line: { type: "INTEGER", description: "Line number from the diff (the number in square brackets)" },
          codeSnippet: { type: "STRING", description: "The exact 1-2 lines from the diff that this finding targets, copied verbatim" },
          detail: { type: "STRING", description: "What the problem is and why it matters (1-3 sentences, in German)" },
          suggestion: { type: "STRING", description: "Concrete improvement suggestion (in German, English technical terms allowed inline)" },
        },
        required: ["severity", "title", "file", "line", "codeSnippet", "detail", "suggestion"],
        propertyOrdering: ["severity", "title", "file", "line", "codeSnippet", "detail", "suggestion"],
      },
    },
  },
  required: ["findings"],
  propertyOrdering: ["findings"],
};

/** @type {import('./agent-definition').AgentDefinition} */
module.exports = {
  id: 'code-quality',
  label: 'Code-Qualität',
  systemPrompt: SYSTEM_PROMPT,
  responseSchema: RESPONSE_SCHEMA,
  temperature: 0.4,
  thinkingBudget: 16384,
  buildUserPrompt(diff) {
    return `<pr_diff>
${diff}
</pr_diff>

Follow your thinking process step by step: SCAN the added lines, then FORMULATE for confirmed issues only.`;
  },
};
```

- [ ] **Step 2: Verify the file loads**

Run: `node -e "const a = require('./proxy/agents/code-quality'); console.log(a.id, a.label, typeof a.buildUserPrompt)"`
Expected: `code-quality Code-Qualität function`

- [ ] **Step 3: Commit**

```bash
git add proxy/agents/code-quality.js
git commit -m "feat(cosi): extract code-quality agent to own file"
```

---

### Task 4: Create registry index and refactor orchestrator

**Files:**
- Create: `proxy/agents/index.js`
- Modify: `proxy/cosi.js` (major refactor)
- Modify: `proxy/cosi.test.js` (update imports, adjust test expectations)

- [ ] **Step 1: Create `proxy/agents/index.js`**

```js
// @ts-check
const akAbgleich = require('./ak-abgleich');
const codeQuality = require('./code-quality');

/** @type {import('./agent-definition').AgentDefinition[]} */
const AGENT_REGISTRY = [akAbgleich, codeQuality];

module.exports = { AGENT_REGISTRY };
```

Note: only two agents for now — accessibility is added in Chunk 2.

- [ ] **Step 2: Refactor `proxy/cosi.js` to use registry**

Remove from `cosi.js`:
- `AK_FINDING_SCHEMA` (lines 84-112)
- `CODE_QUALITY_FINDING_SCHEMA` (lines 114-142)
- `SHARED_CONSTRAINTS` (lines 198-211)
- `SYSTEM_PROMPTS.akAbgleich` and `SYSTEM_PROMPTS.codeQuality` (lines 213-275)
- `buildAgent1Prompt` (lines 328-341)
- `buildAgent2Prompt` (lines 343-349)

Keep in `cosi.js`:
- `callCoSi()` (lines 5-52)
- `preprocessDiff()` (lines 54-82)
- `CONSOLIDATOR_SCHEMA` (lines 144-196) — updated per spec
- `SYSTEM_PROMPTS.consolidator` (lines 277-325) — updated per spec
- `buildConsolidatorPrompt()` — refactored to accept array
- `describeFindings()` (lines 367-377) — unchanged
- `describeConsolidation()` — refactored to accept array
- `runReview()` — refactored to iterate registry

The refactored `runReview` replaces the hardcoded agent calls with a loop over the registry:

```js
const { AGENT_REGISTRY } = require('./agents');

// ...

async function runReview(diff, jiraTicket, emit) {
  const warnings = [];
  const processedDiff = preprocessDiff(diff);

  const applicableAgents = AGENT_REGISTRY.filter(
    a => !a.isApplicable || a.isApplicable(jiraTicket)
  );

  const skipped = AGENT_REGISTRY.filter(a => a.isApplicable && !a.isApplicable(jiraTicket));
  for (const agent of skipped) {
    if (agent.skipMessage) {
      emit('warning', { message: agent.skipMessage });
      warnings.push(agent.skipMessage);
    }
  }

  const agentResults = await Promise.all(
    applicableAgents.map(agent => {
      emit('agent:start', {
        agent: agent.id,
        label: agent.label,
        temperature: agent.temperature,
        thinkingBudget: agent.thinkingBudget,
      });
      const start = Date.now();
      return callCoSi(
        agent.buildUserPrompt(processedDiff, jiraTicket),
        agent.systemPrompt,
        {
          temperature: agent.temperature,
          maxOutputTokens: 65536,
          thinkingConfig: { thinkingBudget: agent.thinkingBudget, includeThoughts: true },
          responseSchema: agent.responseSchema,
        }
      )
        .then(({ result, thoughts }) => {
          emit('agent:done', {
            agent: agent.id,
            duration: Date.now() - start,
            findingCount: result.findings.length,
            summary: describeFindings(result.findings),
            thoughts,
            rawResponse: result,
          });
          return { id: agent.id, label: agent.label, findings: result.findings };
        })
        .catch(err => {
          emit('agent:error', { agent: agent.id, error: err.message });
          warnings.push(`Agent (${agent.label}) fehlgeschlagen: ${err.message}`);
          return { id: agent.id, label: agent.label, findings: [] };
        });
    })
  );

  const hasFindings = agentResults.some(r => r.findings.length > 0);
  if (!hasFindings) {
    emit('done', {});
    return;
  }

  emit('consolidator:start', { temperature: 0.2, thinkingBudget: 16384 });
  const consolStart = Date.now();

  const { result: consolidated, thoughts: consolidatorThoughts } = await callCoSi(
    buildConsolidatorPrompt(agentResults, processedDiff),
    SYSTEM_PROMPTS.consolidator,
    {
      temperature: 0.2,
      maxOutputTokens: 65536,
      thinkingConfig: { thinkingBudget: 16384, includeThoughts: true },
      responseSchema: CONSOLIDATOR_SCHEMA,
    },
  );

  emit('consolidator:done', {
    duration: Date.now() - consolStart,
    thoughts: consolidatorThoughts,
    result: {
      findings: consolidated.findings || [],
      summary: consolidated.summary || 'Keine Auffälligkeiten',
      warnings,
      reviewedAt: new Date().toISOString(),
    },
    decisions: consolidated.decisions || [],
    summary: describeConsolidation(agentResults, consolidated),
    rawResponse: consolidated,
  });

  emit('done', {});
}
```

Refactored `buildConsolidatorPrompt`:

```js
function buildConsolidatorPrompt(agentResults, diff) {
  return `<pr_diff>
${diff}
</pr_diff>

<agent_findings>
${JSON.stringify(agentResults)}
</agent_findings>

Follow your thinking process step by step: OVERLAP, GROUNDING, QUALITY GATE, SEVERITY CHECK.`;
}
```

Refactored `describeConsolidation`:

```js
function describeConsolidation(agentResults, consolidated) {
  const inputCount = agentResults.reduce((sum, r) => sum + r.findings.length, 0);
  const outputCount = consolidated.findings?.length ?? 0;
  const removed = inputCount - outputCount;
  if (removed === 0) return `${inputCount} Findings übernommen`;
  return `${inputCount} Findings geprüft, ${removed} gefiltert, ${outputCount} übernommen`;
}
```

Update `CONSOLIDATOR_SCHEMA` — change `category` and `decisions.agent` from `enum` to plain `STRING`, add optional `wcagCriterion`:

```js
const CONSOLIDATOR_SCHEMA = {
  type: "OBJECT",
  properties: {
    findings: {
      type: "ARRAY",
      description: "Final, filtered list of findings.",
      items: {
        type: "OBJECT",
        properties: {
          severity: {
            type: "STRING",
            enum: ["critical", "important", "minor"],
            description: "critical = real runtime risk, important = structural problem, minor = small improvement",
          },
          category: {
            type: "STRING",
            description: "The id of the agent that produced the finding",
          },
          title: { type: "STRING", description: "Short German summary" },
          file: { type: "STRING", description: "File path from the diff" },
          line: { type: "INTEGER", description: "Line number from the diff" },
          codeSnippet: { type: "STRING", description: "Exact lines from the diff, copied verbatim" },
          detail: { type: "STRING", description: "Problem description in German (1-3 sentences)" },
          suggestion: { type: "STRING", description: "Improvement suggestion in German" },
          wcagCriterion: { type: "STRING", description: "WCAG criterion reference. Only present for accessibility findings." },
        },
        required: ["severity", "category", "title", "file", "line", "codeSnippet", "detail", "suggestion"],
        propertyOrdering: ["severity", "category", "title", "file", "line", "codeSnippet", "detail", "suggestion", "wcagCriterion"],
      },
    },
    decisions: {
      type: "ARRAY",
      description: "For each input finding, a decision explaining what happened to it.",
      items: {
        type: "OBJECT",
        properties: {
          agent: { type: "STRING", description: "The id of the agent that produced the original finding" },
          finding: { type: "STRING", description: "Original title of the finding" },
          action: { type: "STRING", enum: ["kept", "removed", "merged", "severity-changed"] },
          reason: { type: "STRING", description: "Reasoning in German" },
        },
        required: ["agent", "finding", "action", "reason"],
        propertyOrdering: ["agent", "finding", "action", "reason"],
      },
    },
    summary: {
      type: "STRING",
      description: "German summary, e.g. '3 Auffälligkeiten: 1 Kritisch, 1 Wichtig, 1 Gering' or 'Keine Auffälligkeiten'",
    },
  },
  required: ["findings", "decisions", "summary"],
  propertyOrdering: ["findings", "decisions", "summary"],
};
```

Update `SYSTEM_PROMPTS.consolidator` — replace all hardcoded agent references with generic language. There are exactly 3 occurrences to change:

1. Task description line:
   - Old: `TASK: You receive findings from two code review agents. Produce the final review report.`
   - New: `TASK: You receive findings from multiple specialist review agents. Produce the final review report.`

2. OUTPUT RULES category tagging:
   - Old: `- Tag each finding with "category": "ak-abgleich" or "code-quality" based on which agent produced it. Never change a finding's category — it always matches the originating agent, even when adjusting severity.`
   - New: `- Tag each finding with "category" set to the originating agent's id. Never change a finding's category — it always matches the originating agent, even when adjusting severity.\n- If a finding has additional fields (e.g. wcagCriterion), pass them through unchanged.`

3. Consolidator example — the example's `decisions` array has hardcoded `"agent": "code-quality"` and `"agent": "ak-abgleich"`. These are fine to keep — they are example values for calibration, not constraints. The prompt text around them uses no hardcoded agent names.

No other hardcoded references to `ak-abgleich` or `code-quality` exist in the consolidator prompt.

Import `SHARED_CONSTRAINTS` from `agent-definition.js` — the consolidator prompt uses it (it starts with `${SHARED_CONSTRAINTS}`):

```js
const { SHARED_CONSTRAINTS } = require('./agents/agent-definition');
```

Update `module.exports` — remove `SYSTEM_PROMPTS` from exports (prompts now live in agent files). Export only:

```js
module.exports = { callCoSi, preprocessDiff, runReview };
```

- [ ] **Step 3: Run `proxy/cosi.test.js` — tests should pass unchanged**

At this point the registry has only 2 agents (accessibility is added in Chunk 2), so the event sequence is identical to the old hardcoded pipeline. The only difference is the internal loop mechanism.

Potential breaking changes to verify:
- `freshRequire()` now imports `proxy/agents/` — these files must exist (they do from Tasks 1-3)
- `SYSTEM_PROMPTS` is no longer in exports — the tests don't import it, so no change needed
- `describeConsolidation` is not called directly in tests — it's called internally by `runReview`
- The warning message format in the "no jira ticket" test matches on `/Kein Jira-Ticket/` which still matches the `skipMessage` field

Run: `node --test proxy/cosi.test.js`
Expected: All 4 tests pass without changes.

- [ ] **Step 4: Commit**

```bash
git add proxy/agents/index.js proxy/cosi.js proxy/cosi.test.js
git commit -m "feat(cosi): refactor orchestrator to use agent registry"
```

---

## Chunk 2: Accessibility Agent

### Task 5: Create Accessibility agent

**Files:**
- Create: `proxy/agents/accessibility.js`
- Modify: `proxy/agents/index.js` (add to registry)

- [ ] **Step 1: Create `proxy/agents/accessibility.js`**

The full system prompt, response schema, and buildUserPrompt as specified in the design spec (Change 2 + Change 3). The prompt content is entirely defined in the spec — copy it verbatim.

```js
// @ts-check
const { SHARED_CONSTRAINTS } = require('./agent-definition');

const SYSTEM_PROMPT = `${SHARED_CONSTRAINTS}

TASK: You are the accessibility reviewer. Review the PR diff for WCAG AA violations detectable without rendering. You are specialized for component-based Design Systems built with Lit (Web Components) and SCSS.

YOUR THINKING PROCESS (use the thinking phase for this):
1. SCAN — Walk through each added line (prefixed with '+'). For each line, check against the 8 focus areas below. Note potential issues as candidates with the relevant focus area and line reference.
2. VALIDATE — For each candidate:
   a. Find the exact codeSnippet (1-2 lines) from the diff that evidences the issue.
   b. Determine: is this a real accessibility barrier, or a style preference? Discard preferences.
   c. Consider: could the surrounding component context already solve this? If uncertain, keep but lower severity.
   d. Assign severity (critical / important / minor) per the calibration below.
3. FORMULATE — For each validated candidate, write the finding fields: title, detail, suggestion (all German), wcagCriterion, file, line, codeSnippet.

FOCUS AREAS (ordered by impact):

1. Rollen & Semantik (WCAG 1.3.1, 4.1.2)
Interaktive Elemente müssen semantisch korrekt ausgezeichnet sein. <div> oder <span> statt <button>, <nav>, <dialog> ist ein Befund. Navigations-Links müssen als <ul>/<li> innerhalb von <nav> strukturiert sein, nicht als lose <a>-Ketten.

2. ARIA-Attribute & ID-Referenzen (WCAG 4.1.2)
Fehlende oder falsch verwendete ARIA-Attribute. Besonderes Augenmerk auf alle ID-referenzierenden Attribute (aria-labelledby, aria-controls, aria-describedby, aria-owns) — diese funktionieren nicht über Shadow-DOM-Grenzen hinweg.

3. Qualität zugänglicher Namen (WCAG 2.5.3, 4.1.2)
Ein aria-label oder alt-Text muss aussagekräftig und verständlich sein, nicht nur vorhanden. aria-label="button", aria-label="click here" oder alt="image" sind Befunde.

4. Tastaturinteraktion (WCAG 2.1.1, 2.1.2)
Click-Handler ohne keydown/keyup-Pendant. Fehlende oder falsche tabindex-Steuerung. Modals/Dialoge ohne Focus-Trap. Custom-Widgets ohne erwartete Tastaturmuster (Arrow-Keys für Tabs, Escape zum Schließen).

5. Textalternativen (WCAG 1.1.1)
<img> ohne alt-Attribut. Icon-Buttons ohne zugänglichen Namen. Dekorative Bilder ohne aria-hidden="true" oder leeres alt="".

6. Formular-Zugänglichkeit (WCAG 1.3.1, 3.3.2)
Inputs ohne programmatisch verknüpftes <label>. Zusammengehörige Inputs ohne <fieldset>/<legend>. Fehlermeldungen ohne Live-Region (aria-live oder role="alert").

7. Touch-Target-Größe (WCAG 2.5.8)
Interaktive Elemente müssen mindestens 24×24px groß sein (außer innerhalb von Fließtext). Im Diff erkennbar über explizite CSS-Größen, Padding-Werte, min-width/min-height in SCSS-Dateien.

8. Lit/Shadow-DOM-spezifisch
ID-Referenzen über Shadow-Grenzen hinweg (funktionieren nicht). Fehlendes delegatesFocus bei Custom-Elements mit interaktiven Inhalten. <slot>-Elemente ohne sinnvollen Fallback-Content für Screenreader.

ABGRENZUNG — was du NICHT prüfst:
- Farbkontraste (erfordert Rendering)
- Reihenfolge im Accessibility Tree (erfordert Gesamtkomponente)
- Issues die ESLint/lit-a11y bereits erkennen

ANTI-PATTERN-KATALOG (for calibration — do not copy, but use these to calibrate your output quality):

Rollen & Semantik:
Problem: <div class="nav-links"><a href="/home">Home</a><a href="/settings">Settings</a></div>
Besser: <nav aria-label="Hauptnavigation"><ul><li><a href="/home">Home</a></li>...</ul></nav>

Tastaturinteraktion:
Problem: <div class="chip" @click=\${this.remove}>✕</div>
Besser: <button class="chip" @click=\${this.remove} aria-label="Filter entfernen">✕</button>
(Kein Keyboard-Pendant, kein zugänglicher Name, kein semantisches Element.)

ARIA & Shadow DOM:
Problem: <label for="input-1">Name</label><my-input id="input-1"></my-input>
Besser: <my-input aria-label="Name"></my-input>
(ID-Referenz funktioniert nicht über Shadow-Grenze.)

Qualität zugänglicher Namen:
Problem: <button aria-label="button">, <button aria-label="click here">, <img alt="image">
Besser: <button aria-label="Dialog schließen">, <img alt="Organigramm der Abteilung XY">

Touch-Target-Größe:
Problem: .close-btn { padding: 2px; }
Besser: .close-btn { padding: 2px; min-width: 24px; min-height: 24px; }

Formular ohne Label:
Problem: <input type="text" placeholder="Suche...">
Besser: <label><span class="visually-hidden">Suchbegriff</span><input type="text" placeholder="Suche..."></label>

SEVERITY CALIBRATION:
- critical: Komponente ist für Screenreader- oder Tastatur-Nutzer nicht bedienbar — fehlende Rolle, kein Keyboard-Zugang, kein zugänglicher Name
- important: Barrierefreiheit eingeschränkt aber nicht vollständig blockierend — unklarer Label-Text, fehlende aria-expanded-Zustandsanzeige, ID-Referenz über Shadow-DOM-Grenze
- minor: Verbesserungspotenzial ohne direkte Barriere — fehlender <fieldset> bei klar strukturiertem Formular, Touch-Target knapp unter 24px

If no accessibility issues are found, return an empty findings array.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    findings: {
      type: "ARRAY",
      description: "List of accessibility issues. Empty array if no issues found.",
      items: {
        type: "OBJECT",
        properties: {
          severity: {
            type: "STRING",
            enum: ["critical", "important", "minor"],
            description: "critical = component not usable for assistive tech users, important = accessibility degraded but not blocking, minor = improvement opportunity without direct barrier",
          },
          title: { type: "STRING", description: "Short German summary of the issue" },
          file: { type: "STRING", description: "File path from the diff" },
          line: { type: "INTEGER", description: "Line number from the diff (the number in square brackets)" },
          codeSnippet: { type: "STRING", description: "The exact 1-2 lines from the diff that this finding targets, copied verbatim" },
          detail: { type: "STRING", description: "What the problem is and why it matters for accessibility (1-3 sentences, in German)" },
          suggestion: { type: "STRING", description: "Concrete improvement suggestion (in German, English technical terms allowed inline)" },
          wcagCriterion: { type: "STRING", description: "The relevant WCAG criterion, e.g. '4.1.2 Name, Rolle, Wert' or '2.1.1 Tastatur'" },
        },
        required: ["severity", "title", "file", "line", "codeSnippet", "detail", "suggestion", "wcagCriterion"],
        propertyOrdering: ["severity", "title", "file", "line", "codeSnippet", "detail", "suggestion", "wcagCriterion"],
      },
    },
  },
  required: ["findings"],
  propertyOrdering: ["findings"],
};

/** @type {import('./agent-definition').AgentDefinition} */
module.exports = {
  id: 'accessibility',
  label: 'Barrierefreiheit',
  systemPrompt: SYSTEM_PROMPT,
  responseSchema: RESPONSE_SCHEMA,
  temperature: 0.3,
  thinkingBudget: 16384,
  buildUserPrompt(diff) {
    return `<pr_diff>
${diff}
</pr_diff>

Follow your thinking process step by step: SCAN, VALIDATE, FORMULATE.`;
  },
};
```

- [ ] **Step 2: Add to registry in `proxy/agents/index.js`**

```js
// @ts-check
const akAbgleich = require('./ak-abgleich');
const codeQuality = require('./code-quality');
const accessibility = require('./accessibility');

/** @type {import('./agent-definition').AgentDefinition[]} */
const AGENT_REGISTRY = [akAbgleich, codeQuality, accessibility];

module.exports = { AGENT_REGISTRY };
```

- [ ] **Step 3: Verify the file loads and registry has 3 agents**

Run: `node -e "const { AGENT_REGISTRY } = require('./proxy/agents'); console.log(AGENT_REGISTRY.map(a => a.id))"`
Expected: `[ 'ak-abgleich', 'code-quality', 'accessibility' ]`

- [ ] **Step 4: Run existing tests to verify nothing breaks**

Run: `node --test proxy/cosi.test.js`
Expected: All tests pass. The accessibility agent is in the registry but existing tests mock `fetch` to return results for all calls — the third agent will get a response from the mock and emit additional events. Test assertions that check exact event sequences may need updating (see Task 6).

- [ ] **Step 5: Commit**

```bash
git add proxy/agents/accessibility.js proxy/agents/index.js
git commit -m "feat(cosi): add accessibility review agent"
```

---

### Task 6: Update backend tests for 3-agent pipeline

**Files:**
- Modify: `proxy/cosi.test.js`

- [ ] **Step 1: Update test expectations for 3 agents**

The "emits agent:start, agent:done for both agents and consolidator events" test needs to expect 3 `agent:start` and 3 `agent:done` events. The mock `fetch` needs a third response for the accessibility agent.

Update the test's `fetch` mock to return results for 3 agent calls + 1 consolidator call:

```js
it('emits agent:start, agent:done for all agents and consolidator events', async () => {
  const agent1Result = { findings: [{ severity: 'critical', title: 'AK #1 fehlt', file: 'a.ts', line: 1, codeSnippet: '+ code', detail: 'd', suggestion: 's' }] };
  const agent2Result = { findings: [{ severity: 'minor', title: 'Naming', file: 'b.ts', line: 5, codeSnippet: '+ code', detail: 'd', suggestion: 's' }] };
  const agent3Result = { findings: [{ severity: 'important', title: 'Fehlende Rolle', file: 'c.ts', line: 10, codeSnippet: '+ code', detail: 'd', suggestion: 's', wcagCriterion: '4.1.2' }] };
  const consolidatedResult = {
    findings: [
      { severity: 'critical', category: 'ak-abgleich', title: 'AK #1 fehlt', file: 'a.ts', line: 1, codeSnippet: '+ code', detail: 'd', suggestion: 's' },
      { severity: 'important', category: 'accessibility', title: 'Fehlende Rolle', file: 'c.ts', line: 10, codeSnippet: '+ code', detail: 'd', suggestion: 's', wcagCriterion: '4.1.2' },
    ],
    summary: '2 Auffälligkeiten: 1 Kritisch, 1 Wichtig',
    decisions: [
      { agent: 'ak-abgleich', finding: 'AK #1 fehlt', action: 'kept', reason: 'Valid' },
      { agent: 'code-quality', finding: 'Naming', action: 'removed', reason: 'Trivial' },
      { agent: 'accessibility', finding: 'Fehlende Rolle', action: 'kept', reason: 'Valid' },
    ],
  };

  let callCount = 0;
  mock.method(global, 'fetch', () => {
    callCount++;
    const result = callCount <= 3
      ? [agent1Result, agent2Result, agent3Result][callCount - 1]
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

  await runReview('diff content', { key: 'DS-1', summary: 'Test', description: 'AK: something' }, emit);

  const types = events.map(e => e.type);
  assert.deepEqual(types, [
    'agent:start', 'agent:start', 'agent:start',
    'agent:done', 'agent:done', 'agent:done',
    'consolidator:start',
    'consolidator:done',
    'done',
  ]);

  const a11yStart = events.find(e => e.type === 'agent:start' && e.data.agent === 'accessibility');
  assert.ok(a11yStart);
  assert.equal(a11yStart.data.label, 'Barrierefreiheit');
  assert.equal(a11yStart.data.temperature, 0.3);

  const a11yDone = events.find(e => e.type === 'agent:done' && e.data.agent === 'accessibility');
  assert.ok(a11yDone);
  assert.equal(a11yDone.data.findingCount, 1);

  assert.equal(callCount, 4);
});
```

Also update the "no jira ticket" test — it should now emit events for `code-quality` AND `accessibility` (both have no `isApplicable` or return true). Update the expected call count from 2 to 3 (two agents + consolidator).

Update the "agent:error" test — the error could come from any agent. With 3 agents + consolidator, `callCount` max is 4.

Update the "no findings" test — now 3 agents return empty findings, so `callCount` is 3.

- [ ] **Step 2: Run tests**

Run: `node --test proxy/cosi.test.js`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add proxy/cosi.test.js
git commit -m "test(cosi): update tests for 3-agent pipeline"
```

---

## Chunk 3: Frontend Changes

### Task 7: Update ReviewFinding model

**Files:**
- Modify: `src/app/models/review.model.ts:2-3`

- [ ] **Step 1: Change `category` from union to string, add `wcagCriterion`**

In `src/app/models/review.model.ts`, change:

```typescript
  category: 'ak-abgleich' | 'code-quality';
```

to:

```typescript
  category: string;
  wcagCriterion?: string;
```

- [ ] **Step 2: Run Angular tests to check for type errors**

Run: `npx ng test --no-watch`
Expected: All tests pass. The `makeFinding` helper in `review-findings.spec.ts` defaults `category` to `'code-quality'` which is still a valid string.

- [ ] **Step 3: Commit**

```bash
git add src/app/models/review.model.ts
git commit -m "feat(model): widen category to string, add wcagCriterion"
```

---

### Task 8: Update review-findings component — category badge + WCAG pill

**Files:**
- Modify: `src/app/components/review-findings/review-findings.ts:241,307,502-507`

- [ ] **Step 1: Replace `categoryLabel` switch with lookup object**

In `review-findings.ts`, replace:

```typescript
  categoryLabel(category: string): string {
    switch (category) {
      case 'ak-abgleich': return 'AK-Abgleich';
      default: return 'Code-Qualität';
    }
  }
```

with:

```typescript
  private readonly categoryConfig: Record<string, { label: string; classes: string }> = {
    'ak-abgleich': { label: 'AK-Abgleich', classes: 'bg-stone-100 text-stone-500 border-stone-200' },
    'code-quality': { label: 'Code-Qualität', classes: 'bg-stone-100 text-stone-500 border-stone-200' },
    'accessibility': { label: 'Barrierefreiheit', classes: 'bg-teal-50 text-teal-700 border-teal-200' },
  };

  categoryLabel(category: string): string {
    return this.categoryConfig[category]?.label ?? category;
  }

  categoryBadgeClass(category: string): string {
    const dynamic = this.categoryConfig[category]?.classes ?? 'bg-stone-100 text-stone-600 border-stone-200';
    return `text-[11px] px-1.5 py-0.5 rounded border font-medium ${dynamic}`;
  }
```

- [ ] **Step 2: Update category badge in template to use dynamic classes**

Find the two category badge `<span>` elements (lines ~241 and ~307). They currently have hardcoded classes:

```html
<span class="text-[11px] px-1.5 py-0.5 rounded border font-medium bg-stone-100 text-stone-500 border-stone-200">{{ categoryLabel(finding.category) }}</span>
```

Change to:

```html
<span [class]="categoryBadgeClass(finding.category)">{{ categoryLabel(finding.category) }}</span>
```

- [ ] **Step 3: Add WCAG criterion pill badge**

After each category badge `<span>`, add:

```html
@if (finding.wcagCriterion) {
  <span class="text-[10px] px-1.5 py-0.5 rounded border font-mono bg-stone-100 text-stone-500 border-stone-200">WCAG {{ finding.wcagCriterion }}</span>
}
```

This appears in both the collapsed and expanded finding views (lines ~241 and ~307).

- [ ] **Step 4: Run tests**

Run: `npx ng test --no-watch`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/review-findings/review-findings.ts
git commit -m "feat(review-findings): add accessibility badge and WCAG criterion pill"
```

---

### Task 9: Add accessibility mock scenario

**Files:**
- Modify: `proxy/cosi-mock.js`

- [ ] **Step 1: Add accessibility findings to FINDINGS object**

Add after the `shadowDom` entry in the `FINDINGS` object:

```js
  a11yMissingRole: {
    severity: 'critical',
    category: 'accessibility',
    title: 'Icon-Button ohne zugänglichen Namen',
    file: 'src/components/close-button.ts',
    line: 12,
    detail: 'Der Schließen-Button ist ein <div> ohne Rolle, ohne zugänglichen Namen und ohne Tastaturunterstützung. Screenreader-Nutzer können dieses Element weder finden noch bedienen.',
    suggestion: 'Semantisches <button>-Element verwenden und aria-label ergänzen: <button aria-label="Dialog schließen" @click=${this.onClose}>✕</button>',
    codeSnippet: '+    <div class="close" @click=${this.onClose}>✕</div>',
    wcagCriterion: '4.1.2 Name, Rolle, Wert',
  },
  a11yShadowRef: {
    severity: 'important',
    category: 'accessibility',
    title: 'ID-Referenz über Shadow-DOM-Grenze',
    file: 'src/components/form-field.ts',
    line: 28,
    detail: 'aria-labelledby referenziert eine ID außerhalb des Shadow DOM. Diese Referenz funktioniert nicht über Shadow-Grenzen hinweg — der zugängliche Name bleibt leer.',
    suggestion: 'aria-label direkt am Element verwenden statt aria-labelledby mit externer ID.',
    codeSnippet: '+    <input aria-labelledby="external-label">',
    wcagCriterion: '4.1.2 Name, Rolle, Wert',
  },
```

- [ ] **Step 2: Add a new scenario that includes the accessibility agent**

Add a 5th scenario to the `SCENARIOS` array:

```js
  {
    name: 'Mit Barrierefreiheits-Findings',
    async run(emit) {
      emit('agent:start', { agent: 'ak-abgleich', label: 'AK-Abgleich', temperature: 0.2, thinkingBudget: 16384 });
      emit('agent:start', { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4, thinkingBudget: 16384 });
      emit('agent:start', { agent: 'accessibility', label: 'Barrierefreiheit', temperature: 0.3, thinkingBudget: 16384 });

      await delay(1000, 2000);
      emit('agent:done', {
        agent: 'ak-abgleich',
        duration: 1100,
        findingCount: 0,
        summary: 'Keine Auffälligkeiten',
        rawResponse: { findings: [] },
        thoughts: 'All AK covered.',
      });

      await delay(500, 1000);
      const cqFindings = [FINDINGS.codeQuality1];
      emit('agent:done', {
        agent: 'code-quality',
        duration: 1300,
        findingCount: cqFindings.length,
        summary: '1 Auffälligkeit: 1 Wichtig',
        rawResponse: { findings: cqFindings },
        thoughts: 'Found type assertion issue.',
      });

      await delay(500, 1000);
      const a11yFindings = [FINDINGS.a11yMissingRole, FINDINGS.a11yShadowRef];
      emit('agent:done', {
        agent: 'accessibility',
        duration: 1400,
        findingCount: a11yFindings.length,
        summary: '2 Auffälligkeiten: 1 Kritisch, 1 Wichtig',
        rawResponse: { findings: a11yFindings },
        thoughts: 'SCAN: Found div with click handler missing role...\nVALIDATE: Confirmed — no button element, no aria-label.\nSCAN: Found aria-labelledby crossing shadow boundary...\nVALIDATE: Confirmed — ID reference will not resolve.',
      });

      emit('consolidator:start', { temperature: 0.2, thinkingBudget: 16384 });
      await delay(500, 1000);

      const consolidatedFindings = [FINDINGS.a11yMissingRole, FINDINGS.codeQuality1, FINDINGS.a11yShadowRef];
      const decisions = [
        { agent: 'accessibility', action: 'kept', reason: 'Kritisches Barrierefreiheitsproblem, codeSnippet bestätigt.', finding: FINDINGS.a11yMissingRole.title },
        { agent: 'code-quality', action: 'kept', reason: 'Typ-Sicherheit relevant.', finding: FINDINGS.codeQuality1.title },
        { agent: 'accessibility', action: 'kept', reason: 'Shadow-DOM-Problem bestätigt, aria-labelledby im Diff vorhanden.', finding: FINDINGS.a11yShadowRef.title },
      ];

      emit('consolidator:done', {
        duration: 900,
        result: {
          findings: consolidatedFindings,
          summary: '3 Auffälligkeiten: 1 Kritisch, 2 Wichtig',
          warnings: [],
          reviewedAt: new Date().toISOString(),
        },
        decisions,
        summary: '3 Findings übernommen',
        rawResponse: { findings: consolidatedFindings, decisions, summary: '3 Auffälligkeiten: 1 Kritisch, 2 Wichtig' },
        thoughts: 'Grounding all 3 findings... All snippets found in diff. No overlaps. All kept.',
      });

      emit('done', {});
    },
  },
```

- [ ] **Step 3: Also update existing mock scenarios to emit `agent:start` for the accessibility agent**

The existing 4 scenarios only emit `agent:start` for `ak-abgleich` and `code-quality`. With the accessibility agent in the registry, the real pipeline will always emit 3 `agent:start` events. Update the mock scenarios to also emit the accessibility agent events to keep them realistic.

In each existing scenario, add after the `code-quality` `agent:start`:

```js
emit('agent:start', { agent: 'accessibility', label: 'Barrierefreiheit', temperature: 0.3, thinkingBudget: 16384 });
```

And add a corresponding `agent:done` with empty findings after the other agents complete:

```js
emit('agent:done', {
  agent: 'accessibility',
  duration: 1200,
  findingCount: 0,
  summary: 'Keine Auffälligkeiten',
  rawResponse: { findings: [] },
  thoughts: 'No accessibility issues found in the diff.',
});
```

Also add the `agent` field to all existing `decisions` arrays in all 4 scenarios — the updated `CONSOLIDATOR_SCHEMA` makes `agent` a required field on decisions. For example in Scenario 1:

```js
// Old:
{ action: 'kept', reason: 'Klares AK-Gap, Kritisch', finding: FINDINGS.akAbgleich.title },
// New:
{ agent: 'ak-abgleich', action: 'kept', reason: 'Klares AK-Gap, Kritisch', finding: FINDINGS.akAbgleich.title },
```

Apply the same pattern to all decision objects in all scenarios, using the category of the associated finding as the `agent` value.

- [ ] **Step 4: Run mock mode manually to verify the new scenario appears**

Run: `node -e "const { runMockReview } = require('./proxy/cosi-mock'); runMockReview((...a) => console.log(a))"`
Expected: Random scenario runs, events logged. Run a few times until the "Mit Barrierefreiheits-Findings" scenario appears and verify it emits accessibility events.

- [ ] **Step 5: Commit**

```bash
git add proxy/cosi-mock.js
git commit -m "feat(cosi-mock): add accessibility agent to mock scenarios"
```

---

### Task 10: Add frontend test for accessibility findings

**Files:**
- Modify: `src/app/components/review-findings/review-findings.spec.ts`

- [ ] **Step 1: Add test for accessibility category badge and WCAG pill**

```typescript
it('shows accessibility badge with teal styling and WCAG criterion', () => {
  const fixture = setup({
    status: 'result',
    pipeline: createInitialPipeline(),
    data: {
      findings: [makeFinding({
        category: 'accessibility',
        title: 'Fehlende Rolle',
        wcagCriterion: '4.1.2 Name, Rolle, Wert',
      })],
      summary: '1 Auffälligkeit',
      warnings: [],
      reviewedAt: new Date().toISOString(),
    },
  });

  const el = fixture.nativeElement;
  expect(el.textContent).toContain('Barrierefreiheit');
  expect(el.textContent).toContain('WCAG 4.1.2 Name, Rolle, Wert');

  const tealBadge = el.querySelector('.bg-teal-50');
  expect(tealBadge).toBeTruthy();
});
```

- [ ] **Step 2: Run tests**

Run: `npx ng test --no-watch`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/review-findings/review-findings.spec.ts
git commit -m "test(review-findings): add accessibility badge and WCAG pill test"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run all backend tests**

Run: `node --test proxy/cosi.test.js`
Expected: All tests pass.

- [ ] **Step 2: Run all frontend tests**

Run: `npx ng test --no-watch`
Expected: All tests pass.

- [ ] **Step 3: Start the dev server and verify visually**

Run: `npm start`

1. Open Orbit, select a PR
2. Trigger a KI-Review (mock mode)
3. Verify the pipeline timeline shows 3 agents
4. Run a few times until the "Mit Barrierefreiheits-Findings" scenario appears
5. Verify: Teal "Barrierefreiheit" badge renders on accessibility findings
6. Verify: "WCAG 4.1.2 Name, Rolle, Wert" pill badge renders next to severity
7. Verify: Other scenarios still work (no regressions in 2-agent findings display)

- [ ] **Step 4: Commit any fixes from visual verification**
