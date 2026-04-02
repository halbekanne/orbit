import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { SettingsService } from '../settings/settings.service';
import { BuildAnalysisRequest, BuildAnalysisResult, BuildAnalysisState } from './jenkins.model';

@Injectable({ providedIn: 'root' })
export class BuildAnalysisService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);
  private readonly baseUrl = `${environment.proxyUrl}/api/ai/build-analysis`;
  private readonly cache = new Map<string, BuildAnalysisResult>();
  private activeRequest: Subscription | null = null;

  readonly state = signal<BuildAnalysisState>({ status: 'idle' });

  private cacheKey(req: BuildAnalysisRequest): string {
    return `${req.jobPath}/${req.branch}/${req.buildNumber}`;
  }

  analyze(req: BuildAnalysisRequest): void {
    const vertexAi = this.settings.vertexAiConfig();
    if (!vertexAi.url.trim()) {
      this.state.set({ status: 'not-configured' });
      return;
    }

    const key = this.cacheKey(req);
    const cached = this.cache.get(key);
    if (cached) {
      this.state.set({ status: 'result', data: cached });
      return;
    }

    this.activeRequest?.unsubscribe();
    this.state.set({ status: 'loading' });

    this.activeRequest = this.http.post<BuildAnalysisResult>(this.baseUrl, req).subscribe({
      next: result => {
        this.cache.set(key, result);
        this.state.set({ status: 'result', data: result });
        this.activeRequest = null;
      },
      error: err => {
        const message = err.error?.error ?? 'Analyse fehlgeschlagen';
        this.state.set({ status: 'error', message });
        this.activeRequest = null;
      },
    });
  }

  reanalyze(req: BuildAnalysisRequest): void {
    const key = this.cacheKey(req);
    this.cache.delete(key);
    this.analyze(req);
  }

  reset(): void {
    this.activeRequest?.unsubscribe();
    this.activeRequest = null;
    this.state.set({ status: 'idle' });
  }
}
