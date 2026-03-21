# Sub-Tasks Feature — Design Spec

## Overview

Sub-Tasks allow users to break down Todos, Ideas, and Tickets into smaller, actionable steps. This feature is central to Orbit's ADHD-friendly design: it reduces overwhelm by chunking work, and provides dopamine-boosting completion feedback at each step.

## Data Model

### SubTask Interface

```typescript
interface SubTask {
  id: string;
  title: string;
  status: 'open' | 'done';
  completedAt: string | null;
}
```

- Flat hierarchy — no nested sub-tasks
- Minimal properties — title and status only
- ID format: `st_<timestamp>` or UUID

### Storage: Todos & Ideas

Add optional `subtasks` field to existing models:

```typescript
interface Todo {
  // ... existing fields
  subtasks?: SubTask[];
}

interface Idea {
  // ... existing fields
  subtasks?: SubTask[];
}
```

- Optional field for backwards compatibility — no migration needed
- `undefined` and `[]` are treated identically: no sub-tasks
- Persisted via existing `~/.orbit/todos.json` and `~/.orbit/ideas.json`

### Storage: Tickets

New file per ticket at `~/.orbit/tickets/<KEY>.json`:

```json
{
  "key": "COBI-1234",
  "subtasks": [
    { "id": "st_1", "title": "Auth-Token prüfen", "status": "done", "completedAt": "2026-03-21T10:00:00Z" },
    { "id": "st_2", "title": "Redirect-Flow testen", "status": "open", "completedAt": null }
  ]
}
```

- One file per ticket key (unique identifier)
- Structure is intentionally extensible for future local ticket enrichments (notes, tags, etc.)
- Directory `~/.orbit/tickets/` is created on first write

### Backend Endpoints

```
GET  /api/tickets/:key  → Read ~/.orbit/tickets/<KEY>.json (returns { subtasks: [] } if file doesn't exist)
POST /api/tickets/:key  → Write ~/.orbit/tickets/<KEY>.json (atomic write: tmp file + rename)
```

Same atomic write pattern as existing todos/ideas endpoints.

## Components

### SubTaskListComponent

A single reusable UI component embedded in all three detail views (TodoDetail, IdeaDetail, TicketDetail). Stateless — emits events, parent handles persistence.

**API:**

```typescript
subtasks = input<SubTask[]>([]);
subtasksChange = output<SubTask[]>();
```

**Interactions:**

| Action | Behavior |
|--------|----------|
| Add | Input field at bottom of list. Enter creates sub-task, field stays focused for rapid entry |
| Toggle | Checkbox click toggles status. Confetti + chime on `open → done`. Completed items stay in place (no resorting), get line-through + reduced opacity |
| Inline edit | Single click on title text → becomes input field. Escape = cancel, Enter = save. Consistent with existing Todo/Idea title editing pattern |
| Reorder | CDK DragDrop, same pattern as Todo/Idea cards in navigator |
| Delete | Small X at end of row, visible on hover only. No confirmation dialog |

**Section header:**

- Label: "Aufgaben"
- Counter badge: `2/5`
- When all complete: badge transitions from indigo → emerald, shows `✓ 3/3`
- Section is always open (not collapsible)

**Layout:**

```
┌─ Aufgaben ──────────── [2/5] ─┐
│ ☑ Auth-Token prüfen            │
│ ☐ Redirect-Flow testen         │
│ ☐ Error-Handling einbauen      │
│ [Neue Aufgabe eingeben...]     │
└────────────────────────────────┘
```

### Integration: TodoDetail & IdeaDetail

- Sub-task section placed after description/notes, before metadata (created date, etc.)
- `subtasksChange` event → service `update()` → existing `save()` flow
- No new service logic needed

### Integration: TicketDetail

- Same position as in Todo/Idea detail views
- Persistence via new `TicketLocalDataService`
- Separate from existing "Verknüpfungen" section (Jira relations/subtasks are read-only Jira data; these are Orbit's own local task breakdown)

### TicketLocalDataService

- Loads `GET /api/tickets/:key` when a ticket is selected
- Saves `POST /api/tickets/:key` on changes
- Signal-based reactive state, same style as TodoService/IdeaService
- Provides computed signal for sub-task data consumed by both TicketDetail and TicketCard

### TicketCardComponent Changes

- Receives sub-task data from `TicketLocalDataService` via computed signal
- Shows checklist icon + counter in bottom-right of badge row, only when sub-tasks exist

**States:**

| State | Display |
|-------|---------|
| 0 done | Stone-colored checklist icon + `0/4` in stone |
| Partial | Indigo-colored icon + `2/3` with indigo accent on done count |
| All done | Emerald-colored icon + `3/3` in emerald |

### No Indicator on Todo/Idea Cards

Cards remain unchanged. Sub-task information is only visible in the detail view.

## Animation & Sound

### Per Sub-Task Completion

Reuses existing Todo celebration pattern exactly:
- Checkbox bounce animation (0.5s cubic-bezier)
- 12 confetti particles from checkbox element
- 3-note chime (C4, E4, G4 via Web Audio API)
- Respects `prefers-reduced-motion`

### All Sub-Tasks Complete

Additional visual feedback on section header:
- Badge color transitions indigo → emerald (150ms)
- Counter shows checkmark: `✓ 3/3`
- No separate large celebration — the confetti from the last sub-task IS the big moment, combined with the header turning green

### Undo (done → open)

No sound, no confetti. Only visual change (checkbox empties, line-through disappears). Celebrations are for progress only.

## Scope Exclusions

- No sub-sub-tasks (flat hierarchy only)
- No sub-task properties beyond title + status
- No progress indicator on Todo/Idea cards
- No Quick Capture (Cmd+K) integration for sub-tasks
- No auto-completion of parent when all sub-tasks are done
