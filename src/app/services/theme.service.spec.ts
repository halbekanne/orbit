import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

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

  beforeEach(() => {
    mockMatchMedia(false);
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  it('should default to system preference when no stored value', () => {
    expect(service.preference()).toBe('system');
  });

  it('should apply dark class when set to dark', () => {
    service.setPreference('dark');
    TestBed.tick();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(service.preference()).toBe('dark');
  });

  it('should remove dark class when set to light', () => {
    document.documentElement.classList.add('dark');
    service.setPreference('light');
    TestBed.tick();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(service.preference()).toBe('light');
  });

  it('should persist preference to localStorage', () => {
    service.setPreference('dark');
    expect(localStorage.getItem('orbit-theme')).toBe('dark');
  });

  it('should cycle through system → light → dark → system', () => {
    expect(service.preference()).toBe('system');
    service.cycle();
    expect(service.preference()).toBe('light');
    service.cycle();
    expect(service.preference()).toBe('dark');
    service.cycle();
    expect(service.preference()).toBe('system');
  });

  it('should load stored preference on creation', () => {
    localStorage.setItem('orbit-theme', 'dark');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const freshService = TestBed.inject(ThemeService);
    expect(freshService.preference()).toBe('dark');
  });
});
