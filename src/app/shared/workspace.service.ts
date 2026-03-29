import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { Idea, JiraTicket, Todo, WorkItem } from './work-item.model';
import { JiraService } from '../jira/jira.service';
import { BitbucketService } from '../bitbucket/bitbucket.service';
import { TodoService } from '../todos/todo.service';
import { IdeaService } from '../ideas/idea.service';
import { TicketSubtaskService } from '../jira/ticket-subtask.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly jira = inject(JiraService);
  private readonly bitbucket = inject(BitbucketService);
  private readonly todoService = inject(TodoService);
  private readonly ideaService = inject(IdeaService);
  private readonly ticketSubtasks = inject(TicketSubtaskService);

  readonly ticketsLoading = signal(true);
  readonly ticketsError = signal(false);

  private readonly tickets$ = this.jira.getAssignedActiveTickets().pipe(
    tap(() => this.ticketsLoading.set(false)),
    catchError((err) => {
      console.error('Failed to load Jira tickets:', err);
      this.ticketsError.set(true);
      this.ticketsLoading.set(false);
      return of([] as JiraTicket[]);
    }),
  );

  readonly tickets = toSignal(this.tickets$, { initialValue: [] as JiraTicket[] });

  readonly pullRequests = this.bitbucket.pullRequests;
  readonly reviewPullRequests = this.bitbucket.reviewPullRequests;
  readonly myPullRequests = this.bitbucket.myPullRequests;
  readonly pullRequestsLoading = this.bitbucket.loading;
  readonly pullRequestsError = this.bitbucket.error;
  readonly awaitingReviewCount = this.bitbucket.awaitingReviewCount;

  readonly selectedItem = signal<WorkItem | null>(null);
  readonly reflectionSelected = signal(false);

  constructor() {
    this.bitbucket.loadAll();

    effect(() => {
      const keys = this.tickets().map((t) => t.key);
      if (keys.length > 0) {
        untracked(() => this.ticketSubtasks.preloadKeys(keys));
      }
    });
  }

  select(item: WorkItem): void {
    this.reflectionSelected.set(false);
    this.selectedItem.set(item);
  }

  selectReflection(): void {
    this.selectedItem.set(null);
    this.reflectionSelected.set(true);
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
