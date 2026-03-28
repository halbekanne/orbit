import { Injectable, effect, inject } from '@angular/core';
import { SettingsService } from './settings.service';

export type ThemePreference = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly settingsService = inject(SettingsService);
  private readonly mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  readonly preference = this.settingsService.theme;

  constructor() {
    effect(() => {
      this.applyTheme(this.preference());
    });

    this.mediaQuery.addEventListener('change', () => {
      if (this.preference() === 'system') {
        this.applyTheme('system');
      }
    });
  }

  private applyTheme(pref: ThemePreference) {
    const isDark = pref === 'dark' || (pref === 'system' && this.mediaQuery.matches);
    document.documentElement.classList.toggle('dark', isDark);
  }
}
