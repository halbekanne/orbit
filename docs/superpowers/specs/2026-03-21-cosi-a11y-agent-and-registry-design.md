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
| `proxy/cosi.js` | Agent Registry, Accessibility prompt + schema, Consolidator generalization, orchestrator refactor |
| `proxy/cosi-mock.js` | New mock scenario with accessibility findings |
| `src/app/models/review.model.ts` | `category` type change, `wcagCriterion` field |
| `src/app/components/review-findings/review-findings.ts` | Accessibility badge color, WCAG criterion pill |

---

## Change 1: Agent Registry

### What

Replace the hardcoded agent orchestration with a declarative registry. Each entry describes a specialist agent completely — prompt, schema, model parameters, and conditions.

### Registry Structure

```js
const AGENT_REGISTRY = [
  {
    id: 'ak-abgleich',
    label: 'AK-Abgleich',
    category: 'ak-abgleich',
    systemPrompt: SYSTEM_PROMPTS.akAbgleich,
    responseSchema: AK_FINDING_SCHEMA,
    temperature: 0.2,
    thinkingBudget: 16384,
    requiresJiraTicket: true,
  },
  {
    id: 'code-quality',
    label: 'Code-Qualität',
    category: 'code-quality',
    systemPrompt: SYSTEM_PROMPTS.codeQuality,
    responseSchema: CODE_QUALITY_FINDING_SCHEMA,
    temperature: 0.4,
    thinkingBudget: 16384,
  },
  {
    id: 'accessibility',
    label: 'Barrierefreiheit',
    category: 'accessibility',
    systemPrompt: SYSTEM_PROMPTS.accessibility,
    responseSchema: ACCESSIBILITY_FINDING_SCHEMA,
    temperature: 0.3,
    thinkingBudget: 16384,
  },
];
```

### Orchestrator Changes

The `runReview()` function changes from hardcoded calls to registry iteration:

1. Filter `AGENT_REGISTRY` for applicable agents (skip entries with `requiresJiraTicket: true` when no ticket is present)
2. For each applicable agent, call `callCoSi()` with the entry's config
3. Wrap each response: `{ id: entry.id, label: entry.label, findings: [...] }`
4. Send SSE events per agent (`agent:start`, `agent:done`) — no frontend changes needed since events already use agent names from the backend
5. Collect all wrapped results into an `agents` array
6. Pass the array to the Consolidator

Error handling stays the same: if one agent fails, the pipeline continues with partial results and a warning is added.

### Adding a Future Agent

Adding a new specialist requires only:
1. Write a system prompt in `SYSTEM_PROMPTS`
2. Define a response schema
3. Add an entry to `AGENT_REGISTRY`

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

### Prompt Changes

- Replace all hardcoded references to `ak-abgleich` and `code-quality` with generic language ("die Fach-Agenten", "der jeweilige Agent")
- The `category` field in output findings is set to the `id` of the originating agent
- The `agent` field in decisions is set to the `id` of the originating agent
- Agent-specific fields (`wcagCriterion`) are passed through without modification

### Consolidator Schema Update

```js
// category changes from enum to string
category: {
  type: "STRING",
  description: "The id of the agent that produced the finding"
},

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
// category becomes a string to support dynamic agents
category: string;

// new optional field for accessibility findings
wcagCriterion?: string;
```

### Review-Findings Component

- New category badge for `accessibility`: Teal color scheme (`bg-teal-50 text-teal-700 border-teal-200`), label "Barrierefreiheit"
- Badge color mapping becomes a lookup object instead of if/else, to support future categories
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
