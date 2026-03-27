# Orbit — Architectural Review

## System Overview

Orbit is a three-part system:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Angular Frontend (ng serve, :6200)                                  │
│  Signal-based SPA, all UI logic                                      │
│  → All HTTP goes to proxy at localhost:6201                          │
└───────────────────────┬──────────────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────────────┐
│  Proxy Server (proxy/index.js, :6201)                                │
│  Express app serving three roles:                                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 1. API Proxy: /jira/* → Jira API, /bitbucket/* → Bitbucket API│  │
│  │    Injects auth tokens from .env                               │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ 2. Local Data API: /api/todos, /api/ideas, /api/logbuch,     │  │
│  │    /api/day-schedule, /api/tickets/:key                       │  │
│  │    Reads/writes JSON files in ~/.orbit/                        │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ 3. CoSi AI Review: /api/cosi/review                          │  │
│  │    SSE endpoint, orchestrates multi-agent code review         │  │
│  │    via proxy/cosi.js + proxy/agents/                          │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Mock Servers (mock-server/, :6202 + :6203)                          │
│  Standalone Express apps that mimic Jira and Bitbucket APIs          │
│  Used for local dev without real credentials                         │
│  Started alongside proxy via `npm start` (concurrently)              │
└──────────────────────────────────────────────────────────────────────┘
```

**Startup modes:**
- `npm start` — frontend + proxy + mock servers (local dev, no credentials needed)
- `npm run start:real` — frontend + proxy only (connects to real Jira/Bitbucket)

---

## Frontend Architecture Map

### Layout Structure

```
AppComponent
├── HybridRailComponent          (vertical nav rail — view switcher + theme toggle)
├── ViewArbeitComponent           (main "work" view)
│   ├── NavigatorComponent        (left sidebar — all work item lists)
│   ├── WorkbenchComponent        (center — detail view container)
│   │   ├── TicketDetailComponent
│   │   ├── PrDetailComponent
│   │   ├── TodoDetailComponent
│   │   ├── IdeaDetailComponent
│   │   └── RhythmDetailComponent
│   └── DayCalendarPanelComponent (right sidebar — timeline + pomodoro)
├── ViewLogbuchComponent          (logbook/journal view)
├── QuickCaptureComponent         (Ctrl+K overlay)
├── PomodoroOverlayComponent      (full-screen break/focus overlay)
└── PomodoroProgressBarComponent  (top bar during focus)
```

### Service Dependency Graph

```
WorkDataService (central orchestrator)
├── JiraService           → HTTP → Proxy /jira/* → Jira REST API
├── BitbucketService      → HTTP → Proxy /bitbucket/* → Bitbucket REST API
├── TodoService           → HTTP → Proxy /api/todos → ~/.orbit/todos.json
│   └── DayRhythmService  → HTTP → Proxy /api/logbuch → ~/.orbit/logbuch.json
├── IdeaService           → HTTP → Proxy /api/ideas → ~/.orbit/ideas.json
└── TicketLocalDataService → HTTP → Proxy /api/tickets/:key → ~/.orbit/tickets/<key>.json

FocusService
├── WorkDataService
├── TodoService
└── IdeaService

PomodoroService          (self-contained, localStorage)
DayScheduleService       (HTTP → Proxy /api/day-schedule → ~/.orbit/day-schedule.json)
ThemeService             (self-contained, localStorage)
CosiReviewService        (fetch SSE → Proxy /api/cosi/review → CoSi AI API)
```

### Data Flow

1. **On app startup**: WorkDataService constructor fires two effects — one loads Jira tickets (via RxJS Observable → toSignal), the other loads Bitbucket PRs (via imperative subscribe inside effect). TodoService, IdeaService, DayRhythmService, and DayScheduleService each auto-load in their constructors.
2. **State lives in services**: Each domain service holds its data in signals. WorkDataService aggregates and exposes tickets + PRs. Todos, ideas, day entries live in their own services.
3. **Selection state**: `WorkDataService.selectedItem` signal. Components read this to show the detail view.
4. **View switching**: Signal-based (`activeView` in AppComponent), not Angular Router. No URL routing.
5. **Persistence split**: External data (tickets, PRs) is read-only from Jira/Bitbucket. Local data (todos, ideas, logbook, schedule, ticket subtasks) is read/written as JSON files in `~/.orbit/` via the proxy's local data API. Pomodoro and theme state use localStorage directly (no server round-trip).

---

## Backend Architecture Map

### proxy/ — The "Backend for Frontend"

**Current name:** `proxy/` — this is misleading. It started as a proxy (passing requests to Jira/Bitbucket with injected auth tokens), but has grown into a full backend that also serves local data APIs and orchestrates AI-powered code reviews. Only 2 of its 3 roles are proxying.

**Structure:**
```
proxy/
├── index.js              (170 lines — Express app: all routes, all middleware, JSON file I/O)
├── cosi.js               (309 lines — CoSi AI review orchestration + consolidator logic)
├── cosi-mock.js          (387 lines — Mock review scenarios for UI development)
├── cosi.test.js          (311 lines)
├── cosi-mock.test.js     (71 lines)
└── agents/
    ├── index.js           (10 lines — agent registry)
    ├── agent-definition.js (47 lines — type defs + shared constraints)
    ├── ak-abgleich.js     (87 lines — acceptance criteria agent)
    ├── code-quality.js    (87 lines — code quality agent)
    └── accessibility.js   (127 lines — WCAG AA accessibility agent)
```

**index.js is doing too much (170 lines, 3 distinct roles):**
1. **API proxy** (lines 64–90): Forward `/jira/*` and `/bitbucket/*` with auth header injection
2. **Local data API** (lines 92–164): CRUD for todos, ideas, logbook, day-schedule, ticket subtasks — all stored as JSON files in `~/.orbit/`
3. **CoSi review endpoint** (lines 27–55): SSE streaming endpoint that delegates to `cosi.js`

Plus the `/config` endpoint, CORS setup, and JSON helpers.

**CoSi review system (`cosi.js` + `agents/`):**
- Multi-agent architecture: 3 specialist agents (AK-Abgleich, Code-Quality, Accessibility) run in parallel against a PR diff
- Each agent calls CoSi API (Gemini behind a corporate proxy) with structured output schemas
- A consolidator agent then filters, deduplicates, and quality-gates the combined findings
- Results stream to the frontend via SSE events
- Well-structured: agents are registered in a registry, have clear interfaces (`AgentDefinition`), and are independently testable

### mock-server/ — Mock External APIs

```
mock-server/
├── jira.js       (541 lines — mock Jira REST API on :6202)
└── bitbucket.js  (808 lines — mock Bitbucket REST API on :6203)
```

These are standalone Express servers providing realistic mock data for local development. They include German-language tickets, PRs with multiple reviewers, build status, diff fixtures, and activity histories.

---

## What Is Already Good

These things should be preserved:

- **Signal-based reactivity throughout.** The app consistently uses signals, computed, and effects. This is modern Angular done right.
- **OnPush everywhere.** Every component uses `ChangeDetectionStrategy.OnPush`.
- **Well-typed models.** `WorkItem` is a proper discriminated union with `type` field. Review models use tagged unions. Types are specific, not `any`-heavy.
- **Semantic color token system.** `tokens.css` with CSS custom properties for light/dark mode is well-designed and consistently used.
- **Card state system.** The three-tier inactive/normal/attention system is clear and consistently applied.
- **Small, focused presentational components.** Cards (ticket-card, pr-card, todo-card, idea-card) are clean, input-driven, and easy to understand.
- **SubTaskListComponent.** A genuinely reusable component with clear inputs/outputs.
- **Celebration/dopamine feedback.** `spawnConfetti()` and `playChime()` are thoughtful — respects `prefers-reduced-motion`, uses Web Audio API.
- **Pomodoro service.** Clean timer logic with session recovery from localStorage. The `tick` signal pattern for driving computed reactivity is clever.
- **German UI language is consistent.** All user-facing text is in German.
- **The ADHD UX principles are reflected in the code.** Spatial stability, progressive disclosure in collapsible sections, frictionless external links.

### Backend

- **CoSi agent architecture.** The multi-agent review system is well-designed: clear `AgentDefinition` interface, agent registry, each agent in its own file with a focused responsibility. Adding a fourth review agent would be trivial — create a file, implement the interface, add to the registry.
- **Safe file writes.** `writeJson()` in `proxy/index.js` uses write-to-temp-then-rename, which prevents data corruption on crash. Good practice for a tool that stores user data.
- **Mock servers are realistic.** German-language tickets, multiple PR states, build statuses, activity history, diff fixtures — this enables real UI development without credentials.
- **SSE streaming for review.** The event-driven architecture (`agent:start`, `agent:done`, `consolidator:start/done`) gives the frontend granular real-time progress. Well-thought-out protocol.
- **Test coverage for CoSi.** Both the real orchestrator and mock are tested. The tests validate the SSE event sequence and data contracts.

---

## Naming Issues

### Services

| Current Name | Problem | Suggested Name | Rationale |
|---|---|---|---|
| `WorkDataService` | "Work data" is vague — this is the central orchestrator that aggregates all sources, manages selection, and handles promotion/demotion | `WorkspaceService` | It manages the workspace state: what's loaded, what's selected, cross-domain operations |
| `TicketLocalDataService` | "Local data" is confusing — it manages subtasks that are stored locally (not in Jira) | `TicketSubtaskService` | That's exactly what it does: manage local subtasks for Jira tickets |
| `DayRhythmService` | "Rhythm" is an internal concept that would confuse a new developer | `DailyReflectionService` | It manages morning/evening reflections and daily entries |

### Components

| Current Name | Problem | Suggested Name | Rationale |
|---|---|---|---|
| `HybridRailComponent` | "Hybrid" is meaningless — it's the main navigation rail | `AppRailComponent` | Simple, descriptive |
| `ActionRailComponent` | It's not really a "rail" — it's a contextual action panel | `ItemActionsComponent` | It shows actions for the selected item |
| `WorkbenchComponent` | Acceptable but generic — it's specifically the detail view container | `DetailPanelComponent` | Describes its actual role more precisely |
| `RhythmCardComponent` | See DayRhythmService above | `ReflectionCardComponent` | Matches the domain concept |
| `RhythmDetailComponent` | Same | `ReflectionDetailComponent` | Matches the domain concept |

### Utility Files in `components/`

| File | Problem | Suggestion |
|---|---|---|
| `pr-jira-key.ts` | Utility function living in components/ | Move to `utils/pr-jira-key.ts` |
| `pr-status-label.ts` | Same | Move to `utils/pr-status-label.ts` |
| `pr-status-class.ts` | Same | Move to `utils/pr-status.ts` (merge with pr-status-colors.ts) |
| `pr-status-colors.ts` | Same, and overlaps with pr-status-class.ts | Merge into `utils/pr-status.ts` |

### Models

| Current | Problem | Suggestion |
|---|---|---|
| `work-item.model.ts` | Contains everything: tickets, PRs, todos, ideas, build status, focus targets — 150+ lines | Keep as is. It's a single-domain model file. Splitting would scatter related types across files, making imports worse. The file is cohesive because all these types represent "things you work on." |

### Backend Naming

| Current | Problem | Suggestion |
|---|---|---|
| `proxy/` directory | Only 2 of 3 roles are proxying. It's really the backend server. | Rename to `server/` |
| `proxy/index.js` | 170-line monolith serving 3 unrelated roles | Split (see architectural issues below) |
| `cosi-mock.js` | "Mock" is ambiguous — it mocks the CoSi review *pipeline*, not the CoSi *API* | `cosi-demo.js` or keep as-is (the name is clear enough in context) |
| `mock-server/` directory | Fine, but consider `mock-apis/` to be more specific | Optional rename |

### Signals in `WorkDataService`

| Current | Problem | Suggestion |
|---|---|---|
| `rhythmSelected` | Selection state that has nothing to do with "work data" | This should move to a selection service or stay in WorkDataService if renamed to WorkspaceService |

---

## Architectural Issues (Ordered by Impact)

### 1. WorkDataService is a God Service

**Impact: High**

WorkDataService currently handles:
- Aggregating Jira tickets (via toSignal)
- Fetching, deduplicating, enriching, and sorting PRs (70+ lines of complex RxJS in a single effect)
- Managing selection state (`selectedItem`, `rhythmSelected`)
- Cross-domain operations (`promoteToTodo`, `demoteToIdea`)
- Preloading ticket subtask data

This makes it the hardest file to understand and the most fragile to change.

**Recommendation:** Split into focused concerns:
- **`WorkspaceService`** — selection state (`selectedItem`, `rhythmSelected`), cross-domain operations (promote/demote)
- **`PullRequestAggregator`** (or keep the enrichment logic inside `BitbucketService`) — the 70-line PR fetching/enrichment/deduplication effect should move closer to where PRs are defined. BitbucketService already knows how to fetch PRs; it should also know how to enrich them.
- Ticket aggregation is simple enough (one `toSignal` call) that it can stay in the workspace service.

### 2. TodoDetail and IdeaDetail Are Nearly Identical

**Impact: Medium**

These two components share:
- The same inline edit pattern (title editing with enter/escape, description editing with ctrl+enter)
- The same draft signals (`editingTitle`, `editingDescription`, `draftTitle`, `draftDescription`)
- The same keyboard handlers (`onTitleKeydown`, `onDescriptionKeydown`)
- The same `saveTitle`/`saveDescription` pattern (update service, update selectedItem)
- The same `formatDate` utility
- The same SubTaskList integration

The only differences are: the model type (Todo vs Idea), the service (TodoService vs IdeaService), the header layout, and status badge logic.

**Recommendation:** Don't create a shared base class or abstract component — that would be the wrong abstraction. Instead, consider extracting a small `EditableTextFieldComponent` or just keep the duplication as-is if you're not planning more item types. The duplication is contained and not growing. If a third editable detail view appears (e.g., for "Notes" in IDEAS.md), then extract.

**Assessment:** This is annoying but not urgent. Flag for extraction if/when a third detail type appears.

### 3. No Angular Router Usage

**Impact: Medium** (becomes high when URL routing is implemented — it's in IDEAS.md)

The app uses signal-based view switching (`activeView` in AppComponent) instead of Angular Router. Routes exist in `app.routes.ts` but the array is empty. This means:
- No browser back/forward navigation
- No deep linking
- No URL-based state

**Recommendation:** When URL routing (from IDEAS.md) is implemented, migrate to Angular Router properly. For now, the current approach is fine for 2 views. But be aware that selection state (`selectedItem`) will also need to be URL-driven, which means WorkDataService's selection logic will need to change.

### 4. Mixed Observable/Signal Patterns

**Impact: Low-Medium**

- JiraService and BitbucketService return RxJS Observables
- TodoService, IdeaService, and all other services use signals
- WorkDataService bridges between them (toSignal, imperative subscribe)

This isn't a bug, but it creates two mental models. The Observable services (Jira, Bitbucket) are read-only data fetchers, so Observables make sense. But the bridging code in WorkDataService is where complexity accumulates.

**Recommendation:** This is acceptable. The external API services (Jira, Bitbucket) naturally fit Observables because they're HTTP-based and stream-like (the PR enrichment pipeline). Local data services (Todo, Idea) naturally fit signals because they're CRUD with local state. The bridge in WorkDataService/WorkspaceService is the cost of this split, and it's manageable.

### 5. `today` in TodoService Is Hardcoded at Init

**Impact: Low** (but will bite you exactly when it matters — at midnight)

```typescript
private readonly today = new Date().toDateString();
```

This is set once when the service is created and never updates. If Orbit is open overnight (which it might be on a second monitor), todos won't filter correctly after midnight.

**Recommendation:** Make `today` a computed signal driven by a timer that updates at midnight, or driven by the same interval that updates `currentHour` in DayRhythmService.

### 6. `currentHour` in DayRhythmService Is Static

**Impact: Low**

Same problem as above — set once, never updates. The rhythm phase computation depends on it.

**Recommendation:** Note that AppComponent already has a 5-minute interval that calls `rhythmService.updateCurrentHour()`. Verify this actually works. If it does, this is already handled. If not, the timer should drive both `currentHour` and `today`.

### 7. PR Enrichment Effect Fires Unconditionally

**Impact: Low**

The second effect in WorkDataService's constructor runs immediately and unconditionally. It uses `untracked()` to avoid dependency tracking, then subscribes to an observable chain. This means:
- It runs once and done (no re-fetching)
- The subscription is never cleaned up
- If the effect re-runs for any reason, it creates duplicate subscriptions

**Recommendation:** This is not a bug in practice (the effect runs once), but it's fragile. When moving PR loading logic, ensure proper subscription management.

### 8. `canReview` Signal in CosiReviewService Is Dead Code

**Impact: Low**

The signal exists and is checked in the action rail template, but it's never set to `true`. It's initialized as `signal(false)` and never updated.

**Recommendation:** Either implement the intended gating logic or remove it.

---

## Backend Architectural Issues (Ordered by Impact)

### 9. proxy/index.js Is a Monolith Serving Three Unrelated Roles

**Impact: High**

One 170-line file handles:
1. API proxying (Jira, Bitbucket auth injection)
2. Local data CRUD (todos, ideas, logbook, schedule, tickets)
3. CoSi review SSE endpoint
4. Config endpoint, CORS, JSON helpers

A developer looking for "where does the todo API live?" has to scan past proxy middleware and SSE streaming code.

**Recommendation:** Split into route modules:

```
server/                          (renamed from proxy/)
├── index.js                     (Express setup, CORS, mount route modules)
├── routes/
│   ├── proxy-routes.js          (/jira/*, /bitbucket/* — auth-injecting proxy)
│   ├── local-data-routes.js     (/api/todos, /api/ideas, etc. — JSON file CRUD)
│   └── review-routes.js         (/api/cosi/review — SSE endpoint)
├── lib/
│   ├── json-store.js            (readJson/writeJson helpers, ORBIT_DIR constant)
│   └── cosi.js                  (review orchestration — unchanged)
├── agents/                      (unchanged)
└── cosi-mock.js                 (unchanged)
```

The goal is not to create an elaborate structure — it's to make `index.js` a thin entry point that mounts 3 clearly separated concerns. Each route file would be ~30–50 lines.

### 10. Mock Servers Have Hardcoded 3-Second Delays

**Impact: Low-Medium**

Both `mock-server/jira.js` and `mock-server/bitbucket.js` add a 3-second delay to every request (`setTimeout(next, 3000)`). This simulates real API latency but makes development painful when iterating on UI.

**Recommendation:** Make the delay configurable via environment variable (e.g., `MOCK_DELAY=0` for fast mode, `MOCK_DELAY=3000` for realism). Default to a short delay (200–500ms) that still feels real but doesn't waste developer time.

### 11. Mock Server Files Are Monolithic

**Impact: Low**

`mock-server/bitbucket.js` is 808 lines. ~477 of those are `DIFF_FIXTURES` — hardcoded diff strings. `mock-server/jira.js` is 541 lines, mostly mock issue data.

This isn't a bug — mock data is inherently verbose. But it makes the files hard to navigate when you need to modify a route handler vs. modify mock data.

**Recommendation:** Extract fixtures to separate files:

```
mock-server/
├── jira.js                (server + routes only, ~80 lines)
├── bitbucket.js           (server + routes only, ~120 lines)
└── fixtures/
    ├── jira-issues.js     (mock issue data)
    ├── bitbucket-prs.js   (mock PR data)
    └── bitbucket-diffs.js (DIFF_FIXTURES)
```

This is a "nice to have" — the current structure works. But when you add more mock data (e.g., for the JQL-based ticket feature in IDEAS.md), the files will keep growing.

### 12. No Shared Type Definitions Between Frontend and Backend

**Impact: Low** (but grows with the system)

The frontend defines TypeScript models (`work-item.model.ts`, `review.model.ts`) and the backend returns matching JSON — but there's no shared contract. The SSE event types (`agent:start`, `agent:done`, `consolidator:done`) are implicitly defined by what `cosi.js` emits and what `cosi-review.service.ts` parses.

If someone changes the backend response shape, the frontend breaks silently at runtime.

**Recommendation:** This is acceptable at the current scale (one developer). If the team grows or the API surface expands, consider:
- A shared `types/` directory with TypeScript interfaces used by both sides
- Or at minimum, documenting the API contract in a single place

For now, the test files (`cosi.test.js`) serve as an implicit contract — they validate the shape of emitted events.

### 13. CoSi Agent System Prompt References "Lit/Web Components" Design System

**Impact: Low** (correctness issue)

The `SHARED_CONSTRAINTS` in `proxy/agents/agent-definition.js` repeatedly reference Lit Web Components, Shadow DOM, `connectedCallback`, and SCSS — but Orbit is an Angular app using Tailwind CSS. The CoSi agents review PRs from a *different* project (the user's work codebase, which uses Lit), not Orbit itself.

**Assessment:** This is not a bug — it's correct for the agents' intended use case (reviewing the user's work PRs, which are from a Lit-based design system). But it could confuse someone reading the Orbit codebase who assumes the agents review Orbit code. A brief comment in `agent-definition.js` explaining this would help.

---

## Folder Structure Assessment

### Project Root

```
orbit/
├── src/                 (Angular frontend)
├── proxy/               (Backend — should be renamed to server/)
├── mock-server/         (Mock Jira/Bitbucket APIs)
├── public/              (Static assets)
├── .env                 (Credentials — gitignored)
├── .env.example         (Template for credentials)
├── package.json         (Both frontend and backend deps in one package)
└── angular.json, tsconfig.json, etc.
```

**Single package.json for frontend and backend:** Both the Angular frontend deps (Angular, RxJS, diff2html) and the backend deps (Express, http-proxy-middleware, cors) live in one `package.json`. This is fine for a personal tool — separate packages would add workspace complexity without real benefit. But it means `npm install` pulls in everything, and the frontend build includes backend devDependencies in the lockfile.

### Frontend (`src/app/`)

```
src/app/
├── components/     (30 items — all components + 4 utility files)
├── data/           (1 file — daily questions)
├── models/         (5 files)
├── pipes/          (2 files)
├── services/       (12 files)
├── shared/         (1 file — celebration)
└── views/          (2 views)
```

**Assessment:** This is fine for the current scale. The flat `components/` directory has 30 items, which is at the upper limit of comfortable scanning. But grouping by feature domain (e.g., `components/pomodoro/`, `components/pr/`) would add directory nesting without real benefit at this size.

**One change worth making:** Create a `utils/` directory and move the 4 utility files out of `components/`:
- `pr-jira-key.ts` → `utils/pr-jira-key.ts`
- `pr-status-label.ts` → `utils/pr-status.ts` (merge)
- `pr-status-class.ts` → merge into above
- `pr-status-colors.ts` → merge into above

Also move `celebration.ts` from `shared/` to `utils/` (or keep `shared/` — it's a naming preference). The point is that `shared/` with exactly one file is a directory that doesn't earn its existence.

### Backend (`proxy/` → `server/`)

See issue #9 above for the recommended split. The agents/ subdirectory is already well-organized.

---

## Technical Debt

### Confirmed Issues

1. **`Date.now()` for ID generation** (IdeaService, SubTask factory) — not unique if multiple calls in same millisecond. SubTask factory already adds a random suffix, but IdeaService doesn't.
2. **No subscription cleanup** in WorkDataService effect, IdeaService `save()`, TodoService operations. For a long-running app on a second monitor, this matters.
3. **Stub audio methods** in PomodoroOverlayComponent — `playChime()` and `playSoftChime()` are referenced but the implementation is incomplete (the shared celebration utility has a working chime).
4. **The AGENTS.md color system references `indigo`** but the actual app uses `violet`. AGENTS.md appears to be outdated documentation from before the color migration.

### Not Actually Debt

- The Jira markup pipe's regex-based parser is complex but well-structured with the stash pattern. It works and doesn't need rewriting.
- The `setTimeout` choreography in animation components (RhythmCard, RhythmDetail) is the pragmatic way to sequence CSS animations in Angular. An animation framework would be heavier.

---

## Recommendations Summary (Prioritized)

### Do Now (High Impact, Low Risk)

1. **Rename `proxy/` → `server/`** and update npm scripts in `package.json`
2. **Split `server/index.js` into route modules** — proxy-routes, local-data-routes, review-routes (see issue #9)
3. **Rename `WorkDataService` → `WorkspaceService`** and update all imports
4. **Rename `HybridRailComponent` → `AppRailComponent`**
5. **Rename `DayRhythmService` → `DailyReflectionService`** and rename the related components (`RhythmCard` → `ReflectionCard`, `RhythmDetail` → `ReflectionDetail`)
6. **Rename `TicketLocalDataService` → `TicketSubtaskService`**
7. **Create `utils/` directory**, move PR utility functions there, merge the three PR status files into one
8. **Fix the static `today` in TodoService** — make it reactive

### Do Soon (Medium Impact, Medium Risk)

9. **Extract PR enrichment logic from WorkDataService** — move it into BitbucketService or a dedicated `PullRequestStore` that encapsulates fetching + enrichment + sorting
10. **Split selection state from data aggregation** — whether WorkspaceService keeps selection or it moves to a thin `SelectionService`, make the boundary explicit
11. **Remove dead `canReview` signal** from CosiReviewService (or implement it)
12. **Fix AGENTS.md** — it references the old indigo color system; should reference violet
13. **Make mock server delays configurable** — env var `MOCK_DELAY` defaulting to a short value

### Do When Relevant (Future-Proofing)

14. **Extract mock server fixtures** into separate files — when adding more mock data (e.g., JQL ticket feature)
15. **Extract inline editing pattern** from TodoDetail/IdeaDetail — but only if a third editable detail type is added
16. **Migrate to Angular Router** — when URL routing feature is implemented
17. **Add subscription cleanup** — use `DestroyRef` and `takeUntilDestroyed()` in services that subscribe imperatively
18. **Shared type definitions** between frontend and backend — when team grows beyond one developer

---

## What NOT to Change

- **Don't restructure the frontend folder layout** into feature modules. The flat structure works at this scale.
- **Don't convert Jira/Bitbucket services to signals.** They're HTTP-based data fetchers; Observables are the right fit.
- **Don't add a state management library** (NgRx, etc.). Signals + services are the right weight for this app.
- **Don't refactor the Jira markup pipe.** It works and its complexity is contained.
- **Don't extract a "base detail component."** The duplication between TodoDetail and IdeaDetail is contained and not worth an abstraction yet.
- **Don't split into separate npm packages** (monorepo/workspaces). Single `package.json` is fine for a personal tool.
- **Don't restructure the CoSi agent system.** The agent registry pattern, agent interfaces, and consolidator flow are already clean and extensible.
- **Don't extract mock data into a database or external files prematurely.** JSON-in-JS works fine for mock servers. Only extract fixtures when the files become hard to navigate.
