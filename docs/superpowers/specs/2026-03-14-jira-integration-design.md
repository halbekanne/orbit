# Jira Server Integration — Design Spec

**Date:** 2026-03-14
**Scope:** Real HTTP integration with Jira Server via a local Express proxy and a mock Jira server for development. Only active tickets assigned to the current user are displayed (status category "In Progress").

---

## 1. Architecture

```
Angular (6200)  →  Express Proxy (6201)  →  Real Jira Server
                                         ↘  Mock Jira Server (6202, dev only)
```

Three processes, all started with one command (`npm start` via `concurrently`). In development, the proxy forwards to the mock server. To switch to real Jira, only `.env` changes — Angular and the proxy are untouched.

---

## 2. File Structure

```
orbit/
├── proxy/
│   └── index.js              (~25 lines — forwards /rest/** to Jira with PAT header)
├── mock-server/
│   └── index.js              (~80 lines — returns Jira-shaped mock data)
├── src/
│   ├── environments/
│   │   ├── environment.ts                  (production — proxyUrl: '')
│   │   └── environment.development.ts      (dev — proxyUrl: 'http://localhost:6201')
│   └── app/
│       ├── services/
│       │   ├── jira.service.ts             (new — HTTP calls + response mapping)
│       │   └── work-data.service.ts        (updated — loads tickets from JiraService)
│       └── app.config.ts                   (updated — adds provideHttpClient)
├── .env                      (not committed — JIRA_BASE_URL, JIRA_API_KEY)
├── .env.example              (committed — documents required vars)
└── package.json              (updated — new deps + scripts)
```

---

## 3. Ports

| Process | Port |
|---|---|
| Angular (Orbit) | 6200 |
| Express Proxy | 6201 |
| Mock Jira Server | 6202 |

Chosen to avoid clashes with common dev ports (3000, 4200, 5173, 8080, etc.).

---

## 4. Mock Jira Server (`mock-server/index.js`)

Plain Node.js + Express. Two endpoints, no JQL parsing — always returns the same fixed set of active tickets in full Jira response shape.

### Endpoints

**`GET /rest/api/2/myself`**
Returns a mock user object.

**`GET /rest/api/2/search`**
Ignores all query parameters. Returns a fixed list of mock issues.

### Status Category Clarification

In Jira Server, statuses belong to a status category. The "In Progress" status category (key: `indeterminate`) covers all active workflow states — including both `In Progress` and `In Review`. These are distinct status **names** but belong to the same status **category**. The mock data includes both, correctly representing the full range of active tickets.

### Response Shape

Each issue in the `issues` array contains a full `fields` object with:

- **Identity & classification:** `summary`, `issuetype` (Bug / Story / Task / Epic / Sub-task), `project` (key + name + id), `labels`, `components`, `fixVersions`, `priority` (name)
- **People:** `assignee`, `reporter`, `creator` — each with `displayName`, `name`, `emailAddress`, `avatarUrls`
- **Dates & time:** `created`, `updated`, `duedate`, `resolutiondate`, `timetracking` (originalEstimate, remainingEstimate, timeSpent)
- **Status & workflow:** `status` (name + `statusCategory` with both `key` and `name`), `resolution` (null when open)
- **Content:** `description`, `environment`, `comment` (total count + up to 3 recent comments), `attachment` (count)
- **Relations:** `subtasks` (refs), `issuelinks` (blocks / is blocked by / relates to), `parent`
- **Agile custom fields:** `customfield_10020` (Sprint — name + state), `customfield_10014` (Epic Link), `customfield_10016` (Story Points)
- **Social:** `watches` (count), `votes` (count)

The mock data is the existing five hardcoded tickets from `WorkDataService`, repackaged in Jira's JSON shape.

---

## 5. Express Proxy (`proxy/index.js`)

Plain Node.js + Express + `http-proxy-middleware`. ~25 lines.

**Behaviour:**
- Forwards all `GET /rest/**` requests to `${JIRA_BASE_URL}/rest/**`
- Injects `Authorization: Bearer ${JIRA_API_KEY}` on every forwarded request
- Enables CORS for `http://localhost:6200`
- On startup: exits immediately with a clear error message if `JIRA_BASE_URL` or `JIRA_API_KEY` are missing

No business logic. No data transformation. The proxy is transparent.

### `.env` (not committed — must be listed in `.gitignore`)
```
JIRA_BASE_URL=http://localhost:6202
JIRA_API_KEY=your-personal-access-token-here
```

### `.env.example` (committed)
```
JIRA_BASE_URL=https://jira.yourcompany.com
JIRA_API_KEY=your-personal-access-token-here
```

---

## 6. Angular Changes

### `src/environments/`

Two files, swapped by Angular's build system at build time via `fileReplacements` in `angular.json`. The `ng generate environments` command creates both files and wires `angular.json` automatically — this is the recommended approach and must be used during implementation.

```ts
// environment.development.ts
export const environment = { proxyUrl: 'http://localhost:6201' };

// environment.ts (production)
export const environment = { proxyUrl: '' };
```

When `proxyUrl` is `''`, `JiraService` constructs a relative URL (e.g. `/rest/api/2/search`), which the browser resolves against the page origin. This works correctly when Angular is served from the same origin as the proxy.

### `app.config.ts`

`provideHttpClient(withFetch())` added to providers. `withFetch()` is required because this project is fully zoneless and must not rely on Zone.js-patched XHR.

### `JiraService` (new)

Single responsibility: HTTP calls to the proxy + mapping Jira responses to internal types.

- **`getAssignedActiveTickets()`** — calls:
  ```
  GET ${environment.proxyUrl}/rest/api/2/search?jql=assignee%20%3D%20currentUser()%20AND%20statusCategory%20%3D%20%22In%20Progress%22
  ```
- The JQL `statusCategory = "In Progress"` uses the display name. This works on most Jira Server versions. If it fails during implementation, fall back to `statusCategory = indeterminate` (the category key). Verify against the target server.
- Maps raw Jira issue fields to `JiraTicket`
- Returns `Observable<JiraTicket[]>`
- On error: `catchError` logs the error and re-throws — `WorkDataService` is responsible for handling it

### `JiraTicket` model (`work-item.model.ts`)

The `overdue: boolean` field is **removed** from the `JiraTicket` interface. Overdue state is a derived, display-layer concern. It is computed in the ticket card component as a `computed()` signal or inline boolean expression from `duedate`, not stored in the model.

### `WorkDataService` (updated)

- `tickets` signal populated from `JiraService` on construction via `toSignal()` or a manual subscription
- Two new signals: `ticketsLoading: Signal<boolean>` and `ticketsError: Signal<boolean>`, both owned and set exclusively by `WorkDataService`
- `JiraService` returns an `Observable` that either emits `JiraTicket[]` or errors; `WorkDataService` subscribes and sets the loading/error signals accordingly — no circular dependency
- PRs and todos remain hardcoded — untouched

---

## 7. npm Scripts & Dependencies

### New dependencies (root `package.json`)

```json
"express": "...",
"dotenv": "...",
"http-proxy-middleware": "...",
"cors": "...",
"concurrently": "..."
```

### New scripts

```json
"start": "concurrently \"ng serve --port 6200\" \"node proxy/index.js\" \"node mock-server/index.js\"",
"start:real": "concurrently \"ng serve --port 6200\" \"node proxy/index.js\"",
"proxy": "node proxy/index.js",
"mock": "node mock-server/index.js"
```

`npm start` — full dev environment with mock Jira server.
`npm run start:real` — proxy + Angular only; points at the real Jira server configured in `.env`. Still runs locally — not a production deployment.

True production deployment (e.g. `ng build` + static hosting) is **out of scope** for this iteration.

---

## 8. Error Handling

| Layer | Behaviour |
|---|---|
| Proxy startup | Exits with clear message if env vars missing |
| `JiraService` | Re-throws error after logging; does not own state |
| `WorkDataService` | Catches error from `JiraService` observable, sets `ticketsError` to `true` |
| UI | Shows "Tickets konnten nicht geladen werden" when `ticketsError` is true |
| Loading | `ticketsLoading` is `true` until the observable completes or errors |

No retries, no complex recovery. App degrades gracefully — PRs and todos remain functional when Jira is unreachable.

---

## 9. Out of Scope

- JQL parsing in the mock server
- Pagination (mock always returns all tickets)
- Jira authentication UI
- PR or Todo integrations
- Production deployment setup (`ng build` + static hosting)
