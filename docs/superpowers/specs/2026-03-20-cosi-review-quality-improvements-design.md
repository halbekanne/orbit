# CoSi Review Quality Improvements

## Problem

The current CoSi AI review pipeline has several quality gaps:

1. **Consolidator cannot verify grounding** — it is told to verify that findings reference real files/lines, but it never receives the diff, making this check impossible.
2. **Agents review unchanged code** — agents generate false positives on context lines and removed lines that the PR author didn't touch.
3. **Findings lack code context** — the user must cross-reference line numbers against the diff to understand what code a finding targets.
4. **No thinking budget** — agents jump straight to conclusions without structured reasoning, reducing quality on complex diffs.
5. **No output limit** — agents can generate unbounded output on large diffs, risking hallucination loops.

## Solution

Five targeted changes to `proxy/cosi.js`, the review model, and two frontend components.

## Changes

### 1. Pass diff to consolidator

**File:** `proxy/cosi.js` — `buildConsolidatorPrompt`

Change signature from `(agent1Findings, agent2Findings)` to `(agent1Findings, agent2Findings, diff)`.

Embed the diff as a `<pr_diff>` block before the agent findings. Update the consolidator system prompt's step 4 (VERIFY GROUNDING) — replace the existing text entirely with:

```
4. VERIFY GROUNDING: Each finding must include a `codeSnippet`. Search for that snippet verbatim in the <pr_diff>. If the snippet does not appear in the diff, the specialist agent hallucinated it — discard the finding and log a "removed" decision with reason "hallucinated snippet".
```

**File:** `proxy/cosi.js` — `runReview`

Pass `diff` as third argument to `buildConsolidatorPrompt`.

### 2. "Only review ADDED lines" instruction

**File:** `proxy/cosi.js` — `SYSTEM_PROMPTS.akAbgleich` and `SYSTEM_PROMPTS.codeQuality`

Add to both system prompts, inside the RULES section:

```
- CRITICAL: Only review ADDED lines (lines starting with '+' in the diff). Lines starting with '-' are removed code — do not review them. Context lines (no prefix) are for understanding only — do not create findings for them.
```

### 3. `codeSnippet` field in findings

#### 3a. Agent prompts

**File:** `proxy/cosi.js` — `SYSTEM_PROMPTS.akAbgleich` and `SYSTEM_PROMPTS.codeQuality`

Add to the OUTPUT FORMAT block of both agents:

```
"codeSnippet": "The exact 1-2 lines of added code from the diff that this finding targets (copy verbatim, including leading '+' if present)"
```

#### 3b. Consolidator prompt

**File:** `proxy/cosi.js` — `SYSTEM_PROMPTS.consolidator`

Add `codeSnippet` to the finding output format:

```json
{
  "severity": "critical | important | minor",
  "category": "ak-abgleich | code-quality",
  "title": "...",
  "file": "...",
  "line": 0,
  "codeSnippet": "...",
  "detail": "...",
  "suggestion": "..."
}
```

The VERIFY GROUNDING step (updated in section 1) already uses `codeSnippet` for snippet-based matching against the diff.

#### 3c. TypeScript model

**File:** `src/app/models/review.model.ts`

Add optional `codeSnippet` to `ReviewFinding`:

```ts
export interface ReviewFinding {
  severity: 'critical' | 'important' | 'minor';
  category: 'ak-abgleich' | 'code-quality';
  title: string;
  file: string;
  line: number;
  detail: string;
  suggestion: string;
  codeSnippet?: string;
}
```

Optional because older reviews and edge cases (consolidator strips it) may not have it.

#### 3d. Finding card UI

**File:** `src/app/components/review-findings/review-findings.ts`

Inside the `@for (finding of group.findings; track $index)` loop, between the title `<p>` (line 99) and the detail `<div>` (line 100), add:

```html
@if (finding.codeSnippet) {
  <pre class="font-mono text-xs bg-stone-900 text-stone-100 rounded px-3 py-2 mb-1.5 overflow-x-auto whitespace-pre-wrap">{{ finding.codeSnippet }}</pre>
}
```

### 4. Enable thinking with `thinkingConfig`

#### 4a. Generation config

**File:** `proxy/cosi.js` — `runReview`

Add `thinkingConfig` and `maxOutputTokens` to each agent's generation config object passed to `callCoSi`:

| Agent | temperature | maxOutputTokens | thinkingBudget | includeThoughts |
|-------|-------------|-----------------|----------------|-----------------|
| AK-Abgleich | 0.2 (unchanged) | 4096 (new) | 4096 | true |
| Code-Qualität | 0.4 (unchanged) | 4096 (new) | 4096 | true |
| Konsolidator | 0.2 (unchanged) | 8192 (new) | 2048 | true |

Example config for Agent 2:
```js
{
  temperature: 0.4,
  maxOutputTokens: 4096,
  thinkingConfig: { thinkingBudget: 4096, includeThoughts: true }
}
```

`responseMimeType: 'application/json'` remains — Gemini 2.5 Flash supports thinking mode and JSON output simultaneously.

#### 4b. Extract thoughts from response

**File:** `proxy/cosi.js` — `callCoSi`

With `includeThoughts: true`, the Vertex AI response returns multiple `parts` in `candidates[0].content.parts`. Each part has an optional `thought` boolean flag:

```json
{
  "candidates": [{
    "content": {
      "parts": [
        { "text": "reasoning step 1...", "thought": true },
        { "text": "reasoning step 2...", "thought": true },
        { "text": "{\"findings\": [...]}" }
      ]
    }
  }]
}
```

Update `callCoSi` to iterate over all parts:
- **Thought parts** (`part.thought === true`): concatenate their `text` into a single `thoughts` string
- **Non-thought parts** (`part.thought` is falsy): concatenate their `text` and `JSON.parse()` it

Return shape changes from a plain parsed JSON object to `{ result, thoughts }`:

```js
const parts = data.candidates?.[0]?.content?.parts ?? [];
const thoughtTexts = [];
const textParts = [];

for (const part of parts) {
  if (part.thought) {
    thoughtTexts.push(part.text);
  } else if (part.text) {
    textParts.push(part.text);
  }
}

const text = textParts.join('');
if (!text) throw new Error('CoSi returned no content');

return { result: JSON.parse(text), thoughts: thoughtTexts.join('\n') || null };
```

All callers in `runReview` must destructure `{ result, thoughts }` instead of using the return value directly. E.g. `const { result: agent1Result, thoughts: agent1Thoughts } = await callCoSi(...)`.

#### 4c. SSE events

**File:** `proxy/cosi.js` — `runReview`

Agent events:
- `agent:start`: add `thinkingBudget` field (number)
- `agent:done`: add `thoughts` field (string | null)

Consolidator events:
- `consolidator:start`: add `thinkingBudget` field (number)
- `consolidator:done`: add `thoughts` field (string | null)

#### 4d. TypeScript models

**File:** `src/app/models/review.model.ts`

Update `AgentStep`:
```ts
export interface AgentStep {
  agent: string;
  label: string;
  temperature: number;
  thinkingBudget?: number;
  status: 'running' | 'done' | 'error';
  duration?: number;
  findingCount?: number;
  summary?: string;
  thoughts?: string;
  rawResponse?: unknown;
  error?: string;
}
```

Update `ConsolidatorStep`:
```ts
export interface ConsolidatorStep {
  status: 'pending' | 'running' | 'done' | 'error';
  temperature?: number;
  thinkingBudget?: number;
  error?: string;
  duration?: number;
  decisions?: ConsolidatorDecision[];
  summary?: string;
  thoughts?: string;
  rawResponse?: unknown;
}
```

Also fix existing inconsistency — add `merged` to `ConsolidatorDecision.action` to match the consolidator prompt:
```ts
export interface ConsolidatorDecision {
  action: 'kept' | 'removed' | 'merged' | 'severity-changed';
  reason: string;
  finding: string;
  oldSeverity?: string;
  newSeverity?: string;
}
```

#### 4e. Frontend — SSE consumer

**File:** `src/app/services/cosi-review.service.ts`

- `agent:start` handler: read `thinkingBudget` from event data, store on `AgentStep`
- `agent:done` handler: read `thoughts` from event data, store on `AgentStep`
- `consolidator:start` handler: read `thinkingBudget` from event data, store on `ConsolidatorStep`
- `consolidator:done` handler: read `thoughts` from event data, store on `ConsolidatorStep`

#### 4f. Frontend — Pipeline timeline

**File:** `src/app/components/review-pipeline/review-pipeline.ts`

For both agent steps and consolidator step:
- Display thinking budget next to temperature label: `T=0.4 · TB=4096`
- Add collapsible "Denkprozess anzeigen" `<details>` block when `thoughts` is present:
  - Summary text in indigo (`text-indigo-600`, `font-weight: 500`, `font-size: 11px`)
  - Content: monospace text in a `bg-stone-50 border border-stone-200 rounded-md p-3` box
  - Position above the existing raw JSON response toggle

### 5. Set `maxOutputTokens`

Covered in section 4a — `maxOutputTokens` is added as part of each agent's generation config. This is a new field; the current implementation has no output token limit.

## Out of scope

- Temperature changes (current values 0.2 / 0.4 / 0.2 remain)
- `responseSchema` / structured outputs
- `topP` / `topK` parameters
- Structural refactors to the pipeline architecture

## Files changed

| File | Changes |
|------|---------|
| `proxy/cosi.js` | Prompts, generation config, `callCoSi` return shape, `buildConsolidatorPrompt` signature |
| `src/app/models/review.model.ts` | `ReviewFinding.codeSnippet`, `AgentStep.thoughts`/`thinkingBudget`, `ConsolidatorStep.thoughts`/`thinkingBudget`, `ConsolidatorDecision.action` union fix |
| `src/app/services/cosi-review.service.ts` | Handle new SSE event fields (`thinkingBudget`, `thoughts`) for both agents and consolidator |
| `src/app/components/review-findings/review-findings.ts` | Code snippet block in finding card |
| `src/app/components/review-pipeline/review-pipeline.ts` | Thinking budget display, thoughts toggle for agents and consolidator |
