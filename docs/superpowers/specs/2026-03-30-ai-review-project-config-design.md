# AI Review: Projekt-spezifische Konfiguration

## Ziel

Das AI Review Feature soll für beliebige Repositories einsetzbar sein. Nutzer können einzelne Review-Agenten ein-/ausschalten und projektspezifische Anweisungen hinterlegen, die allen aktiven Agenten mitgegeben werden.

## Änderungen

### 1. Settings-Model (`src/app/settings/settings.model.ts`)

`features.aiReviews` wird erweitert:

```typescript
aiReviews: {
  enabled: boolean;
  enabledAgents: string[];  // Agent-IDs aus AGENT_REGISTRY
  projectRules: string;      // Freitext, wird allen Agenten injiziert
}
```

**Defaults** (in `createDefaultSettings()`):
- `enabledAgents`: `['code-quality', 'ak-abgleich']`
- `projectRules`: `''`

**Migration:** Bestehende Settings ohne die neuen Felder erhalten die Defaults automatisch — analog zur bestehenden Merge-Logik im `ViewSettingsComponent`-Konstruktor (`{ ...defaults, ...settings }`).

### 2. Agenten-Prompts generisch machen

#### `SHARED_CONSTRAINTS` (`server/agents/agent-definition.js`)

Aktueller Inhalt entfernen:
- `"You are reviewing a pull request for a Design System built with TypeScript, Lit (Web Components), and SCSS."`
- Den gesamten `PROJECT CONTEXT AND RULES`-Abschnitt (Slot-Konvention etc.)

Neuer Abschnitt, bedingt eingefügt wenn `projectRules` nicht leer:

```
## Project Context (provided by user)
{projectRules}
```

Statt eines Platzhalters im String wird `SHARED_CONSTRAINTS` zu einer Funktion:

```javascript
function buildSharedConstraints(projectRules) {
  let constraints = `You are reviewing a pull request.

Every line in the diff starts with [line_number]...
// ... restliche generische Constraints ...
`;

  if (projectRules?.trim()) {
    constraints += `\nPROJECT CONTEXT AND RULES (provided by user):\n${projectRules}\n`;
  }

  return constraints;
}
```

Jede Agent-Definition nutzt dann `buildSharedConstraints(projectRules)` statt der Konstante. Das erfordert, dass `projectRules` an die Agent-Definitionen durchgereicht wird (siehe Abschnitt 3).

#### Accessibility-Agent (`server/agents/accessibility.js`)

- Entfernen: `"You are specialized for component-based Design Systems built with Lit (Web Components) and SCSS."`
- Behalten: HTML-, TypeScript- und Frontend-Fokus — der Agent prüft weiterhin WCAG AA für UI-Code
- Behalten: Alle 8 Fokus-Bereiche, Anti-Pattern-Katalog, Severity-Kalibrierung
- Abschnitt "Lit/Shadow-DOM-spezifisch" (Fokus-Bereich 8) umbenennen zu "Web-Component-/Shadow-DOM-spezifisch" — bleibt relevant für alle Web-Component-Frameworks, nicht nur Lit

#### Code-Quality-Agent (`server/agents/code-quality.js`)

- Prüfen ob projektspezifische Referenzen vorhanden sind, diese entfernen
- Generische Best-Practice-Prüfungen bleiben

#### AK-Abgleich-Agent (`server/agents/ak-abgleich.js`)

- Ist bereits generisch (arbeitet mit Jira-Ticket-Daten, nicht hardcodiertem Kontext)
- Keine Änderungen nötig

#### Consolidator (`server/ai.js`)

- `SYSTEM_PROMPTS.consolidator` nutzt ebenfalls `SHARED_CONSTRAINTS` — auf `buildSharedConstraints(projectRules)` umstellen

### 3. Orchestrierung (`server/ai.js`)

**Signatur erweitern:**

```javascript
async function runReview(diff, jiraTicket, emit, { vertexAi, enabledAgents, projectRules })
```

**Agent-Filterung (zwei Stufen):**

1. `enabledAgents`-Filter: Nur Agenten ausführen, deren `id` in `enabledAgents` enthalten ist. Deaktivierte Agenten werden kommentarlos übersprungen.
2. `isApplicable()`-Guard: Wie bisher — technische Voraussetzung (z.B. Jira-Ticket vorhanden). Erzeugt weiterhin `skipMessage`-Warnung.

```javascript
const enabledFromSettings = AGENT_REGISTRY.filter(a => enabledAgents.includes(a.id));
const applicableAgents = enabledFromSettings.filter(a => !a.isApplicable || a.isApplicable(jiraTicket));
const skipped = enabledFromSettings.filter(a => a.isApplicable && !a.isApplicable(jiraTicket));
```

**`projectRules` Weitergabe:**

Jeder Agent muss `projectRules` in seinen System-Prompt einbauen. Dafür gibt es zwei Optionen — wir wählen die einfachere:

Die `systemPrompt`-Property in `AgentDefinition` wird von einem String zu einer Funktion:

In `agent-definition.js` wird die `AgentDefinition`-TypeDef angepasst: `systemPrompt` (String) wird durch `buildSystemPrompt` (Funktion) ersetzt:

```javascript
/** @property {(projectRules?: string) => string} buildSystemPrompt */
```

Jeder Agent exportiert `buildSystemPrompt(projectRules)` statt `systemPrompt`. Darin ruft er `buildSharedConstraints(projectRules)` auf und hängt seine agenten-spezifischen Anweisungen an. Die alte `systemPrompt`-Property entfällt.

In `ai.js` wird dann `agent.buildSystemPrompt(projectRules)` aufgerufen statt `agent.systemPrompt` gelesen. Das betrifft sowohl die Agenten-Aufrufe als auch den Consolidator.

### 4. Route (`server/routes/ai-routes.js`)

Settings auslesen und weiterreichen:

```javascript
const s = getSettings();
const vertexAi = s?.connections?.vertexAi;
const enabledAgents = s?.features?.aiReviews?.enabledAgents ?? ['code-quality', 'ak-abgleich'];
const projectRules = s?.features?.aiReviews?.projectRules ?? '';

await runReview(diff, jiraTicket || null, emit, { vertexAi, enabledAgents, projectRules });
```

### 5. Settings-UI (`src/app/settings/view-settings/`)

Innerhalb der bestehenden "KI-gestützte Reviews"-Karte, unter dem Haupt-Toggle. Alles disabled wenn der Haupt-Toggle aus ist (bestehende `opacity-50` und `pointer-events-none` Logik erweitern).

#### Agenten-Checkboxen

Für jeden Agent aus `AGENT_REGISTRY` eine Checkbox mit Label und Beschreibung. Die Agenten-Metadaten (ID, Label, Beschreibung) werden über einen neuen API-Endpunkt oder als statische Daten bereitgestellt.

**Pragmatischer Ansatz:** Die Agenten-Beschreibungen werden direkt im Frontend definiert — eine Map von Agent-ID zu Beschreibungstext. Die Agent-IDs und Labels sind stabil und ändern sich selten.

```typescript
readonly agentDescriptions: Record<string, { label: string; description: string }> = {
  'code-quality': {
    label: 'Code-Qualität',
    description: 'Prüft Logikfehler, Lesbarkeit, Wartbarkeit und fehlende Cleanup-Logik. Empfohlen für alle Projekte.',
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

**UI-Struktur pro Agent:**

```html
<label class="flex items-start gap-3 cursor-pointer">
  <input type="checkbox" ...>
  <div>
    <span class="font-medium">Code-Qualität</span>
    <p class="text-xs text-muted">Prüft Logikfehler, Lesbarkeit, ...</p>
  </div>
</label>
```

#### Projektregeln-Textarea

Direkt unter den Agenten-Checkboxen, ohne eigene Untersektion.

- **Label:** "Projektregeln"
- **Beschreibender Text:** "Diese Anweisungen werden allen aktiven Review-Agenten mitgegeben. Beschreibe hier euren Tech-Stack, Coding-Konventionen und worauf beim Review besonders geachtet werden soll."
- **Placeholder:** "z.B. Java 21 mit Spring Boot 3. Wir nutzen Hexagonale Architektur mit Ports & Adapters. REST-APIs folgen unseren OpenAPI-Specs. Tests mit JUnit 5 und Mockito."
- **Styling:** Feste Höhe (120px), `overflow-y: auto`, kein Resize (`resize-none`). Gleiche Input-Styles wie bestehende Felder (Rounded, Border, Focus-Ring).

### 6. Betroffene Dateien (Zusammenfassung)

| Datei | Änderung |
|---|---|
| `src/app/settings/settings.model.ts` | `enabledAgents` + `projectRules` zum Interface und Defaults |
| `server/agents/agent-definition.js` | `SHARED_CONSTRAINTS` → `buildSharedConstraints(projectRules)` |
| `server/agents/code-quality.js` | Projektspezifisches entfernen, `buildSystemPrompt()` statt `systemPrompt` |
| `server/agents/accessibility.js` | Design-System-Spezifisches entfernen, `buildSystemPrompt()` statt `systemPrompt` |
| `server/agents/ak-abgleich.js` | `buildSystemPrompt()` statt `systemPrompt` |
| `server/ai.js` | `runReview()` Signatur erweitern, Agent-Filterung, `projectRules` durchreichen, Consolidator anpassen |
| `server/routes/ai-routes.js` | `enabledAgents` + `projectRules` aus Settings lesen |
| `src/app/settings/view-settings/view-settings.html` | Agenten-Checkboxen + Textarea |
| `src/app/settings/view-settings/view-settings.ts` | `agentDescriptions`, Agenten-Toggle-Logik |

## Nicht im Scope

- Pro-Agent Projektregeln (spätere Erweiterung)
- Review-Profile / Projekt-Presets
- Backend-API für Agenten-Metadaten (Frontend-Map reicht für 3 Agenten)
- Versionierung oder Team-Sharing von Projektregeln
