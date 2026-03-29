import { PullRequest, PrStatus } from '../models/work-item.model';
import { BadgeColor } from '../components/badge/badge';

const colorMap: Record<PrStatus, BadgeColor> = {
  'Awaiting Review': 'primary',
  'Needs Re-review': 'signal',
  'Changes Requested': 'neutral',
  'Approved': 'success',
  'Approved by Others': 'neutral',
  'In Review': 'neutral',
  'Ready to Merge': 'success',
};

export function prStatusColor(pr: PullRequest): BadgeColor {
  if (pr.isAuthoredByMe && pr.myReviewStatus === 'Changes Requested') return 'danger';
  return colorMap[pr.myReviewStatus] ?? 'neutral';
}

export function reviewerStatusColor(status: string): BadgeColor {
  switch (status) {
    case 'APPROVED': return 'success';
    case 'NEEDS_WORK': return 'signal';
    default: return 'neutral';
  }
}

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

const stripeMap: Record<PrStatus, string> = {
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


