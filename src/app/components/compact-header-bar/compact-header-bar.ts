import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-compact-header-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block sticky top-0 z-20',
  },
  template: `
    <div data-testid="compact-bar"
         class="flex items-center gap-2 px-4 h-9 bg-[var(--color-bg-card)] border-b border-[var(--color-border-default)] shadow-sm transition-all duration-150 ease-out"
         [class.-translate-y-full]="!visible()"
         [class.opacity-0]="!visible()"
         [class.translate-y-0]="visible()"
         [class.opacity-100]="visible()">
      <div class="w-[3px] h-[18px] rounded-sm" [class]="stripeColor()"></div>
      @if (prefix()) {
        <span class="font-mono text-[10px] text-[var(--color-text-muted)] shrink-0">{{ prefix() }}</span>
      }
      <span class="text-xs font-semibold text-[var(--color-text-heading)] truncate min-w-0 flex-1">{{ title() }}</span>
      <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" [class]="statusClass()">{{ statusLabel() }}</span>
    </div>
  `,
})
export class CompactHeaderBarComponent {
  readonly visible = input.required<boolean>();
  readonly title = input.required<string>();
  readonly statusLabel = input.required<string>();
  readonly statusClass = input.required<string>();
  readonly stripeColor = input.required<string>();
  readonly prefix = input<string>('');
}
