# CoSi Accessibility Review Agent & Agent Registry

## Context

The CoSi review pipeline currently uses two hardcoded specialist agents (AK-Abgleich, Code Quality) and a Consolidator. The agents, their prompts, schemas, and orchestration logic are tightly coupled in `proxy/cosi.js`. Adding a new agent requires editing multiple locations and updating the Consolidator prompt to reference the new agent by name.

This spec introduces:
1. A declarative **Agent Registry** that makes the pipeline extensible
2. An **Accessibility agent** as the first new specialist, focused on WCAG AA issues detectable in PR diffs
3. A **generalized Consolidator** that works with any number of agents

### Constraints

- **Model:** Gemini 2.5 Flash only, via CoSi proxy API
- **Rate limit:** 20 calls/min — three agents + consolidator = 4 calls per review
- **Diff-only:** The agent sees only the PR diff, not full source files
- **Design System context:** PRs are for a Design System built with TypeScript, Lit (Web Components), and SCSS

## Goals

- Make adding new review agents a config change, not a code change
- Add an Accessibility agent that reliably finds WCAG AA issues visible in diffs
- Generalize the Consolidator to handle N agents without prompt changes
- Minimize false positives through two-phase prompt design (SCAN → VALIDATE) and few-shot calibration

## Non-Goals

- Full WCAG AA audit (would require rendered component, not just diff)
- Color contrast checking (requires rendering)
- Accessibility tree order analysis (requires full component context)
- Automated a11y testing (axe-core, Lighthouse) — complementary, not replaced
- Temperature, topP, topK tuning
- UI redesign of the findings component

## Files Changed

| File | Change Type |
|------|-------------|
| `proxy/agents/agent-definition.js` | New — JSDoc `@typedef` for `AgentDefinition` interface |
| `proxy/agents/ak-abgleich.js` | New — extracted from `cosi.js`, implements `AgentDefinition` |
| `proxy/agents/code-quality.js` | New — extracted from `cosi.js`, implements `AgentDefinition` |
| `proxy/agents/accessibility.js` | New — implements `AgentDefinition` |
| `proxy/agents/index.js` | New — imports all agents, exports registry array |
| `proxy/cosi.js` | Refactored to pure orchestrator — imports registry, iterates over agents |
| `proxy/cosi-mock.js` | New mock scenario with accessibility findings |
| `src/app/models/review.model.ts` | `category` type change, `wcagCriterion` field |
| `src/app/components/review-findings/review-findings.ts` | Accessibility badge color, WCAG criterion pill |

---

## Change 1: Agent Definition Interface & File-Per-Agent Architecture

### What

Each review agent is defined in its own file under `proxy/agents/`. All agent files implement a shared `AgentDefinition` interface defined via JSDoc `@typedef`. The orchestrator (`cosi.js`) imports the registry and operates purely on the interface — it has no knowledge of individual agents.

### Directory Structure

```
proxy/
  agents/
    agent-definition.js   ← @typedef AgentDefinition + shared constraints
    ak-abgleich.js        ← exports AgentDefinition
    code-quality.js       ← exports AgentDefinition
    accessibility.js      ← exports AgentDefinition
    index.js              ← imports all agents, exports AGENT_REGISTRY array
  cosi.js                 ← orchestrator, imports AGENT_REGISTRY
  cosi-mock.js
```

### AgentDefinition Interface

Defined in `proxy/agents/agent-definition.js` via JSDoc:

```js
/**
 * @typedef {Object} AgentDefinition
 * @property {string} id — Unique identifier, used as `category` in findings (e.g. 'accessibility')
 * @property {string} label — German display name for the UI (e.g. 'Barrierefreiheit')
 * @property {string} systemPrompt — Full system instruction for the CoSi call
 * @property {Object} responseSchema — Gemini responseSchema object for structured output
 * @property {number} temperature — Model temperature (0.0–1.0)
 * @property {number} thinkingBudget — Thinking budget in tokens
 * @property {(diff: string, jiraTicket?: JiraTicketInput) => string} buildUserPrompt
 *   — Builds the user prompt from the preprocessed diff and optional Jira ticket.
 *     Each agent decides how to structure its input context (XML tags, ordering, etc.)
 * @property {(jiraTicket?: JiraTicketInput) => boolean} [isApplicable]
 *   — Optional guard. Returns false to skip this agent for the current review.
 *     Defaults to always applicable if not provided.
 */

/**
 * @typedef {Object} JiraTicketInput
 * @property {string} key
 * @property {string} summary
 * @property {string} description
 */
```

This file also exports `SHARED_CONSTRAINTS` — the shared prompt preamble that all agents include in their system prompt (Design System context, line number instruction, rules for diff review, thinking phase instructions).

### Example Agent File

`proxy/agents/accessibility.js`:

```js
// @ts-check
const { SHARED_CONSTRAINTS } = require('./agent-definition');

const SYSTEM_PROMPT = `${SHARED_CONSTRAINTS}

You are an accessibility reviewer specialized in WCAG AA compliance for component-based Design Systems built with Lit (Web Components) and SCSS.
...
`;

const RESPONSE_SCHEMA = { /* ... */ };

/** @type {import('./agent-definition').AgentDefinition} */
module.exports = {
  id: 'accessibility',
  label: 'Barrierefreiheit',
  systemPrompt: SYSTEM_PROMPT,
  responseSchema: RESPONSE_SCHEMA,
  temperature: 0.3,
  thinkingBudget: 16384,
  buildUserPrompt(diff) {
    return `<pr_diff>\n${diff}\n</pr_diff>\n\nFollow your thinking process step by step: SCAN, VALIDATE, FORMULATE.`;
  },
};
```

No `isApplicable` needed — the accessibility agent always runs. Compare with AK-Abgleich which would have:

```js
isApplicable(jiraTicket) {
  return !!jiraTicket;
},
```

### Registry

`proxy/agents/index.js`:

```js
const akAbgleich = require('./ak-abgleich');
const codeQuality = require('./code-quality');
const accessibility = require('./accessibility');

/** @type {import('./agent-definition').AgentDefinition[]} */
const AGENT_REGISTRY = [akAbgleich, codeQuality, accessibility];

module.exports = { AGENT_REGISTRY };
```

### Orchestrator Changes

`cosi.js` imports `AGENT_REGISTRY` and iterates over it:

1. Filter agents: `AGENT_REGISTRY.filter(a => !a.isApplicable || a.isApplicable(jiraTicket))`
2. For each applicable agent, build the user prompt via `agent.buildUserPrompt(diff, jiraTicket)`
3. Build `generationConfig` from agent fields (`temperature`, `thinkingBudget`, `responseSchema`) plus the orchestrator constant `maxOutputTokens: 65536`, then call `callCoSi(userPrompt, agent.systemPrompt, generationConfig)` — the `callCoSi()` signature stays unchanged
4. Wrap each response: `{ id: agent.id, label: agent.label, findings: [...] }`
5. Send SSE events using agent fields: `emit('agent:start', { agent: agent.id, label: agent.label, temperature: agent.temperature, thinkingBudget: agent.thinkingBudget })` — no frontend changes needed since the event shape is unchanged
6. Collect all wrapped results into an `agents` array
7. Pass the array to the Consolidator

Error handling stays the same: if one agent fails, the pipeline continues with partial results and a warning is added.

### What stays in `cosi.js`

- `callCoSi()` — the raw API call helper
- `preprocessDiff()` — diff line number injection
- `runReview()` — orchestration loop + Consolidator call
- Consolidator prompt + schema (the Consolidator is not an agent in the registry — it has a fundamentally different role and input shape)
- SSE event emission

### What moves out of `cosi.js`

- All `SYSTEM_PROMPTS` entries → into their respective agent files
- All `*_FINDING_SCHEMA` objects → into their respective agent files
- All `buildAgent*Prompt()` functions → become `buildUserPrompt()` methods on each agent
- `SHARED_CONSTRAINTS` → into `agent-definition.js`

### Adding a Future Agent

1. Create a new file in `proxy/agents/` implementing `AgentDefinition`
2. Add it to the array in `proxy/agents/index.js`

No orchestrator code, no Consolidator prompt, and no frontend changes needed.

---

## Change 2: Accessibility Agent Prompt

### Role

The Accessibility agent reviews added lines in the PR diff for WCAG AA violations that are detectable without rendering the component. It is specialized for component-based Design Systems built with Lit/Web Components and SCSS.

### Process: SCAN → VALIDATE

**Phase 1 — SCAN:**
Walk through each added line in the diff. For each line, check against 8 focus areas and note potential issues as candidates.

**Phase 2 — VALIDATE:**
For each candidate:
- Can the issue be evidenced by a concrete code snippet from the diff?
- Is it an actual accessibility barrier, not a style preference?
- Could the surrounding component context already solve this? (If uncertain, report with lower severity.)

Only validated candidates become findings. If no accessibility issues are found, return an empty findings array.

### Thinking Process

Formatted consistently with the other agents' `YOUR THINKING PROCESS` blocks:

```
YOUR THINKING PROCESS (use the thinking phase for this):
1. SCAN — Walk through each added line (prefixed with '+'). For each line, check against the 8 focus areas below. Note potential issues as candidates with the relevant focus area and line reference.
2. VALIDATE — For each candidate:
   a. Find the exact codeSnippet (1-2 lines) from the diff that evidences the issue.
   b. Determine: is this a real accessibility barrier, or a style preference? Discard preferences.
   c. Consider: could the surrounding component context already solve this? If uncertain, keep but lower severity.
   d. Assign severity (critical / important / minor) per the calibration below.
3. FORMULATE — For each validated candidate, write the finding fields: title, detail, suggestion (all German), wcagCriterion, file, line, codeSnippet.
```

### Focus Areas

The agent checks these 8 areas, ordered by impact:

**1. Rollen & Semantik (WCAG 1.3.1, 4.1.2)**
Interaktive Elemente müssen semantisch korrekt ausgezeichnet sein. `<div>` oder `<span>` statt `<button>`, `<nav>`, `<dialog>` ist ein Befund. Navigations-Links müssen als `<ul>/<li>` innerhalb von `<nav>` strukturiert sein, nicht als lose `<a>`-Ketten.

**2. ARIA-Attribute & ID-Referenzen (WCAG 4.1.2)**
Fehlende oder falsch verwendete ARIA-Attribute. Besonderes Augenmerk auf alle ID-referenzierenden Attribute (`aria-labelledby`, `aria-controls`, `aria-describedby`, `aria-owns`) — diese funktionieren nicht über Shadow-DOM-Grenzen hinweg.

**3. Qualität zugänglicher Namen (WCAG 2.5.3, 4.1.2)**
Ein `aria-label` oder `alt`-Text muss aussagekräftig und verständlich sein, nicht nur vorhanden. `aria-label="button"`, `aria-label="click here"` oder `alt="image"` sind Befunde.

**4. Tastaturinteraktion (WCAG 2.1.1, 2.1.2)**
Click-Handler ohne `keydown`/`keyup`-Pendant. Fehlende oder falsche `tabindex`-Steuerung. Modals/Dialoge ohne Focus-Trap. Custom-Widgets ohne erwartete Tastaturmuster (Arrow-Keys für Tabs, Escape zum Schließen).

**5. Textalternativen (WCAG 1.1.1)**
`<img>` ohne `alt`-Attribut. Icon-Buttons ohne zugänglichen Namen. Dekorative Bilder ohne `aria-hidden="true"` oder leeres `alt=""`.

**6. Formular-Zugänglichkeit (WCAG 1.3.1, 3.3.2)**
Inputs ohne programmatisch verknüpftes `<label>`. Zusammengehörige Inputs ohne `<fieldset>`/`<legend>`. Fehlermeldungen ohne Live-Region (`aria-live` oder `role="alert"`).

**7. Touch-Target-Größe (WCAG 2.5.8)**
Interaktive Elemente müssen mindestens 24×24px groß sein (außer innerhalb von Fließtext). Im Diff erkennbar über explizite CSS-Größen, Padding-Werte, `min-width`/`min-height` in SCSS-Dateien.

**8. Lit/Shadow-DOM-spezifisch**
ID-Referenzen über Shadow-Grenzen hinweg (funktionieren nicht). Fehlendes `delegatesFocus` bei Custom-Elements mit interaktiven Inhalten. `<slot>`-Elemente ohne sinnvollen Fallback-Content für Screenreader.

### Abgrenzung — was der Agent NICHT prüft

- Farbkontraste (erfordert Rendering)
- Reihenfolge im Accessibility Tree (erfordert Gesamtkomponente)
- Issues die ESLint/lit-a11y bereits erkennen
- Kein Lob, keine "sieht gut aus"-Kommentare

### Anti-Pattern-Katalog (Few-Shot-Beispiele)

Diese Beispiele kalibrieren die Qualität der Findings. Sie sind nicht erschöpfend — der Agent soll auch Probleme finden, die nicht im Katalog stehen.

**Rollen & Semantik:**
```html
<!-- Problem -->
<div class="nav-links">
  <a href="/home">Home</a>
  <a href="/settings">Settings</a>
</div>

<!-- Besser -->
<nav aria-label="Hauptnavigation">
  <ul><li><a href="/home">Home</a></li>...</ul>
</nav>
```

**Tastaturinteraktion:**
```html
<!-- Problem -->
<div class="chip" @click=${this.remove}>✕</div>

<!-- Besser -->
<button class="chip" @click=${this.remove} aria-label="Filter entfernen">✕</button>
```
Kein Keyboard-Pendant, kein zugänglicher Name, kein semantisches Element.

**ARIA & Shadow DOM:**
```html
<!-- Problem: ID-Referenz über Shadow-Grenze -->
<label for="input-1">Name</label>
<my-input id="input-1"></my-input>

<!-- Besser: aria-label direkt am Element -->
<my-input aria-label="Name"></my-input>
```

**Qualität zugänglicher Namen:**
```html
<!-- Problem -->
<button aria-label="button">
<button aria-label="click here">
<img alt="image">

<!-- Besser -->
<button aria-label="Dialog schließen">
<button aria-label="Änderungen speichern">
<img alt="Organigramm der Abteilung XY">
```

**Touch-Target-Größe:**
```html
<!-- Problem -->
<button class="close-btn" @click=${this.close}>
  <svg>...</svg>
</button>
```
```scss
.close-btn { padding: 2px; }
```

```html
<!-- Besser -->
<button class="close-btn" @click=${this.close}>
  <svg>...</svg>
</button>
```
```scss
.close-btn { padding: 2px; min-width: 24px; min-height: 24px; }
```

**Formular ohne Label:**
```html
<!-- Problem -->
<input type="text" placeholder="Suche...">

<!-- Besser -->
<label>
  <span class="visually-hidden">Suchbegriff</span>
  <input type="text" placeholder="Suche...">
</label>
```

### Severity-Kalibrierung

- **critical:** Komponente ist für Screenreader- oder Tastatur-Nutzer nicht bedienbar — fehlende Rolle, kein Keyboard-Zugang, kein zugänglicher Name
- **important:** Barrierefreiheit eingeschränkt aber nicht vollständig blockierend — unklarer Label-Text, fehlende `aria-expanded`-Zustandsanzeige, ID-Referenz über Shadow-DOM-Grenze
- **minor:** Verbesserungspotenzial ohne direkte Barriere — fehlender `<fieldset>` bei klar strukturiertem Formular, Touch-Target knapp unter 24px

### Temperature

0.3 — etwas weniger explorativ als Code-Qualität (0.4), da die Prüfkriterien konkreter und regelbasierter sind, aber nicht so deterministisch wie AK-Abgleich (0.2), da der Agent Kontext interpretieren muss.

---

## Change 3: Accessibility Response Schema

```js
const ACCESSIBILITY_FINDING_SCHEMA = {
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
            description: "critical = component not usable for assistive tech users, important = accessibility degraded but not blocking, minor = improvement opportunity without direct barrier"
          },
          title: { type: "STRING", description: "Short German summary of the issue" },
          file: { type: "STRING", description: "File path from the diff" },
          line: { type: "INTEGER", description: "Line number from the diff (the number in square brackets)" },
          codeSnippet: { type: "STRING", description: "The exact 1-2 lines from the diff that this finding targets, copied verbatim" },
          detail: { type: "STRING", description: "What the problem is and why it matters for accessibility (1-3 sentences, in German)" },
          suggestion: { type: "STRING", description: "Concrete improvement suggestion (in German, English technical terms allowed inline)" },
          wcagCriterion: { type: "STRING", description: "The relevant WCAG criterion, e.g. '4.1.2 Name, Rolle, Wert' or '2.1.1 Tastatur'" }
        },
        required: ["severity", "title", "file", "line", "codeSnippet", "detail", "suggestion", "wcagCriterion"],
        propertyOrdering: ["severity", "title", "file", "line", "codeSnippet", "detail", "suggestion", "wcagCriterion"]
      }
    }
  },
  required: ["findings"],
  propertyOrdering: ["findings"]
};
```

The `wcagCriterion` field is new compared to the other agents. It gives developers a direct reference for lookup and makes findings verifiable.

---

## Change 4: Consolidator Generalization

### Input Format

The Consolidator receives a dynamic array of agent results instead of hardcoded references:

```xml
<agent_findings>
[
  { "id": "ak-abgleich", "label": "AK-Abgleich", "findings": [...] },
  { "id": "code-quality", "label": "Code-Qualität", "findings": [...] },
  { "id": "accessibility", "label": "Barrierefreiheit", "findings": [...] }
]
</agent_findings>

<pr_diff>
{diff}
</pr_diff>
```

### Prompt Builder Refactor

The current `buildConsolidatorPrompt(agent1Findings, agent2Findings)` takes two separate arguments and renders them as `<agent_1_findings>` and `<agent_2_findings>`. This changes to `buildConsolidatorPrompt(agentResults)` taking a single array. The prompt renders all results inside a single `<agent_findings>` tag as shown in the Input Format above. This function stays in `cosi.js` (not in an agent file) since the Consolidator is not an `AgentDefinition` — it has a fundamentally different input shape and role.

Prompt text changes:
- Replace all hardcoded references to `ak-abgleich` and `code-quality` with generic language ("die Fach-Agenten", "der jeweilige Agent")
- The `category` field in output findings is set to the `id` of the originating agent
- The `agent` field in decisions is set to the `id` of the originating agent
- Agent-specific fields (`wcagCriterion`) are passed through without modification

The `describeConsolidation` helper (currently takes two agent results) also changes to accept an array.

### Consolidator Schema Update

The Consolidator output schema must include `wcagCriterion` as an optional field. Without it, Gemini's `responseSchema` enforcement would strip the field from findings that pass through. Since not all agents produce this field, it is not in the `required` array.

```js
// Full updated finding properties in Consolidator schema:
{
  severity: {
    type: "STRING",
    enum: ["critical", "important", "minor"],
    description: "critical = real runtime risk, important = structural problem, minor = small improvement"
  },
  category: {
    type: "STRING",
    description: "The id of the agent that produced the finding"
  },
  title: { type: "STRING", description: "Short German summary" },
  file: { type: "STRING", description: "File path from the diff" },
  line: { type: "INTEGER", description: "Line number from the diff" },
  codeSnippet: { type: "STRING", description: "Exact lines from the diff, copied verbatim" },
  detail: { type: "STRING", description: "Problem description in German (1-3 sentences)" },
  suggestion: { type: "STRING", description: "Improvement suggestion in German" },
  wcagCriterion: { type: "STRING", description: "WCAG criterion reference, e.g. '4.1.2 Name, Rolle, Wert'. Only present for accessibility findings." }
},
required: ["severity", "category", "title", "file", "line", "codeSnippet", "detail", "suggestion"],
// wcagCriterion intentionally NOT required — only accessibility agent provides it
```

```js
// decisions.agent changes from enum to string
agent: {
  type: "STRING",
  description: "The id of the agent that produced the original finding"
},
```

### Deduplizierung across agents

The Consolidator must handle cross-agent overlap. Example: Code Quality flags a `<div @click>` as a Lit anti-pattern, Accessibility flags the same element for missing role and keyboard handler. The Consolidator should merge these into a single finding using the more specific formulation (in this case, the Accessibility finding with its `wcagCriterion`).

### What stays the same

- OVERLAP → GROUNDING → QUALITY GATE → SEVERITY CHECK process
- Decisions array with `kept | removed | merged | severity-changed`
- Noise examples (formatting, lint issues, type errors)
- All text in German

---

## Change 5: Frontend Adjustments

### Model Changes

In `review.model.ts`:

```typescript
// ReviewFinding: category becomes a string to support dynamic agents
category: string;

// ReviewFinding: new optional field for accessibility findings
wcagCriterion?: string;
```

`ConsolidatorDecision` already uses `string` for its fields — no changes needed there.

### Review-Findings Component

- New category badge for `accessibility`: Teal color scheme (`bg-teal-50 text-teal-700 border-teal-200`), label "Barrierefreiheit"
- Badge color mapping becomes a lookup object instead of if/else, to support future categories. Unknown category IDs fall back to stone/neutral styling (`bg-stone-100 text-stone-600 border-stone-200`) and use the raw category ID as label.
- When `wcagCriterion` is present on a finding, render it as a small pill badge next to the severity badge: `bg-stone-100 text-stone-500 border-stone-200 font-mono text-xs`, e.g. `WCAG 4.1.2`

### Review-Pipeline Component

No changes needed — the pipeline already renders agents dynamically from the `pipeline.agents` array.

### Mock Data

Add a new scenario to `cosi-mock.js` that includes accessibility findings:

```js
// Example accessibility finding for mock
{
  severity: 'critical',
  title: 'Icon-Button ohne zugänglichen Namen',
  file: 'src/components/close-button.ts',
  line: 12,
  codeSnippet: '+    <div class="close" @click=${this.onClose}>✕</div>',
  detail: 'Der Schließen-Button ist ein <div> ohne Rolle, ohne zugänglichen Namen und ohne Tastaturunterstützung. Screenreader-Nutzer können dieses Element weder finden noch bedienen.',
  suggestion: 'Semantisches <button>-Element verwenden und aria-label ergänzen: <button aria-label="Dialog schließen" @click=${this.onClose}>✕</button>',
  wcagCriterion: '4.1.2 Name, Rolle, Wert'
}
```

---

## Verification

1. Run a review on a PR that changes Lit component templates — verify the Accessibility agent produces relevant findings
2. Run a review on a PR with only SCSS changes — verify the agent correctly identifies touch-target issues or returns empty findings
3. Run a review on a PR with no UI changes — verify the agent returns an empty findings array without manufacturing issues
4. Verify the Consolidator correctly deduplicates across all three agents
5. Verify `wcagCriterion` renders as a pill badge in the findings UI
6. Verify the pipeline timeline shows three agents + consolidator
7. Test partial failure: Accessibility agent fails → pipeline continues with two agents + warning
8. Verify the mock scenario displays accessibility findings correctly
