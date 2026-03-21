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
      description: "Liste der gefundenen Probleme. Leeres Array wenn keine Probleme gefunden.",
      items: {
        type: "OBJECT",
        properties: {
          severity: {
            type: "STRING",
            enum: ["critical", "important", "minor"],
            // description differs per agent — set in agent-specific schema
          },
          title: { type: "STRING", description: "Kurze deutsche Zusammenfassung des Problems" },
          file: { type: "STRING", description: "Dateipfad aus dem Diff" },
          line: { type: "INTEGER", description: "Zeilennummer aus dem Diff (die Nummer in eckigen Klammern)" },
          codeSnippet: { type: "STRING", description: "Die exakten 1-2 Zeilen aus dem Diff die das Finding betrifft, wörtlich kopiert" },
          detail: { type: "STRING", description: "Was ist das Problem und warum ist es relevant (1-3 Sätze, auf Deutsch)" },
          suggestion: { type: "STRING", description: "Konkreter Verbesserungsvorschlag (auf Deutsch, technische Fachbegriffe auf Englisch erlaubt)" }
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

- **Agent 1 (AK-Abgleich):** `"critical = AK komplett nicht umgesetzt, important = AK teilweise umgesetzt aber Schlüssel-Szenario fehlt, minor = AK umgesetzt aber weicht in kleinem Detail von der Spezifikation ab"`
- **Agent 2 (Code Quality):** `"critical = Laufzeitfehler oder kaputte Funktionalität, important = strukturelles Problem das Wartbarkeit erschwert oder fehlende Cleanup-Logik, minor = Lesbarkeitsverbesserung oder kleine Inkonsistenz"`

### Consolidator Schema

```js
{
  type: "OBJECT",
  properties: {
    findings: {
      type: "ARRAY",
      description: "Finale, gefilterte Liste der Findings.",
      items: {
        type: "OBJECT",
        properties: {
          severity: {
            type: "STRING",
            enum: ["critical", "important", "minor"],
            description: "critical = echtes Laufzeitrisiko, important = strukturelles Problem, minor = kleine Verbesserung"
          },
          category: {
            type: "STRING",
            enum: ["ak-abgleich", "code-quality"],
            description: "Welcher Agent das Finding ursprünglich produziert hat"
          },
          title: { type: "STRING", description: "Kurze deutsche Zusammenfassung" },
          file: { type: "STRING", description: "Dateipfad aus dem Diff" },
          line: { type: "INTEGER", description: "Zeilennummer aus dem Diff" },
          codeSnippet: { type: "STRING", description: "Exakte Zeilen aus dem Diff, wörtlich kopiert" },
          detail: { type: "STRING", description: "Problembeschreibung auf Deutsch (1-3 Sätze)" },
          suggestion: { type: "STRING", description: "Verbesserungsvorschlag auf Deutsch" }
        },
        required: ["severity", "category", "title", "file", "line", "codeSnippet", "detail", "suggestion"],
        propertyOrdering: ["severity", "category", "title", "file", "line", "codeSnippet", "detail", "suggestion"]
      }
    },
    decisions: {
      type: "ARRAY",
      description: "Für jedes Input-Finding eine Entscheidung was damit passiert ist.",
      items: {
        type: "OBJECT",
        properties: {
          agent: { type: "STRING", enum: ["ak-abgleich", "code-quality"] },
          finding: { type: "STRING", description: "Originaltitel des Findings" },
          action: { type: "STRING", enum: ["kept", "removed", "merged", "severity-changed"] },
          reason: { type: "STRING", description: "Begründung auf Deutsch" }
        },
        required: ["agent", "finding", "action", "reason"],
        propertyOrdering: ["agent", "finding", "action", "reason"]
      }
    },
    summary: {
      type: "STRING",
      description: "Deutsche Zusammenfassung, z.B. '3 Auffälligkeiten: 1 Kritisch, 1 Wichtig, 1 Gering' oder 'Keine Auffälligkeiten'"
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
Jede Zeile im Diff beginnt mit [Zeilennummer]. Verwende diese Nummer direkt als "line"-Wert.
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

The thinking steps (OVERLAP, GROUNDING, QUALITY GATE, SEVERITY CHECK) handle all the analytical work.

### 3b: SHARED_CONSTRAINTS Rewrite

**Removed** (enforced by responseSchema):
- `"Output valid JSON only. No markdown, no wrapping, no explanation outside the JSON."`

**New SHARED_CONSTRAINTS content:**

```
You are reviewing a pull request for a Design System built with TypeScript, Lit (Web Components), and SCSS.

Jede Zeile im Diff beginnt mit [Zeilennummer]. Verwende diese Nummer direkt als "line"-Wert.

RULES:
- Melde ausschließlich Probleme. Jedes Finding beschreibt einen konkreten Mangel.
- Kein Lob, kein "looks good", kein "well done", kein "LGTM".
- Melde ein Finding NUR wenn du eine konkrete hinzugefügte Zeile im Diff benennen kannst. Ohne exakten codeSnippet existiert das Finding nicht.
- CRITICAL: Only review ADDED lines (lines starting with '+' in the diff). Lines starting with '-' are removed code — do not review them. Context lines (no prefix) are for understanding only — do not create findings for them.
- Ein leeres findings-Array ist ein valides Ergebnis, kein Fehler. Erfinde keine Probleme um die Ausgabe zu füllen — aber im Zweifel lieber ein Finding zu viel melden als eines übersehen.
- Alle textuellen Felder (title, detail, suggestion) sind auf Deutsch. Englische Fachbegriffe (z.B. "null check", "race condition", "lifecycle hook") dürfen inline verwendet werden.

THINKING PHASE INSTRUCTIONS:
You have a dedicated thinking phase before generating the JSON. You MUST use this phase to perform a step-by-step analysis. Do NOT use the thinking phase to draft JSON syntax. Use it to reason about the code, cross-reference requirements, and verify your claims. Only after completing your analysis should you write the JSON output.
```

### 3c: All User-Facing Output in German

The rule `"Titles must be in German. Detail and suggestion may use English for technical terms."` is replaced by:
```
Alle textuellen Felder (title, detail, suggestion) sind auf Deutsch. Englische Fachbegriffe (z.B. "null check", "race condition", "lifecycle hook") dürfen inline verwendet werden.
```

This also applies to the `reason` field in Consolidator decisions (already German via schema description).

### 3d: User Prompt Reordering

The user prompts currently end with `"Output JSON only."` which primes the thinking phase toward JSON construction. Each user prompt now ends with the analysis instruction instead:

**Agent 1:**
```
Folge deinem Denkprozess Schritt für Schritt: EXTRACT, CLASSIFY, TRACE, FORMULATE.
```

**Agent 2:**
```
Folge deinem Denkprozess Schritt für Schritt: SCAN die hinzugefügten Zeilen, dann FORMULATE für bestätigte Probleme.
```

**Consolidator:**
```
Folge deinem Denkprozess Schritt für Schritt: OVERLAP, GROUNDING, QUALITY GATE, SEVERITY CHECK.
```

---

## Change 4: Code Quality Agent Refocus

### What

The Code Quality agent's FOCUS AREAS are adjusted to avoid overlap with TypeScript strict mode and ESLint. The agent should focus on problems that only a human reviewer would find.

### New FOCUS AREAS

```
FOCUS AREAS (in priority order):
Ignore issues that TypeScript strict mode or ESLint would already catch (type errors, null access on strict types, unused variables, import order, formatting). Focus on problems that only a human reviewer would find:

1. Logikfehler die kompilieren aber falsch verhalten — Race Conditions, Off-by-One, falsche Bedingungen, unbehandelte Edge Cases
2. Lesbarkeit und Wartbarkeit — verworrene Logik, tiefe Verschachtelung, unklare Absicht, Funktionen die zu viel tun
3. Lit / Web Components Best Practices — Lifecycle-Fehler, fehlende Cleanup-Logik (Event Listener, Subscriptions), ineffizientes Rendering, falsche Reactive-Property-Nutzung
4. Saubere Code-Struktur — Single Responsibility, sinnvolle Benennung, DRY (keine voreilige Abstraktion)
```

---

## Change 5: Few-Shot Examples

One calibration example per agent, placed after the thinking process block and before the scope/rules section.

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
NOISE-BEISPIELE (solche Findings immer entfernen):
- Formatierung, Trailing Commas, Semikolons, Anführungszeichen-Stil → wird von ESLint/Prettier erzwungen
- Import-Reihenfolge oder -Gruppierung → wird von ESLint erzwungen
- Typfehler oder Null-Checks die TypeScript strict mode bereits erzwingt → der Build bricht ohnehin
- Rein kosmetische Umbenennungen die weder Lesbarkeit noch Wartbarkeit verbessern → Geschmackssache, kein Defekt
- Findings die kein konkretes Problem benennen, sondern nur eine Alternative vorschlagen ("könnte man auch mit X lösen") → nur behalten wenn die aktuelle Lösung ein messbares Problem hat (Lesbarkeit, Performance, Wartbarkeit), dann als "minor"
```

---

## Verification

1. Run a real review on a PR with a Jira ticket that has AKs
2. Check that JSON parsing never fails (responseSchema guarantees structure)
3. Verify line numbers in findings match the annotated diff lines
4. Check `thoughts` output shows structured analysis (EXTRACT → CLASSIFY → TRACE → FORMULATE), not JSON drafting
5. Verify all textual fields (title, detail, suggestion, reason) are in German
6. Compare finding quality: fewer false positives, no hallucinated line numbers, no lint/type-check overlap
