import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Todo } from '../shared/work-item.model';
import { environment } from '../../environments/environment';
import { DailyReflectionService } from '../reflection/daily-reflection.service';

@Injectable({ providedIn: 'root' })
export class TodoService {
  private readonly http = inject(HttpClient);
  private readonly dailyReflection = inject(DailyReflectionService);
  private readonly baseUrl = `${environment.proxyUrl}/api/todos`;
  private readonly today = signal(new Date().toDateString());

  readonly todos = signal<Todo[]>([]);
  readonly todosLoading = signal(true);
  readonly todosError = signal(false);
  readonly lastCompletedId = signal<string | null>(null);
  private completedTimer: ReturnType<typeof setTimeout> | null = null;

  readonly openTodos = computed(() => {
    const todayStr = this.today();
    const isOpenItem = (t: Todo) => t.status === 'open';
    const isDoneToday = (t: Todo) =>
      t.status === 'done' &&
      t.completedAt !== null &&
      new Date(t.completedAt).toDateString() === todayStr;

    return this.todos()
      .filter((t) => isOpenItem(t) || isDoneToday(t))
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
    const todayStr = this.today();
    return this.todos().filter(
      (t) =>
        t.status === 'done' &&
        t.completedAt !== null &&
        new Date(t.completedAt).toDateString() !== todayStr,
    );
  });

  readonly wontDoTodos = computed(() => this.todos().filter((t) => t.status === 'wont-do'));

  readonly pendingCount = computed(() => this.openTodos().length);

  constructor() {
    this.load();
    this.scheduleMidnightUpdate();
  }

  private scheduleMidnightUpdate(): void {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = midnight.getTime() - now.getTime();
    setTimeout(() => {
      this.today.set(new Date().toDateString());
      setInterval(() => this.today.set(new Date().toDateString()), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  load(): void {
    this.http.get<Todo[]>(this.baseUrl).subscribe({
      next: (todos) => {
        this.todos.set(todos);
        this.todosLoading.set(false);
      },
      error: (err) => {
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
    this.todos.update((todos) => [todo, ...todos]);
    this.save();
    return todo;
  }

  update(todo: Todo): void {
    if (todo.status === 'done' && !todo.completedAt) {
      todo = { ...todo, completedAt: new Date().toISOString() };
      if (this.completedTimer !== null) clearTimeout(this.completedTimer);
      this.lastCompletedId.set(todo.id);
      this.completedTimer = setTimeout(() => this.lastCompletedId.set(null), 1500);
      this.dailyReflection.recordCompletion({
        type: 'todo',
        id: todo.id,
        title: todo.title,
        completedAt: todo.completedAt!,
      });
    }
    this.todos.update((todos) => todos.map((t) => (t.id === todo.id ? todo : t)));
    this.save();
  }

  reorder(fromIndex: number, toIndex: number): void {
    this.todos.update((todos) => {
      const arr = [...todos];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      return arr;
    });
    this.save();
  }

  remove(id: string): void {
    this.todos.update((todos) => todos.filter((t) => t.id !== id));
    this.save();
  }

  private save(): void {
    this.http.post<Todo[]>(this.baseUrl, this.todos()).subscribe({
      error: (err) => console.error('Failed to save todos:', err),
    });
  }
}
