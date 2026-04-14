import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  LucideZap,
  LucideActivity,
  LucideBookOpen,
  LucideSettings,
  LucidePlus,
} from '@lucide/angular';

interface OrbitView {
  id: string;
  label: string;
}

const VIEWS: OrbitView[] = [
  { id: 'arbeit', label: 'Arbeit' },
  { id: 'builds', label: 'Builds' },
  { id: 'logbuch', label: 'Logbuch' },
];

@Component({
  selector: 'app-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideZap, LucideActivity, LucideBookOpen, LucideSettings, LucidePlus],
  host: {
    class: 'w-16 shrink-0 bg-[var(--color-rail-bg)] flex flex-col items-center',
  },
  template: `
    <div
      class="w-full h-12 flex items-center justify-center border-b border-white/[0.06]"
      aria-hidden="true"
    >
      <div
        class="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center shadow-[0_0_12px_rgba(139,92,246,0.25)]"
      >
        <div class="w-3 h-3 rounded-full border-2 border-white"></div>
      </div>
    </div>

    <button
      type="button"
      class="w-[52px] h-12 flex flex-col items-center justify-center rounded-lg text-[var(--color-primary-text)] hover:bg-[var(--color-bg-surface)] transition-colors duration-100 mt-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
      aria-label="Quick Capture"
      (click)="quickCapture.emit()"
    >
      <svg lucidePlus [size]="20" [strokeWidth]="1.5"></svg>
      <span class="text-[10px] font-medium leading-tight mt-0.5">{{ shortcutLabel }}</span>
    </button>

    <nav aria-label="Hauptnavigation" class="flex flex-col items-center gap-1 mt-2">
      @for (view of views; track view.id) {
        <button
          type="button"
          class="flex flex-col items-center justify-center w-[52px] h-12 rounded-lg text-center transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 cursor-pointer"
          [class.bg-violet-500]="activeView() === view.id"
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
              <svg lucideZap [size]="20"></svg>
            }
            @case ('builds') {
              <svg lucideActivity [size]="20"></svg>
            }
            @case ('logbuch') {
              <svg lucideBookOpen [size]="20"></svg>
            }
          }
          <span class="text-[10px] font-medium leading-tight mt-0.5">{{ view.label }}</span>
        </button>
      }
    </nav>

    <div class="flex-1"></div>

    <button
      type="button"
      class="w-10 h-10 mb-3 flex items-center justify-center rounded-lg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
      [class.bg-violet-500]="activeView() === 'einstellungen'"
      [class.text-white]="activeView() === 'einstellungen'"
      [class.text-stone-400]="activeView() !== 'einstellungen'"
      [class.hover:text-stone-200]="activeView() !== 'einstellungen'"
      [class.hover:bg-stone-800]="activeView() !== 'einstellungen'"
      aria-label="Einstellungen"
      (click)="viewChange.emit('einstellungen')"
    >
      <svg lucideSettings [size]="20" [strokeWidth]="1.5"></svg>
    </button>
  `,
})
export class AppRailComponent {
  activeView = input.required<string>();
  viewChange = output<string>();
  quickCapture = output<void>();

  protected readonly shortcutLabel = navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K';
  protected readonly views = VIEWS;

  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const buttons = Array.from(target.closest('nav')!.querySelectorAll('button')) as HTMLElement[];
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
