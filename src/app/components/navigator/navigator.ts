import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { WorkDataService } from '../../services/work-data.service';
import { TodoService } from '../../services/todo.service';
import { WorkItem } from '../../models/work-item.model';
import { TicketCardComponent } from '../ticket-card/ticket-card';
import { PrCardComponent } from '../pr-card/pr-card';
import { TodoCardComponent } from '../todo-card/todo-card';
import { TodoInlineInputComponent } from '../todo-inline-input/todo-inline-input';

const STORAGE_KEY = 'orbit.navigator.collapsed';

interface CollapsedState {
  tickets: boolean;
  prs: boolean;
  todos: boolean;
}

@Component({
  selector: 'app-navigator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TicketCardComponent, PrCardComponent, TodoCardComponent, TodoInlineInputComponent],
  templateUrl: './navigator.html',
  host: { class: 'flex flex-col h-full' },
})
export class NavigatorComponent {
  protected readonly data = inject(WorkDataService);
  protected readonly todoService = inject(TodoService);

  private readonly savedCollapsed = this.loadCollapsed();

  ticketsCollapsed = signal(this.savedCollapsed.tickets);
  prsCollapsed = signal(this.savedCollapsed.prs);
  todosCollapsed = signal(this.savedCollapsed.todos);

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tickets: this.ticketsCollapsed(),
        prs: this.prsCollapsed(),
        todos: this.todosCollapsed(),
      }));
    });
  }

  private loadCollapsed(): CollapsedState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as CollapsedState;
    } catch {}
    return { tickets: false, prs: false, todos: false };
  }

  toggleTickets(): void {
    this.ticketsCollapsed.update(v => !v);
  }

  togglePrs(): void {
    this.prsCollapsed.update(v => !v);
  }

  toggleTodos(): void {
    this.todosCollapsed.update(v => !v);
  }

  isSelected(item: WorkItem): boolean {
    return this.data.selectedItem()?.id === item.id;
  }

  selectItem(item: WorkItem): void {
    this.data.select(item);
  }

  addTodo(title: string): void {
    this.todoService.add(title);
  }
}
