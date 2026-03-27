import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Idea } from '../../models/work-item.model';

@Component({
  selector: 'app-idea-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="group w-full text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] flex items-start gap-2.5"
      [class]="cardClasses()"
      (click)="select.emit(idea())"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="idea().title"
    >
      <span class="mt-0.5 shrink-0 text-sm" aria-hidden="true">💡</span>
      <p class="text-sm font-medium leading-snug text-[var(--color-text-heading)] flex-1"
        [class]="idea().status === 'wont-do' ? 'line-through text-[var(--color-text-muted)]' : ''">
        {{ idea().title }}
      </p>
      <div
        class="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] cursor-grab active:cursor-grabbing ml-1 shrink-0 self-center select-none"
        aria-hidden="true"
      >⠿</div>
    </button>
  `,
})
export class IdeaCardComponent {
  idea = input.required<Idea>();
  selected = input(false);
  select = output<Idea>();

  cardClasses = computed(() =>
    this.selected()
      ? 'bg-[var(--color-card-selected-bg)] border-[var(--color-card-selected-ring)] shadow-sm'
      : this.idea().status === 'wont-do'
        ? 'bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] opacity-[var(--card-inactive-opacity)]'
        : 'bg-[var(--color-bg-card)] border-[var(--color-border-subtle)] hover:border-[var(--color-primary-border)] hover:shadow-sm'
  );
}
