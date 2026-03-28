import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PullRequest } from '../../models/work-item.model';
import { businessDaysSince } from '../../utils/business-days';
import { prStatusBadgeClass, prStatusLabel } from '../../utils/pr-status';

@Component({
  selector: 'app-pr-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="cardClasses()"
      (click)="select.emit(pr())"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="(pr().isDraft ? 'Entwurf – ' : '') + (pr().isAuthoredByMe ? 'Mein PR: ' : 'PR: ') + pr().title"
    >
      <div class="pl-4 pr-3 pt-2.5 pb-2.5">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <span
            class="font-mono text-[10px] font-semibold tracking-wide truncate"
            [class]="selected() ? 'text-[var(--color-primary-text)]' : 'text-[var(--color-text-muted)]'"
          >{{ pr().fromRef.repository.slug }}</span>
          <a
            [href]="pr().url"
            target="_blank"
            rel="noopener noreferrer"
            class="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-primary-solid)] transition-all duration-150 rounded p-0.5 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)]"
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

        @if (pr().isAuthoredByMe && !pr().isDraft) {
          <div class="mb-1.5">
            <span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-border-default)] leading-none uppercase tracking-wide">Mein PR</span>
          </div>
        }

        <div class="flex flex-wrap gap-1 mb-1.5 empty:hidden">
          @if (showBuildFailed()) {
            <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]">
              ✗ Build fehlgeschlagen
            </span>
          }
          @if (showChangesRequested()) {
            <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-signal-bg)] text-[var(--color-signal-text)]">
              Änderungen angefordert
            </span>
          }
          @if (waitingDays() >= 2 && !showAlreadyReviewed()) {
            <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-signal-bg)] text-[var(--color-signal-text)]">
              Review seit {{ waitingDays() }} Tagen
            </span>
          }
          @if (showAlreadyReviewed()) {
            <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-success-bg)] text-[var(--color-success-text)]">
              ✓ Bereits reviewed
            </span>
          }
          @if (showApproved()) {
            <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-success-bg)] text-[var(--color-success-text)]">
              ✓ Approved
            </span>
          }
          @if (isSmallChange()) {
            <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-success-bg)] text-[var(--color-success-text)]">
              Kleine Änderung
            </span>
          }
        </div>

        <p
          class="text-[13px] font-medium leading-snug line-clamp-2 mb-2 text-[var(--color-text-heading)]"
        >{{ pr().title }}</p>

        <div class="flex items-center justify-between gap-2">
          @if (pr().isAuthoredByMe) {
            <div class="flex items-center gap-3 min-w-0">
              @if (pr().openTaskCount > 0) {
                <span class="flex items-center gap-1 text-[11px] font-medium" [class]="taskColorClass()">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  {{ pr().openTaskCount }} {{ pr().openTaskCount === 1 ? 'Task' : 'Tasks' }}
                </span>
              }
              @if (buildIcon(); as icon) {
                <span class="flex items-center gap-1 text-[11px] font-medium" [class]="icon.colorClass">
                  @if (icon.type === 'success') {
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                  } @else if (icon.type === 'failed') {
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  } @else if (icon.type === 'running') {
                    <svg class="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  }
                  Build
                </span>
              }
              @if (pr().openTaskCount === 0 && !buildIcon()) {
                <span class="text-[11px] text-[var(--color-text-muted)] italic">Keine offenen Punkte</span>
              }
            </div>
          } @else {
            <div class="flex items-center gap-1.5 min-w-0">
              <span
                class="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold shrink-0"
                [class]="selected() ? 'bg-[var(--color-primary-border)] text-[var(--color-primary-text)]' : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]'"
                aria-hidden="true"
              >{{ authorInitials() }}</span>
              <span class="text-[11px] text-[var(--color-text-secondary)] truncate font-medium">{{ pr().author.user.displayName }}</span>
            </div>
          }

          <div class="flex items-center gap-1.5 shrink-0">
            <span
              class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold border leading-none"
              [class]="statusBadgeClass()"
            >{{ statusLabel() }}</span>
            @if (pr().commentCount > 0 && !pr().isAuthoredByMe) {
              <span class="flex items-center gap-0.5 text-[11px] text-[var(--color-text-muted)]" [attr.aria-label]="pr().commentCount + ' Kommentare'">
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

  statusBadgeClass = computed(() => prStatusBadgeClass(this.pr()));
  statusLabel = computed(() => prStatusLabel(this.pr()));

  readonly cardState = computed<'inactive' | 'normal' | 'attention' | 'attention-danger'>(() => {
    const pr = this.pr();

    if (pr.state === 'MERGED' || pr.state === 'DECLINED') return 'inactive';
    if (!pr.isAuthoredByMe && pr.myReviewStatus === 'Approved by Others') return 'inactive';

    if (pr.isAuthoredByMe) {
      if (pr.buildStatus && pr.buildStatus.failed > 0) return 'attention-danger';
      if (pr.myReviewStatus === 'Needs Re-review') return 'attention';
      if (pr.myReviewStatus === 'Changes Requested') return 'attention';
    }

    if (!pr.isAuthoredByMe) {
      const days = businessDaysSince(pr.createdDate);
      if (days >= 2 && pr.myReviewStatus !== 'Approved by Others') return 'attention';
    }

    return 'normal';
  });

  readonly cardClasses = computed(() => {
    const state = this.cardState();
    const sel = this.selected();

    const base = 'group relative w-full text-left rounded-lg overflow-hidden transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]';

    let classes = sel
      ? `${base} bg-[var(--color-card-selected-bg)] shadow-sm ring-1 ring-[var(--color-card-selected-ring)]`
      : `${base} bg-[var(--color-bg-card)] ring-1 ring-[var(--color-border-subtle)] hover:ring-[var(--color-border-default)]`;

    if (state === 'inactive') {
      classes += ' opacity-[var(--card-inactive-opacity)]';
    } else if (state === 'attention') {
      classes = classes.replace('rounded-lg', 'rounded-r-lg rounded-l-none');
      classes += ' border-l-4 border-l-[var(--color-card-attention-bar)]';
    } else if (state === 'attention-danger') {
      classes = classes.replace('rounded-lg', 'rounded-r-lg rounded-l-none');
      classes += ' border-l-4 border-l-[var(--color-card-attention-bar-danger)]';
    }

    return classes;
  });

  taskColorClass = computed(() => {
    const status = this.pr().myReviewStatus;
    if (this.pr().isAuthoredByMe && status === 'Changes Requested') return 'text-amber-700';
    return 'text-[var(--color-text-secondary)]';
  });

  readonly isSmallChange = computed(() => {
    const ds = this.pr().diffstat;
    return ds ? ds.total < 50 : false;
  });

  readonly waitingDays = computed(() => {
    if (this.pr().isAuthoredByMe) return 0;
    return businessDaysSince(this.pr().createdDate);
  });

  readonly showChangesRequested = computed(() =>
    this.pr().isAuthoredByMe &&
    (this.pr().myReviewStatus === 'Changes Requested' || this.pr().myReviewStatus === 'Needs Re-review')
  );

  readonly showBuildFailed = computed(() =>
    this.pr().isAuthoredByMe && (this.pr().buildStatus?.failed ?? 0) > 0
  );

  readonly showAlreadyReviewed = computed(() =>
    !this.pr().isAuthoredByMe && this.pr().myReviewStatus === 'Approved by Others'
  );

  readonly showApproved = computed(() =>
    this.pr().isAuthoredByMe &&
    (this.pr().myReviewStatus === 'Ready to Merge' || this.pr().myReviewStatus === 'Approved')
  );

  buildIcon = computed((): { type: 'success' | 'failed' | 'running'; colorClass: string } | null => {
    const build = this.pr().buildStatus;
    if (!build) return null;
    if (build.failed > 0) return { type: 'failed', colorClass: 'text-red-600' };
    if (build.inProgress > 0) return { type: 'running', colorClass: 'text-[var(--color-primary-text)]' };
    if (build.successful > 0) return { type: 'success', colorClass: 'text-emerald-600' };
    return null;
  });
}
