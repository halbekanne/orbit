import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { SettingsService } from './settings.service';
import { signal } from '@angular/core';

const mockMatchMedia = (matches = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
};

describe('ThemeService', () => {
  let service: ThemeService;
  const themeSignal = signal<'light' | 'dark' | 'system'>('system');

  const mockSettingsService = {
    theme: themeSignal,
  };

  beforeEach(() => {
    mockMatchMedia(false);
    themeSignal.set('system');
    document.documentElement.classList.remove('dark');
    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });
    service = TestBed.inject(ThemeService);
  });

  it('should default to system preference', () => {
    expect(service.preference()).toBe('system');
  });

  it('should apply dark class when theme is dark', () => {
    themeSignal.set('dark');
    TestBed.tick();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should remove dark class when theme is light', () => {
    document.documentElement.classList.add('dark');
    themeSignal.set('light');
    TestBed.tick();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should reflect the settings service theme signal', () => {
    themeSignal.set('dark');
    expect(service.preference()).toBe('dark');
    themeSignal.set('light');
    expect(service.preference()).toBe('light');
  });
});
