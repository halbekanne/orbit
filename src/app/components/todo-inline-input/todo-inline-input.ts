import { ChangeDetectionStrategy, Component, ElementRef, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-todo-inline-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      #inputEl
      type="text"
      placeholder="Neue Aufgabe..."
      aria-label="Neue Aufgabe hinzufügen"
      class="bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-400"
      (keydown)="onKeydown($event)"
    />
  `,
})
export class TodoInlineInputComponent {
  add = output<string>();

  private inputEl = viewChild.required<ElementRef<HTMLInputElement>>('inputEl');

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      const value = this.inputEl().nativeElement.value.trim();
      if (value) {
        this.add.emit(value);
        this.inputEl().nativeElement.value = '';
      }
    } else if (e.key === 'Escape') {
      this.inputEl().nativeElement.value = '';
    }
  }
}
