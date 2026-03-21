# CoSi Review Quality Improvements v2

## Context

Two expert reviews of the CoSi AI review system identified structural weaknesses and prompt improvements. The thinking phase instructions from the previous iteration are in place but the models still have: unreliable line numbers (LLMs can't count from hunk headers), fragile JSON output (prompt-based format enforcement), redundant process blocks confusing the models, and English-only output fields besides titles.

This spec addresses all high-impact improvements while keeping temperature, topP/topK, and token limits unchanged (to be tuned manually later).

## Goals

- Eliminate line number hallucinations via diff preprocessing
- Guarantee valid JSON structure via `responseSchema`
- Remove redundant/conflicting instructions from prompts
- Shift Code Quality agent away from issues static analysis already catches
- Calibrate output tone and granularity via few-shot examples
- Make all user-facing text output German

## Non-Goals

- Temperature, topP, topK tuning
- maxOutputTokens or thinkingBudget adjustments
- Splitting `suggestion` into `rationale` + `suggestedCode`
- Evaluation loop / precision-recall measurement
- Programmatic pre-consolidator validation
- Diff splitting for large PRs

## Files Changed

| File | Change Type |
|------|-------------|
| `proxy/cosi.js` | Prompts, responseSchema, preprocessDiff function, prompt builder changes |

No frontend changes. No model changes. Mock mode (`cosi-mock.js`) is unaffected — it returns hardcoded data and does not go through `callCoSi`.

---

## Change 1: `responseSchema` in `generationConfig`

### What

Add a `responseSchema` object to the `generationConfig` for all three agent calls. This enforces JSON structure at the API level — Gemini guarantees valid JSON matching the schema.

### Consequence for Prompts

The following blocks are **removed** from all prompts:

- `OUTPUT FORMAT — each finding: { ... }` blocks
- `Output: { "findings": [...] }` lines
- `SEVERITY:` definition blocks (severity semantics move into schema `description` fields)
- The rule `"Output valid JSON only. No markdown, no wrapping, no explanation outside the JSON."` from SHARED_CONSTRAINTS
- The `"Output JSON only."` closing lines in user prompts

Severity semantics (what counts as critical vs. important vs. minor) remain as prompt context in the agent-specific system prompts — shorter than before since we no longer explain the format, only the meaning.

### Agent 1 + Agent 2 Schema

```js
const FINDING_SCHEMA = {
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
            // description differs per agent — set in agent-specific schema
          },
          title: { type: "STRING", description: "Short German summary of the issue" },
          file: { type: "STRING", description: "File path from the diff" },
          line: { type: "INTEGER", description: "Line number from the diff (the number in square brackets)" },
          codeSnippet: { type: "STRING", description: "The exact 1-2 lines from the diff that this finding targets, copied verbatim" },
          detail: { type: "STRING", description: "What the problem is and why it matters (1-3 sentences, in German)" },
          suggestion: { type: "STRING", description: "Concrete improvement suggestion (in German, English technical terms allowed inline)" }
        },
        required: ["severity", "title", "file", "line", "codeSnippet", "detail", "suggestion"],
        propertyOrdering: ["severity", "title", "file", "line", "codeSnippet", "detail", "suggestion"]
      }
    }
  },
  required: ["findings"],
  propertyOrdering: ["findings"]
}
```

The `severity.description` field differs per agent:

- **Agent 1 (AK-Abgleich):** `"critical = AK completely unaddressed, important = AK partially addressed but key scenario missing, minor = AK addressed but deviates from spec in a small detail"`
- **Agent 2 (Code Quality):** `"critical = runtime error or broken functionality, important = structural problem hurting maintainability or missing cleanup logic, minor = readability improvement or small inconsistency"`

### Consolidator Schema

```js
{
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
            description: "critical = real runtime risk, important = structural problem, minor = small improvement"
          },
          category: {
            type: "STRING",
            enum: ["ak-abgleich", "code-quality"],
            description: "Which agent originally produced the finding"
          },
          title: { type: "STRING", description: "Short German summary" },
          file: { type: "STRING", description: "File path from the diff" },
          line: { type: "INTEGER", description: "Line number from the diff" },
          codeSnippet: { type: "STRING", description: "Exact lines from the diff, copied verbatim" },
          detail: { type: "STRING", description: "Problem description in German (1-3 sentences)" },
          suggestion: { type: "STRING", description: "Improvement suggestion in German" }
        },
        required: ["severity", "category", "title", "file", "line", "codeSnippet", "detail", "suggestion"],
        propertyOrdering: ["severity", "category", "title", "file", "line", "codeSnippet", "detail", "suggestion"]
      }
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
          reason: { type: "STRING", description: "Reasoning in German" }
        },
        required: ["agent", "finding", "action", "reason"],
        propertyOrdering: ["agent", "finding", "action", "reason"]
      }
    },
    summary: {
      type: "STRING",
      description: "German summary, e.g. '3 Auffälligkeiten: 1 Kritisch, 1 Wichtig, 1 Gering' or 'Keine Auffälligkeiten'"
    }
  },
  required: ["findings", "decisions", "summary"],
  propertyOrdering: ["findings", "decisions", "summary"]
}
```

### Code Change in `callCoSi`

The `responseSchema` is passed as part of `generationConfig`. The existing `responseMimeType: 'application/json'` stays — the Vertex AI docs require both to be set together.

---

## Change 2: Diff Preprocessing with Line Number Injection

### What

A new `preprocessDiff(rawDiff)` function that annotates every line in the diff with its actual line number before sending it to the API.

### Before (what the API sees today)

```diff
@@ -15,7 +15,10 @@
 const oldVar = true;
-const toRemove = false;
+const newVar = false;
+const addedLogic = true;
```

### After (what the API sees after preprocessing)

```diff
@@ -15,7 +15,10 @@
[15]  const oldVar = true;
[16]- const toRemove = false;
[16]+ const newVar = false;
[17]+ const addedLogic = true;
```

### Rules

- **Context lines** (no prefix): `[new_file_line_number]`
- **Removed lines** (`-`): `[old_file_line_number]`
- **Added lines** (`+`): `[new_file_line_number]`
- **Hunk headers, file headers, `---`/`+++` lines**: unchanged
- Line numbers are parsed from hunk headers and incremented per line

### Integration

- `preprocessDiff()` is called once in `runReview()` before the parallel agent calls
- The preprocessed diff is passed to all three prompt builders (`buildAgent1Prompt`, `buildAgent2Prompt`, `buildConsolidatorPrompt`)
- The function is pure (no side effects) and exported for testing

### Prompt Change

Added to SHARED_CONSTRAINTS:
```
Every line in the diff starts with [line_number]. Use this number directly as the "line" value.
```

---

## Change 3: Prompt Cleanup

### 3a: Remove Redundant PROCESS Blocks

**Agent 1 (AK-Abgleich):** The old PROCESS block is removed entirely:
```
PROCESS:                              ← REMOVE
1. Read the Jira ticket...            ← REMOVE
2. For each AK, check...             ← REMOVE
3. Report only gaps...                ← REMOVE
```
The YOUR THINKING PROCESS block (EXTRACT → CLASSIFY → TRACE → FORMULATE) already covers this completely.

The `If the Jira ticket description contains no identifiable Akzeptanzkriterien...` instruction stays — it's a guard clause not covered by the thinking process.

**Consolidator:** The old PROCESS block (8 steps) is replaced by a short OUTPUT RULES block that only covers output transformations:
```
OUTPUT RULES:
- Sort findings: critical first, then important, then minor.
- Tag each finding with "category": "ak-abgleich" or "code-quality" based on which agent produced it.
- Write a concise German summary, e.g. "3 Auffälligkeiten: 1 Kritisch, 1 Wichtig, 1 Gering".
- For every input finding, add a decision entry explaining what you did with it.
```

The thinking steps (OVERLAP, GROUNDING, QUALITY GATE, SEVERITY CHECK) handle all the analytical work. OUTPUT RULES cover formatting only; analytical steps live in THINKING PROCESS.

### 3b: SHARED_CONSTRAINTS Rewrite

**Removed** (enforced by responseSchema):
- `"Output valid JSON only. No markdown, no wrapping, no explanation outside the JSON."`

**New SHARED_CONSTRAINTS content:**

```
You are reviewing a pull request for a Design System built with TypeScript, Lit (Web Components), and SCSS.

Every line in the diff starts with [line_number]. Use this number directly as the "line" value.

RULES:
- Report only problems. Every finding must describe a concrete deficiency.
- No praise, no "looks good", no "well done", no "LGTM".
- Report a finding ONLY if you can point to a specific added line in the diff. Without an exact codeSnippet, the finding does not exist.
- CRITICAL: Only review ADDED lines (lines starting with '+' in the diff). Lines starting with '-' are removed code — do not review them. Context lines (no prefix) are for understanding only — do not create findings for them.
- An empty findings array is a valid result, not an error. Do not manufacture issues to fill the output — but when in doubt, report one finding too many rather than miss one.
- All textual fields (title, detail, suggestion) must be in German. English technical terms (e.g. "null check", "race condition", "lifecycle hook") may be used inline.

THINKING PHASE INSTRUCTIONS:
You have a dedicated thinking phase before generating the JSON. You MUST use this phase to perform a step-by-step analysis. Do NOT use the thinking phase to draft JSON syntax. Use it to reason about the code, cross-reference requirements, and verify your claims. Only after completing your analysis should you write the JSON output.
```

### 3c: All User-Facing Output in German

The rule `"Titles must be in German. Detail and suggestion may use English for technical terms."` is replaced by:
```
All textual fields (title, detail, suggestion) must be in German. English technical terms (e.g. "null check", "race condition", "lifecycle hook") may be used inline.
```

This also applies to the `reason` field in Consolidator decisions (already German via schema description).

### 3d: User Prompt Reordering

The user prompts currently end with `"Output JSON only."` which primes the thinking phase toward JSON construction. Each user prompt now ends with the analysis instruction instead:

**Agent 1:**
```
Follow your thinking process step by step: EXTRACT, CLASSIFY, TRACE, FORMULATE.
```

**Agent 2:**
```
Follow your thinking process step by step: SCAN the added lines, then FORMULATE for confirmed issues only.
```

**Consolidator:**
```
Follow your thinking process step by step: OVERLAP, GROUNDING, QUALITY GATE, SEVERITY CHECK.
```

---

## Change 4: Code Quality Agent Refocus

### What

The Code Quality agent's FOCUS AREAS are adjusted to avoid overlap with TypeScript strict mode and ESLint. The agent should focus on problems that only a human reviewer would find.

### New FOCUS AREAS

```
FOCUS AREAS (in priority order):
Ignore issues that TypeScript strict mode or ESLint would already catch (type errors, null access on strict types, unused variables, import order, formatting). Focus on problems that only a human reviewer would find:

1. Logic errors that compile but behave incorrectly — race conditions, off-by-one, wrong conditions, unhandled edge cases
2. Readability and maintainability — convoluted logic, deep nesting, unclear intent, functions doing too much
3. Lit / Web Components best practices — lifecycle errors, missing cleanup logic (event listeners, subscriptions), inefficient rendering, incorrect reactive property usage
4. Clean code structure — single responsibility, sensible naming, DRY (no premature abstraction)
```

---

## Change 5: Few-Shot Examples

One calibration example per agent. Placement order in each agent prompt: THINKING PROCESS → EXAMPLE → guard clauses / SCOPE.

### Agent 1 (AK-Abgleich) — Tone: sachlich-präzise

```
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
```

### Agent 2 (Code Quality) — Tone: sachlich-präzise

```
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
```

### Consolidator — Tone: ausführlich, zeigt Begründungstiefe

```
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
```

---

## Change 6: Consolidator Noise Examples

Added to the Consolidator system prompt after the QUALITY GATE thinking step:

```
NOISE EXAMPLES (always remove findings like these):
- Formatting, trailing commas, semicolons, quote style → enforced by ESLint/Prettier
- Import ordering or grouping → enforced by ESLint
- Type errors or null checks that TypeScript strict mode already enforces → the build will break anyway
- Purely cosmetic renames that improve neither readability nor maintainability → a matter of taste, not a defect
- Findings that name no concrete problem but only suggest an alternative ("could also use X") → only keep if the current solution has a measurable problem (readability, performance, maintainability), then as "minor"
```

---

## Verification

1. Run a real review on a PR with a Jira ticket that has AKs
2. Check that JSON parsing never fails (responseSchema guarantees structure)
3. Verify line numbers in findings match the annotated diff lines
4. Check `thoughts` output shows structured analysis (EXTRACT → CLASSIFY → TRACE → FORMULATE), not JSON drafting
5. Verify all textual fields (title, detail, suggestion, reason) are in German
6. Compare finding quality: fewer false positives, no hallucinated line numbers, no lint/type-check overlap
