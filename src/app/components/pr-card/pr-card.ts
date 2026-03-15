import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PullRequest, PrStatus } from '../../models/work-item.model';

@Component({
  selector: 'app-pr-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="group relative w-full text-left rounded-lg overflow-hidden transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      [class]="selected()
        ? 'bg-indigo-50/70 shadow-sm ring-1 ring-indigo-200/80'
        : 'bg-white ring-1 ring-stone-200 hover:ring-stone-300 hover:bg-stone-50/60'"
      (click)="select.emit(pr())"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="(pr().isDraft ? 'Entwurf – ' : '') + 'PR: ' + pr().title"
    >
      <div
        class="absolute left-0 top-0 bottom-0 w-[3px] transition-opacity duration-150"
        [class]="stripeClass()"
        aria-hidden="true"
      ></div>

      <div class="pl-4 pr-3 pt-2.5 pb-2.5">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <span
            class="font-mono text-[10px] font-semibold tracking-wide truncate"
            [class]="selected() ? 'text-indigo-500' : 'text-stone-400'"
          >{{ pr().fromRef.repository.slug }}</span>
          <a
            [href]="pr().url"
            target="_blank"
            rel="noopener noreferrer"
            class="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-stone-400 hover:text-indigo-500 transition-all duration-150 rounded p-0.5 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500"
            aria-label="Öffne PR in Bitbucket"
            (click)="$event.stopPropagation()"
          >
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          </a>
        </div>

        @if (pr().isDraft) {
          <div class="mb-1.5">
            <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 leading-none uppercase tracking-wide">
              <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Entwurf
            </span>
          </div>
        }

        <p
          class="text-[13px] font-medium leading-snug line-clamp-2 mb-2"
          [class]="selected() ? 'text-stone-900' : 'text-stone-700'"
        >{{ pr().title }}</p>

        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 min-w-0">
            <span
              class="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold shrink-0"
              [class]="selected() ? 'bg-indigo-200 text-indigo-700' : 'bg-stone-200 text-stone-600'"
              aria-hidden="true"
            >{{ authorInitials() }}</span>
            <span class="text-[11px] text-stone-500 truncate font-medium">{{ pr().author.user.displayName }}</span>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <span
              class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold border leading-none"
              [class]="statusBadgeClass()"
            >{{ pr().myReviewStatus }}</span>
            @if (pr().commentCount > 0) {
              <span class="flex items-center gap-0.5 text-[11px] text-stone-400" [attr.aria-label]="pr().commentCount + ' Kommentare'">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                {{ pr().commentCount }}
              </span>
            }
          </div>
        </div>
      </div>
    </button>
  `,
})
export class PrCardComponent {
  pr = input.required<PullRequest>();
  selected = input(false);
  select = output<PullRequest>();

  authorInitials = computed(() =>
    this.pr().author.user.displayName
      .split(' ')
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2)
  );

  stripeClass = computed((): string => {
    if (this.pr().isDraft) return 'bg-amber-300';
    const map: Record<PrStatus, string> = {
      'Awaiting Review': 'bg-indigo-400',
      'Needs Re-review': 'bg-amber-500',
      'Changes Requested': 'bg-stone-300',
      'Approved': 'bg-emerald-500',
      'Approved by Others': 'bg-stone-300',
    };
    return map[this.pr().myReviewStatus] ?? 'bg-stone-300';
  });

  statusBadgeClass = computed((): string => {
    const map: Record<PrStatus, string> = {
      'Awaiting Review': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'Needs Re-review': 'bg-amber-50 text-amber-800 border-amber-300',
      'Changes Requested': 'bg-stone-100 text-stone-500 border-stone-200',
      'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Approved by Others': 'bg-stone-100 text-stone-500 border-stone-200',
    };
    return map[this.pr().myReviewStatus] ?? 'bg-stone-100 text-stone-500 border-stone-200';
  });
}
