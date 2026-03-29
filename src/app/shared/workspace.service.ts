import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Idea, JiraTicket, PullRequest, Todo, WorkItem } from './work-item.model';
import { JiraService } from '../jira/jira.service';
import { BitbucketService } from '../bitbucket/bitbucket.service';
import { TodoService } from '../todos/todo.service';
import { IdeaService } from '../ideas/idea.service';
import { TicketSubtaskService } from '../jira/ticket-subtask.service';
import { DataRefreshService } from './data-refresh.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly jira = inject(JiraService);
  private readonly bitbucket = inject(BitbucketService);
  private readonly todoService = inject(TodoService);
  private readonly ideaService = inject(IdeaService);
  private readonly ticketSubtasks = inject(TicketSubtaskService);
  private readonly refreshService = inject(DataRefreshService);

  readonly tickets = this.jira.tickets;
  readonly ticketsLoading = this.jira.loading;
  readonly ticketsError = this.jira.error;

  readonly pullRequests = this.bitbucket.pullRequests;
  readonly reviewPullRequests = this.bitbucket.reviewPullRequests;
  readonly myPullRequests = this.bitbucket.myPullRequests;
  readonly pullRequestsLoading = this.bitbucket.loading;
  readonly pullRequestsError = this.bitbucket.error;
  readonly awaitingReviewCount = this.bitbucket.awaitingReviewCount;

  readonly selectedItem = signal<WorkItem | null>(null);
  readonly reflectionSelected = signal(false);

  constructor() {
    this.refreshService.register('jira', () => this.jira.loadTickets());
    this.refreshService.register('bitbucket', () => this.bitbucket.loadAll());
    this.refreshService.refreshAll(true);
    this.refreshService.startPolling();
    this.refreshService.startVisibilityListener();

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

  findTicketByKey(key: string): JiraTicket | undefined {
    return this.tickets().find((t) => t.key === key);
  }

  findPrByRoute(project: string, repo: string, prNumber: number): PullRequest | undefined {
    const id = `${project}/${repo}/${prNumber}`;
    return this.pullRequests().find((p) => p.id === id);
  }

  findTodoById(id: string): Todo | undefined {
    return this.todoService.todos().find((t) => t.id === id);
  }

  findIdeaById(id: string): Idea | undefined {
    return this.ideaService.ideas().find((i) => i.id === id);
  }
}
