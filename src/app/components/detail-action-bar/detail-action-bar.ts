import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WorkspaceService } from '../../services/workspace.service';
import { TodoService } from '../../services/todo.service';
import { IdeaService } from '../../services/idea.service';
import { AiReviewService } from '../../services/ai-review.service';
import { FocusService } from '../../services/focus.service';
import { SettingsService } from '../../services/settings.service';
import { Todo, Idea, JiraTicket, PullRequest, WorkItem } from '../../models/work-item.model';

const BTN = 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-100 cursor-pointer select-none whitespace-nowrap';
const NEUTRAL = `${BTN} bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-body)] hover:border-[var(--color-border-default)] hover:shadow-sm active:scale-[0.97]`;
const PRIMARY = `${BTN} bg-[var(--color-primary-solid)] border-[var(--color-primary-solid)] text-white hover:bg-[var(--color-primary-solid-hover)] hover:shadow-sm active:scale-[0.97]`;
const SUCCESS = `${BTN} bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success-text)] hover:opacity-85 hover:shadow-sm active:scale-[0.97]`;
const WARNING = `${BTN} bg-[var(--color-signal-bg)] border-[var(--color-signal-border)] text-[var(--color-signal-text)] hover:opacity-85 hover:shadow-sm active:scale-[0.97]`;
const DANGER = `${BTN} bg-[var(--color-danger-bg)] border-[var(--color-danger-border)] text-[var(--color-danger-text)] hover:opacity-85 hover:shadow-sm active:scale-[0.97]`;
const LINK = `${BTN} no-underline bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-body)] hover:border-[var(--color-border-default)] hover:shadow-sm active:scale-[0.97]`;
const DIVIDER = 'w-px h-[18px] bg-[var(--color-border-default)] self-center';

@Component({
  selector: 'app-detail-action-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-card)]',
    role: 'toolbar',
    '[attr.aria-label]': '"Aktionen"',
  },
  template: `
    @let it = item();
    <div class="max-w-2xl mx-auto flex items-center gap-1.5 flex-wrap px-6 py-2">

    @switch (it.type) {
      @case ('ticket') {
        @let ticket = asTicket(it);
        <button type="button" [class]="focusClass(it)" (click)="toggleFocus(it)">
          {{ focusService.isFocused(it.id) ? 'Fokus entfernen' : 'Fokus setzen' }}
        </button>
<!--        <div class="${DIVIDER}" aria-hidden="true"></div>-->
        <a [href]="ticket.url" target="_blank" rel="noopener noreferrer" class="${LINK}">
          In Jira öffnen ↗
        </a>
      }

      @case ('pr') {
        @let pr = asPr(it);
        @let review = aiReview.reviewState();
        <button type="button" [class]="focusClass(it)" (click)="toggleFocus(it)">
          {{ focusService.isFocused(it.id) ? 'Fokus entfernen' : 'Fokus setzen' }}
        </button>
        @if (settingsService.aiReviewsEnabled()) {
<!--          <div class="${DIVIDER}" aria-hidden="true"></div>-->
          <button type="button"
            [class]="review === 'idle' ? '${PRIMARY}' : '${NEUTRAL}'"
            [disabled]="(review !== 'idle' && review.status === 'running') || !aiReview.canReview()"
            (click)="aiReview.triggerReview()">
            @if (review !== 'idle' && review.status === 'running') {
              Review läuft...
            } @else if (review === 'idle') {
              KI-Review starten
            } @else {
              Erneut reviewen
            }
          </button>
        }
        <a [href]="pr.url" target="_blank" rel="noopener noreferrer" class="${LINK}">
          In Bitbucket öffnen ↗
        </a>
      }

      @case ('todo') {
        @let todo = asTodo(it);
        @switch (todo.status) {
          @case ('open') {
            <button type="button" [class]="focusClass(it)" (click)="toggleFocus(it)">
              {{ focusService.isFocused(it.id) ? 'Fokus entfernen' : 'Fokus setzen' }}
            </button>
            <button type="button" class="${SUCCESS}" (click)="completeTodo(todo)">
              Erledigt
            </button>
<!--            <div class="${DIVIDER}" aria-hidden="true"></div>-->
            <button type="button"
              [class]="todo.urgent ? '${WARNING}' : '${NEUTRAL}'"
              [attr.aria-pressed]="todo.urgent"
              (click)="toggleUrgent(todo)">
              Dringend
            </button>
            <button type="button" class="${NEUTRAL}" (click)="data.demoteToIdea(todo)">
              Zur Idee machen
            </button>
            <button type="button" class="${DANGER}" (click)="wontDo(todo)">
              Nicht erledigen
            </button>
          }
          @case ('done') {
            <button type="button" class="${NEUTRAL}" (click)="reopenTodo(todo)">
              Wieder öffnen
            </button>
            <button type="button" class="${NEUTRAL}" (click)="data.demoteToIdea(todo)">
              Zur Idee machen
            </button>
          }
          @case ('wont-do') {
            <button type="button" class="${NEUTRAL}" (click)="reopenTodo(todo)">
              Wieder öffnen
            </button>
          }
        }
      }

      @case ('idea') {
        @let idea = asIdea(it);
        @switch (idea.status) {
          @case ('active') {
            <button type="button" [class]="focusClass(it)" (click)="toggleFocus(it)">
              {{ focusService.isFocused(it.id) ? 'Fokus entfernen' : 'Fokus setzen' }}
            </button>
            <button type="button" class="${SUCCESS}" (click)="data.promoteToTodo(idea)">
              Zur Aufgabe machen
            </button>
<!--            <div class="${DIVIDER}" aria-hidden="true"></div>-->
            <button type="button" class="${DANGER}" (click)="wontFollowIdea(idea)">
              Nicht verfolgen
            </button>
          }
          @case ('wont-do') {
            <button type="button" class="${NEUTRAL}" (click)="reviveIdea(idea)">
              Wieder aufgreifen
            </button>
          }
        }
      }
    }
    </div>
  `,
})
export class DetailActionBarComponent {
  readonly item = input.required<WorkItem>();

  protected readonly data = inject(WorkspaceService);
  protected readonly focusService = inject(FocusService);
  protected readonly aiReview = inject(AiReviewService);
  protected readonly settingsService = inject(SettingsService);
  private readonly todoService = inject(TodoService);
  private readonly ideaService = inject(IdeaService);

  protected focusClass(it: WorkItem): string {
    return this.focusService.isFocused(it.id) ? NEUTRAL : PRIMARY;
  }

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
