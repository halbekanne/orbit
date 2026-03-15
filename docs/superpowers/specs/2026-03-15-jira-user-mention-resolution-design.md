# Design: Jira User Mention Resolution

**Date:** 2026-03-15
**Status:** Approved

## Problem

Jira ticket descriptions and comment bodies contain user mentions in the format `[~U123456]`. The `JiraMarkupPipe` renders these as `@U123456` — the raw slug — which is meaningless to the reader. The goal is to display the user's actual display name instead (e.g. `@Dominik Müller`).

## Approach

Pre-process raw description and comment body strings in `JiraService` before they reach the model or any component. Slugs are resolved to display names via the Jira User API and cached for the session. No changes are needed to `JiraMarkupPipe`, component templates, or the `JiraTicket` model.

## Data Flow

```
GET /issue/:key  (or /search)
  → scan description + all comment bodies for [~SLUG] patterns
  → collect unique slugs
  → filter out slugs already in the in-memory cache
  → forkJoin(GET /rest/api/2/user?username=SLUG  for each unknown slug)
  → populate cache with slug → displayName pairs
  → replace [~SLUG] with [~DisplayName] in all affected raw strings
  → mapIssue() as today
  → JiraMarkupPipe renders @DisplayName  ✓
```

If there are no unknown slugs, no additional HTTP calls are made.

## Caching

A `private readonly userDisplayNameCache = new Map<string, string>()` lives on `JiraService`. Because the service is `providedIn: 'root'`, the cache persists for the full app session. Slugs resolved once are never fetched again — subsequent ticket loads that reference the same user are resolved entirely from the cache.

## Error Handling

User lookups that fail (404 for deleted/unavailable users, network errors) are caught per-slug using `catchError`. On failure, the slug is left unchanged in the text (`[~U123456]` remains, rendering as `@U123456`). A single failed lookup does not affect other lookups or the ticket fetch itself.

## API Endpoint

`GET /rest/api/2/user?username={slug}`
Returns a `UserBean` with a `displayName` string field.
Called once per unknown slug, in parallel via `forkJoin`.

## Scope

- Applies to: `description`, all `comment.body` fields on every ticket fetch (`getAssignedActiveTickets`, `getTicketByKey`).
- Does **not** apply to: issue summaries, labels, or any other field (mentions only appear in description/comments).

## What Does Not Change

- `JiraMarkupPipe` — no modifications
- `JiraTicket` model — no modifications
- Any component or template — no modifications
- The `[~DisplayName]` syntax is already handled by the pipe's existing mention branch (`content.startsWith('~')`)
