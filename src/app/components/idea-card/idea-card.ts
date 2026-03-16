import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Idea } from '../../models/work-item.model';

@Component({
  selector: 'app-idea-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="group w-full text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 flex items-start gap-2.5"
      [class]="cardClasses()"
      (click)="select.emit(idea())"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="idea().title"
    >
      <span class="mt-0.5 shrink-0 text-sm" aria-hidden="true">💡</span>
      <p class="text-sm font-medium leading-snug text-stone-800 flex-1"
        [class]="idea().status === 'wont-do' ? 'line-through text-stone-400' : ''">
        {{ idea().title }}
      </p>
      <div
        class="opacity-0 group-hover:opacity-100 transition-opacity text-stone-300 cursor-grab active:cursor-grabbing ml-1 shrink-0 self-center select-none"
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
      ? 'bg-indigo-50 border-indigo-300 shadow-sm'
      : this.idea().status === 'wont-do'
        ? 'bg-stone-50 border-stone-150 opacity-60'
        : 'bg-indigo-50/40 border-indigo-100 hover:border-indigo-200 hover:shadow-sm'
  );
}
