import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DayRhythmService } from '../../services/day-rhythm.service';
import { pickMorningQuestion, pickEveningQuestion } from '../../data/daily-questions';

const GERMAN_WEEKDAYS = [
  'Sonntag', 'Montag', 'Dienstag', 'Mittwoch',
  'Donnerstag', 'Freitag', 'Samstag',
];

const GERMAN_MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function formatGermanDate(): string {
  const now = new Date();
  return `${GERMAN_WEEKDAYS[now.getDay()]}, ${now.getDate()}. ${GERMAN_MONTHS[now.getMonth()]}`;
}

@Component({
  selector: 'app-rhythm-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  host: {
    class: 'block h-full',
    '(keydown.escape)': 'onEscape()',
  },
  styles: `
    @keyframes fadeSlideUp {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-20px); }
    }
    @keyframes circlePop {
      0% { transform: scale(0.5); opacity: 0; }
      70% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes checkDraw {
      from { stroke-dashoffset: 44; }
      to { stroke-dashoffset: 0; }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .anim-fade-slide-up {
      animation: fadeSlideUp 400ms ease-out forwards;
    }
    .anim-circle-pop {
      animation: circlePop 400ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    .anim-check-draw {
      animation: checkDraw 350ms ease-out forwards;
    }
    .anim-text-fade-in {
      animation: fadeIn 400ms ease-out forwards;
    }
    .anim-fade-out {
      animation: fadeOut 400ms ease-out forwards;
    }
    .anim-readonly-in {
      animation: fadeInUp 400ms ease-out forwards;
    }
  `,
  template: `
    @switch (viewState()) {
      @case ('input') {
        <div class="h-full flex items-start justify-center pt-12 px-6">
          <div class="w-full max-w-[460px]">
            <header class="mb-8 text-center">
              @if (isMorning()) {
                <svg class="w-9 h-9 text-indigo-400 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
                </svg>
              } @else {
                <svg class="w-9 h-9 text-amber-500 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                </svg>
              }
              <h1 class="text-xl font-semibold text-stone-900">
                {{ isMorning() ? 'Tagesfokus' : 'Tagesreflektion' }}
              </h1>
              <p class="text-sm text-stone-400 mt-1">{{ formattedDate() }}</p>
            </header>

            @if (!isMorning()) {
              @if (entry()?.morningFocus) {
                <div class="mb-6 border-l-[3px] border-indigo-300 pl-4">
                  <p class="font-serif italic text-xs text-indigo-400 mb-1">{{ entry()!.morningQuestion }}</p>
                  <p class="font-serif italic text-base text-stone-600 leading-relaxed">{{ entry()!.morningFocus }}</p>
                </div>
              }
              <div class="mb-8">
                @if (completedItems().length > 0) {
                  <h2 class="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">Heute geschafft</h2>
                  <ul class="space-y-2" role="list">
                    @for (item of completedItems(); track item.id) {
                      <li class="flex items-center gap-2 text-sm text-stone-600">
                        <svg class="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <path d="M20 6 9 17l-5-5"/>
                        </svg>
                        {{ item.title }}
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="text-sm text-stone-400 font-serif italic">
                    Kein Problem — nicht jeder Tag ist ein Produktivitätstag.
                  </p>
                }
              </div>
            }

            <div class="mb-6" [class]="isMorning() ? 'border-l-[3px] border-indigo-400 pl-4' : 'border-l-[3px] border-amber-400 pl-4'">
              <p [id]="questionId" class="font-serif italic text-lg text-stone-700">
                {{ question() }}
              </p>
            </div>

            <textarea
              class="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-stone-800 placeholder:text-stone-400 resize-none transition-shadow duration-150"
              [class]="isMorning() ? 'focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300' : 'focus:ring-2 focus:ring-amber-300 focus:border-amber-300'"
              rows="4"
              [placeholder]="isMorning() ? 'Dein Fokus für heute...' : 'Deine Gedanken zum Tag...'"
              [attr.aria-labelledby]="questionId"
              [(ngModel)]="textValue"
              data-testid="textarea"
            ></textarea>

            <div class="flex gap-3 mt-4">
              <button
                type="button"
                class="flex-1 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
                [class]="isMorning() ? 'bg-indigo-600 hover:bg-indigo-700 focus-visible:outline-indigo-500' : 'bg-stone-800 hover:bg-stone-900 focus-visible:outline-stone-600'"
                [disabled]="!textValue().trim()"
                (click)="onSubmit()"
                data-testid="btn-submit"
              >
                {{ isMorning() ? 'Fokus setzen' : 'Abschließen' }}
              </button>
              <button
                type="button"
                class="rounded-xl px-5 py-2.5 text-sm font-medium text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400"
                (click)="onSkip()"
                data-testid="btn-skip"
              >
                Überspringen
              </button>
            </div>
          </div>
        </div>
      }
      @case ('animating') {
        <div class="h-full relative">
          @if (animPhase() === 'form-exit') {
            <div class="h-full flex items-start justify-center pt-12 px-6 anim-fade-slide-up">
              <div class="w-full max-w-[460px] opacity-50"></div>
            </div>
          }
          @if (animPhase() === 'circle' || animPhase() === 'check' || animPhase() === 'text' || animPhase() === 'hold' || animPhase() === 'fade-out') {
            <div
              class="absolute inset-0 flex flex-col items-center justify-center"
              [class]="animPhase() === 'fade-out' ? 'anim-fade-out' : ''"
            >
              <div
                class="w-16 h-16 rounded-full flex items-center justify-center anim-circle-pop"
                [class]="isMorning() ? 'bg-indigo-600' : 'bg-stone-800'"
              >
                @if (animPhase() !== 'circle') {
                  <svg class="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" stroke-dasharray="44" class="anim-check-draw"/>
                  </svg>
                }
              </div>
              @if (animPhase() === 'text' || animPhase() === 'hold' || animPhase() === 'fade-out') {
                <p class="mt-4 font-serif text-lg text-stone-700 anim-text-fade-in">
                  {{ isMorning() ? 'Fokus gesetzt!' : 'Reflektion gespeichert!' }}
                </p>
              }
            </div>
          }
        </div>
      }
      @case ('readonly') {
        <div class="h-full flex items-start justify-center pt-12 px-6 anim-readonly-in">
          <div class="w-full max-w-[460px]">
            <header class="mb-8 text-center">
              @if (readonlyMorning()) {
                <svg class="w-9 h-9 text-indigo-400 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
                </svg>
                <h1 class="text-xl font-semibold text-stone-900">Tagesfokus</h1>
              } @else {
                <svg class="w-9 h-9 text-amber-500 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                </svg>
                <h1 class="text-xl font-semibold text-stone-900">Tagesreflektion</h1>
              }
              <p class="text-sm text-stone-400 mt-1">{{ formattedDate() }}</p>
            </header>

            @if (readonlyQuestion()) {
              <div class="mb-4" [class]="readonlyMorning() ? 'border-l-[3px] border-indigo-400 pl-4' : 'border-l-[3px] border-amber-400 pl-4'">
                <p class="font-serif italic text-sm text-stone-500">
                  {{ readonlyQuestion() }}
                </p>
              </div>
            }

            @if (readonlyAnswer()) {
              <div class="bg-stone-50 rounded-xl p-5 mb-6">
                <p class="font-serif italic text-base text-stone-700">
                  {{ readonlyAnswer() }}
                </p>
              </div>
            }

            @if (!readonlyMorning() && completedItems().length > 0) {
              <div class="mt-6">
                <h2 class="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">Heute geschafft</h2>
                <ul class="space-y-2" role="list">
                  @for (item of completedItems(); track item.id) {
                    <li class="flex items-center gap-2 text-sm text-stone-600">
                      <svg class="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                      {{ item.title }}
                    </li>
                  }
                </ul>
              </div>
            }
          </div>
        </div>
      }
    }
  `,
})
export class RhythmDetailComponent {
  submitted = output<void>();
  skipped = output<void>();

  private readonly rhythm = inject(DayRhythmService);

  readonly viewState = signal<'input' | 'animating' | 'readonly'>('input');
  readonly animPhase = signal<'form-exit' | 'circle' | 'check' | 'text' | 'hold' | 'fade-out'>('form-exit');
  readonly textValue = signal('');
  readonly question = signal('');
  readonly questionId = 'rhythm-question-label';

  readonly phase = computed(() => this.rhythm.rhythmPhase());
  readonly entry = computed(() => this.rhythm.todayEntry());

  readonly isMorning = computed(() => {
    const p = this.phase();
    return p === 'morning-open' || p === 'morning-filled';
  });

  readonly readonlyMorning = computed(() => {
    return this.phase() === 'morning-filled' || this.phase() === 'morning-open';
  });

  readonly readonlyQuestion = computed(() => {
    const e = this.entry();
    if (!e) return null;
    return this.readonlyMorning() ? e.morningQuestion : e.eveningQuestion;
  });

  readonly readonlyAnswer = computed(() => {
    const e = this.entry();
    if (!e) return null;
    return this.readonlyMorning() ? e.morningFocus : e.eveningReflection;
  });

  readonly completedItems = computed(() => this.entry()?.completedItems ?? []);

  readonly formattedDate = computed(() => formatGermanDate());

  constructor() {
    this.syncViewState(this.rhythm.rhythmPhase());
    effect(() => {
      const phase = this.rhythm.rhythmPhase();
      untracked(() => this.syncViewState(phase));
    });
  }

  private syncViewState(phase: string): void {
    if (this.viewState() === 'animating') return;
    if (phase === 'morning-open') {
      this.question.set(pickMorningQuestion());
      this.textValue.set('');
      this.viewState.set('input');
    } else if (phase === 'evening-open') {
      this.question.set(pickEveningQuestion());
      this.textValue.set('');
      this.viewState.set('input');
    } else {
      this.viewState.set('readonly');
    }
  }

  onSubmit(): void {
    const value = this.textValue().trim();
    if (!value) return;

    const q = this.question();
    if (this.isMorning()) {
      this.rhythm.saveMorning(value, q);
    } else {
      this.rhythm.saveEvening(value, q);
    }

    this.submitted.emit();
    this.startAnimation();
  }

  onSkip(): void {
    if (this.isMorning()) {
      this.rhythm.skipMorning();
    } else {
      this.rhythm.skipEvening();
    }
    this.skipped.emit();
  }

  onEscape(): void {
    this.onSkip();
  }

  private startAnimation(): void {
    this.viewState.set('animating');
    this.animPhase.set('form-exit');

    setTimeout(() => this.animPhase.set('circle'), 400);
    setTimeout(() => this.animPhase.set('check'), 550);
    setTimeout(() => this.animPhase.set('text'), 1200);
    setTimeout(() => this.animPhase.set('hold'), 1400);
    setTimeout(() => this.rhythm.cardAnimationTrigger.update(v => v + 1), 1600);
    setTimeout(() => this.animPhase.set('fade-out'), 2600);
    setTimeout(() => this.viewState.set('readonly'), 3050);
  }
}
