import { ChangeDetectionStrategy, Component, inject, computed, signal, effect, OnDestroy } from '@angular/core';
import { PomodoroService } from '../../services/pomodoro.service';

const FOCUS_END_MESSAGES = [
  'Gut gemacht!',
  'Super Arbeit!',
  'Stark durchgehalten!',
  'Toll fokussiert!',
  'Klasse gemacht!',
];

const BREAK_SUGGESTIONS = [
  'Steh auf und streck dich kurz',
  'Trink ein Glas Wasser',
  'Schau kurz aus dem Fenster',
  'Mach ein paar tiefe Atemzüge',
  'Roll die Schultern ein paar Mal',
  'Steh auf und geh ein paar Schritte',
];

type OverlayState = 'hidden' | 'focus-end' | 'break-active' | 'break-end';

@Component({
  selector: 'app-pomodoro-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.hidden]': 'overlayState() === "hidden"' },
  template: `
    @switch (overlayState()) {
      @case ('focus-end') {
        <div class="fixed inset-0 bg-black/40 backdrop-blur-[3px] z-[60] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Fokuszeit beendet">
          <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div class="w-12 h-12 mx-auto mb-4 bg-amber-50 rounded-full flex items-center justify-center text-2xl">☀️</div>
            <h2 class="text-lg font-semibold text-stone-900 mb-1">{{ congratsMessage() }}</h2>
            <p class="text-sm text-stone-500 mb-5">{{ focusMinutes() }} Minuten Fokuszeit geschafft.</p>
            <div class="bg-indigo-50 rounded-lg px-4 py-2.5 mb-5 text-sm text-indigo-700">💡 {{ breakSuggestion() }}</div>
            <div class="flex flex-col gap-2">
              <button type="button"
                class="w-full rounded-xl bg-indigo-600 text-white py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
                (click)="startBreak()">
                Pause starten ({{ breakMinutes() }} Min)
              </button>
              <button type="button"
                class="w-full rounded-xl border border-stone-200 text-stone-500 py-2 text-sm hover:border-stone-300 hover:text-stone-700 transition-colors"
                (click)="snooze()">
                Noch 5 Minuten arbeiten
              </button>
            </div>
          </div>
        </div>
      }

      @case ('break-active') {
        <div class="fixed inset-0 z-[60] flex flex-col items-center justify-center"
          style="background: linear-gradient(135deg, #312e81 0%, #1e1b4b 40%, #0c0a09 100%)"
          role="dialog" aria-modal="true" aria-label="Pause">

          <div class="relative w-32 h-32 mb-8" aria-hidden="true">
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-300 to-indigo-600 opacity-30"
                style="animation: float 8s ease-in-out infinite;"></div>
            </div>
            <div class="absolute inset-0 flex items-center justify-center text-4xl"
              style="animation: float 8s ease-in-out infinite;">🧑‍🚀</div>
          </div>

          <p class="text-xl font-light text-indigo-100 mb-1 tracking-wide">Pause</p>
          <p class="text-xs text-indigo-300/40 mb-4 tracking-widest">schwerelos treiben lassen …</p>

          <div class="w-40 h-[3px] bg-white/10 rounded-full mb-3 overflow-hidden">
            <div class="h-full bg-gradient-to-r from-indigo-400 to-indigo-300 rounded-full transition-[width] duration-1000 ease-linear"
              [style.width.%]="breakProgress()"
              role="progressbar"
              [attr.aria-valuenow]="breakProgress()"
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
          </div>
          <p class="text-xs text-indigo-300/60 mb-6">noch {{ breakRemainingMinutes() }} Minuten</p>

          <div class="bg-white/5 rounded-xl px-5 py-2.5 text-sm text-indigo-200 mb-8">💡 {{ breakSuggestion() }}</div>

          <button type="button"
            class="text-xs text-indigo-300/40 border border-indigo-300/15 rounded-lg px-4 py-1.5 hover:text-indigo-200 hover:border-indigo-300/30 transition-colors"
            (click)="cancelBreak()">
            Pause beenden
          </button>
        </div>
      }

      @case ('break-end') {
        <div class="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[60] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Pause beendet">
          <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div class="w-12 h-12 mx-auto mb-4 bg-emerald-50 rounded-full flex items-center justify-center text-2xl">🚀</div>
            <h2 class="text-lg font-semibold text-stone-900 mb-1">Pause vorbei!</h2>
            <p class="text-sm text-stone-500 mb-5">Bereit für die nächste Runde?</p>
            <div class="flex flex-col gap-2">
              <button type="button"
                class="w-full rounded-xl bg-indigo-600 text-white py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
                (click)="startNewRound()">
                Neue Fokuszeit starten
              </button>
              <button type="button"
                class="w-full rounded-xl border border-stone-200 text-stone-500 py-2 text-sm hover:border-stone-300 hover:text-stone-700 transition-colors"
                (click)="finish()">
                Fertig für jetzt
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
  styles: [`
    @keyframes float {
      0%, 100% { transform: translateY(0) rotate(-3deg); }
      25% { transform: translateY(-6px) rotate(0deg); }
      50% { transform: translateY(2px) rotate(3deg); }
      75% { transform: translateY(-3px) rotate(1deg); }
    }
    :host.hidden { display: none; }

    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: 0.01ms !important; }
    }
  `],
})
export class PomodoroOverlayComponent implements OnDestroy {
  private readonly pomodoro = inject(PomodoroService);
  private chimeAudio: HTMLAudioElement | null = null;

  readonly overlayState = signal<OverlayState>('hidden');
  readonly congratsMessage = signal(this.pickRandom(FOCUS_END_MESSAGES));
  readonly breakSuggestion = signal(this.pickRandom(BREAK_SUGGESTIONS));
  readonly focusMinutes = computed(() => this.pomodoro.focusMinutes());
  readonly breakMinutes = computed(() => this.pomodoro.breakMinutes());
  readonly breakProgress = computed(() => {
    if (this.pomodoro.state() !== 'break') return 0;
    return Math.round(this.pomodoro.progress() * 100);
  });
  readonly breakRemainingMinutes = computed(() => Math.ceil(this.pomodoro.remainingMinutes()));

  constructor() {
    effect(() => {
      const state = this.pomodoro.state();
      const complete = this.pomodoro.isComplete();

      if (state === 'running' && complete) {
        this.congratsMessage.set(this.pickRandom(FOCUS_END_MESSAGES));
        this.breakSuggestion.set(this.pickRandom(BREAK_SUGGESTIONS));
        this.overlayState.set('focus-end');
        this.playChime();
      } else if (state === 'break' && complete) {
        this.overlayState.set('break-end');
        this.playSoftChime();
      } else if (state === 'break' && !complete) {
        if (this.overlayState() !== 'break-active') {
          this.overlayState.set('break-active');
        }
      } else if (state === 'idle') {
        this.overlayState.set('hidden');
      } else if (state === 'running' && !complete) {
        this.overlayState.set('hidden');
      }
    });
  }

  ngOnDestroy(): void {
    this.chimeAudio?.pause();
  }

  startBreak(): void {
    this.pomodoro.startBreak();
  }

  snooze(): void {
    this.pomodoro.snooze();
    this.overlayState.set('hidden');
  }

  cancelBreak(): void {
    this.pomodoro.finishBreak();
  }

  startNewRound(): void {
    this.pomodoro.startNewRound();
  }

  finish(): void {
    this.pomodoro.finishBreak();
  }

  private playChime(): void {
    try {
    } catch {}
  }

  private playSoftChime(): void {
    try {
    } catch {}
  }

  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
