import { PullRequest, PrStatus } from '../models/work-item.model';

const labelMap: Record<PrStatus, string> = {
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
  return labelMap[pr.myReviewStatus] ?? pr.myReviewStatus;
}
