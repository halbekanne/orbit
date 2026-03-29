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
  readonly jenkinsConfig = computed(() => this._settings().connections.jenkins);
  readonly jenkinsConfigured = computed(() => {
    const j = this._settings().connections.jenkins;
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
      this._settings.set(settings);
    }
    this._loaded.set(true);
  }

  async save(settings: OrbitSettings): Promise<void> {
    const result = await firstValueFrom(this.http.put<OrbitSettings>(this.baseUrl, settings));
    this._settings.set(result);
    this._isConfigured.set(true);
  }
}
