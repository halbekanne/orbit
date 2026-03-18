# CoSi AI-Powered PR Review — Design Spec

## Overview

Add an on-demand, AI-powered code review feature to Orbit's PR detail view. When viewing a Bitbucket pull request, the user can trigger a review via a button in the action rail. The review uses the company's CoSi API (Gemini 2.5 Flash via Vertex AI proxy) to analyze the PR diff against the linked Jira ticket's Akzeptanzkriterien and check for code quality issues. Results appear as a scannable, expandable findings list in the PR detail view.

### Constraints

- **Model:** Gemini 2.5 Flash only, via CoSi proxy API
- **Rate limit:** 20 calls/min — each review uses 3 calls (2 specialist agents + 1 consolidator)
- **Trigger:** On-demand only (user clicks button), never automatic
- **Design System context:** The PRs being reviewed are for a Design System built with TypeScript, Lit (Web Components), and SCSS — not Angular

### First Vertical Slice

Two specialist review agents:
1. **AK-Abgleich** — compares diff against Jira ticket Akzeptanzkriterien
2. **Code Quality** — checks structure, readability, TypeScript/Lit best practices

Future agents (design tokens, component API consistency, accessibility) will slot into the same architecture but are out of scope for this iteration.

## Architecture

### Data Flow

```
User clicks "KI-Review starten" button in action rail
  → CosiReviewService sends POST { diff, jiraTicket } to Express proxy
  → Proxy fires Agent 1 (AK) + Agent 2 (Code Quality) in parallel to CoSi API
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
    "description": "..."
  }
}
```

Note: The existing `JiraTicket` model has no dedicated field for Akzeptanzkriterien. In Jira, AK are typically embedded in the `description` field. Agent 1's prompt instructs it to extract Akzeptanzkriterien from the description text. The frontend sends `key`, `summary`, and `description` from the resolved `JiraTicket` object — no new Jira fields are needed.

**Body size limit:** The default `express.json()` limit (100KB) is too small for large diffs. The `/api/cosi/review` route must use `express.json({ limit: '2mb' })` to accommodate large PRs.

**Response body:**

```json
{
  "findings": [
    {
      "severity": "critical" | "important" | "minor",
      "category": "ak-abgleich" | "code-quality",
      "title": "Fehlerfall aus AK #3 nicht behandelt",
      "file": "src/components/button.ts",
      "line": 42,
      "detail": "AK #3 fordert Fehlerbehandlung wenn der API-Call fehlschlägt...",
      "suggestion": "Try-catch Block mit Fallback-UI hinzufügen."
    }
  ],
  "summary": "3 Findings: 1 Critical, 1 Important, 1 Minor",
  "warnings": ["Agent 1 (AK-Abgleich) fehlgeschlagen — nur Code-Qualität geprüft."],
  "reviewedAt": "2026-03-18T14:30:00Z"
}
```

The `warnings` array is empty on success. When a specialist agent fails, a human-readable warning string is appended so the user knows the review was partial.

**Orchestration logic:**

1. Validate request (diff must be non-empty)
2. Fire Agent 1 + Agent 2 via `Promise.all` (parallel)
3. Parse JSON findings from both responses
4. Send combined findings to Agent 3 (consolidation)
5. Return consolidated result with timestamp

**Error handling:**

- If all CoSi calls fail → return HTTP 502 with error message
- If one specialist agent fails → consolidator works with partial results, a warning string is added to the `warnings` array in the response
- Request timeout: 30 seconds per CoSi call

### Code Organization

New file: `proxy/cosi.js`

Contains:
- `callCoSi(contents, systemInstruction, generationConfig)` — shared helper for raw CoSi API calls via `fetch` with `x-api-key` header. All calls include `responseMimeType: "application/json"` in `generationConfig` to enforce structured JSON output from Gemini and prevent markdown-wrapped responses.
- `SYSTEM_PROMPTS` — the three agent system instructions
- `runReview(diff, jiraTicket)` — orchestration function (fan-out → consolidate → return)

The route handler in `proxy/index.js` stays thin — wires the request to `runReview()`.

## CoSi Agent Prompts

This section provides comprehensive guidance for implementing the three agent prompts. The prompts are the most important part of this feature — the quality of the review output depends almost entirely on how well they are engineered. Do not treat this section as boilerplate; read it carefully.

### Prompt Engineering Principles for Gemini 2.5 Flash

These principles come from a deep research report on using Gemini 2.5 Flash for code review (see `docs/cosi-api-integration-poc/` for CoSi API usage examples).

**1. Avoid cognitive dilution.** Gemini 2.5 Flash performs significantly worse with broad, multi-concern prompts. When asked to be a "security expert, performance expert, and accessibility expert all at once," it produces shallow findings across all dimensions rather than deep findings in any one. This is why we use separate specialist agents with narrow scope restrictions — each agent must be told what is NOT its job.

**2. Use XML-style delimiters.** Gemini 2.5 Flash excels when the prompt is organized using clear delimiters that separate context sections. Use tags like `<jira_ticket>`, `<pr_diff>`, `<guidelines>`, `<examples>` to structure the input. This prevents "instruction drift" in long-context scenarios where the model loses track of which section it's reasoning about.

**3. Be direct and non-persuasive.** The model responds best to explicit constraints stated as rules, not suggestions. Say "Never praise the code" not "Try to avoid praising the code." Say "Output valid JSON only" not "Please format your output as JSON."

**4. Enforce JSON output structurally.** Beyond the prompt instruction, all CoSi calls use `responseMimeType: "application/json"` in `generationConfig`. This is a Gemini API feature that forces the model to output valid JSON. Without it, the model may wrap JSON in markdown code fences, causing parse failures.

**5. Each finding must earn its place on screen.** The user has ADHD. Every finding that appears on screen is a cognitive cost. The prompts must aggressively filter for actionable, confident, specific findings. Vague suggestions ("consider improving error handling") are worse than no finding at all. Each finding must answer: what's wrong, where exactly, why it matters, and how to fix it.

### Prompt Structure Pattern

Each agent prompt should follow this structure:

```
[System instruction — shared constraints + agent-specific role]

[Agent-specific task description]

[Output format specification with JSON schema]

[Severity guide — calibrated per agent]

[Scope restriction — what NOT to review]

[Context sections wrapped in XML tags]
  <jira_ticket> ... </jira_ticket>      (Agent 1 only)
  <pr_diff> ... </pr_diff>              (Agents 1 and 2)
  <agent_1_findings> ... </agent_1_findings>  (Agent 3 only)
  <agent_2_findings> ... </agent_2_findings>  (Agent 3 only)

[Final instruction — restates the core task after context]
```

The final instruction after the context sections is important. In long prompts, Gemini 2.5 Flash can drift from the original task. A brief restatement ("Based on the above, identify gaps between the Akzeptanzkriterien and the implementation. Output JSON only.") anchors the model's output.

### Tone and Content Rules (All Agents)

These rules were derived from studying professional code review prompts. They apply to all three agents:

- **No praise, no filler.** Never output "looks good", "well done", "great use of...", "LGTM", "overall the PR is solid." The review should contain only findings. If there are no findings, output an empty findings array.
- **No performative agreement.** Don't say "the developer correctly handled X" — that's not a finding, it's noise.
- **Specific over vague.** "Line 42: `fetchData()` has no error handling for network failures" is a finding. "Consider improving error handling" is not.
- **File and line references are mandatory.** A finding without a concrete location in the diff is not a finding. Discard it.
- **YAGNI filtering.** Don't suggest features, abstractions, or patterns that aren't needed for the current change. If the diff adds a simple utility function, don't suggest making it configurable or adding an options parameter.
- **One finding per issue.** Don't split one problem into multiple findings to pad the list.
- **German for user-facing text.** Finding titles should be in German. Detail and suggestion text can be in German or English — whichever is clearer for the specific technical content.

### Finding JSON Schema

All agents must output findings in this exact shape:

```json
{
  "findings": [
    {
      "severity": "critical | important | minor",
      "title": "Short, scannable one-line summary (German)",
      "file": "path/to/file.ts (from the diff header)",
      "line": 42,
      "detail": "What's wrong and why it matters",
      "suggestion": "Concrete next step or fix hint"
    }
  ]
}
```

Notes:
- `file` must match a file path from the diff — don't invent paths
- `line` must be a line number visible in the diff context
- `detail` should be 1-3 sentences, not a paragraph
- `suggestion` should be actionable — "Add try-catch around the fetch call" not "Improve error handling"
- If no findings, output `{ "findings": [] }`

### Agent 1 — AK-Abgleich (Akzeptanzkriterien)

- **Temperature:** 0.2 (deterministic comparison task)
- **Input:** Jira ticket JSON (key, summary, description) + PR diff
- **Task:** Compare the PR diff against the Akzeptanzkriterien found in the Jira ticket description. Identify AK that are not satisfied, only partially implemented, or implemented differently than specified.
- **Key challenge:** Jira tickets don't have a structured "acceptance criteria" field. AK are embedded in the `description` field, often as bullet points, numbered lists, or prose. The prompt must instruct the model to first extract/identify the AK from the description text, then compare each one against the diff.
- **Severity guide:**
  - critical: An AK is completely unaddressed — a required feature or behavior is entirely missing from the diff
  - important: An AK is partially addressed — the main path works but a key edge case, error scenario, or specified behavior is missing
  - minor: An AK is addressed but the implementation differs from the specification in a small way (e.g., slightly different wording in a message, minor deviation from specified behavior)
- **Scope restriction:** Must NOT comment on code quality, style, structure, naming, or patterns. Those are Agent 2's job. If the code is ugly but satisfies the AK, that is not a finding for this agent.
- **Edge case — no AK found:** If the Jira ticket description contains no identifiable acceptance criteria (e.g., it's just a title with no description, or the description is purely technical notes), the agent should output `{ "findings": [] }` rather than hallucinating criteria.
- **Context structure:**
  ```
  <jira_ticket>
  Key: {key}
  Summary: {summary}
  Description:
  {description}
  </jira_ticket>

  <pr_diff>
  {diff}
  </pr_diff>
  ```

### Agent 2 — Code Quality

- **Temperature:** 0.4 (needs some latitude for recognizing subtle patterns and smells)
- **Input:** PR diff only — no Jira ticket context (intentionally isolated to prevent scope creep)
- **Task:** Review the diff for code quality issues. Focus areas in priority order:
  1. **Bugs or logical errors** — off-by-one, null/undefined access, race conditions, broken control flow
  2. **Readability and maintainability** — confusing logic, deeply nested code, unclear intent, functions doing too much
  3. **TypeScript best practices** — strict typing (no `any`), proper use of generics, correct error handling patterns, appropriate use of type guards vs assertions
  4. **Lit / Web Components best practices** — proper lifecycle usage, reactive property declarations, efficient rendering, correct shadow DOM patterns, event handling
  5. **Clean code structure** — single responsibility, sensible naming, DRY (but not premature abstraction)
- **Severity guide:**
  - critical: Bug, data loss risk, or broken functionality — something that will fail at runtime
  - important: Structural problem that significantly hurts maintainability, missing error handling for likely failure scenarios, type safety holes (`as` casts hiding real issues)
  - minor: Naming improvements, small readability wins, minor style inconsistencies
- **Scope restriction:** Must NOT check Akzeptanzkriterien (that's Agent 1), design tokens (future agent), or accessibility (future agent). Stay focused on code quality.
- **Context structure:**
  ```
  <pr_diff>
  {diff}
  </pr_diff>
  ```

### Agent 3 — Consolidator

- **Temperature:** 0.2 (deterministic filtering/formatting task)
- **Input:** Combined findings from Agent 1 and Agent 2
- **Role:** The consolidator is the quality gate. Its job is to ensure that only high-value, well-formed, non-redundant findings reach the user's screen. Think of it as the "receiving-code-review" agent — it should be skeptical of the specialist agents' output, not a rubber stamp.
- **Task (in order):**
  1. **Deduplicate** — if both agents flagged the same underlying issue (e.g., both noticed a missing null check), keep the better-written finding (clearer title, more specific detail) and discard the other
  2. **Filter low-confidence findings** — remove anything vague, speculative, or hedging ("might cause issues", "could potentially lead to...")
  3. **Filter noise** — remove trivial nitpicks that a senior engineer would ignore (micro-style preferences, optional semicolons, import ordering)
  4. **Verify grounding** — each finding must reference a real file and line from the diff. If a finding mentions a file or line that doesn't exist in the diff, the specialist agent hallucinated it — discard it
  5. **Sort** — critical first, then important, then minor
  6. **Add category** — tag each surviving finding with `"category": "ak-abgleich"` or `"category": "code-quality"` based on which agent produced it
  7. **Write summary** — a concise German summary string, e.g., "3 Auffälligkeiten: 1 Kritisch, 1 Wichtig, 1 Gering"
- **Output:**
  ```json
  {
    "findings": [ ...deduplicated, filtered, sorted, categorized findings ],
    "summary": "3 Auffälligkeiten: 1 Kritisch, 1 Wichtig, 1 Gering"
  }
  ```
- **Empty result:** `{ "findings": [], "summary": "Keine Auffälligkeiten" }`
- **Context structure:**
  ```
  <agent_1_findings>
  {agent_1_json_output}
  </agent_1_findings>

  <agent_2_findings>
  {agent_2_json_output}
  </agent_2_findings>
  ```

### Prompt Iteration Guidance

The prompts will need tuning based on real-world results. Expected iteration areas:

- **False positives** — if the model frequently flags non-issues, tighten the confidence constraint ("Only report findings you are highly confident about") or add few-shot examples of what NOT to flag
- **Hallucinated line numbers** — if the model invents file paths or line numbers not in the diff, add an explicit instruction: "The ONLY valid files and line numbers are those that appear in the diff. Do not reference code outside the diff."
- **AK extraction quality** — if Agent 1 struggles to identify acceptance criteria from unstructured Jira descriptions, consider adding few-shot examples showing how AK typically appear in the team's tickets (bullet lists, "Given/When/Then" format, numbered criteria, etc.)
- **Overly verbose detail** — if findings have paragraph-length detail text, add a constraint: "Detail must be 1-3 sentences maximum"
- **German vs English mixing** — if titles or summaries inconsistently mix languages, add explicit guidance: "Titles must be in German. Detail and suggestion may use English for technical terms."

Few-shot examples are the single most effective tuning mechanism for Gemini 2.5 Flash. When issues recur, add a pair of "bad finding → why it's bad" or "good finding → why it's good" examples to the relevant agent's prompt.

## Frontend — CosiReviewService

New service: `src/app/services/cosi-review.service.ts`

- `providedIn: 'root'`
- **State signal:** `reviewState: signal<ReviewState>('idle')` using a tagged union (see type below)
- **Method:** `requestReview(pr: PullRequest, diff: string, jiraTicket: JiraTicket): void`
  - Sets state to `'loading'`
  - POST to `{proxyUrl}/api/cosi/review` with diff and jira ticket data
  - On success: sets state to the `ReviewResult` object
  - On error: sets state to `'error'`
- Resets to `'idle'` when selected PR changes

### Types

```typescript
interface ReviewFinding {
  severity: 'critical' | 'important' | 'minor';
  category: 'ak-abgleich' | 'code-quality';
  title: string;
  file: string;
  line: number;
  detail: string;
  suggestion: string;
}

interface ReviewResult {
  findings: ReviewFinding[];
  summary: string;
  warnings: string[];
  reviewedAt: string;
}

type ReviewState =
  | 'idle'
  | 'loading'
  | { status: 'result'; data: ReviewResult }
  | { status: 'error'; message: string };
```

Consumers check state via string comparison for `'idle'` / `'loading'`, and via `status` property for result/error objects. This avoids ambiguous `typeof` checks.

## Frontend — UI

### Action Rail

When a PR is selected, a new button appears (in addition to "In Bitbucket öffnen"):

| Review State | Button Label | Style |
|-------------|-------------|-------|
| `idle` | "KI-Review starten" | indigo (action style) |
| `loading` | "Review läuft..." | disabled, subtle text pulse |
| result / error | "Erneut reviewen" | stone/neutral |

**Enable/disable logic (single source of truth):** The button is disabled when:
- Diff is still loading (`diffData() === 'loading'`)
- Jira ticket is still loading (`jiraTicket() === 'loading'`)
- Review is already in progress (`reviewState === 'loading'`)

If no Jira ticket is linked (`jiraTicket() === 'no-ticket'`), the button is still enabled — the review runs with Agent 2 only.

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

The PR detail already resolves the linked Jira ticket via `extractJiraKey()` (from `pr-jira-key.ts`) → `jiraService.getTicketByKey()`. If no Jira ticket is linked, the review still runs with Agent 2 (code quality) only — Agent 1 is skipped, and a warning is included in the response.

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
