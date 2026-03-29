import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SettingsService } from './settings.service';
import { createDefaultSettings } from './settings.model';

describe('SettingsService', () => {
  let service: SettingsService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SettingsService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
  });

  it('should start with defaults and not configured', () => {
    expect(service.isConfigured()).toBe(false);
    expect(service.loaded()).toBe(false);
    expect(service.settings()).toEqual(createDefaultSettings());
  });

  it('should load status and settings when configured', async () => {
    const settings = {
      ...createDefaultSettings(),
      connections: {
        ...createDefaultSettings().connections,
        jira: { baseUrl: 'https://jira.test', apiKey: 'key' },
        bitbucket: { baseUrl: 'https://bb.test', apiKey: 'key', userSlug: 'user' },
      },
    };

    const loadPromise = service.load();
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/settings/status'))
      .flush({ configured: true });
    await Promise.resolve();
    httpTesting.expectOne((r) => r.url.endsWith('/api/settings')).flush(settings);
    await loadPromise;

    expect(service.isConfigured()).toBe(true);
    expect(service.loaded()).toBe(true);
    expect(service.jiraConfig().baseUrl).toBe('https://jira.test');
  });

  it('should not load settings when not configured', async () => {
    const loadPromise = service.load();
    httpTesting
      .expectOne((r) => r.url.endsWith('/api/settings/status'))
      .flush({ configured: false });
    await loadPromise;

    expect(service.isConfigured()).toBe(false);
    expect(service.loaded()).toBe(true);
  });

  it('should save settings and update state', async () => {
    const settings = {
      ...createDefaultSettings(),
      connections: {
        ...createDefaultSettings().connections,
        jira: { baseUrl: 'https://jira.test', apiKey: 'key' },
        bitbucket: { baseUrl: 'https://bb.test', apiKey: 'key', userSlug: 'user' },
      },
    };

    const savePromise = service.save(settings);
    httpTesting
      .expectOne((r) => r.method === 'PUT' && r.url.endsWith('/api/settings'))
      .flush(settings);
    await savePromise;

    expect(service.isConfigured()).toBe(true);
    expect(service.jiraConfig().baseUrl).toBe('https://jira.test');
  });
});
