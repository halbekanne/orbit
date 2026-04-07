# Auto-Refresh & Sync — Design Spec

> Status: Draft
> Datum: 2026-03-29

## Übersicht

Orbit aktualisiert Jira- und Bitbucket-Daten bisher nur beim App-Start. Das führt dazu, dass Daten veralten, wenn die App den ganzen Tag auf einem zweiten Monitor offen ist. Besonders problematisch: nach Standby/VPN-Reconnect zeigt Orbit Fehlermeldungen, die erst durch manuelles Browser-Refresh verschwinden.

Diese Spec beschreibt ein automatisches Refresh-System mit vier Triggern, Retry-Logik und einer visuellen Sync-Bar im Navigator.

## Ziele

- Daten bleiben aktuell ohne manuelles Browser-Refresh
- VPN-Reconnect-Szenario wird durch automatische Retries abgefangen
- Nutzer sieht jederzeit, wann die Daten zuletzt aktualisiert wurden
- Kein Layout-Shift: alte Daten bleiben sichtbar bis neue Daten da sind
- Architektur erlaubt einfaches Hinzufügen weiterer Datenquellen

## Nicht im Scope

- Konfigurierbarkeit des Polling-Intervalls über die Settings-UI (kommt später)
- WebSocket-basiertes Push statt Polling
- Granulare per-Source-Refresh-Buttons in der UI
- Refresh von lokalen Daten (Todos, Ideen, Logbuch)

---

## 1. DataRefreshService — Kernarchitektur

### Verantwortung

Zentraler Service, der steuert **wann** Daten gefetcht werden. Die bestehenden Services (`JiraService`, `BitbucketService`) behalten die Verantwortung für **wie** und **was**.

### Datenquellen-Registry

Datenquellen registrieren sich beim Service mit einer Fetch-Funktion:

```typescript
refreshService.register('jira', () => jiraService.loadTickets());
refreshService.register('bitbucket', () => bitbucketService.loadAll());
```

### State pro Datenquelle (Signals)

```typescript
interface DataSourceState {
  lastFetchTime: number | null;
  status: 'idle' | 'refreshing' | 'retrying' | 'error';
  retryAttempt: number;   // 0 = kein Retry, 1-3 = aktueller Versuch
}
```

### Globale Signals (computed)

- `isRefreshing: Signal<boolean>` — `true` wenn mindestens eine Quelle `refreshing` oder `retrying` ist
- `lastGlobalFetchTime: Signal<Date | null>` — ältester `lastFetchTime` aller Quellen (Worst-Case-Frische)
- `globalStatus: Signal<'idle' | 'refreshing' | 'retrying' | 'error'>` — aggregiert für die Sync-Bar
- `retryInfo: Signal<{ attempt: number; maxAttempts: number } | null>` — aktueller Retry-Fortschritt für die Anzeige

### Refresh-Intervall-Konstante

```typescript
const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 Minuten
```

Eine einzige Konstante, referenziert von Polling-Timer und Staleness-Check.

---

## 2. Refresh-Trigger

Vier Trigger, die alle in dieselbe `refreshAll()`-Methode münden.

### 2.1 Polling (Interval-Timer)

- `setInterval` mit `REFRESH_INTERVAL_MS`, gestartet bei Service-Init
- Ruft `refreshAll()` auf, das alle Quellen auf Staleness prüft und stale Quellen parallel fetcht
- Timer wird nach jedem erfolgreichen Refresh **zurückgesetzt**, um redundante Fetches zu vermeiden (z.B. manueller Refresh bei Minute 8 → nächster Auto-Poll bei Minute 18)

### 2.2 Visibility / Focus-Regain

- Nutzt die Browser-API `document.visibilitychange`
- Wenn das Dokument wieder sichtbar wird: prüfe ob `lastFetchTime` irgendeiner Quelle älter als `REFRESH_INTERVAL_MS` ist
- Falls stale → `refreshAll()`. Falls frisch → kein Fetch

### 2.3 Manueller Refresh (Sync-Bar-Button)

- Löst **immer** `refreshAll()` aus, unabhängig von Staleness — der Nutzer hat es explizit angefordert
- Setzt den Polling-Timer zurück

### 2.4 Error-Retry

- Wird **pro Quelle** ausgelöst wenn ein Fetch fehlschlägt (nicht über `refreshAll()`)
- 3 Retries mit exponentiellem Backoff: 3s, 6s, 12s
- Während Retries: Source-Status ist `'retrying'` mit `retryAttempt` für Fortschrittsanzeige
- Nach 3 gescheiterten Retries → Status wird `'error'`
- Der nächste `refreshAll()` (Poll, Focus, manuell) versucht die fehlerhafte Quelle erneut und setzt den Retry-State zurück

### Konsolidierung

Wenn ein Refresh triggert, werden alle stale Quellen **gleichzeitig** gestartet. Es gibt kein gestaffeltes Fetchen. Der Spinner dreht sich einmal und stoppt wenn die letzte Quelle fertig ist.

---

## 3. Sync-Bar-Komponente

### Platzierung

Sticky am unteren Rand des Navigators, mit `border-top` als visueller Trenner. Scrollt nicht mit dem Navigator-Inhalt.

### Layout

```
┌─────────────────────────────────────────────┐
│  Zuletzt aktualisiert: 14:32    [↻ Sync]   │
└─────────────────────────────────────────────┘
```

- **Links:** Zeitstempel der letzten erfolgreichen Aktualisierung (`HH:mm`-Format)
- **Rechts:** Sync-Button (Refresh-Icon + "Sync"-Label)

### Zustände

| Zustand | Linker Text | Rechter Button |
|---------|------------|----------------|
| Idle / frisch | "Zuletzt aktualisiert: 14:32" | Statisches Refresh-Icon + "Sync" |
| Refreshing (auto oder manuell) | "Aktualisiere…" | Drehendes Refresh-Icon |
| Retrying (beliebige Quelle) | "Erneuter Versuch 2/3…" | Drehendes Refresh-Icon |
| Alle Quellen fehlgeschlagen | "Aktualisierung fehlgeschlagen" | Statisches Icon + "Sync" (klickbar) |
| Teilerfolg (eine ok, eine fehlgeschlagen) | "Zuletzt aktualisiert: 14:32" | Statisches Icon (Fehler wird per-Section angezeigt) |

### Styling

- Hintergrundfarbe: leicht abgesetzt vom Navigator-Hintergrund
- Schriftgröße: `text-xs` konsistent mit dem Rest des Navigators
- Refresh-Icon: CSS-Animation `spin` während `refreshing`/`retrying`
- Dezent und unauffällig, keine dominante visuelle Präsenz

---

## 4. Änderungen an bestehenden Services

### JiraService

- Ticket-Fetch-Logik als aufrufbare Methode `loadTickets()` exponieren (falls noch nicht so strukturiert), die ein Observable zurückgibt
- `ticketsLoading` und `ticketsError` Signals nur noch für den **initialen Load** verwenden (wenn keine Daten existieren)
- Bei Folge-Refreshes: Daten werden still im Hintergrund aktualisiert, alte Daten bleiben sichtbar

### BitbucketService

- `loadAll()` existiert bereits und gibt ein Observable zurück
- Gleiche Änderung: `loading` bei Folge-Fetches nicht auf `true` setzen
- `error` Signal nur für den initialen Fehlerzustand

### WorkspaceService

- Ruft nicht mehr direkt `bitbucket.loadAll()` und die Jira-Observable auf
- Registriert stattdessen beide Quellen beim `DataRefreshService` und ruft einmalig `refreshAll()` für den initialen Load auf
- Bestehende computed Signals (`tickets`, `pullRequests`, etc.) funktionieren unverändert weiter

### Navigator-Template

- Bestehende Fehler-Anzeigen ("Tickets konnten nicht geladen werden") bleiben erhalten
- Erhalten zusätzlich einen "Erneut versuchen"-Link, der den Retry-Zyklus für die jeweilige Quelle neu startet
- Fehler werden erst nach Erschöpfung aller Retries angezeigt
- Während Retries bleiben alte Daten sichtbar (kein Layout-Shift)

---

## 5. Verhalten bei App-Start (Initialer Load)

Beim ersten Laden existieren keine vorherigen Daten. In diesem Fall:

- Die bestehenden Loading-States ("Tickets werden geladen…") greifen wie bisher
- Die Sync-Bar zeigt "Aktualisiere…" mit drehendem Icon
- Nach erfolgreichem Fetch wechselt die Sync-Bar zum Zeitstempel
- Bei Fehler: normaler Retry-Zyklus (3 Versuche), danach Fehlermeldung mit "Erneut versuchen"-Link

---

## 6. Technische Details

### Browser-API: Page Visibility

```typescript
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    this.onVisibilityRegained();
  }
});
```

Gut unterstützt in allen modernen Browsern. Zuverlässiger als `focus`-Events für Tab-Wechsel.

### Timer-Throttling in Background-Tabs

Browser drosseln `setInterval` in inaktiven Tabs (teilweise auf 1x/Minute oder vollständig pausiert). Das ist gewolltes Verhalten — der Visibility-Trigger fängt den Fall ab, dass der Poll nicht gefeuert hat.

### Kein Layout-Shift bei Refresh

Bei Folge-Refreshes (nicht Initial-Load):
1. Fetch wird im Hintergrund gestartet
2. Alte Daten bleiben in den Signals
3. Bei Erfolg: Signals werden mit neuen Daten überschrieben → Angular rendert die Änderungen
4. Bei Fehler: alte Daten bleiben, Retry-Logik greift

### Concurrent-Refresh-Schutz

Wenn `refreshAll()` aufgerufen wird während bereits ein Refresh läuft (z.B. Nutzer klickt Sync während Auto-Refresh), wird der laufende Refresh **nicht** abgebrochen und kein zweiter gestartet. Der Aufruf wird ignoriert. Ausnahme: manueller Sync setzt trotzdem den Polling-Timer zurück.

### Cleanup

- `setInterval` und `visibilitychange`-Listener werden im `DestroyRef`-Callback aufgeräumt
- Laufende Retry-Timer werden bei manuellem Refresh oder neuem `refreshAll()` abgebrochen
