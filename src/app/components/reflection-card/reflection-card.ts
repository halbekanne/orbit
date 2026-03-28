import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DailyReflectionService } from '../../services/daily-reflection.service';

const GERMAN_WEEKDAYS = [
  'Sonntag', 'Montag', 'Dienstag', 'Mittwoch',
  'Donnerstag', 'Freitag', 'Samstag',
];

@Component({
  selector: 'app-reflection-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  styles: `
    @keyframes gentlePulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(167, 139, 250, 0); }
      50% { box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.15); }
    }
    @keyframes gentlePulseAmber {
      0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
      50% { box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.15); }
    }
    @media (prefers-reduced-motion: reduce) {
      :host { --pulse-animation: none !important; }
    }
  `,
  template: `
    <button
      type="button"
      class="group relative w-full text-left rounded-[10px] overflow-hidden transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-solid)]"
      [class]="cardClass()"
      [style.animation]="pulseAnimation()"
      [style.animation-play-state]="hovered() ? 'paused' : 'running'"
      (mouseenter)="hovered.set(true)"
      (mouseleave)="hovered.set(false)"
      (click)="select.emit()"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="ariaLabel()"
    >
      <!-- Left stripe -->
      <div
        class="absolute left-0 top-0 bottom-0 w-1 transition-opacity duration-150"
        [class]="stripeClass()"
        aria-hidden="true"
      ></div>

      <!-- Card content -->
      <div
        #cardContent
        class="pl-4 pr-3 pt-2.5 pb-2.5 transition-opacity duration-250"
        [style.opacity]="animating() ? 0 : 1"
      >
        @switch (displayPhase()) {
          @case ('morning-open') {
            <div class="flex items-start justify-between gap-2 mb-1">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary-solid)]">Tagesfokus</span>
              <span class="text-xs text-[var(--color-text-muted)]">{{ weekday() }}</span>
            </div>
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-[var(--color-primary-solid)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
              </svg>
              <span class="text-sm text-[var(--color-primary-text)] font-medium">Fokus setzen &rarr;</span>
            </div>
          }
          @case ('morning-filled') {
            <div class="flex items-start justify-between gap-2 mb-1">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary-solid)]">Tagesfokus</span>
              <span class="text-xs text-[var(--color-text-muted)]">{{ weekday() }}</span>
            </div>
            <div class="flex items-start gap-2">
              <svg class="w-4 h-4 text-[var(--color-primary-solid)] shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
              </svg>
              <div class="min-w-0">
                @if (displayEntry()?.morningQuestion) {
                  <p class="font-serif italic text-xs text-[var(--color-text-muted)] mb-0.5">{{ displayEntry()!.morningQuestion }}</p>
                }
                @if (displayEntry()?.morningFocus) {
                  <p class="font-serif italic text-[13px] text-[var(--color-text-body)] line-clamp-2">{{ displayEntry()!.morningFocus }}</p>
                }
              </div>
            </div>
          }
          @case ('evening-open') {
            <div class="flex items-start justify-between gap-2 mb-1">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Tagesreflektion</span>
              <span class="text-xs text-[var(--color-text-muted)]">{{ weekday() }}</span>
            </div>
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              </svg>
              <span class="text-sm text-amber-700 font-medium">Tag reflektieren &rarr;</span>
            </div>
          }
          @case ('evening-filled') {
            <div class="flex items-start justify-between gap-2 mb-1">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Tag abgeschlossen</span>
              <span class="text-xs text-[var(--color-text-muted)]">{{ weekday() }}</span>
            </div>
            <div class="flex items-start gap-2">
              <svg class="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
              <div class="min-w-0">
                @if (displayEntry()?.eveningQuestion) {
                  <p class="font-serif italic text-xs text-[var(--color-text-muted)] mb-0.5">{{ displayEntry()!.eveningQuestion }}</p>
                }
                @if (displayEntry()?.eveningReflection) {
                  <p class="font-serif italic text-[13px] text-[var(--color-text-body)] line-clamp-2">{{ displayEntry()!.eveningReflection }}</p>
                }
                @if (completionChips().length) {
                  <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    @for (chip of completionChips(); track chip.label) {
                      <span
                        class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border leading-none"
                        [class]="chip.cls"
                      >{{ chip.label }}</span>
                    }
                  </div>
                }
              </div>
            </div>
          }
        }
      </div>

      <!-- Stripe-expand overlay -->
      <div
        #stripeOverlay
        class="absolute left-0 top-0 bottom-0 flex items-center justify-center pointer-events-none"
        style="transition: width 300ms ease-in-out, opacity 200ms ease"
        [class]="animating() ? 'z-10' : '-z-10'"
        [style.width]="animating() ? overlayWidth() : '4px'"
        [style.opacity]="animating() ? 1 : 0"
        [class.bg-violet-500]="displayPhase() === 'morning-open' || displayPhase() === 'morning-filled'"
        [class.bg-stone-800]="displayPhase() === 'evening-open' || displayPhase() === 'evening-filled'"
        aria-hidden="true"
      >
        <svg
          #checkmark
          class="w-6 h-6 text-white"
          [style.opacity]="checkmarkVisible() ? 1 : 0"
          [style.display]="checkmarkHidden() ? 'none' : 'block'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M5 13l4 4L19 7"
            [attr.stroke-dasharray]="36"
            [attr.stroke-dashoffset]="checkmarkVisible() ? 0 : 36"
            style="transition: stroke-dashoffset 350ms ease-out"
          />
        </svg>
      </div>
    </button>
  `,
})
export class ReflectionCardComponent {
  selected = input(false);
  select = output<void>();

  private readonly reflection = inject(DailyReflectionService);

  readonly phase = computed(() => this.reflection.reflectionPhase());
  readonly displayPhase = signal(this.reflection.reflectionPhase());
  readonly displayEntry = signal(this.reflection.todayEntry());
  readonly weekday = computed(() => GERMAN_WEEKDAYS[new Date().getDay()]);

  readonly hovered = signal(false);
  readonly animating = signal(false);

  constructor() {
    effect(() => {
      const p = this.reflection.reflectionPhase();
      const e = this.reflection.todayEntry();
      if (!untracked(() => this.animating())) {
        untracked(() => {
          this.displayPhase.set(p);
          this.displayEntry.set(e);
        });
      }
    });

    let lastTrigger = this.reflection.cardAnimationTrigger();
    effect(() => {
      const trigger = this.reflection.cardAnimationTrigger();
      if (trigger > lastTrigger) {
        lastTrigger = trigger;
        untracked(() => this.playSubmitAnimation());
      }
    });
  }
  readonly overlayWidth = signal('4px');
  readonly checkmarkVisible = signal(false);
  readonly checkmarkHidden = signal(true);

  private readonly stripeOverlay = viewChild<ElementRef<HTMLDivElement>>('stripeOverlay');
  private readonly checkmarkEl = viewChild<ElementRef<SVGElement>>('checkmark');

  readonly completionChips = computed(() => {
    const items = this.displayEntry()?.completedItems ?? [];
    const chips: { label: string; cls: string }[] = [];
    const todos = items.filter(i => i.type === 'todo' || i.type === 'ticket').length;
    const prs = items.filter(i => i.type === 'pr').length;
    if (todos > 0) {
      chips.push({
        label: `${todos} Aufgabe${todos > 1 ? 'n' : ''}`,
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      });
    }
    if (prs > 0) {
      chips.push({
        label: `${prs} PR`,
        cls: 'bg-[var(--color-primary-bg)] text-[var(--color-primary-text)] border-[var(--color-primary-border)]',
      });
    }
    return chips;
  });

  readonly cardClass = computed(() => {
    if (this.selected()) {
      return 'bg-[var(--color-card-selected-bg)] shadow-sm ring-1 ring-[var(--color-card-selected-ring)]';
    }
    switch (this.displayPhase()) {
      case 'morning-open':
        return 'bg-[var(--color-bg-card)] ring-1 ring-[var(--color-primary-border)] hover:ring-[var(--color-primary-solid)]';
      case 'morning-filled':
        return 'bg-[var(--color-bg-card)] ring-1 ring-[var(--color-primary-border)] hover:ring-[var(--color-primary-solid)]';
      case 'evening-open':
        return 'bg-[var(--color-bg-card)] ring-1 ring-amber-300 dark:ring-amber-500/30 hover:ring-amber-400 dark:hover:ring-amber-500/50';
      case 'evening-filled':
        return 'bg-[var(--color-bg-card)] ring-1 ring-[var(--color-border-subtle)] hover:ring-[var(--color-border-default)]';
      default:
        return 'bg-[var(--color-bg-card)] ring-1 ring-[var(--color-border-subtle)]';
    }
  });

  readonly stripeClass = computed(() => {
    switch (this.displayPhase()) {
      case 'morning-open':
        return 'bg-gradient-to-b from-violet-400 to-violet-300';
      case 'morning-filled':
        return 'bg-violet-400';
      case 'evening-open':
        return 'bg-gradient-to-b from-amber-400 to-amber-300';
      case 'evening-filled':
        return 'bg-gradient-to-b from-violet-400 to-amber-400';
      default:
        return 'bg-stone-300';
    }
  });

  readonly pulseAnimation = computed(() => {
    const phase = this.displayPhase();
    if (phase === 'morning-open') return 'var(--pulse-animation, gentlePulse 3s ease-in-out infinite)';
    if (phase === 'evening-open') return 'var(--pulse-animation, gentlePulseAmber 3s ease-in-out infinite)';
    return 'none';
  });

  readonly ariaLabel = computed(() => {
    switch (this.displayPhase()) {
      case 'morning-open':
        return 'Tagesfokus setzen';
      case 'morning-filled':
        return `Tagesfokus: ${this.displayEntry()?.morningFocus ?? ''}`;
      case 'evening-open':
        return 'Tagesreflektion starten';
      case 'evening-filled':
        return `Tag abgeschlossen: ${this.displayEntry()?.eveningReflection ?? ''}`;
      default:
        return 'Tagesfokus';
    }
  });

  playSubmitAnimation(): void {
    this.animating.set(true);
    this.checkmarkHidden.set(true);
    this.checkmarkVisible.set(false);
    this.overlayWidth.set('4px');

    setTimeout(() => {
      this.overlayWidth.set('100%');
    }, 50);

    setTimeout(() => {
      this.displayPhase.set(this.reflection.reflectionPhase());
      this.displayEntry.set(this.reflection.todayEntry());
    }, 350);

    setTimeout(() => {
      this.checkmarkHidden.set(false);
      requestAnimationFrame(() => {
        this.checkmarkVisible.set(true);
      });
    }, 400);

    setTimeout(() => {
      this.checkmarkVisible.set(false);
      setTimeout(() => {
        this.checkmarkHidden.set(true);
      }, 250);
    }, 1100);

    setTimeout(() => {
      this.overlayWidth.set('4px');
    }, 1400);

    setTimeout(() => {
      this.animating.set(false);
    }, 1700);
  }
}
