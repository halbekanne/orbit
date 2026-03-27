import { PrStatus } from '../models/work-item.model';

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
