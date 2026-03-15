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
export type PrStatus = 'Awaiting Review' | 'In Review' | 'Changes Requested' | 'Needs Re-review' | 'Approved' | 'Approved by Others';
```

## API Layer — `BitbucketService`

New method: `getReviewerPrActivityStatus(projectKey, repoSlug, prId, currentUserSlug): Observable<'Changes Requested' | 'Needs Re-review'>`

Calls `GET /projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/activities`.

**Logic** (activities are returned newest-first):
1. Walk the activity list to find the most recent activity where the current user submitted a `REVIEWED` event with `status: 'NEEDS_WORK'`.
2. If no such event exists → return `'Changes Requested'` (safe default).
3. If any activity appears before that event in the array (i.e., is more recent) → return `'Needs Re-review'`.
4. Otherwise → return `'Changes Requested'`.

The raw activity response interface only needs to capture the fields required for this logic:
- `action` (e.g. `'REVIEWED'`, `'RESCOPED'`, `'COMMENTED'`, etc.)
- `user.slug`
- `reviewedStatus` (present when `action === 'REVIEWED'`, values: `'APPROVED'` | `'NEEDS_WORK'` | `'UNAPPROVED'`)

## Service Layer — `WorkDataService`

After the initial PR list loads, a second reactive pass enriches NEEDS_WORK PRs:

1. Filter `_rawPullRequests` for entries where `myReviewStatus === 'Changes Requested'`.
2. Fire a `forkJoin` of `getReviewerPrActivityStatus(...)` calls for each — parallel, one call per NEEDS_WORK PR.
3. Patch `_rawPullRequests` signal: for each PR whose activity check returns `'Needs Re-review'`, update its `myReviewStatus` in the signal.

The enrichment is silent — no new loading signal. The PR list is already useful before enrichment completes; the affected badges update in place when results arrive.

**Updated sort order** in `pullRequests` computed signal:

| Priority | Status | Meaning |
|---|---|---|
| 0 | Awaiting Review | Action needed |
| 1 | Needs Re-review | Action needed — something changed |
| 2 | Changes Requested | Waiting, no action |
| 3 | Approved by Others | Waiting, no action |
| 4 | Approved | Filtered out |

## Visual Layer — `PrCardComponent`

Badge styles:

| Status | Classes | Meaning |
|---|---|---|
| Awaiting Review | `bg-amber-100 text-amber-700` | unchanged |
| Needs Re-review | `bg-amber-100 text-amber-700` | new — same as Awaiting Review |
| Changes Requested | `bg-stone-100 text-stone-500` | changed from red to grey |
| Approved by Others | `bg-stone-100 text-stone-500` | unchanged |

Badge labels remain in English (consistent with workplace terminology). The new badge displays: **"Needs Re-review"**.

## Mock Server

Add a mock handler for `GET /bitbucket/rest/api/latest/projects/:projectKey/repos/:repoSlug/pull-requests/:prId/activities` in `mock-server/bitbucket.js`. Return realistic activity arrays covering both the "nothing new" and "new activity after NEEDS_WORK" scenarios.

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
