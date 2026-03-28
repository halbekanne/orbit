import { PullRequest, PrStatus } from '../models/work-item.model';

const statusLabelMap: Record<PrStatus, string> = {
  'Awaiting Review': 'Wartet auf Review',
  'Needs Re-review': 'Erneutes Review nötig',
  'Changes Requested': 'Änderungen angefordert',
  'Approved': 'Genehmigt',
  'Approved by Others': 'Von Anderen genehmigt',
  'In Review': 'Im Review',
  'Ready to Merge': 'Bereit zum Mergen',
};

export function prStatusLabel(pr: PullRequest): string {
  if (pr.myReviewStatus === 'Changes Requested' && pr.isAuthoredByMe) {
    return 'Änderungen nötig';
  }
  return statusLabelMap[pr.myReviewStatus] ?? pr.myReviewStatus;
}

export function prStatusClass(status: PrStatus): string {
  const map: Record<PrStatus, string> = {
    'Awaiting Review': 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500',
    'Needs Re-review': 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500',
    'Changes Requested': 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]',
    'Approved': 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
    'Approved by Others': 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]',
    'In Review': 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]',
    'Ready to Merge': 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
  };
  return map[status];
}

const stripeMap: Record<PrStatus, string> = {
  'Awaiting Review': 'bg-violet-400',
  'Needs Re-review': 'bg-amber-500',
  'Changes Requested': 'bg-stone-300',
  'Approved': 'bg-emerald-500',
  'Approved by Others': 'bg-stone-300',
  'In Review': 'bg-stone-300',
  'Ready to Merge': 'bg-emerald-500',
};

const badgeMap: Record<PrStatus, string> = {
  'Awaiting Review': 'bg-[var(--color-pr-in-review-bg)] text-[var(--color-pr-in-review-text)] border-[var(--color-pr-in-review-border)]',
  'Needs Re-review': 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-500/10 dark:text-amber-500 dark:border-amber-500/20',
  'Changes Requested': 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]',
  'Approved': 'bg-[var(--color-pr-approved-bg)] text-[var(--color-pr-approved-text)] border-[var(--color-pr-approved-border)]',
  'Approved by Others': 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]',
  'In Review': 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]',
  'Ready to Merge': 'bg-[var(--color-pr-approved-bg)] text-[var(--color-pr-approved-text)] border-[var(--color-pr-approved-border)]',
};

const dotMap: Record<PrStatus, string> = {
  'Awaiting Review': 'bg-violet-400',
  'Needs Re-review': 'bg-amber-500',
  'Changes Requested': 'bg-stone-300',
  'Approved': 'bg-emerald-500',
  'Approved by Others': 'bg-stone-300',
  'In Review': 'bg-stone-300',
  'Ready to Merge': 'bg-emerald-500',
};

export function prStripeClass(pr: PullRequest): string {
  if (pr.isDraft) return 'bg-amber-300';
  if (pr.isAuthoredByMe && pr.myReviewStatus === 'Changes Requested') return 'bg-amber-500';
  return stripeMap[pr.myReviewStatus] ?? 'bg-stone-300';
}

export function prStatusBadgeClass(pr: PullRequest): string {
  if (pr.isAuthoredByMe && pr.myReviewStatus === 'Changes Requested') {
    return 'bg-[var(--color-pr-changes-bg)] text-[var(--color-pr-changes-text)] border-[var(--color-pr-changes-border)]';
  }
  return badgeMap[pr.myReviewStatus] ?? 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]';
}

export function prStatusDotClass(pr: PullRequest): string {
  if (pr.isDraft) return 'bg-amber-300';
  if (pr.isAuthoredByMe && pr.myReviewStatus === 'Changes Requested') return 'bg-amber-500';
  return dotMap[pr.myReviewStatus] ?? 'bg-stone-300';
}
