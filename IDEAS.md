# Orbit — Ideen-Matrix (Aufwand x Wert)

> Stand: 2026-03-28

---

## Hoher Wert / Geringer Aufwand (Quick Wins)

- **Direkte Erstellung von Ideen** — Analog zu Aufgaben bereits gebaut, Pattern kopieren; senkt Hürde für Ideenerfassung (ADHS-kritisch).
- **Auto-Aktualisierung (Polling + Sync-Button)** — Polling-Intervall + manueller Refresh-Button ist technisch simpel; verhindert veraltete Daten ohne mentalen Aufwand ans Aktualisieren zu denken (ADHS-relevant). Intervall später im Settings Panel einstellbar.

---

## Hoher Wert / Mittlerer Aufwand

- **UI angleichen der Detail-Views** — Konsistenz reduziert kognitive Last massiv; PR-View als Vorlage existiert bereits, aber alle Views anfassen braucht Zeit.
- **Pomodoro-Timer** — Kernfeature für ADHS-Fokus, direkt am Nutzungszweck von Orbit; Timer-Logik + UI-Integration braucht Konzeption.
- **Wartend-Zustand mit Wiedervorlage** — Verhindert, dass Aufgaben im Kopf mitgeschleppt werden (ADHS-Entlastung); braucht Datenhaltung + Reminder-Logik.
- **Optionen/Settings Panel** — Grundinfrastruktur für viele andere Features (API-Keys, Toggles, Templates); mittel weil UI + Persistenz.
- **Tages-Terminplan (Zeitstrahl mit Drag & Drop)** — Tagesstruktur ist für ADHS-Gehirne extrem wichtig gegen Zeitblindheit; Drag-to-create braucht solide Interaktionslogik, Persistenz und seitliche Layout-Integration.
- **URL-Routing (Deep Links)** — URL-Änderung bei Selektion von Tickets, PRs, Tasks, Logbuch etc. ermöglicht Browser-Navigation (Zurück/Vorwärts), Bookmarks und teilbare Links; alle Views und Selektionszustände müssen auf Routen/Parameter gemappt werden.

---

## Hoher Wert / Hoher Aufwand

- **Bessere Ausführungsmöglichkeit (Docker/Electron)** — Ohne das kein Rollout an Kollegen; aber CI/CD-Pipeline + Packaging ist komplex.
- **Neue Tickets anlegen mit LLM + Templates** — Löst echten Pain Point; braucht LLM-Integration, Template-System, Jira-API und gute UX.
- **Tickets aus Main-Projekt anzeigen (JQL)** — Zentrales "Single Source of Truth"-Feature; braucht JQL-Config, API-Anbindung und UI-Konzept.

---

## Mittlerer Wert / Geringer Aufwand

- **Jenkins Build Neuanstoß** — Ein Button + ein API-Call; spart Kontextwechsel, aber Anwendungsfall kommt nicht täglich.
- **Action Buttons unter Header (statt Action Rail)** — UI-Umstrukturierung mit bestehendem Code; verbessert Layout spürbar.
- **Kein Sticky Header / dynamisch verschmälern** — CSS-Anpassung; gibt wertvollen Platz in der Detail-View zurück.
- **Feedback (Mailto-Link)** — Trivial umzusetzen; wichtig für Testphase, aber kein Kernfeature.
- **Notizen-Text-Bug (Escape ≠ Abbrechen)** — Falscher Hilfetext, schneller Fix; verhindert Verwirrung.
- **Quick Capture Speichern-Button** — Kleines UI-Element; hilft Nutzern die Enter nicht intuitiv finden.
- **Intelligenter Workbench-Leerstand** — Statt "Bereit loszulegen?" den Nutzer zur ersten Aktion des Tages leiten (z.B. Reflektion starten, dringendste Aufgabe vorschlagen).

---

## Mittlerer Wert / Mittlerer Aufwand

- **KI-geschätzte Review-Dauer auf PR-Karten** — Badge mit geschätzter Review-Zeit basierend auf Diff-Analyse (z.B. "~10 Min", ">30 Min"); bei kleinen Diffs KI-Einschätzung, bei großen pauschale Angabe. Hilft bei Priorisierung welches Review man als nächstes angeht.
- **Einklappbare Seitenleiste** — Flexibleres Layout; braucht Konzeption des Collapsed-State + Animation.
- **Linksammlung / Schnellzugang** — Reduziert Tab-Chaos; UI-Konzept + Konfigurierbarkeit + evtl. iFrame-Probleme.
- **Rückgängig-Machen Notizenfeld** — Gutes Safety-Net; Undo-State-Management ist nicht trivial.
- **Willkommens-Tour** — Wichtig für Onboarding neuer Nutzer; aber aktuell wenige User, lohnt sich erst später.
- **Notizenfeld größer** — Einfache Änderung, aber Wert begrenzt da Editor-Komfort nur ein kleiner Teil der UX ist.
- **Dark Mode** — Orbit ist ganztägig offen, hilft bei Augenbelastung; aber aktuelles Warm-Stone-Design ist bereits augenschonend. Alle Komponenten brauchen durchgängige `dark:`-Varianten.

---

## Mittlerer Wert / Hoher Aufwand

- **Plugin-Konzept / Extension API** — Architektonisch elegant, aber im jetzigen Stadium Overengineering; riesiger Designaufwand.
- **Mehr Gamification (Levels, Challenges)** — Potenziell gut für Dopamin, aber Konzept unklar und Umsetzung komplex; Risiko dass es eher ablenkt.

---

## Geringer Wert / Geringer Aufwand

- **"Neueste Features" Anzeige** — Nettes Polish, aber bei wenigen Nutzern und schneller Entwicklung noch unnötig.

---

## Geringer Wert / Mittlerer Aufwand

- **Maskottchen** — Sympathisch und Dopamin-fördernd, aber kein funktionaler Mehrwert; SVG-Design + Animationen brauchen Zeit.
- **Beobachtete Tickets anzeigen** — Idee noch vage; braucht API-Integration und UI-Konzept für unklaren Nutzen.

---

## Geringer Wert / Hoher Aufwand

- **Spotify-Integration** — Fun-Feature, aber tangential zum Kernzweck; OAuth + API + Player-UI ist erheblicher Aufwand für etwas das Spotify selbst besser kann.

---

Ursprüngliche Anfrage:

Ich habe einen Haufen von Ideen für Orbit, und jeden Tag fallen mir mehr Sachen ein. Features, Bugfixes, Sachen die besser sein könnten, ganze Systeme die man ausarbeiten müsste, alles mögliche. Ich möchte diese Features mal auf einem Whiteboard sammeln und in einer Matrix einteilen. Eine Achse ist "Aufwand", also zeitlicher Implementierungsaufwand bzw. auch wie komplex wird es, wie viel Zeit wird man vermutlich auch für die Konzeption der Details brauchen, du verstehst. Und auf der anderen Achse ist "Wert", oder Value, da würde ich mir immer die Frage z.B. stellen, "Wenn ich diesen Punkt angehe, wie viel besser wird Orbit als Anwendung für die gedachte Zielgruppe (hauptsächlich ich und vllt. bald ein paar Arbeitskollegen, die teilweise oder auch viele davon ADHS haben, die das Tool für ihre tägliche Arbeit als Unterstützung haben wollen, um Overwhelm zu verhindern, und alles weitere).

Bitte helfe mir, die vielen Punkte / Ideen / Gedanken grob einzuteilen, mit folgenden Kategorien:
Aufwand: gering (kurze Zeit) / mittel / hoch (lange Zeit)
Wert: gering / mittel / hoch

Es entstehen dadurch genau 9 mögliche Gruppen durch die Kombination. Bitte gib mir als Ausgabe die Punkte gruppiert in den 9 Gruppen aus, jeweils mit einer sehr kurzen Begründung, warum der Punkt in diese Gruppe gehört (1 kurzer Satz).

Hier sind meine Gedanken, Punkte, Ideen, in beliebiger Reihenfolge:

- Optionen: Ein Einstellungs-Panel, was man in Orbit öffnen kann und verschiedene Optionen enthält, z.B. um einzelne Features ein- / oder auszuschalten, um Sachen auf seinen eigenen Workflow anzupassen, um z.B. auch die Keys bequem zu setzen die man für Jira oder Bitbucket braucht, und so weiter.
- Jenkins Build Neuanstoß: Die Möglichkeit, einen Jenkins Build für einen Pull Request erneut anzustoßen - oft ist das Bauen doch unzuverlässig und wenn man einen Knopf hätte und der etwas bei Jenkins aufruft zum Neuanstoßen des Builds wäre das schon bequem.
- Action Buttons unter Header: Die Action Rail auf der rechten Seite war UI technisch nicht die beste Idee, es würde besser aussehen wenn die Buttons unterhalb des Headers und rechts neben dem Details Content wären (vllt. auch fixed position, also nicht mitscrollen) aber eine feste Seitenleiste rechts sieht nicht gut aus, wirkt auch komisch, also ja
- Kein Sticky Header: Der Sticky header nimmt in der Details View viel Platz weg, sollte man das vllt. nicht sticky machen, oder beim scrollen nach unten in eine verschmalerte Ansicht wechseln, dynamisch, oder eine andere Lösung finden?
- Einklappbare Seitenleiste: Die Seitenleiste für Action Items sollte sich einklappen lassen, damit man mehr Platz hat für den Main / Details Content, wenn man ihn braucht. Zu definieren wäre, wie die Seitenleiste im eingeklappten Zustand aussieht, gibt es sie noch, oder ist es nur noch ein Pfeil den man anklicken kann und der es dann ausfährt, da gibts sicher verschiedene Optionen
- Feedback: Wenn ich das Tool Testusern gebe, möchte ich dass sie mir Feedback geben können, vllt. erstmal einfach indem ein Textfeld mit Absenden den entsprechenden Mailto Link definiert, der mir eine Mail vorbereitet schicken kann, einfach aber effektiv. Dann wäre halt zu schauen wo man geschickt nach Feedback fragen kann, vllt. ja am Ende eines Arbeitstages nach der Reflektion.
- Linksammlung / Seiteneinbindung: Es gibt einige Seiten im Intranet die man manchmal braucht, cool wäre eine Art visuelle Linksammlung in Orbit, selbst definierbar und mit Bildern versehbar, so wie z.B. beim Vivaldi Browser, oder auch eine IFrame Einbindung (falls möglich), also irgendwie einen tollen Schnellzugang zu häufig genutzten Seiten schaffen der das ADHS Gehirn aber auch abholt.
- Maskottchen: Passend zu Orbit entwickeln wir ein lustiges passendes Maskottchen, wir nutzen KI um uns coole SVGs und Animationen mit dem Maskottchen zu schaffen, die sich durch Teile der Anwendung ziehen. Wir schaffen so mehr Dopamin und eine Bindung und so, naja schätze ich. Wäre schon irgendwie ne coole Sache.
- Bessere Möglichkeit das Tool auszuführen: Vllt. als Docker-Container oder so, damit möglichst viele das Tool schnell ausführen können ohne Node zu installieren, oder als Electron App, oder sonstiges, hauptsache es ist portabel und ohne Installation von z.B. exe oder das was mac hat nutzbar, da ansonsten bestimmte Rechte notwendig wären. Das ganze soll dann etwas bei jedem merge auf master produzieren was andere direkt runterladen und starten können. Keine Ahnung was es da für Möglichkeiten gibt, vllt. fällt mir da noch was ein.
- Die Möglichkeit, neue Tickets anlegen zu können. Wenn ein Main-Projekt in den Settings definiert sind, immer für dieses Projekt. Mit Ticket-Templates, die man in den Settings definiert. Man bekommt dann ein Eingabefeld, soll schreiben worum es geht. Dann gibt man das einem LLM mit dem Ticket-Template, er füllt das aus, den Text geben wir direkt per Jira API call an Jira und legen das Ticket an, und öffnen es dann im Browser für eine Nachbearbeitung. Quasi den Workflow fürs Ticket neu schreiben verbessern, da es schon ein pain ist neue tickets mit ticket template anzulegen.
- Quick Capture Speichern Button: Quick Capture bekommt einen Speichern-Button, falls man nicht drauf kommt enter zu drücken. Außerdem vllt. irgendwo in der Oberfläche verankert ein Button zum Quick Capture oder so? Keine ahnung irgendwie so.
- UI angleichen der Detail-Views. Momentan folgen die Detail-Views unterschiedlichen UI-Konzepten und sehen alle etwas anders aus, Jira-Tickets, Pull Requests und Notizen. Pull Requests sehen am besten aus mit diesen Separaten Sektionen, das sollten wir auf die anderen Details Views anwenden für Konsistenz.
- Der Text unterhalb des Notizen Feldes in der Detailview für Aufgaben stimmt nicht, ein Escape ist kein Abbrechen, der vorherige Zustand wird nicht wiederhergestellt.
- Rückgängig-Machen Funktion beim Notizenfeld (z.B. wenn man unbeabsichtigt gespeichert hat)
- Notizenfeld größer: Der Editor fürs Notizenfeld sollte in der Höhe etwas größer sein als jetzt.
- Direkte Erstellung von Ideen: Ideen sollte man auch mit einem Input innerhalb der Work Item Spalte direkt erstellen können, genauso wie bei Aufgaben
- Der Drag-Bereich zum Drag-Drop-Reordering von Subtasks bei Tickets oder Aufgaben ist zu klein, man kommt mit der Maus nicht so leicht exakt auf den Bereich der das Verschieben / neu Ordnen der Subtasks erlaubt, soll größer werden.
- Auch Tickets anzeigen die im Main Projekt (in Settings zu definieren) als Todos stehen, müsste man aber immer definieren vllt. mit JQL-Zeile in Settings, um genau die Tickets zu finden die man als nächstes angehen sollte (noch keine Ahnung wie man das vernünftig integrieren sollte)
- Promodoro-Timer in Orbit: Orbit bietet einen coolen Promodoro-Timer, der mitläuft, während man am Abarbeiten von Aufgaben, Tickets oder Pull Requests oder was auch immer ist. Keine Deepe Integration mit anderen Systemen, erstmal ein sichtbarer Promodoro-Timer, hilft bei ADHS und generell beim Fokus, vllt. auch mit setzen einer Intention für die Session, vllt. immer Sichtbar irgendwie, muss man schauen wie man das UI mäßig gut integriert.
- "Wartend"-Zustand. Manchmal kann man Aufgaben nicht bearbeiten sondern "wartet" auf jemanden, gut wäre wenn man definieren könnte beim Wartend setzen wann man nochmal checkt wie der Status ist, quasi ein "auf wiedervorlage" feature wo man sagen kann, zeig mir die Aufgabe nochmal in x Tagen, dann aber richtig oben und auffällig damit ich schauen kann wie das da aussieht.
- Vllt. auch Tickets, wo man kein Bearbeiter ist, aber sie beobachtet, irgendwo sichtbar machen? Extra Ansicht? Die Idee ist noch etwas wage.
- Eine Willkommens-Tour, erklärt die wichtigsten Funktionen für neue Nutzer und legt die initiale Settings an bzw. fragt schonmal ein paar wichtige Sachen vorneweg ab, z.B. welche Feature man gerne hätte usw.
- Plugin-Konzept: Jira-Integration, Bitbucket-Integration, Aufgabenmanagement, Promodoro-Timer, Die Tagesreflektion, etc. das sind alles Features, vllt. findet man eine Art "Extension" API wo eine Extension z.B. neue Seiten in Orbit definiert, oder sich irgendwie in bestimmte Hooks reinhängt. Müsste man mal genau durchdenken ob das Sinn macht und welchen Mehrwert das hätte
- "Neueste Features" Anzeige, weist den Nutzer auf die neuesten Features hin, vllt. kann er die Features auch durchblättern wenn er was verpasst hat, wäre sehr professionell aber in dem Stadium in dem wir sind (Experimentell, POC, Startup, ...) wohlmöglich too much?
- Spotify-Integration: Man kann eine Playlist o.ä. wählen, die abgespielt wird und hat einen Mini-Player, oder es synchronisiert sich mit dem Promodoro Timer und man hat für Fokus und Pausen andere Musik, irgendwie so?
- Mehr Gamification: Das ist noch nicht ganz klar, wie kann das aussehen? Vllt. ein Level-System, Challenges, Rewards? Oder doch zu verspielt und einfach too much? Vllt. auch unnötig, nicht ganz klar, müsste man mal explorieren.
- Bug im Logbuch, es steht ich habe "x weitere" Sachen erledigt aber ich kann es nicht aufklappen, ich würde das feature dass max. 3 Sachen angezeigt werden einfach erstmal entfernen, es sollen einfach alle Sachen die man geschafft hat angezeigt werden.
- URL-Routing: Wenn man ein Ticket, Pull Request, Task etc. auswählt oder auf das Logbuch wechselt, soll sich die URL ändern. So kann man Browser-Navigation (Zurück/Vorwärts) nutzen, Bookmarks setzen und Links teilen. Logische URL-Struktur.
- Auto-Aktualisierung: Orbit soll sich automatisch alle X Minuten aktualisieren (Daten neu laden), das Intervall soll später im Einstellungsfenster konfigurierbar sein. Zusätzlich ein manueller Sync-Button zum sofortigen Aktualisieren.
- Am Anfang des Tages soll man seine Termine auf einem Zeitstrahl / Tagesanzeige per Drag & Drop ziehen können. Also ich sehe den Zeitstrahl, mache drag & drop darauf, es       
  bildet sich ein Kasten der die Zeit angibt. Beim Loslassen werde ich direkt gefragt wie der Termin heißt. So ist eine Blitzschnelle Anlage von einem Tagesplan möglich. Der Tages-Terminplan soll dann die    
  ganze Zeit z.B. am rechten Rand der Anwendung einblendbar sein. Keine Wochenansicht, keine Monatsansicht, nur die Tagesansicht. In der Reflektion kann man auch sehen, welche Termine man hatte. Keine        
  Einbettung per API von externen Kalendern.
