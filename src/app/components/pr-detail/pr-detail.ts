import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PullRequest } from '../../models/work-item.model';

@Component({
  selector: 'app-pr-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <article class="h-full flex flex-col" [attr.aria-label]="'PR #' + pr().prNumber + ': ' + pr().title">
      <header class="pb-5 border-b border-stone-200">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-stone-100 text-stone-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" x2="6" y1="9" y2="21"/></svg>
                {{ pr().fromRef.repository.slug }}
              </span>
              <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium" [class]="statusClass()">{{ pr().myReviewStatus }}</span>
            </div>
            <h1 class="text-xl font-semibold text-stone-900 leading-snug">{{ pr().title }}</h1>
          </div>
          <a
            [href]="pr().url"
            target="_blank"
            rel="noopener noreferrer"
            class="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            aria-label="Öffne PR in Bitbucket"
          >
            In Bitbucket öffnen
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          </a>
        </div>
      </header>

      <div class="py-5 border-b border-stone-200">
        <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Autor</dt>
            <dd class="text-sm text-stone-700 font-medium">{{ pr().author.user.displayName }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Branch</dt>
            <dd class="text-sm text-stone-700 font-mono truncate">{{ pr().fromRef.displayId }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Kommentare</dt>
            <dd class="text-sm text-stone-700 font-medium">{{ pr().commentCount }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Aktualisiert</dt>
            <dd class="text-sm text-stone-700">{{ pr().updatedDate | date:'dd.MM.yyyy' }}</dd>
          </div>
        </dl>
      </div>

      <div class="flex-1 py-5 overflow-y-auto">
        <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Beschreibung</h2>
        <div class="text-sm text-stone-700 leading-relaxed whitespace-pre-line">{{ pr().description }}</div>
      </div>
    </article>
  `,
})
export class PrDetailComponent {
  pr = input.required<PullRequest>();

  statusClass(): string {
    const map: Record<string, string> = {
      'Awaiting Review': 'bg-amber-100 text-amber-700',
      'Changes Requested': 'bg-red-100 text-red-700',
      'Approved': 'bg-emerald-100 text-emerald-700',
    };
    return map[this.pr().myReviewStatus] ?? 'bg-stone-100 text-stone-600';
  }
}
