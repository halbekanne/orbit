const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 6202;

app.use(cors());
app.use(express.json());

app.use((_req, _res, next) => {
  setTimeout(next, 3000);
});

const BASE = `http://localhost:${PORT}`;

const makeUser = (username, displayName, email) => ({
  self: `${BASE}/rest/api/2/user?username=${username}`,
  name: username,
  key: username,
  emailAddress: email,
  avatarUrls: { '48x48': '', '32x32': '', '24x24': '', '16x16': '' },
  displayName,
  active: true,
  timeZone: 'Europe/Berlin',
});

const U1 = makeUser('1', 'Anna Bergmann', 'anna.bergmann@example.org');
const U2 = makeUser('2', 'Michael Braun', 'michael.braun@example.org');
const U3 = makeUser('3', 'Elena Fischer', 'elena.fischer@example.org');
const U4 = makeUser('4', 'David Krause', 'david.krause.extern@example.org');
const U5 = makeUser('5', 'Carla Hoffmann', 'carla.hoffmann@example.org');
const UNASSIGNED = makeUser('nicht_zugeordnet', 'Nicht zugeordnet', 'team@example.org');

const mockUser = U1;

const PROJ_DASH = {
  self: `${BASE}/rest/api/2/project/22364`,
  id: '22364',
  key: 'DASH',
  name: 'Dashboard-Bibliothek',
  projectTypeKey: 'software',
  avatarUrls: { '48x48': '', '32x32': '', '24x24': '', '16x16': '' },
};

const PROJ_INFRA = {
  self: `${BASE}/rest/api/2/project/27760`,
  id: '27760',
  key: 'INFRA',
  name: 'Plattform-Infrastruktur',
  projectTypeKey: 'software',
  avatarUrls: { '48x48': '', '32x32': '', '24x24': '', '16x16': '' },
};

const PROJ_TGLD = {
  self: `${BASE}/rest/api/2/project/28696`,
  id: '28696',
  key: 'TGLD',
  name: 'Technik-Gilde',
  projectTypeKey: 'software',
  avatarUrls: { '48x48': '', '32x32': '', '24x24': '', '16x16': '' },
};

const STATUS_IM_TEST = {
  self: `${BASE}/rest/api/2/status/10002`,
  description: '',
  iconUrl: '',
  name: 'Im Test',
  id: '10002',
  statusCategory: { self: '', id: 4, key: 'indeterminate', colorName: 'inprogress', name: 'In Arbeit' },
};

const STATUS_IN_BEARBEITUNG = {
  self: `${BASE}/rest/api/2/status/3`,
  description: '',
  iconUrl: '',
  name: 'In Bearbeitung',
  id: '3',
  statusCategory: { self: '', id: 4, key: 'indeterminate', colorName: 'inprogress', name: 'In Arbeit' },
};

const STATUS_IM_REVIEW = {
  self: `${BASE}/rest/api/2/status/10001`,
  description: '',
  iconUrl: '',
  name: 'Im Review',
  id: '10001',
  statusCategory: { self: '', id: 4, key: 'indeterminate', colorName: 'inprogress', name: 'In Arbeit' },
};

const STATUS_OFFEN = {
  self: `${BASE}/rest/api/2/status/1`,
  description: '',
  iconUrl: '',
  name: 'Offen',
  id: '1',
  statusCategory: { self: '', id: 2, key: 'new', colorName: 'default', name: 'Zu erledigen' },
};

const STATUS_GESCHLOSSEN = {
  self: `${BASE}/rest/api/2/status/6`,
  description: '',
  iconUrl: '',
  name: 'Geschlossen',
  id: '6',
  statusCategory: { self: '', id: 3, key: 'done', colorName: 'success', name: 'Fertig' },
};

const PRIO_BLOCKER = { self: '', id: '1', name: 'Blocker', iconUrl: '' };
const PRIO_KRITISCH = { self: '', id: '2', name: 'Kritisch', iconUrl: '' };
const PRIO_MITTEL = { self: '', id: '4', name: 'Mittel', iconUrl: '' };
const PRIO_NIEDRIG = { self: '', id: '5', name: 'Niedrig', iconUrl: '' };

const TYPE_FEHLER = { self: '', id: '10', name: 'Fehler', subtask: false, avatarId: 23023 };
const TYPE_AUFGABE = { self: '', id: '9', name: 'Aufgabe', subtask: false, avatarId: 23038 };
const TYPE_USER_STORY = { self: '', id: '20', name: 'User Story', subtask: false, avatarId: 23035 };

const makeComment = (id, author, body, created) => ({
  self: `${BASE}/rest/api/2/issue/comment/${id}`,
  id,
  author,
  body,
  updateAuthor: author,
  created,
  updated: created,
});

const makeAttachment = (id, filename, mimeType, author, created, size) => ({
  self: `${BASE}/rest/api/2/attachment/${id}`,
  id,
  filename,
  author,
  created,
  size,
  mimeType,
  content: `${BASE}/secure/attachment/${id}/${filename}`,
  thumbnail: mimeType.startsWith('image/') ? `${BASE}/secure/thumbnail/${id}/_thumb_${id}.png` : undefined,
});

const wrapComments = (comments) => ({
  comments,
  maxResults: 1000,
  total: comments.length,
  startAt: 0,
});

const mockIssues = [
  {
    id: '1531977',
    key: 'DASH-0842',
    self: `${BASE}/rest/api/2/issue/1531977`,
    fields: {
      issuetype: TYPE_FEHLER,
      project: PROJ_DASH,
      summary: '[DEV] Zeitreihen-Chart: Letzter Datenpunkt fehlt beim Wechsel des Zeitbereichsmodus',
      description: 'h2. Beschreibung\r\n\r\nBeim Wechsel zwischen relativem (z.\u00a0B. „Letzte 7\u00a0Tage") und absolutem Zeitbereich (benutzerdefiniertes Datum) wird der letzte Datenpunkt der Zeitreihe nicht dargestellt. Der Fehler tritt konsistent auf und betrifft alle Chart-Typen mit Zeitachse.\r\n\r\n*Warum Beschleunigt / Dringlich:* Konsumprojekt „Berichts-Portal" hat einen bevorstehenden Go-Live und der Fehler verfälscht Kennzahlen in Live-Dashboards.\r\n\r\n*Aktuelles Verhalten (IST):*\r\nDie Zeitfensterberechnung enthält einen Off-by-one-Fehler: Der letzte Zeitstempel des Intervalls wird als exklusiver Endpunkt behandelt und damit ausgeschlossen.\r\n\r\n*Erwartetes Verhalten (SOLL):*\r\nAlle Datenpunkte innerhalb des gewählten Zeitraums werden dargestellt, inklusive des letzten Zeitstempels.\r\n\r\nh2. Details\r\n\r\n*Browser/Umgebung:* alle\r\n\r\n*Lösungsvorschlag/Analyse:* Laut [~2] liegt der Fehler in der Hilfsfunktion zur Intervallberechnung im Chart-Datenservice. Die obere Grenze muss inklusiv behandelt werden.\r\n\r\nh2. Akzeptanzkriterien\r\n # Beim Wechsel zwischen relativem und absolutem Zeitbereich werden alle Datenpunkte korrekt dargestellt.\r\n # Zeitreihen mit einem einzigen Datenpunkt werden ebenfalls korrekt angezeigt.\r\n # Der Fehler ist durch einen automatisierten Test abgedeckt.',
      status: STATUS_IM_TEST,
      priority: PRIO_BLOCKER,
      assignee: U1,
      reporter: U1,
      creator: U1,
      created: '2026-03-03T11:49:44.000+0100',
      updated: '2026-03-13T14:41:21.000+0100',
      duedate: null,
      labels: [],
      components: [],
      comment: wrapComments([
        makeComment('12451474', U3, 'Stichprobenkontrolle Anforderungsbeschreibung durchgeführt', '2026-03-10T13:02:44.817+0100'),
      ]),
      attachment: [],
      subtasks: [],
      issuelinks: [],
      customfield_10014: null,
    },
  },
  {
    id: '1527513',
    key: 'DASH-0835',
    self: `${BASE}/rest/api/2/issue/1527513`,
    fields: {
      issuetype: TYPE_FEHLER,
      project: PROJ_DASH,
      summary: '[DEV] CSV-Export: Sonderzeichen in Spaltenwerten führen zu korrupten Dateien',
      description: 'h2. Beschreibung\r\n\r\nBeim Export von Tabellendaten als CSV werden Spalten, die Umlaute (ä, ö, ü) oder Semikolons enthalten, nicht korrekt kodiert. Die exportierte Datei kann in Excel und anderen Tabellenkalkulationen nicht fehlerfrei geöffnet werden.\r\n\r\n*Aktuelles Verhalten (IST):*\r\nSonderzeichen werden als Fragezeichen oder unlesbare Symbole ausgegeben. Semikolons in Zellwerten werden nicht escaped und führen zu falschen Spaltentrennungen.\r\n\r\n*Erwartetes Verhalten (SOLL):*\r\nDie exportierte CSV-Datei ist UTF-8-kodiert und hält den RFC-4180-Standard ein. Semikolons in Werten werden durch Anführungszeichen escaped.\r\n\r\nh2. Details\r\n\r\n*Browser/Umgebung:* Alle\r\n\r\n*Priorisierungs-Indikator*\r\n||Aspekt||Schätzung||Bemerkung||\r\n|Strategischer Wert (0–2)|1|Betrifft Nutzende, die Daten weiterverarbeiten|\r\n|Reichweite (0–2)|1|Export-Funktion in 45\u00a0% der Projekte, Fehlerfall seltener|\r\n|Dringlichkeit (0–2)|1|Workaround: Spalten vor Export manuell bereinigen|\r\n|Prio-Indikator|hoch|12–17: hoch|\r\n\r\nh2. Akzeptanzkriterien\r\n # Exportierte CSV-Dateien sind korrekt UTF-8-kodiert.\r\n # Semikolons und Anführungszeichen in Zellwerten werden gemäß RFC\u00a04180 escaped.\r\n # Die exportierte Datei lässt sich in Excel und LibreOffice fehlerfrei öffnen.',
      status: STATUS_IN_BEARBEITUNG,
      priority: PRIO_MITTEL,
      assignee: U2,
      reporter: U1,
      creator: U1,
      created: '2026-02-25T11:32:26.000+0100',
      updated: '2026-03-13T13:08:56.000+0100',
      duedate: null,
      labels: ['prioindikator:hoch'],
      components: [],
      comment: wrapComments([]),
      attachment: [
        makeAttachment('1029778', 'csv-export-fehler-screenshot.png', 'image/png', U1, '2026-02-25T11:31:15.997+0100', 13642),
      ],
      subtasks: [],
      issuelinks: [],
      customfield_10014: null,
    },
  },
  {
    id: '1527486',
    key: 'DASH-0831',
    self: `${BASE}/rest/api/2/issue/1527486`,
    fields: {
      issuetype: TYPE_FEHLER,
      project: PROJ_DASH,
      summary: '[DEV] Widget-Layout: Positionen gehen nach Browser-Refresh verloren',
      description: 'h2. Beschreibung\r\n\r\nWenn Nutzer die Anordnung von Widgets im Dashboard anpassen, gehen die gespeicherten Positionen nach einem Browser-Refresh verloren. Das Dashboard kehrt zur Standardanordnung zurück.\r\n\r\n*Aktuelles Verhalten (IST):*\r\nDie Grid-Positionen der Widgets werden beim Speichern nicht korrekt serialisiert. Nach dem Neuladen der Seite werden die Widgets in ihrer ursprünglichen Standardposition dargestellt.\r\n\r\n*Erwartetes Verhalten (SOLL):*\r\nVom Nutzer angepasste Widget-Positionen werden dauerhaft gespeichert und nach einem Seitenaufruf korrekt wiederhergestellt.\r\n\r\nh2. Details\r\n\r\n*Browser/Umgebung:* Alle\r\n\r\n*Lösungsvorschlag/Analyse:* Die Serialisierungsfunktion des Layout-Service überträgt die x/y-Koordinaten nicht vollständig in den Persistenzlayer.\r\n\r\n*Priorisierungs-Indikator*\r\n||Aspekt||Schätzung||Bemerkung||\r\n|Strategischer Wert (0–2)|2|Kern-Funktion, Nutzbarkeit essenziell|\r\n|Reichweite (0–2)|1|In 10 von 65 Projekten eingesetzt|\r\n|Dringlichkeit (0–2)|1|Workaround: Layout nach jedem Refresh neu anpassen|\r\n|Prio-Indikator|hoch|12–17: hoch|\r\n\r\nh2. Akzeptanzkriterien\r\n # Widget-Positionen werden nach einer Anpassung korrekt gespeichert.\r\n # Nach einem Browser-Refresh wird das zuletzt gespeicherte Layout wiederhergestellt.\r\n # Das Verhalten ist auch bei mehr als 20 Widgets stabil.',
      status: STATUS_IM_REVIEW,
      priority: PRIO_MITTEL,
      assignee: U2,
      reporter: U1,
      creator: U1,
      created: '2026-02-25T11:17:37.000+0100',
      updated: '2026-03-13T13:08:49.000+0100',
      duedate: null,
      labels: ['prioindikator:hoch'],
      components: [],
      comment: wrapComments([
        makeComment('12454670', U4, 'FYI [~5] – bitte mal anschauen, das betrifft auch euer Projekt.', '2026-03-12T15:03:20.260+0100'),
      ]),
      attachment: [],
      subtasks: [],
      issuelinks: [],
      customfield_10014: null,
    },
  },
  {
    id: '1525889',
    key: 'DASH-0824',
    self: `${BASE}/rest/api/2/issue/1525889`,
    fields: {
      issuetype: TYPE_AUFGABE,
      project: PROJ_DASH,
      summary: 'Live-Datenaktualisierung für Dashboards',
      description: 'h2. Beschreibung\r\n\r\nDashboards laden Daten aktuell ausschließlich beim initialen Seitenaufruf. Für Monitoring- und Echtzeit-Anwendungsfälle soll eine automatische Datenaktualisierung implementiert werden.\r\n\r\nh3. Details\r\n\r\nVoraussetzung: Fertigstellung von DASH-0785 (WebSocket-Infrastruktur).\r\n\r\nGeplante Implementierungsvarianten:\r\n * *Polling:* Konfigurierbares Intervall (z.\u00a0B. 30\u00a0s, 60\u00a0s) je Widget.\r\n * *WebSocket:* Push-basierte Aktualisierung bei Datenmutation im Backend.\r\n ** Priorisiert für Zeitreihen-Widgets\r\n ** Optionaler Fallback auf Polling bei fehlender WebSocket-Unterstützung\r\n\r\n*Requirement Owner: [~1]*\r\n\r\nh2. Akzeptanzkriterien\r\n # Nutzer können pro Dashboard ein Aktualisierungsintervall konfigurieren.\r\n # Bei aktivem WebSocket werden betroffene Widgets ohne manuellen Reload aktualisiert.\r\n # DASH Insights zeigt den Aktualisierungsmodus je Widget an.',
      status: STATUS_OFFEN,
      priority: PRIO_MITTEL,
      assignee: UNASSIGNED,
      reporter: U1,
      creator: U1,
      created: '2026-02-24T08:53:20.000+0100',
      updated: '2026-03-04T16:29:44.000+0100',
      duedate: null,
      labels: ['prioindikator:hoch'],
      components: [],
      comment: wrapComments([]),
      attachment: [
        makeAttachment('1029357', 'live-refresh-konzept.png', 'image/png', U1, '2026-02-24T14:04:50.737+0100', 76478),
      ],
      subtasks: [],
      issuelinks: [
        {
          id: '1492272',
          self: `${BASE}/rest/api/2/issueLink/1492272`,
          outwardIssue: {
            id: '1499803',
            key: 'DASH-0785',
            self: `${BASE}/rest/api/2/issue/1499803`,
            fields: {
              summary: 'WebSocket-Infrastruktur: Grundlagenimplementierung',
              status: STATUS_OFFEN,
            },
          },
          type: {
            id: '10010',
            name: 'Abhängig',
            inward: 'ist notwendig für',
            outward: 'hängt ab von',
            self: `${BASE}/rest/api/2/issueLinkType/10010`,
          },
        },
        {
          id: '1492265',
          self: `${BASE}/rest/api/2/issueLink/1492265`,
          inwardIssue: {
            id: '1527565',
            key: 'DASH-0838',
            self: `${BASE}/rest/api/2/issue/1527565`,
            fields: {
              summary: '[DEV] Veraltete API-Endpunkte im Daten-Polling identifizieren',
              status: STATUS_OFFEN,
            },
          },
          type: {
            id: '10010',
            name: 'Abhängig',
            inward: 'ist notwendig für',
            outward: 'hängt ab von',
            self: `${BASE}/rest/api/2/issueLinkType/10010`,
          },
        },
      ],
      customfield_10014: null,
    },
  },
  {
    id: '1522935',
    key: 'DASH-0803',
    self: `${BASE}/rest/api/2/issue/1522935`,
    fields: {
      issuetype: TYPE_FEHLER,
      project: PROJ_DASH,
      summary: '[DEV] v3 Nacharbeiten nach Release',
      description: 'h2. Beschreibung\r\n\r\nNach dem Release von v3 sind folgende Probleme aufgetreten:\r\n # Der Datumswähler zeigt falsche ISO-Kalenderwochen an – in manchen Jahren wird KW\u00a053 statt KW\u00a01 angezeigt.\r\n # Die Zahlenformatierung ist für nicht-deutsche Locales fehlerhaft: Dezimaltrennzeichen und Tausendertrennzeichen werden vertauscht.\r\n # In verschachtelten Dashboard-Ansichten zeigt die Breadcrumb-Navigation „undefined" statt des korrekten Seitennamens.\r\n\r\nh3. Details\r\n\r\nBeschleunigt, da dringend nach dem v3 Release zu beheben.\r\n\r\n*Requirement Owner: [~1]*\r\n\r\nh2. Akzeptanzkriterien\r\n # Der Datumswähler zeigt korrekte ISO-Kalenderwochen gemäß ISO\u00a08601.\r\n # Zahlenformatierung funktioniert korrekt für alle unterstützten Locales (de-DE, en-US, fr-FR).\r\n # Die Breadcrumb-Navigation zeigt in allen Ansichtstiefen korrekte Seitentitel.',
      status: STATUS_GESCHLOSSEN,
      priority: PRIO_BLOCKER,
      assignee: U1,
      reporter: U1,
      creator: U1,
      created: '2026-02-18T12:56:42.000+0100',
      updated: '2026-02-20T13:02:37.000+0100',
      duedate: null,
      labels: [],
      components: [],
      comment: wrapComments([]),
      attachment: [],
      subtasks: [],
      issuelinks: [],
      customfield_10014: null,
    },
  },
  {
    id: '1519557',
    key: 'INFRA-0241',
    self: `${BASE}/rest/api/2/issue/1519557`,
    fields: {
      issuetype: TYPE_FEHLER,
      project: PROJ_INFRA,
      summary: 'CI/CD: Pipeline-Builds im TST-Environment instabil',
      description: 'h2. Beschreibung\r\n\r\nBei uns brechen Branch-Builds zufällig ab (gleicher Code-Stand). Manche Deployments laufen durch, die meisten brechen ab.\r\n\r\n*Aktuelles Verhalten (IST):*\r\nDie meisten Builds schlagen mit einem nicht-deterministischen Fehler fehl. Der gleiche Commit läuft mal durch, mal nicht.\r\n\r\n*Erwartetes Verhalten (SOLL):*\r\nBuilds mit identischem Code-Stand müssen konsistent durchlaufen.\r\n\r\nh2. Details\r\n\r\nBeschleunigt, da aktive Entwicklung blockiert ist.',
      status: STATUS_GESCHLOSSEN,
      priority: PRIO_KRITISCH,
      assignee: U4,
      reporter: U1,
      creator: U4,
      created: '2026-02-11T14:23:35.000+0100',
      updated: '2026-02-13T09:18:41.000+0100',
      duedate: null,
      labels: ['infra', 'build-pipeline'],
      components: [],
      comment: wrapComments([
        makeComment('12421508', U4, 'Instabilen Build-Node identifiziert, Knoten aus dem Pool entfernt, neugestartet und wieder eingebunden.', '2026-02-11T14:24:45.973+0100'),
        makeComment('12421635', U4, '[~1] Bitte eure Deployments neu ausführen.\r\n\r\n ', '2026-02-11T15:18:24.080+0100'),
        makeComment('12423685', U4, 'Warten auf Feedback von [~1].', '2026-02-13T09:07:38.357+0100'),
        makeComment('12423714', U4, 'Feedback von [~1]: Es funktioniert alles. Schließe das Ticket.', '2026-02-13T09:18:41.360+0100'),
      ]),
      attachment: [
        makeAttachment('1024562', 'build-fehler-screenshot.png', 'image/png', U4, '2026-02-11T14:22:27.310+0100', 27141),
      ],
      subtasks: [],
      issuelinks: [],
      customfield_10014: null,
    },
  },
  {
    id: '1514652',
    key: 'DASH-0792',
    self: `${BASE}/rest/api/2/issue/1514652`,
    fields: {
      issuetype: TYPE_FEHLER,
      project: PROJ_DASH,
      summary: '[DEV] Kreisdiagramm wird leer gerendert bei Datensatz mit genau einem Eintrag',
      description: 'h2. Beschreibung\r\n\r\nEnthält ein Datensatz für ein Kreisdiagramm genau einen Eintrag, wird das Diagramm nicht gerendert – die Zeichenfläche bleibt leer. Bei zwei oder mehr Einträgen funktioniert die Darstellung korrekt.\r\n\r\n*Aktuelles Verhalten (IST):*\r\nDie Bogenberechnung für SVG-Pfade teilt durch die Anzahl der Einträge minus eins. Bei einem einzelnen Eintrag entsteht eine Division durch null; der resultierende NaN-Wert verhindert das Rendering.\r\n\r\n*Erwartetes Verhalten (SOLL):*\r\nEin Datensatz mit einem einzigen Eintrag wird als vollständig gefüllter Kreis dargestellt.\r\n\r\nh2. Details\r\n\r\n*Browser/Umgebung:* Alle\r\n\r\n*Lösungsvorschlag/Analyse:*\r\nDer Sonderfall (Datensatz mit genau einem Eintrag) muss vor der Bogenberechnung abgefangen und separat behandelt werden.\r\n\r\nh2. Akzeptanzkriterien\r\n # Kreisdiagramme mit einem einzigen Eintrag werden korrekt als vollständiger Kreis dargestellt.\r\n # Es gibt einen automatisierten Test für den Einzeleintrags-Sonderfall.\r\n # Datensätze mit null Einträgen zeigen einen definierten Leerstand-Zustand.',
      status: STATUS_GESCHLOSSEN,
      priority: PRIO_BLOCKER,
      assignee: U1,
      reporter: U1,
      creator: U1,
      created: '2026-02-03T15:21:36.000+0100',
      updated: '2026-02-06T11:14:23.000+0100',
      duedate: null,
      labels: [],
      components: [],
      comment: wrapComments([]),
      attachment: [],
      subtasks: [],
      issuelinks: [],
      customfield_10014: null,
    },
  },
  {
    id: '1514077',
    key: 'DASH-0791',
    self: `${BASE}/rest/api/2/issue/1514077`,
    fields: {
      issuetype: TYPE_FEHLER,
      project: PROJ_DASH,
      summary: '[DEV] CSS-Theme-Tokens nicht angewendet bei iframe-Einbettung',
      description: 'h2. Beschreibung\r\n\r\nWenn ein Dashboard als iframe in eine externe Anwendung eingebettet wird, werden die konfigurierten CSS-Custom-Properties (Theme-Tokens) nicht korrekt angewendet. Das Dashboard erscheint im Standard-Theme, unabhängig vom gesetzten Theme der Host-Anwendung.\r\n\r\n*Aktuelles Verhalten (IST):*\r\nCSS-Custom-Properties werden im Shadow-DOM-Kontext der eingebetteten Komponenten nicht vererbt. Das iframe-Dokument hat keinen Zugriff auf die Token-Werte des Host-Dokuments.\r\n\r\n*Erwartetes Verhalten (SOLL):*\r\nDas Dashboard übernimmt korrekt das konfigurierte Theme, auch wenn es per iframe eingebettet ist.\r\n\r\nh2. Details\r\n\r\n*Lösungsvorschlag/Analyse:*\r\n # Theme-Token-Werte explizit per Attribut oder URL-Parameter an das eingebettete Dashboard übergeben.\r\n # Prüfung, ob weitere Komponenten das gleiche Problem aufweisen.\r\n # Dokumentation des Einbettungs-Workflows in der Storybook-Seite aktualisieren.\r\n\r\nh2. Akzeptanzkriterien\r\n # Das korrekte Theme wird angewendet, wenn das Dashboard per iframe eingebettet wird.\r\n # Die Konfigurationsmöglichkeit ist in der Komponentendokumentation beschrieben.\r\n # Alle betroffenen Komponenten wurden identifiziert und angepasst.',
      status: STATUS_GESCHLOSSEN,
      priority: PRIO_MITTEL,
      assignee: UNASSIGNED,
      reporter: U1,
      creator: U1,
      created: '2026-02-03T10:47:47.000+0100',
      updated: '2026-02-19T13:42:09.000+0100',
      duedate: null,
      labels: [],
      components: [],
      comment: wrapComments([
        makeComment('12426403', U3, 'Stichprobenkontrolle Anforderungsbeschreibung durchgeführt', '2026-02-17T12:15:59.680+0100'),
        makeComment('12429551', U1, 'Wird umgesetzt mit DASH-0799', '2026-02-19T13:42:09.757+0100'),
      ]),
      attachment: [],
      subtasks: [],
      issuelinks: [
        {
          id: '1487672',
          self: `${BASE}/rest/api/2/issueLink/1487672`,
          inwardIssue: {
            id: '1522456',
            key: 'DASH-0799',
            self: `${BASE}/rest/api/2/issue/1522456`,
            fields: {
              summary: '[DEV] Dashboard-Theme: Token-Vererbung bei Einbettung korrigieren',
              status: STATUS_OFFEN,
            },
          },
          type: {
            id: '10000',
            name: 'Duplizieren',
            inward: 'wird dupliziert von',
            outward: 'dupliziert',
            self: `${BASE}/rest/api/2/issueLinkType/10000`,
          },
        },
      ],
      customfield_10014: null,
    },
  },
  {
    id: '1507563',
    key: 'DASH-0782',
    self: `${BASE}/rest/api/2/issue/1507563`,
    fields: {
      issuetype: TYPE_USER_STORY,
      project: PROJ_DASH,
      summary: '[DEV] [tabelle] Browser friert ein bei clientseitiger Sortierung großer Datensätze',
      description: 'h2. Beschreibung\r\n\r\nBei Tabellen mit mehr als 10.000 Zeilen führt die clientseitige Sortierung zu einem Einfrieren des Browsers. Für Anwendungsfälle mit großen Datenmengen ist die Tabellen-Komponente nicht nutzbar.\r\n\r\nh2. Details\r\n\r\nSchnelle Lösung bevorzugt, da Konsumprojekt „Analyse-Dashboard" einen Launch Ende Januar anstrebt.\r\n\r\n*Austausch 22.01.2026:* Wir führen ein Attribut ein, das auf serverseitige Sortierung umschaltet: dash-server-side-sort. Default: false.\r\n\r\nh2. Akzeptanzkriterien\r\n # Geprüft, ob clientseitige Sortierung durch Virtualisierung optimierbar ist.\r\n # Konsumenten können serverseitige Sortierung mit dash-server-side-sort aktivieren.\r\n # Im Storybook gibt es eine Dokumentation, inkl. Hinweis auf Performance-Grenzen bei clientseitiger Sortierung.',
      status: STATUS_GESCHLOSSEN,
      priority: PRIO_BLOCKER,
      assignee: U1,
      reporter: U1,
      creator: U1,
      created: '2026-01-22T12:21:18.000+0100',
      updated: '2026-03-02T09:35:55.000+0100',
      duedate: null,
      labels: [],
      components: [],
      comment: wrapComments([
        makeComment(
          '12409022',
          U5,
          'Noch eine Sache – bitte im Rahmen dieses Tickets mit beheben:\r\n\r\nMir sind zwei Probleme bei der Komponente aufgefallen:\r\n 1. Die Sortierspalte hat nach dem Neuladen keinen persistierten Zustand, was eine Browser-Warnung erzeugt.\r\n 2. Die @for-Schleife erzeugt für jede Zeile ein redundantes ARIA-Label, das Screenreader dazu bringt, Zellwerte doppelt vorzulesen.\r\n\r\nBitte korrigieren.',
          '2026-01-29T14:01:48.693+0100',
        ),
      ]),
      attachment: [
        makeAttachment('1019655', 'tabelle-sortierung-screenshot-1.png', 'image/png', U5, '2026-01-29T13:54:38.790+0100', 8754),
        makeAttachment('1019656', 'tabelle-sortierung-screenshot-2.png', 'image/png', U5, '2026-01-29T13:55:55.600+0100', 34323),
        makeAttachment('1019657', 'tabelle-sortierung-screenshot-3.png', 'image/png', U5, '2026-01-29T13:57:28.927+0100', 33016),
      ],
      subtasks: [],
      issuelinks: [],
      customfield_10014: null,
    },
  },
  {
    id: '1500816',
    key: 'TGLD-0007',
    self: `${BASE}/rest/api/2/issue/1500816`,
    fields: {
      issuetype: TYPE_USER_STORY,
      project: PROJ_TGLD,
      summary: 'Support für neuen SSO-Anbieter (OIDC)',
      description: 'h2. Beschreibung\r\n\r\nDas SSO-Integrations-SDK unterstützt bisher ausschließlich SAML-basierte Authentifizierung. Ende 2025 wurde der neue Unternehmensstandard auf OpenID Connect (OIDC) migriert.\r\n\r\nDas SDK soll ebenfalls Projekte supporten, die OIDC\u00a01.0 nutzen.\r\n\r\nh2. Details\r\n\r\nh3. Lösungsideen\r\n # Zwei separate Branches – einer für OIDC, einer für SAML.\r\n # Ein gemeinsamer Code-Stand, der beide Protokolle unterstützt.\r\n\r\n*Requirement-Owner: [~1]*\r\n\r\nh2. Akzeptanzkriterien\r\n # Konsumenten mit OIDC können das SSO-Integrations-SDK nutzen.\r\n # Konsumenten mit SAML können das SDK weiterhin nutzen.\r\n # Es existieren Tests, die die Kompatibilität mit beiden Protokollen sicherstellen.\r\n # Dokumentation wurde bei Bedarf aktualisiert.',
      status: STATUS_GESCHLOSSEN,
      priority: PRIO_KRITISCH,
      assignee: U1,
      reporter: U1,
      creator: U1,
      created: '2026-01-14T10:01:46.000+0100',
      updated: '2026-02-09T15:25:47.000+0100',
      duedate: null,
      labels: [],
      components: [
        { self: `${BASE}/rest/api/2/component/43980`, id: '43980', name: 'SSO-Integrations-SDK', description: 'Ein SDK für die Integration unternehmensweiter Single-Sign-On-Lösungen.' },
      ],
      comment: wrapComments([
        makeComment('12418925', U1, 'Umgesetzt mit SDK Version 3.0.0', '2026-02-09T15:25:47.777+0100'),
      ]),
      attachment: [],
      subtasks: [],
      issuelinks: [],
      customfield_10014: null,
    },
  },
];

app.get('/rest/api/2/myself', (_req, res) => {
  res.json(mockUser);
});

app.get('/rest/api/2/search', (_req, res) => {
  res.json({
    startAt: 0,
    maxResults: 50,
    total: mockIssues.length,
    issues: mockIssues,
  });
});

app.get('/rest/api/2/issue/:key', (req, res) => {
  const issue = mockIssues.find(i => i.key === req.params.key);
  if (!issue) {
    res.status(404).json({ errorMessages: ['Issue Does Not Exist'], errors: {} });
    return;
  }
  res.json(issue);
});

app.listen(PORT, () => {
  console.log(`Mock Jira server running at http://localhost:${PORT}`);
});
