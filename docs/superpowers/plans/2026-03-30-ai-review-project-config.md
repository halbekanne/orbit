# AI Review Project Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI review feature configurable per project — agents can be toggled on/off and project-specific rules are injected into all agent prompts.

**Architecture:** Extend `features.aiReviews` in Settings model with `enabledAgents: string[]` and `projectRules: string`. Convert `SHARED_CONSTRAINTS` from a static string to a `buildSharedConstraints(projectRules)` function. Each agent exports `buildSystemPrompt(projectRules)` instead of `systemPrompt`. The orchestrator filters by `enabledAgents` before `isApplicable()`, and the route reads both new fields from settings.

**Tech Stack:** Angular 19 (signals, standalone components), Express BFF, Node.js `node:test`

**Spec:** `docs/superpowers/specs/2026-03-30-ai-review-project-config-design.md`

---

### Task 1: Extend Settings Model

**Files:**
- Modify: `src/app/settings/settings.model.ts`

- [ ] **Step 1: Add new fields to `OrbitSettings` interface**

In `src/app/settings/settings.model.ts`, change the `aiReviews` block:

```typescript
aiReviews: {
  enabled: boolean;
  enabledAgents: string[];
  projectRules: string;
};
```

- [ ] **Step 2: Update `createDefaultSettings()`**

Change the `aiReviews` default:

```typescript
aiReviews: { enabled: false, enabledAgents: ['code-quality', 'ak-abgleich'], projectRules: '' },
```

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/settings.model.ts
git commit -m "feat(settings): add enabledAgents and projectRules to aiReviews config"
```

---

### Task 2: Convert `SHARED_CONSTRAINTS` to `buildSharedConstraints()`

**Files:**
- Modify: `server/agents/agent-definition.js`

- [ ] **Step 1: Replace `SHARED_CONSTRAINTS` constant with `buildSharedConstraints` function**

Replace the entire `SHARED_CONSTRAINTS` const and the `module.exports` in `server/agents/agent-definition.js`:

```javascript
function buildSharedConstraints(projectRules) {
  let constraints = `You are reviewing a pull request.

Every line in the diff starts with [line_number]. Use this number directly as the "line" value.

RULES:
- Report only problems. Every finding must describe a concrete deficiency.
- No praise, no "looks good", no "well done", no "LGTM".
- Report a finding ONLY if you can point to a specific added line in the diff. Without an exact codeSnippet, the finding does not exist.
- CRITICAL: Only review ADDED lines (lines starting with '+' in the diff). Lines starting with '-' are removed code — do not review them. Context lines (no prefix) are for understanding only — do not create findings for them.
- An empty findings array is a valid result, not an error. Do not manufacture issues to fill the output — but when in doubt, report one finding too many rather than miss one.
- All textual fields (title, detail, suggestion) must be in informal German. English technical terms (e.g. "null check", "race condition", "lifecycle hook") may be used inline.
- All textual fields (title, detail, suggestion) must be concise. The goal for these findings is to be easily understandable while being worded as shortly as possible, so developers can quickly visually scan a lot of findings in one go.
- You will also receive project context and rules that will give you more context and help you with assessing code deviations from the "norm" (e.g. a deviation from best practices might be deliberate).

THINKING PHASE INSTRUCTIONS:
You have a dedicated thinking phase before generating the JSON. You MUST use this phase to perform a step-by-step analysis. Do NOT use the thinking phase to draft JSON syntax. Use it to reason about the code, cross-reference requirements, and verify your claims. Only after completing your analysis should you write the JSON output.`;

  if (projectRules?.trim()) {
    constraints += `\n\nPROJECT CONTEXT AND RULES (provided by user):\n${projectRules}`;
  }

  return constraints;
}

module.exports = { buildSharedConstraints };
```

Key changes vs. the old `SHARED_CONSTRAINTS`:
- Removed: `"for a Design System built with TypeScript, Lit (Web Components), and SCSS"` → now just `"a pull request"`
- Removed: entire `PROJECT CONTEXT AND RULES` block (Slot-Konvention)
- Added: conditional `projectRules` injection

- [ ] **Step 2: Update `AgentDefinition` typedef**

In the same file, update the typedef — replace `systemPrompt` with `buildSystemPrompt`:

```javascript
/**
 * @typedef {Object} AgentDefinition
 * @property {string} id
 * @property {string} label
 * @property {(projectRules?: string) => string} buildSystemPrompt
 * @property {Object} responseSchema
 * @property {number} temperature
 * @property {number} thinkingBudget
 * @property {(diff: string, jiraTicket?: JiraTicketInput) => string} buildUserPrompt
 * @property {(jiraTicket?: JiraTicketInput) => boolean} [isApplicable]
 * @property {string} [skipMessage]
 */
```

- [ ] **Step 3: Commit**

```bash
git add server/agents/agent-definition.js
git commit -m "refactor(agents): convert SHARED_CONSTRAINTS to buildSharedConstraints function"
```

---

### Task 3: Update Agent Definitions to use `buildSystemPrompt`

**Files:**
- Modify: `server/agents/code-quality.js`
- Modify: `server/agents/ak-abgleich.js`
- Modify: `server/agents/accessibility.js`

- [ ] **Step 1: Update code-quality agent**

In `server/agents/code-quality.js`:
- Change import from `SHARED_CONSTRAINTS` to `buildSharedConstraints`
- Replace the `const SYSTEM_PROMPT = ...` with a `buildSystemPrompt(projectRules)` function
- Replace `systemPrompt: SYSTEM_PROMPT` property with `buildSystemPrompt`

```javascript
const { buildSharedConstraints } = require('./agent-definition');

function buildSystemPrompt(projectRules) {
  return `${buildSharedConstraints(projectRules)}

TASK: You are the code quality reviewer. Review the PR diff for code quality issues.

YOUR THINKING PROCESS (use your internal reasoning for these steps before generating JSON):
1. SCAN: Go through the added lines ('+' lines) across all files. Focus on logic, not listing files. For each block of added code that catches your attention, check:
   - What filetype is this? What technology is being used? What are known best practices for this kind of filetype or technology and are they being followed? For example, when you see a "something.ts" file where a Lit/Webcomponent is being defined, you immediately think about known best practices as well as anti-patterns for this technology (e.g. missing cleanup, inefficient rendering, lifecycle errors).
   - Could this cause problems at runtime? (race conditions, broken control flow, unhandled edge cases)
   - Would a new team member understand this in under 10 seconds? (unclear naming of variables/methods, long/complicated files or methods that could be split up, ...)
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
Ignore issues that a static analysis (e.g. by the IDE, TypeScript strict mode, common linters for this technology like ESLint, ...) would already catch (type errors, null access on strict types, unused variables, import order, formatting). There is an exception for Jenkinsfiles/Groovy Code, for them, please also report ANY issues, even as small as typos. Otherwise, focus on problems that only a human reviewer would find:

1. Logic errors that compile but behave incorrectly — race conditions, off-by-one, wrong conditions, unhandled edge cases
2. Readability and maintainability — convoluted logic, deep nesting, unclear intent, functions doing too much
3. Best practices for filetype / technology used — e.g. for Lit/Webcomponents/TS this would include lifecycle errors, missing cleanup logic (event listeners, subscriptions), inefficient rendering, incorrect reactive property usage
4. Clean code structure — single responsibility, sensible naming, DRY (no premature abstraction)

SCOPE: Do NOT check Akzeptanzkriterien, design tokens, or accessibility. Focus only on code quality.

Do NOT suggest features, abstractions, or patterns not needed for the current change (YAGNI).`;
}
```

And in the exported object, replace `systemPrompt: SYSTEM_PROMPT` with `buildSystemPrompt,`:

```javascript
const codeQualityAgent = {
  id: 'code-quality',
  label: 'Code-Qualität',
  buildSystemPrompt,
  responseSchema: RESPONSE_SCHEMA,
  // ... rest unchanged
};
```

- [ ] **Step 2: Update ak-abgleich agent**

In `server/agents/ak-abgleich.js`:
- Change import from `SHARED_CONSTRAINTS` to `buildSharedConstraints`
- Replace `const SYSTEM_PROMPT = ...` with a `buildSystemPrompt(projectRules)` function (same pattern)
- Replace `systemPrompt: SYSTEM_PROMPT` with `buildSystemPrompt,`

```javascript
const { buildSharedConstraints } = require('./agent-definition');

function buildSystemPrompt(projectRules) {
  return `${buildSharedConstraints(projectRules)}

TASK: You are the Akzeptanzkriterien (AK) reviewer. Compare the PR diff against the Jira ticket's Akzeptanzkriterien.
...rest of the existing SYSTEM_PROMPT content unchanged...`;
}
```

The ak-abgleich prompt content is already generic — no project-specific text to remove.

- [ ] **Step 3: Update accessibility agent**

In `server/agents/accessibility.js`:
- Change import from `SHARED_CONSTRAINTS` to `buildSharedConstraints`
- Replace `const SYSTEM_PROMPT = ...` with a `buildSystemPrompt(projectRules)` function
- Replace `systemPrompt: SYSTEM_PROMPT` with `buildSystemPrompt,`
- Remove: `"You are specialized for component-based Design Systems built with Lit (Web Components) and SCSS."` from the TASK line
- Rename focus area 8 from `"Lit/Shadow-DOM-spezifisch"` to `"Web-Component-/Shadow-DOM-spezifisch"`

Updated TASK line:

```
TASK: You are the accessibility reviewer. Review the PR diff for WCAG AA violations detectable without rendering.
```

Updated focus area 8 heading:

```
8. Web-Component-/Shadow-DOM-spezifisch
```

- [ ] **Step 4: Commit**

```bash
git add server/agents/code-quality.js server/agents/ak-abgleich.js server/agents/accessibility.js
git commit -m "refactor(agents): switch all agents to buildSystemPrompt(projectRules)"
```

---

### Task 4: Update Orchestrator and Route

**Files:**
- Modify: `server/ai.js`
- Modify: `server/routes/ai-routes.js`

- [ ] **Step 1: Update `ai.js` — consolidator system prompt**

In `server/ai.js`:
- Change import from `SHARED_CONSTRAINTS` to `buildSharedConstraints`
- Change `SYSTEM_PROMPTS.consolidator` from a static string to a function

Replace:

```javascript
const { SHARED_CONSTRAINTS } = require('./agents/agent-definition');
```

With:

```javascript
const { buildSharedConstraints } = require('./agents/agent-definition');
```

Replace the `SYSTEM_PROMPTS` object with a function:

```javascript
function buildConsolidatorSystemPrompt(projectRules) {
  return `${buildSharedConstraints(projectRules)}

TASK: You receive findings from multiple specialist review agents. Produce the final review report.
...rest of consolidator prompt unchanged...`;
}
```

- [ ] **Step 2: Update `runReview` signature and agent filtering**

Change the `runReview` function signature:

```javascript
async function runReview(diff, jiraTicket, emit, { vertexAi, enabledAgents, projectRules } = {}) {
```

Replace the agent filtering logic:

```javascript
const enabledFromSettings = AGENT_REGISTRY.filter(a => enabledAgents.includes(a.id));
const applicableAgents = enabledFromSettings.filter(
  a => !a.isApplicable || a.isApplicable(jiraTicket)
);

const skipped = enabledFromSettings.filter(a => a.isApplicable && !a.isApplicable(jiraTicket));
```

- [ ] **Step 3: Pass `projectRules` to agents and consolidator**

In the `callAi` call for each agent, change:

```javascript
agent.systemPrompt,
```

To:

```javascript
agent.buildSystemPrompt(projectRules),
```

In the consolidator `callAi` call, change:

```javascript
SYSTEM_PROMPTS.consolidator,
```

To:

```javascript
buildConsolidatorSystemPrompt(projectRules),
```

- [ ] **Step 4: Update `ai-routes.js`**

In `server/routes/ai-routes.js`, read the new settings and pass them through. Change:

```javascript
const vertexAi = s?.connections?.vertexAi;
if (vertexAi?.url) {
  await runReview(diff, jiraTicket || null, emit, { vertexAi });
```

To:

```javascript
const vertexAi = s?.connections?.vertexAi;
const enabledAgents = s?.features?.aiReviews?.enabledAgents ?? ['code-quality', 'ak-abgleich'];
const projectRules = s?.features?.aiReviews?.projectRules ?? '';
if (vertexAi?.url) {
  await runReview(diff, jiraTicket || null, emit, { vertexAi, enabledAgents, projectRules });
```

- [ ] **Step 5: Commit**

```bash
git add server/ai.js server/routes/ai-routes.js
git commit -m "feat(ai): filter agents by enabledAgents and inject projectRules into prompts"
```

---

### Task 5: Update Tests

**Files:**
- Modify: `server/ai.test.js`

- [ ] **Step 1: Update existing tests to pass `enabledAgents` and `projectRules`**

All `runReview` calls in tests need the new parameters. Update each call:

Test "emits agent:start, agent:done for all agents and consolidator events":

```javascript
await runReview('diff content', { key: 'DS-1', summary: 'Test', description: 'AK: something' }, emit, {
  vertexAi: TEST_VERTEX_AI,
  enabledAgents: ['ak-abgleich', 'code-quality', 'accessibility'],
  projectRules: '',
});
```

Test "emits warning and skips agent 1 when no jira ticket":

```javascript
await runReview('diff content', null, emit, {
  vertexAi: TEST_VERTEX_AI,
  enabledAgents: ['ak-abgleich', 'code-quality', 'accessibility'],
  projectRules: '',
});
```

Test "emits agent:error when an agent fails":

```javascript
await runReview('diff content', { key: 'DS-1', summary: 'Test', description: 'desc' }, emit, {
  vertexAi: TEST_VERTEX_AI,
  enabledAgents: ['ak-abgleich', 'code-quality', 'accessibility'],
  projectRules: '',
});
```

Test "emits done with empty result when no findings and skips consolidator":

```javascript
await runReview('diff content', { key: 'DS-1', summary: 'Test', description: 'AK: something' }, emit, {
  vertexAi: TEST_VERTEX_AI,
  enabledAgents: ['ak-abgleich', 'code-quality', 'accessibility'],
  projectRules: '',
});
```

- [ ] **Step 2: Add test for enabledAgents filtering**

Add a new test in the `runReview` describe block:

```javascript
it('only runs agents listed in enabledAgents', async () => {
  const codeQualityResult = { findings: [] };

  let callCount = 0;
  mock.method(global, 'fetch', () => {
    callCount++;
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: JSON.stringify(codeQualityResult) }] } }],
      }),
    });
  });

  const { runReview } = freshRequire();
  const events = [];
  const emit = (type, data) => events.push({ type, data });

  await runReview('diff content', { key: 'DS-1', summary: 'Test', description: 'AK: something' }, emit, {
    vertexAi: TEST_VERTEX_AI,
    enabledAgents: ['code-quality'],
    projectRules: '',
  });

  const agentStarts = events.filter(e => e.type === 'agent:start');
  assert.equal(agentStarts.length, 1);
  assert.equal(agentStarts[0].data.agent, 'code-quality');

  assert.ok(!events.some(e => e.type === 'warning'));

  assert.equal(callCount, 1);
});
```

- [ ] **Step 3: Add test for projectRules injection**

Add a test in the `callAi` describe block that verifies projectRules end up in the system prompt:

```javascript
it('passes projectRules through buildSystemPrompt to system instruction', async () => {
  const mockResponse = {
    candidates: [{ content: { parts: [{ text: '{"findings": []}' }] } }],
  };

  const fetchMock = mock.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(mockResponse),
  }));
  mock.method(global, 'fetch', fetchMock);

  const { runReview } = freshRequire();
  const events = [];
  const emit = (type, data) => events.push({ type, data });

  await runReview('diff content', null, emit, {
    vertexAi: TEST_VERTEX_AI,
    enabledAgents: ['code-quality'],
    projectRules: 'Java 21 mit Spring Boot 3',
  });

  assert.equal(fetchMock.mock.calls.length, 1);
  const body = JSON.parse(fetchMock.mock.calls[0].arguments[1].body);
  assert.ok(body.systemInstruction.parts[0].text.includes('Java 21 mit Spring Boot 3'));
});
```

- [ ] **Step 4: Run tests**

Run: `node --test server/ai.test.js`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add server/ai.test.js
git commit -m "test(ai): update tests for enabledAgents filtering and projectRules injection"
```

---

### Task 6: Settings UI — Agent Toggles and Project Rules Textarea

**Files:**
- Modify: `src/app/settings/view-settings/view-settings.ts`
- Modify: `src/app/settings/view-settings/view-settings.html`

- [ ] **Step 1: Add agent descriptions to the component**

In `src/app/settings/view-settings/view-settings.ts`, add a readonly field after the `sections` array:

```typescript
readonly agentDescriptions: Record<string, { label: string; description: string }> = {
  'code-quality': {
    label: 'Code-Qualität',
    description: 'Prüft auf Bugs, Logikfehler, Lesbarkeit und Wartbarkeit. Empfohlen für alle Projekte.',
  },
  'ak-abgleich': {
    label: 'AK-Abgleich',
    description: 'Vergleicht den Code mit den Akzeptanzkriterien aus dem verknüpften Jira-Ticket. Empfohlen wenn Jira genutzt wird.',
  },
  'accessibility': {
    label: 'Barrierefreiheit',
    description: 'Prüft WCAG AA Konformität für HTML und UI-Komponenten. Empfohlen für Frontend-Projekte.',
  },
};
```

Add a helper method:

```typescript
toggleAgent(agentId: string, enabled: boolean): void {
  this.updateDraft(d => {
    const agents = d.features.aiReviews.enabledAgents;
    if (enabled && !agents.includes(agentId)) {
      agents.push(agentId);
    } else if (!enabled) {
      const idx = agents.indexOf(agentId);
      if (idx !== -1) agents.splice(idx, 1);
    }
  });
}
```

- [ ] **Step 2: Update the HTML — expand the AI reviews card**

In `src/app/settings/view-settings/view-settings.html`, replace the entire `<!-- KI-gestützte Reviews -->` card (from `<div data-section="ai-reviews"` to its closing `</div>`) with:

```html
<div data-section="ai-reviews" id="section-ai-reviews"
  class="bg-[var(--color-bg-card)] rounded-xl p-5 mb-4 transition-opacity"
  [class.opacity-50]="!draft().features.aiReviews.enabled">
  <div class="flex items-center justify-between">
    <h4 class="font-bold text-[var(--color-text-heading)]">KI-gestützte Reviews</h4>
    <label class="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" class="sr-only peer"
        [checked]="draft().features.aiReviews.enabled"
        (change)="updateDraft(d => d.features.aiReviews.enabled = $any($event.target).checked)">
      <div class="w-9 h-5 bg-[var(--color-bg-surface)] rounded-full peer peer-checked:bg-violet-500
        after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-[var(--color-bg-card)]
        after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4">
      </div>
    </label>
  </div>

  @if (needsVertexWarning()) {
    <p class="mt-3 text-xs text-[var(--color-signal-text)] bg-[var(--color-signal-bg)] border border-[var(--color-signal-border)] rounded-lg px-3 py-2">
      Benötigt Vertex AI Proxy-Konfiguration
    </p>
  }

  <div [class.pointer-events-none]="!draft().features.aiReviews.enabled" class="mt-4">
    <label class="block text-sm text-[var(--color-text-body)] mb-3">Review-Agenten</label>

    @for (entry of agentDescriptions | keyvalue; track entry.key) {
      <label class="flex items-start gap-3 cursor-pointer mb-3">
        <input type="checkbox" class="mt-0.5 accent-violet-500"
          [checked]="draft().features.aiReviews.enabledAgents.includes(entry.key)"
          (change)="toggleAgent(entry.key, $any($event.target).checked)">
        <div>
          <span class="text-sm font-medium text-[var(--color-text-heading)]">{{ entry.value.label }}</span>
          <p class="text-xs text-[var(--color-text-muted)] mt-0.5">{{ entry.value.description }}</p>
        </div>
      </label>
    }

    <div class="mt-4">
      <label class="block text-sm text-[var(--color-text-body)] mb-1">Projektregeln</label>
      <p class="text-xs text-[var(--color-text-muted)] mb-2">Diese Anweisungen werden allen aktiven Review-Agenten mitgegeben. Beschreibe hier euren Tech-Stack, Coding-Konventionen und worauf beim Review besonders geachtet werden soll.</p>
      <textarea
        class="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-heading)] text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 resize-none"
        style="height: 120px"
        placeholder="z.B. Java 21 mit Spring Boot 3. Wir nutzen Hexagonale Architektur mit Ports & Adapters. REST-APIs folgen unseren OpenAPI-Specs. Tests mit JUnit 5 und Mockito."
        [value]="draft().features.aiReviews.projectRules"
        (input)="updateDraft(d => d.features.aiReviews.projectRules = $any($event.target).value)">
      </textarea>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add `KeyValuePipe` import**

In `src/app/settings/view-settings/view-settings.ts`, add `KeyValuePipe` to the imports:

```typescript
import { KeyValuePipe } from '@angular/common';
```

And add it to the component's `imports` array:

```typescript
imports: [FormsModule, KeyValuePipe],
```

- [ ] **Step 4: Run the app and verify visually**

Run: `npm start`

1. Open settings, check the "KI-gestützte Reviews" section
2. Verify: Three agent checkboxes visible with descriptions
3. Verify: Code-Qualität and AK-Abgleich checked by default, Barrierefreiheit unchecked
4. Verify: Textarea with label, description text, and placeholder visible
5. Verify: All controls disabled when main toggle is off
6. Verify: Save/discard works with the new fields

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/view-settings/view-settings.ts src/app/settings/view-settings/view-settings.html
git commit -m "feat(settings): add agent toggles and project rules textarea to AI review settings"
```

---

### Task 7: Settings Service — Deep Merge for Nested `aiReviews`

**Files:**
- Modify: `src/app/settings/settings.service.ts`

The current `load()` does a shallow spread: `settings.features = { ...defaults.features, ...settings.features }`. This preserves the top-level `aiReviews` object from stored settings but does NOT merge missing fields within it. If a user has existing settings saved without `enabledAgents`/`projectRules`, those fields will be `undefined`.

- [ ] **Step 1: Add deep merge for `aiReviews` in `load()` and `save()`**

In `settings.service.ts`, after the existing `settings.features = { ...defaults.features, ...settings.features }` line in `load()`, add:

```typescript
settings.features.aiReviews = { ...defaults.features.aiReviews, ...settings.features.aiReviews };
```

Do the same in `save()` after the corresponding line:

```typescript
result.features.aiReviews = { ...defaults.features.aiReviews, ...result.features.aiReviews };
```

- [ ] **Step 2: Commit**

```bash
git add src/app/settings/settings.service.ts
git commit -m "fix(settings): deep merge aiReviews defaults for backwards compatibility"
```

---

### Task 8: Run Full Test Suite and Verify

- [ ] **Step 1: Run backend tests**

Run: `node --test server/ai.test.js`
Expected: All tests pass (including the new enabledAgents and projectRules tests)

- [ ] **Step 2: Run frontend build**

Run: `npx ng build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Final commit if any fixes needed**

Only if previous steps required fixes.
