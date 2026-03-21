import { Injectable, signal, computed, inject, effect, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { Idea, JiraTicket, PrStatus, PullRequest, Todo, WorkItem } from '../models/work-item.model';
import { JiraService } from './jira.service';
import { BitbucketService } from './bitbucket.service';
import { TodoService } from './todo.service';
import { IdeaService } from './idea.service';
import { TicketLocalDataService } from './ticket-local-data.service';

@Injectable({ providedIn: 'root' })
export class WorkDataService {
  private readonly jira = inject(JiraService);
  private readonly bitbucket = inject(BitbucketService);
  private readonly todoService = inject(TodoService);
  private readonly ideaService = inject(IdeaService);
  private readonly ticketLocalData = inject(TicketLocalDataService);

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
      const keys = this.tickets().map(t => t.key);
      if (keys.length > 0) {
        untracked(() => this.ticketLocalData.preloadKeys(keys));
      }
    });

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
