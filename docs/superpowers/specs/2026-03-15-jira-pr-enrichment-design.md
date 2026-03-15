# Jira PR Enrichment — Design Spec

**Date:** 2026-03-15
**Status:** Approved

## Overview

When a user opens a pull request in Orbit's detail view, the app automatically detects the linked Jira ticket from the branch name or PR title, fetches its details, and displays them in a dedicated card above the PR description. This eliminates the need to switch to Jira to get the context behind a PR.

---

## Goals

- Surface Jira ticket context (type, key, status, summary, assignee, description) directly in the PR detail view
- Zero extra interaction required — enrichment happens automatically on PR selection
- Gracefully handle all failure and edge-case states without breaking the PR detail view

---

## Visual Design

The Jira card is inserted in `PrDetailComponent` between the metadata row and the PR description, under a `Jira-Ticket` section label.

### Card structure

**Header** (always visible, tinted `#f0f3ff` background):
- Row 1: issue type icon-badge · monospace key · status pill · "In Jira öffnen" button (right-aligned)
- Row 2: summary (bold, full text, no truncation)
- Row 3: "Zugewiesen" label + avatar initials (computed from display name) + assignee display name

**Assignee display:** `JiraTicket.assignee` is a plain `string` (the display name). Avatar initials are derived by taking the first letter of each word. When assignee is `'Unbeauftragt'` (the existing fallback for unassigned tickets), render only the label and name with no avatar.

**Body** (white background):
- Full Jira ticket description, rendered via the existing `JiraMarkupPipe`
- No truncation, no scroll limit — rendered in full
- If description is empty, the body section does not render at all — no empty box

**Issue type badges** match the existing `TicketCardComponent` style exactly:
- Bug → red (`bg-red-50 text-red-600 border-red-200`)
- User Story → green (`bg-emerald-50 text-emerald-700 border-emerald-200`)
- Epic → violet (`bg-violet-50 text-violet-700 border-violet-200`)
- Aufgabe / default → sky blue (`bg-sky-50 text-sky-700 border-sky-200`)

**Status pills** match the existing `TicketCardComponent` pill style (colored dot + label, rounded-full border).

### States

The component input uses string literals rather than `null` for all non-data states to avoid JS `null` ambiguity:

| State | Trigger | Display |
|---|---|---|
| `'loading'` | Key found, fetch in flight | Skeleton placeholders for key, status, summary |
| `JiraTicket` | Fetch succeeded | Full card as described above |
| `'no-ticket'` | No key detected in branch name or title | Muted placeholder: "Kein Jira-Ticket gefunden" |
| `'error'` | Key found, fetch failed (network error, 404, permissions) | Error state: "Ticket konnte nicht geladen werden" — visually distinct from `'no-ticket'` |

The `'no-ticket'` and `'error'` states are intentionally different. `'no-ticket'` means no ticket was linked. `'error'` means a ticket was linked but could not be loaded — a useful signal that a reload may help.

### Accessibility

`JiraPrCardComponent` must meet the project's WCAG AA requirement:

- The Jira card section is wrapped in a `<section>` with an `aria-label="Jira-Ticket"` heading
- The skeleton loading state sets `aria-busy="true"` on the card container and `aria-label="Lade Jira-Ticket"` for screen readers
- The "In Jira öffnen" button carries `aria-label="Öffne [KEY] in Jira"` (matching the pattern in `TicketCardComponent`)
- The `'no-ticket'` and `'error'` placeholder texts are wrapped in `<p>` elements with appropriate `role="status"` to announce state changes

---

## Architecture

### Key extraction — `extractJiraKey(pr: PullRequest): string | null`

A pure utility function. Tries in order:

1. **Branch name** (`pr.fromRef.displayId`): matches the first `[A-Z]+-\d+` occurrence. Covers `feature/VERS-842-some-words` and bare `VERS-842-some-words`.
2. **PR title** (`pr.title`): same regex. Covers `VERS-842: Fix something`.

Returns the first match found, or `null` if neither contains a key.

Co-located with other PR utilities (alongside `prStatusClass`). Pure function with no dependencies — fully unit-testable.

### `JiraService` — new method

```ts
getTicketByKey(key: string): Observable<JiraTicket>
```

Calls `GET /jira/rest/api/2/issue/{key}` with the same field set as the existing search endpoint. Calls the existing private `mapIssue()` method internally — it is in the same class, so no visibility change is needed.

### New component — `JiraPrCardComponent`

Standalone component. Single input:

```ts
ticket = input.required<JiraTicket | 'loading' | 'no-ticket' | 'error'>();
```

Renders the appropriate state. Contains all card markup and issue type / status badge logic (mirroring `TicketCardComponent`). No outputs needed.

### Modified — `PrDetailComponent`

- Injects `JiraService`
- Uses `toObservable(pr)` + `switchMap` + `toSignal()` to reactively derive the Jira card state. `switchMap` ensures any in-flight request is automatically cancelled when the `pr` input changes — preventing stale data from a previous PR appearing in the new view.
- The resulting signal is typed `JiraTicket | 'loading' | 'no-ticket' | 'error'` and passed directly to `<app-jira-pr-card>`
- No structural changes to the rest of the template
- The existing `statusClass()` method in `PrDetailComponent` is pre-existing and not migrated to `computed()` as part of this feature — it is out of scope

---

## Data Flow

```
User selects PR
  → PrDetailComponent: toObservable(pr) emits new PullRequest
  → extractJiraKey(pr) → key: string | null
      → null: emit 'no-ticket' → JiraPrCardComponent shows "Kein Jira-Ticket gefunden"
      → key found: emit 'loading', switchMap to JiraService.getTicketByKey(key)
          → success: emit JiraTicket
          → error: emit 'error'
  → toSignal() keeps signal in sync
  → JiraPrCardComponent renders the current state
```

---

## Edge Cases

| Case | Behaviour |
|---|---|
| PR switches while fetch in flight | `switchMap` cancels the previous request automatically; new fetch starts for the new PR |
| Key regex matches non-existent ticket (e.g. `TEST-1-local`) | Jira returns 404 → `'error'` state |
| Jira ticket description is empty | Body section does not render; no empty box |
| Jira ticket fetch fails (network / permissions) | `'error'` state — distinct from `'no-ticket'` |
| Assignee is unassigned | `JiraTicket.assignee` is `'Unbeauftragt'`; render label + name, omit avatar |

---

## Out of Scope (first iteration)

- Showing multiple Jira tickets per PR (only the first detected key is used)
- Using the Bitbucket issues API endpoint to scan commit messages
- Editing Jira ticket fields from within Orbit
- Caching fetched tickets across PR selections
