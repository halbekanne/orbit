import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Todo } from '../../models/work-item.model';

@Component({
  selector: 'app-todo-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="group w-full text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      [class]="selected()
        ? 'bg-indigo-50 border-indigo-300 shadow-sm'
        : todo().done
          ? 'bg-stone-50 border-stone-150 opacity-60'
          : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-sm'"
      (click)="select.emit(todo())"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="todo().title"
    >
      <div class="flex items-start gap-2.5">
        <button
          type="button"
          class="mt-0.5 shrink-0 w-4 h-4 rounded border-2 transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500"
          [class]="todo().done ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300 hover:border-indigo-400'"
          (click)="$event.stopPropagation(); toggle.emit(todo().id)"
          [attr.aria-label]="todo().done ? 'Als offen markieren' : 'Als erledigt markieren'"
          [attr.aria-checked]="todo().done"
          role="checkbox"
        >
          @if (todo().done) {
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
          }
        </button>

        <p class="text-sm font-medium leading-snug text-stone-800 flex-1" [class]="todo().done ? 'line-through text-stone-400' : ''">
          {{ todo().title }}
        </p>
      </div>
    </button>
  `,
})
export class TodoCardComponent {
  todo = input.required<Todo>();
  selected = input(false);
  select = output<Todo>();
  toggle = output<string>();
}
