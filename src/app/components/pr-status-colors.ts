import { PullRequest, PrStatus } from '../models/work-item.model';

const stripeMap: Record<PrStatus, string> = {
  'Awaiting Review': 'bg-indigo-400',
  'Needs Re-review': 'bg-amber-500',
  'Changes Requested': 'bg-stone-300',
  'Approved': 'bg-emerald-500',
  'Approved by Others': 'bg-stone-300',
  'In Review': 'bg-stone-300',
  'Ready to Merge': 'bg-emerald-500',
};

const badgeMap: Record<PrStatus, string> = {
  'Awaiting Review': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Needs Re-review': 'bg-amber-50 text-amber-800 border-amber-300',
  'Changes Requested': 'bg-stone-100 text-stone-500 border-stone-200',
  'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Approved by Others': 'bg-stone-100 text-stone-500 border-stone-200',
  'In Review': 'bg-stone-100 text-stone-500 border-stone-200',
  'Ready to Merge': 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const dotMap: Record<PrStatus, string> = {
  'Awaiting Review': 'bg-indigo-400',
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
    return 'bg-amber-50 text-amber-800 border-amber-300';
  }
  return badgeMap[pr.myReviewStatus] ?? 'bg-stone-100 text-stone-500 border-stone-200';
}

export function prStatusDotClass(pr: PullRequest): string {
  if (pr.isDraft) return 'bg-amber-300';
  if (pr.isAuthoredByMe && pr.myReviewStatus === 'Changes Requested') return 'bg-amber-500';
  return dotMap[pr.myReviewStatus] ?? 'bg-stone-300';
}
