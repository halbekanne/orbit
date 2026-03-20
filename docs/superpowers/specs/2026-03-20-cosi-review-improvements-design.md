# CoSi Review Improvements — Design Spec

## Overview

Three improvements to the CoSi AI PR review feature:

1. **Pipeline transparency** — live SSE-streamed timeline showing agent execution, consolidator decisions, raw responses, and timings
2. **Findings UI redesign** — file-grouped card layout with severity stripes, fixing long filename/title overflow
3. **Inline code rendering** — backtick-delimited text rendered as `<code>` in finding descriptions

## 1. Backend: SSE Streaming Protocol

### Endpoint Change

`POST /api/cosi/review` switches from JSON response to Server-Sent Events (`Content-Type: text/event-stream`). Request body remains `{ diff, jiraTicket }`.

### Event Protocol

```
event: warning
data: {"message":"Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft."}

event: agent:start
data: {"agent":"ak-abgleich","label":"AK-Abgleich","temperature":0.2}

event: agent:done
data: {"agent":"ak-abgleich","duration":3200,"findingCount":1,"summary":"1 Finding — Hover-State fehlt","rawResponse":{...}}

event: agent:start
data: {"agent":"code-quality","label":"Code-Qualität","temperature":0.4}

event: agent:done
data: {"agent":"code-quality","duration":3100,"findingCount":3,"summary":"3 Findings — Type-Assertion, Doppel-Rendering, Naming","rawResponse":{...}}

event: agent:error
data: {"agent":"ak-abgleich","error":"CoSi API error: 503 — Service Unavailable"}

event: consolidator:start
data: {"temperature":0.2}

event: consolidator:done
data: {"duration":2100,"result":{"findings":[...],"summary":"...","warnings":[...]},"decisions":[...],"summary":"4 → 3 konsolidiert. 1 Duplikat entfernt.","rawResponse":{...}}

event: done
data: {}
```

### Event Details

- Agent 1 (AK-Abgleich) and Agent 2 (Code-Quality) run in parallel. Their `start` events fire near-simultaneously; `done` events arrive as APIs respond.
- `rawResponse` contains the full JSON response from the agent (for frontend debug display).
- `agent:error` is sent when an agent fails; the pipeline continues with the other agent's findings.
- `warning` events are sent for conditions like missing Jira ticket.
- `consolidator:done` → `result` contains the final `ReviewResult` shape (`{ findings, summary, warnings }`). This is the single source for the final review data. The `done` event carries no data — it only signals stream end.
- `done` signals stream end; the response is closed.
- `reviewedAt` is set server-side in the `result` object within `consolidator:done`, same as before.

### `runReview()` Refactor

`runReview(diff, jiraTicket, emit)` receives an `emit(eventType, data)` callback. Each pipeline step calls `emit()` at start and completion. The Express route handler wires `emit` to `res.write()` in SSE format.

### Consolidator Prompt Change

The consolidator's prompt is extended to include a `decisions` array in its JSON output. Each decision describes what the consolidator did with a finding:

```json
{
  "findings": [...],
  "summary": "...",
  "decisions": [
    { "action": "kept", "reason": "Klar belegbar im Diff, Zeile 42", "finding": "Hover-State fehlt" },
    { "action": "removed", "reason": "Duplikat: Naming in beiden Agents gemeldet", "finding": "Inkonsistente Benennung" },
    { "action": "severity-changed", "reason": "Nur Edge-Case betroffen", "finding": "Type-Assertion", "oldSeverity": "important", "newSeverity": "minor" }
  ]
}
```

## 2. Frontend: State Model

### New Types (`review.model.ts`)

```typescript
interface AgentStep {
  agent: string;
  label: string;
  temperature: number;
  status: 'running' | 'done' | 'error';
  duration?: number;
  findingCount?: number;
  summary?: string;
  rawResponse?: unknown;
  error?: string;
}

interface ConsolidatorStep {
  status: 'pending' | 'running' | 'done' | 'error';
  temperature?: number;
  error?: string;
  duration?: number;
  decisions?: ConsolidatorDecision[];
  summary?: string;
  rawResponse?: unknown;
}

interface ConsolidatorDecision {
  action: 'kept' | 'removed' | 'severity-changed';
  reason: string;
  finding: string;
  oldSeverity?: string;
  newSeverity?: string;
}

interface PipelineState {
  agents: AgentStep[];
  consolidator: ConsolidatorStep;
  warnings: string[];
  totalDuration?: number;
}
```

### Updated `ReviewState`

```typescript
type ReviewState =
  | 'idle'
  | { status: 'running'; pipeline: PipelineState }
  | { status: 'result'; pipeline: PipelineState; data: ReviewResult }
  | { status: 'error'; pipeline: PipelineState; message: string };
```

### Service Changes (`cosi-review.service.ts`)

- `requestReview()` opens an `EventSource` (or `fetch` with streaming reader) instead of `HttpClient.post()`.
- SSE events are parsed and used to incrementally update the `PipelineState` signal.
- On `agent:start`: push new `AgentStep` with `status: 'running'`.
- On `agent:done`: update matching step to `status: 'done'`, fill fields.
- On `agent:error`: update matching step to `status: 'error'`.
- On `consolidator:start`/`done`: update consolidator step.
- On `warning`: append to `pipeline.warnings` array.
- On `done`: transition `ReviewState` to `result` (extracting `ReviewResult` from `consolidator:done`'s `result` field). `ReviewResult.warnings` is populated from `pipeline.warnings`.
- On stream error (e.g. network failure before any events): transition to `error` state. `PipelineState` is initialized at stream start with empty `agents`, `consolidator: { status: 'pending' }`, and empty `warnings` — so it's always present even on early failure.

Note: Since the request is `POST`, native `EventSource` (GET-only) cannot be used. Use `fetch()` with `ReadableStream` reader to parse the SSE text protocol manually. This is straightforward — read chunks, split on `\n\n`, parse `event:` and `data:` lines.

## 3. Frontend: ReviewPipelineComponent (new)

Vertical timeline component showing the agent execution pipeline.

### Inputs
- `pipeline: PipelineState`

### Layout (matches approved mockup A)
- Collapsible section with header: "Review-Pipeline" + total duration
- Vertical timeline with left border line connecting steps
- Each agent step shows:
  - Status dot: green (done), pulsing indigo (running), red (error)
  - Agent label + status text
  - Temperature badge (small pill, e.g. "T=0.2")
  - Duration in monospace
  - Summary text (from agent's self-description of what it found)
  - Collapsible raw JSON response (default closed, dark background, monospace)
- Consolidator step shows the same, plus:
  - Collapsible `decisions` list with action badges (kept/removed/severity-changed) and reasons
- Default: open while `running`, stays open after `result`

## 4. Frontend: ReviewFindingsComponent (redesign)

File-grouped card layout replacing the current flat list.

### Layout (matches approved mockup "Findings gruppiert nach Datei")
- Findings grouped by `file` field
- Each file group is a white card with:
  - Collapsible header: chevron, file path (monospace, ellipsis overflow), severity dots preview, finding count
  - Groups containing critical findings are expanded by default, others collapsed
- Individual findings within an expanded group are always visible (not individually collapsible):
  - Left severity stripe: `bg-red-500` (critical), `bg-amber-500` (important), `bg-stone-400` (minor) — consistent with existing severity dots
  - Badges: severity label + category label
  - Line number (not full path — file is in the group header)
  - Title
  - Detail box with inline code rendering
  - "Vorschlag:" section if suggestion exists

### Sorting
- File groups sorted by highest severity within group (critical first, then important, then minor)
- Findings within a group sorted by severity, then by line number

## 5. Inline Code Pipe

New `InlineCodePipe` that transforms backtick-delimited text into `<code>` elements.

- Regex: `` /`([^`]+)`/g `` → `<code>$1</code>`
- Single-level backticks only, no nesting support needed
- Used with `[innerHTML]` binding (Angular sanitizer allows `<code>`)
- Applied to `detail` and `suggestion` fields in findings

## 6. Mock Mode

`runMockReview(emit)` is refactored to accept the same `emit` callback as `runReview` and emit the same SSE events. It does not need `diff` or `jiraTicket` parameters since scenario selection is random.

### Event Sequence
1. `agent:start` for both agents (near-simultaneous)
2. Delay 1-2s per agent, `agent:done` (or `agent:error` for failure scenarios)
3. `consolidator:start`
4. Delay 0.5-1s
5. `consolidator:done` with decisions
6. `done`

### Scenario Updates
The 4 existing scenarios are extended with:
- `rawResponse` per agent (mock JSON matching the agent's prompt schema)
- `summary` per agent (descriptive text of what was found)
- `decisions` in consolidator (matching each scenario's logic, e.g. scenario 1: "1 Duplikat entfernt", scenario 4: agent error)

## Files Changed

### Modified
- `proxy/index.js` — SSE response headers and streaming write
- `proxy/cosi.js` — `runReview(diff, jiraTicket, emit)` with emit callback, consolidator prompt update for `decisions`
- `proxy/cosi-mock.js` — emit-based mock with delays per step
- `src/app/models/review.model.ts` — new pipeline types
- `src/app/services/cosi-review.service.ts` — SSE consumption via fetch+ReadableStream
- `src/app/components/review-findings/review-findings.ts` — file-grouped card layout
- `src/app/components/review-findings/review-findings.spec.ts` — updated tests

### New
- `src/app/components/review-pipeline/review-pipeline.ts` — timeline component
- `src/app/components/review-pipeline/review-pipeline.spec.ts` — tests
- `src/app/pipes/inline-code.pipe.ts` — backtick-to-code transform
- `src/app/pipes/inline-code.pipe.spec.ts` — tests

### Test Updates
- `proxy/cosi.test.js` — test emit callback calls, consolidator decisions
- `proxy/cosi-mock.test.js` — test event sequence and timing
- `src/app/services/cosi-review.service.spec.ts` — test SSE parsing, pipeline state transitions
