# CoSi Review Quality Improvements — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve CoSi AI review quality by passing the diff to the consolidator, restricting agents to added lines, adding code snippets to findings, enabling Gemini thinking mode, and setting output token limits.

**Architecture:** Five independent improvements to the existing three-agent review pipeline. Backend changes in `proxy/cosi.js` (prompts, generation config, response parsing). Frontend changes in models, SSE consumer, and two UI components. Mock data updated to match.

**Tech Stack:** Node.js (proxy), Angular 20+ (frontend), Gemini 2.5 Flash via Vertex AI

**Spec:** `docs/superpowers/specs/2026-03-20-cosi-review-quality-improvements-design.md`

---

## Chunk 1: Backend — callCoSi and generation config

### Task 1: Update `callCoSi` to extract thoughts from response

**Files:**
- Modify: `proxy/cosi.js:5-40`

- [ ] **Step 1: Update `callCoSi` response parsing**

Replace lines 33-39 of `proxy/cosi.js`:

```js
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('CoSi returned no content');
  }

  return JSON.parse(text);
```

With:

```js
  const data = await response.json();
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
  if (!text) {
    throw new Error('CoSi returned no content');
  }

  return { result: JSON.parse(text), thoughts: thoughtTexts.join('\n') || null };
```

- [ ] **Step 2: Update Agent 1 caller in `runReview` to destructure new return shape**

In `runReview`, the Agent 1 call (line 221) currently does:
```js
callCoSi(buildAgent1Prompt(diff, jiraTicket), SYSTEM_PROMPTS.akAbgleich, { temperature: 0.2 })
  .then((result) => {
```

Change the generation config and destructure:
```js
callCoSi(buildAgent1Prompt(diff, jiraTicket), SYSTEM_PROMPTS.akAbgleich, {
  temperature: 0.2,
  maxOutputTokens: 4096,
  thinkingConfig: { thinkingBudget: 4096, includeThoughts: true },
})
  .then(({ result, thoughts }) => {
```

Also update the `emit('agent:done', ...)` inside this `.then()` to include `thoughts`:
```js
emit('agent:done', {
  agent: 'ak-abgleich',
  duration: Date.now() - agent1Start,
  findingCount: result.findings.length,
  summary: describeFindings(result.findings),
  thoughts,
  rawResponse: result,
});
return { result, thoughts };
```

And the `.catch()` return: `return { result: { findings: [] }, thoughts: null };`

- [ ] **Step 3: Update Agent 2 caller in `runReview` similarly**

Change the generation config:
```js
callCoSi(buildAgent2Prompt(diff), SYSTEM_PROMPTS.codeQuality, {
  temperature: 0.4,
  maxOutputTokens: 4096,
  thinkingConfig: { thinkingBudget: 4096, includeThoughts: true },
})
  .then(({ result, thoughts }) => {
```

Update emit to include `thoughts`, update catch return to `{ result: { findings: [] }, thoughts: null }`.

- [ ] **Step 4: Update `agent:start` emits to include `thinkingBudget`**

Agent 1 start (line 218):
```js
emit('agent:start', { agent: 'ak-abgleich', label: 'AK-Abgleich', temperature: 0.2, thinkingBudget: 4096 });
```

Agent 2 start (line 243):
```js
emit('agent:start', { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4, thinkingBudget: 4096 });
```

- [ ] **Step 5: Update result destructuring after `Promise.all`**

Lines 264-266 currently:
```js
const results = await Promise.all(agentCalls);
const agent1Result = jiraTicket ? results[0] : { findings: [] };
const agent2Result = jiraTicket ? results[1] : results[0];
```

Change to:
```js
const results = await Promise.all(agentCalls);
const agent1Result = jiraTicket ? results[0].result : { findings: [] };
const agent2Result = jiraTicket ? results[1].result : results[0].result;
```

- [ ] **Step 6: Update consolidator call with new config and diff parameter**

Lines 274-281 currently:
```js
emit('consolidator:start', { temperature: 0.2 });
const consolStart = Date.now();

const consolidated = await callCoSi(
  buildConsolidatorPrompt(agent1Result, agent2Result),
  SYSTEM_PROMPTS.consolidator,
  { temperature: 0.2 },
);
```

Change to:
```js
emit('consolidator:start', { temperature: 0.2, thinkingBudget: 2048 });
const consolStart = Date.now();

const { result: consolidated, thoughts: consolidatorThoughts } = await callCoSi(
  buildConsolidatorPrompt(agent1Result, agent2Result, diff),
  SYSTEM_PROMPTS.consolidator,
  {
    temperature: 0.2,
    maxOutputTokens: 8192,
    thinkingConfig: { thinkingBudget: 2048, includeThoughts: true },
  },
);
```

- [ ] **Step 7: Add `thoughts` to `consolidator:done` emit**

In the `consolidator:done` emit (lines 283-294), add `thoughts: consolidatorThoughts`:
```js
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
  summary: describeConsolidation(agent1Result, agent2Result, consolidated),
  rawResponse: consolidated,
});
```

- [ ] **Step 8: Commit**

```bash
git add proxy/cosi.js
git commit -m "feat(cosi): update callCoSi for thinking mode and add generation config"
```

---

## Chunk 2: Backend — Prompt improvements

### Task 2: Add "only ADDED lines" rule and `codeSnippet` to agent prompts

**Files:**
- Modify: `proxy/cosi.js:42-155` (SHARED_CONSTRAINTS and SYSTEM_PROMPTS)

- [ ] **Step 1: Add "only ADDED lines" rule to SHARED_CONSTRAINTS**

After line 49 (`- Findings without a concrete location in the diff are not findings — discard them.`), add:
```
- CRITICAL: Only review ADDED lines (lines starting with '+' in the diff). Lines starting with '-' are removed code — do not review them. Context lines (no prefix) are for understanding only — do not create findings for them.
```

- [ ] **Step 2: Add `codeSnippet` to Agent 1 OUTPUT FORMAT**

In `SYSTEM_PROMPTS.akAbgleich`, change the OUTPUT FORMAT block (lines 66-73) to include `codeSnippet`:
```
OUTPUT FORMAT — each finding:
{
  "severity": "critical | important | minor",
  "title": "Short German summary of the gap",
  "file": "file path from the diff",
  "line": <line number from the diff>,
  "codeSnippet": "The exact 1-2 lines of added code from the diff that this finding targets (copy verbatim, including leading '+' if present)",
  "detail": "Which AK is affected and what is missing (1-3 sentences)",
  "suggestion": "Concrete next step to close the gap"
}
```

- [ ] **Step 3: Add `codeSnippet` to Agent 2 OUTPUT FORMAT**

Same change in `SYSTEM_PROMPTS.codeQuality` OUTPUT FORMAT block (lines 95-103):
```
OUTPUT FORMAT — each finding:
{
  "severity": "critical | important | minor",
  "title": "Short German summary of the issue",
  "file": "file path from the diff",
  "line": <line number from the diff>,
  "codeSnippet": "The exact 1-2 lines of added code from the diff that this finding targets (copy verbatim, including leading '+' if present)",
  "detail": "What is wrong and why it matters (1-3 sentences)",
  "suggestion": "How to fix it, with a brief code hint if helpful"
}
```

- [ ] **Step 4: Update consolidator prompt — output format and grounding step**

In `SYSTEM_PROMPTS.consolidator`:

Replace step 4 (line 124):
```
4. VERIFY GROUNDING: Each finding must reference a real file and line. If a finding mentions a file or line that does not exist in the provided context, the specialist agent hallucinated it — discard it.
```
With:
```
4. VERIFY GROUNDING: Each finding must include a codeSnippet. Search for that snippet verbatim in the <pr_diff>. If the snippet does not appear in the diff, the specialist agent hallucinated it — discard the finding and log a "removed" decision with reason "hallucinated snippet".
```

Add `codeSnippet` to the OUTPUT FORMAT findings block (lines 132-141):
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

### Task 3: Update `buildConsolidatorPrompt` to accept diff

**Files:**
- Modify: `proxy/cosi.js:180-190`

- [ ] **Step 1: Change signature and add diff block**

Replace:
```js
function buildConsolidatorPrompt(agent1Findings, agent2Findings) {
  return `<agent_1_findings>
${JSON.stringify(agent1Findings)}
</agent_1_findings>

<agent_2_findings>
${JSON.stringify(agent2Findings)}
</agent_2_findings>

Deduplicate, filter, sort, categorize, and write the summary. Output JSON only.`;
}
```

With:
```js
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

Verify grounding against the diff, then deduplicate, filter, sort, categorize, and write the summary. Output JSON only.`;
}
```

- [ ] **Step 2: Commit**

```bash
git add proxy/cosi.js
git commit -m "feat(cosi): improve prompts with ADDED-lines rule, codeSnippet, and diff for consolidator"
```

---

## Chunk 3: Frontend — Models and SSE consumer

### Task 4: Update TypeScript models

**Files:**
- Modify: `src/app/models/review.model.ts`

- [ ] **Step 1: Add `codeSnippet` to `ReviewFinding`**

After line 8 (`suggestion: string;`), add:
```ts
  codeSnippet?: string;
```

- [ ] **Step 2: Add `thinkingBudget` and `thoughts` to `AgentStep`**

After line 22 (`temperature: number;`), add:
```ts
  thinkingBudget?: number;
```

After line 26 (`summary?: string;`), add:
```ts
  thoughts?: string;
```

- [ ] **Step 3: Add `merged` to `ConsolidatorDecision.action`**

Change line 31 from:
```ts
  action: 'kept' | 'removed' | 'severity-changed';
```
To:
```ts
  action: 'kept' | 'removed' | 'merged' | 'severity-changed';
```

- [ ] **Step 4: Add `thinkingBudget` and `thoughts` to `ConsolidatorStep`**

After line 40 (`temperature?: number;`), add:
```ts
  thinkingBudget?: number;
```

After line 44 (`summary?: string;`), add:
```ts
  thoughts?: string;
```

- [ ] **Step 5: Add `merged` case to pipeline component to match updated union**

Since we added `merged` to `ConsolidatorDecision.action`, the `decisionBadgeClass` and `decisionLabel` switch statements in `src/app/components/review-pipeline/review-pipeline.ts` will fail TypeScript exhaustiveness checks. Fix them now to keep the build green.

In `decisionBadgeClass` (line 180-185), the switch currently has `kept`, `removed`, `severity-changed`. Add before the closing `}`:
```ts
case 'merged': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
```

In `decisionLabel` (line 188-193), add before the closing `}`:
```ts
case 'merged': return 'zusammengeführt';
```

- [ ] **Step 6: Commit**

```bash
git add src/app/models/review.model.ts src/app/components/review-pipeline/review-pipeline.ts
git commit -m "feat(cosi): extend review models with codeSnippet, thoughts, and thinkingBudget"
```

### Task 5: Update SSE consumer

**Files:**
- Modify: `src/app/services/cosi-review.service.ts:140-196`

- [ ] **Step 1: Add `thinkingBudget` to `agent:start` handler**

In the `agent:start` case (lines 142-148), add `thinkingBudget`:
```ts
case 'agent:start':
  pipeline.agents.push({
    agent: data['agent'],
    label: data['label'],
    temperature: data['temperature'],
    thinkingBudget: data['thinkingBudget'],
    status: 'running',
  } as AgentStep);
  break;
```

- [ ] **Step 2: Add `thoughts` to `agent:done` handler**

In the `agent:done` case (lines 150-159), add `thoughts`:
```ts
case 'agent:done': {
  const agent = pipeline.agents.find(a => a.agent === data['agent']);
  if (agent) {
    agent.status = 'done';
    agent.duration = data['duration'];
    agent.findingCount = data['findingCount'];
    agent.summary = data['summary'];
    agent.thoughts = data['thoughts'];
    agent.rawResponse = data['rawResponse'];
  }
  break;
}
```

- [ ] **Step 3: Add `thinkingBudget` to `consolidator:start` handler**

Change lines 171-176:
```ts
case 'consolidator:start':
  pipeline.consolidator = {
    status: 'running',
    temperature: data['temperature'],
    thinkingBudget: data['thinkingBudget'],
  };
  break;
```

- [ ] **Step 4: Add `thoughts` to `consolidator:done` handler**

Change lines 178-187:
```ts
case 'consolidator:done':
  pipeline.consolidator = {
    status: 'done',
    temperature: pipeline.consolidator.temperature,
    thinkingBudget: pipeline.consolidator.thinkingBudget,
    duration: data['duration'],
    decisions: data['decisions'],
    summary: data['summary'],
    thoughts: data['thoughts'],
    rawResponse: data['rawResponse'],
  };
  return data['result'] as ReviewResult;
```

- [ ] **Step 5: Commit**

```bash
git add src/app/services/cosi-review.service.ts
git commit -m "feat(cosi): handle thinkingBudget and thoughts in SSE consumer"
```

---

## Chunk 4: Frontend — UI components

### Task 6: Add code snippet to finding card

**Files:**
- Modify: `src/app/components/review-findings/review-findings.ts:99-100`

- [ ] **Step 1: Add code snippet block between title and detail**

After line 99 (`<p class="text-sm font-medium text-stone-800 mb-1">{{ finding.title }}</p>`), add:
```html
                            @if (finding.codeSnippet) {
                              <pre class="font-mono text-xs bg-stone-900 text-stone-100 rounded px-3 py-2 mb-1.5 overflow-x-auto whitespace-pre-wrap">{{ finding.codeSnippet }}</pre>
                            }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/review-findings/review-findings.ts
git commit -m "feat(cosi): display code snippet in finding card"
```

### Task 7: Add thinking budget and thoughts to pipeline timeline

**Files:**
- Modify: `src/app/components/review-pipeline/review-pipeline.ts`

- [ ] **Step 1: Add thinking budget badge next to temperature for agents**

After line 54 (the temperature `<span>` for agents):
```html
<span class="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200">T={{ agent.temperature }}</span>
```

Add:
```html
                    @if (agent.thinkingBudget != null) {
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200">TB={{ agent.thinkingBudget }}</span>
                    }
```

- [ ] **Step 2: Add thoughts toggle for agents**

After the agent error display (line 64, `<p class="text-xs text-red-600 mt-1">{{ agent.error }}</p>`) and before the raw JSON toggle (line 65, `@if (agent.rawResponse != null)`), add:
```html
                  @if (agent.thoughts) {
                    <button
                      type="button"
                      class="text-[10px] text-indigo-600 font-medium mt-1 cursor-pointer hover:text-indigo-800"
                      (click)="toggleAgentThoughts(agent.agent)"
                    >
                      {{ isAgentThoughtsOpen(agent.agent) ? 'Denkprozess ausblenden' : 'Denkprozess anzeigen' }}
                    </button>
                    @if (isAgentThoughtsOpen(agent.agent)) {
                      <pre class="bg-stone-50 border border-stone-200 text-stone-600 font-mono text-[10px] p-3 rounded-md mt-1 overflow-x-auto max-h-48 whitespace-pre-wrap">{{ agent.thoughts }}</pre>
                    }
                  }
```

- [ ] **Step 3: Add thinking budget badge for consolidator**

After line 92 (the consolidator temperature `<span>`):
```html
@if (p.consolidator.temperature != null) {
  <span class="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200">T={{ p.consolidator.temperature }}</span>
}
```

Add after this block:
```html
                    @if (p.consolidator.thinkingBudget != null) {
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200">TB={{ p.consolidator.thinkingBudget }}</span>
                    }
```

- [ ] **Step 4: Add thoughts toggle for consolidator**

After the consolidator error display (line 102) and before the decisions block (line 104), add:
```html
                  @if (p.consolidator.thoughts) {
                    <button
                      type="button"
                      class="text-[10px] text-indigo-600 font-medium mt-1 cursor-pointer hover:text-indigo-800"
                      (click)="toggleConsolidatorThoughts()"
                    >
                      {{ consolidatorThoughtsOpen() ? 'Denkprozess ausblenden' : 'Denkprozess anzeigen' }}
                    </button>
                    @if (consolidatorThoughtsOpen()) {
                      <pre class="bg-stone-50 border border-stone-200 text-stone-600 font-mono text-[10px] p-3 rounded-md mt-1 overflow-x-auto max-h-48 whitespace-pre-wrap">{{ p.consolidator.thoughts }}</pre>
                    }
                  }
```

- [ ] **Step 5: Add thoughts toggle state and methods to component class**

Add a new signal next to the existing `consolidatorJsonOpen`:
```ts
private readonly openAgentThoughts = signal<Set<string>>(new Set());
consolidatorThoughtsOpen = signal(false);
```

Add methods:
```ts
isAgentThoughtsOpen(agent: string): boolean {
  return this.openAgentThoughts().has(agent);
}

toggleAgentThoughts(agent: string): void {
  this.openAgentThoughts.update(set => {
    const next = new Set(set);
    if (next.has(agent)) {
      next.delete(agent);
    } else {
      next.add(agent);
    }
    return next;
  });
}

toggleConsolidatorThoughts(): void {
  this.consolidatorThoughtsOpen.update(v => !v);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/components/review-pipeline/review-pipeline.ts
git commit -m "feat(cosi): display thinking budget and thoughts in pipeline timeline"
```

---

## Chunk 5: Mock data update and verification

### Task 8: Update mock data with new fields

**Files:**
- Modify: `proxy/cosi-mock.js`

- [ ] **Step 1: Add `codeSnippet` to all mock FINDINGS**

Add `codeSnippet` to each finding in the `FINDINGS` object:

```js
akAbgleich: {
  // ... existing fields
  codeSnippet: '+  background-color: var(--btn-primary-bg);',
},
codeQuality1: {
  // ... existing fields
  codeSnippet: '+    const variant = value as ButtonVariant;',
},
codeQuality2: {
  // ... existing fields
  codeSnippet: '+    const classes = this.computeClasses();',
},
eventListener: {
  // ... existing fields
  codeSnippet: '+    this.addEventListener(\'mouseenter\', this.onHover);',
},
nullCheck: {
  // ... existing fields
  codeSnippet: '+    if (this.content != null) {',
},
shadowDom: {
  // ... existing fields
  codeSnippet: '+  .card-container {',
},
```

- [ ] **Step 2: Add `thinkingBudget` to all `agent:start` emits in scenarios**

Update all `agent:start` emits across all scenarios to include `thinkingBudget`:
```js
emit('agent:start', { agent: 'ak-abgleich', label: 'AK-Abgleich', temperature: 0.2, thinkingBudget: 4096 });
emit('agent:start', { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4, thinkingBudget: 4096 });
```

- [ ] **Step 3: Add `thoughts` to all `agent:done` emits in scenarios**

Add a mock `thoughts` string to each `agent:done` emit:
```js
emit('agent:done', {
  agent: 'ak-abgleich',
  duration: 1200,
  findingCount: akFindings.length,
  summary: '1 Auffälligkeit: 1 Kritisch',
  thoughts: 'Analyzing ticket description...\nFound 3 Akzeptanzkriterien.\nAK-1: Hover state for primary button — checking diff... NOT FOUND in added lines.\nAK-2: Focus ring — FOUND in button.styles.scss line 38.\nAK-3: Disabled state — FOUND in button.ts line 95.',
  rawResponse: { findings: akFindings },
});
```

Add similar mock thoughts for each code-quality `agent:done`.

- [ ] **Step 4: Add `thinkingBudget` and `thoughts` to `consolidator:start` and `consolidator:done`**

All `consolidator:start` emits:
```js
emit('consolidator:start', { temperature: 0.2, thinkingBudget: 2048 });
```

All `consolidator:done` emits get `thoughts`:
```js
emit('consolidator:done', {
  duration: 800,
  thoughts: 'Checking grounding for 3 findings...\nFinding 1: codeSnippet "background-color: var(--btn-primary-bg)" — FOUND in diff.\nFinding 2: codeSnippet "const variant = value as ButtonVariant" — FOUND in diff.\nFinding 3: codeSnippet "const classes = this.computeClasses()" — FOUND in diff, but finding is too trivial. REMOVE.',
  result: { ... },
  ...
});
```

- [ ] **Step 5: Commit**

```bash
git add proxy/cosi-mock.js
git commit -m "feat(cosi): update mock data with codeSnippet, thoughts, and thinkingBudget"
```

### Task 9: Build verification

- [ ] **Step 1: Run the Angular build**

```bash
ng build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 2: Run tests**

```bash
ng test --no-watch
```

Expected: All existing tests pass (no tests are expected to break since we only added optional fields and new UI elements).

- [ ] **Step 3: Verify mock mode works**

Start the dev server and proxy, trigger a mock review, verify:
1. Code snippets appear in finding cards (dark code block)
2. Thinking budget shows next to temperature in pipeline (`TB=4096`)
3. "Denkprozess anzeigen" toggle works for agents and consolidator
4. Everything still works when `codeSnippet` or `thoughts` are absent
