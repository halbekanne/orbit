# Jenkins Integration Guide

## 1. Übersicht

### Verfügbare APIs

Orbit nutzt zwei Jenkins-APIs:

| API | Basis-Pfad | Zweck |
|-----|-----------|-------|
| **Standard Jenkins Remote Access API** | `/api/json` | Branches, Builds, Artefakte, Parameter, Build-Trigger |
| **Pipeline REST API (wfapi)** | `/wfapi/...` | Pipeline-Stages, Stage-Logs, Stage-Fehler |

### Nicht verfügbar

- **Blue Ocean REST API** — nicht installiert, kann nicht genutzt werden
- **Pipeline Graph View Plugin** — nicht installiert

Ohne Pipeline Graph View Plugin gibt es keine Möglichkeit, parallele Stages zu erkennen. Die wfapi liefert Stages als flache Liste — auch wenn das Jenkinsfile `parallel` Blöcke enthält, erscheinen die Stages sequentiell ohne Verschachtelung.

### Authentifizierung

Jenkins nutzt API-Token-basierte Authentifizierung:

```
curl --user USERNAME:API_TOKEN https://jenkins.example.com/job/my-project/api/json
```

Seit Jenkins 2.96+ sind API-Token-Requests von CSRF/Crumb-Anforderungen ausgenommen. Es ist kein Crumb-Header nötig.

### Base-URL-Pattern für Multibranch Pipelines

```
/job/{multibranch-job}/job/{branch}/...
```

Branch-Namen mit `/` oder Leerzeichen usw. (z.B. `feature/foo`) werden URL-encoded: `feature%2Ffoo`.

---

## 2. Endpoints-Referenz

### Branches auflisten

```
GET /job/{mb-job}/api/json?tree=jobs[name,color,url]
```

**Response:**

```json
{
  "jobs": [
    {
      "name": "main",
      "color": "blue",
      "url": "https://jenkins.example.com/job/my-project/job/main/"
    },
    {
      "name": "feature%2Flogin",
      "color": "red",
      "url": "https://jenkins.example.com/job/my-project/job/feature%2Flogin/"
    },
    {
      "name": "develop",
      "color": "blue_anime",
      "url": "https://jenkins.example.com/job/my-project/job/develop/"
    }
  ]
}
```

**`color`-Mapping:**

| color | Bedeutung |
|-------|-----------|
| `blue` | SUCCESS |
| `red` | FAILURE |
| `yellow` | UNSTABLE |
| `aborted` | ABORTED |
| `notbuilt` | NOT_BUILT |
| `disabled` | Deaktiviert |
| `blue_anime` | SUCCESS, läuft gerade |
| `red_anime` | FAILURE, läuft gerade |
| `yellow_anime` | UNSTABLE, läuft gerade |

Suffix `_anime` = Build läuft gerade auf diesem Branch.

---

### Builds eines Branches auflisten

```
GET /job/{mb-job}/job/{branch}/api/json?tree=builds[number,result,timestamp,duration,url]{0,20}
```

Range-Specifier `{0,20}` liefert die ersten 20 Einträge (Index 0 bis exklusive 20). Für die nächste Seite: `{20,40}`.

**Response:**

```json
{
  "builds": [
    {
      "number": 142,
      "result": "SUCCESS",
      "timestamp": 1711612800000,
      "duration": 245832,
      "url": "https://jenkins.example.com/job/my-project/job/main/142/"
    },
    {
      "number": 141,
      "result": "FAILURE",
      "timestamp": 1711526400000,
      "duration": 89234,
      "url": "https://jenkins.example.com/job/my-project/job/main/141/"
    }
  ]
}
```

`result` ist `null` für laufende Builds.

---

### Build-Details

```
GET /job/{mb-job}/job/{branch}/{buildNumber}/api/json?tree=description,result,duration,timestamp,building,estimatedDuration,number,url,actions[parameters[name,value]]
```

**Response:**

```json
{
  "number": 142,
  "result": "SUCCESS",
  "duration": 245832,
  "timestamp": 1711612800000,
  "building": false,
  "estimatedDuration": 230000,
  "description": "<b>Release 2.4.1</b> — deployed to staging",
  "url": "https://jenkins.example.com/job/my-project/job/main/142/",
  "actions": [
    {
      "_class": "hudson.model.ParametersAction",
      "parameters": [
        { "name": "DEPLOY_ENV", "value": "staging" },
        { "name": "DRY_RUN", "value": "false" }
      ]
    },
    {
      "_class": "hudson.model.CauseAction"
    }
  ]
}
```

- `description` enthält HTML und muss sanitized werden
- `building: true` zeigt an, dass der Build noch läuft
- Parameter stecken in der Action mit `_class: "hudson.model.ParametersAction"` — andere Actions im Array ignorieren

---

### Pipeline-Stages (wfapi)

```
GET /job/{mb-job}/job/{branch}/{buildNumber}/wfapi/describe
```

**Response:**

```json
{
  "id": "142",
  "name": "#142",
  "status": "SUCCESS",
  "startTimeMillis": 1711612800000,
  "endTimeMillis": 1711613045832,
  "durationMillis": 245832,
  "stages": [
    {
      "id": "6",
      "name": "Checkout",
      "status": "SUCCESS",
      "startTimeMillis": 1711612800000,
      "durationMillis": 3200,
      "execNode": ""
    },
    {
      "id": "14",
      "name": "Build",
      "status": "SUCCESS",
      "startTimeMillis": 1711612803200,
      "durationMillis": 120000,
      "execNode": ""
    },
    {
      "id": "27",
      "name": "Test",
      "status": "FAILED",
      "startTimeMillis": 1711612923200,
      "durationMillis": 85000,
      "execNode": ""
    },
    {
      "id": "45",
      "name": "Deploy",
      "status": "NOT_EXECUTED",
      "startTimeMillis": 1711613008200,
      "durationMillis": 0,
      "execNode": ""
    }
  ]
}
```

**Status-Werte:**

| Status | Bedeutung |
|--------|-----------|
| `SUCCESS` | Erfolgreich |
| `FAILED` | Fehlgeschlagen |
| `IN_PROGRESS` | Läuft gerade |
| `PAUSED_PENDING_INPUT` | Wartet auf manuelle Eingabe |
| `NOT_EXECUTED` | Nicht ausgeführt (z.B. wegen vorherigem Fehler) |

---

### Stage-Detail + Error

```
GET /job/{mb-job}/job/{branch}/{buildNumber}/execution/node/{nodeId}/wfapi/describe
```

**Response:**

```json
{
  "id": "27",
  "name": "Test",
  "status": "FAILED",
  "startTimeMillis": 1711612923200,
  "durationMillis": 85000,
  "stageFlowNodes": [
    {
      "id": "28",
      "name": "Shell Script",
      "status": "SUCCESS",
      "parameterDescription": "npm run lint",
      "startTimeMillis": 1711612923200,
      "durationMillis": 12000,
      "parentNodes": ["27"]
    },
    {
      "id": "31",
      "name": "Shell Script",
      "status": "FAILED",
      "parameterDescription": "npm test",
      "startTimeMillis": 1711612935200,
      "durationMillis": 73000,
      "parentNodes": ["28"],
      "error": {
        "message": "script returned exit code 1",
        "type": "hudson.AbortException"
      }
    }
  ]
}
```

`parentNodes` verweist auf die vorherigen Nodes innerhalb der Stage.

---

### Vollständiges Console-Log (primär — für den Log-Tab)

Der Log-Tab in Orbit zeigt das **vollständige Console-Log** des Builds, nicht einzelne Stage-Logs. Das entspricht dem, was man in Jenkins unter "Console Output" sieht.

**Plain Text (gesamter Log auf einmal):**

```
GET /job/{mb-job}/job/{branch}/{buildNumber}/consoleText
```

Gibt `text/plain` zurück.

**Progressive (für Streaming/Polling):**

```
GET /job/{mb-job}/job/{branch}/{buildNumber}/logText/progressiveText?start=0
```

Response-Headers:

| Header | Wert | Bedeutung |
|--------|------|-----------|
| `X-Text-Size` | `48832` | Byte-Offset für den nächsten Request |
| `X-More-Data` | `true` | `true` solange der Build läuft |

Nächster Request: `?start=48832`. Wiederholen bis `X-More-Data` nicht mehr `true` ist.

---

### Stage-Log (sekundär — für Fehler-Ausschnitte im Übersicht-Tab)

Per-Stage-Logs werden nur für die Fehler-Ausschnitte in der Stage-Timeline des Übersicht-Tabs genutzt — nicht für den Log-Tab.

```
GET /job/{mb-job}/job/{branch}/{buildNumber}/execution/node/{nodeId}/wfapi/log
```

**Response:**

```json
{
  "nodeId": "31",
  "nodeStatus": "FAILED",
  "length": 14523,
  "hasMore": false,
  "text": "<span class=\"pipeline-node-31\">FAIL src/app/login.spec.ts\n  ● Login component › should validate email\n    Expected: true\n    Received: false\n</span>",
  "consoleUrl": "/job/my-project/job/main/142/execution/node/31/log"
}
```

`text` enthält HTML mit ANSI-Escape-Codes. `hasMore: true` bedeutet, dass der Log abgeschnitten wurde.

---

### Artefakte auflisten

**wfapi-Variante:**

```
GET /job/{mb-job}/job/{branch}/{buildNumber}/wfapi/artifacts
```

```json
[
  {
    "id": "artifact-1",
    "name": "app.jar",
    "path": "target/app.jar",
    "url": "/job/my-project/job/main/142/artifact/target/app.jar",
    "size": 15728640
  },
  {
    "id": "artifact-2",
    "name": "test-report.html",
    "path": "reports/test-report.html",
    "url": "/job/my-project/job/main/142/artifact/reports/test-report.html",
    "size": 84320
  }
]
```

**Standard-API-Variante:**

```
GET /job/{mb-job}/job/{branch}/{buildNumber}/api/json?tree=artifacts[displayPath,fileName,relativePath]
```

```json
{
  "artifacts": [
    {
      "displayPath": "app.jar",
      "fileName": "app.jar",
      "relativePath": "target/app.jar"
    },
    {
      "displayPath": "test-report.html",
      "fileName": "test-report.html",
      "relativePath": "reports/test-report.html"
    }
  ]
}
```

Die Standard-API liefert keine Dateigrößen und keine Verzeichniseinträge — nur Leaf-Files. Die Liste ist bei ca. 5000 Dateien abgeschnitten (konfigurierbar über `hudson.model.Run.ArtifactList.listMax`).

---

### Artefakte herunterladen

**Einzelne Datei:**

```
GET /job/{mb-job}/job/{branch}/{buildNumber}/artifact/{relativePath}
```

**Verzeichnis als ZIP:**

```
GET /job/{mb-job}/job/{branch}/{buildNumber}/artifact/{directory}/*zip*/archive.zip
```

**Alle Artefakte als ZIP:**

```
GET /job/{mb-job}/job/{branch}/{buildNumber}/artifact/*zip*/archive.zip
```

---

### Build triggern

**Ohne Parameter:**

```
POST /job/{mb-job}/job/{branch}/build
```

**Mit Parametern:**

```
POST /job/{mb-job}/job/{branch}/buildWithParameters
Content-Type: application/x-www-form-urlencoded

DEPLOY_ENV=staging&DRY_RUN=false
```

```bash
curl -X POST --user USER:TOKEN \
  --data "DEPLOY_ENV=staging" \
  --data "DRY_RUN=false" \
  https://jenkins.example.com/job/my-project/job/main/buildWithParameters
```

**Response:** `201 Created` mit `Location`-Header, der auf die Queue-URL verweist:

```
Location: https://jenkins.example.com/queue/item/12345/
```

---

### Parameter-Definitionen abrufen

```
GET /job/{mb-job}/job/{branch}/api/json?tree=property[parameterDefinitions[name,type,description,defaultParameterValue[value],choices]]
```

**Response:**

```json
{
  "property": [
    {
      "parameterDefinitions": [
        {
          "name": "DEPLOY_ENV",
          "type": "ChoiceParameterDefinition",
          "description": "Target environment",
          "defaultParameterValue": { "value": "staging" },
          "choices": ["staging", "production"]
        },
        {
          "name": "DRY_RUN",
          "type": "BooleanParameterDefinition",
          "description": "Skip actual deployment",
          "defaultParameterValue": { "value": true }
        },
        {
          "name": "VERSION",
          "type": "StringParameterDefinition",
          "description": "Version to deploy",
          "defaultParameterValue": { "value": "" }
        },
        {
          "name": "RELEASE_NOTES",
          "type": "TextParameterDefinition",
          "description": "Release notes",
          "defaultParameterValue": { "value": "" }
        },
        {
          "name": "SECRET_KEY",
          "type": "PasswordParameterDefinition",
          "description": "Deployment secret",
          "defaultParameterValue": { "value": "" }
        }
      ]
    }
  ]
}
```

**Parameter-Typen:**

| `type` | UI-Element | Besonderheiten |
|--------|-----------|----------------|
| `StringParameterDefinition` | Text-Input | |
| `BooleanParameterDefinition` | Toggle | `value` ist boolean |
| `ChoiceParameterDefinition` | Dropdown | Hat `choices`-Array |
| `TextParameterDefinition` | Textarea | |
| `PasswordParameterDefinition` | Password-Input | Default ist immer redacted |

`property` ist ein Array — die `parameterDefinitions` können in jedem Element stecken. Nur das Element filtern, das `parameterDefinitions` enthält.

---

## 3. Datenmodelle

```typescript
interface JenkinsBranch {
  name: string;
  color: string;
  url: string;
}

interface JenkinsBuild {
  number: number;
  result: 'SUCCESS' | 'FAILURE' | 'UNSTABLE' | 'ABORTED' | 'NOT_BUILT' | null;
  timestamp: number;
  duration: number;
  url: string;
}

interface JenkinsBuildDetail {
  number: number;
  result: 'SUCCESS' | 'FAILURE' | 'UNSTABLE' | 'ABORTED' | 'NOT_BUILT' | null;
  duration: number;
  timestamp: number;
  building: boolean;
  estimatedDuration: number;
  description: string | null;
  url: string;
  actions: JenkinsBuildAction[];
}

interface JenkinsBuildAction {
  _class: string;
  parameters?: JenkinsBuildParameter[];
}

interface JenkinsBuildParameter {
  name: string;
  value: string | boolean | number;
}

interface JenkinsRun {
  id: string;
  name: string;
  status: JenkinsStageStatus;
  startTimeMillis: number;
  endTimeMillis: number;
  durationMillis: number;
  stages: JenkinsStage[];
}

type JenkinsStageStatus =
  | 'SUCCESS'
  | 'FAILED'
  | 'IN_PROGRESS'
  | 'PAUSED_PENDING_INPUT'
  | 'NOT_EXECUTED';

interface JenkinsStage {
  id: string;
  name: string;
  status: JenkinsStageStatus;
  startTimeMillis: number;
  durationMillis: number;
  execNode: string;
}

interface JenkinsStageDetail {
  id: string;
  name: string;
  status: JenkinsStageStatus;
  startTimeMillis: number;
  durationMillis: number;
  stageFlowNodes: JenkinsStageFlowNode[];
}

interface JenkinsStageFlowNode {
  id: string;
  name: string;
  status: JenkinsStageStatus;
  parameterDescription: string;
  startTimeMillis: number;
  durationMillis: number;
  parentNodes: string[];
  error?: JenkinsStageError;
}

interface JenkinsStageError {
  message: string;
  type: string;
}

interface JenkinsStageLog {
  nodeId: string;
  nodeStatus: string;
  length: number;
  hasMore: boolean;
  text: string;
  consoleUrl: string;
}

interface JenkinsArtifact {
  id: string;
  name: string;
  path: string;
  url: string;
  size: number;
}

type JenkinsParameterDefinition =
  | JenkinsStringParameter
  | JenkinsBooleanParameter
  | JenkinsChoiceParameter
  | JenkinsTextParameter
  | JenkinsPasswordParameter;

interface JenkinsParameterBase {
  name: string;
  description: string;
}

interface JenkinsStringParameter extends JenkinsParameterBase {
  type: 'StringParameterDefinition';
  defaultParameterValue: { value: string };
}

interface JenkinsBooleanParameter extends JenkinsParameterBase {
  type: 'BooleanParameterDefinition';
  defaultParameterValue: { value: boolean };
}

interface JenkinsChoiceParameter extends JenkinsParameterBase {
  type: 'ChoiceParameterDefinition';
  defaultParameterValue: { value: string };
  choices: string[];
}

interface JenkinsTextParameter extends JenkinsParameterBase {
  type: 'TextParameterDefinition';
  defaultParameterValue: { value: string };
}

interface JenkinsPasswordParameter extends JenkinsParameterBase {
  type: 'PasswordParameterDefinition';
  defaultParameterValue: { value: string };
}
```

---

## 4. Bekannte Einschränkungen

| Einschränkung | Detail |
|---------------|--------|
| **Keine parallelen Stages** | Ohne Pipeline Graph View Plugin sind Stages immer flach. Parallele Stages erscheinen sequentiell in der Liste. |
| **Artefakt-Limit** | Die Standard-API listet maximal ~5000 Artefakte. Konfigurierbar über System Property `hudson.model.Run.ArtifactList.listMax`. |
| **stageFlowNodes-Limit** | Maximal 100 FlowNodes pro Stage. Konfigurierbar über System Property `com.cloudbees.workflow.rest.external.FlowNodeExt.describeMax`. |
| **wfapi/describe Performance** | Kann bei komplexen Pipelines mit vielen Stages langsam sein. |
| **HTML in description** | Das `description`-Feld eines Builds kann beliebiges HTML enthalten und muss vor der Anzeige sanitized werden. |
| **wfapi/runs Pagination** | Nutzt den `since`-Parameter (Run-Name), kein Offset/Limit. |

---

## 5. Frontend-Implementierungshinweise

### ANSI-Parsing

Library: [`ansi_up`](https://github.com/drudru/ansi_up) (v6+, zero dependencies, TypeScript)

```typescript
import AnsiUp from 'ansi_up';

const ansi = new AnsiUp();
ansi.use_classes = true;
const html = ansi.ansi_to_html(rawLogText);
```

`use_classes = true` erzeugt CSS-Klassen statt Inline-Styles. Die zugehörigen CSS-Klassen (`ansi-red-fg`, `ansi-green-fg`, etc.) müssen einmal global definiert werden.

### Error-Pattern-Matching

Regex-Patterns für Log-Zeilen:

```typescript
const ERROR_PATTERNS = [
  /\bERROR\b/,
  /\bWARN(?:ING)?\b/,
  /\bException\b/,
  /\bFAILED\b/,
];
```

Fehlerzeilen mit rotem Left-Border markieren (`border-l-2 border-red-500`). Die Textfarbe nicht ändern, damit ANSI-Farben erhalten bleiben.

### Artefakt-Tree-View

`relativePath` an `"/"` splitten, um eine Verzeichnisstruktur aufzubauen:

```
target/app.jar          → target / app.jar
reports/test-report.html → reports / test-report.html
reports/coverage/index.html → reports / coverage / index.html
```

### Polling-Strategie für laufende Builds

Solange `building === true`:

1. `wfapi/describe` alle N Sekunden pollen (empfohlen: 3-5s)
2. Stage-Status und -Dauer aktualisieren
3. Polling stoppen, wenn `status !== 'IN_PROGRESS'`

Für Console-Log-Streaming: `progressiveText` mit `start`-Parameter nutzen.

### Proxy-Route durch Orbit BFF

Jenkins-Requests über den Express BFF routen (gleiche Pattern wie Jira/Bitbucket):

```
Angular SPA → Express BFF (/api/jenkins/...) → Jenkins API
```

Der BFF injiziert die Authentifizierung und vermeidet CORS-Probleme.

### `tree`-Parameter

Den `tree`-Parameter auf der Standard-API konsequent nutzen, um die Response-Größe zu minimieren. Ohne `tree` liefert Jenkins die vollständige JSON-Repräsentation, die bei Builds mit vielen Actions mehrere hundert KB groß sein kann.

---

## 6. Externe Referenzen

- [Pipeline REST API Plugin (wfapi)](https://github.com/jenkinsci/pipeline-stage-view-plugin/blob/master/rest-api/README.md)
- [Jenkins Remote Access API](https://www.jenkins.io/doc/book/using/remote-access-api/)
- [Jenkins CSRF Protection](https://www.jenkins.io/doc/book/security/csrf-protection/)
- [StatusExt Enum (Javadoc)](https://javadoc.jenkins.io/plugin/pipeline-rest-api/com/cloudbees/workflow/rest/external/StatusExt.html)
- [ParameterDefinition (Javadoc)](https://javadoc.jenkins.io/hudson/model/ParameterDefinition.html)
- [ansi_up](https://github.com/drudru/ansi_up)
- [Taming the Jenkins JSON API (CloudBees)](https://www.cloudbees.com/blog/taming-jenkins-json-api-depth-and-tree)
