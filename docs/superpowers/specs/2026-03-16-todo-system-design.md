# Todo & Idea System — Design Spec

**Date:** 2026-03-16
**Status:** Approved

## Overview

Orbit currently has a minimal, in-memory todo implementation with no editing, no prioritisation, and no persistence. This spec defines a complete, ADHD-friendly task and idea management system that integrates seamlessly into the existing Orbit layout.

The system introduces two distinct item types — **Todos** (actionable, committable) and **Ideas** (non-actionable thoughts) — each with their own navigator section, detail view, and persistence. A new **Action Rail** column provides a consistent, always-visible home for context-sensitive actions across all item types in the app.

---

## Design Principles Applied

- **Zero-friction capture**: Quick capture defaults to Aufgabe; one tap switches to Idee. No decision blocks the capture.
- **Binary urgency over graded priority**: A single "Dringend" flag avoids the decision fatigue of High/Medium/Low scales.
- **Dopamine close**: Completing a todo triggers a full celebration (bounce + confetti + chime) to provide genuine positive reinforcement.
- **Spatial stability**: Actions always live in the same column, at the same position, regardless of which item is selected.
- **Deliberate closure**: "Nicht erledigen" is a conscious decision, visually distinct from completion — no guilt, just a clear skip.

---

## Dependencies

`@angular/cdk` must be added as a project dependency before implementation begins. Use the standalone CDK drag-drop directives (`CdkDrag`, `CdkDropList`, `cdkDropListDropped`) — not `DragDropModule`, which is the NgModule form.

---

## Data Model

### Todo

```ts
interface Todo {
  type: 'todo';
  id: string;
  title: string;
  description: string;
  status: 'open' | 'done' | 'wont-do';  // replaces done: boolean
  urgent: boolean;
  createdAt: string;
}
```

### Idea

```ts
interface Idea {
  type: 'idea';
  id: string;
  title: string;
  description: string;
  status: 'active' | 'wont-do';
  createdAt: string;
}
```

`WorkItem` union is extended to include `Idea`:

```ts
export type WorkItem = JiraTicket | PullRequest | Todo | Idea;
```

**Order** is defined by array position in the persistence file — no explicit order field. Position IS priority within the open section. Urgent todos are surfaced to the top via a computed signal, not by mutating the array.

**Migration:** The existing `done: boolean` field on `Todo` is replaced by `status`. The four hardcoded seed todos in `WorkDataService` are removed entirely as part of this work — initial state comes from the BFF.

---

## Persistence

The existing proxy server is extended as a Backend for Frontend (BFF). Todos and ideas are stored as JSON arrays in `~/.orbit/` on the user's machine.

### Endpoints

```
GET  /api/todos   → reads ~/.orbit/todos.json, returns Todo[]
POST /api/todos   → replaces entire array, returns Todo[]

GET  /api/ideas   → reads ~/.orbit/ideas.json, returns Idea[]
POST /api/ideas   → replaces entire array, returns Idea[]
```

Only two operations per resource: read all, write all. The frontend always sends the complete updated array. This keeps the BFF simple and matches the "position = order" model.

### Atomic writes

Writes use a write-then-rename strategy:
1. Write to `~/.orbit/todos.tmp.json`
2. Rename to `~/.orbit/todos.json`

Rename is atomic at the OS level — no partial writes, no corruption. `~/.orbit/` is created on first write if it does not exist.

### Empty file / first load

If `todos.json` or `ideas.json` does not exist on first load, the BFF returns `[]`. The app starts with an empty list — no seed data. If `load()` fails (network error, BFF not running), the service sets an error signal and falls back to `[]` silently, following the same pattern as the existing ticket and PR loading.

---

## Angular Services

### TodoService (`providedIn: 'root'`)

Owns all todo state and todo-only mutations.

| Member | Type | Description |
|---|---|---|
| `todos` | `signal<Todo[]>` | Full array from BFF; position = order |
| `openTodos` | `computed` | `status === 'open'`, urgent items first |
| `doneTodos` | `computed` | `status === 'done'` |
| `wontDoTodos` | `computed` | `status === 'wont-do'` |
| `pendingCount` | `computed` | `openTodos().length` |
| `todosLoading` | `signal<boolean>` | True during initial load |
| `todosError` | `signal<boolean>` | True if load failed |
| `load()` | method | Fetches from BFF on init |
| `add(title, description?)` | method | Prepends new todo with `status: 'open'`, `urgent: false`; saves |
| `update(todo: Todo)` | method | Replaces item by id in array; saves |
| `reorder(fromIndex, toIndex)` | method | Moves item in array; saves |
| `save()` | private method | POSTs full array to BFF |

### IdeaService (`providedIn: 'root'`)

| Member | Type | Description |
|---|---|---|
| `ideas` | `signal<Idea[]>` | Full array from BFF; position = order |
| `activeIdeas` | `computed` | `status === 'active'` |
| `wontDoIdeas` | `computed` | `status === 'wont-do'` |
| `ideasLoading` | `signal<boolean>` | True during initial load |
| `ideasError` | `signal<boolean>` | True if load failed |
| `load()` | method | Fetches from BFF on init |
| `add(title, description?)` | method | Prepends new idea with `status: 'active'`; saves |
| `update(idea: Idea)` | method | Replaces item by id in array; saves |
| `reorder(fromIndex, toIndex)` | method | Moves item in array; saves |
| `save()` | private method | POSTs full array to BFF |

### WorkDataService (updated)

**Removed:** `todos` signal, `addTodo()`, `toggleTodo()`, `pendingTodoCount`, `lastAddedId`, `highlightTimer`. These move entirely to `TodoService`. Consumers in the navigator and other components that previously injected `WorkDataService` for todos will inject `TodoService` directly.

**Retains:** Jira tickets, Bitbucket PRs, `selectedItem` signal, `select()`.

**Gains** two cross-cutting methods that coordinate both services:

```ts
promoteToTodo(idea: Idea): void
// 1. Calls IdeaService.update({ ...idea, status: 'wont-do' })
//    The idea moves to the "Nicht verfolgt" collapsed section — it is not deleted.
//    This preserves reversibility and is consistent with the "deliberate closure" principle.
// 2. Calls TodoService.add(idea.title, idea.description)
// 3. Sets selectedItem to the newly created Todo

demoteToIdea(todo: Todo): void
// 1. Removes todo from TodoService array
// 2. Calls IdeaService.add(todo.title, todo.description)
// 3. Sets selectedItem to the newly created Idea
```

`selectedItem` is updated in both methods so the detail panel follows the item through the transition without losing focus.

---

## Layout Change

The workbench wrapper in `app.html` is split to accommodate the action rail:

**Before:**
```html
<div class="flex-1 overflow-hidden bg-stone-50">
  <app-workbench />
</div>
```

**After:**
```html
<div class="flex-1 overflow-hidden flex">
  <div class="flex-1 overflow-hidden bg-stone-50">
    <app-workbench />
  </div>
  <app-action-rail />
</div>
```

The action rail is a column peer of the entire workbench area — it sits outside the workbench's `overflow-y-auto` scroll containers. The existing sticky header pattern in `TicketDetailComponent` and `PrDetailComponent` continues to work unchanged.

---

## New Components

### ActionRailComponent

- **Width:** `w-36` (144px), full viewport height
- **Background:** `bg-stone-50`, `border-l border-stone-100` — hairline separator, no label
- **Reads:** `WorkDataService.selectedItem` via `inject(WorkDataService)`
- **Renders:** context-specific action buttons per item type

| Item type | Actions |
|---|---|
| Todo (open) | Erledigt, Dringend toggle (amber when active), Zur Idee machen, Nicht erledigen |
| Todo (done) | Wieder öffnen, Zur Idee machen |
| Todo (wont-do) | Wieder öffnen |
| Idea (active) | Zur Aufgabe machen, Nicht verfolgen |
| Idea (wont-do) | Wieder aufgreifen |
| Ticket | In Jira öffnen — `<a [href]="item.url" target="_blank">` |
| PR | In Bitbucket öffnen — `<a [href]="item.url" target="_blank">` |
| Nothing selected | Empty, stone-50 background (empty state deferred to future work) |

Action buttons call methods on `TodoService`, `IdeaService`, or `WorkDataService` as appropriate.

### IdeaCardComponent

Like `TodoCardComponent` but without a checkbox. Shows a 💡 icon, indigo-tinted card (`bg-indigo-50/40 border-indigo-100`). Selectable, shows title. Drag handle (⠿) on hover.

### IdeaDetailComponent

Inline-editable title and description (same interaction pattern as the updated `TodoDetailComponent`). Injects `IdeaService`, calls `update(idea)` on save. No action buttons — those live in the action rail.

---

## Modified Components

### TicketDetailComponent

Remove the `<a [href]="ticket().url">In Jira öffnen</a>` element from the sticky header. This link moves to the action rail.

### PrDetailComponent

Remove the `<a [href]="pr().url">In Bitbucket öffnen</a>` element from the sticky header. This link moves to the action rail.

### TodoCardComponent

The card already has a checkbox toggle button (the small rounded square that calls `toggle.emit(todo().id)`). This button remains and is the in-card completion trigger.

- Gains drag handle (⠿), visible on hover
- Gains urgent indicator: amber left stripe when `urgent === true` (consistent with the attention tier color system: `bg-amber-500` stripe)
- The existing checkbox button now also triggers the completion celebration via the `lastCompletedId` signal

### TodoDetailComponent

- Becomes a pure display/edit component — remove `WorkDataService` injection entirely
- Injects `TodoService`, calls `update(todo)` on inline save
- Title becomes click-to-edit (`<input>` in place, styled with `focus:ring-2 focus:ring-indigo-400`)
- Description becomes click-to-edit (`<textarea>` in place)
- Save on blur or Enter (title); Ctrl+Enter (textarea)
- Escape cancels and reverts to last saved value
- All action buttons removed (moved to action rail)

### NavigatorComponent

Gains two changes:

1. **Ideen section** below Aufgaben — collapsible, same pattern as existing sections, lighter visual weight
2. **Drag-and-drop reorder** within Aufgaben (open only) and Ideen (active only) sections using Angular CDK standalone directives

Updated `CollapsedState` interface:

```ts
interface CollapsedState {
  tickets: boolean;
  prs: boolean;
  todos: boolean;       // open todos section
  todosDone: boolean;   // "Erledigt" sub-section
  todosWontDo: boolean; // "Nicht erledigt" sub-section
  ideas: boolean;       // active ideas section
  ideasWontDo: boolean; // "Nicht verfolgt" sub-section
}
```

Default (no saved state): all `false`. The `effect()` and `loadCollapsed()` in `NavigatorComponent` are updated to serialise and deserialise all seven keys.

**Navigator section order:**
1. Aktuelle Tickets (Jira)
2. Pull Requests (Bitbucket)
3. Aufgaben — open todos (draggable), then collapsed "Erledigt (n)" and "Nicht erledigt (n)"
4. Ideen — active ideas (draggable), then collapsed "Nicht verfolgt (n)"

### QuickCaptureComponent

Gains an Aufgabe/Idee toggle below the text input. Defaults to Aufgabe on open. Switching to Idee changes the placeholder to "Neue Idee...". Enter saves to `TodoService.add()` or `IdeaService.add()` accordingly and closes the modal.

### WorkbenchComponent

Gains `@if (item?.type === 'idea')` branch rendering `<app-idea-detail>`. The full switch structure becomes:

```html
@if (item?.type === 'ticket') { ... }
@if (item?.type === 'pr') { ... }
@if (item?.type === 'todo') { ... }
@if (item?.type === 'idea') { ... }
```

The existing `null` / no-selection empty state ("Bereit loszulegen?") is unchanged.

Angular templates do not narrow discriminated union types inside `@if` blocks. The existing `$any(item)` cast pattern continues to be used when passing `item` to typed component inputs (e.g. `[ticket]="$any(item)"`). Add the same pattern for the new idea branch.

---

## UX Interactions

### Drag-to-reorder

- Drag handle (⠿) appears on hover
- Dragging is scoped within a section — open todos cannot be dragged into done, ideas cannot be dragged into todos
- On drop: `reorder(from, to)` is called immediately, BFF write follows

### Inline editing

- Clicking title or description in the detail panel activates the field
- Active field styled with `border-indigo-400` ring
- Save: blur or Enter (title); Ctrl+Enter (description textarea)
- Escape: reverts to last saved value
- BFF write via `TodoService.update(todo)` / `IdeaService.update(idea)` on save

### Todo completion — celebration

The celebration is triggered by both interactions that can complete a todo:
- Clicking the checkbox in `TodoCardComponent`
- Clicking "Erledigt" in the action rail

`TodoService` exposes a `lastCompletedId` signal (similar to the existing `lastAddedId` pattern). `TodoCardComponent` watches this signal and plays the animation when its todo's id matches.

Animation sequence:
1. Checkbox bounce (0.5s, cubic-bezier spring)
2. Confetti particle burst from the checkbox (12 particles, 6 colors, 0.65s)
3. Ascending 3-note chime (do–mi–sol via Web Audio API)
4. Card fades and slides into the collapsed "Erledigt" section

This is intentionally more elaborate than other interactions — it is the dopamine close, the reward for finishing a task. Motion is deliberate here, not decorative.

### Won't do

No animation. The item moves to the collapsed section with muted stone-400 styling. The interaction is frictionless but unrewarded — it's a skip, not an achievement.

### Promote / Demote

- "Zur Aufgabe machen" in the action rail calls `WorkDataService.promoteToTodo(idea)`
- "Zur Idee machen" in the action rail calls `WorkDataService.demoteToIdea(todo)`
- `selectedItem` follows the item: the detail panel updates to the new type without losing focus

### Collapsed sections

- "Erledigt (n)", "Nicht erledigt (n)", "Nicht verfolgt (n)" are collapsed by default
- Expand on click, persist state in `localStorage` under `orbit.navigator.collapsed`
- Done/won't-do items: strikethrough title, faded opacity, no drag handle

---

## Out of Scope

- Due dates (user explicitly opted out — urgent flag + title suffices)
- Priority levels beyond the binary urgent flag
- Multi-select or bulk actions
- Search / filtering within todos or ideas
- Linking todos to Jira tickets
- Empty state design for the action rail when nothing is selected (deferred)
