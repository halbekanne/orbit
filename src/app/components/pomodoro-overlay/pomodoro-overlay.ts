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

          <svg class="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8%" cy="12%" r="1.2" fill="white" style="animation: twinkle-a 4s ease-in-out infinite;" opacity="0.7"/>
            <circle cx="15%" cy="28%" r="0.8" fill="white" style="animation: twinkle-b 5.5s ease-in-out infinite;" opacity="0.5"/>
            <circle cx="25%" cy="8%" r="1.5" fill="white" style="animation: twinkle-a 6s ease-in-out infinite 1s;" opacity="0.6"/>
            <circle cx="38%" cy="18%" r="0.9" fill="white" style="animation: twinkle-b 4.5s ease-in-out infinite 0.5s;" opacity="0.8"/>
            <circle cx="52%" cy="6%" r="1.1" fill="white" style="animation: twinkle-a 5s ease-in-out infinite 2s;" opacity="0.5"/>
            <circle cx="63%" cy="22%" r="0.7" fill="white" style="animation: twinkle-b 4s ease-in-out infinite 1.5s;" opacity="0.7"/>
            <circle cx="72%" cy="10%" r="1.3" fill="white" style="animation: twinkle-a 6.5s ease-in-out infinite 0.3s;" opacity="0.6"/>
            <circle cx="83%" cy="30%" r="0.8" fill="white" style="animation: twinkle-b 5s ease-in-out infinite 2.5s;" opacity="0.4"/>
            <circle cx="91%" cy="16%" r="1" fill="white" style="animation: twinkle-a 4.5s ease-in-out infinite 1.2s;" opacity="0.7"/>
            <circle cx="7%" cy="55%" r="0.7" fill="white" style="animation: twinkle-b 5.5s ease-in-out infinite 0.8s;" opacity="0.4"/>
            <circle cx="18%" cy="70%" r="1" fill="white" style="animation: twinkle-a 4s ease-in-out infinite 3s;" opacity="0.5"/>
            <circle cx="78%" cy="60%" r="0.9" fill="white" style="animation: twinkle-b 6s ease-in-out infinite 0.6s;" opacity="0.6"/>
            <circle cx="88%" cy="72%" r="1.2" fill="white" style="animation: twinkle-a 5s ease-in-out infinite 1.8s;" opacity="0.4"/>
            <circle cx="95%" cy="45%" r="0.8" fill="white" style="animation: twinkle-b 4.5s ease-in-out infinite 2.2s;" opacity="0.6"/>
            <ellipse cx="20%" cy="35%" rx="80" ry="40" fill="#6366f1" opacity="0.04" style="animation: drift 20s ease-in-out infinite;"/>
            <ellipse cx="75%" cy="60%" rx="100" ry="50" fill="#818cf8" opacity="0.03" style="animation: drift 25s ease-in-out infinite reverse;"/>
            <ellipse cx="50%" cy="100%" rx="55%" ry="80" fill="none" stroke="#3b82f6" stroke-width="1" opacity="0.15" style="filter: blur(8px);"/>
            <ellipse cx="50%" cy="100%" rx="40%" ry="60" fill="#1d4ed8" opacity="0.08" style="filter: blur(16px);"/>
          </svg>

          <div class="relative z-10" style="animation: float 8s ease-in-out infinite;" aria-hidden="true">
            <svg width="120" height="150" viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" overflow="visible">
              <defs>
                <radialGradient id="helmetVisor" cx="40%" cy="35%" r="60%">
                  <stop offset="0%" stop-color="#312e81"/>
                  <stop offset="60%" stop-color="#1e1b4b"/>
                  <stop offset="100%" stop-color="#0c0a09"/>
                </radialGradient>
                <radialGradient id="helmetShell" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stop-color="#e2e8f0"/>
                  <stop offset="100%" stop-color="#94a3b8"/>
                </radialGradient>
                <radialGradient id="bodyGrad" cx="30%" cy="25%" r="75%">
                  <stop offset="0%" stop-color="#e2e8f0"/>
                  <stop offset="100%" stop-color="#94a3b8"/>
                </radialGradient>
                <radialGradient id="helmetGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#818cf8" stop-opacity="0.4"/>
                  <stop offset="100%" stop-color="#818cf8" stop-opacity="0"/>
                </radialGradient>
              </defs>

              <path d="M 60 145 Q 55 125 45 105" stroke="#6366f1" stroke-width="1.5" fill="none" stroke-dasharray="3 3" opacity="0.6"/>

              <rect x="35" y="70" width="50" height="52" rx="12" fill="url(#bodyGrad)"/>
              <rect x="37" y="72" width="46" height="48" rx="11" fill="none" stroke="#cbd5e1" stroke-width="0.5" opacity="0.5"/>

              <rect x="48" y="78" width="24" height="16" rx="4" fill="#4338ca"/>
              <rect x="50" y="80" width="20" height="12" rx="3" fill="#4f46e5"/>
              <circle cx="54" cy="86" r="2" fill="#818cf8" opacity="0.9"/>
              <circle cx="60" cy="84" r="1.5" fill="#a5b4fc" opacity="0.7"/>
              <circle cx="66" cy="86" r="2" fill="#818cf8" opacity="0.9"/>

              <g style="animation: wave 12s ease-in-out infinite; transform-origin: 35px 80px;">
                <rect x="16" y="72" width="22" height="12" rx="6" fill="url(#bodyGrad)" transform="rotate(-20, 35, 78)"/>
                <circle cx="16" cy="76" r="5.5" fill="url(#bodyGrad)"/>
                <circle cx="16" cy="76" r="4" fill="#cbd5e1"/>
              </g>

              <rect x="82" y="72" width="22" height="12" rx="6" fill="url(#bodyGrad)" transform="rotate(15, 85, 78)"/>
              <circle cx="104" cy="77" r="5.5" fill="url(#bodyGrad)"/>
              <circle cx="104" cy="77" r="4" fill="#cbd5e1"/>

              <rect x="43" y="118" width="14" height="28" rx="7" fill="url(#bodyGrad)" transform="rotate(-8, 50, 118)"/>
              <circle cx="46" cy="146" r="6" fill="url(#bodyGrad)"/>
              <circle cx="46" cy="146" r="4.5" fill="#cbd5e1"/>

              <rect x="63" y="118" width="14" height="28" rx="7" fill="url(#bodyGrad)" transform="rotate(8, 70, 118)"/>
              <circle cx="74" cy="146" r="6" fill="url(#bodyGrad)"/>
              <circle cx="74" cy="146" r="4.5" fill="#cbd5e1"/>

              <circle cx="60" cy="52" r="26" fill="url(#helmetShell)"/>
              <circle cx="60" cy="52" r="22" fill="url(#helmetVisor)"/>
              <circle cx="60" cy="52" r="22" fill="url(#helmetGlow)" opacity="0.5"/>
              <ellipse cx="52" cy="44" rx="6" ry="4" fill="white" opacity="0.12" transform="rotate(-20, 52, 44)"/>

              <circle cx="60" cy="52" r="26" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.6"/>

              <circle cx="38" cy="52" r="4" fill="#94a3b8" opacity="0.8"/>
              <circle cx="82" cy="52" r="4" fill="#94a3b8" opacity="0.8"/>

              <rect x="46" y="25" width="28" height="6" rx="3" fill="#94a3b8" opacity="0.7"/>
            </svg>
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
    @keyframes float {
      0%, 100% { transform: translateY(0) rotate(-3deg); }
      25% { transform: translateY(-10px) rotate(0deg); }
      50% { transform: translateY(4px) rotate(3deg); }
      75% { transform: translateY(-5px) rotate(1deg); }
    }
    @keyframes wave {
      0%, 100% { transform: rotate(0deg); }
      20% { transform: rotate(-35deg); }
      40% { transform: rotate(-20deg); }
      60% { transform: rotate(-35deg); }
      80% { transform: rotate(-10deg); }
    }
    @keyframes twinkle-a {
      0%, 100% { opacity: 0.7; transform: scale(1); }
      50% { opacity: 0.15; transform: scale(0.6); }
    }
    @keyframes twinkle-b {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      40% { opacity: 0.9; transform: scale(1.4); }
      70% { opacity: 0.2; transform: scale(0.7); }
    }
    @keyframes drift {
      0%, 100% { transform: translate(0, 0); }
      33% { transform: translate(12px, -8px); }
      66% { transform: translate(-8px, 10px); }
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
