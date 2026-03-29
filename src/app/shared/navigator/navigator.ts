import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { WorkspaceService } from '../workspace.service';
import { TodoService } from '../../todos/todo.service';
import { IdeaService } from '../../ideas/idea.service';
import { FocusService } from '../focus.service';
import { Idea, Todo, WorkItem } from '../work-item.model';
import { TicketCardComponent } from '../../jira/ticket-card/ticket-card';
import { PrCardComponent } from '../../bitbucket/pr-card/pr-card';
import { TodoCardComponent } from '../../todos/todo-card/todo-card';
import { IdeaCardComponent } from '../../ideas/idea-card/idea-card';
import { TodoInlineInputComponent } from '../../todos/todo-inline-input/todo-inline-input';
import { ReflectionCardComponent } from '../../reflection/reflection-card/reflection-card';
import { BadgeComponent } from '../badge/badge';

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
  imports: [
    TicketCardComponent,
    PrCardComponent,
    TodoCardComponent,
    IdeaCardComponent,
    TodoInlineInputComponent,
    ReflectionCardComponent,
    CdkDrag,
    CdkDropList,
    BadgeComponent,
  ],
  templateUrl: './navigator.html',
  host: { class: 'flex flex-col h-full' },
})
export class NavigatorComponent {
  protected readonly data = inject(WorkspaceService);
  protected readonly todoService = inject(TodoService);
  protected readonly ideaService = inject(IdeaService);
  protected readonly focusService = inject(FocusService);

  readonly filteredTickets = computed(() =>
    this.data.tickets().filter((t) => !this.focusService.isFocused(t.id)),
  );
  readonly filteredReviewPrs = computed(() =>
    this.data.reviewPullRequests().filter((p) => !this.focusService.isFocused(p.id)),
  );
  readonly filteredMyPrs = computed(() =>
    this.data.myPullRequests().filter((p) => !this.focusService.isFocused(p.id)),
  );
  readonly filteredOpenTodos = computed(() =>
    this.todoService.openTodos().filter((t) => !this.focusService.isFocused(t.id)),
  );
  readonly filteredActiveIdeas = computed(() =>
    this.ideaService.activeIdeas().filter((i) => !this.focusService.isFocused(i.id)),
  );

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
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          tickets: this.ticketsCollapsed(),
          prs: this.prsCollapsed(),
          todos: this.todosCollapsed(),
          todosDone: this.todosDoneCollapsed(),
          todosWontDo: this.todosWontDoCollapsed(),
          ideas: this.ideasCollapsed(),
          ideasWontDo: this.ideasWontDoCollapsed(),
        }),
      );
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
    return {
      tickets: false,
      prs: false,
      todos: false,
      todosDone: false,
      todosWontDo: false,
      ideas: false,
      ideasWontDo: false,
    };
  }

  toggleTickets(): void {
    this.ticketsCollapsed.update((v) => !v);
  }
  togglePrs(): void {
    this.prsCollapsed.update((v) => !v);
  }
  toggleTodos(): void {
    this.todosCollapsed.update((v) => !v);
  }
  toggleTodosDone(): void {
    this.todosDoneCollapsed.update((v) => !v);
  }
  toggleTodosWontDo(): void {
    this.todosWontDoCollapsed.update((v) => !v);
  }
  toggleIdeas(): void {
    this.ideasCollapsed.update((v) => !v);
  }
  toggleIdeasWontDo(): void {
    this.ideasWontDoCollapsed.update((v) => !v);
  }

  readonly isReflectionSelected = computed(() => this.data.reflectionSelected());

  isSelected(item: WorkItem): boolean {
    return this.data.selectedItem()?.id === item.id;
  }

  selectItem(item: WorkItem): void {
    this.data.select(item);
  }

  selectReflection(): void {
    this.data.selectReflection();
  }

  addTodo(title: string): void {
    this.todoService.add(title);
  }

  onTodoDrop(event: CdkDragDrop<Todo[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      const openOnly = this.todoService.openTodos();
      const fromId = openOnly[event.previousIndex]?.id;
      const toId = openOnly[event.currentIndex]?.id;
      if (!fromId || !toId) return;
      const all = this.todoService.todos();
      const fromReal = all.findIndex((t) => t.id === fromId);
      const toReal = all.findIndex((t) => t.id === toId);
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
      const fromReal = all.findIndex((i) => i.id === fromId);
      const toReal = all.findIndex((i) => i.id === toId);
      if (fromReal !== -1 && toReal !== -1) {
        this.ideaService.reorder(fromReal, toReal);
      }
    }
  }
}
