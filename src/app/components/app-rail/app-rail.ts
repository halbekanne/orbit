import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

interface OrbitView {
  id: string;
  label: string;
}

const VIEWS: OrbitView[] = [
  { id: 'arbeit', label: 'Arbeit' },
  { id: 'logbuch', label: 'Logbuch' },
];

@Component({
  selector: 'app-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'w-16 shrink-0 bg-[var(--color-rail-bg)] flex flex-col items-center',
  },
  template: `
    <div class="w-full h-12 flex items-center justify-center border-b border-white/[0.06]" aria-hidden="true">
      <div class="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center shadow-[0_0_12px_rgba(139,92,246,0.25)]">
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

    <div class="flex-1"></div>

    <div
      [attr.aria-label]="themeLabel()"
      class="w-10 h-10 mb-3 flex items-center justify-center rounded-lg text-stone-400"
    >
      @switch (theme.preference()) {
        @case ('light') {
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          </svg>
        }
        @case ('dark') {
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
          </svg>
        }
        @case ('system') {
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
          </svg>
        }
      }
    </div>
  `,
})
export class AppRailComponent {
  activeView = input.required<string>();
  viewChange = output<string>();

  protected readonly views = VIEWS;
  protected readonly theme = inject(ThemeService);

  protected readonly themeLabel = computed(() => {
    const labels = { system: 'Design: System', light: 'Design: Hell', dark: 'Design: Dunkel' };
    return labels[this.theme.preference()];
  });

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
