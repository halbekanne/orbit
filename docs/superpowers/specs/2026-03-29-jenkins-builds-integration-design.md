# Jenkins Builds Integration — Design Spec

## Ziel

Eine neue **Builds-View** in Orbit, die Jenkins-Builds in das bestehende Layout integriert. Der User sieht Build-Status auf einen Blick, kann Fehler debuggen (Stages + Console-Log), und Builds neu starten — ohne Jenkins im Browser öffnen zu müssen.

**MVP Scope**: Sidebar + Übersicht-Tab + Log-Tab + Restart-Dialog + Build abbrechen + Polling.
**Nicht im MVP**: Artefakte-Tab, KI-Analyse.

**Wichtig**: Der Prototyp (`docs/jenkins-integration-reference/prototype.html`) dient als funktionale Referenz — er zeigt was möglich sein soll, nicht wie es pixelgenau aussehen muss. Die tatsächliche UI orientiert sich primär an der bestehenden Arbeit-View und den Orbit-Components/Patterns. Das Ziel ist, dass sich die Builds-View nahtlos in Orbit einfügt und nicht wie ein Fremdkörper wirkt.

---

## 1. Settings

Neuer Abschnitt **Jenkins** unter Verbindungen in den Einstellungen.

### Felder

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| Base-URL | Text-Input | Ja (wenn Jenkins genutzt) | z.B. `https://jenkins.example.com` |
| Username | Text-Input | Ja | Jenkins-Benutzername |
| API-Token | Password-Input (Show/Hide) | Ja | Persönlicher API-Token aus Jenkins |
| Jobs | Dynamische Liste | Min. 1 | Pro Eintrag: Anzeigename + Job-Pfad |

### Jobs-Liste

Jeder Eintrag hat:
- **Anzeigename** (Text) — wird als Gruppen-Header in der Sidebar verwendet (z.B. "frontend-app")
- **Job-Pfad** (Text, Monospace) — relativer Pfad zum Multibranch-Job (z.B. `job/frontend-app`)

"Job hinzufügen"-Button unten, Entfernen-Button pro Eintrag.

### Validierung

Jenkins ist optional. Wenn Base-URL gesetzt, müssen Username, API-Token und mindestens ein Job ausgefüllt sein. Gleiche Validierungslogik wie bei Jira/Bitbucket (Save-Button nur aktiv wenn valid).

### Settings-Model-Erweiterung

```typescript
interface OrbitSettings {
  connections: {
    // ... bestehende Felder
    jenkins: {
      baseUrl: string;
      username: string;
      apiToken: string;
      jobs: JenkinsJobConfig[];
    };
  };
  // ...
}

interface JenkinsJobConfig {
  displayName: string;
  jobPath: string;
}
```

---

## 2. BFF — Jenkins Proxy

### Proxy-Route

Neue Route `/jenkins/*` in `server/routes/proxy-routes.js` nach dem gleichen Pattern wie Jira/Bitbucket:

- **Target**: `settings.connections.jenkins.baseUrl`
- **Auth**: HTTP Basic Auth — `Authorization: Basic {base64(username:apiToken)}`
- **Path-Rewriting**: `/jenkins/job/frontend-app/...` → `https://jenkins.example.com/job/frontend-app/...`
- **Header-Passthrough**: `X-Text-Size` und `X-More-Data` Response-Headers müssen durchgereicht werden (für progressive Log-Streaming)
- **Gating**: `requireSettings`-Middleware prüft ob Jenkins konfiguriert ist

### Settings-Routes-Erweiterung

`server/routes/settings-routes.js` — Jenkins-Felder in die Validierung aufnehmen: Wenn `connections.jenkins.baseUrl` gesetzt, sind `username`, `apiToken` und mindestens ein Job-Eintrag in `jobs` Pflicht.

---

## 3. Mock Server

Neuer Mock-Server `mock-server/jenkins.js` auf Port **6204**.

### Mock-Daten

- **2 Multibranch-Jobs** (frontend-app, backend-api) mit jeweils 3-5 Branches
- **Branch-Status**: Mischung aus `blue`, `red`, `blue_anime` (Erfolg, Fehler, Laufend)
- **Builds pro Branch**: 2-3 Builds mit result, timestamp, duration
- **Build-Details**: description (mit HTML), parameters, building-Flag
- **Pipeline-Stages** (wfapi): Checkout → Build → Test → Deploy, verschiedene Status pro Build (SUCCESS, FAILED, IN_PROGRESS, NOT_EXECUTED)
- **Stage-Detail + Error**: Fehlgeschlagene Stages mit `stageFlowNodes` und `error`-Objekt
- **Stage-Log**: HTML-Text mit simuliertem Fehler-Output für fehlgeschlagene Stages
- **Console-Log** (`consoleText`): Realistischer Build-Output mit ANSI-Escape-Codes (Farben, Bold)
- **Progressive Text** (`progressiveText`): Simuliert Streaming — gibt bei jedem Call ein Stück mehr zurück, mit `X-Text-Size` und `X-More-Data` Headers
- **Parameter-Definitionen**: Alle 5 Typen (Boolean, Choice, String, Text, Password) mit realistischen Defaults
- **Build triggern** (`POST /build`, `POST /buildWithParameters`): Gibt 201 mit Location-Header zurück
- **Build stoppen** (`POST /stop`): Gibt 200 zurück

### Konfiguration

- `MOCK_DELAY` Environment-Variable (Default 300ms) wie bei Jira/Bitbucket
- CORS aktiviert

### npm-Scripts

- `mock:jenkins`: `node mock-server/jenkins.js`
- `start:mock` erweitert: alle 4 Prozesse (Frontend, BFF, Jira-Mock, Bitbucket-Mock, Jenkins-Mock)

---

## 4. Angular — Domain-Ordner `src/app/builds/`

Flache Struktur nach dem bestehenden Domain-Pattern (AGENTS.md).

### Dateien

```
src/app/builds/
├── jenkins.model.ts           # Interfaces aus Jenkins-Integration-Guide
├── jenkins.service.ts         # Haupt-Service: Branches, Builds, Stages, Trigger, Stop
├── build-log.service.ts       # Console-Log + progressive Streaming
├── builds-sidebar/            # Sidebar-Component
├── build-detail/              # Detail-Component mit Tabs
└── restart-dialog/            # Modal mit dynamischem Parameter-Formular
```

### jenkins.model.ts

TypeScript-Interfaces direkt aus dem Jenkins-Integration-Guide übernommen:
- `JenkinsBranch`, `JenkinsBuild`, `JenkinsBuildDetail`
- `JenkinsRun`, `JenkinsStage`, `JenkinsStageDetail`, `JenkinsStageFlowNode`, `JenkinsStageError`
- `JenkinsStageLog`
- `JenkinsParameterDefinition` (Union-Typ mit allen 5 Varianten)
- `JenkinsArtifact` (für spätere Nutzung, kann schon definiert werden)

### jenkins.service.ts

Signal-basierter Service nach dem Pattern von JiraService/BitbucketService:

**State-Signals**:
- `branches()` — alle Branches aller konfigurierten Jobs, angereichert mit letztem Build-Status
- `loading()`, `error()` — Lade-/Fehlerzustand

**Computed Signals**:
- `sortedBranchesByJob()` — gruppiert nach Job, sortiert chronologisch nach letztem Build-Start (neueste zuerst)
- `selectedBuild()` — Detail-Daten des selektierten Builds (inkl. Stages)

**Methoden**:
- `loadBranches()` — für alle konfigurierten Jobs: Branches + letzten Build laden
- `loadBuildDetail(jobPath, branch)` — Build-Details + wfapi/describe für Stages
- `loadStageDetail(jobPath, branch, buildNumber, stageId)` — Stage-FlowNodes + Error
- `loadStageLog(jobPath, branch, buildNumber, nodeId)` — Error-Log-Ausschnitt für fehlgeschlagene Stage
- `loadParameters(jobPath, branch)` — Parameter-Definitionen für Restart-Dialog
- `triggerBuild(jobPath, branch, params?)` — POST build/buildWithParameters
- `stopBuild(jobPath, branch, buildNumber)` — POST stop

**DataRefreshService-Integration**:
- Registriert `loadBranches` als Refresh-Funktion
- Globaler Refresh alle 10 Minuten (wie Jira/Bitbucket)

**PR-Matching**:
- Lookup gegen `BitbucketService.pullRequests()` per Branch-Name
- Kein manuelles Mapping nötig — Branch-Names sind de facto eindeutig
- Funktioniert nur wenn Bitbucket auch konfiguriert ist, sonst keine PR-Badges

### build-log.service.ts

Separater Service für Console-Log-Handling:

**State-Signals**:
- `logText()` — aktueller Log-Inhalt (roh, mit ANSI-Codes)
- `isStreaming()` — ob gerade gepollt wird
- `error()` — Fehlerzustand

**Methoden**:
- `loadFullLog(jobPath, branch, buildNumber)` — GET consoleText, setzt logText
- `startStreaming(jobPath, branch, buildNumber)` — startet Polling:
  1. Merkt sich Byte-Offset aus initialem Log (Textlänge)
  2. Pollt GET progressiveText?start={offset} alle 5 Sekunden
  3. Hängt neue Zeilen an logText an
  4. Aktualisiert Offset aus `X-Text-Size` Response-Header
  5. Stoppt wenn `X-More-Data` nicht mehr `true`
- `stopStreaming()` — stoppt Polling (bei Navigation weg oder Build fertig)

**ANSI bleibt roh** — das Rendering via `ansi_up` passiert in der Log-Component, nicht im Service.

---

## 5. UI — Builds-View

### Routing

```typescript
// app.routes.ts
{
  path: 'builds',
  component: ViewBuildsComponent,
  children: [
    { path: '**', children: [] }
  ]
}
```

**URL-Muster**:
- `/builds` — keine Selektion (Empty State)
- `/builds/{jobDisplayName}/{branch}` — letzter Build des Branches

Router-Sync nach dem gleichen Pattern wie die Work-View (`RouterSyncService`-Erweiterung oder eigener Sync).

### Navigation Rail

`src/app/shared/app-rail/` — neues Nav-Item "Builds" nach "Arbeit" (zweiter Eintrag in der Rail).

### ViewBuildsComponent

Host-Layout identisch zu ViewArbeitComponent:

```
div.flex.flex-1.h-full.overflow-hidden
├── aside (builds-sidebar) — w-[360px] xl:w-[400px], shrink-0, border-right
└── main (build-detail) — flex-1, overflow-y-auto
```

### Empty States

- **Jenkins nicht konfiguriert**: Zentrierter Hinweis "Jenkins ist noch nicht konfiguriert" + Link "Verbindung einrichten →" zu `/einstellungen`
- **Konfiguriert, nichts selektiert**: Dezenter Hinweis "Build auswählen um Details zu sehen"

---

## 6. UI — Builds-Sidebar

Component `builds-sidebar/` im Stil des Navigators der Work-View.

### Header
- Titel "Builds"
- Subtitle (z.B. "Deine CI/CD Pipelines")

### Branch-Liste

Gruppiert nach Job-Anzeigename (Collapsible Sections):

**Job-Header**: Anzeigename in Uppercase, Violet, mit Branch-Anzahl.

**Branch-Card** pro Branch:
- Branch-Name (Monospace, truncated)
- Status-Badge (Pill mit Punkt): Fehler (rot), Läuft (blau), Erfolg (grün)
- Build-Nummer + relative Zeitangabe
- PR-Badge (violet, `PR #X`) wenn Branch-Name in Bitbucket-PRs gefunden

**Sortierung** pro Gruppe: Chronologisch nach letztem Build-Start (neueste zuerst). Fehlgeschlagene Branches haben einen roten left-border als Attention-State — das reicht zusammen mit den Status-Badges zum schnellen Scannen.

**Selektierter Branch**: Violet Border (wie selektierte Cards in der Work-View).

**"X weitere Branches"**: Hinweis unten pro Gruppe für Branches deren letzter Build älter als 4 Wochen ist.

### SyncBar

`<app-sync-bar [sources]="['jenkins']" />` unten wie in der Work-View. Die bestehende SyncBar-Component wird um ein `sources`-Input erweitert, das steuert welche DataRefreshService-Sources beim manuellen Klick aktualisiert werden. In der Work-View: `['jira', 'bitbucket']`, in der Builds-View: `['jenkins']`. Der automatische 10-Min-Refresh lädt weiterhin alles.

---

## 7. UI — Build-Detail

Component `build-detail/` als Haupt-Content-Bereich.

### Header

- **Branch-Name** (groß, monospace)
- **Metadata-Zeile**: Job-Name · Build-Nummer · Status-Badge (Pill) · Zeitpunkt · Dauer

### Action-Bar (unterhalb Header, eigene Zeile)

- Fertiger Build: **"Neu starten"** (violet primary button) — öffnet Restart-Dialog
- Laufender Build: **"Abbrechen"** (red button) — POST stop, Bestätigung
- Immer: **"In Jenkins öffnen"** (secondary button, öffnet Jenkins-URL in neuem Tab)

### Tabs

Zwei Tabs: **Übersicht** | **Log**

---

## 8. UI — Übersicht-Tab

Max-width `max-w-2xl` (672px), zentriert.

### Beschreibung (Collapsible Section)

- Raw-HTML aus dem `description`-Feld des Builds, sanitized via Angular's DomSanitizer
- Nur sichtbar wenn description vorhanden (bei laufenden Builds oft leer)
- Collapsible im Stil von `app-collapsible-section`

### Pipeline (Collapsible Section)

Flache Stage-Timeline (keine Verbindungslinien):

| Stage-Status | Darstellung |
|-------------|-------------|
| SUCCESS | Grünes Icon (✓), Name, Dauer — kompakt |
| FAILED | Rotes Icon (✗), Name, Dauer + Error-Log-Ausschnitt direkt sichtbar (roter left-border auf Error-Zeilen) |
| IN_PROGRESS | Pulsierendes blaues Icon, Name, "seit X Min." |
| NOT_EXECUTED | Gedimmtes Icon, Name — keine Dauer |

**Error-Log bei fehlgeschlagener Stage**: Wird via wfapi Stage-Log geladen und direkt unter der Stage angezeigt. Monospace, mit rotem left-border auf Fehlerzeilen.

---

## 9. UI — Log-Tab

Volle Breite (kein max-w-2xl) — Logs brauchen Platz.

### Log-Bereich

- **Vollständiges Console-Log** via `consoleText` API
- Monospace-Font, Zeilennummern
- **ANSI-Rendering**: `ansi_up` Library (v6+) mit `use_classes = true` → CSS-Klassen statt Inline-Styles
- **Error-Pattern-Matching**: Zeilen die `ERROR`, `Exception`, `FAILED` enthalten bekommen `border-l-2 border-red-500` (unabhängig von ANSI-Farben, Textfarbe unverändert)
- **"In Jenkins öffnen"**-Link oben rechts

### Progressive Streaming (bei laufenden Builds)

1. Initialer Fetch via `consoleText`
2. Polling via `progressiveText?start={offset}` alle 5 Sekunden
3. Neue Zeilen werden angehängt
4. Auto-Scroll nach unten (solange User nicht manuell hochgescrollt hat)
5. Polling stoppt wenn `X-More-Data` nicht mehr `true`

---

## 10. UI — Restart-Dialog

Modal/Overlay Component `restart-dialog/`.

### Ohne Parameter

Wenn der Job keine Parameter-Definitionen hat: Einfacher Bestätigungsdialog "Build für {branch} starten?". POST an `/build`.

### Mit Parametern

Dynamisches Formular basierend auf `parameterDefinitions`:

| Parameter-Typ | UI-Element |
|--------------|------------|
| `BooleanParameterDefinition` | Toggle-Switch |
| `ChoiceParameterDefinition` | Dropdown |
| `StringParameterDefinition` | Text-Input |
| `TextParameterDefinition` | Textarea |
| `PasswordParameterDefinition` | Password-Input |

Pro Parameter: Label (Parameter-Name), Description darunter (falls vorhanden), Default vorausgefüllt.

### Layout

- **Header**: "Build neu starten" + Branch-Name
- **Body**: Parameter-Formular (scrollbar bei vielen Parametern)
- **Footer**: Abbrechen (secondary) | Starten (violet primary)

### Nach Trigger

- POST an `buildWithParameters` mit den Formular-Werten
- Dialog schließt
- Polling startet automatisch für den neuen Build (Branch wird als "Laufend" angezeigt)

---

## 11. Daten-Refresh

### Globaler Refresh

JenkinsService registriert sich beim `DataRefreshService`:
- Alle 10 Minuten: Branches + letzter Build-Status für alle Jobs neu laden
- Bei Tab-Fokus: Refresh wenn letzter Fetch > 10 Min. her
- Exponential Backoff bei Fehlern (3s, 6s, 12s)

### Schnelles Polling für laufende Builds

Wenn ein laufender Build selektiert ist:
- `wfapi/describe` alle 5 Sekunden (Stages aktualisieren)
- `progressiveText` alle 5 Sekunden (Log-Streaming)
- Build-Detail alle 5 Sekunden (Status-Änderung erkennen)
- Polling stoppt automatisch wenn `building === false` oder User navigiert weg

### Branch-Liste Live-Updates

Wenn ein Build im Hintergrund fertig wird (z.B. war "Laufend", jetzt "Erfolg"), wird das beim nächsten globalen Refresh oder beim nächsten schnellen Poll sichtbar. Die Sidebar aktualisiert sich automatisch durch die Signal-Architektur.

---

## 12. Neue Dependency

**`ansi_up`** (v6.0.6) — Zero-Dependency TypeScript Library für ANSI-Escape-Code-Rendering in HTML. Wird im Log-Tab und bei Stage-Error-Logs benötigt. Konfiguration: `use_classes = true` (CSS-Klassen statt Inline-Styles).

```bash
npm install ansi_up@6.0.6
```

---

## 13. Theming

Alle UI-Components nutzen ausschließlich CSS Custom Properties aus `src/styles/tokens.css` — keine hardcodierten Hex-Werte. Dark und Light Mode müssen beide funktionieren. Die Token-Struktur (`--color-bg-page`, `--color-border-subtle`, `--color-text-primary` etc.) deckt alle Zustände ab. Farben für Status-Badges (Erfolg/Fehler/Laufend) nutzen die semantischen Farben aus dem Design System (Emerald, Red, Blue). ANSI-Log-Farben (`ansi_up` CSS-Klassen) müssen in beiden Modes lesbar sein — ggf. eigene Klassen-Definitionen für Light/Dark.

---

## 14. Referenzen

- **Prototyp**: `docs/jenkins-integration-reference/prototype.html`
- **Jenkins-Integration-Guide**: `docs/jenkins-integration-reference/Jenkins-Integration-Guide.md`
- **Orbit Design Tokens**: `src/styles/tokens.css`
- **Work-View (Vorlage)**: `src/app/shared/view-arbeit/`, `src/app/shared/navigator/`, `src/app/shared/workbench/`
- **Jira/Bitbucket Services (Pattern)**: `src/app/jira/jira.service.ts`, `src/app/bitbucket/bitbucket.service.ts`
- **BFF Proxy (Pattern)**: `server/routes/proxy-routes.js`
- **Mock Server (Pattern)**: `mock-server/jira.js`, `mock-server/bitbucket.js`
- **AGENTS.md**: Coding-Standards und Design-Constraints
