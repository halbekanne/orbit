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
        <div class="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden"
          style="background: linear-gradient(135deg, #312e81 0%, #1e1b4b 40%, #0c0a09 100%)"
          role="dialog" aria-modal="true" aria-label="Pause">

          <div class="astro-stars" aria-hidden="true">
            <div class="star star-1"></div>
            <div class="star star-2"></div>
            <div class="star star-3"></div>
            <div class="star star-4"></div>
            <div class="star star-5"></div>
            <div class="star star-6"></div>
            <div class="star star-7"></div>
            <div class="star star-8"></div>
            <div class="star star-9"></div>
            <div class="star star-10"></div>
            <div class="star star-11"></div>
            <div class="nebula nebula-1"></div>
            <div class="nebula nebula-2"></div>
            <div class="earth-glow"></div>
          </div>

          <div class="astro-scene" aria-hidden="true">
            <div class="astro-tether"></div>
            <div class="astro-body">
              <div class="astro-leg astro-leg-l"></div>
              <div class="astro-leg astro-leg-r"></div>
              <div class="astro-torso">
                <div class="astro-panel">
                  <div class="astro-light astro-light-1"></div>
                  <div class="astro-light astro-light-2"></div>
                </div>
              </div>
              <div class="astro-arm astro-arm-l">
                <div class="astro-hand"></div>
              </div>
              <div class="astro-arm astro-arm-r">
                <div class="astro-hand"></div>
              </div>
              <div class="astro-helmet">
                <div class="astro-visor">
                  <div class="astro-visor-shine"></div>
                </div>
              </div>
              <div class="astro-backpack"></div>
            </div>
          </div>

          <p class="relative z-10 text-xl font-light text-indigo-100 mb-1 tracking-wide">Pause</p>
          <p class="relative z-10 text-xs text-indigo-300/40 mb-4 tracking-widest">schwerelos treiben lassen …</p>

          <div class="relative z-10 w-40 h-[3px] bg-white/10 rounded-full mb-3 overflow-hidden">
            <div class="h-full bg-gradient-to-r from-indigo-400 to-indigo-300 rounded-full transition-[width] duration-1000 ease-linear"
              [style.width.%]="breakProgress()"
              role="progressbar"
              [attr.aria-valuenow]="breakProgress()"
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
          </div>
          <p class="relative z-10 text-xs text-indigo-300/60 mb-6">noch {{ breakRemainingMinutes() }} Minuten</p>

          <div class="relative z-10 bg-white/5 rounded-xl px-5 py-2.5 text-sm text-indigo-200 mb-8">💡 {{ breakSuggestion() }}</div>

          <button type="button"
            class="relative z-10 text-xs text-indigo-300/40 border border-indigo-300/15 rounded-lg px-4 py-1.5 hover:text-indigo-200 hover:border-indigo-300/30 transition-colors"
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
    :host.hidden { display: none; }

    /* --- Stars & background --- */
    .astro-stars {
      position: absolute; inset: 0; pointer-events: none; overflow: hidden;
    }
    .star {
      position: absolute; border-radius: 50%; background: #c7d2fe;
    }
    .star-1  { width: 3px; height: 3px; top: 8%;  left: 12%; animation: twinkle-a 4s ease-in-out infinite; }
    .star-2  { width: 2px; height: 2px; top: 22%; left: 25%; animation: twinkle-b 5.5s ease-in-out infinite 0.5s; }
    .star-3  { width: 3px; height: 3px; top: 6%;  left: 42%; animation: twinkle-a 6s ease-in-out infinite 1s; }
    .star-4  { width: 2px; height: 2px; top: 15%; left: 63%; animation: twinkle-b 4.2s ease-in-out infinite 1.5s; }
    .star-5  { width: 3px; height: 3px; top: 10%; left: 78%; animation: twinkle-a 5s ease-in-out infinite 2s; }
    .star-6  { width: 2px; height: 2px; top: 30%; left: 88%; animation: twinkle-b 6s ease-in-out infinite 0.3s; }
    .star-7  { width: 2px; height: 2px; top: 55%; left: 8%;  animation: twinkle-a 4.5s ease-in-out infinite 0.8s; }
    .star-8  { width: 3px; height: 3px; top: 65%; left: 18%; animation: twinkle-b 5s ease-in-out infinite 2.5s; }
    .star-9  { width: 2px; height: 2px; top: 60%; left: 82%; animation: twinkle-a 5.5s ease-in-out infinite 1.2s; }
    .star-10 { width: 2px; height: 2px; top: 72%; left: 70%; animation: twinkle-b 4s ease-in-out infinite 3s; }
    .star-11 { width: 3px; height: 3px; top: 40%; left: 93%; animation: twinkle-a 6.5s ease-in-out infinite 0.6s; }

    .nebula {
      position: absolute; border-radius: 50%; filter: blur(40px);
    }
    .nebula-1 {
      width: 200px; height: 100px; top: 20%; left: 10%;
      background: rgba(99, 102, 241, 0.06);
      animation: drift 22s ease-in-out infinite;
    }
    .nebula-2 {
      width: 250px; height: 120px; top: 55%; right: 5%;
      background: rgba(129, 140, 248, 0.04);
      animation: drift 28s ease-in-out infinite reverse;
    }
    .earth-glow {
      position: absolute; bottom: -60px; left: 50%; transform: translateX(-50%);
      width: 500px; height: 120px; border-radius: 50%;
      background: radial-gradient(ellipse, rgba(59, 130, 246, 0.12) 0%, transparent 70%);
      animation: earth-pulse 8s ease-in-out infinite;
    }

    /* --- Astronaut scene --- */
    .astro-scene {
      position: relative; z-index: 10; width: 140px; height: 180px; margin-bottom: 20px;
      animation: float 10s ease-in-out infinite;
    }
    .astro-tether {
      position: absolute; bottom: -10px; left: 50%; width: 2px; height: 50px;
      background: linear-gradient(to bottom, rgba(129, 140, 248, 0.4), transparent);
      transform: translateX(-50%) rotate(8deg);
      border-radius: 1px;
    }
    .astro-body {
      position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
      width: 100px; height: 140px;
    }

    /* --- Torso --- */
    .astro-torso {
      position: absolute; top: 44px; left: 50%; transform: translateX(-50%);
      width: 52px; height: 56px; border-radius: 14px;
      background: #d6d3d1; border: 2px solid #a8a29e;
    }
    .astro-panel {
      position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
      width: 22px; height: 14px; border-radius: 4px;
      background: #4338ca;
    }
    .astro-light {
      position: absolute; top: 5px; border-radius: 50%;
    }
    .astro-light-1 {
      left: 5px; width: 4px; height: 4px; background: #818cf8;
      animation: blink 3s ease-in-out infinite;
    }
    .astro-light-2 {
      right: 5px; width: 4px; height: 4px; background: #a5b4fc;
      animation: blink 3s ease-in-out infinite 1.5s;
    }

    /* --- Helmet --- */
    .astro-helmet {
      position: absolute; top: 0; left: 50%; transform: translateX(-50%);
      width: 48px; height: 48px; border-radius: 50%;
      background: #d6d3d1; border: 2px solid #a8a29e;
    }
    .astro-visor {
      position: absolute; top: 6px; left: 6px; right: 6px; bottom: 8px;
      border-radius: 50%;
      background: linear-gradient(135deg, #312e81, #0f0a1a);
    }
    .astro-visor-shine {
      position: absolute; top: 5px; left: 6px;
      width: 10px; height: 7px; border-radius: 50%;
      background: rgba(165, 180, 252, 0.25);
      transform: rotate(-20deg);
    }

    /* --- Backpack --- */
    .astro-backpack {
      position: absolute; top: 48px; right: 8px;
      width: 14px; height: 32px; border-radius: 5px;
      background: #a8a29e; border: 1.5px solid #78716c;
    }

    /* --- Arms --- */
    .astro-arm {
      position: absolute; top: 50px;
      width: 32px; height: 12px; border-radius: 6px;
      background: #d6d3d1; border: 1.5px solid #a8a29e;
    }
    .astro-hand {
      position: absolute; top: -1px;
      width: 12px; height: 12px; border-radius: 50%;
      background: #d6d3d1; border: 1.5px solid #a8a29e;
    }
    .astro-arm-l {
      left: -4px; transform-origin: right center;
      animation: arm-wave 10s ease-in-out infinite;
    }
    .astro-arm-l .astro-hand { left: -8px; }
    .astro-arm-r {
      right: -4px; transform-origin: left center;
      animation: arm-drift 12s ease-in-out infinite;
    }
    .astro-arm-r .astro-hand { right: -8px; }

    /* --- Legs --- */
    .astro-leg {
      position: absolute; top: 94px;
      width: 12px; height: 36px; border-radius: 6px;
      background: #d6d3d1; border: 1.5px solid #a8a29e;
    }
    .astro-leg-l {
      left: 26px; transform-origin: top center;
      animation: leg-dangle-l 11s ease-in-out infinite;
    }
    .astro-leg-r {
      right: 26px; transform-origin: top center;
      animation: leg-dangle-r 13s ease-in-out infinite;
    }

    /* --- Keyframes --- */
    @keyframes float {
      0%, 100% { transform: translateY(0) rotate(-2deg); }
      30% { transform: translateY(-12px) rotate(1deg); }
      60% { transform: translateY(4px) rotate(-3deg); }
      80% { transform: translateY(-6px) rotate(0deg); }
    }
    @keyframes arm-wave {
      0%, 100% { transform: rotate(-15deg); }
      15% { transform: rotate(-50deg); }
      25% { transform: rotate(-35deg); }
      35% { transform: rotate(-55deg); }
      50% { transform: rotate(-20deg); }
      70% { transform: rotate(-10deg); }
    }
    @keyframes arm-drift {
      0%, 100% { transform: rotate(15deg); }
      40% { transform: rotate(25deg); }
      70% { transform: rotate(10deg); }
    }
    @keyframes leg-dangle-l {
      0%, 100% { transform: rotate(5deg); }
      50% { transform: rotate(-8deg); }
    }
    @keyframes leg-dangle-r {
      0%, 100% { transform: rotate(-4deg); }
      50% { transform: rotate(7deg); }
    }
    @keyframes blink {
      0%, 40%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    @keyframes twinkle-a {
      0%, 100% { opacity: 0.7; transform: scale(1); }
      50% { opacity: 0.15; transform: scale(0.5); }
    }
    @keyframes twinkle-b {
      0%, 100% { opacity: 0.4; }
      40% { opacity: 0.9; }
      70% { opacity: 0.15; }
    }
    @keyframes drift {
      0%, 100% { transform: translate(0, 0); }
      33% { transform: translate(15px, -10px); }
      66% { transform: translate(-10px, 12px); }
    }
    @keyframes earth-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
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
