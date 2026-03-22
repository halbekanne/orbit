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
    const sortOrder = (pr: PullRequest): number => {
      if (pr.myReviewStatus === 'Awaiting Review') return 0;
      if (pr.myReviewStatus === 'Needs Re-review') return 1;
      if (pr.myReviewStatus === 'Ready to Merge') return 2;
      if (pr.myReviewStatus === 'Changes Requested' && pr.isAuthoredByMe) return 3;
      if (pr.myReviewStatus === 'Changes Requested') return 4;
      if (pr.myReviewStatus === 'In Review') return 5;
      if (pr.myReviewStatus === 'Approved by Others') return 6;
      if (pr.myReviewStatus === 'Approved') return 7;
      return 8;
    };
    return this._rawPullRequests()
      .filter(pr => !(pr.myReviewStatus === 'Approved' && !pr.isAuthoredByMe))
      .sort((a, b) => sortOrder(a) - sortOrder(b));
  });

  readonly awaitingReviewCount = computed(() =>
    this.pullRequests().filter(
      pr => pr.myReviewStatus === 'Awaiting Review' || pr.myReviewStatus === 'Needs Re-review'
    ).length
  );

  readonly selectedItem = signal<WorkItem | null>(null);
  readonly rhythmSelected = signal(false);

  constructor() {
    effect(() => {
      const keys = this.tickets().map(t => t.key);
      if (keys.length > 0) {
        untracked(() => this.ticketLocalData.preloadKeys(keys));
      }
    });

    effect(() => {
      untracked(() => {
        forkJoin([
          this.bitbucket.getReviewerPullRequests(),
          this.bitbucket.getAuthoredPullRequests().pipe(catchError(() => of([] as PullRequest[]))),
        ]).pipe(
          tap(([reviewerPrs, authoredPrs]) => {
            this.pullRequestsLoading.set(false);
            const reviewerIds = new Set(reviewerPrs.map(pr => pr.id));
            const dedupedAuthored = authoredPrs.filter(pr => !reviewerIds.has(pr.id));
            this._rawPullRequests.set([...reviewerPrs, ...dedupedAuthored]);
          }),
          switchMap(([reviewerPrs, authoredPrs]) => {
            const enrichments = [];

            const needsWorkPrs = reviewerPrs.filter(pr => pr.myReviewStatus === 'Changes Requested');
            if (needsWorkPrs.length > 0) {
              enrichments.push(
                forkJoin(
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
                )
              );
            }

            const reviewerIds = new Set(reviewerPrs.map(pr => pr.id));
            const dedupedAuthored = authoredPrs.filter(pr => !reviewerIds.has(pr.id));
            if (dedupedAuthored.length > 0) {
              enrichments.push(
                forkJoin(
                  dedupedAuthored.map(pr =>
                    this.bitbucket.getBuildStatusStats(pr.fromRef.latestCommit).pipe(
                      catchError(() => of({ successful: 0, failed: 0, inProgress: 0 }))
                    )
                  )
                ).pipe(
                  tap(results => {
                    const buildById = new Map(dedupedAuthored.map((pr, i) => [pr.id, results[i]]));
                    this._rawPullRequests.update(all =>
                      all.map(pr => {
                        const build = buildById.get(pr.id);
                        return build ? { ...pr, buildStatus: build } : pr;
                      })
                    );
                  })
                )
              );
            }

            return enrichments.length > 0 ? forkJoin(enrichments) : of(null);
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
    this.rhythmSelected.set(false);
    this.selectedItem.set(item);
  }

  selectRhythm(): void {
    this.selectedItem.set(null);
    this.rhythmSelected.set(true);
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
