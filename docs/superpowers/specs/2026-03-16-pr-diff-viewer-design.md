# PR Diff Viewer — Design Spec

## Summary

Add a collapsible diff viewer to the PR detail view that fetches the unified diff from Bitbucket and renders it using diff2html with syntax highlighting via highlight.js.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Placement | Below branch-info section, collapsible | ADHD-friendly: user controls when to see code, no wall-of-code on open |
| Diff format | Line-by-line (unified) | Orbit's detail column is narrow (`max-w-2xl`); side-by-side would squeeze code |
| Rendering approach | `Diff2Html.html()` + `[innerHTML]` | Angular owns the DOM; static HTML generation is simpler than `Diff2HtmlUI` wrapper |
| Styling | diff2html defaults (no override for now) | Override proposal saved in `docs/future-pr-diff-override.md` for later |
| Syntax highlighting | Yes, via highlight.js (already installed) | Included now since hljs is already a dependency; easier than retrofitting later |
| API endpoint | `GET .../pull-requests/{id}.diff` (full PR diff) | Simplest approach; optimize per-file only if perf becomes an issue |
| Loading strategy | Fetch on PR select, render on first expand | Diff loads eagerly (parallel with description reading), but HTML generation is lazy |

## Architecture

### API & Data Flow

1. User clicks a PR in the navigator → `selectedItem` signal updates → `PrDetailComponent` receives new `pr` input
2. `PrDetailComponent` reactively triggers `BitbucketService.getPullRequestDiff(pr)` via `toObservable(this.pr) → switchMap`
3. `BitbucketService` calls `GET /bitbucket/rest/api/latest/projects/{projectKey}/repos/{repoSlug}/pull-requests/{prId}.diff` with `responseType: 'text'`
4. Response flows through proxy → Bitbucket (or mock server in dev)
5. Diff string stored in a signal: `'loading' | 'error' | string`

### BitbucketService Addition

```typescript
getPullRequestDiff(pr: Pick<PullRequest, 'prNumber' | 'toRef'>): Observable<string>
```

Constructs the URL from `pr.toRef.repository.projectKey`, `pr.toRef.repository.slug`, and `pr.prNumber`. Requests with `responseType: 'text'`. No mapping needed — returns raw unified diff string.

### PrDetailComponent — Diff Section

**Signal state:**

- `diffData`: `Signal<'loading' | 'error' | string>` — raw diff fetched reactively when `pr` input changes
- `diffExpanded`: `WritableSignal<boolean>` — toggle state, defaults to `false`
- `diffFileCount`: `Signal<number>` — derived from `Diff2Html.parse(diffData)` when data is a string
- `diffHtml`: `Signal<string>` — generated lazily via `Diff2Html.html()` only when `diffExpanded` is true and `diffData` is a string

**Template structure:**

```
<section> "Änderungen"
  @if (diffData() === 'loading')
    → "Änderungen laden..." with pulse animation
  @else if (diffData() === 'error')
    → "Änderungen konnten nicht geladen werden." muted text
  @else
    → Toggle button: "Änderungen anzeigen (X Dateien)" / "Änderungen ausblenden"
    @if (diffExpanded())
      → <div [innerHTML]="diffHtml()"> with diff2html output
```

**Syntax highlighting:** After the diff HTML is rendered (via an `effect` or `afterNextRender`), query the container for `<code>` blocks and apply `hljs.highlightElement()` on each. Languages registered: TypeScript, JavaScript, CSS, SCSS, HTML, XML, JSON, TOML, YAML, Java, Python, Groovy, Dockerfile, Markdown, MDX, Bash, plus any others in highlight.js common bundle.

### diff2html Configuration

```typescript
{
  outputFormat: 'line-by-line',
  drawFileList: false,
  matching: 'lines',
  diffStyle: 'word',
  colorScheme: 'light'
}
```

### Collapsible UI States

| State | Toggle Button | Content |
|-------|--------------|---------|
| Loading | Hidden | "Änderungen laden..." with subtle pulse |
| Error | Hidden | "Änderungen konnten nicht geladen werden." |
| Loaded + Collapsed | "Änderungen anzeigen (X Dateien)" | Hidden |
| Loaded + Expanded | "Änderungen ausblenden" | diff2html rendered HTML |
| Empty diff | Hidden | "Keine Änderungen vorhanden." muted text |

No animation on expand/collapse — instant show/hide per low-motion principle.

### Security

diff2html generates HTML that is injected via `[innerHTML]`. Angular's default sanitizer will strip some of this markup. Use `DomSanitizer.bypassSecurityTrustHtml()` to mark the diff2html output as trusted. This is safe because the input is a unified diff string from our own backend (proxy or mock server), not user-generated content.

### CSS

- Import `diff2html/bundles/css/diff2html.min.css` globally (via `angular.json` styles array or component import)
- Import highlight.js GitHub theme CSS
- Use diff2html defaults for now; warm override deferred (see `docs/future-pr-diff-override.md`)
- Container div gets `overflow-x: auto` for long lines

## Mock Server

### New Endpoint

`GET /rest/api/latest/projects/:projectKey/repos/:repoSlug/pull-requests/:prId.diff`

Returns `Content-Type: text/plain` with a unified diff string.

### Fixtures

Each mock PR gets a diff that matches its description:

- **PR 412** (navigation component): 2-3 files — new Angular component, template, and route config changes
- **PR 415** (SSO redirect fix): 1-2 files — auth guard fix, small service change
- **PR 89** (dependency updates): 3+ files — package.json, lock file snippets, tsconfig changes
- **PR 91** (policy calculation refactor): 2-3 files — service extraction, import changes
- **PR 420** (claims wizard WIP): 3-4 files — new component files, partial implementation
- **PR 408** (SEPA mandate): 2 files — form component, validation service

PRs without a fixture get a generic single-file fallback diff.

Subject to the 3-second delay already applied to all mock endpoints.

## Testing

### BitbucketService

- Verify `getPullRequestDiff()` constructs the correct URL
- Verify `responseType: 'text'` is used
- Verify error handling returns observable error

### PrDetailComponent

- Test loading state appears initially
- Test toggle button appears after diff loads with correct file count
- Test expand/collapse toggles visibility of diff content
- Test error state renders error message
- Test diff HTML is generated and injected

## Dependencies

### New npm dependency

- `diff2html` — unified diff parser and HTML renderer

### Existing dependencies used

- `highlight.js` (^11.11.1) — already installed, used for syntax highlighting

## Files to Create/Modify

| File | Action |
|------|--------|
| `package.json` | Add `diff2html` dependency |
| `src/app/services/bitbucket.service.ts` | Add `getPullRequestDiff()` method |
| `src/app/components/pr-detail/pr-detail.ts` | Add diff section with collapsible UI, diff2html rendering, hljs highlighting |
| `mock-server/bitbucket.js` | Add `.diff` endpoint with fixtures for each mock PR |
| `angular.json` or component styles | Import diff2html CSS |
| `src/app/services/bitbucket.service.spec.ts` | Test new method |
| `src/app/components/pr-detail/pr-detail.spec.ts` | Test diff section |
