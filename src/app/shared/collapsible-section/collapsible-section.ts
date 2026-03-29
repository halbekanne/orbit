import { ChangeDetectionStrategy, Component, input, linkedSignal } from '@angular/core';

@Component({
  selector: 'app-collapsible-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border-subtle)] shadow-sm overflow-hidden"
    >
      <button
        type="button"
        class="w-full text-left px-6 py-3.5 flex items-center gap-3 hover:bg-[var(--color-bg-surface)] transition-colors"
        (click)="expanded.set(!expanded())"
        [attr.aria-expanded]="expanded()"
      >
        <svg
          class="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0 transition-transform duration-150"
          [class.rotate-90]="expanded()"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path d="M4 2l4 4-4 4" />
        </svg>
        <ng-content select="[sectionIcon]" />
        <span
          class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
          >{{ label() }}</span
        >
        <ng-content select="[sectionMeta]" />
      </button>
      @if (expanded()) {
        <div
          class="border-t border-[var(--color-border-subtle)]"
          [class]="noPadding() ? '' : 'px-6 py-4'"
        >
          <ng-content />
        </div>
      }
    </div>
  `,
})
export class CollapsibleSectionComponent {
  readonly label = input.required<string>();
  readonly initialExpanded = input(false, { alias: 'expanded' });
  readonly noPadding = input(false);

  protected readonly expanded = linkedSignal(() => this.initialExpanded());
}
