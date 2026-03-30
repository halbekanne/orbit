import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { createDefaultSettings, OrbitSettings } from './settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/api/settings`;

  private readonly _settings = signal<OrbitSettings>(createDefaultSettings());
  private readonly _isConfigured = signal(false);
  private readonly _loaded = signal(false);

  readonly settings = this._settings.asReadonly();
  readonly isConfigured = this._isConfigured.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  readonly jiraConfig = computed(() => this._settings().connections.jira);
  readonly jenkinsConfig = computed(() => this._settings().connections.jenkins ?? { baseUrl: '', username: '', apiToken: '', jobs: [] });
  readonly jenkinsConfigured = computed(() => {
    const j = this._settings().connections.jenkins;
    if (!j) return false;
    return j.baseUrl.trim() !== '' && j.username.trim() !== '' && j.apiToken.trim() !== '' && j.jobs.length > 0;
  });
  readonly bitbucketConfig = computed(() => this._settings().connections.bitbucket);
  readonly vertexAiConfig = computed(() => this._settings().connections.vertexAi);
  readonly pomodoroDefaults = computed(() => ({
    focusMinutes: this._settings().features.pomodoro.focusMinutes,
    breakMinutes: this._settings().features.pomodoro.breakMinutes,
  }));
  readonly theme = computed(() => this._settings().appearance.theme);
  readonly pomodoroEnabled = computed(() => this._settings().features.pomodoro.enabled);
  readonly aiReviewsEnabled = computed(() => this._settings().features.aiReviews.enabled);
  readonly dayCalendarEnabled = computed(() => this._settings().features.dayCalendar.enabled);

  async load(): Promise<void> {
    const status = await firstValueFrom(
      this.http.get<{ configured: boolean }>(`${this.baseUrl}/status`),
    );
    this._isConfigured.set(status.configured);

    if (status.configured) {
      const settings = await firstValueFrom(this.http.get<OrbitSettings>(this.baseUrl));
      const defaults = createDefaultSettings();
      settings.connections = { ...defaults.connections, ...settings.connections };
      settings.features = { ...defaults.features, ...settings.features };
      settings.features.aiReviews = { ...defaults.features.aiReviews, ...settings.features.aiReviews };
      settings.appearance = { ...defaults.appearance, ...settings.appearance };
      this._settings.set(settings);
    }
    this._loaded.set(true);
  }

  async save(settings: OrbitSettings): Promise<void> {
    const result = await firstValueFrom(this.http.put<OrbitSettings>(this.baseUrl, settings));
    const defaults = createDefaultSettings();
    result.connections = { ...defaults.connections, ...result.connections };
    result.features = { ...defaults.features, ...result.features };
    result.features.aiReviews = { ...defaults.features.aiReviews, ...result.features.aiReviews };
    result.appearance = { ...defaults.appearance, ...result.appearance };
    this._settings.set(result);
    this._isConfigured.set(true);
  }
}
