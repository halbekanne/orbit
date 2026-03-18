# CoSi AI-Powered PR Review — Design Spec

## Overview

Add an on-demand, AI-powered code review feature to Orbit's PR detail view. When viewing a Bitbucket pull request, the user can trigger a review via a button in the action rail. The review uses the company's CoSi API (Gemini 2.5 Flash via Vertex AI proxy) to analyze the PR diff against the linked Jira ticket's acceptance criteria and check for code quality issues. Results appear as a scannable, expandable findings list in the PR detail view.

### Constraints

- **Model:** Gemini 2.5 Flash only, via CoSi proxy API
- **Rate limit:** 20 calls/min — each review uses 3 calls (2 specialist agents + 1 consolidator)
- **Trigger:** On-demand only (user clicks button), never automatic
- **Design System context:** The PRs being reviewed are for a Design System built with TypeScript, Lit (Web Components), and SCSS — not Angular

### First Vertical Slice

Two specialist review agents:
1. **AC Alignment** — compares diff against Jira ticket acceptance criteria
2. **Code Quality** — checks structure, readability, TypeScript/Lit best practices

Future agents (design tokens, component API consistency, accessibility) will slot into the same architecture but are out of scope for this iteration.

## Architecture

### Data Flow

```
User clicks "KI-Review starten" button in action rail
  → CosiReviewService sends POST { diff, jiraTicket } to Express proxy
  → Proxy fires Agent 1 (AC) + Agent 2 (Code Quality) in parallel to CoSi API
  → Proxy collects both JSON results
  → Proxy sends combined findings to Agent 3 (Consolidator)
  → Proxy returns structured JSON to frontend
  → CosiReviewService updates signal → PR detail re-renders findings section
```

### Layers

| Layer | Responsibility |
|-------|---------------|
| Action Rail | Trigger button with idle/loading/done states |
| PR Detail | Renders findings section before the diff section |
| CosiReviewService | Signal-based state management, HTTP call to proxy |
| Express Proxy | Orchestrates 3 CoSi calls, returns consolidated findings |
| CoSi API | Gemini 2.5 Flash inference |

## Backend — Express Proxy

### Environment Variables

Added to `.env`:

- `COSI_API_KEY` — API key for CoSi authentication
- `COSI_BASE_URL` — CoSi endpoint URL (defaults to `https://api.co-si.system.local/v1/models/locations/europe-west4/publishers/google/models/gemini-2.5-flash:generateContent`)

### New Endpoint: `POST /api/cosi/review`

**Request body** (sent by frontend):

```json
{
  "diff": "<unified diff string>",
  "jiraTicket": {
    "key": "DS-1234",
    "summary": "...",
    "description": "...",
    "acceptanceCriteria": "..."
  }
}
```

**Response body:**

```json
{
  "findings": [
    {
      "severity": "critical" | "important" | "minor",
      "category": "ac-alignment" | "code-quality",
      "title": "Fehlerfall aus AC #3 nicht behandelt",
      "file": "src/components/button.ts",
      "line": 42,
      "detail": "AC #3 fordert Fehlerbehandlung wenn der API-Call fehlschlägt...",
      "suggestion": "Try-catch Block mit Fallback-UI hinzufügen."
    }
  ],
  "summary": "3 Findings: 1 Critical, 1 Important, 1 Minor",
  "reviewedAt": "2026-03-18T14:30:00Z"
}
```

**Orchestration logic:**

1. Validate request (diff must be non-empty)
2. Fire Agent 1 + Agent 2 via `Promise.all` (parallel)
3. Parse JSON findings from both responses
4. Send combined findings to Agent 3 (consolidation)
5. Return consolidated result with timestamp

**Error handling:**

- If all CoSi calls fail → return HTTP 502 with error message
- If one specialist agent fails → consolidator works with partial results, response includes a note
- Request timeout: 30 seconds per CoSi call

### Code Organization

New file: `proxy/cosi.js`

Contains:
- `callCoSi(contents, systemInstruction, generationConfig)` — shared helper for raw CoSi API calls via `fetch` with `x-api-key` header
- `SYSTEM_PROMPTS` — the three agent system instructions
- `runReview(diff, jiraTicket)` — orchestration function (fan-out → consolidate → return)

The route handler in `proxy/index.js` stays thin — wires the request to `runReview()`.

## CoSi Agent Prompts

### Shared Constraint Block

Prepended to all three agents:

```
You are reviewing a pull request for a Design System built with TypeScript, Lit (Web Components), and SCSS.

RULES:
- Output valid JSON only. No markdown, no wrapping, no explanation outside the JSON.
- Never praise the code. No "looks good", no "well done", no "LGTM".
- Only report findings you are confident about. If unsure, omit.
- Every finding must reference a specific file and line number from the diff.
- Findings without a concrete location in the diff are not findings — discard them.
```

### Agent 1 — AC Alignment

- **Temperature:** 0.2 (deterministic comparison task)
- **Input:** Jira ticket JSON + PR diff
- **Task:** Compare diff against acceptance criteria. Identify gaps — fully missing, partially implemented, or slightly divergent.
- **Output:** `{ "findings": [...] }` with severity, title, file, line, detail, suggestion
- **Severity guide:**
  - critical: AC completely unaddressed — feature/behavior missing entirely
  - important: AC partially addressed — key edge case or scenario missing
  - minor: AC addressed but implementation differs in a small way
- **Scope restriction:** Must NOT comment on code quality, style, or structure

### Agent 2 — Code Quality

- **Temperature:** 0.4 (needs some latitude for pattern recognition)
- **Input:** PR diff only (no Jira context)
- **Task:** Review for bugs, readability, TypeScript best practices, Lit/Web Components best practices, clean code structure
- **Output:** `{ "findings": [...] }` with severity, title, file, line, detail, suggestion
- **Severity guide:**
  - critical: Bug, data loss risk, or broken functionality
  - important: Structural problem, poor error handling, significant readability issue
  - minor: Naming, minor style, small improvement opportunity
- **Scope restriction:** Must NOT check acceptance criteria, design tokens, or accessibility

### Agent 3 — Consolidator

- **Temperature:** 0.2 (deterministic filtering task)
- **Input:** Combined findings from Agent 1 and Agent 2
- **Task:**
  1. Remove duplicates (same issue from both agents → keep better-written one)
  2. Remove low-confidence or vague findings
  3. Remove trivial nitpicks that wouldn't help a senior engineer
  4. Verify each finding has a valid file and line reference
  5. Sort: critical → important → minor
  6. Write summary string
- **Output:** `{ "findings": [...], "summary": "..." }`
- **Empty result:** `{ "findings": [], "summary": "Keine Auffälligkeiten" }`

## Frontend — CosiReviewService

New service: `src/app/services/cosi-review.service.ts`

- `providedIn: 'root'`
- **State signal:** `reviewState: signal<'idle' | 'loading' | ReviewResult | 'error'>('idle')`
- **Method:** `requestReview(pr: PullRequest, diff: string, jiraTicket: JiraTicket): void`
  - Sets state to `'loading'`
  - POST to `{proxyUrl}/api/cosi/review` with diff and jira ticket data
  - On success: sets state to the `ReviewResult` object
  - On error: sets state to `'error'`
- Resets to `'idle'` when selected PR changes

### ReviewResult Type

```typescript
interface ReviewFinding {
  severity: 'critical' | 'important' | 'minor';
  category: 'ac-alignment' | 'code-quality';
  title: string;
  file: string;
  line: number;
  detail: string;
  suggestion: string;
}

interface ReviewResult {
  findings: ReviewFinding[];
  summary: string;
  reviewedAt: string;
}
```

## Frontend — UI

### Action Rail

When a PR is selected, a new button appears (in addition to "In Bitbucket öffnen"):

| Review State | Button Label | Style |
|-------------|-------------|-------|
| `idle` | "KI-Review starten" | indigo (action style) |
| `loading` | "Review läuft..." | disabled, subtle text pulse |
| result / error | "Erneut reviewen" | stone/neutral |

Disabled when diff is still loading or review is in progress.

The button calls `cosiReviewService.requestReview()` with the current PR's diff data and resolved Jira ticket.

### PR Detail — Findings Section

New section placed **before** the diff section ("Änderungen"), only rendered when review state is not `'idle'`.

**Section header:** "KI-Review" (uppercase, same style as other section headers) with summary count on the right.

**Loading state:** "KI-Review läuft..." — spinner + italic text, same pattern as diff loading.

**Error state:** "Review konnte nicht durchgeführt werden." — stone italic, same pattern as other errors.

**Findings — Expandable Rows (Option B):**

Each finding renders as:

```
[severity dot] [title]                              [file:line]
               [detail + suggestion — expandable]
```

- **Severity dots:** red (`bg-red-500`) for critical, amber (`bg-amber-500`) for important, stone (`bg-stone-400`) for minor
- **Title:** `text-sm font-medium text-stone-800`
- **File:line:** `font-mono text-xs text-stone-400`, right-aligned
- **Expanded detail:** subtle inset box (`bg-stone-100 rounded`), `text-xs text-stone-500`, shows detail text + "Vorschlag:" line with the suggestion
- **Expand behavior:** click row to toggle. Critical findings expand by default. Important and minor start collapsed.
- **Row separator:** `border-b border-stone-200` between findings

**Empty state** (no findings survived consolidation): "Keine Auffälligkeiten gefunden." — emerald tinted text, small positive signal.

### Jira Ticket Data for Review

The PR detail already resolves the linked Jira ticket via `extractJiraKey()` (from `pr-jira-key.ts`) → `jiraService.getTicketByKey()`. The review button is only enabled when both the diff and the Jira ticket have loaded. If no Jira ticket is linked, the review still runs with Agent 2 (code quality) only — Agent 1 is skipped.

## Testing Strategy

### Backend

- Unit tests for `cosi.js`:
  - `runReview()` orchestration: mock `fetch` to simulate CoSi responses, verify parallel execution and consolidation flow
  - Error handling: one agent fails, both fail, timeout
  - Request validation: empty diff rejected

### Frontend

- `CosiReviewService` tests:
  - State transitions: idle → loading → result, idle → loading → error
  - Reset on PR change
- PR detail component tests:
  - Findings section renders when review state has results
  - Section hidden when state is idle
  - Loading and error states render correctly
  - Expand/collapse behavior on finding rows
- Action rail tests:
  - Button appears for PR selection
  - Button disabled during loading
  - Button label changes per state

## Future Extensibility

The architecture supports adding specialist agents without structural changes:

- **Design Token Agent** — checks SCSS for hard-coded values, naming violations
- **Component API Agent** — checks Lit component inputs/outputs for consistency
- **Accessibility Agent** — checks for ARIA, keyboard handling, semantic HTML

Each new agent is:
1. A new system prompt in `proxy/cosi.js`
2. An additional parallel `fetch` call in `runReview()`
3. A new `category` value in the findings type

The consolidator naturally handles N agents — its prompt receives all findings regardless of source. The frontend renders findings the same way regardless of category. The rate budget (20 calls/min) supports up to ~5 specialist agents + 1 consolidator per review with headroom.
