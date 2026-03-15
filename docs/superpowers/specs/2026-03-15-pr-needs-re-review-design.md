# PR "Needs Re-review" Feature Design

**Date:** 2026-03-15
**Status:** Approved

## Problem

PRs where the user requested changes (`NEEDS_WORK`) currently show as red in Orbit. But the user does not need to act on them — they are waiting for the author to respond. However, once any activity occurs on the PR after the user's NEEDS_WORK review (new commits, comments, etc.), the user *does* need to act. The current red badge gives no distinction between these two states.

## Goal

- Default "Changes Requested" PRs to grey (no action needed — waiting)
- Detect when activity has occurred after the user's NEEDS_WORK review and surface those as a distinct amber "Needs Re-review" state (action needed)

## Solution Overview

Use the Bitbucket Activities API (`GET /projects/{key}/repos/{slug}/pull-requests/{id}/activities`) to determine whether any activity has occurred after the user's most recent NEEDS_WORK review event. This check is done as a background enrichment pass after the initial PR list loads.

## Data Model

Add `'Needs Re-review'` to the `PrStatus` union in `work-item.model.ts`:

```ts
export type PrStatus = 'Awaiting Review' | 'Changes Requested' | 'Needs Re-review' | 'Approved' | 'Approved by Others';
```

## API Layer — `BitbucketService`

New method: `getReviewerPrActivityStatus(pr: Pick<PullRequest, 'prNumber' | 'toRef'>): Observable<'Changes Requested' | 'Needs Re-review'>`

Accepts the `PullRequest` object (or a pick thereof) directly — `projectKey`, `repoSlug`, and `prId` are extracted from `pr.toRef.repository.projectKey`, `pr.toRef.repository.slug`, and `pr.prNumber` respectively. This avoids three-argument unpacking at every call site.

Calls `GET /projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/activities`. Only the first page of results is fetched (default page size ~25) — the most recent NEEDS_WORK review event will always be within the first page in practice. `currentUserSlug` is resolved internally via `config$`, consistent with how `getReviewerPullRequests()` works.

**Logic** (activities are returned newest-first):
1. Walk the activity list to find the most recent activity where the current user submitted a `REVIEWED` event with `reviewedStatus: 'NEEDS_WORK'`.
2. If no such event exists → return `'Changes Requested'` (safe default).
3. If any activity appears before that event in the array (i.e., is more recent) → return `'Needs Re-review'`.
4. Otherwise → return `'Changes Requested'`.

The raw activity response interface only needs to capture the fields required for this logic:
- `action` (e.g. `'REVIEWED'`, `'RESCOPED'`, `'COMMENTED'`, etc.)
- `user.slug`
- `reviewedStatus` (present when `action === 'REVIEWED'`, values: `'APPROVED'` | `'NEEDS_WORK'` | `'UNAPPROVED'`)

## Service Layer — `WorkDataService`

After the initial PR list loads, a second pass enriches NEEDS_WORK PRs. This is wired as a continuation inside the existing `.subscribe()` callback in the constructor — after `_rawPullRequests.set(prs)` — not as a separate `effect()`.

1. Filter `prs` for entries where `myReviewStatus === 'Changes Requested'`. If none exist, skip entirely — this is a deliberate optimisation, not a workaround (note: `forkJoin([])` would complete immediately and safely, but the guard avoids unnecessary RxJS setup).
2. Fire a `forkJoin` of `getReviewerPrActivityStatus(pr)` calls for each — parallel, one call per NEEDS_WORK PR.
3. Patch `_rawPullRequests` signal using `update()`. Match enrichment results back to PRs **by `pr.id`**, not by array index — the enrichment list is a subset of `_rawPullRequests` so positional index alignment is not valid.

The enrichment is silent — no new loading signal. The PR list is already useful before enrichment completes; the affected badges update in place when results arrive.

**Updated sort order** in `pullRequests` computed signal:

| Priority | Status | Meaning | Change from current |
|---|---|---|---|
| 0 | Awaiting Review | Action needed | unchanged |
| 1 | Needs Re-review | Action needed — something changed | **new** |
| 2 | Changes Requested | Waiting, no action | was 1 → must update to 2 |
| 3 | Approved by Others | Waiting, no action | was 2 → must update to 3 |
| 4 | Approved | Filtered out | was 3 → must update to 4 |

Note: `'Approved'` is filtered out before sorting (existing behaviour) so priority 4 is never exercised by the sort comparator — it exists only to satisfy the exhaustive `Record<PrStatus, number>` type. The existing values for `'Changes Requested'` (1→2) and `'Approved by Others'` (2→3) must be bumped; failing to do so would create a sort tie between `'Needs Re-review'` and `'Changes Requested'`.

The `awaitingReviewCount` computed in `WorkDataService` must also be updated to include `'Needs Re-review'`, as both statuses represent action-required states:

```ts
readonly awaitingReviewCount = computed(() =>
  this.pullRequests().filter(pr =>
    pr.myReviewStatus === 'Awaiting Review' || pr.myReviewStatus === 'Needs Re-review'
  ).length
);
```

## Visual Layer — `PrCardComponent`

Badge styles:

| Status | Classes | Meaning |
|---|---|---|
| Awaiting Review | `bg-amber-100 text-amber-700` | unchanged |
| Needs Re-review | `bg-amber-100 text-amber-700` | new — same as Awaiting Review |
| Changes Requested | `bg-stone-100 text-stone-500` | changed from red to grey |
| Approved by Others | `bg-stone-100 text-stone-500` | unchanged |

Badge labels remain in English (consistent with workplace terminology — explicitly confirmed during design). The new badge displays: **"Needs Re-review"**. Since this is an English label in a German-language UI, add a German `aria-label` to the badge element for screen reader consistency: `"Erneut prüfen"` (WCAG AA, consistent with the project's accessibility posture).

The `statusClass()` method in `PrCardComponent` currently uses a `Record<string, string>` map with a runtime fallback. Strengthen the map type to `Record<PrStatus, string>` to get exhaustiveness checking at compile time — this ensures future `PrStatus` additions won't be silently missed.

## Mock Server

Add a mock handler for `GET /rest/api/latest/projects/:projectKey/repos/:repoSlug/pull-requests/:prId/activities` in `mock-server/bitbucket.js` (note: no `/bitbucket` prefix — the proxy adds that; existing mock routes follow this convention).

The existing mock data has only one NEEDS_WORK PR. Add a second NEEDS_WORK PR to `mockPullRequests` so both scenarios can be exercised independently:
- PR A (existing NEEDS_WORK PR): activity fixture where the NEEDS_WORK review is the newest event → should map to `'Changes Requested'`
- PR B (new NEEDS_WORK PR): activity fixture where a newer event (e.g. a comment or commit) follows the NEEDS_WORK review → should map to `'Needs Re-review'`

The handler branches on `prId` to serve the correct fixture for each PR.

## Testing

### `BitbucketService`
- Activities where the NEEDS_WORK review is the newest event → `'Changes Requested'`
- Activities where newer events exist after the NEEDS_WORK review → `'Needs Re-review'`
- No NEEDS_WORK review activity present → `'Changes Requested'` (safe default)

### `WorkDataService`
- PRs with `'Changes Requested'` are patched correctly after enrichment resolves
- PRs with other statuses are not affected by enrichment
- Sort order is correct with the new `'Needs Re-review'` status present

## Constraints & Non-Goals

- Activity check is only fired for PRs with `myReviewStatus === 'Changes Requested'` — no unnecessary calls
- No persistent local state — all data comes from the API
- First iteration only — a future iteration could distinguish "new commits" from "new comments" using `RESCOPED` vs `COMMENTED` activity types
