import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeColor = 'neutral' | 'primary' | 'success' | 'danger' | 'signal';

@Component({
  selector: 'orbit-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClasses()',
    role: 'status',
  },
  template: `
    @if (status() && !counter()) {
      <span class="shrink-0 rounded-full" [class]="dotClasses()" aria-hidden="true"></span>
    }
    <ng-content />
  `,
})
export class BadgeComponent {
  readonly color = input<BadgeColor>('neutral');
  readonly size = input<'sm' | 'md'>('md');
  readonly status = input(false);
  readonly uppercase = input(false);
  readonly counter = input(false);

  readonly hostClasses = computed(() => {
    const c = this.color();
    const s = this.size();
    const isCounter = this.counter();
    const isStatus = this.status();

    const base = 'inline-flex items-center font-semibold border leading-none';
    const shape = isCounter || isStatus ? 'rounded-full' : 'rounded';

    let sizing: string;
    if (isCounter) {
      sizing = 'min-w-5 h-5 px-1 justify-center text-xs';
    } else if (s === 'sm') {
      sizing = 'px-1.5 py-0.5 text-[10px] gap-1';
    } else {
      sizing = 'px-2.5 py-0.5 text-[11px] gap-1.5';
    }

    const colorClasses = COLOR_MAP[c];
    const upper = this.uppercase() ? 'uppercase tracking-wide' : '';

    return `${base} ${shape} ${sizing} ${colorClasses} ${upper}`;
  });

  readonly dotClasses = computed(() => {
    const s = this.size();
    const dotSize = s === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5';
    return `${dotSize} ${DOT_MAP[this.color()]}`;
  });
}

const COLOR_MAP: Record<BadgeColor, string> = {
  neutral:
    'bg-[var(--color-badge-neutral-bg)] text-[var(--color-badge-neutral-text)] border-[var(--color-badge-neutral-border)]',
  primary:
    'bg-[var(--color-primary-bg)] text-[var(--color-primary-text)] border-[var(--color-primary-border)]',
  success:
    'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]',
  danger:
    'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-danger-border)]',
  signal:
    'bg-[var(--color-signal-bg)] text-[var(--color-signal-text)] border-[var(--color-signal-border)]',
};

const DOT_MAP: Record<BadgeColor, string> = {
  neutral: 'bg-[var(--color-badge-neutral-dot)]',
  primary: 'bg-[var(--color-primary-solid)]',
  success: 'bg-[var(--color-success-solid)]',
  danger: 'bg-[var(--color-danger-solid)]',
  signal: 'bg-[var(--color-signal-bar)]',
};
