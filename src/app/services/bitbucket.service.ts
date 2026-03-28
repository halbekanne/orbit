import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import {
  PullRequest,
  PrStatus,
  PrUser,
  PrRepository,
  PrRef,
  PrParticipant,
  BuildStatusSummary,
} from '../models/work-item.model';
import { environment } from '../../environments/environment';

interface BitbucketLinkRaw {
  href: string;
}

interface BitbucketUserRaw {
  id: number;
  name: string;
  slug: string;
  displayName: string;
  emailAddress: string;
  active: boolean;
  type: string;
  links?: { self: BitbucketLinkRaw[] };
}

interface BitbucketProjectRaw {
  key: string;
  id: number;
  name: string;
}

interface BitbucketRepositoryRaw {
  id: number;
  slug: string;
  name: string;
  project: BitbucketProjectRaw;
  links?: { self: BitbucketLinkRaw[] };
}

interface BitbucketRefRaw {
  id: string;
  displayId: string;
  latestCommit: string;
  repository: BitbucketRepositoryRaw;
}

interface BitbucketParticipantRaw {
  user: BitbucketUserRaw;
  role: 'AUTHOR' | 'REVIEWER' | 'PARTICIPANT';
  approved: boolean;
  status: 'APPROVED' | 'UNAPPROVED' | 'NEEDS_WORK';
}

interface BitbucketPrRaw {
  id: number;
  title: string;
  description: string;
  state: string;
  open: boolean;
  closed: boolean;
  locked: boolean;
  draft?: boolean;
  createdDate: number;
  updatedDate: number;
  fromRef: BitbucketRefRaw;
  toRef: BitbucketRefRaw;
  author: BitbucketParticipantRaw;
  reviewers: BitbucketParticipantRaw[];
  participants: BitbucketParticipantRaw[];
  properties: { commentCount: number; openTaskCount: number };
  links: { self: BitbucketLinkRaw[] };
}

interface BitbucketPrPageRaw {
  values: BitbucketPrRaw[];
  isLastPage: boolean;
}

interface BitbucketActivityRaw {
  action: string;
  user: BitbucketUserRaw;
  reviewedStatus?: 'APPROVED' | 'NEEDS_WORK' | 'UNAPPROVED';
}

interface BitbucketActivityPageRaw {
  values: BitbucketActivityRaw[];
  isLastPage: boolean;
}

function mapReviewStatus(status: 'APPROVED' | 'UNAPPROVED' | 'NEEDS_WORK'): PrStatus {
  if (status === 'APPROVED') return 'Approved';
  if (status === 'NEEDS_WORK') return 'Changes Requested';
  return 'Awaiting Review';
}

function mapUser(raw: BitbucketUserRaw): PrUser {
  return {
    id: raw.id,
    name: raw.name,
    displayName: raw.displayName,
    emailAddress: raw.emailAddress,
    slug: raw.slug,
    active: raw.active,
    type: raw.type,
    profileUrl: raw.links?.self?.[0]?.href ?? '',
  };
}

function mapRepository(raw: BitbucketRepositoryRaw): PrRepository {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    projectKey: raw.project.key,
    projectName: raw.project.name,
    browseUrl: raw.links?.self?.[0]?.href ?? '',
  };
}

function mapRef(raw: BitbucketRefRaw): PrRef {
  return {
    id: raw.id,
    displayId: raw.displayId,
    latestCommit: raw.latestCommit,
    repository: mapRepository(raw.repository),
  };
}

function mapParticipant(raw: BitbucketParticipantRaw): PrParticipant {
  return {
    user: mapUser(raw.user),
    role: raw.role,
    approved: raw.approved,
    status: raw.status,
  };
}

@Injectable({ providedIn: 'root' })
export class BitbucketService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/bitbucket/rest/api/latest`;
  private readonly buildStatusUrl = `${environment.proxyUrl}/bitbucket/rest/build-status/latest`;

  private readonly config$ = this.http
    .get<{ bitbucketUserSlug: string }>(`${environment.proxyUrl}/config`)
    .pipe(shareReplay(1));

  readonly loading = signal(true);
  readonly error = signal(false);
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

  loadAll(): void {
    forkJoin([
      this.getReviewerPullRequests(),
      this.getAuthoredPullRequests().pipe(catchError(() => of([] as PullRequest[]))),
    ]).pipe(
      tap(([reviewerPrs, authoredPrs]) => {
        this.loading.set(false);
        const reviewerIds = new Set(reviewerPrs.map(pr => pr.id));
        const dedupedAuthored = authoredPrs.filter(pr => !reviewerIds.has(pr.id));
        this._rawPullRequests.set([...reviewerPrs, ...dedupedAuthored]);
      }),
      switchMap(([reviewerPrs, authoredPrs]) => {
        const enrichments: Observable<unknown>[] = [];

        const needsWorkPrs = reviewerPrs.filter(pr => pr.myReviewStatus === 'Changes Requested');
        if (needsWorkPrs.length > 0) {
          enrichments.push(
            forkJoin(
              needsWorkPrs.map(pr =>
                this.getReviewerPrActivityStatus(pr).pipe(
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
                this.getBuildStatusStats(pr.fromRef.latestCommit).pipe(
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

        const allPrs = [...reviewerPrs, ...dedupedAuthored];
        if (allPrs.length > 0) {
          enrichments.push(
            forkJoin(
              allPrs.map(pr =>
                this.getDiffstat(
                  pr.fromRef.repository.projectKey,
                  pr.fromRef.repository.slug,
                  pr.prNumber
                )
              )
            ).pipe(
              tap(results => {
                const diffstatById = new Map(allPrs.map((pr, i) => [pr.id, results[i]]));
                this._rawPullRequests.update(all =>
                  all.map(pr => {
                    const diffstat = diffstatById.get(pr.id);
                    return diffstat ? { ...pr, diffstat } : pr;
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
        this.error.set(true);
        this.loading.set(false);
        return of(null);
      }),
    ).subscribe();
  }

  getReviewerPullRequests(): Observable<PullRequest[]> {
    return this.config$.pipe(
      switchMap(config =>
        this.http
          .get<BitbucketPrPageRaw>(`${this.baseUrl}/dashboard/pull-requests`, {
            params: new HttpParams()
              .set('role', 'REVIEWER')
              .set('state', 'OPEN')
              .set('limit', '50'),
          })
          .pipe(map(page => page.values.map(pr => this.mapPr(pr, config.bitbucketUserSlug))))
      )
    );
  }

  getAuthoredPullRequests(): Observable<PullRequest[]> {
    return this.config$.pipe(
      switchMap(config =>
        this.http
          .get<BitbucketPrPageRaw>(`${this.baseUrl}/dashboard/pull-requests`, {
            params: new HttpParams()
              .set('role', 'AUTHOR')
              .set('state', 'OPEN')
              .set('limit', '50'),
          })
          .pipe(map(page => page.values.map(pr => this.mapAuthoredPr(pr))))
      )
    );
  }

  getBuildStatusStats(commitId: string): Observable<BuildStatusSummary> {
    return this.http
      .get<{ successful: number; failed: number; inProgress: number }>(
        `${this.buildStatusUrl}/commits/stats/${commitId}`
      )
      .pipe(
        map(stats => ({
          successful: stats.successful ?? 0,
          failed: stats.failed ?? 0,
          inProgress: stats.inProgress ?? 0,
        })),
        catchError(() => of({ successful: 0, failed: 0, inProgress: 0 }))
      );
  }

  getReviewerPrActivityStatus(pr: Pick<PullRequest, 'prNumber' | 'toRef'>): Observable<'Changes Requested' | 'Needs Re-review'> {
    const { projectKey } = pr.toRef.repository;
    const repoSlug = pr.toRef.repository.slug;
    const prId = pr.prNumber;

    return this.config$.pipe(
      switchMap(config =>
        this.http
          .get<BitbucketActivityPageRaw>(
            `${this.baseUrl}/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}/activities`
          )
          .pipe(
            map(page => {
              const activities = page.values;
              const needsWorkIndex = activities.findIndex(
                a =>
                  a.action === 'REVIEWED' &&
                  a.user.slug === config.bitbucketUserSlug &&
                  a.reviewedStatus === 'NEEDS_WORK'
              );
              if (needsWorkIndex === -1) return 'Changes Requested' as const;
              return needsWorkIndex > 0 ? ('Needs Re-review' as const) : ('Changes Requested' as const);
            }),
            catchError(() => of('Changes Requested' as const))
          )
      )
    );
  }

  getDiffstat(projectKey: string, repoSlug: string, prId: number): Observable<{ additions: number; deletions: number; total: number }> {
    return this.http
      .get<{ additions: number; deletions: number; total: number }>(
        `${environment.proxyUrl}/bitbucket/diffstat/${projectKey}/${repoSlug}/${prId}`
      )
      .pipe(catchError(() => of(undefined as unknown as { additions: number; deletions: number; total: number })));
  }

  getPullRequestDiff(pr: Pick<PullRequest, 'prNumber' | 'toRef'>): Observable<string> {
    const { projectKey } = pr.toRef.repository;
    const repoSlug = pr.toRef.repository.slug;
    return this.http.get(
      `${this.baseUrl}/projects/${projectKey}/repos/${repoSlug}/pull-requests/${pr.prNumber}.diff`,
      { responseType: 'text' },
    );
  }

  private mapPr(raw: BitbucketPrRaw, currentUserSlug: string): PullRequest {
    const reviewer = raw.reviewers.find(r => r.user.slug === currentUserSlug);
    const myReviewStatus: PrStatus = reviewer
      ? mapReviewStatus(reviewer.status)
      : 'Awaiting Review';

    const otherApproved = raw.reviewers.some(r => r.user.slug !== currentUserSlug && r.approved);
    const finalStatus: PrStatus = myReviewStatus === 'Awaiting Review' && otherApproved
      ? 'Approved by Others'
      : myReviewStatus;

    return {
      type: 'pr',
      id: `${raw.toRef.repository.project.key}/${raw.toRef.repository.slug}/${raw.id}`,
      prNumber: raw.id,
      title: raw.title,
      description: raw.description ?? '',
      state: raw.state as PullRequest['state'],
      open: raw.open,
      closed: raw.closed,
      locked: raw.locked,
      isDraft: raw.draft ?? false,
      createdDate: raw.createdDate,
      updatedDate: raw.updatedDate,
      fromRef: mapRef(raw.fromRef),
      toRef: mapRef(raw.toRef),
      author: mapParticipant(raw.author),
      reviewers: (raw.reviewers ?? []).map(mapParticipant),
      participants: (raw.participants ?? []).map(mapParticipant),
      commentCount: raw.properties?.commentCount ?? 0,
      openTaskCount: raw.properties?.openTaskCount ?? 0,
      url: raw.links?.self?.[0]?.href ?? '',
      myReviewStatus: finalStatus,
      isAuthoredByMe: false,
    };
  }

  private mapAuthoredPr(raw: BitbucketPrRaw): PullRequest {
    const hasNeedsWork = raw.reviewers.some(r => r.status === 'NEEDS_WORK');
    const allApproved = raw.reviewers.length > 0 && raw.reviewers.every(r => r.approved);
    const readyToMerge = !raw.draft && allApproved && (raw.properties?.openTaskCount ?? 0) === 0;

    let myReviewStatus: PrStatus;
    if (hasNeedsWork) {
      myReviewStatus = 'Changes Requested';
    } else if (readyToMerge) {
      myReviewStatus = 'Ready to Merge';
    } else {
      myReviewStatus = 'In Review';
    }

    return {
      type: 'pr',
      id: `${raw.toRef.repository.project.key}/${raw.toRef.repository.slug}/${raw.id}`,
      prNumber: raw.id,
      title: raw.title,
      description: raw.description ?? '',
      state: raw.state as PullRequest['state'],
      open: raw.open,
      closed: raw.closed,
      locked: raw.locked,
      isDraft: raw.draft ?? false,
      createdDate: raw.createdDate,
      updatedDate: raw.updatedDate,
      fromRef: mapRef(raw.fromRef),
      toRef: mapRef(raw.toRef),
      author: mapParticipant(raw.author),
      reviewers: (raw.reviewers ?? []).map(mapParticipant),
      participants: (raw.participants ?? []).map(mapParticipant),
      commentCount: raw.properties?.commentCount ?? 0,
      openTaskCount: raw.properties?.openTaskCount ?? 0,
      url: raw.links?.self?.[0]?.href ?? '',
      myReviewStatus,
      isAuthoredByMe: true,
    };
  }
}
