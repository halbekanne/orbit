import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SettingsService } from './settings.service';

export type PomodoroState = 'idle' | 'running' | 'break';

interface PomodoroSession {
  state: PomodoroState;
  startedAt: number;
  focusMinutes: number;
  breakMinutes: number;
  breakStartedAt: number | null;
}

interface PomodoroDefaults {
  focusMinutes: number;
  breakMinutes: number;
}

const SESSION_KEY = 'orbit.pomodoro.session';

@Injectable({ providedIn: 'root' })
export class PomodoroService {
  private readonly settingsService = inject(SettingsService);
  private readonly session = signal<PomodoroSession | null>(this.loadSession());
  private readonly defaults = signal<PomodoroDefaults>(this.loadDefaults());
  readonly tick = signal(Date.now());
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  readonly state = computed<PomodoroState>(() => this.session()?.state ?? 'idle');
  readonly startedAt = computed(() => this.session()?.startedAt ?? null);
  readonly focusMinutes = computed(() => this.session()?.focusMinutes ?? 0);
  readonly breakMinutes = computed(() => this.session()?.breakMinutes ?? 0);
  readonly defaultFocusMinutes = computed(() => this.defaults().focusMinutes);
  readonly defaultBreakMinutes = computed(() => this.defaults().breakMinutes);

  readonly elapsedMs = computed(() => {
    this.tick();
    const s = this.session();
    if (!s) return 0;
    if (s.state === 'break' && s.breakStartedAt) {
      return Date.now() - s.breakStartedAt;
    }
    return Date.now() - s.startedAt;
  });

  readonly remainingMinutes = computed(() => {
    const s = this.session();
    if (!s) return 0;
    const totalMs = (s.state === 'break' ? s.breakMinutes : s.focusMinutes) * 60_000;
    const remaining = totalMs - this.elapsedMs();
    return Math.max(0, remaining / 60_000);
  });

  readonly progress = computed(() => {
    const s = this.session();
    if (!s) return 0;
    const totalMs = (s.state === 'break' ? s.breakMinutes : s.focusMinutes) * 60_000;
    if (totalMs === 0) return 0;
    return Math.min(1, this.elapsedMs() / totalMs);
  });

  readonly isComplete = computed(() => {
    const s = this.session();
    if (!s) return false;
    return this.progress() >= 1;
  });

  readonly timelineBlock = computed<{ startTime: string; endTime: string } | null>(() => {
    const s = this.session();
    if (!s || s.state !== 'running') return null;
    const startDate = new Date(s.startedAt);
    const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
    const endMinutes = startMinutes + s.focusMinutes;
    const startH = Math.floor(startMinutes / 60);
    const startM = startMinutes % 60;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    return {
      startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
      endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
    };
  });

  constructor() {
    effect(() => {
      const s = this.session();
      if (s) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    });

    this.recoverSession();
  }

  start(config: { focusMinutes: number; breakMinutes: number }): void {
    this.session.set({
      state: 'running',
      startedAt: Date.now(),
      focusMinutes: config.focusMinutes,
      breakMinutes: config.breakMinutes,
      breakStartedAt: null,
    });
    this.defaults.set(config);
    this.startTicking();
  }

  cancel(): void {
    this.session.set(null);
    this.stopTicking();
  }

  snooze(): void {
    const s = this.session();
    if (!s || s.state !== 'running') return;
    this.session.set({ ...s, focusMinutes: s.focusMinutes + 5 });
  }

  startBreak(): void {
    const s = this.session();
    if (!s) return;
    this.session.set({ ...s, state: 'break', breakStartedAt: Date.now() });
  }

  finishBreak(): void {
    this.session.set(null);
    this.stopTicking();
  }

  startNewRound(): void {
    const s = this.session();
    if (!s) return;
    const d = this.defaults();
    this.session.set({
      state: 'running',
      startedAt: Date.now(),
      focusMinutes: d.focusMinutes,
      breakMinutes: d.breakMinutes,
      breakStartedAt: null,
    });
  }

  private startTicking(): void {
    this.stopTicking();
    this.tickInterval = setInterval(() => this.tick.set(Date.now()), 1000);
  }

  private stopTicking(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private recoverSession(): void {
    const s = this.session();
    if (!s) return;

    const now = Date.now();
    if (s.state === 'running') {
      const elapsed = now - s.startedAt;
      if (elapsed >= s.focusMinutes * 60_000) {
        this.session.set(null);
        return;
      }
      this.startTicking();
    } else if (s.state === 'break') {
      if (!s.breakStartedAt) { this.session.set(null); return; }
      const elapsed = now - s.breakStartedAt;
      if (elapsed >= s.breakMinutes * 60_000) {
        this.session.set(null);
        return;
      }
      this.startTicking();
    }
  }

  private loadSession(): PomodoroSession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  private loadDefaults(): PomodoroDefaults {
    return {
      focusMinutes: this.settingsService.pomodoroDefaults().focusMinutes,
      breakMinutes: this.settingsService.pomodoroDefaults().breakMinutes,
    };
  }
}
