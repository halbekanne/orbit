import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { Todo } from '../../models/work-item.model';
import { TodoService } from '../../services/todo.service';
import { spawnConfetti, playChime } from '../../shared/celebration';

@Component({
  selector: 'app-todo-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDragHandle],
  styles: [`
    @keyframes celebrateBounce {
      0% { transform: scale(1); }
      30% { transform: scale(1.4); }
      60% { transform: scale(0.9); }
      100% { transform: scale(1); }
    }
    .celebrating .checkbox-inner {
      animation: celebrateBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes confettiFly {
      0% { transform: translate(0,0) scale(1); opacity: 1; }
      100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
    }
    .confetti-particle {
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      pointer-events: none;
      animation: confettiFly 0.65s ease-out forwards;
    }
  `],
  template: `
    <div
      class="group relative w-full rounded-lg border transition-all duration-150"
      [class]="outerClasses()"
    >
      @if (todo().urgent) {
        <div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-amber-500" aria-hidden="true"></div>
      }

      <div class="flex items-start gap-2.5 px-3 py-2.5 pl-4">
        <div class="relative mt-0.5 shrink-0" #checkboxRef>
          <button
            type="button"
            class="checkbox-inner w-4 h-4 rounded border-2 transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500"
            [class]="checkboxClass()"
            (click)="onToggle()"
            [attr.aria-label]="todo().status === 'done' ? 'Als offen markieren' : 'Als erledigt markieren'"
            [attr.aria-checked]="todo().status === 'done'"
            role="checkbox"
          >
            @if (todo().status === 'done') {
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            }
          </button>
        </div>

        <button
          type="button"
          class="flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 rounded"
          (click)="select.emit(todo())"
          [attr.aria-pressed]="selected()"
          [attr.aria-label]="todo().title"
        >
          <p class="text-sm font-medium leading-snug text-stone-800"
            [class]="todo().status === 'done' ? 'line-through text-stone-400' : ''">
            {{ todo().title }}
          </p>
        </button>

        <div
          cdkDragHandle
          class="opacity-0 group-hover:opacity-100 transition-opacity text-stone-300 cursor-grab active:cursor-grabbing ml-1 shrink-0 self-center select-none"
          aria-label="Aufgabe verschieben"
        >⠿</div>
      </div>
    </div>
  `,
})
export class TodoCardComponent {
  todo = input.required<Todo>();
  selected = input(false);
  highlighted = input(false);
  select = output<Todo>();
  toggle = output<string>();

  private readonly todoService = inject(TodoService);
  private readonly checkboxRef = viewChild<ElementRef<HTMLElement>>('checkboxRef');

  celebrating = computed(() => this.todoService.lastCompletedId() === this.todo().id);

  constructor() {
    effect(() => {
      if (this.celebrating()) {
        playChime();
        const anchor = this.checkboxRef()?.nativeElement;
        if (anchor) spawnConfetti(anchor);
      }
    });
  }

  outerClasses = computed(() => {
    const base = this.selected()
      ? 'bg-indigo-50 border-indigo-300 shadow-sm'
      : this.todo().status === 'done'
        ? 'bg-stone-50 border-stone-150 opacity-60'
        : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-sm';
    const highlight = this.highlighted() ? ' animate-highlight' : '';
    const celebrate = this.celebrating() ? ' celebrating' : '';
    return base + highlight + celebrate;
  });

  checkboxClass = computed(() =>
    this.todo().status === 'done'
      ? 'bg-emerald-500 border-emerald-500'
      : 'border-stone-300 hover:border-indigo-400'
  );

  onToggle(): void {
    const t = this.todo();
    if (t.status === 'open') {
      this.todoService.update({ ...t, status: 'done' as const });
    } else {
      this.todoService.update({ ...t, status: 'open' as const, completedAt: null });
    }
    this.toggle.emit(t.id);
  }

}
