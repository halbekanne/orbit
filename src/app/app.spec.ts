import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { App } from './app';
import { SettingsService } from './settings/settings.service';

const mockMatchMedia = () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
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

const mockSettingsService = {
  loaded: signal(true),
  isConfigured: signal(true),
  settings: signal({} as never),
  theme: signal('system' as const),
  pomodoroEnabled: signal(true),
  aiReviewsEnabled: signal(false),
  dayCalendarEnabled: signal(true),
  pomodoroDefaults: signal({ focusMinutes: 25, breakMinutes: 5 }),
  jiraConfig: signal({ baseUrl: '', apiKey: '' }),
  bitbucketConfig: signal({ baseUrl: '', apiKey: '', userSlug: '' }),
  vertexAiConfig: signal({ url: '', customHeaders: [] }),
  load: () => Promise.resolve(),
  save: () => Promise.resolve(),
};

describe('App', () => {
  beforeEach(async () => {
    mockMatchMedia();
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should default to arbeit view', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance.routerSync.activeView()).toBe('arbeit');
  });

  it('should render the app rail', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const rail = fixture.nativeElement.querySelector('app-rail');
    expect(rail).toBeTruthy();
  });
});
