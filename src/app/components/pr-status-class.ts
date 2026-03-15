import { PrStatus } from '../models/work-item.model';

export function prStatusClass(status: PrStatus): string {
  const map: Record<PrStatus, string> = {
    'Awaiting Review': 'bg-amber-100 text-amber-700',
    'Needs Re-review': 'bg-amber-100 text-amber-700',
    'Changes Requested': 'bg-stone-100 text-stone-500',
    'Approved': 'bg-emerald-100 text-emerald-700',
    'Approved by Others': 'bg-stone-100 text-stone-500',
  };
  return map[status];
}
