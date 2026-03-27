import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WorkspaceService } from '../../services/workspace.service';
import { TodoService } from '../../services/todo.service';
import { IdeaService } from '../../services/idea.service';
import { CosiReviewService } from '../../services/cosi-review.service';
import { FocusService } from '../../services/focus.service';
import { Todo, Idea, JiraTicket, PullRequest, WorkItem } from '../../models/work-item.model';

@Component({
  selector: 'app-action-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col p-3 gap-2' },
  template: `
    @let item = data.selectedItem();

    @if (item) {
      <button type="button"
        class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center"
        [class]="focusService.isFocused(item.id) ? 'bg-[var(--color-primary-bg)] border-[var(--color-primary-border)] text-[var(--color-primary-text)] hover:bg-[var(--color-primary-bg-hover)]' : 'bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-body)] hover:border-[var(--color-border-default)]'"
        (click)="toggleFocus(item)">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
        {{ focusService.isFocused(item.id) ? 'Fokus entfernen' : 'Fokus setzen' }}
      </button>
    }

    @if (item?.type === 'todo') {
      @let todo = asTodo(item);
      @if (todo.status === 'open') {
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success-text)] hover:opacity-80"
          (click)="completeTodo(todo)">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
          Erledigt
        </button>
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center"
          [class]="todo.urgent ? 'bg-amber-50 border-amber-300 text-amber-800 hover:opacity-80 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-500' : 'bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-body)] hover:border-[var(--color-border-default)]'"
          (click)="toggleUrgent(todo)"
          [attr.aria-pressed]="todo.urgent">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
          Dringend
        </button>
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-body)] hover:border-[var(--color-border-default)]"
          (click)="data.demoteToIdea(todo)">
          Zur Idee machen
        </button>
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-border-default)]"
          (click)="wontDo(todo)">
          Nicht erledigen
        </button>
      }
      @if (todo.status === 'done') {
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-body)] hover:border-[var(--color-border-default)]"
          (click)="reopenTodo(todo)">
          Wieder öffnen
        </button>
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-body)] hover:border-[var(--color-border-default)]"
          (click)="data.demoteToIdea(todo)">
          Zur Idee machen
        </button>
      }
      @if (todo.status === 'wont-do') {
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-body)] hover:border-[var(--color-border-default)]"
          (click)="reopenTodo(todo)">
          Wieder öffnen
        </button>
      }
    }

    @if (item?.type === 'idea') {
      @let idea = asIdea(item);
      @if (idea.status === 'active') {
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-[var(--color-primary-bg)] border-[var(--color-primary-border)] text-[var(--color-primary-text)] hover:bg-[var(--color-primary-bg-hover)]"
          (click)="data.promoteToTodo(idea)">
          Zur Aufgabe machen
        </button>
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-border-default)]"
          (click)="wontFollowIdea(idea)">
          Nicht verfolgen
        </button>
      }
      @if (idea.status === 'wont-do') {
        <button type="button"
          class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-body)] hover:border-[var(--color-border-default)]"
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
        class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center no-underline bg-[var(--color-primary-bg)] border-[var(--color-primary-border)] text-[var(--color-primary-text)] hover:bg-[var(--color-primary-bg-hover)]"
      >
        In Jira öffnen ↗
      </a>
    }

    @if (item?.type === 'pr') {
      @let pr = asPr(item);
      @let review = cosiReview.reviewState();
      <button type="button"
        class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center"
        [class]="review === 'idle' ? 'bg-[var(--color-primary-bg)] border-[var(--color-primary-border)] text-[var(--color-primary-text)] hover:bg-[var(--color-primary-bg-hover)]' : 'bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-body)] hover:border-[var(--color-border-default)]'"
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
        class="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors cursor-pointer w-full text-center no-underline bg-[var(--color-primary-bg)] border-[var(--color-primary-border)] text-[var(--color-primary-text)] hover:bg-[var(--color-primary-bg-hover)]"
      >
        In Bitbucket öffnen ↗
      </a>
    }
  `,
})
export class ActionRailComponent {
  protected readonly data = inject(WorkspaceService);
  protected readonly focusService = inject(FocusService);
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

  toggleFocus(item: WorkItem): void {
    if (this.focusService.isFocused(item.id)) {
      this.focusService.clearFocus();
    } else {
      this.focusService.setFocus({ id: item.id, type: item.type });
    }
  }
}
