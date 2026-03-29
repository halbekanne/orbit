import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path
                  d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
                />
              </svg>
            }
            @case ('builds') {
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
              </svg>
            }
            @case ('logbuch') {
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
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
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
        />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>
  `,
})
export class AppRailComponent {
  activeView = input.required<string>();
  viewChange = output<string>();

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
