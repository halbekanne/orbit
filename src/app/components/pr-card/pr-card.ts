import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PullRequest } from '../../models/work-item.model';
import { prStatusClass } from '../pr-status-class';

@Component({
  selector: 'app-pr-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="group w-full text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      [class]="selected()
        ? 'bg-indigo-50 border-indigo-300 shadow-sm'
        : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-sm'"
      (click)="select.emit(pr())"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="'PR: ' + pr().title"
    >
      <div class="flex items-start justify-between gap-2">
        <span class="text-xs font-medium text-stone-400 truncate">{{ pr().fromRef.repository.slug }}</span>
        <a
          [href]="pr().url"
          target="_blank"
          rel="noopener noreferrer"
          class="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-stone-400 hover:text-indigo-500 transition-opacity p-0.5 rounded"
          [attr.aria-label]="'Öffne PR in Bitbucket'"
          (click)="$event.stopPropagation()"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
        </a>
      </div>

      <p class="mt-1 text-sm font-medium leading-snug text-stone-800 line-clamp-2">{{ pr().title }}</p>

      <div class="mt-2 flex items-center justify-between gap-2">
        <span
          class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
          [class]="statusClass()"
          [attr.aria-label]="pr().myReviewStatus === 'Needs Re-review' ? 'Erneut prüfen' : null"
        >
          {{ pr().myReviewStatus }}
        </span>
        @if (pr().commentCount > 0) {
          <span class="flex items-center gap-1 text-xs text-stone-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {{ pr().commentCount }}
          </span>
        }
      </div>
    </button>
  `,
})
export class PrCardComponent {
  pr = input.required<PullRequest>();
  selected = input(false);
  select = output<PullRequest>();

  statusClass(): string {
    return prStatusClass(this.pr().myReviewStatus);
  }
}
