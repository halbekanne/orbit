import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { WorkDataService } from '../../services/work-data.service';
import { TodoService } from '../../services/todo.service';

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
        aria-label="Aufgabe schnell erfassen"
        class="fixed inset-0 pointer-events-none"
      >
        <div
          class="bg-white rounded-xl shadow-lg border border-stone-200 w-full max-w-md mx-auto mt-[20vh] p-4 pointer-events-auto"
          (keydown)="onKeydown($event)"
        >
          <input
            #inputEl
            type="text"
            placeholder="Neue Aufgabe..."
            aria-label="Aufgabe eingeben"
            class="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>
    }
  `,
})
export class QuickCaptureComponent {
  open = input.required<boolean>();
  close = output<void>();

  private readonly data = inject(WorkDataService);
  private readonly todoService = inject(TodoService);
  private inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  constructor() {
    effect(() => {
      if (this.open()) {
        setTimeout(() => this.inputEl()?.nativeElement.focus(), 0);
      }
    });
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Tab') {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      const value = this.inputEl()?.nativeElement.value.trim() ?? '';
      if (value) {
        this.todoService.add(value);
      }
      this.close.emit();
    } else if (e.key === 'Escape') {
      this.close.emit();
    }
  }
}
