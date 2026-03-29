import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { FocusTarget, WorkItem } from './work-item.model';
import { WorkspaceService } from './workspace.service';
import { TodoService } from '../todos/todo.service';
import { IdeaService } from '../ideas/idea.service';

const STORAGE_KEY = 'orbit.focus.state';

@Injectable({ providedIn: 'root' })
export class FocusService {
  private readonly data = inject(WorkspaceService);
  private readonly todoService = inject(TodoService);
  private readonly ideaService = inject(IdeaService);

  readonly focusTarget = signal<FocusTarget | null>(this.loadFromStorage());

  readonly focusedItem = computed<WorkItem | null>(() => {
    const target = this.focusTarget();
    if (!target) return null;
    return this.resolve(target);
  });

  constructor() {
    effect(() => {
      const item = this.focusedItem();
      const target = this.focusTarget();
      if (target && !item) {
        this.focusTarget.set(null);
      }
    });

    effect(() => {
      const target = this.focusTarget();
      if (target) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(target));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    });
  }

  setFocus(target: FocusTarget): void {
    this.focusTarget.set(target);
  }

  clearFocus(): void {
    this.focusTarget.set(null);
  }

  isFocused(id: string): boolean {
    return this.focusTarget()?.id === id;
  }

  private resolve(target: FocusTarget): WorkItem | null {
    switch (target.type) {
      case 'ticket':
        return this.data.tickets().find((t) => t.id === target.id) ?? null;
      case 'pr':
        return this.data.pullRequests().find((p) => p.id === target.id) ?? null;
      case 'todo':
        return this.todoService.todos().find((t) => t.id === target.id) ?? null;
      case 'idea':
        return this.ideaService.ideas().find((i) => i.id === target.id) ?? null;
    }
  }

  private loadFromStorage(): FocusTarget | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }
}
