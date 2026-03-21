# CoSi Review Quality Improvements v2 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve CoSi AI review quality via responseSchema, diff line number injection, prompt cleanup, few-shot examples, and language unification.

**Architecture:** All changes are in `proxy/cosi.js`. A new `preprocessDiff()` function annotates diff lines with numbers. Three `responseSchema` constants replace prompt-based format enforcement. System prompts are rewritten to remove redundancy, add few-shot examples, and unify language to English instructions with German output.

**Tech Stack:** Node.js, Vertex AI / Gemini REST API

**Spec:** `docs/superpowers/specs/2026-03-21-cosi-review-quality-v2-design.md`

---

## Chunk 1: preprocessDiff and responseSchema constants

### Task 1: Add `preprocessDiff` function

**Files:**
- Modify: `proxy/cosi.js` — add function before `SHARED_CONSTRAINTS` (insert after line 52)

- [ ] **Step 1: Write the `preprocessDiff` function**

Insert after line 52 (after the `callCoSi` function closing brace), before `SHARED_CONSTRAINTS`:

```js
function preprocessDiff(rawDiff) {
  const lines = rawDiff.split('\n');
  const result = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[2], 10);
      result.push(line);
    } else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ') || line.startsWith('Binary ')) {
      result.push(line);
    } else if (line.startsWith('-')) {
      result.push(`[${oldLine}]${line}`);
      oldLine++;
    } else if (line.startsWith('+')) {
      result.push(`[${newLine}]${line}`);
      newLine++;
    } else {
      result.push(`[${newLine}]${line}`);
      oldLine++;
      newLine++;
    }
  }

  return result.join('\n');
}
```

Note: We prepend `[N]` directly to each line. Context lines already have a leading space in unified diffs (`[15] const oldVar`), and `+`/`-` lines keep their prefix (`[16]+const newVar`). This keeps the logic simple and consistent.

- [ ] **Step 2: Verify it doesn't break the proxy startup**

Run: `node -e "require('./proxy/cosi.js')"`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add proxy/cosi.js
git commit -m "feat(cosi): add preprocessDiff function for line number injection"
```

---

### Task 2: Add responseSchema constants

**Files:**
- Modify: `proxy/cosi.js` — add schema constants after `preprocessDiff`, before `SHARED_CONSTRAINTS`

- [ ] **Step 1: Add the three schema constants**

Insert after `preprocessDiff` function, before `SHARED_CONSTRAINTS`:

```js
const AK_FINDING_SCHEMA = {
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

const CODE_QUALITY_FINDING_SCHEMA = {
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
            enum: ["ak-abgleich", "code-quality"],
            description: "Which agent originally produced the finding",
          },
          title: { type: "STRING", description: "Short German summary" },
          file: { type: "STRING", description: "File path from the diff" },
          line: { type: "INTEGER", description: "Line number from the diff" },
          codeSnippet: { type: "STRING", description: "Exact lines from the diff, copied verbatim" },
          detail: { type: "STRING", description: "Problem description in German (1-3 sentences)" },
          suggestion: { type: "STRING", description: "Improvement suggestion in German" },
        },
        required: ["severity", "category", "title", "file", "line", "codeSnippet", "detail", "suggestion"],
        propertyOrdering: ["severity", "category", "title", "file", "line", "codeSnippet", "detail", "suggestion"],
      },
    },
    decisions: {
      type: "ARRAY",
      description: "For each input finding, a decision explaining what happened to it.",
      items: {
        type: "OBJECT",
        properties: {
          agent: { type: "STRING", enum: ["ak-abgleich", "code-quality"] },
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

- [ ] **Step 2: Verify it doesn't break the proxy startup**

Run: `node -e "require('./proxy/cosi.js')"`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add proxy/cosi.js
git commit -m "feat(cosi): add responseSchema constants for structured output"
```

---

## Chunk 2: Rewrite all prompts

### Task 3: Rewrite SHARED_CONSTRAINTS

**Files:**
- Modify: `proxy/cosi.js` — replace `SHARED_CONSTRAINTS` constant (currently lines 54-67)

- [ ] **Step 1: Replace the entire SHARED_CONSTRAINTS string**

Replace the current `SHARED_CONSTRAINTS` (from `const SHARED_CONSTRAINTS =` through the closing `` `; ``) with:

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add proxy/cosi.js
git commit -m "feat(cosi): rewrite SHARED_CONSTRAINTS with unified English instructions"
```

---

### Task 4: Rewrite Agent 1 (AK-Abgleich) system prompt

**Files:**
- Modify: `proxy/cosi.js` — replace `SYSTEM_PROMPTS.akAbgleich`

- [ ] **Step 1: Replace the akAbgleich prompt**

Replace the entire `akAbgleich` value (from `` `${SHARED_CONSTRAINTS} `` through the closing `` `, `` before `codeQuality:`) with:

```js
  akAbgleich: `${SHARED_CONSTRAINTS}

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

SCOPE: Do NOT comment on code quality, style, structure, naming, or patterns. Only check AK coverage.`,
```

- [ ] **Step 2: Commit**

```bash
git add proxy/cosi.js
git commit -m "feat(cosi): rewrite AK-Abgleich prompt with few-shot and no redundant PROCESS"
```

---

### Task 5: Rewrite Agent 2 (Code Quality) system prompt

**Files:**
- Modify: `proxy/cosi.js` — replace `SYSTEM_PROMPTS.codeQuality`

- [ ] **Step 1: Replace the codeQuality prompt**

Replace the entire `codeQuality` value (from `` `${SHARED_CONSTRAINTS} `` through the closing `` `, `` before `consolidator:`) with:

```js
  codeQuality: `${SHARED_CONSTRAINTS}

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

Do NOT suggest features, abstractions, or patterns not needed for the current change (YAGNI).`,
```

- [ ] **Step 2: Commit**

```bash
git add proxy/cosi.js
git commit -m "feat(cosi): rewrite Code Quality prompt with refocused areas and few-shot"
```

---

### Task 6: Rewrite Consolidator system prompt

**Files:**
- Modify: `proxy/cosi.js` — replace `SYSTEM_PROMPTS.consolidator`

- [ ] **Step 1: Replace the consolidator prompt**

Replace the entire `consolidator` value (from `` `${SHARED_CONSTRAINTS} `` through the closing `` `, `` / `` `; `` that ends `SYSTEM_PROMPTS`) with:

```js
  consolidator: `${SHARED_CONSTRAINTS}

TASK: You receive findings from two code review agents. Produce the final review report.

YOUR THINKING PROCESS (use your internal reasoning for these steps before generating JSON):
1. OVERLAP: Compare findings from all specialist agents. Note which ones target the same underlying issue and should be merged.
2. GROUNDING: For every finding, take the codeSnippet and search for it in the <pr_diff>. Write: "Finding '[title]' snippet found? Yes/No." Flag No findings for removal.
3. QUALITY GATE: For each remaining finding, ask: "Would a senior engineer comment this in a real PR review, or would they let it go?" If they would let it go, either remove it or reduce its severity to "minor" — use your judgment on which is more appropriate.

NOISE EXAMPLES (always remove findings like these):
- Formatting, trailing commas, semicolons, quote style → enforced by ESLint/Prettier
- Import ordering or grouping → enforced by ESLint
- Type errors or null checks that TypeScript strict mode already enforces → the build will break anyway
- Purely cosmetic renames that improve neither readability nor maintainability → a matter of taste, not a defect
- Findings that name no concrete problem but only suggest an alternative ("could also use X") → only keep if the current solution has a measurable problem (readability, performance, maintainability), then as "minor"

4. SEVERITY CHECK: For each surviving finding, verify the severity is appropriate. A "critical" must be a real runtime risk, not a style issue.

EXAMPLE (for calibration — do not copy):
{
  "decisions": [
    {
      "agent": "code-quality",
      "finding": "Event Listener wird bei Disconnect nicht aufgeräumt",
      "action": "kept",
      "reason": "codeSnippet im Diff bestätigt. Memory Leak bei wiederholtem Mount/Unmount — Severity 'important' ist angemessen."
    },
    {
      "agent": "ak-abgleich",
      "finding": "AK 'Ladeanimation' nicht umgesetzt",
      "action": "removed",
      "reason": "Der codeSnippet 'showLoadingSpinner()' kommt im Diff nicht vor. Agent hat die Zeile halluziniert."
    },
    {
      "agent": "code-quality",
      "finding": "Verschachtelte Ternary-Operatoren",
      "action": "severity-changed",
      "reason": "Kein Laufzeitrisiko, aber erschwert Lesbarkeit. Von 'important' auf 'minor' herabgestuft."
    }
  ]
}

OUTPUT RULES:
- Sort findings: critical first, then important, then minor.
- Tag each finding with "category": "ak-abgleich" or "code-quality" based on which agent produced it.
- Write a concise German summary, e.g. "3 Auffälligkeiten: 1 Kritisch, 1 Wichtig, 1 Gering".
- For every input finding, add a decision entry explaining what you did with it.

If no findings survive filtering, return an empty findings array with decisions and summary "Keine Auffälligkeiten".`,
```

- [ ] **Step 2: Commit**

```bash
git add proxy/cosi.js
git commit -m "feat(cosi): rewrite Consolidator prompt with noise examples and few-shot"
```

---

## Chunk 3: Wire up schemas, preprocessDiff, and user prompts

### Task 7: Update user prompt builders

**Files:**
- Modify: `proxy/cosi.js` — rewrite `buildAgent1Prompt`, `buildAgent2Prompt`, `buildConsolidatorPrompt`

- [ ] **Step 1: Rewrite all three prompt builder functions**

Replace the three functions (currently lines 199-236 approximately, but line numbers will have shifted) with:

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

Follow your thinking process step by step: EXTRACT, CLASSIFY, TRACE, FORMULATE.`;
}

function buildAgent2Prompt(diff) {
  return `<pr_diff>
${diff}
</pr_diff>

Follow your thinking process step by step: SCAN the added lines, then FORMULATE for confirmed issues only.`;
}

function buildConsolidatorPrompt(agent1Findings, agent2Findings, diff) {
  return `<pr_diff>
${diff}
</pr_diff>

<agent_1_findings>
${JSON.stringify(agent1Findings)}
</agent_1_findings>

<agent_2_findings>
${JSON.stringify(agent2Findings)}
</agent_2_findings>

Follow your thinking process step by step: OVERLAP, GROUNDING, QUALITY GATE, SEVERITY CHECK.`;
}
```

- [ ] **Step 2: Commit**

```bash
git add proxy/cosi.js
git commit -m "feat(cosi): update user prompts to end with analysis instruction"
```

---

### Task 8: Wire up `preprocessDiff` and `responseSchema` in `runReview`

**Files:**
- Modify: `proxy/cosi.js` — update `runReview` function

- [ ] **Step 1: Add preprocessDiff call at the start of runReview**

Inside `runReview`, right after `const warnings = [];`, add:

```js
  const processedDiff = preprocessDiff(diff);
```

- [ ] **Step 2: Replace all `diff` references in prompt builders with `processedDiff`**

Change these calls:
- `buildAgent1Prompt(diff, jiraTicket)` → `buildAgent1Prompt(processedDiff, jiraTicket)`
- `buildAgent2Prompt(diff)` → `buildAgent2Prompt(processedDiff)`
- `buildConsolidatorPrompt(agent1Result, agent2Result, diff)` → `buildConsolidatorPrompt(agent1Result, agent2Result, processedDiff)`

- [ ] **Step 3: Add `responseSchema` to each `callCoSi` generationConfig**

For Agent 1 (AK-Abgleich), add `responseSchema: AK_FINDING_SCHEMA` to the config object:
```js
callCoSi(buildAgent1Prompt(processedDiff, jiraTicket), SYSTEM_PROMPTS.akAbgleich, {
  temperature: 0.2,
  maxOutputTokens: 65536,
  responseSchema: AK_FINDING_SCHEMA,
  thinkingConfig: { thinkingBudget: 16384, includeThoughts: true },
})
```

For Agent 2 (Code Quality), add `responseSchema: CODE_QUALITY_FINDING_SCHEMA`:
```js
callCoSi(buildAgent2Prompt(processedDiff), SYSTEM_PROMPTS.codeQuality, {
  temperature: 0.4,
  maxOutputTokens: 65536,
  responseSchema: CODE_QUALITY_FINDING_SCHEMA,
  thinkingConfig: { thinkingBudget: 16384, includeThoughts: true },
})
```

For the Consolidator, add `responseSchema: CONSOLIDATOR_SCHEMA`:
```js
callCoSi(
  buildConsolidatorPrompt(agent1Result, agent2Result, processedDiff),
  SYSTEM_PROMPTS.consolidator,
  {
    temperature: 0.2,
    maxOutputTokens: 65536,
    responseSchema: CONSOLIDATOR_SCHEMA,
    thinkingConfig: { thinkingBudget: 16384, includeThoughts: true },
  },
)
```

- [ ] **Step 4: Update module.exports to include preprocessDiff**

Change:
```js
module.exports = { callCoSi, SYSTEM_PROMPTS, runReview };
```
To:
```js
module.exports = { callCoSi, preprocessDiff, SYSTEM_PROMPTS, runReview };
```

- [ ] **Step 5: Verify the proxy starts without errors**

Run: `node -e "require('./proxy/cosi.js')"`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add proxy/cosi.js
git commit -m "feat(cosi): wire up preprocessDiff and responseSchema in runReview"
```

---

## Chunk 4: Verification

### Task 9: Manual verification

- [ ] **Step 1: Start the proxy in mock mode (no API key)**

Run: `cd proxy && node index.js`
Verify: Server starts without errors. Mock mode should still work since it bypasses `callCoSi`.

- [ ] **Step 2: If API key is available, run a real review**

Trigger a review from the Orbit UI on a PR with a Jira ticket that has Akzeptanzkriterien. Check:
- JSON parsing succeeds (no errors in console)
- Line numbers in findings match the `[N]` annotations in the preprocessed diff
- `thoughts` output shows structured analysis steps (EXTRACT/CLASSIFY/TRACE/FORMULATE for Agent 1, SCAN/FORMULATE for Agent 2)
- All textual fields (title, detail, suggestion) are in German
- Consolidator decisions have German reasoning

- [ ] **Step 3: Final commit with all changes verified**

If any adjustments were needed during verification, commit them:
```bash
git add proxy/cosi.js
git commit -m "fix(cosi): adjustments from manual verification"
```
