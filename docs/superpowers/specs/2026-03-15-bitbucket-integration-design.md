# Bitbucket Integration — Design Spec

**Date:** 2026-03-15
**Scope:** Real HTTP integration with Bitbucket Data Center via the shared Express proxy and a dedicated mock Bitbucket server for development. Only open pull requests where the current user is a reviewer are displayed.

---

## 1. Architecture

```
Angular (6200)
  ├── /jira/rest/**      →  Proxy (6201) strips /jira      →  Real Jira Server
  └── /bitbucket/rest/** →  Proxy (6201) strips /bitbucket →  Real Bitbucket Server

Dev:
  ├── JIRA_BASE_URL      = http://localhost:6202  →  Mock Jira Server (mock-server/jira.js)
  └── BITBUCKET_BASE_URL = http://localhost:6203  →  Mock Bitbucket Server (mock-server/bitbucket.js)
```

One proxy process handles both services via path-based routing. In development both `JIRA_BASE_URL` and `BITBUCKET_BASE_URL` point to their respective mock servers. Switching to real servers requires only `.env` changes.

---

## 2. File Changes

```
orbit/
├── proxy/
│   └── index.js                     (updated — /jira and /bitbucket routing)
├── mock-server/
│   ├── jira.js                      (renamed from index.js — no logic changes)
│   └── bitbucket.js                 (new — mock Bitbucket API on port 6203)
├── smoke-test/
│   └── index.js                     (updated — new mock filename, env vars, proxy path)
├── src/
│   ├── environments/
│   │   ├── environment.ts           (unchanged — proxyUrl: '')
│   │   └── environment.development.ts (unchanged — proxyUrl: 'http://localhost:6201')
│   └── app/
│       ├── models/
│       │   └── work-item.model.ts   (updated — rich PullRequest model + supporting types)
│       ├── services/
│       │   ├── jira.service.ts      (updated — baseUrl uses /jira/rest/api/2)
│       │   ├── bitbucket.service.ts (new — HTTP calls + response mapping)
│       │   └── work-data.service.ts (updated — pullRequests from BitbucketService)
│       └── components/
│           ├── pr-card/pr-card.ts   (updated — new model field paths)
│           └── pr-detail/pr-detail.ts (updated — new model field paths)
├── .env.example                     (updated — BITBUCKET_BASE_URL, BITBUCKET_API_KEY)
└── package.json                     (updated — renamed mock script, new mock:bitbucket)
```

---

## 3. Ports

| Process | Port |
|---|---|
| Angular (Orbit) | 6200 |
| Express Proxy | 6201 |
| Mock Jira Server | 6202 |
| Mock Bitbucket Server | 6203 |

---

## 4. Proxy (`proxy/index.js`)

The current `pathFilter: '/rest'` approach is replaced entirely. The new proxy uses two `createProxyMiddleware` instances with `pathFilter` set to the service prefix and `pathRewrite` to strip it before forwarding. All four env vars are required on startup — the proxy exits with a clear error message if any are missing.

```
/jira/**      → pathFilter: '/jira',      pathRewrite: { '^/jira': '' }      → JIRA_BASE_URL      + Authorization: Bearer JIRA_API_KEY
/bitbucket/** → pathFilter: '/bitbucket', pathRewrite: { '^/bitbucket': '' } → BITBUCKET_BASE_URL + Authorization: Bearer BITBUCKET_API_KEY
```

CORS remains restricted to `http://localhost:6200`.

### `.env` (not committed)
```
JIRA_BASE_URL=http://localhost:6202
JIRA_API_KEY=your-jira-pat
BITBUCKET_BASE_URL=http://localhost:6203
BITBUCKET_API_KEY=your-bitbucket-pat
```

### `.env.example` (committed)
```
JIRA_BASE_URL=https://jira.yourcompany.com
JIRA_API_KEY=your-jira-personal-access-token
BITBUCKET_BASE_URL=https://bitbucket.yourcompany.com
BITBUCKET_API_KEY=your-bitbucket-personal-access-token
```

---

## 5. Mock Bitbucket Server (`mock-server/bitbucket.js`, port 6203)

Plain Node.js + Express. Two endpoints. Same 3-second artificial delay as the Jira mock.

### Endpoints

**`GET /rest/api/1.0/myself`**
Returns a mock user object representing the current authenticated user. The `slug` from this response is used by `BitbucketService` to derive `myReviewStatus`.

**`GET /rest/api/1.0/dashboard/pull-requests`**
Ignores all query parameters. Returns a fixed list of open PRs in full Bitbucket API response shape (`{ values: [...], isLastPage: true, ... }`). The mock data is the 4 existing hardcoded PRs repackaged into Bitbucket's JSON shape. The mock current user appears in each PR's `reviewers` array with varied statuses so all three states (`UNAPPROVED`, `NEEDS_WORK`, `APPROVED`) are represented across the dataset.

### Response Shape

Each PR in `values` contains:
- **Identity:** `id` (number), `title`, `description`, `state` (`OPEN`), `open`, `closed`, `locked`
- **Dates:** `createdDate`, `updatedDate` (Unix timestamps in ms)
- **Refs:** `fromRef` and `toRef` — each with `id` (full ref), `displayId` (branch name), `latestCommit`, and a nested `repository` (`id` (number), `slug`, `name`, `project.key`, `project.name`, browse URL via `links.self[0].href`)
- **People:** `author` (participant object), `reviewers` (array of participant objects), `participants`
- **Participant shape:** `user` (`id`, `name`, `displayName`, `emailAddress`, `slug`, `active`, `type`, `links.self[0].href` for profile URL), `role`, `approved`, `status`
- **Metadata:** `properties.commentCount`, `properties.openTaskCount`
- **Links:** `links.self[0].href` (URL to the PR)

---

## 6. PullRequest Model (`work-item.model.ts`)

The existing flat `PullRequest` interface is replaced with a rich model that closely mirrors the Bitbucket API response. Supporting types are added.

**Breaking change: `PullRequest.id` changes from `string` to `number`.** Because `WorkItem = JiraTicket | PullRequest | Todo`, the `id` field on the `WorkItem` union becomes `string | number`. Every call site that reads `.id` on a `WorkItem` or `PullRequest` — including `WorkDataService.selectedItem`, component comparisons, and any DOM `id` attributes — must be audited and updated. The implementer must search the entire codebase for `.id` usage on these types.

```typescript
export type PrStatus = 'Awaiting Review' | 'Changes Requested' | 'Approved';
export type PrState = 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED';

export interface PrUser {
  id: number;
  name: string;
  displayName: string;
  emailAddress: string;
  slug: string;
  active: boolean;
  type: string;
  profileUrl: string;   // mapped from user.links.self[0].href in the raw API response
}

export interface PrRepository {
  id: number;
  slug: string;
  name: string;
  projectKey: string;
  projectName: string;
  browseUrl: string;    // mapped from repository.links.self[0].href in the raw API response
}

export interface PrRef {
  id: string;
  displayId: string;
  latestCommit: string;
  repository: PrRepository;
}

export interface PrParticipant {
  user: PrUser;
  role: 'AUTHOR' | 'REVIEWER' | 'PARTICIPANT';
  approved: boolean;
  status: 'APPROVED' | 'UNAPPROVED' | 'NEEDS_WORK';
}

export interface PullRequest {
  type: 'pr';
  id: number;
  title: string;
  description: string;
  state: PrState;
  open: boolean;
  closed: boolean;
  locked: boolean;
  createdDate: number;
  updatedDate: number;
  fromRef: PrRef;
  toRef: PrRef;
  author: PrParticipant;
  reviewers: PrParticipant[];
  participants: PrParticipant[];
  commentCount: number;
  openTaskCount: number;
  url: string;
  myReviewStatus: PrStatus;
}
```

`myReviewStatus` is the only derived field. It is computed in `BitbucketService.mapPr()` by finding the current user's entry in `reviewers[]` and mapping: `UNAPPROVED → 'Awaiting Review'`, `NEEDS_WORK → 'Changes Requested'`, `APPROVED → 'Approved'`. Falls back to `'Awaiting Review'` if the current user is not found.

---

## 7. BitbucketService (`bitbucket.service.ts`)

Single responsibility: HTTP calls to the proxy + mapping Bitbucket responses to the `PullRequest` model.

```typescript
@Injectable({ providedIn: 'root' })
export class BitbucketService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/bitbucket/rest/api/1.0`;

  getReviewerPullRequests(): Observable<PullRequest[]> {
    return this.http.get<BitbucketUserRaw>(`${this.baseUrl}/myself`).pipe(
      switchMap(myself =>
        this.http
          .get<BitbucketPrPageRaw>(`${this.baseUrl}/dashboard/pull-requests`, {
            params: new HttpParams()
              .set('role', 'REVIEWER')
              .set('state', 'OPEN')
              .set('limit', '50'),
          })
          .pipe(map(page => page.values.map(pr => this.mapPr(pr, myself.slug))))
      )
    );
  }

  private mapPr(raw: BitbucketPrRaw, currentUserSlug: string): PullRequest { ... }
}
```

Raw interfaces (private to the file, same pattern as `jira.service.ts`). `profileUrl` and `browseUrl` are derived in `mapPr` from the nested `links.self[0].href` fields on user and repository objects respectively in the raw response:
- `BitbucketUserRaw` — `/myself` response shape; must include `slug: string` at the top level (the `/myself` endpoint returns a flat user object, not a participant wrapper), plus `links.self[0].href`
- `BitbucketPrRepositoryRaw` — includes `id`, `slug`, `name`, `project.key`, `project.name`, `links.self[0].href`
- `BitbucketPrRefRaw`, `BitbucketPrParticipantRaw`
- `BitbucketPrRaw` — full PR object shape
- `BitbucketPrPageRaw` — paged wrapper `{ values: BitbucketPrRaw[]; isLastPage: boolean }`

On error: logs and re-throws. `WorkDataService` owns the loading/error state.

---

## 8. JiraService Update

`baseUrl` changes from `${environment.proxyUrl}/rest/api/2` to `${environment.proxyUrl}/jira/rest/api/2`. No other changes.

---

## 9. WorkDataService Update

The hardcoded `pullRequests` signal is replaced with a live signal populated from `BitbucketService`:

```typescript
readonly pullRequestsLoading = signal(true);
readonly pullRequestsError = signal(false);

readonly pullRequests = toSignal(
  this.bitbucketService.getReviewerPullRequests().pipe(
    tap(() => this.pullRequestsLoading.set(false)),
    catchError(err => {
      console.error(err);
      this.pullRequestsLoading.set(false);
      this.pullRequestsError.set(true);
      return of([]);
    })
  ),
  { initialValue: [] }
);
```

`awaitingReviewCount` is updated from `pr.status === 'Awaiting Review'` to `pr.myReviewStatus === 'Awaiting Review'`. The old `pr.status` field no longer exists on the model — this is a TypeScript compile error that must be fixed as part of this change.

The UI shows a loading state while `pullRequestsLoading` is `true` and an error message ("Pull Requests konnten nicht geladen werden") when `pullRequestsError` is `true`. PRs and todos remain functional when Bitbucket is unreachable.

---

## 10. Component Template Updates

`pr-card` and `pr-detail` receive minor template updates to use the new model field paths. No visual changes.

**Template bindings:**

| Old field | New field | Component |
|---|---|---|
| `pr.repo` | `pr.fromRef.repository.slug` | both |
| `pr.branch` | `pr.fromRef.displayId` | both |
| `pr.author` | `pr.author.user.displayName` | both |
| `pr.status` | `pr.myReviewStatus` | both |
| `pr.updatedAt` | `pr.updatedDate` (timestamp ms, formatted via `DatePipe`) | `pr-detail` only |
| `pr.id` (string) | `pr.id` (number) | both |

**Method bodies:** Both `pr-card` and `pr-detail` contain a `statusClass()` method that reads `this.pr().status`. This must be updated to `this.pr().myReviewStatus` in both files — the template binding change alone is not sufficient.

**Date formatting:** `pr-detail` currently has a local `formatDate(iso: string)` helper. This method is removed entirely. The template is updated to use Angular's `DatePipe` directly: `{{ pr.updatedDate | date:'dd.MM.yyyy' }}`. `DatePipe` accepts a Unix millisecond timestamp (`number`) natively. `pr-card` does not render the date and requires no date-related changes.

---

## 11. Smoke Test Update (`smoke-test/index.js`)

The smoke test spawns mock and proxy processes and asserts against them. Three changes are required:
1. The spawned mock process changes from `node mock-server/index.js` to `node mock-server/jira.js`.
2. The env vars passed to the proxy process must include all four vars: `JIRA_BASE_URL`, `JIRA_API_KEY`, `BITBUCKET_BASE_URL` (set to `http://localhost:6203`), and `BITBUCKET_API_KEY`.
3. The existing Jira assertion URL changes from `/rest/api/2/search` to `/jira/rest/api/2/search`.
4. A second child process is spawned for `node mock-server/bitbucket.js` (port 6203). A second assertion is added: `GET /bitbucket/rest/api/1.0/dashboard/pull-requests` via the proxy on port 6201, asserting a 200 response with a `values` array.

---

## 12. npm Scripts

The following scripts change (other existing scripts — `build`, `watch`, `test`, `smoke-test` — are unchanged):

```json
"start": "concurrently \"ng serve --port 6200\" \"node proxy/index.js\" \"node mock-server/jira.js\" \"node mock-server/bitbucket.js\"",
"start:real": "concurrently \"ng serve --port 6200\" \"node proxy/index.js\"",
"proxy": "node proxy/index.js",
"mock:jira": "node mock-server/jira.js",
"mock:bitbucket": "node mock-server/bitbucket.js"
```

The old `"mock": "node mock-server/index.js"` script is removed.

`npm start` — full dev environment with both mock servers.
`npm run start:real` — proxy + Angular only, points at real servers configured in `.env`.

---

## 13. Error Handling

| Layer | Behaviour |
|---|---|
| Proxy startup | Exits with clear message if any of the four env vars are missing |
| `BitbucketService` | Re-throws after logging; does not own state |
| `WorkDataService` | Catches error, sets `pullRequestsError` to `true` |
| UI | Shows "Pull Requests konnten nicht geladen werden" when `pullRequestsError` is `true` |
| Loading | `pullRequestsLoading` is `true` until the observable completes or errors |

---

## 14. Out of Scope

- Pagination (mock always returns all PRs; service fetches up to 50)
- PR diff / file views
- Comment creation or any write operations
- Todo or Jira integrations
- Production deployment setup
