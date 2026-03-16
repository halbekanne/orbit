import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { TodoService } from '../../services/todo.service';
import { IdeaService } from '../../services/idea.service';

type CaptureMode = 'todo' | 'idea';

@Component({
  selector: 'app-quick-capture',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 bg-black/20 backdrop-blur-[1px]"
        aria-hidden="true"
        (click)="close.emit()"
      ></div>
      <div
        #card
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="mode() === 'todo' ? 'Aufgabe schnell erfassen' : 'Idee schnell erfassen'"
        class="fixed inset-0 pointer-events-none"
      >
        <div
          class="bg-white rounded-xl shadow-lg border border-stone-200 w-full max-w-md mx-auto mt-[20vh] p-4 pointer-events-auto"
          (keydown)="onKeydown($event)"
        >
          <input
            #inputEl
            type="text"
            [placeholder]="mode() === 'todo' ? 'Neue Aufgabe…' : 'Neue Idee…'"
            [attr.aria-label]="mode() === 'todo' ? 'Aufgabe eingeben' : 'Idee eingeben'"
            class="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div class="flex gap-2 mt-3" role="group" aria-label="Art der Erfassung">
            <button
              type="button"
              class="flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              [class]="mode() === 'todo' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300'"
              (click)="mode.set('todo')"
              [attr.aria-pressed]="mode() === 'todo'"
            >
              Aufgabe
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              [class]="mode() === 'idea' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300'"
              (click)="mode.set('idea')"
              [attr.aria-pressed]="mode() === 'idea'"
            >
              💡 Idee
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class QuickCaptureComponent {
  open = input.required<boolean>();
  close = output<void>();

  private readonly todoService = inject(TodoService);
  private readonly ideaService = inject(IdeaService);
  private inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  mode = signal<CaptureMode>('todo');

  constructor() {
    effect(() => {
      if (this.open()) {
        this.mode.set('todo');
        setTimeout(() => this.inputEl()?.nativeElement.focus(), 0);
      }
    });
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Tab') {
      e.preventDefault();
      this.mode.update(m => m === 'todo' ? 'idea' : 'todo');
      return;
    }
    if (e.key === 'Enter') {
      const value = this.inputEl()?.nativeElement.value.trim() ?? '';
      if (value) {
        if (this.mode() === 'todo') {
          this.todoService.add(value);
        } else {
          this.ideaService.add(value);
        }
      }
      this.close.emit();
    } else if (e.key === 'Escape') {
      this.close.emit();
    }
  }
}
