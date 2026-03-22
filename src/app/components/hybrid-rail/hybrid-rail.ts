import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

interface OrbitView {
  id: string;
  label: string;
}

const VIEWS: OrbitView[] = [
  { id: 'arbeit', label: 'Arbeit' },
  { id: 'logbuch', label: 'Logbuch' },
];

@Component({
  selector: 'app-hybrid-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'w-16 shrink-0 bg-stone-900 flex flex-col items-center',
  },
  template: `
    <div class="w-full h-12 flex items-center justify-center border-b border-white/[0.06]" aria-hidden="true">
      <div class="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.25)]">
        <div class="w-3 h-3 rounded-full border-2 border-white"></div>
      </div>
    </div>

    <nav aria-label="Hauptnavigation" class="flex flex-col items-center gap-1 mt-2">
      @for (view of views; track view.id) {
        <button
          type="button"
          class="flex flex-col items-center justify-center w-[52px] h-12 rounded-lg text-center transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 cursor-pointer"
          [class.bg-indigo-600]="activeView() === view.id"
          [class.text-white]="activeView() === view.id"
          [class.text-stone-400]="activeView() !== view.id"
          [class.hover:text-stone-200]="activeView() !== view.id"
          [class.hover:bg-stone-800]="activeView() !== view.id"
          [attr.aria-current]="activeView() === view.id ? 'page' : null"
          (click)="viewChange.emit(view.id)"
          (keydown)="onKeydown($event)"
        >
          @switch (view.id) {
            @case ('arbeit') {
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
            }
            @case ('logbuch') {
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            }
          }
          <span class="text-[10px] font-medium leading-tight mt-0.5">{{ view.label }}</span>
        </button>
      }
    </nav>
  `,
})
export class HybridRailComponent {
  activeView = input.required<string>();
  viewChange = output<string>();

  protected readonly views = VIEWS;

  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const buttons = Array.from(
      target.closest('nav')!.querySelectorAll('button')
    ) as HTMLElement[];
    const index = buttons.indexOf(target);

    let next = -1;
    if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
    if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;

    if (next >= 0) {
      event.preventDefault();
      buttons[next].focus();
    }
  }
}
