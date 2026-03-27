import { Injectable, signal, effect } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'orbit-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly preference = signal<ThemePreference>(this.loadPreference());

  private mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    effect(() => {
      const pref = this.preference();
      this.applyTheme(pref);
    });

    this.mediaQuery.addEventListener('change', () => {
      if (this.preference() === 'system') {
        this.applyTheme('system');
      }
    });
  }

  setPreference(pref: ThemePreference) {
    this.preference.set(pref);
    if (pref === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  }

  cycle() {
    const order: ThemePreference[] = ['system', 'light', 'dark'];
    const current = order.indexOf(this.preference());
    this.setPreference(order[(current + 1) % order.length]);
  }

  private loadPreference(): ThemePreference {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return 'system';
  }

  private applyTheme(pref: ThemePreference) {
    const isDark = pref === 'dark' || (pref === 'system' && this.mediaQuery.matches);
    document.documentElement.classList.toggle('dark', isDark);
  }
}
