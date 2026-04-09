# Jenkins Build KI-Analyse — Design Spec

## Kontext

Orbit hat bereits eine Jenkins-Integration mit Build-Übersicht, Stage-Pipeline und Log-Ansicht. Der nächste Schritt: Bei fehlgeschlagenen Builds analysiert die KI automatisch das Stage-Log und (wenn verfügbar) das Jenkinsfile, um dem User eine prägnante Fehlerdiagnose zu liefern. Das spart dem Entwickler die manuelle Log-Analyse und gibt ihm sofort eine konkrete Handlungsempfehlung.

## Überblick

Sobald ein fehlgeschlagener Build im Detail geöffnet wird, startet automatisch eine KI-Analyse. Der Server erhält Build-Kontext und Stage-Log vom Frontend, ergänzt das Jenkinsfile über Bitbucket und schickt alles an Vertex AI. Das Ergebnis zeigt drei Dinge: Fehlerursache, Lösungsvorschlag und den Beleg aus Log/Jenkinsfile.

## Datenfluss

```
User klickt fehlgeschlagenen Build
  ↓
Frontend: Build-Detail + Stage-Infos laden (passiert sowieso)
  ↓
Frontend: POST /api/ai/build-analysis
  Body: { jobPath, branch, buildNumber, failedStage, stageLog }
  ↓
Server: Repo-Mapping aus config.xml (gecacht pro Job)
  → GET /job/{jobPath}/config.xml (nur beim ersten Mal)
  → Extrahiert: Bitbucket project, repo, scriptPath
  ↓
Server: Jenkinsfile von Bitbucket laden
  → GET /rest/api/1.0/projects/{proj}/repos/{repo}/browse/{scriptPath}?at=refs/heads/{branch}
  ↓
Server: Prompt bauen + Vertex AI Call
  ↓
Server: JSON-Ergebnis zurück an Frontend
  ↓
Frontend: Ergebnis anzeigen + In-Memory cachen
```

## API

### `POST /api/ai/build-analysis`

**Request:**

```json
{
  "jobPath": "my-multibranch-job",
  "branch": "feature/xyz",
  "buildNumber": 42,
  "failedStage": {
    "name": "Test",
    "nodeId": "5",
    "status": "FAILED",
    "durationMillis": 45000
  },
  "stageLog": "... Log-Inhalt der fehlgeschlagenen Stage ..."
}
```

**Response (Erfolg):**

```json
{
  "cause": "npm-Dependency @angular/core@19.2.0 nicht auflösbar — Version existiert nicht in der Registry.",
  "solution": "Version in package.json auf 19.1.4 korrigieren und package-lock.json neu generieren.",
  "evidence": {
    "source": "stage-log",
    "snippet": "[10:23:15] npm ERR! ERESOLVE could not resolve\nnpm ERR! Found: @angular/core@19.2.0\nnpm ERR! No matching version found"
  },
  "jenkinsfileAvailable": true
}
```

**Response (Fehler):**

```json
{
  "error": "Vertex AI nicht erreichbar",
  "details": "..."
}
```

## Config.xml Parsing & Repo-Mapping

Beim ersten Analyse-Request für einen Job wird die config.xml einmalig geladen und das Repo-Mapping im Memory gecacht (`Map<jobPath, { project, repo, scriptPath }>`).

**Extrahierte Werte:**

- `sources > data > BranchSource > source > traits > GitBrowserSCMSourceTrait > browser > url` → Projekt + Repo-Slug parsen (z.B. `https://git.system.local/projects/DSYS/repos/design-system/` → `DSYS` / `design-system`)
- `factory > scriptPath` → Pfad zum Jenkinsfile (z.B. `Jenkinsfile`)

**Fallback:** Wenn config.xml-Parsing oder Jenkinsfile-Laden fehlschlägt, wird die Analyse nur mit Stage-Log durchgeführt. `jenkinsfileAvailable: false` in der Response signalisiert dem Frontend, dass die Analyse ohne Jenkinsfile-Kontext erfolgte.

## KI-Prompt

**System-Prompt:**

```
Du bist ein Build-Fehler-Analyst. Du erhältst das Jenkinsfile einer Pipeline und das Log einer fehlgeschlagenen Stage. Analysiere die Fehlerursache.

Regeln:
- Fehlerursache: Maximal 1-2 Sätze. Extrem prägnant. Technische Details (Paketnamen, Pfade, Fehlercodes) einbauen.
- Lösungsvorschlag: Konkrete Handlungsanweisung, die der Entwickler sofort umsetzen kann. Kein "prüf ob..." sondern "mach X".
- Beleg: Exakt die relevanten Zeilen aus dem Log oder Jenkinsfile zitieren, nicht paraphrasieren. Wenige Zeilen, nur das Wesentliche.
- Sprache: Deutsch, informell (Du-Form).
```

Wenn kein Jenkinsfile verfügbar ist, wird der System-Prompt angepasst (nur Log-Analyse erwähnt).

**User-Prompt:**

```
Jenkinsfile:
---
{jenkinsfile-inhalt}
---

Fehlgeschlagene Stage: "{stageName}"
Stage-Log:
---
{stage-log-inhalt}
---
```

**Structured Output (JSON Schema):**

```json
{
  "cause": "string — Fehlerursache, 1-2 Sätze, extrem prägnant",
  "solution": "string — Lösungsvorschlag, konkret und direkt umsetzbar",
  "evidence": {
    "source": "enum: stage-log | jenkinsfile",
    "snippet": "string — relevanter Ausschnitt, wenige Zeilen"
  }
}
```

**Vertex AI Config:**

- Temperature: 0.2
- Thinking Budget: 8192 Tokens
- Response MIME Type: `application/json`

## Frontend

### Service: `BuildAnalysisService`

Eigener, schlanker Service — unabhängig vom bestehenden `AiReviewService`.

- `analyzeFailedBuild(params): Observable<BuildAnalysisResult>` — HTTP POST, kein SSE
- In-Memory-Cache: `Map<string, BuildAnalysisResult>`, Key: `{jobPath}/{branch}/{buildNumber}`
- `reanalyze(params)` — löscht Cache-Eintrag, startet neuen Request

### Integration in `BuildDetailComponent`

Beim Laden eines Builds: wenn `result === 'FAILURE'` → Analyse automatisch starten.

### UI-Zustände

| Zustand                   | Darstellung                                                             |
| ------------------------- | ----------------------------------------------------------------------- |
| Kein Fehler               | KI-Analyse-Bereich wird nicht gezeigt                                   |
| Loading                   | "Fehlerursache wird analysiert..." mit Ladeanimation                    |
| Result                    | Ursache, Lösung, Beleg + "Neu analysieren"-Button                       |
| Result (ohne Jenkinsfile) | Wie Result, aber Hinweis dass Analyse ohne Jenkinsfile-Kontext erfolgte |
| Error                     | Fehlermeldung + "Erneut versuchen"-Button                               |

### UI-Design

Der KI-Analyse-Bereich erscheint im Overview-Tab als eigene Karte (collapsible, wie andere Sektionen).

**Struktur:**

- Header: "KI-Analyse" + Beta-Badge
- **Ursache**: Überschrift "Ursache", darunter 1-2 Sätze mit inline `<code>` für technische Details
- **Lösung**: Überschrift "Lösung", darunter konkrete Handlungsanweisung
- **Betroffene Stelle**: Überschrift "Betroffene Stelle", darunter Code-/Log-Ausschnitt in Festbreitenschrift, roter linker Rand — analog zum Stil der Stage-Fehler-Logs in der Pipeline-Ansicht
- Footer: Info was analysiert wurde (z.B. "Analysiert: Test-Stage Log + Jenkinsfile") + "Neu analysieren"-Button

Design folgt den Orbit-Prinzipien: Stone/Violet/Amber/Red Farbsystem, Dark Mode via CSS Tokens, ADHD-freundlich (klare visuelle Trennung, sofort erfassbar).

## Settings & Konfigurationscheck

Die Build-Analyse benötigt eine konfigurierte Vertex AI Verbindung. Das Verhalten orientiert sich am bestehenden CoSi Review:

- **Vertex AI nicht konfiguriert:** Im KI-Analyse-Bereich wird statt der Analyse ein Hinweis angezeigt: "Vertex AI ist nicht konfiguriert" + Button "Einstellungen öffnen" (navigiert zu Settings → Connections → Vertex AI). Kein automatischer Analyse-Start.
- **Prüfung:** `BuildAnalysisService` prüft `settings.connections.vertexAi.url` — ist die URL leer, wird `state` auf `'not-configured'` gesetzt.
- **Kein neues Feature-Flag nötig:** Die Build-Analyse ist automatisch verfügbar wenn Vertex AI konfiguriert ist. Kein separater `features.aiBuildAnalysis.enabled`-Toggle — das Feature hängt an der Vertex AI Verbindung.

### UI-Zustand ergänzt

| Zustand            | Darstellung                                                                |
| ------------------ | -------------------------------------------------------------------------- |
| Nicht konfiguriert | Hinweis "Vertex AI ist nicht konfiguriert" + Button "Einstellungen öffnen" |

## Mock-Server

### Jenkins Mock (`mock-server/jenkins.js`)

Neuer Endpunkt für config.xml:

- `GET /job/{jobName}/config.xml` — gibt eine statische XML-Antwort zurück mit:
  - `GitBrowserSCMSourceTrait > browser > url` → Mock-Bitbucket-URL (z.B. `http://localhost:6203/projects/PROJ/repos/my-repo/`)
  - `factory > scriptPath` → `Jenkinsfile`
- Damit kann der config.xml-Parsing-Code auch lokal gegen den Mock getestet werden.

### Bitbucket Mock (`mock-server/bitbucket.js`)

Neuer Endpunkt für Jenkinsfile-Inhalte:

- `GET /rest/api/1.0/projects/{proj}/repos/{repo}/browse/Jenkinsfile` — gibt ein realistisches Mock-Jenkinsfile zurück (mehrstufige Pipeline mit Checkout, Build, Test, Deploy Stages).

### AI Mock (`server/ai-mock.js`)

Neues Mock-Szenario für Build-Analyse (analog zu den bestehenden Review-Szenarien):

- Wird ausgelöst wenn `vertexAi.url` leer ist und der `/api/ai/build-analysis` Endpunkt aufgerufen wird.
- Gibt ein realistisches `BuildAnalysisResult` zurück mit simulierter Verzögerung (~2s).
- Mindestens 2-3 verschiedene Szenarien (z.B. npm-Fehler, Test-Fehler, Deploy-Fehler) die zufällig ausgewählt werden.

## Dateien

**Neu:**

- `src/app/builds/build-analysis.service.ts` — Service mit HTTP-Call, Cache, State-Signale
- `src/app/builds/build-analysis/build-analysis.ts` — UI-Komponente für die Analyse-Darstellung
- `server/routes/build-analysis-routes.js` — Express-Route für `/api/ai/build-analysis`
- `server/build-analysis.js` — Orchestrierung: config.xml-Parsing, Jenkinsfile-Laden, Prompt-Bau, Vertex AI Call

**Bestehend (zu modifizieren):**

- `src/app/builds/build-detail/build-detail.ts` + `.html` — Integration der `BuildAnalysisComponent`
- `src/app/builds/jenkins.model.ts` — Neue Interfaces für `BuildAnalysisResult`
- `server/app.js` — Neue Route registrieren
- `mock-server/jenkins.js` — config.xml Endpunkt ergänzen
- `mock-server/bitbucket.js` — Jenkinsfile-Browse Endpunkt ergänzen
- `server/ai-mock.js` — Build-Analyse Mock-Szenarien ergänzen

## Verifikation

1. **Manuell:** Fehlgeschlagenen Build im Mock-Server anlegen, Build-Detail öffnen, KI-Analyse prüfen
2. **Fallback testen:** Bitbucket-Verbindung unterbrechen → Analyse muss trotzdem laufen (ohne Jenkinsfile)
3. **Cache testen:** Zwischen Builds hin- und her wechseln → bereits analysierte Builds zeigen sofort Ergebnis
4. **Retry testen:** "Neu analysieren" klickt → frischer Request
5. **Unit Tests:** Service-Logik (Cache, State-Übergänge), config.xml-Parsing
6. **Nicht konfiguriert testen:** Vertex AI URL leer → Hinweis mit Settings-Button statt Analyse
7. **Mock-Server testen:** Orbit mit Mock-Servern starten → fehlgeschlagenen Build öffnen → Mock-Analyse-Ergebnis wird angezeigt
