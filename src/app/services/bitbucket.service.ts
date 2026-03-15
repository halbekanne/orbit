import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
  PullRequest,
  PrStatus,
  PrUser,
  PrRepository,
  PrRef,
  PrParticipant,
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
  links: { self: BitbucketLinkRaw[] };
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
  links: { self: BitbucketLinkRaw[] };
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
  private readonly baseUrl = `${environment.proxyUrl}/bitbucket/rest/api/1.0`;

  getReviewerPullRequests(): Observable<PullRequest[]> {
    return this.http.get<BitbucketUserRaw>(`${this.baseUrl}/myself`).pipe(
      switchMap(myself =>
        this.http
          .get<BitbucketPrPageRaw>(`${this.baseUrl}/dashboard/pull-requests`, {
            params: new HttpParams()
              .set('role', 'REVIEWER')
              .set('state', 'OPEN')
              .set('limit', '50'),
          })
          .pipe(map(page => page.values.map(pr => this.mapPr(pr, myself.slug))))
      )
    );
  }

  private mapPr(raw: BitbucketPrRaw, currentUserSlug: string): PullRequest {
    const reviewer = raw.reviewers.find(r => r.user.slug === currentUserSlug);
    const myReviewStatus: PrStatus = reviewer
      ? mapReviewStatus(reviewer.status)
      : 'Awaiting Review';

    return {
      type: 'pr',
      id: raw.id,
      title: raw.title,
      description: raw.description ?? '',
      state: raw.state as PullRequest['state'],
      open: raw.open,
      closed: raw.closed,
      locked: raw.locked,
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
    };
  }
}
