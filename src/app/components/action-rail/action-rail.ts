import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WorkDataService } from '../../services/work-data.service';
import { TodoService } from '../../services/todo.service';
import { IdeaService } from '../../services/idea.service';
import { CosiReviewService } from '../../services/cosi-review.service';
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
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
          (click)="completeTodo(todo)">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
          Erledigt
        </button>
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center"
          [class]="todo.urgent ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100' : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300'"
          (click)="toggleUrgent(todo)"
          [attr.aria-pressed]="todo.urgent">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
          Dringend
        </button>
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300"
          (click)="data.demoteToIdea(todo)">
          Zur Idee machen
        </button>
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-stone-50 border-stone-200 text-stone-400 hover:border-stone-300"
          (click)="wontDo(todo)">
          Nicht erledigen
        </button>
      }
      @if (todo.status === 'done') {
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300"
          (click)="reopenTodo(todo)">
          Wieder öffnen
        </button>
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300"
          (click)="data.demoteToIdea(todo)">
          Zur Idee machen
        </button>
      }
      @if (todo.status === 'wont-do') {
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300"
          (click)="reopenTodo(todo)">
          Wieder öffnen
        </button>
      }
    }

    @if (item?.type === 'idea') {
      @let idea = asIdea(item);
      @if (idea.status === 'active') {
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
          (click)="data.promoteToTodo(idea)">
          Zur Aufgabe machen
        </button>
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-stone-50 border-stone-200 text-stone-400 hover:border-stone-300"
          (click)="wontFollowIdea(idea)">
          Nicht verfolgen
        </button>
      }
      @if (idea.status === 'wont-do') {
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300"
          (click)="reviveIdea(idea)">
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
        class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center no-underline bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
      >
        In Jira öffnen ↗
      </a>
    }

    @if (item?.type === 'pr') {
      @let pr = asPr(item);
      @let review = cosiReview.reviewState();
      <button type="button"
        class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center"
        [class]="review === 'idle' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300'"
        [disabled]="(review !== 'idle' && review.status === 'running') || !cosiReview.canReview()"
        (click)="cosiReview.triggerReview()">
        @if (review !== 'idle' && review.status === 'running') {
          Review läuft...
        } @else if (review === 'idle') {
          KI-Review starten
        } @else {
          Erneut reviewen
        }
      </button>
      <a
        [href]="pr.url"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center no-underline bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
      >
        In Bitbucket öffnen ↗
      </a>
    }
  `,
})
export class ActionRailComponent {
  protected readonly data = inject(WorkDataService);
  protected readonly cosiReview = inject(CosiReviewService);
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
