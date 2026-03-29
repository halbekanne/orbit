# Jenkins Builds View — Design Spec

## Ziel

Zwei Deliverables im Ordner `docs/jenkins-integration-reference/`:

1. **UI-Prototyp** (HTML) — Vollständiger, interaktiver Prototyp der Builds View mit Light/Dark Mode, klickbaren Elementen und Mock-Daten für alle relevanten Zustände
2. **Jenkins-Integration-Guide.md** — Referenz-Guide mit allen API-Erkenntnissen, Endpoints, Datenformaten und Links zu externer Dokumentation

Kein Produktivcode wird geändert. Alles liegt in `docs/jenkins-integration-reference/`.

---

## Deliverable 1: UI-Prototyp

### Dateistruktur

```
docs/jenkins-integration-reference/
├── prototype.html          # Hauptdatei: vollständiger interaktiver Prototyp
├── prototype.css           # Styles (Orbit Design Tokens, Light/Dark Mode)
└── prototype.js            # Interaktionslogik (Tab-Wechsel, Expand/Collapse, State-Switching)
```

Alternativ eine einzelne self-contained HTML-Datei falls das einfacher ist — Hauptsache man kann sie direkt im Browser öffnen.

### Inhalt des Prototyps

#### Gesamtlayout
- Orbit App-Shell angedeutet (Rail links mit "Builds" aktiv)
- Master-Detail: Branch-Sidebar (300px) + Detail-Bereich (flex)

#### Branch-Sidebar
- Suchfeld oben
- Zwei Repo-Gruppen als Sections ("frontend-app", "backend-api")
- Branches als Cards mit: Branch-Name (monospace), Status-Badge, Build-Nummer, Zeitangabe, Mini-Stage-Bar
- PR-Badge (violet) bei Branches mit offenem PR
- Sortierung: Fehlgeschlagen → Laufend → Erfolgreich
- Kein Dimming, alle Branches gleiche Opacity
- Klick auf Branch wechselt den Detail-Bereich
- "X weitere Branches" Hinweis unten (für Branches ohne Build in letzten 4 Wochen)

#### Detail-Bereich — Übersicht-Tab
- **Header**: Branch-Name, Repo, Build-Nummer, Zeitpunkt, Dauer, Aktions-Buttons ("Neu starten", "Jenkins öffnen")
- **Tabs**: Übersicht | Log | Artefakte
- **Beschreibung** (Collapsible Section): Deploy-Links klickbar + Kopier-Button
- **KI-Analyse** (Collapsible Section, nur bei Fehler): Ursache, Einschätzung, Nächste Schritte, Beta-Badge, "Neu analysieren"-Button
- **Pipeline** (Collapsible Section): Flache Stage-Timeline ohne Verbindungslinie
  - Pro Stage: Status-Icon (22px, rund), Name, Dauer
  - Fehlgeschlagene Stage: Error-Log-Ausschnitt direkt sichtbar, roter Balken links an Error-Zeilen
  - Laufende Stage: Pulsierendes Icon, "seit X Min."
  - Übersprungene Stage: Gedimmt
  - Erfolgreiche Stage: Kompakt, nur Name + Dauer

#### Detail-Bereich — Log-Tab
- **Vollständiges Console-Log**: Zeigt das gesamte Build-Log (via `consoleText` API), nicht einzelne Stage-Logs. Entspricht dem "Console Output" in Jenkins.
- **Toolbar**: Suchfeld, "Vollständig in Jenkins"-Link
- **Log-Zeilen**: Zeilennummern, Monospace-Font, durchgängig nummeriert
  - ANSI-Farbcodes dargestellt (im Prototyp simuliert mit farbigen Spans)
  - Orbit Pattern-Matching: Roter Balken links bei Zeilen die ERROR/Exception/FAILED enthalten (unabhängig von ANSI-Farben)
- **Hinweis**: Per-Stage-Logs (wfapi) werden nur für die Fehler-Ausschnitte in der Stage-Timeline des Übersicht-Tabs genutzt, nicht im Log-Tab.

#### Detail-Bereich — Artefakte-Tab
- **Tree-View**: Ordnerstruktur aus relativePath rekonstruiert
  - Ordner: Expand/Collapse, Dateianzahl, ZIP-Download-Button
  - Dateien: Icon (nach Dateiendung), Name in Monospace, Größe, klickbar zum Öffnen (Jenkins-URL)
  - Verschachtelte Ordner
  - Root-Dateien unten
- Zusammenfassung: Dateianzahl, Ordneranzahl, Gesamtgröße

#### Build neustarten — Dialog
- Modal/Overlay über dem Detail-Bereich
- Header: "Build neu starten" + Branch-Name
- Dynamisches Formular mit verschiedenen Parameter-Typen:
  - Boolean → Toggle-Switch
  - Choice → Dropdown
  - String → Text-Input
  - Text → Textarea
  - Password → Password-Input
- Defaults vorausgefüllt
- Footer: Abbrechen / Starten (violet)
- Mindestens 3-4 verschiedene Parameter-Typen im Mock

#### Zustände die abgebildet sein müssen
- **Erfolgreicher Build**: Beschreibung mit Links, alle Stages grün, keine KI-Analyse
- **Fehlgeschlagener Build**: KI-Analyse sichtbar, fehlgeschlagene Stage mit Error-Log
- **Laufender Build**: Pulsierende aktuelle Stage, ausstehende Stages gedimmt, "Abbrechen" statt "Neu starten", Beschreibung evtl. leer

Alle drei Zustände sollen über die Branch-Sidebar erreichbar sein (verschiedene Branches anklicken).

#### Light/Dark Mode
- Toggle-Switch im Prototyp (z.B. oben rechts)
- CSS Custom Properties analog zu Orbits `tokens.css`
- Dark Mode = Default (wie in den Wireframes entwickelt)
- Light Mode = angepasste Farben die dem Orbit Design System entsprechen (warm/stone-Familie)

#### Design-System-Treue
- Farben: stone (neutral), violet (primary), amber (attention/signal), emerald (success), red (error), blue (info/links)
- Keine anderen Paletten
- Collapsible Sections im Stil von `app-collapsible-section` (rounded-xl, border, chevron, uppercase label)
- Cards: rounded-lg, subtle border, no colored backgrounds
- Attention-State: border-left-4 für fehlgeschlagene Branches in Sidebar

---

## Deliverable 2: Jenkins-Integration-Guide.md

### Datei

```
docs/jenkins-integration-reference/Jenkins-Integration-Guide.md
```

### Inhalt

#### 1. Übersicht
- Welche Jenkins-APIs verfügbar sind (wfapi, Standard Remote API)
- Welche NICHT verfügbar sind (Blue Ocean REST API, Pipeline Graph View Plugin) und was das bedeutet
- Authentifizierung (API Token, kein Crumb nötig)

#### 2. Endpoints-Referenz

Für jeden Use Case eine Tabelle mit: Endpoint-URL, HTTP-Methode, Query-Parameter, Response-Format (JSON-Beispiel).

Use Cases:
- Branches eines Multibranch-Jobs auflisten
- Builds eines Branches auflisten (mit Pagination via Range)
- Build-Details abrufen (Beschreibung, Ergebnis, Dauer, Parameter)
- Pipeline-Stages abrufen (wfapi)
- Stage-Detail + Error-Message abrufen
- Stage-Log abrufen
- Vollständiges Console-Log abrufen (plain text + progressive)
- Artefakte auflisten
- Artefakte herunterladen (einzeln + Ordner als ZIP)
- Build triggern (ohne und mit Parametern)
- Parameter-Definitionen eines Jobs abrufen

#### 3. Datenmodelle
- Run-Objekt (wfapi)
- Stage-Objekt (wfapi)
- StageFlowNode mit Error-Objekt
- Log-Response (nodeId, nodeStatus, length, hasMore, text)
- Artifact-Objekt (id, name, path, url, size)
- Parameter-Definitionen (Typen, Felder, Defaults)

#### 4. Bekannte Einschränkungen
- Stages sind flach — keine Parallel-Erkennung ohne Pipeline Graph View Plugin
- Artifacts-Liste limitiert auf ~5000 Dateien
- stageFlowNodes limitiert auf 100 pro Stage
- wfapi/describe kann bei komplexen Pipelines langsam sein
- Build-Beschreibung kann HTML enthalten (muss sanitized werden)

#### 5. Frontend-Implementierungshinweise
- ANSI-Parsing: `ansi_up` Library (v6+, zero deps, TypeScript, `use_classes` Mode)
- Error-Pattern-Matching: Regex-Patterns für ERROR, WARN, Exception, FAILED
- Tree-View-Rekonstruktion: relativePath an "/" splitten
- Polling-Strategie für laufende Builds
- Proxy-Route über Orbit BFF (wie Jira/Bitbucket)

#### 6. Links zu externen Referenzen
- Pipeline REST API Plugin (wfapi) GitHub README
- Jenkins Remote Access API Dokumentation
- Jenkins CSRF Protection Dokumentation
- StatusExt Enum (Javadoc)
- Parameter-Definitions (Javadoc)
- ansi_up GitHub Repository

---

## Spec Self-Review Checklist

- [ ] Keine TBDs oder TODOs
- [ ] Prototyp deckt alle drei Build-Zustände ab
- [ ] Alle UI-Elemente aus den Wireframes sind im Prototyp spezifiziert
- [ ] Guide deckt alle Endpoints ab die der Prototyp braucht
- [ ] Keine Features designed die die API nicht liefern kann
- [ ] Light + Dark Mode spezifiziert
