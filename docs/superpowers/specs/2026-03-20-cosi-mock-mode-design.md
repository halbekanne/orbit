# CoSi Review Mock Mode

> **For agentic workers:** This spec describes a small, self-contained feature. Use superpowers:subagent-driven-development or superpowers:executing-plans to implement the resulting plan.

**Goal:** Allow local development and UI testing of the CoSi AI review feature without a real API key.

**Trigger:** `COSI_API_KEY` not set in `.env`.

## Architecture

### New File: `proxy/cosi-mock.js`

Exports a single function `runMockReview()` that returns a `Promise<ReviewResult>` matching the shape returned by `runReview()` in `proxy/cosi.js`.

Behavior:
- Waits 2–3 seconds (random) to simulate API latency
- Selects one of 4 scenarios at random (rotating through them)
- Returns a response conforming to the `ReviewResult` shape: `{ findings, summary, warnings, reviewedAt }`

### Modified File: `proxy/index.js`

The `/api/cosi/review` handler checks `COSI_API_KEY`:
- **Set** → calls `runReview()` (existing behavior, unchanged)
- **Not set** → calls `runMockReview()` from `cosi-mock.js`

On startup, when `COSI_API_KEY` is missing, the existing `console.warn` is updated to:
```
[CoSi] Mock-Modus aktiv — kein API Key gesetzt
```

### Frontend

No changes. `CosiReviewService` calls the same endpoint and receives the same `ReviewResult` interface.

## Mock Scenarios

`runMockReview()` cycles through these 4 scenarios randomly:

### Scenario 1: Mehrere Findings (mixed)

3–4 findings spanning both categories and all severity levels.

```json
{
  "findings": [
    {
      "severity": "critical",
      "category": "ak-abgleich",
      "title": "Hover-State für primären Button fehlt",
      "file": "src/components/button/button.styles.scss",
      "line": 42,
      "detail": "Laut AK muss der primäre Button einen sichtbaren Hover-State haben. Die aktuelle Implementierung definiert keinen :hover-Selektor.",
      "suggestion": "Einen :hover-Selektor mit leicht abgedunkelter Hintergrundfarbe ergänzen."
    },
    {
      "severity": "important",
      "category": "code-quality",
      "title": "Typ-Assertion statt Type Guard",
      "file": "src/components/button/button.ts",
      "line": 87,
      "detail": "Die Typ-Assertion `as ButtonVariant` umgeht die Typprüfung. Ein Type Guard wäre sicherer und erkennt ungültige Werte zur Laufzeit.",
      "suggestion": "Einen Type Guard `isButtonVariant()` implementieren und vor dem Zugriff prüfen."
    },
    {
      "severity": "minor",
      "category": "code-quality",
      "title": "Doppelte Berechnung in render()",
      "file": "src/components/button/button.ts",
      "line": 112,
      "detail": "Die CSS-Klasse wird bei jedem Render-Zyklus neu berechnet, obwohl sich die Inputs nicht geändert haben.",
      "suggestion": "Berechnung in ein `willUpdate()` mit Dirty-Check verschieben."
    }
  ],
  "summary": "3 Auffälligkeiten: 1 Kritisch, 1 Wichtig, 1 Gering",
  "warnings": [],
  "reviewedAt": "<ISO timestamp>"
}
```

### Scenario 2: Keine Findings

```json
{
  "findings": [],
  "summary": "Keine Auffälligkeiten",
  "warnings": [],
  "reviewedAt": "<ISO timestamp>"
}
```

### Scenario 3: Nur Code-Quality (kein Jira-Ticket)

2 findings, only code-quality category. Includes warning about missing ticket.

```json
{
  "findings": [
    {
      "severity": "important",
      "category": "code-quality",
      "title": "Event-Listener wird nicht aufgeräumt",
      "file": "src/components/tooltip/tooltip.ts",
      "line": 34,
      "detail": "Der `mouseenter`-Listener wird in `connectedCallback` registriert, aber in `disconnectedCallback` nicht entfernt. Das führt zu Memory Leaks bei häufigem Mount/Unmount.",
      "suggestion": "Listener-Referenz speichern und in `disconnectedCallback` via `removeEventListener` aufräumen."
    },
    {
      "severity": "minor",
      "category": "code-quality",
      "title": "Unnötiger Nullcheck",
      "file": "src/components/tooltip/tooltip.ts",
      "line": 58,
      "detail": "Die Property `content` ist als `@property()` deklariert und hat einen Default-Wert. Der Nullcheck in Zeile 58 greift nie.",
      "suggestion": "Nullcheck entfernen, da `content` immer definiert ist."
    }
  ],
  "summary": "2 Auffälligkeiten: 1 Wichtig, 1 Gering",
  "warnings": ["Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft."],
  "reviewedAt": "<ISO timestamp>"
}
```

### Scenario 4: Partial Failure

1 finding with a warning that agent 1 failed.

```json
{
  "findings": [
    {
      "severity": "important",
      "category": "code-quality",
      "title": "Shadow DOM Styling Leak",
      "file": "src/components/card/card.styles.scss",
      "line": 15,
      "detail": "Der `:host` Selektor fehlt. Styles können in den umgebenden DOM leaken wenn die Komponente ohne Shadow DOM genutzt wird.",
      "suggestion": "Alle Top-Level-Styles in `:host { }` wrappen."
    }
  ],
  "summary": "1 Auffälligkeit: 1 Wichtig",
  "warnings": ["Agent 1 (AK-Abgleich) fehlgeschlagen: CoSi API error: 503 — Service Unavailable"],
  "reviewedAt": "<ISO timestamp>"
}
```

## Implementation Notes

- `reviewedAt` is set to `new Date().toISOString()` at response time (same as `runReview`)
- Random delay: `Math.random() * 1000 + 2000` (2–3 seconds)
- Scenario selection: random index into array of scenario functions
- The mock module has no dependencies beyond Node built-ins
- Console log on each mock request: `[CoSi Mock] Szenario: <name>` for debugging

## Testing

- Unit test for `runMockReview()`: returns valid `ReviewResult` shape, delay is within expected range
- Each scenario produces correct structure (findings array, summary string, warnings array, reviewedAt string)
