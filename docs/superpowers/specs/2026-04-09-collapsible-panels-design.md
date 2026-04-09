# Collapsible Side Panels

## Kontext

Die Arbeits-View hat zwei Seitenpanels: den Navigator (links, 360–400px) und den Tagesplan-Kalender (rechts, 260px). Beide sind aktuell fest sichtbar und nehmen viel Platz ein. Der Kalender hat bereits eine rudimentäre Collapse-Funktion (schmaler 8px-Streifen mit einzelnem Chevron), die aber optisch nicht hochwertig ist.

Ziel: Beide Panels sollen sich elegant ein- und ausklappen lassen — mit einheitlichem Pattern, inspiriert von Sunsama. Default ist ausgeklappt.

## Design

### Verhalten

- **Ausgeklappt (Default):** Panel ist voll sichtbar. Im Header sitzt ein subtiler Toggle-Button (rechts im linken Panel, links im rechten Panel).
- **Eingeklappt:** Panel verschwindet komplett. Ein kleiner, unauffälliger Button erscheint in der entsprechenden Ecke des Workbench-Bereichs (oben links für Navigator, oben rechts für Kalender).
- **Unabhängig:** Beide Panels werden separat gesteuert. Jede Kombination ist möglich.
- **Persistenz:** Zustand wird in localStorage gespeichert, überlebt Page-Reloads.

### Icons (Lucide)

| Zustand                  | Links (Navigator) | Rechts (Kalender) |
| ------------------------ | ----------------- | ----------------- |
| Ausgeklappt → Einklappen | `PanelLeftClose`  | `PanelRightClose` |
| Eingeklappt → Aufklappen | `PanelLeftOpen`   | `PanelRightOpen`  |

### Toggle-Button Styling

- **Im Header (ausgeklappt):** Ghost-Button, `text-muted`, hover → `text-body` + `bg-surface`. Kein Border, kein Background im Ruhezustand. Subtil und unauffällig.
- **Im Workbench (eingeklappt):** Leicht sichtbarer Button mit `bg-surface`-Background und `border-subtle` Border. Rundet sich ein (border-radius). Hover → etwas prominenter. Positioniert sich absolut in der Ecke, überlagert den Workbench-Content nicht störend.
- Beide Varianten: `focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)]`, `transition-colors duration-100`.

### Animation

- 150ms `transition` auf `width` (oder `max-width`) + `opacity` des Panels.
- Panel gleitet raus, Workbench expandiert flüssig nach.
- `@media (prefers-reduced-motion: reduce)` → keine Transition.

### localStorage Keys

- Navigator: `orbit.navigator.sidebarCollapsed` (neuer Key, existierender `orbit.navigator.collapsed` bleibt für Sections)
- Kalender: `orbit.dayCalendar.collapsed` (bestehender Key wird weiterverwendet)

## Betroffene Dateien

### `src/app/shared/view-arbeit/view-arbeit.ts` + `.html`

- Neuen `sidebarCollapsed` Signal hinzufügen mit localStorage-Init
- `toggleSidebar()` Methode
- Template: `@if`-Bedingung um `<aside>`, Toggle-Button im Workbench-Bereich wenn eingeklappt
- Lucide-Imports: `LucidePanelLeftClose`, `LucidePanelLeftOpen`

### `src/app/shared/navigator/navigator.ts` + `.html`

- Toggle-Button im Navigator-Header hinzufügen (ruft Parent-Methode auf via Output)
- Oder: Toggle-Button direkt in `view-arbeit.html` im `<aside>`-Header platzieren (einfacher, da state in ViewArbeit lebt)

### `src/app/calendar/day-calendar-panel/day-calendar-panel.ts`

- Bestehende Collapse-Logik refactorn: schmaler 8px-Streifen entfernt
- Stattdessen: Panel verschwindet komplett wenn collapsed
- Toggle-Button im Header wie Navigator (mit `PanelRightClose`)
- `hostClass` computed anpassen: collapsed → `hidden` oder `w-0 overflow-hidden`
- Aufklapp-Button wird von `view-arbeit.html` gerendert (nicht vom Panel selbst)

### `src/app/shared/view-arbeit/view-arbeit.html`

- Aufklapp-Buttons für beide Panels im Workbench-Bereich rendern, positioniert absolut oben links/rechts
- Kalender-`@if` anpassen: nicht mehr `settingsService.dayCalendarEnabled()` allein, sondern auch collapse-state berücksichtigen (enabled = Feature an, collapsed = nur visuell versteckt)

## Abgrenzung

- Kein Keyboard-Shortcut in diesem Schritt
- Kein Overlay/Drawer-Modus
- Kein Resize per Drag

## Verifikation

1. `ng test --no-watch` — alle Tests müssen grün sein
2. `npx ng build` — Build muss durchlaufen
3. Manuell: Sidebar ein-/ausklappen, Kalender ein-/ausklappen, alle 4 Kombinationen testen
4. Manuell: Page Reload → Zustand bleibt erhalten
5. Manuell: Dark Mode prüfen
6. Manuell: `prefers-reduced-motion` prüfen (Animation deaktiviert)
