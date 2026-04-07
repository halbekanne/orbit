import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PullRequest } from '../../shared/work-item.model';
import { businessDaysSince } from '../../shared/business-days';
import { prStatusColor, prStatusLabel } from '../pr-status';
import { BadgeComponent } from '../../shared/badge/badge';
import {
  LucideExternalLink,
  LucideCircleAlert,
  LucideSquareCheck,
  LucideCheck,
  LucideX,
  LucideLoaderCircle,
  LucideMessageSquare,
} from '@lucide/angular';

@Component({
  selector: 'app-pr-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, LucideExternalLink, LucideCircleAlert, LucideSquareCheck, LucideCheck, LucideX, LucideLoaderCircle, LucideMessageSquare],
  template: `
    <button
      type="button"
      [class]="cardClasses()"
      (click)="select.emit(pr())"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="
        (pr().isDraft ? 'Entwurf – ' : '') +
        (pr().isAuthoredByMe ? 'Mein PR: ' : 'PR: ') +
        pr().title
      "
    >
      <div class="pl-4 pr-3 pt-2.5 pb-2.5">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <span
            class="font-mono text-[10px] font-semibold tracking-wide truncate"
            [class]="
              selected() ? 'text-[var(--color-primary-text)]' : 'text-[var(--color-text-muted)]'
            "
            >{{ pr().fromRef.repository.slug }}</span
          >
          <a
            [href]="pr().url"
            target="_blank"
            rel="noopener noreferrer"
            class="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-primary-solid)] transition-all duration-150 rounded p-0.5 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)]"
            aria-label="Öffne PR in Bitbucket"
            (click)="$event.stopPropagation()"
          >
            <svg lucideExternalLink [size]="12" [strokeWidth]="2.5"></svg>
          </a>
        </div>

        @if (pr().isDraft) {
          <div class="mb-1.5">
            <orbit-badge color="signal" [uppercase]="true" size="sm">
              <svg lucideCircleAlert class="shrink-0" [size]="10" [strokeWidth]="2.5"></svg>
              Entwurf
            </orbit-badge>
          </div>
        }

        <div class="flex flex-wrap gap-1 mb-1.5 empty:hidden">
          @if (showBuildFailed()) {
            <orbit-badge color="danger" size="sm">✗ Build fehlgeschlagen</orbit-badge>
          }
          @if (showChangesRequested()) {
            <orbit-badge color="signal" size="sm">Änderungen angefordert</orbit-badge>
          }
          @if (waitingDays() >= 2 && !showAlreadyReviewed()) {
            <orbit-badge color="signal" size="sm"
              >Wartet seit {{ waitingDays() }} Tagen</orbit-badge
            >
          }
          @if (showAlreadyReviewed()) {
            <orbit-badge color="success" size="sm">✓ Bereits reviewed</orbit-badge>
          }
          @if (showApproved()) {
            <orbit-badge color="success" size="sm">✓ Approved</orbit-badge>
          }
          @if (isSmallChange()) {
            <orbit-badge color="success" size="sm">Kleine Änderung</orbit-badge>
          }
        </div>

        <p
          class="text-[13px] font-medium leading-snug line-clamp-2 mb-2 text-[var(--color-text-heading)]"
        >
          {{ pr().title }}
        </p>

        <div class="flex items-center justify-between gap-2">
          @if (pr().isAuthoredByMe) {
            <div class="flex items-center gap-3 min-w-0">
              @if (pr().openTaskCount > 0) {
                <span
                  class="flex items-center gap-1 text-[11px] font-medium"
                  [class]="taskColorClass()"
                >
                  <svg lucideSquareCheck [size]="12"></svg>
                  {{ pr().openTaskCount }} {{ pr().openTaskCount === 1 ? 'Task' : 'Tasks' }}
                </span>
              }
              @if (buildIcon(); as icon) {
                <span
                  class="flex items-center gap-1 text-[11px] font-medium"
                  [class]="icon.colorClass"
                >
                  @if (icon.type === 'success') {
                    <svg lucideCheck [size]="12" [strokeWidth]="2.5"></svg>
                  } @else if (icon.type === 'failed') {
                    <svg lucideX [size]="12" [strokeWidth]="2.5"></svg>
                  } @else if (icon.type === 'running') {
                    <svg lucideLoaderCircle class="animate-spin" [size]="12" [strokeWidth]="2.5"></svg>
                  }
                  Build
                </span>
              }
              @if (pr().openTaskCount === 0 && !buildIcon()) {
                <span class="text-[11px] text-[var(--color-text-muted)] italic"
                  >Keine offenen Punkte</span
                >
              }
            </div>
          } @else {
            <div class="flex items-center gap-1.5 min-w-0">
              <span
                class="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold shrink-0"
                [class]="
                  selected()
                    ? 'bg-[var(--color-primary-border)] text-[var(--color-primary-text)]'
                    : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]'
                "
                aria-hidden="true"
                >{{ authorInitials() }}</span
              >
              <span class="text-[11px] text-[var(--color-text-secondary)] truncate font-medium">{{
                pr().author.user.displayName
              }}</span>
            </div>
          }

          <div class="flex items-center gap-1.5 shrink-0">
            <orbit-badge [color]="statusColor()" [status]="true" size="sm">{{
              statusLabel()
            }}</orbit-badge>
            @if (pr().commentCount > 0 && !pr().isAuthoredByMe) {
              <span
                class="flex items-center gap-0.5 text-[11px] text-[var(--color-text-muted)]"
                [attr.aria-label]="pr().commentCount + ' Kommentare'"
              >
                <svg lucideMessageSquare [size]="12"></svg>
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
    this.pr()
      .author.user.displayName.split(' ')
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2),
  );

  statusLabel = computed(() => prStatusLabel(this.pr()));
  statusColor = computed(() => prStatusColor(this.pr()));

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

    const base =
      'group relative w-full text-left rounded-lg overflow-hidden transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]';

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

  readonly showChangesRequested = computed(
    () =>
      this.pr().isAuthoredByMe &&
      (this.pr().myReviewStatus === 'Changes Requested' ||
        this.pr().myReviewStatus === 'Needs Re-review'),
  );

  readonly showBuildFailed = computed(
    () => this.pr().isAuthoredByMe && (this.pr().buildStatus?.failed ?? 0) > 0,
  );

  readonly showAlreadyReviewed = computed(
    () => !this.pr().isAuthoredByMe && this.pr().myReviewStatus === 'Approved by Others',
  );

  readonly showApproved = computed(
    () =>
      this.pr().isAuthoredByMe &&
      (this.pr().myReviewStatus === 'Ready to Merge' || this.pr().myReviewStatus === 'Approved'),
  );

  buildIcon = computed(
    (): { type: 'success' | 'failed' | 'running'; colorClass: string } | null => {
      const build = this.pr().buildStatus;
      if (!build) return null;
      if (build.failed > 0) return { type: 'failed', colorClass: 'text-red-600' };
      if (build.inProgress > 0)
        return { type: 'running', colorClass: 'text-[var(--color-primary-text)]' };
      if (build.successful > 0) return { type: 'success', colorClass: 'text-emerald-600' };
      return null;
    },
  );
}
