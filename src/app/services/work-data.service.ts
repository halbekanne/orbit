import { Injectable, signal, computed, inject, effect, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { JiraTicket, PrStatus, PullRequest, Todo, WorkItem } from '../models/work-item.model';
import { JiraService } from './jira.service';
import { BitbucketService } from './bitbucket.service';

@Injectable({ providedIn: 'root' })
export class WorkDataService {
  private readonly jira = inject(JiraService);
  private readonly bitbucket = inject(BitbucketService);

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

  constructor() {
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

  readonly todos = signal<Todo[]>([
    {
      type: 'todo',
      id: 'td1',
      title: 'Standup-Notizen vorbereiten',
      description: 'Kurze Zusammenfassung der gestrigen Arbeit und heutige Ziele für das Team-Standup um 09:30 Uhr.',
      done: false,
      createdAt: '2026-03-13T07:00:00',
    },
    {
      type: 'todo',
      id: 'td2',
      title: 'PR-Review Block im Kalender eintragen',
      description: 'Täglich 14:00-15:00 Uhr als festen Block für Code Reviews reservieren.',
      done: false,
      createdAt: '2026-03-12T16:00:00',
    },
    {
      type: 'todo',
      id: 'td3',
      title: 'API-Spec mit Thomas abstimmen',
      description: 'Offene Fragen zur Schadensmeldungs-API klären: Fehler-Codes, Rate-Limiting, Auth-Header Format.',
      done: false,
      createdAt: '2026-03-12T10:00:00',
    },
    {
      type: 'todo',
      id: 'td4',
      title: 'Code-Review Checkliste aktualisieren',
      description: 'Checkliste um Punkte für Accessibility und Performance-Budget erweitern.',
      done: true,
      createdAt: '2026-03-11T09:00:00',
    },
  ]);

  readonly selectedItem = signal<WorkItem | null>(null);
  readonly lastAddedId = signal<string | null>(null);
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;

  readonly pendingTodoCount = computed(() => this.todos().filter(t => !t.done).length);
  readonly awaitingReviewCount = computed(() =>
    this.pullRequests().filter(
      pr => pr.myReviewStatus === 'Awaiting Review' || pr.myReviewStatus === 'Needs Re-review'
    ).length
  );

  select(item: WorkItem): void {
    this.selectedItem.set(item);
  }

  addTodo(title: string, description?: string): void {
    const todo: Todo = {
      type: 'todo',
      id: `td-${Date.now()}`,
      title,
      description: description ?? '',
      done: false,
      createdAt: new Date().toISOString(),
    };
    this.todos.update(todos => [todo, ...todos]);
    if (this.highlightTimer !== null) clearTimeout(this.highlightTimer);
    this.lastAddedId.set(todo.id);
    this.highlightTimer = setTimeout(() => this.lastAddedId.set(null), 500);
  }

  toggleTodo(id: string): void {
    this.todos.update(todos =>
      todos.map(t => t.id === id ? { ...t, done: !t.done } : t)
    );
    const updated = this.todos().find(t => t.id === id);
    if (updated && this.selectedItem()?.id === id) {
      this.selectedItem.set(updated);
    }
  }
}
