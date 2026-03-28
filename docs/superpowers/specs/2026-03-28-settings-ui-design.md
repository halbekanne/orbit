# Settings UI — Design Spec

> Status: Draft
> Datum: 2026-03-28

## Übersicht

Orbit bekommt eine eigene Settings-UI als dritte View, über die Nutzer alle Konfiguration zentral verwalten. Die bisherige `.env`-basierte Konfiguration wird vollständig durch `~/.orbit/settings.json` ersetzt. Beim ersten Start (keine `settings.json` vorhanden) zeigt Orbit einen Fullscreen-Willkommensbildschirm, der den Nutzer zur Konfiguration der Pflichteinstellungen führt.

## Ziele

- Kollegen können Orbit ohne manuelles Editieren von Dateien einrichten
- Eine einzige Konfigurationsquelle: `~/.orbit/settings.json`
- ADHS-gerechte Settings-UX: visuell, übersichtlich, nicht überfordernd
- Generische Vertex AI Proxy-Konfiguration statt firmenspezifischer CoSi-Referenzen

## Nicht im Scope (MVP)

- JQL-Filter für Ticket-Filterung
- Ticket-Templates
- Polling-Intervall-Konfiguration
- Repository-spezifische Review-Regeln
- Tastenkombinationen-Konfiguration
- URL-Routing

---

## 1. Datenmodell

### `~/.orbit/settings.json`

```json
{
  "connections": {
    "jira": {
      "baseUrl": "",
      "apiKey": ""
    },
    "bitbucket": {
      "baseUrl": "",
      "apiKey": "",
      "userSlug": ""
    },
    "vertexAi": {
      "url": "",
      "customHeaders": [
        { "name": "", "value": "" }
      ]
    }
  },
  "features": {
    "pomodoro": {
      "enabled": true,
      "focusMinutes": 25,
      "breakMinutes": 5
    },
    "aiReviews": {
      "enabled": false
    },
    "dayCalendar": {
      "enabled": true
    }
  },
  "appearance": {
    "theme": "system"
  }
}
```

### Pflichtfelder (für Onboarding-Gate)

- `connections.jira.baseUrl`
- `connections.jira.apiKey`
- `connections.bitbucket.baseUrl`
- `connections.bitbucket.apiKey`
- `connections.bitbucket.userSlug`

Alles andere ist optional oder hat Defaults.

### Abgrenzung zu localStorage

`settings.json` enthält ausschließlich vom Nutzer bewusst konfigurierte Einstellungen. Folgendes bleibt in localStorage:

- Laufender Pomodoro-State (aktuelle Session, Endzeit, Timer-Status)
- Aktive View (`orbit.activeView`)
- Collapsed Sections im Navigator (`orbit.navigator.collapsed`)
- Fokus-Target (`orbit.focus.state`)

---

## 2. Server-API

### Neue Routen (`settings-routes.js`)

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/api/settings` | Liefert die aktuelle `settings.json`. Wenn Datei nicht existiert: `{ exists: false }` |
| `PUT` | `/api/settings` | Schreibt die komplette Settings-JSON. Server validiert Pflichtfelder. Bei fehlenden Pflichtfeldern: `400` mit Liste der fehlenden Felder |
| `GET` | `/api/settings/status` | Schneller Check: `{ configured: true/false }`. Prüft ob Datei existiert UND alle Pflichtfelder gesetzt sind |

### Änderungen an bestehenden Server-Dateien

**`index.js`:**
- `dotenv`-Import und `process.env`-Zugriffe für Credentials entfernen
- `settings-routes.js` einbinden
- Settings beim Start aus `~/.orbit/settings.json` laden
- Settings-Objekt an `proxy-routes` und `ai-routes` übergeben
- Server startet auch ohne Settings (für den Fall dass der Nutzer sie erst über die UI anlegt)

**`proxy-routes.js`:**
- Liest Jira/Bitbucket-Credentials aus dem Settings-Objekt statt aus `process.env`
- Der `/config`-Endpoint (der `bitbucketUserSlug` liefert) entfällt — Frontend liest den Slug aus dem `SettingsService`
- Proxy-Routen geben `503` zurück wenn Settings nicht konfiguriert sind

**`cosi-routes.js` → `ai-routes.js`:**
- Umbenennung der Datei und aller internen Referenzen
- Liest Vertex AI URL und Custom Headers aus Settings
- URL-Aufbau: `settings.connections.vertexAi.url` + `:generateContent` (der Code hängt die Methode an)
- Custom Headers werden bei jedem Request an den Proxy als HTTP-Header mitgesendet

**`cosi-mock.js` → `ai-mock.js`:**
- Umbenennung, gleiche Funktionalität

---

## 3. App-Start & Onboarding-Flow

### Ablauf

1. `AppComponent` initialisiert `SettingsService`
2. `SettingsService` ruft `GET /api/settings/status` auf
3. Signal `isConfigured()` wird gesetzt

### Wenn `isConfigured() === false`: Welcome-Screen

Die gesamte App zeigt einen **Fullscreen Welcome-Screen** — kein Rail, kein Navigator, nichts von der regulären UI.

#### Welcome-Screen Design (exakt umzusetzen)

**Fullscreen-Layout** ohne jegliche App-Chrome (kein Rail, keine Navigation).

**Hintergrund:**
- Basis: `#0c0a09` (Orbit stone-950)
- Darüber ein violetter Gradient von oben: `radial-gradient(ellipse 100% 80% at 50% 30%, rgba(124, 58, 237, 0.18) 0%, rgba(91, 33, 182, 0.08) 35%, transparent 65%)` plus zwei weitere subtile Ellipsen für Tiefe
- Subtiler Sternenstaub: Viele kleine `radial-gradient`-Punkte (1-1.5px) in `rgba(231, 229, 228, 0.1-0.25)` und vereinzelt in `rgba(167, 139, 250, 0.15-0.2)`, mit einer langsamen Twinkle-Animation (12s ease-in-out alternate, Opacity 0.7 → 1)

**2D Orbit-Illustration (zentriert, oberhalb des Textes):**
- Breite/Höhe: ca. 260×260px
- Ein **Planet** im Zentrum (56px): `radial-gradient` von `#c4b5fd` (Highlight oben-links) über `#7c3aed` zu `#3b0764` (Schatten). Subtiler Glanzpunkt oben-links (weiße Ellipse, 30% Opacity). Box-Shadow als Glow: `0 0 30px rgba(167, 139, 250, 0.3)`. Sanftes Pulsieren (6s, Shadow-Intensität wechselt).
- **Drei konzentrische Ringe** um den Planeten:
  - Ring 1 (140px): `rgba(167, 139, 250, 0.18)`, dashed
  - Ring 2 (210px): `rgba(167, 139, 250, 0.1)`, solid
  - Ring 3 (258px): `rgba(120, 113, 108, 0.08)`, dashed
- **Drei Satelliten** die auf den Ringen kreisen (jeder auf einem eigenen rotierenden Container):
  - Satellit 1 (auf Ring 1, 18px): Stone-farbig (`#fafaf9` → `#a8a29e`), Glanzpunkt, violetter Glow-Shadow. Kreist in 12s.
  - Satellit 2 (auf Ring 2, 10px): Violett-farbig (`#c4b5fd` → `#6d28d9`). Kreist in 20s, startet bei 60°.
  - Satellit 3 (auf Ring 3, 6px): Stone-grau (`#a8a29e` → `#78716c`). Kreist in 30s, rückwärts.
- Kleine dekorative **Punkte** (3-4px) statisch verstreut um die Illustration
- Gesamte Illustration faded in (1.2s, scale 0.92 → 1)

**Text-Content (unterhalb der Illustration, zentriert, max-width 440px):**
- **Titel:** "Willkommen bei Orbit" — `font-size: 30px`, `font-weight: 800`, "Orbit" mit violettem Gradient-Text (`#a78bfa` → `#c4b5fd` → `#a78bfa`). Fade-up Animation (0.8s, delay 0.3s).
- **Subtitle:** "Deine persönliche Kommandozentrale für den Arbeitsalltag — gebaut für Fokus, Struktur und Orientierung." — `font-size: 15px`, `color: #a8a29e`, `line-height: 1.65`. Fade-up (delay 0.4s).
- **Feature-Chips** (drei Stück, horizontal zentriert, flex-wrap):
  - Pill-Form: `border-radius: 100px`, `padding: 8px 14px`, Glasmorph-Hintergrund (`rgba(28, 25, 23, 0.7)` + `backdrop-filter: blur(8px)`), `border: 1px solid #292524`
  - Jeder Chip hat ein SVG-Icon (14px) + Text (12.5px, `font-weight: 500`)
  - Chip 1 (violet Icon): "Alles an einem Ort" — Icon: Pfeile die nach außen zeigen (Expand)
  - Chip 2 (amber Icon): "Gebaut für Fokus" — Icon: Uhr
  - Chip 3 (emerald Icon): "Deine Daten, lokal" — Icon: Schild
  - Hover: Border wird heller, `translateY(-1px)`
  - Fade-up (delay 0.55s)
- **CTA-Button:** "Einstellungen festlegen" + Pfeil-Icon rechts
  - `padding: 14px 36px`, `border-radius: 100px`, violetter Gradient (`#7c3aed` → `#6d28d9`)
  - Box-Shadow mit violettem Glow: `0 6px 24px rgba(124, 58, 237, 0.25)`
  - Hover: `translateY(-2px)`, stärkerer Shadow
  - `font-weight: 700`, `font-size: 15px`, weiß
  - Fade-up (delay 0.7s)
- **Hint unter CTA:** "Dauert nur wenige Minuten" — `font-size: 12px`, `color: #44403c`

**Font:** Nunito (Google Fonts), weights 400-800.

**Klick auf CTA:** Welcome-Screen verschwindet, Orbit startet mit der normalen UI und `activeView = 'einstellungen'`. Die Pflichtfelder in der Settings-View sind mit rotem Stern markiert.

### Wenn `isConfigured() === true`: Normaler Start

Orbit startet mit der zuletzt aktiven View aus localStorage. Settings-View ist über das Zahnrad-Icon in der Rail erreichbar.

---

## 4. Settings-View

### Einstieg

Zahnrad-Icon in der linken Rail, unterhalb von Arbeit und Logbuch, oberhalb des bisherigen Theme-Toggle-Platzes. Klick setzt `activeView = 'einstellungen'`.

### Layout

Zwei-Spalten-Layout innerhalb der Main-Area (der Rail bleibt wie bei allen Views links stehen):

**Linke Spalte — Sticky Sektions-Navigation:**
- Sticky, scrollt nicht mit
- Überschrift "Einstellungen" oben (klein, uppercase, `letter-spacing`, stone-grau)
- Sektions-Header (Verbindungen, Funktionen, Darstellung) als primäre Einträge
- Sub-Einträge darunter (Jira, Bitbucket, Vertex AI Proxy, Pomodoro-Timer, KI-Reviews, Tageskalender)
- Aktiver Eintrag: violetter 2px-Strich links + violette Textfarbe
- Inaktive Einträge: stone-grau
- Sub-Einträge mit "›" Prefix
- Aktiver Eintrag aktualisiert sich automatisch beim Scrollen (IntersectionObserver auf den Sektions-Headern im Content)
- Klick auf einen Eintrag: smooth scroll zur entsprechenden Sektion

**Rechte Spalte — Scrollbarer Content:**
- Linke Borderlinie als visueller Separator
- Alle Sektionen untereinander, getrennt durch Sektions-Header

### Sektion: Verbindungen

Sektions-Header: "Verbindungen" (fett, groß) + Subtitle "Zugangsdaten für externe Dienste" (klein, stone-grau)

**Jira-Karte:**
- Karten-Header: "Jira" (fett)
- Feld: "Server-URL" — Text-Input, Pflicht (roter Stern), Placeholder: `https://jira.example.com`
- Feld: "Personal Access Token" — Passwort-Input (maskiert) mit Toggle-Button zum Anzeigen/Verbergen, Pflicht (roter Stern)
- Hilfetext unter dem PAT-Feld: "Erstelle einen Token in deinen Jira-Profileinstellungen" (klein, stone-grau)

**Bitbucket-Karte:**
- Karten-Header: "Bitbucket" (fett)
- Feld: "Server-URL" — Text-Input, Pflicht, Placeholder: `https://bitbucket.example.com`
- Feld: "Personal Access Token" — Passwort-Input, Pflicht
- Feld: "Benutzername (Slug)" — Text-Input, Pflicht
- Hilfetext: "Dein Bitbucket-Benutzername, zu finden in deinem Profil"

**Vertex AI Proxy-Karte:**
- Karten-Header: "Vertex AI Proxy" (fett) + "Optional"-Badge rechts (klein, stone-grau)
- Feld: "URL" — Text-Input, Placeholder: `https://example.com/v1/models/.../gemini-2.5-flash`
- Hilfetext: "Vollständige URL bis zum Modellnamen. Die Methode (:generateContent) wird automatisch angehängt."
- Dynamische Custom-Headers-Liste:
  - Jede Zeile: Text-Input "Name" + Text-Input "Wert" (Passwort-Input) + ×-Button zum Entfernen
  - Unter der Liste: "+ Header hinzufügen" Link (violett)
  - Mindestens 0 Header, keine Obergrenze

### Sektion: Funktionen

Sektions-Header: "Funktionen" (fett) + Subtitle "Features aktivieren und konfigurieren"

Jedes Feature ist eine eigene Karte. Im Karten-Header steht der Feature-Name links und ein Toggle-Switch rechts.

**Pomodoro-Timer:**
- Toggle-Switch: an/aus
- Wenn an: Zwei Number-Inputs nebeneinander
  - "Fokus-Dauer (Min.)" — Default: 25
  - "Pausen-Dauer (Min.)" — Default: 5
- Wenn aus: Gesamte Karte gedimmt (niedrige Opacity), Inputs nicht interagierbar

**KI-gestützte Reviews:**
- Toggle-Switch: an/aus
- Wenn aus: Gedimmt
- Wenn an aber keine Vertex AI URL konfiguriert: Hinweis "Benötigt Vertex AI Proxy-Konfiguration" (klein, amber/warning-farbig)

**Tageskalender:**
- Toggle-Switch: an/aus
- Keine weiteren Sub-Settings

### Sektion: Darstellung

Sektions-Header: "Darstellung" (fett) + Subtitle "Aussehen von Orbit anpassen"

**Farbschema-Karte:**
- Label: "Farbschema"
- Drei klickbare Mini-Previews nebeneinander:
  - **Hell:** Mini-Version von Orbit's Layout im hellen Theme (heller Hintergrund, Stone-Farben für Rail und Sidebar-Elemente)
  - **Dunkel:** Mini-Version im dunklen Theme (dunkler Hintergrund, dunkle Karten)
  - **System:** Diagonaler Split (oben-links hell, unten-rechts dunkel)
- Jedes Preview ca. 44px hoch, zeigt abstrahiert: schmale Rail links + Sidebar + Content-Bereich
- Ausgewähltes Preview: `border: 2px solid #a78bfa` (violett)
- Nicht ausgewählte: `border: 2px solid transparent`
- Label unter jedem Preview: "Hell", "Dunkel", "System"

### Sticky Footer

Am unteren Rand der Settings-View, immer sichtbar:

- **Speichern-Button** (rechtsbündig oder zentriert)
- Deaktiviert (grayed out) wenn:
  - Keine Änderungen seit letztem Speichern (kein Dirty-State)
  - Pflichtfelder nicht alle ausgefüllt (mit Tooltip/Hinweis welche fehlen)
- Aktiviert: Violetter Button, klickbar
- Bei Klick: `PUT /api/settings` → bei Erfolg kurze visuelle Bestätigung (z.B. grüner Haken der kurz einblendet, oder Button-Text wechselt kurz zu "Gespeichert")
- Bei Fehler: Fehlermeldung anzeigen

### Unsaved-Changes-Guard

Wenn der Nutzer bei ungespeicherten Änderungen auf einen anderen Rail-Button klickt (Arbeit, Logbuch):
- Dialog/Prompt: "Du hast ungespeicherte Änderungen. Möchtest du speichern oder verwerfen?"
- Optionen: "Speichern" (speichert und navigiert) / "Verwerfen" (verwirft und navigiert) / "Abbrechen" (bleibt in Settings)

---

## 5. Konsolidierung bestehender Settings

### Theme-Toggle in der Rail

Der bisherige Theme-Toggle-Button unten in der Rail **entfällt**. Theme wird ausschließlich über die Settings-View gesteuert. Der `ThemeService` liest den Theme-Wert aus `SettingsService.theme()` statt aus localStorage.

### Pomodoro-Config-Popup

Das Popup **bleibt bestehen**. Es zeigt beim Öffnen die Default-Werte aus `SettingsService.pomodoroDefaults()` als Vorbelegung. Der Nutzer kann sie pro Session überschreiben. Dauerhafte Änderung der Defaults → Settings-View.

---

## 6. CoSi → AI Umbenennung

Alle Referenzen auf "CoSi" werden aus dem gesamten Codebase entfernt und generisch umbenannt:

| Alt | Neu |
|-----|-----|
| `cosi-routes.js` | `ai-routes.js` |
| `cosi-mock.js` | `ai-mock.js` |
| `CosiReviewService` | `AiReviewService` |
| `COSI_API_KEY` | entfällt (kommt aus Settings Custom Headers) |
| `COSI_BASE_URL` | entfällt (kommt aus Settings `vertexAi.url`) |
| Alle Variablen/Typen mit `cosi` | `ai` oder `vertexAi` je nach Kontext |

---

## 7. SettingsService

Zentraler Angular Service für den gesamten Settings-State.

### Signals

- `settings()` — das komplette Settings-Objekt
- `isConfigured()` — `true` wenn Settings existieren und alle Pflichtfelder gesetzt
- `jiraConfig()` — computed: `settings().connections.jira`
- `bitbucketConfig()` — computed: `settings().connections.bitbucket`
- `vertexAiConfig()` — computed: `settings().connections.vertexAi`
- `pomodoroDefaults()` — computed: `{ focusMinutes, breakMinutes }`
- `theme()` — computed: `settings().appearance.theme`
- `pomodoroEnabled()` — computed: `settings().features.pomodoro.enabled`
- `aiReviewsEnabled()` — computed: `settings().features.aiReviews.enabled`
- `dayCalendarEnabled()` — computed: `settings().features.dayCalendar.enabled`

### Methoden

- `load()` — `GET /api/settings`, befüllt das Signal
- `checkStatus()` — `GET /api/settings/status`, setzt `isConfigured()`
- `save(settings)` — `PUT /api/settings`, aktualisiert Signal bei Erfolg

### Betroffene bestehende Services

- `ThemeService` → liest aus `SettingsService.theme()` statt localStorage. Schreibt nicht mehr selbst.
- `PomodoroService` → liest Defaults aus `SettingsService.pomodoroDefaults()`. Laufender Timer-State bleibt in localStorage.
- `BitbucketService` → liest URL/Key/UserSlug aus `SettingsService.bitbucketConfig()`. Der bisherige `GET /config`-Aufruf entfällt.
- `JiraService` → liest URL/Key aus `SettingsService.jiraConfig()`.
- `AiReviewService` (ehemals `CosiReviewService`) → liest URL + Custom Headers aus `SettingsService.vertexAiConfig()`.

---

## 8. Komponenten-Übersicht

### Neue Komponenten

| Komponente | Beschreibung |
|-----------|-------------|
| `WelcomeScreenComponent` | Fullscreen-Willkommensbildschirm mit 2D Orbit-Animation und CTA |
| `ViewSettingsComponent` | Settings-View mit Zwei-Spalten-Layout (Nav links + Content rechts) |
| `SettingsSectionNavComponent` | Sticky Sektions-Navigation, IntersectionObserver für Active-Tracking |
| `SettingsFooterComponent` | Sticky Footer mit Speichern-Button, Dirty-State, Validierung |

### Geänderte Komponenten

| Komponente | Änderung |
|-----------|---------|
| `AppComponent` | Onboarding-Gate (`isConfigured()`), Welcome-Screen rendern, dritter Rail-Button, `@case ('einstellungen')` |
| `AppRailComponent` | Zahnrad-Icon für Settings, Theme-Toggle entfernen |
| `PomodoroConfigPopupComponent` | Defaults aus SettingsService statt localStorage |

### Neue Server-Dateien

| Datei | Beschreibung |
|------|-------------|
| `settings-routes.js` | GET/PUT/STATUS Endpunkte für `~/.orbit/settings.json` |

### Umbenannte Server-Dateien

| Alt | Neu |
|-----|-----|
| `cosi-routes.js` | `ai-routes.js` |
| `cosi-mock.js` | `ai-mock.js` |

### Entfernte Abhängigkeiten

- `dotenv` — wird nicht mehr benötigt
- `.env` — wird nicht mehr gelesen (Datei kann gelöscht werden)
