import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, Subscription } from 'rxjs';
import { JiraTicket } from '../models/work-item.model';
import { ReviewResult, ReviewState } from '../models/review.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CosiReviewService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/api/cosi/review`;
  private readonly reviewRequestedSubject = new Subject<void>();
  private activeRequest?: Subscription;

  readonly reviewState = signal<ReviewState>('idle');
  readonly canReview = signal(false);
  readonly reviewRequested$ = this.reviewRequestedSubject.asObservable();

  triggerReview(): void {
    this.reviewRequestedSubject.next();
  }

  requestReview(diff: string, jiraTicket: JiraTicket | null): void {
    this.activeRequest?.unsubscribe();
    this.reviewState.set('loading');

    const body = {
      diff,
      jiraTicket: jiraTicket
        ? { key: jiraTicket.key, summary: jiraTicket.summary, description: jiraTicket.description }
        : null,
    };

    this.activeRequest = this.http.post<ReviewResult>(this.baseUrl, body).subscribe({
      next: (result) => this.reviewState.set({ status: 'result', data: result }),
      error: (err) => this.reviewState.set({ status: 'error', message: err.message || 'Review fehlgeschlagen' }),
    });
  }

  reset(): void {
    this.activeRequest?.unsubscribe();
    this.reviewState.set('idle');
  }
}
