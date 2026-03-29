import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { WorkspaceService } from './workspace.service';
import { JiraTicket, PullRequest, WorkItem } from './work-item.model';

interface PendingRoute {
  type: 'ticket' | 'pr' | 'todo' | 'idea' | 'reflektion';
  key?: string;
  project?: string;
  repo?: string;
  prNumber?: number;
  id?: string;
}

@Injectable({ providedIn: 'root' })
export class RouterSyncService {
  private readonly router = inject(Router);
  private readonly workspace = inject(WorkspaceService);

  private syncing = false;
  private readonly pendingRoute = signal<PendingRoute | null>(null);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly activeView = computed<'arbeit' | 'builds' | 'logbuch' | 'einstellungen'>(() => {
    const u = this.url();
    if (u.startsWith('/builds')) return 'builds';
    if (u.startsWith('/logbuch')) return 'logbuch';
    if (u.startsWith('/einstellungen')) return 'einstellungen';
    return 'arbeit';
  });

  constructor() {
    effect(() => {
      const u = this.url();
      untracked(() => this.resolveUrl(u));
    });

    effect(() => {
      const tickets = this.workspace.tickets();
      const prs = this.workspace.pullRequests();
      const pending = this.pendingRoute();
      if (!pending) return;
      untracked(() => this.resolvePending(pending, tickets, prs));
    });

    effect(() => {
      const item = this.workspace.selectedItem();
      const reflection = this.workspace.reflectionSelected();
      if (this.syncing) return;
      untracked(() => {
        if (reflection) {
          this.updateUrlForPath('/arbeit/reflektion');
        } else if (item) {
          this.updateUrlForItem(item);
        }
      });
    });
  }

  navigateToItem(item: WorkItem): void {
    const segments = this.itemToSegments(item);
    this.router.navigate(segments);
  }

  navigateToReflection(): void {
    this.router.navigate(['/arbeit', 'reflektion']);
  }

  clearSelection(): void {
    this.router.navigate(['/arbeit']);
  }

  navigateToView(view: string): void {
    this.router.navigate(['/', view]);
  }

  private resolveUrl(url: string): void {
    if (!url.startsWith('/arbeit')) return;

    const segments = url.split('/').filter(Boolean);

    if (segments.length === 1) {
      this.syncSelect(null, false);
      return;
    }

    const type = segments[1];

    if (type === 'reflektion') {
      this.syncSelectReflection();
      return;
    }

    if (type === 'ticket' && segments[2]) {
      const key = decodeURIComponent(segments[2]);
      const ticket = this.workspace.findTicketByKey(key);
      if (ticket) {
        this.syncSelect(ticket, false);
      } else {
        this.pendingRoute.set({ type: 'ticket', key });
      }
      return;
    }

    if (type === 'pr' && segments.length >= 5) {
      const project = decodeURIComponent(segments[2]);
      const repo = decodeURIComponent(segments[3]);
      const prNumber = parseInt(segments[4], 10);
      const pr = this.workspace.findPrByRoute(project, repo, prNumber);
      if (pr) {
        this.syncSelect(pr, false);
      } else {
        this.pendingRoute.set({ type: 'pr', project, repo, prNumber });
      }
      return;
    }

    if (type === 'todo' && segments[2]) {
      const id = decodeURIComponent(segments[2]);
      const todo = this.workspace.findTodoById(id);
      if (todo) {
        this.syncSelect(todo, false);
      } else {
        this.pendingRoute.set({ type: 'todo', id });
      }
      return;
    }

    if (type === 'idea' && segments[2]) {
      const id = decodeURIComponent(segments[2]);
      const idea = this.workspace.findIdeaById(id);
      if (idea) {
        this.syncSelect(idea, false);
      } else {
        this.pendingRoute.set({ type: 'idea', id });
      }
      return;
    }
  }

  private resolvePending(
    pending: PendingRoute,
    tickets: JiraTicket[],
    prs: PullRequest[],
  ): void {
    let resolved: WorkItem | undefined;

    switch (pending.type) {
      case 'ticket':
        if (this.workspace.ticketsLoading()) return;
        resolved = tickets.find((t) => t.key === pending.key);
        break;
      case 'pr':
        if (this.workspace.pullRequestsLoading()) return;
        resolved = prs.find(
          (p) => p.id === `${pending.project}/${pending.repo}/${pending.prNumber}`,
        );
        break;
      case 'todo':
        resolved = this.workspace.findTodoById(pending.id!);
        break;
      case 'idea':
        resolved = this.workspace.findIdeaById(pending.id!);
        break;
    }

    if (resolved) {
      this.pendingRoute.set(null);
      this.syncSelect(resolved, false);
    } else if (!this.workspace.ticketsLoading() && !this.workspace.pullRequestsLoading()) {
      this.pendingRoute.set(null);
      this.router.navigate(['/arbeit'], { replaceUrl: true });
    }
  }

  private syncSelect(item: WorkItem | null, reflection: boolean): void {
    this.syncing = true;
    if (reflection) {
      this.workspace.selectReflection();
    } else if (item) {
      this.workspace.select(item);
    } else {
      this.workspace.selectedItem.set(null);
      this.workspace.reflectionSelected.set(false);
    }
    this.syncing = false;
  }

  private syncSelectReflection(): void {
    this.syncSelect(null, true);
  }

  private updateUrlForItem(item: WorkItem): void {
    const segments = this.itemToSegments(item);
    const targetUrl = this.router.createUrlTree(segments).toString();
    if (this.router.url !== targetUrl) {
      this.router.navigate(segments, { replaceUrl: true });
    }
  }

  private updateUrlForPath(path: string): void {
    if (this.router.url !== path) {
      this.router.navigate([path], { replaceUrl: true });
    }
  }

  private itemToSegments(item: WorkItem): string[] {
    switch (item.type) {
      case 'ticket':
        return ['/arbeit', 'ticket', item.key];
      case 'pr':
        return ['/arbeit', 'pr', item.toRef.repository.projectKey, item.toRef.repository.slug, String(item.prNumber)];
      case 'todo':
        return ['/arbeit', 'todo', item.id];
      case 'idea':
        return ['/arbeit', 'idea', item.id];
    }
  }
}
