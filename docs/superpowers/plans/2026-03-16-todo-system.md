# Todo & Idea System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-memory todo stub with a fully persistent Todo + Idea management system including BFF persistence, inline editing, drag-to-reorder, an action rail, completion celebration, and promote/demote between item types.

**Architecture:** The Express proxy is extended as a BFF storing `~/.orbit/todos.json` and `~/.orbit/ideas.json` via atomic writes. `TodoService` and `IdeaService` own their respective state and HTTP calls. `WorkDataService` is trimmed to tickets + PRs + selection, plus two coordinator methods (`promoteToTodo`, `demoteToIdea`). A new `ActionRailComponent` column at the app shell level surfaces context-sensitive actions for whichever item is selected.

**Tech Stack:** Angular 21 (signals, OnPush, standalone, zoneless), `@angular/cdk` (drag-drop standalone directives), Express + `fs/promises` + atomic rename, Vitest

---

## Chunk 1: Foundation — data model, BFF, TodoService, IdeaService, WorkDataService cleanup

### Task 1: Install `@angular/cdk`

**Files:**
- Modify: `package.json` (automatically via npm)

- [ ] **Step 1: Install the package**

```bash
npm install @angular/cdk
```

- [ ] **Step 2: Verify it appears in dependencies**

```bash
grep '"@angular/cdk"' package.json
```

Expected: a version line like `"@angular/cdk": "^21.x.x"`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add @angular/cdk dependency"
```

---

### Task 2: Update the data model

**Files:**
- Modify: `src/app/models/work-item.model.ts`

The existing `Todo` interface uses `done: boolean`. Replace it with the three-state model and add `Idea`.

- [ ] **Step 1: Update `work-item.model.ts`**

Replace the existing `Todo` interface and `WorkItem` union:

```ts
export interface Todo {
  type: 'todo';
  id: string;
  title: string;
  description: string;
  status: 'open' | 'done' | 'wont-do';
  urgent: boolean;
  createdAt: string;
  completedAt: string | null;
}

export interface Idea {
  type: 'idea';
  id: string;
  title: string;
  description: string;
  status: 'active' | 'wont-do';
  createdAt: string;
}

export type WorkItem = JiraTicket | PullRequest | Todo | Idea;
```

- [ ] **Step 2: Run tests to see what breaks**

```bash
ng test --no-watch 2>&1 | head -60
```

Expected: compile errors in `WorkDataService` (references `done: boolean`, `addTodo`, `toggleTodo`). These are expected — fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add src/app/models/work-item.model.ts
git commit -m "feat(model): replace Todo.done with status+urgent+completedAt, add Idea"
```

---

### Task 3: Extend BFF with `/api/todos` and `/api/ideas` endpoints

**Files:**
- Modify: `proxy/index.js`

The BFF currently only proxies Jira and Bitbucket. Add two pairs of GET/POST routes that read/write JSON files in `~/.orbit/`.

- [ ] **Step 1: Add the persistence routes to `proxy/index.js`**

Add the following block **before** the `app.listen(...)` call:

```js
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');

const ORBIT_DIR = path.join(os.homedir(), '.orbit');

async function readJson(file) {
  try {
    const data = await fsp.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeJson(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = file.replace(/\.json$/, '.tmp.json');
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(tmp, file);
}

app.get('/api/todos', async (_req, res) => {
  res.json(await readJson(path.join(ORBIT_DIR, 'todos.json')));
});

app.post('/api/todos', async (req, res) => {
  await writeJson(path.join(ORBIT_DIR, 'todos.json'), req.body);
  res.json(req.body);
});

app.get('/api/ideas', async (_req, res) => {
  res.json(await readJson(path.join(ORBIT_DIR, 'ideas.json')));
});

app.post('/api/ideas', async (req, res) => {
  await writeJson(path.join(ORBIT_DIR, 'ideas.json'), req.body);
  res.json(req.body);
});
```

- [ ] **Step 2: Manual smoke test** (requires proxy running)

```bash
# In a separate terminal: node proxy/index.js
curl -s http://localhost:6201/api/todos
# Expected: []

curl -s -X POST http://localhost:6201/api/todos \
  -H 'Content-Type: application/json' \
  -d '[{"type":"todo","id":"t1","title":"Test","description":"","status":"open","urgent":false,"createdAt":"2026-03-16T10:00:00","completedAt":null}]'
# Expected: the array echoed back

curl -s http://localhost:6201/api/todos
# Expected: the same array

cat ~/.orbit/todos.json
# Expected: pretty-printed JSON file
```

- [ ] **Step 3: Commit**

```bash
git add proxy/index.js
git commit -m "feat(bff): add /api/todos and /api/ideas GET/POST endpoints with atomic writes"
```

---

### Task 4: Create `TodoService`

**Files:**
- Create: `src/app/services/todo.service.ts`
- Create: `src/app/services/todo.service.spec.ts`

`TodoService` owns all todo state. It loads from BFF on construction and exposes computed views used by the navigator and action rail.

- [ ] **Step 1: Write the failing tests first**

```ts
// src/app/services/todo.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { TodoService } from './todo.service';
import { Todo } from '../models/work-item.model';

const TODAY = new Date().toDateString();

const makeTodo = (overrides: Partial<Todo> = {}): Todo => ({
  type: 'todo',
  id: 'td1',
  title: 'Test',
  description: '',
  status: 'open',
  urgent: false,
  createdAt: new Date().toISOString(),
  completedAt: null,
  ...overrides,
});

function setup(http: Partial<{ get: unknown; post: unknown }>) {
  TestBed.configureTestingModule({
    providers: [
      TodoService,
      { provide: HttpClient, useValue: http },
    ],
  });
  return TestBed.inject(TodoService);
}

describe('TodoService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('todosLoading starts true, becomes false after load', () => {
    const svc = setup({ get: () => of([]), post: () => of([]) });
    expect(svc.todosLoading()).toBe(true);
    TestBed.tick();
    expect(svc.todosLoading()).toBe(false);
  });

  it('loads todos from BFF on init', () => {
    const todo = makeTodo();
    const svc = setup({ get: () => of([todo]), post: () => of([todo]) });
    TestBed.tick();
    expect(svc.todos()).toEqual([todo]);
  });

  it('sets todosError on load failure', () => {
    const svc = setup({ get: () => throwError(() => new Error('fail')), post: () => of([]) });
    TestBed.tick();
    expect(svc.todosError()).toBe(true);
    expect(svc.todos()).toEqual([]);
  });

  it('openTodos contains open todos, urgent ones first', () => {
    const open = makeTodo({ id: 'a', status: 'open', urgent: false });
    const urgent = makeTodo({ id: 'b', status: 'open', urgent: true });
    const svc = setup({ get: () => of([open, urgent]), post: () => of([open, urgent]) });
    TestBed.tick();
    const ids = svc.openTodos().map(t => t.id);
    expect(ids[0]).toBe('b');
    expect(ids[1]).toBe('a');
  });

  it('openTodos includes todos completed today', () => {
    const doneToday = makeTodo({ id: 'x', status: 'done', completedAt: new Date().toISOString() });
    const svc = setup({ get: () => of([doneToday]), post: () => of([doneToday]) });
    TestBed.tick();
    expect(svc.openTodos().map(t => t.id)).toContain('x');
  });

  it('doneTodos excludes todos completed today', () => {
    const doneToday = makeTodo({ status: 'done', completedAt: new Date().toISOString() });
    const svc = setup({ get: () => of([doneToday]), post: () => of([doneToday]) });
    TestBed.tick();
    expect(svc.doneTodos()).toHaveLength(0);
  });

  it('doneTodos includes todos completed before today', () => {
    const old = makeTodo({ status: 'done', completedAt: '2026-01-01T00:00:00' });
    const svc = setup({ get: () => of([old]), post: () => of([old]) });
    TestBed.tick();
    expect(svc.doneTodos()).toHaveLength(1);
  });

  it('wontDoTodos contains wont-do todos', () => {
    const wont = makeTodo({ status: 'wont-do' });
    const svc = setup({ get: () => of([wont]), post: () => of([wont]) });
    TestBed.tick();
    expect(svc.wontDoTodos()).toHaveLength(1);
  });

  it('add() prepends todo with open status and saves', () => {
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([]), post: postSpy });
    TestBed.tick();
    svc.add('New task');
    expect(svc.todos()[0].title).toBe('New task');
    expect(svc.todos()[0].status).toBe('open');
    expect(postSpy).toHaveBeenCalled();
  });

  it('update() replaces todo by id and saves', () => {
    const todo = makeTodo();
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([todo]), post: postSpy });
    TestBed.tick();
    svc.update({ ...todo, title: 'Updated' });
    expect(svc.todos()[0].title).toBe('Updated');
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it('reorder() moves item in array and saves', () => {
    const a = makeTodo({ id: 'a' });
    const b = makeTodo({ id: 'b' });
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([a, b]), post: postSpy });
    TestBed.tick();
    svc.reorder(0, 1);
    expect(svc.todos()[0].id).toBe('b');
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it('pendingCount equals openTodos().length (open + today-done)', () => {
    const open = makeTodo({ id: 'a', status: 'open' });
    const doneToday = makeTodo({ id: 'b', status: 'done', completedAt: new Date().toISOString() });
    const doneOld = makeTodo({ id: 'c', status: 'done', completedAt: '2026-01-01T00:00:00' });
    const svc = setup({ get: () => of([open, doneToday, doneOld]), post: () => of([]) });
    TestBed.tick();
    expect(svc.pendingCount()).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
ng test --no-watch 2>&1 | grep -E "(FAIL|Cannot find|TodoService)"
```

Expected: "Cannot find module './todo.service'" or similar.

- [ ] **Step 3: Implement `TodoService`**

```ts
// src/app/services/todo.service.ts
import { Injectable, signal, computed, inject, effect, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Todo } from '../models/work-item.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TodoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/api/todos`;
  private readonly today = new Date().toDateString();

  readonly todos = signal<Todo[]>([]);
  readonly todosLoading = signal(true);
  readonly todosError = signal(false);
  readonly lastCompletedId = signal<string | null>(null);
  private completedTimer: ReturnType<typeof setTimeout> | null = null;

  readonly openTodos = computed(() => {
    const todayStr = this.today;
    const isOpenItem = (t: Todo) => t.status === 'open';
    const isDoneToday = (t: Todo) =>
      t.status === 'done' && t.completedAt !== null && new Date(t.completedAt).toDateString() === todayStr;

    return this.todos()
      .filter(t => isOpenItem(t) || isDoneToday(t))
      .sort((a, b) => {
        const aIsOpen = isOpenItem(a);
        const bIsOpen = isOpenItem(b);
        if (aIsOpen && !bIsOpen) return -1;
        if (!aIsOpen && bIsOpen) return 1;
        if (aIsOpen && bIsOpen) {
          if (a.urgent && !b.urgent) return -1;
          if (!a.urgent && b.urgent) return 1;
        }
        return 0;
      });
  });

  readonly doneTodos = computed(() => {
    const todayStr = this.today;
    return this.todos().filter(
      t => t.status === 'done' && t.completedAt !== null && new Date(t.completedAt).toDateString() !== todayStr
    );
  });

  readonly wontDoTodos = computed(() => this.todos().filter(t => t.status === 'wont-do'));

  readonly pendingCount = computed(() => this.openTodos().length);

  constructor() {
    this.load();
  }

  load(): void {
    this.http.get<Todo[]>(this.baseUrl).subscribe({
      next: todos => {
        this.todos.set(todos);
        this.todosLoading.set(false);
      },
      error: err => {
        console.error('Failed to load todos:', err);
        this.todosError.set(true);
        this.todosLoading.set(false);
      },
    });
  }

  add(title: string, description = ''): Todo {
    const todo: Todo = {
      type: 'todo',
      id: `td-${Date.now()}`,
      title,
      description,
      status: 'open',
      urgent: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    this.todos.update(todos => [todo, ...todos]);
    this.save();
    return todo;
  }

  update(todo: Todo): void {
    if (todo.status === 'done' && !todo.completedAt) {
      todo = { ...todo, completedAt: new Date().toISOString() };
      if (this.completedTimer !== null) clearTimeout(this.completedTimer);
      this.lastCompletedId.set(todo.id);
      this.completedTimer = setTimeout(() => this.lastCompletedId.set(null), 1500);
    }
    this.todos.update(todos => todos.map(t => t.id === todo.id ? todo : t));
    this.save();
  }

  reorder(fromIndex: number, toIndex: number): void {
    this.todos.update(todos => {
      const arr = [...todos];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      return arr;
    });
    this.save();
  }

  remove(id: string): void {
    this.todos.update(todos => todos.filter(t => t.id !== id));
    this.save();
  }

  private save(): void {
    this.http.post<Todo[]>(this.baseUrl, this.todos()).subscribe({
      error: err => console.error('Failed to save todos:', err),
    });
  }
}
```

- [ ] **Step 4: Run tests — expect passes**

```bash
ng test --no-watch 2>&1 | grep -E "(PASS|FAIL|TodoService)"
```

Expected: all TodoService tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/todo.service.ts src/app/services/todo.service.spec.ts
git commit -m "feat: add TodoService with BFF persistence, computed views, and completion signal"
```

---

### Task 5: Create `IdeaService`

**Files:**
- Create: `src/app/services/idea.service.ts`
- Create: `src/app/services/idea.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/services/idea.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { IdeaService } from './idea.service';
import { Idea } from '../models/work-item.model';

const makeIdea = (overrides: Partial<Idea> = {}): Idea => ({
  type: 'idea',
  id: 'id1',
  title: 'Test',
  description: '',
  status: 'active',
  createdAt: new Date().toISOString(),
  ...overrides,
});

function setup(http: Partial<{ get: unknown; post: unknown }>) {
  TestBed.configureTestingModule({
    providers: [
      IdeaService,
      { provide: HttpClient, useValue: http },
    ],
  });
  return TestBed.inject(IdeaService);
}

describe('IdeaService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('ideasLoading starts true, becomes false after load', () => {
    const svc = setup({ get: () => of([]), post: () => of([]) });
    expect(svc.ideasLoading()).toBe(true);
    TestBed.tick();
    expect(svc.ideasLoading()).toBe(false);
  });

  it('loads ideas from BFF on init', () => {
    const idea = makeIdea();
    const svc = setup({ get: () => of([idea]), post: () => of([idea]) });
    TestBed.tick();
    expect(svc.ideas()).toEqual([idea]);
  });

  it('sets ideasError on load failure', () => {
    const svc = setup({ get: () => throwError(() => new Error('fail')), post: () => of([]) });
    TestBed.tick();
    expect(svc.ideasError()).toBe(true);
  });

  it('activeIdeas contains only active ideas', () => {
    const active = makeIdea({ id: 'a', status: 'active' });
    const wont = makeIdea({ id: 'b', status: 'wont-do' });
    const svc = setup({ get: () => of([active, wont]), post: () => of([]) });
    TestBed.tick();
    expect(svc.activeIdeas()).toHaveLength(1);
    expect(svc.activeIdeas()[0].id).toBe('a');
  });

  it('wontDoIdeas contains only wont-do ideas', () => {
    const wont = makeIdea({ status: 'wont-do' });
    const svc = setup({ get: () => of([wont]), post: () => of([]) });
    TestBed.tick();
    expect(svc.wontDoIdeas()).toHaveLength(1);
  });

  it('add() prepends idea with active status and saves', () => {
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([]), post: postSpy });
    TestBed.tick();
    svc.add('New idea');
    expect(svc.ideas()[0].title).toBe('New idea');
    expect(svc.ideas()[0].status).toBe('active');
    expect(postSpy).toHaveBeenCalled();
  });

  it('update() replaces idea by id and saves', () => {
    const idea = makeIdea();
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([idea]), post: postSpy });
    TestBed.tick();
    svc.update({ ...idea, title: 'Updated' });
    expect(svc.ideas()[0].title).toBe('Updated');
  });

  it('reorder() moves item in array and saves', () => {
    const a = makeIdea({ id: 'a' });
    const b = makeIdea({ id: 'b' });
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([a, b]), post: postSpy });
    TestBed.tick();
    svc.reorder(0, 1);
    expect(svc.ideas()[0].id).toBe('b');
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
ng test --no-watch 2>&1 | grep -E "(FAIL|IdeaService)"
```

- [ ] **Step 3: Implement `IdeaService`**

```ts
// src/app/services/idea.service.ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Idea } from '../models/work-item.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class IdeaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/api/ideas`;

  readonly ideas = signal<Idea[]>([]);
  readonly ideasLoading = signal(true);
  readonly ideasError = signal(false);

  readonly activeIdeas = computed(() => this.ideas().filter(i => i.status === 'active'));
  readonly wontDoIdeas = computed(() => this.ideas().filter(i => i.status === 'wont-do'));

  constructor() {
    this.load();
  }

  load(): void {
    this.http.get<Idea[]>(this.baseUrl).subscribe({
      next: ideas => {
        this.ideas.set(ideas);
        this.ideasLoading.set(false);
      },
      error: err => {
        console.error('Failed to load ideas:', err);
        this.ideasError.set(true);
        this.ideasLoading.set(false);
      },
    });
  }

  add(title: string, description = ''): Idea {
    const idea: Idea = {
      type: 'idea',
      id: `id-${Date.now()}`,
      title,
      description,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    this.ideas.update(ideas => [idea, ...ideas]);
    this.save();
    return idea;
  }

  update(idea: Idea): void {
    this.ideas.update(ideas => ideas.map(i => i.id === idea.id ? idea : i));
    this.save();
  }

  reorder(fromIndex: number, toIndex: number): void {
    this.ideas.update(ideas => {
      const arr = [...ideas];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      return arr;
    });
    this.save();
  }

  private save(): void {
    this.http.post<Idea[]>(this.baseUrl, this.ideas()).subscribe({
      error: err => console.error('Failed to save ideas:', err),
    });
  }
}
```

- [ ] **Step 4: Run tests — expect passes**

```bash
ng test --no-watch 2>&1 | grep -E "(PASS|FAIL|IdeaService)"
```

- [ ] **Step 5: Commit**

```bash
git add src/app/services/idea.service.ts src/app/services/idea.service.spec.ts
git commit -m "feat: add IdeaService with BFF persistence and computed views"
```

---

### Task 6: Clean up `WorkDataService` and add coordinator methods

**Files:**
- Modify: `src/app/services/work-data.service.ts`
- Modify: `src/app/services/work-data.service.spec.ts`

Remove todo state from `WorkDataService`. Add `promoteToTodo` and `demoteToIdea`. Remove import of `Todo` from the constructor parameter where it was used for seed data.

- [ ] **Step 1: Write tests for the coordinator methods**

Add a new describe block to `work-data.service.spec.ts`:

```ts
// Add at the bottom of work-data.service.spec.ts
import { IdeaService } from './idea.service';
import { TodoService } from './todo.service';
import { Idea, Todo } from '../models/work-item.model';

describe('WorkDataService — coordinator', () => {
  const mockJira = { getAssignedActiveTickets: () => of([]) };
  const mockBitbucket = { getReviewerPullRequests: () => of([]) };

  afterEach(() => TestBed.resetTestingModule());

  it('promoteToTodo marks idea as wont-do and adds a new todo', () => {
    const idea: Idea = {
      type: 'idea', id: 'i1', title: 'Idea', description: 'desc',
      status: 'active', createdAt: '2026-03-16T00:00:00',
    };

    const updatedIdeas: Idea[] = [];
    const addedTodos: Todo[] = [];
    let selected: unknown = null;

    const mockIdea = {
      update: (i: Idea) => updatedIdeas.push(i),
      add: (title: string, desc: string) => {
        const t: Todo = { type: 'todo', id: 'new1', title, description: desc, status: 'open', urgent: false, createdAt: '', completedAt: null };
        addedTodos.push(t);
        return t;
      },
    };
    const mockTodo = { add: mockIdea.add };

    TestBed.configureTestingModule({});
    TestBed.overrideProvider(JiraService, { useValue: mockJira });
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    TestBed.overrideProvider(IdeaService, { useValue: mockIdea });
    TestBed.overrideProvider(TodoService, { useValue: mockTodo });

    const svc = TestBed.inject(WorkDataService);
    svc.promoteToTodo(idea);

    expect(updatedIdeas[0]).toEqual({ ...idea, status: 'wont-do' });
    expect(addedTodos[0].title).toBe('Idea');
  });

  it('demoteToIdea removes todo and adds a new idea', () => {
    const todo: Todo = {
      type: 'todo', id: 'td1', title: 'Task', description: 'desc',
      status: 'open', urgent: false, createdAt: '', completedAt: null,
    };

    const removedIds: string[] = [];
    const addedIdeas: Idea[] = [];

    const mockTodo = {
      remove: (id: string) => removedIds.push(id),
    };
    const mockIdea = {
      add: (title: string, desc: string) => {
        const i: Idea = { type: 'idea', id: 'new1', title, description: desc, status: 'active', createdAt: '' };
        addedIdeas.push(i);
        return i;
      },
    };

    TestBed.configureTestingModule({});
    TestBed.overrideProvider(JiraService, { useValue: mockJira });
    TestBed.overrideProvider(BitbucketService, { useValue: mockBitbucket });
    TestBed.overrideProvider(IdeaService, { useValue: mockIdea });
    TestBed.overrideProvider(TodoService, { useValue: mockTodo });

    const svc = TestBed.inject(WorkDataService);
    svc.demoteToIdea(todo);

    expect(removedIds).toContain('td1');
    expect(addedIdeas[0].title).toBe('Task');
  });
});
```

- [ ] **Step 2: Run tests — expect failures for coordinator tests**

```bash
ng test --no-watch 2>&1 | grep -E "(FAIL|coordinator)"
```

- [ ] **Step 3: Update `WorkDataService`**

Replace the file content:

```ts
import { Injectable, signal, computed, inject, effect, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { Idea, JiraTicket, PrStatus, PullRequest, Todo, WorkItem } from '../models/work-item.model';
import { JiraService } from './jira.service';
import { BitbucketService } from './bitbucket.service';
import { TodoService } from './todo.service';
import { IdeaService } from './idea.service';

@Injectable({ providedIn: 'root' })
export class WorkDataService {
  private readonly jira = inject(JiraService);
  private readonly bitbucket = inject(BitbucketService);
  private readonly todoService = inject(TodoService);
  private readonly ideaService = inject(IdeaService);

  readonly ticketsLoading = signal(true);
  readonly ticketsError = signal(false);

  private readonly tickets$ = this.jira.getAssignedActiveTickets().pipe(
    tap(() => this.ticketsLoading.set(false)),
    catchError(err => {
      console.error('Failed to load Jira tickets:', err);
      this.ticketsError.set(true);
      this.ticketsLoading.set(false);
      return of([] as JiraTicket[]);
    }),
  );

  readonly tickets = toSignal(this.tickets$, { initialValue: [] as JiraTicket[] });

  readonly pullRequestsLoading = signal(true);
  readonly pullRequestsError = signal(false);
  private readonly _rawPullRequests = signal<PullRequest[]>([]);

  readonly pullRequests = computed(() => {
    const statusOrder: Record<PrStatus, number> = {
      'Awaiting Review': 0,
      'Needs Re-review': 1,
      'Changes Requested': 2,
      'Approved by Others': 3,
      'Approved': 4,
    };
    return this._rawPullRequests()
      .filter(pr => pr.myReviewStatus !== 'Approved')
      .sort((a, b) => statusOrder[a.myReviewStatus] - statusOrder[b.myReviewStatus]);
  });

  readonly awaitingReviewCount = computed(() =>
    this.pullRequests().filter(
      pr => pr.myReviewStatus === 'Awaiting Review' || pr.myReviewStatus === 'Needs Re-review'
    ).length
  );

  readonly selectedItem = signal<WorkItem | null>(null);

  constructor() {
    effect(() => {
      untracked(() => {
        this.bitbucket.getReviewerPullRequests().pipe(
          tap(prs => {
            this.pullRequestsLoading.set(false);
            this._rawPullRequests.set(prs);
          }),
          switchMap(prs => {
            const needsWorkPrs = prs.filter(pr => pr.myReviewStatus === 'Changes Requested');
            if (needsWorkPrs.length === 0) return of(null);

            return forkJoin(
              needsWorkPrs.map(pr =>
                this.bitbucket.getReviewerPrActivityStatus(pr).pipe(
                  catchError(() => of('Changes Requested' as const))
                )
              )
            ).pipe(
              tap(results => {
                const statusById = new Map(needsWorkPrs.map((pr, i) => [pr.id, results[i]]));
                this._rawPullRequests.update(all =>
                  all.map(pr => {
                    const enriched = statusById.get(pr.id);
                    return enriched ? { ...pr, myReviewStatus: enriched } : pr;
                  })
                );
              })
            );
          }),
          catchError(err => {
            console.error('Failed to load Bitbucket pull requests:', err);
            this.pullRequestsError.set(true);
            this.pullRequestsLoading.set(false);
            return of(null);
          }),
        ).subscribe();
      });
    });
  }

  select(item: WorkItem): void {
    this.selectedItem.set(item);
  }

  promoteToTodo(idea: Idea): void {
    this.ideaService.update({ ...idea, status: 'wont-do' });
    const todo = this.todoService.add(idea.title, idea.description);
    this.selectedItem.set(todo);
  }

  demoteToIdea(todo: Todo): void {
    this.todoService.remove(todo.id);
    const idea = this.ideaService.add(todo.title, todo.description);
    this.selectedItem.set(idea);
  }
}
```

- [ ] **Step 4: Run all tests**

```bash
ng test --no-watch 2>&1 | tail -20
```

Expected: all existing tests plus the new coordinator tests pass. The old `pendingTodoCount`, `addTodo`, `toggleTodo` references in other files will cause compile errors — these are fixed in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/work-data.service.ts src/app/services/work-data.service.spec.ts
git commit -m "refactor(WorkDataService): remove todo state, add promoteToTodo/demoteToIdea coordinator methods"
```

---

## Chunk 2: Action Rail + Layout

### Task 7: Create `ActionRailComponent`

**Files:**
- Create: `src/app/components/action-rail/action-rail.ts`
- Create: `src/app/components/action-rail/action-rail.spec.ts`

The action rail reads `selectedItem` from `WorkDataService` and renders context-specific buttons. It calls methods on `TodoService`, `IdeaService`, or `WorkDataService` as appropriate.

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/components/action-rail/action-rail.spec.ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { WorkDataService } from '../../services/work-data.service';
import { TodoService } from '../../services/todo.service';
import { IdeaService } from '../../services/idea.service';
import { ActionRailComponent } from './action-rail';
import { Todo, Idea, JiraTicket } from '../../models/work-item.model';

const makeTodo = (overrides: Partial<Todo> = {}): Todo => ({
  type: 'todo', id: 'td1', title: 'Test', description: '',
  status: 'open', urgent: false, createdAt: '', completedAt: null, ...overrides,
});

const makeIdea = (overrides: Partial<Idea> = {}): Idea => ({
  type: 'idea', id: 'id1', title: 'Test', description: '',
  status: 'active', createdAt: '', ...overrides,
});

describe('ActionRailComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(selectedItem: unknown) {
    const mockData = { selectedItem: signal(selectedItem) };
    const updateSpy = vi.fn();
    const promoteSpy = vi.fn();
    const demoteSpy = vi.fn();

    TestBed.configureTestingModule({
      imports: [ActionRailComponent],
      providers: [
        { provide: WorkDataService, useValue: { selectedItem: mockData.selectedItem, promoteToTodo: promoteSpy, demoteToIdea: demoteSpy } },
        { provide: TodoService, useValue: { update: updateSpy } },
        { provide: IdeaService, useValue: { update: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(ActionRailComponent);
    fixture.detectChanges();
    return { fixture, updateSpy, promoteSpy, demoteSpy };
  }

  it('renders nothing meaningful when no item selected', () => {
    const { fixture } = setup(null);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('button').length).toBe(0);
  });

  it('shows Erledigt button for open todo', () => {
    const { fixture } = setup(makeTodo({ status: 'open' }));
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const labels = Array.from(buttons).map((b: Element) => b.textContent?.trim());
    expect(labels).toContain('Erledigt');
  });

  it('shows Wieder öffnen for done todo', () => {
    const { fixture } = setup(makeTodo({ status: 'done', completedAt: '2026-03-16T00:00:00' }));
    const labels = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .map((b: Element) => b.textContent?.trim());
    expect(labels.some(l => l?.includes('Wieder öffnen'))).toBe(true);
  });

  it('shows Zur Aufgabe machen for active idea', () => {
    const { fixture } = setup(makeIdea({ status: 'active' }));
    const labels = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .map((b: Element) => b.textContent?.trim());
    expect(labels.some(l => l?.includes('Zur Aufgabe machen'))).toBe(true);
  });

  it('shows In Jira öffnen link for ticket', () => {
    const ticket: Partial<JiraTicket> = { type: 'ticket', url: 'https://jira.example.com/browse/T-1' };
    const { fixture } = setup(ticket);
    const link = fixture.nativeElement.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('https://jira.example.com/browse/T-1');
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
ng test --no-watch 2>&1 | grep -E "(FAIL|ActionRail)"
```

- [ ] **Step 3: Implement `ActionRailComponent`**

```ts
// src/app/components/action-rail/action-rail.ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WorkDataService } from '../../services/work-data.service';
import { TodoService } from '../../services/todo.service';
import { IdeaService } from '../../services/idea.service';
import { Todo, Idea, JiraTicket, PullRequest } from '../../models/work-item.model';

@Component({
  selector: 'app-action-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'w-36 shrink-0 border-l border-stone-100 bg-stone-50 flex flex-col p-3 gap-2' },
  template: `
    @let item = data.selectedItem();

    @if (item?.type === 'todo') {
      @let todo = asTodo(item);
      @if (todo.status === 'open') {
        <button type="button" class="action-btn action-btn-green" (click)="completeTodo(todo)">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
          Erledigt
        </button>
        <button type="button"
          class="action-btn"
          [class]="todo.urgent ? 'action-btn-amber' : 'action-btn-stone'"
          (click)="toggleUrgent(todo)"
          [attr.aria-pressed]="todo.urgent"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
          Dringend
        </button>
        <button type="button" class="action-btn action-btn-stone" (click)="data.demoteToIdea(todo)">
          Zur Idee machen
        </button>
        <button type="button" class="action-btn action-btn-muted" (click)="wontDo(todo)">
          Nicht erledigen
        </button>
      }
      @if (todo.status === 'done') {
        <button type="button" class="action-btn action-btn-stone" (click)="reopenTodo(todo)">
          Wieder öffnen
        </button>
        <button type="button" class="action-btn action-btn-stone" (click)="data.demoteToIdea(todo)">
          Zur Idee machen
        </button>
      }
      @if (todo.status === 'wont-do') {
        <button type="button" class="action-btn action-btn-stone" (click)="reopenTodo(todo)">
          Wieder öffnen
        </button>
      }
    }

    @if (item?.type === 'idea') {
      @let idea = asIdea(item);
      @if (idea.status === 'active') {
        <button type="button" class="action-btn action-btn-indigo" (click)="data.promoteToTodo(idea)">
          Zur Aufgabe machen
        </button>
        <button type="button" class="action-btn action-btn-muted" (click)="wontFollowIdea(idea)">
          Nicht verfolgen
        </button>
      }
      @if (idea.status === 'wont-do') {
        <button type="button" class="action-btn action-btn-stone" (click)="reviveIdea(idea)">
          Wieder aufgreifen
        </button>
      }
    }

    @if (item?.type === 'ticket') {
      @let ticket = asTicket(item);
      <a
        [href]="ticket.url"
        target="_blank"
        rel="noopener noreferrer"
        class="action-btn action-btn-indigo text-center no-underline"
      >
        ↗ In Jira öffnen
      </a>
    }

    @if (item?.type === 'pr') {
      @let pr = asPr(item);
      <a
        [href]="pr.url"
        target="_blank"
        rel="noopener noreferrer"
        class="action-btn action-btn-indigo text-center no-underline"
      >
        ↗ In Bitbucket öffnen
      </a>
    }
  `,
  styles: [`
    :host {
      .action-btn {
        @apply flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center;
      }
      .action-btn-green {
        @apply bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100;
      }
      .action-btn-amber {
        @apply bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100;
      }
      .action-btn-indigo {
        @apply bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100;
      }
      .action-btn-stone {
        @apply bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300;
      }
      .action-btn-muted {
        @apply bg-stone-50 border-stone-200 text-stone-400 hover:border-stone-300;
      }
    }
  `],
})
export class ActionRailComponent {
  protected readonly data = inject(WorkDataService);
  private readonly todoService = inject(TodoService);
  private readonly ideaService = inject(IdeaService);

  asTodo(item: unknown): Todo { return item as Todo; }
  asIdea(item: unknown): Idea { return item as Idea; }
  asTicket(item: unknown): JiraTicket { return item as JiraTicket; }
  asPr(item: unknown): PullRequest { return item as PullRequest; }

  completeTodo(todo: Todo): void {
    this.todoService.update({ ...todo, status: 'done' as const });
    const updated = this.todoService.todos().find(t => t.id === todo.id);
    if (updated) this.data.selectedItem.set(updated);
  }

  toggleUrgent(todo: Todo): void {
    const updated = { ...todo, urgent: !todo.urgent };
    this.todoService.update(updated);
    this.data.selectedItem.set(updated);
  }

  wontDo(todo: Todo): void {
    const updated = { ...todo, status: 'wont-do' as const };
    this.todoService.update(updated);
    this.data.selectedItem.set(updated);
  }

  reopenTodo(todo: Todo): void {
    const updated = { ...todo, status: 'open' as const, completedAt: null };
    this.todoService.update(updated);
    this.data.selectedItem.set(updated);
  }

  wontFollowIdea(idea: Idea): void {
    const updated = { ...idea, status: 'wont-do' as const };
    this.ideaService.update(updated);
    this.data.selectedItem.set(updated);
  }

  reviveIdea(idea: Idea): void {
    const updated = { ...idea, status: 'active' as const };
    this.ideaService.update(updated);
    this.data.selectedItem.set(updated);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
ng test --no-watch 2>&1 | grep -E "(PASS|FAIL|ActionRail)"
```

- [ ] **Step 5: Commit**

```bash
git add src/app/components/action-rail/
git commit -m "feat: add ActionRailComponent with context-sensitive actions per item type"
```

---

### Task 8: Update app layout and remove external links from detail components

**Files:**
- Modify: `src/app/app.html`
- Modify: `src/app/app.ts`
- Modify: `src/app/components/ticket-detail/ticket-detail.ts` (template — remove "In Jira öffnen" link)
- Modify: `src/app/components/pr-detail/pr-detail.ts` (template — remove "In Bitbucket öffnen" link)

- [ ] **Step 1: Update `app.html`** — split the workbench wrapper to add the action rail column

Replace:
```html
<div class="flex-1 overflow-hidden bg-stone-50">
    <app-workbench />
  </div>
```

With:
```html
<div class="flex-1 overflow-hidden flex">
    <div class="flex-1 overflow-hidden bg-stone-50">
      <app-workbench />
    </div>
    <app-action-rail />
  </div>
```

- [ ] **Step 2: Update `app.ts`** — import `ActionRailComponent`

Add `ActionRailComponent` to the imports array and add the import statement:
```ts
import { ActionRailComponent } from './components/action-rail/action-rail';
```

- [ ] **Step 3: Remove "In Jira öffnen" from `ticket-detail.ts`**

Find the link element (look for `ticket().url` inside an `<a>` tag in the sticky header) and delete it. The action rail now provides this link.

Search for: `ticket-detail.ts` — the link will be in a `<a [href]="ticket().url"` pattern. Remove the entire `<a>` element.

- [ ] **Step 4: Remove "In Bitbucket öffnen" from `pr-detail.ts`**

Same as above — find `<a [href]="pr().url"` and remove.

- [ ] **Step 5: Run the app manually and verify the action rail appears**

```bash
ng serve
```

Open `http://localhost:6200`, select a Jira ticket — the action rail should show "In Jira öffnen" in the right column.

- [ ] **Step 6: Run tests**

```bash
ng test --no-watch 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add src/app/app.html src/app/app.ts src/app/components/ticket-detail/ticket-detail.ts src/app/components/pr-detail/pr-detail.ts
git commit -m "feat: add action rail column to app layout, move external links from detail headers"
```

---

## Chunk 3: Todo enhancements

### Task 9: Update `TodoDetailComponent` — inline editing, inject `TodoService`

**Files:**
- Modify: `src/app/components/todo-detail/todo-detail.ts`

The detail panel becomes a pure edit view. All action buttons are removed (they moved to the rail). Title and description are click-to-edit.

- [ ] **Step 1: Rewrite `TodoDetailComponent`**

```ts
// src/app/components/todo-detail/todo-detail.ts
import { ChangeDetectionStrategy, Component, inject, input, signal, effect } from '@angular/core';
import { Todo } from '../../models/work-item.model';
import { TodoService } from '../../services/todo.service';
import { WorkDataService } from '../../services/work-data.service';

@Component({
  selector: 'app-todo-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="h-full flex flex-col max-w-2xl mx-auto w-full" [attr.aria-label]="'Todo: ' + todo().title">
      <header class="pb-5 border-b border-stone-200">
        <div class="flex items-start gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2">
              <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
                [class]="statusBadgeClass()">
                {{ statusLabel() }}
              </span>
              @if (todo().urgent) {
                <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-800 border border-amber-300">
                  Dringend
                </span>
              }
            </div>

            @if (editingTitle()) {
              <input
                #titleInput
                type="text"
                class="text-xl font-semibold text-stone-900 leading-snug w-full bg-transparent border-b-2 border-indigo-400 focus:outline-none"
                [value]="draftTitle()"
                (input)="draftTitle.set($any($event.target).value)"
                (blur)="saveTitle()"
                (keydown)="onTitleKeydown($event)"
                aria-label="Titel bearbeiten"
              />
            } @else {
              <h1
                class="text-xl font-semibold text-stone-900 leading-snug cursor-pointer hover:text-indigo-700 transition-colors"
                [class]="todo().status === 'done' ? 'line-through text-stone-400' : ''"
                (click)="startEditTitle()"
                tabindex="0"
                (keydown.enter)="startEditTitle()"
                aria-label="Titel anklicken zum Bearbeiten"
              >{{ todo().title }}</h1>
            }
          </div>
        </div>
      </header>

      <div class="py-5 border-b border-stone-200">
        <dl class="grid grid-cols-2 gap-4">
          <div>
            <dt class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Erstellt am</dt>
            <dd class="text-sm text-stone-700">{{ formatDate(todo().createdAt) }}</dd>
          </div>
          @if (todo().completedAt) {
            <div>
              <dt class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Erledigt am</dt>
              <dd class="text-sm text-stone-700">{{ formatDate(todo().completedAt!) }}</dd>
            </div>
          }
        </dl>
      </div>

      <div class="flex-1 py-5 overflow-y-auto">
        <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Notizen</h2>

        @if (editingDescription()) {
          <textarea
            class="text-sm text-stone-700 leading-relaxed w-full bg-transparent border border-indigo-400 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[120px] resize-none"
            [value]="draftDescription()"
            (input)="draftDescription.set($any($event.target).value)"
            (blur)="saveDescription()"
            (keydown)="onDescriptionKeydown($event)"
            aria-label="Notizen bearbeiten"
          ></textarea>
          <p class="text-xs text-stone-400 mt-1">Ctrl+Enter zum Speichern · Escape zum Abbrechen</p>
        } @else {
          <div
            class="text-sm text-stone-700 leading-relaxed whitespace-pre-line cursor-pointer min-h-[60px] hover:bg-stone-50 rounded-md p-1 -m-1 transition-colors"
            (click)="startEditDescription()"
            tabindex="0"
            (keydown.enter)="startEditDescription()"
            [attr.aria-label]="todo().description ? 'Notizen anklicken zum Bearbeiten' : 'Notizen hinzufügen'"
          >
            @if (todo().description) {
              {{ todo().description }}
            } @else {
              <span class="text-stone-400 italic">Notizen hinzufügen…</span>
            }
          </div>
        }
      </div>
    </article>
  `,
})
export class TodoDetailComponent {
  todo = input.required<Todo>();
  private readonly todoService = inject(TodoService);
  private readonly workData = inject(WorkDataService);

  editingTitle = signal(false);
  editingDescription = signal(false);
  draftTitle = signal('');
  draftDescription = signal('');

  constructor() {
    effect(() => {
      const t = this.todo();
      this.draftTitle.set(t.title);
      this.draftDescription.set(t.description);
      this.editingTitle.set(false);
      this.editingDescription.set(false);
    });
  }

  statusBadgeClass(): string {
    switch (this.todo().status) {
      case 'done': return 'bg-emerald-100 text-emerald-700';
      case 'wont-do': return 'bg-stone-100 text-stone-500';
      default: return 'bg-indigo-100 text-indigo-700';
    }
  }

  statusLabel(): string {
    switch (this.todo().status) {
      case 'done': return 'Erledigt';
      case 'wont-do': return 'Nicht verfolgt';
      default: return 'Offen';
    }
  }

  startEditTitle(): void {
    this.draftTitle.set(this.todo().title);
    this.editingTitle.set(true);
  }

  saveTitle(): void {
    const val = this.draftTitle().trim();
    if (val && val !== this.todo().title) {
      const updated = { ...this.todo(), title: val };
      this.todoService.update(updated);
      this.workData.selectedItem.set(updated);
    }
    this.editingTitle.set(false);
  }

  onTitleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') { e.preventDefault(); this.saveTitle(); }
    if (e.key === 'Escape') { this.editingTitle.set(false); }
  }

  startEditDescription(): void {
    this.draftDescription.set(this.todo().description);
    this.editingDescription.set(true);
  }

  saveDescription(): void {
    const val = this.draftDescription().trim();
    if (val !== this.todo().description) {
      const updated = { ...this.todo(), description: val };
      this.todoService.update(updated);
      this.workData.selectedItem.set(updated);
    }
    this.editingDescription.set(false);
  }

  onDescriptionKeydown(e: KeyboardEvent): void {
    if (e.ctrlKey && e.key === 'Enter') { this.saveDescription(); }
    if (e.key === 'Escape') { this.editingDescription.set(false); }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
```

- [ ] **Step 2: Run tests**

```bash
ng test --no-watch 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/components/todo-detail/todo-detail.ts
git commit -m "feat(todo-detail): inline title/description editing, remove action buttons, inject TodoService"
```

---

### Task 10: Update `TodoCardComponent` — drag handle, urgent stripe, completion celebration

**Files:**
- Modify: `src/app/components/todo-card/todo-card.ts`
- Modify: `src/app/components/navigator/navigator.ts` (update toggle handler to use TodoService)

The card gains a drag handle (shown on hover), an amber left stripe when `urgent`, and watches `TodoService.lastCompletedId` to trigger the completion animation. The existing checkbox still emits `toggle` — the celebration runs when the id matches `lastCompletedId`.

- [ ] **Step 1: Update `TodoCardComponent`**

```ts
// src/app/components/todo-card/todo-card.ts
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { Todo } from '../../models/work-item.model';
import { TodoService } from '../../services/todo.service';

const CONFETTI_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

@Component({
  selector: 'app-todo-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDragHandle],
  styles: [`
    @keyframes celebrateBounce {
      0% { transform: scale(1); }
      30% { transform: scale(1.4); }
      60% { transform: scale(0.9); }
      100% { transform: scale(1); }
    }
    .celebrating .checkbox-inner {
      animation: celebrateBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes confettiFly {
      0% { transform: translate(0,0) scale(1); opacity: 1; }
      100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
    }
    .confetti-particle {
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      pointer-events: none;
      animation: confettiFly 0.65s ease-out forwards;
    }
  `],
  template: `
    <div
      class="group relative w-full rounded-lg border transition-all duration-150"
      [class]="outerClasses()"
    >
      @if (todo().urgent) {
        <div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-amber-500" aria-hidden="true"></div>
      }

      <div class="flex items-start gap-2.5 px-3 py-2.5 pl-4">
        <div class="relative mt-0.5 shrink-0" #checkboxRef>
          <button
            type="button"
            class="checkbox-inner w-4 h-4 rounded border-2 transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500"
            [class]="checkboxClass()"
            (click)="onToggle()"
            [attr.aria-label]="todo().status === 'done' ? 'Als offen markieren' : 'Als erledigt markieren'"
            [attr.aria-checked]="todo().status === 'done'"
            role="checkbox"
          >
            @if (todo().status === 'done') {
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            }
          </button>
        </div>

        <button
          type="button"
          class="flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 rounded"
          (click)="select.emit(todo())"
          [attr.aria-pressed]="selected()"
          [attr.aria-label]="todo().title"
        >
          <p class="text-sm font-medium leading-snug text-stone-800"
            [class]="todo().status === 'done' ? 'line-through text-stone-400' : ''">
            {{ todo().title }}
          </p>
        </button>

        <div
          cdkDragHandle
          class="opacity-0 group-hover:opacity-100 transition-opacity text-stone-300 cursor-grab active:cursor-grabbing ml-1 shrink-0 self-center select-none"
          aria-label="Aufgabe verschieben"
        >⠿</div>
      </div>
    </div>
  `,
})
export class TodoCardComponent {
  todo = input.required<Todo>();
  selected = input(false);
  highlighted = input(false);
  select = output<Todo>();
  toggle = output<string>();

  private readonly todoService = inject(TodoService);
  private readonly checkboxRef = viewChild<ElementRef<HTMLElement>>('checkboxRef');

  celebrating = computed(() => this.todoService.lastCompletedId() === this.todo().id);

  constructor() {
    effect(() => {
      if (this.celebrating()) {
        this.playChime();
        this.spawnConfetti();
      }
    });
  }

  outerClasses = computed(() => {
    const base = this.selected()
      ? 'bg-indigo-50 border-indigo-300 shadow-sm'
      : this.todo().status === 'done'
        ? 'bg-stone-50 border-stone-150 opacity-60'
        : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-sm';
    const highlight = this.highlighted() ? ' animate-highlight' : '';
    const celebrate = this.celebrating() ? ' celebrating' : '';
    return base + highlight + celebrate;
  });

  checkboxClass = computed(() =>
    this.todo().status === 'done'
      ? 'bg-emerald-500 border-emerald-500'
      : 'border-stone-300 hover:border-indigo-400'
  );

  onToggle(): void {
    const t = this.todo();
    if (t.status === 'open') {
      this.todoService.update({ ...t, status: 'done' as const });
    } else {
      this.todoService.update({ ...t, status: 'open' as const, completedAt: null });
    }
    this.toggle.emit(t.id);
  }

  private spawnConfetti(): void {
    const anchor = this.checkboxRef()?.nativeElement;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 12; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-particle';
      const angle = (i / 12) * 2 * Math.PI;
      const dist = 40 + Math.random() * 30;
      el.style.cssText = `
        left:${cx}px; top:${cy}px; position:fixed; z-index:9999;
        background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};
        --tx:${Math.cos(angle) * dist}px; --ty:${Math.sin(angle) * dist}px;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 700);
    }
  }

  private playChime(): void {
    try {
      const ctx = new AudioContext();
      const notes = [261.63, 329.63, 392.00];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
      });
      setTimeout(() => ctx.close(), 800);
    } catch {}
  }
}
```

- [ ] **Step 2: Update `NavigatorComponent`** — it currently calls `data.toggleTodo()` which no longer exists. Remove that method call and inject `TodoService` directly for the `pendingCount`.

In `navigator.ts`:
- Remove the `toggleTodo()` method
- Import `TodoService` and inject it
- The template's `(toggle)="toggleTodo($event)"` on `app-todo-card` can be removed since the card now handles toggles internally

- [ ] **Step 3: Run tests**

```bash
ng test --no-watch 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add src/app/components/todo-card/todo-card.ts src/app/components/navigator/navigator.ts
git commit -m "feat(todo-card): add drag handle, urgent stripe, completion celebration animation"
```

---

## Chunk 4: Ideas system

### Task 11: Create `IdeaCardComponent`

**Files:**
- Create: `src/app/components/idea-card/idea-card.ts`

- [ ] **Step 1: Create the component**

```ts
// src/app/components/idea-card/idea-card.ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Idea } from '../../models/work-item.model';

@Component({
  selector: 'app-idea-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="group w-full text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 flex items-start gap-2.5"
      [class]="cardClasses()"
      (click)="select.emit(idea())"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="idea().title"
    >
      <span class="mt-0.5 shrink-0 text-sm" aria-hidden="true">💡</span>
      <p class="text-sm font-medium leading-snug text-stone-800 flex-1"
        [class]="idea().status === 'wont-do' ? 'line-through text-stone-400' : ''">
        {{ idea().title }}
      </p>
      <div
        class="opacity-0 group-hover:opacity-100 transition-opacity text-stone-300 cursor-grab active:cursor-grabbing ml-1 shrink-0 self-center select-none"
        aria-hidden="true"
      >⠿</div>
    </button>
  `,
})
export class IdeaCardComponent {
  idea = input.required<Idea>();
  selected = input(false);
  select = output<Idea>();

  cardClasses = computed(() =>
    this.selected()
      ? 'bg-indigo-50 border-indigo-300 shadow-sm'
      : this.idea().status === 'wont-do'
        ? 'bg-stone-50 border-stone-150 opacity-60'
        : 'bg-indigo-50/40 border-indigo-100 hover:border-indigo-200 hover:shadow-sm'
  );
}
```

- [ ] **Step 2: Run tests**

```bash
ng test --no-watch 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/app/components/idea-card/idea-card.ts
git commit -m "feat: add IdeaCardComponent with indigo styling and drag handle"
```

---

### Task 12: Create `IdeaDetailComponent`

**Files:**
- Create: `src/app/components/idea-detail/idea-detail.ts`

- [ ] **Step 1: Create the component**

```ts
// src/app/components/idea-detail/idea-detail.ts
import { ChangeDetectionStrategy, Component, inject, input, signal, effect } from '@angular/core';
import { Idea } from '../../models/work-item.model';
import { IdeaService } from '../../services/idea.service';
import { WorkDataService } from '../../services/work-data.service';

@Component({
  selector: 'app-idea-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="h-full flex flex-col max-w-2xl mx-auto w-full" [attr.aria-label]="'Idee: ' + idea().title">
      <header class="pb-5 border-b border-stone-200">
        <div class="flex items-start gap-2 mb-2">
          <span class="text-lg" aria-hidden="true">💡</span>
          <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
            [class]="idea().status === 'wont-do' ? 'bg-stone-100 text-stone-500' : 'bg-indigo-100 text-indigo-700'">
            {{ idea().status === 'wont-do' ? 'Nicht verfolgt' : 'Aktiv' }}
          </span>
        </div>

        @if (editingTitle()) {
          <input
            type="text"
            class="text-xl font-semibold text-stone-900 leading-snug w-full bg-transparent border-b-2 border-indigo-400 focus:outline-none"
            [value]="draftTitle()"
            (input)="draftTitle.set($any($event.target).value)"
            (blur)="saveTitle()"
            (keydown)="onTitleKeydown($event)"
            aria-label="Titel bearbeiten"
          />
        } @else {
          <h1
            class="text-xl font-semibold text-stone-900 leading-snug cursor-pointer hover:text-indigo-700 transition-colors"
            [class]="idea().status === 'wont-do' ? 'line-through text-stone-400' : ''"
            (click)="startEditTitle()"
            tabindex="0"
            (keydown.enter)="startEditTitle()"
            aria-label="Titel anklicken zum Bearbeiten"
          >{{ idea().title }}</h1>
        }
      </header>

      <div class="py-5 border-b border-stone-200">
        <dl>
          <div>
            <dt class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Erstellt am</dt>
            <dd class="text-sm text-stone-700">{{ formatDate(idea().createdAt) }}</dd>
          </div>
        </dl>
      </div>

      <div class="flex-1 py-5 overflow-y-auto">
        <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Notizen</h2>

        @if (editingDescription()) {
          <textarea
            class="text-sm text-stone-700 leading-relaxed w-full bg-transparent border border-indigo-400 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[120px] resize-none"
            [value]="draftDescription()"
            (input)="draftDescription.set($any($event.target).value)"
            (blur)="saveDescription()"
            (keydown)="onDescriptionKeydown($event)"
            aria-label="Notizen bearbeiten"
          ></textarea>
          <p class="text-xs text-stone-400 mt-1">Ctrl+Enter zum Speichern · Escape zum Abbrechen</p>
        } @else {
          <div
            class="text-sm text-stone-700 leading-relaxed whitespace-pre-line cursor-pointer min-h-[60px] hover:bg-stone-50 rounded-md p-1 -m-1 transition-colors"
            (click)="startEditDescription()"
            tabindex="0"
            (keydown.enter)="startEditDescription()"
            [attr.aria-label]="idea().description ? 'Notizen anklicken zum Bearbeiten' : 'Notizen hinzufügen'"
          >
            @if (idea().description) {
              {{ idea().description }}
            } @else {
              <span class="text-stone-400 italic">Notizen hinzufügen…</span>
            }
          </div>
        }
      </div>
    </article>
  `,
})
export class IdeaDetailComponent {
  idea = input.required<Idea>();
  private readonly ideaService = inject(IdeaService);
  private readonly workData = inject(WorkDataService);

  editingTitle = signal(false);
  editingDescription = signal(false);
  draftTitle = signal('');
  draftDescription = signal('');

  constructor() {
    effect(() => {
      const i = this.idea();
      this.draftTitle.set(i.title);
      this.draftDescription.set(i.description);
      this.editingTitle.set(false);
      this.editingDescription.set(false);
    });
  }

  startEditTitle(): void { this.draftTitle.set(this.idea().title); this.editingTitle.set(true); }

  saveTitle(): void {
    const val = this.draftTitle().trim();
    if (val && val !== this.idea().title) {
      const updated = { ...this.idea(), title: val };
      this.ideaService.update(updated);
      this.workData.selectedItem.set(updated);
    }
    this.editingTitle.set(false);
  }

  onTitleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') { e.preventDefault(); this.saveTitle(); }
    if (e.key === 'Escape') { this.editingTitle.set(false); }
  }

  startEditDescription(): void { this.draftDescription.set(this.idea().description); this.editingDescription.set(true); }

  saveDescription(): void {
    const val = this.draftDescription().trim();
    if (val !== this.idea().description) {
      const updated = { ...this.idea(), description: val };
      this.ideaService.update(updated);
      this.workData.selectedItem.set(updated);
    }
    this.editingDescription.set(false);
  }

  onDescriptionKeydown(e: KeyboardEvent): void {
    if (e.ctrlKey && e.key === 'Enter') { this.saveDescription(); }
    if (e.key === 'Escape') { this.editingDescription.set(false); }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
```

- [ ] **Step 2: Update `WorkbenchComponent`** — add the idea branch

In `workbench.ts`, add `IdeaDetailComponent` to imports and add to `workbench.html`:

```html
@if (item?.type === 'idea') {
  <div class="flex-1 overflow-y-auto p-6 lg:p-8">
    <app-idea-detail [idea]="$any(item)" />
  </div>
}
```

- [ ] **Step 3: Run tests**

```bash
ng test --no-watch 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/app/components/idea-detail/ src/app/components/workbench/
git commit -m "feat: add IdeaDetailComponent with inline editing, add idea branch to WorkbenchComponent"
```

---

## Chunk 5: Navigator — Ideen section + drag-and-drop + CollapsedState

### Task 13: Update `NavigatorComponent` with Ideen section, drag-to-reorder, and new CollapsedState

**Files:**
- Modify: `src/app/components/navigator/navigator.ts`
- Modify: `src/app/components/navigator/navigator.html`

This task adds the Ideen section, enables CDK drag-and-drop for open todos and active ideas, and extends `CollapsedState` to 7 keys.

- [ ] **Step 1: Update `NavigatorComponent` TypeScript**

```ts
// src/app/components/navigator/navigator.ts
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { CdkDragDrop, CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { WorkDataService } from '../../services/work-data.service';
import { TodoService } from '../../services/todo.service';
import { IdeaService } from '../../services/idea.service';
import { WorkItem, Todo, Idea } from '../../models/work-item.model';
import { TicketCardComponent } from '../ticket-card/ticket-card';
import { PrCardComponent } from '../pr-card/pr-card';
import { TodoCardComponent } from '../todo-card/todo-card';
import { IdeaCardComponent } from '../idea-card/idea-card';
import { TodoInlineInputComponent } from '../todo-inline-input/todo-inline-input';

const STORAGE_KEY = 'orbit.navigator.collapsed';

interface CollapsedState {
  tickets: boolean;
  prs: boolean;
  todos: boolean;
  todosDone: boolean;
  todosWontDo: boolean;
  ideas: boolean;
  ideasWontDo: boolean;
}

@Component({
  selector: 'app-navigator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TicketCardComponent, PrCardComponent, TodoCardComponent, IdeaCardComponent, TodoInlineInputComponent, CdkDrag, CdkDropList],
  templateUrl: './navigator.html',
  host: { class: 'flex flex-col h-full' },
})
export class NavigatorComponent {
  protected readonly data = inject(WorkDataService);
  protected readonly todoService = inject(TodoService);
  protected readonly ideaService = inject(IdeaService);

  private readonly savedCollapsed = this.loadCollapsed();

  ticketsCollapsed = signal(this.savedCollapsed.tickets);
  prsCollapsed = signal(this.savedCollapsed.prs);
  todosCollapsed = signal(this.savedCollapsed.todos);
  todosDoneCollapsed = signal(this.savedCollapsed.todosDone);
  todosWontDoCollapsed = signal(this.savedCollapsed.todosWontDo);
  ideasCollapsed = signal(this.savedCollapsed.ideas);
  ideasWontDoCollapsed = signal(this.savedCollapsed.ideasWontDo);

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tickets: this.ticketsCollapsed(),
        prs: this.prsCollapsed(),
        todos: this.todosCollapsed(),
        todosDone: this.todosDoneCollapsed(),
        todosWontDo: this.todosWontDoCollapsed(),
        ideas: this.ideasCollapsed(),
        ideasWontDo: this.ideasWontDoCollapsed(),
      }));
    });
  }

  private loadCollapsed(): CollapsedState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...this.defaultCollapsed(), ...JSON.parse(raw) };
    } catch {}
    return this.defaultCollapsed();
  }

  private defaultCollapsed(): CollapsedState {
    return { tickets: false, prs: false, todos: false, todosDone: false, todosWontDo: false, ideas: false, ideasWontDo: false };
  }

  toggleTickets(): void { this.ticketsCollapsed.update(v => !v); }
  togglePrs(): void { this.prsCollapsed.update(v => !v); }
  toggleTodos(): void { this.todosCollapsed.update(v => !v); }
  toggleTodosDone(): void { this.todosDoneCollapsed.update(v => !v); }
  toggleTodosWontDo(): void { this.todosWontDoCollapsed.update(v => !v); }
  toggleIdeas(): void { this.ideasCollapsed.update(v => !v); }
  toggleIdeasWontDo(): void { this.ideasWontDoCollapsed.update(v => !v); }

  isSelected(item: WorkItem): boolean {
    return this.data.selectedItem()?.id === item.id;
  }

  selectItem(item: WorkItem): void {
    this.data.select(item);
  }

  addTodo(title: string): void {
    this.todoService.add(title);
  }

  onTodoDrop(event: CdkDragDrop<Todo[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      const openTodos = this.todoService.openTodos();
      const openOnly = openTodos.filter(t => t.status === 'open');
      const fromId = openOnly[event.previousIndex]?.id;
      const toId = openOnly[event.currentIndex]?.id;
      if (!fromId || !toId) return;
      const all = this.todoService.todos();
      const fromReal = all.findIndex(t => t.id === fromId);
      const toReal = all.findIndex(t => t.id === toId);
      if (fromReal !== -1 && toReal !== -1) {
        this.todoService.reorder(fromReal, toReal);
      }
    }
  }

  onIdeaDrop(event: CdkDragDrop<Idea[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      const active = this.ideaService.activeIdeas();
      const fromId = active[event.previousIndex]?.id;
      const toId = active[event.currentIndex]?.id;
      if (!fromId || !toId) return;
      const all = this.ideaService.ideas();
      const fromReal = all.findIndex(i => i.id === fromId);
      const toReal = all.findIndex(i => i.id === toId);
      if (fromReal !== -1 && toReal !== -1) {
        this.ideaService.reorder(fromReal, toReal);
      }
    }
  }
}
```

- [ ] **Step 2: Update `navigator.html`** — add the full new structure

Replace the entire Todos section and add the Ideas section below it. The key changes are:
- The Todos section now shows only `todoService.openTodos()` with a `cdkDropList` wrapping the open items
- Below the open items: collapsed subsections for Erledigt and Nicht verfolgt
- New Ideas section below Todos following the same pattern

Here is the complete new Todos section (replace from `<section aria-labelledby="todos-heading">` to its closing `</section>`):

```html
<section aria-labelledby="todos-heading">
  <button
    type="button"
    class="flex items-center justify-between w-full mb-2 px-1 py-1 rounded-md transition-colors duration-100 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
    [class.bg-stone-100]="todosCollapsed()"
    (click)="toggleTodos()"
    [attr.aria-expanded]="!todosCollapsed()"
    aria-controls="navigator-todos-content"
  >
    <div class="flex items-center gap-2">
      <span id="todos-heading" class="text-xs font-semibold text-stone-500 uppercase tracking-wider">Aufgaben</span>
      @if (todoService.pendingCount() > 0) {
        <span
          class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold"
          [attr.aria-label]="todoService.pendingCount() + ' offene Aufgaben'"
        >{{ todoService.pendingCount() }}</span>
      }
    </div>
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-stone-400 transition-transform duration-100 [@media(prefers-reduced-motion:reduce)]:transition-none" [class.-rotate-90]="todosCollapsed()" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
  </button>
  <div id="navigator-todos-content" [hidden]="todosCollapsed()">
    <app-todo-inline-input (add)="addTodo($event)" class="block mb-2" />

    <ul
      cdkDropList
      [cdkDropListData]="todoService.openTodos()"
      (cdkDropListDropped)="onTodoDrop($event)"
      class="space-y-1.5"
      role="list"
    >
      @for (todo of todoService.openTodos(); track todo.id) {
        <li cdkDrag [cdkDragData]="todo">
          <app-todo-card
            [todo]="todo"
            [selected]="isSelected(todo)"
            (select)="selectItem($event)"
          />
        </li>
      }
    </ul>

    @if (todoService.doneTodos().length > 0) {
      <div class="mt-3">
        <button
          type="button"
          class="flex items-center gap-1.5 w-full px-1 py-1 text-xs text-stone-400 hover:text-stone-600 transition-colors rounded-md hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          (click)="toggleTodosDone()"
          [attr.aria-expanded]="!todosDoneCollapsed()"
          aria-controls="navigator-todos-done-content"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-transform duration-100" [class.-rotate-90]="todosDoneCollapsed()" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          Erledigt ({{ todoService.doneTodos().length }})
        </button>
        <ul id="navigator-todos-done-content" [hidden]="todosDoneCollapsed()" class="space-y-1.5 mt-1" role="list">
          @for (todo of todoService.doneTodos(); track todo.id) {
            <li>
              <app-todo-card [todo]="todo" [selected]="isSelected(todo)" (select)="selectItem($event)" />
            </li>
          }
        </ul>
      </div>
    }

    @if (todoService.wontDoTodos().length > 0) {
      <div class="mt-2">
        <button
          type="button"
          class="flex items-center gap-1.5 w-full px-1 py-1 text-xs text-stone-400 hover:text-stone-600 transition-colors rounded-md hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          (click)="toggleTodosWontDo()"
          [attr.aria-expanded]="!todosWontDoCollapsed()"
          aria-controls="navigator-todos-wontdo-content"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-transform duration-100" [class.-rotate-90]="todosWontDoCollapsed()" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          Nicht verfolgt ({{ todoService.wontDoTodos().length }})
        </button>
        <ul id="navigator-todos-wontdo-content" [hidden]="todosWontDoCollapsed()" class="space-y-1.5 mt-1" role="list">
          @for (todo of todoService.wontDoTodos(); track todo.id) {
            <li>
              <app-todo-card [todo]="todo" [selected]="isSelected(todo)" (select)="selectItem($event)" />
            </li>
          }
        </ul>
      </div>
    }
  </div>
</section>
```

And add the Ideas section after the Todos section:

```html
<section aria-labelledby="ideas-heading">
  <button
    type="button"
    class="flex items-center justify-between w-full mb-2 px-1 py-1 rounded-md transition-colors duration-100 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
    [class.bg-stone-100]="ideasCollapsed()"
    (click)="toggleIdeas()"
    [attr.aria-expanded]="!ideasCollapsed()"
    aria-controls="navigator-ideas-content"
  >
    <div class="flex items-center gap-2">
      <span id="ideas-heading" class="text-xs font-semibold text-stone-500 uppercase tracking-wider">Ideen</span>
      @if (ideaService.activeIdeas().length > 0) {
        <span
          class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold"
          [attr.aria-label]="ideaService.activeIdeas().length + ' aktive Ideen'"
        >{{ ideaService.activeIdeas().length }}</span>
      }
    </div>
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-stone-400 transition-transform duration-100 [@media(prefers-reduced-motion:reduce)]:transition-none" [class.-rotate-90]="ideasCollapsed()" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
  </button>
  <div id="navigator-ideas-content" [hidden]="ideasCollapsed()">
    <ul
      cdkDropList
      [cdkDropListData]="ideaService.activeIdeas()"
      (cdkDropListDropped)="onIdeaDrop($event)"
      class="space-y-1.5"
      role="list"
    >
      @for (idea of ideaService.activeIdeas(); track idea.id) {
        <li cdkDrag [cdkDragData]="idea">
          <app-idea-card [idea]="idea" [selected]="isSelected(idea)" (select)="selectItem($event)" />
        </li>
      }
    </ul>

    @if (ideaService.wontDoIdeas().length > 0) {
      <div class="mt-2">
        <button
          type="button"
          class="flex items-center gap-1.5 w-full px-1 py-1 text-xs text-stone-400 hover:text-stone-600 transition-colors rounded-md hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          (click)="toggleIdeasWontDo()"
          [attr.aria-expanded]="!ideasWontDoCollapsed()"
          aria-controls="navigator-ideas-wontdo-content"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-transform duration-100" [class.-rotate-90]="ideasWontDoCollapsed()" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          Nicht verfolgt ({{ ideaService.wontDoIdeas().length }})
        </button>
        <ul id="navigator-ideas-wontdo-content" [hidden]="ideasWontDoCollapsed()" class="space-y-1.5 mt-1" role="list">
          @for (idea of ideaService.wontDoIdeas(); track idea.id) {
            <li>
              <app-idea-card [idea]="idea" [selected]="isSelected(idea)" (select)="selectItem($event)" />
            </li>
          }
        </ul>
      </div>
    }
  </div>
</section>
```

- [ ] **Step 3: Run tests**

```bash
ng test --no-watch 2>&1 | tail -20
```

- [ ] **Step 4: Serve and manually test drag-to-reorder**

```bash
ng serve
```

Open the app, create a few todos, try dragging them to reorder. The order should persist after page reload.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/navigator/
git commit -m "feat(navigator): add Ideen section, CDK drag-to-reorder, extend CollapsedState to 7 keys"
```

---

## Chunk 6: QuickCapture toggle + final wiring

### Task 14: Update `QuickCaptureComponent` with Aufgabe/Idee toggle

**Files:**
- Modify: `src/app/components/quick-capture/quick-capture.ts`

The modal gets a toggle below the input. Defaults to Aufgabe. Switching changes the placeholder. Enter saves to the right service.

- [ ] **Step 1: Rewrite `QuickCaptureComponent`**

```ts
// src/app/components/quick-capture/quick-capture.ts
import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { TodoService } from '../../services/todo.service';
import { IdeaService } from '../../services/idea.service';

type CaptureMode = 'todo' | 'idea';

@Component({
  selector: 'app-quick-capture',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 bg-black/20 backdrop-blur-[1px]"
        aria-hidden="true"
        (click)="close.emit()"
      ></div>
      <div
        #card
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="mode() === 'todo' ? 'Aufgabe schnell erfassen' : 'Idee schnell erfassen'"
        class="fixed inset-0 pointer-events-none"
      >
        <div
          class="bg-white rounded-xl shadow-lg border border-stone-200 w-full max-w-md mx-auto mt-[20vh] p-4 pointer-events-auto"
          (keydown)="onKeydown($event)"
        >
          <input
            #inputEl
            type="text"
            [placeholder]="mode() === 'todo' ? 'Neue Aufgabe…' : 'Neue Idee…'"
            [attr.aria-label]="mode() === 'todo' ? 'Aufgabe eingeben' : 'Idee eingeben'"
            class="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div class="flex gap-2 mt-3" role="group" aria-label="Art der Erfassung">
            <button
              type="button"
              class="flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              [class]="mode() === 'todo' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300'"
              (click)="mode.set('todo')"
              [attr.aria-pressed]="mode() === 'todo'"
            >
              Aufgabe
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              [class]="mode() === 'idea' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300'"
              (click)="mode.set('idea')"
              [attr.aria-pressed]="mode() === 'idea'"
            >
              💡 Idee
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class QuickCaptureComponent {
  open = input.required<boolean>();
  close = output<void>();

  private readonly todoService = inject(TodoService);
  private readonly ideaService = inject(IdeaService);
  private inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  mode = signal<CaptureMode>('todo');

  constructor() {
    effect(() => {
      if (this.open()) {
        this.mode.set('todo');
        setTimeout(() => this.inputEl()?.nativeElement.focus(), 0);
      }
    });
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Tab') {
      e.preventDefault();
      this.mode.update(m => m === 'todo' ? 'idea' : 'todo');
      return;
    }
    if (e.key === 'Enter') {
      const value = this.inputEl()?.nativeElement.value.trim() ?? '';
      if (value) {
        if (this.mode() === 'todo') {
          this.todoService.add(value);
        } else {
          this.ideaService.add(value);
        }
      }
      this.close.emit();
    } else if (e.key === 'Escape') {
      this.close.emit();
    }
  }
}
```

- [ ] **Step 2: Remove `WorkDataService` import from `quick-capture.ts`** (it no longer uses it — done in the rewrite above)

- [ ] **Step 3: Run all tests**

```bash
ng test --no-watch 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/quick-capture/quick-capture.ts
git commit -m "feat(quick-capture): add Aufgabe/Idee toggle, Tab to switch, inject TodoService/IdeaService"
```

---

### Task 15: Remove `TodoInlineInputComponent` from the navigator (final cleanup)

The `TodoInlineInputComponent` is still used inside the navigator's Aufgaben section in the template above (Task 13). It calls `addTodo()` on the navigator which delegates to `TodoService.add()`. This is intentionally kept — the inline input inside the navigator section remains. No cleanup needed here unless you find it no longer imported.

- [ ] **Step 1: Run the full test suite one final time**

```bash
ng test --no-watch
```

Expected: all tests pass with no failures.

- [ ] **Step 2: Run the app and do an end-to-end manual check**

```bash
ng serve
```

Verify:
- [ ] Quick capture (Cmd+K) shows Aufgabe/Idee toggle; Tab switches between them
- [ ] Adding a todo saves to `~/.orbit/todos.json` and appears in the navigator
- [ ] Adding an idea saves to `~/.orbit/ideas.json` and appears in the Ideen section
- [ ] Selecting a todo shows inline-editable detail panel and action rail buttons
- [ ] Completing a todo via checkbox triggers the bounce animation
- [ ] Completing a todo via "Erledigt" in the action rail works
- [ ] Today's completed todos stay in the list; status shows as done with strikethrough
- [ ] "Dringend" toggle adds amber stripe to the card
- [ ] "Zur Idee machen" moves the todo to ideas and updates the detail panel
- [ ] "Zur Aufgabe machen" moves an idea to todos
- [ ] Drag-to-reorder works within open todos and within active ideas
- [ ] Order persists after page reload
- [ ] Selecting a Jira ticket shows "In Jira öffnen" in the action rail
- [ ] Selecting a PR shows "In Bitbucket öffnen" in the action rail

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: final wiring — complete todo & idea system implementation"
```
