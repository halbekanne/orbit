import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BuildLogService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.proxyUrl}/jenkins`;

  private readonly _logText = signal('');
  private readonly _isStreaming = signal(false);
  private readonly _error = signal(false);

  readonly logText = this._logText.asReadonly();
  readonly isStreaming = this._isStreaming.asReadonly();
  readonly error = this._error.asReadonly();

  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private currentOffset = 0;
  private currentPath = '';

  loadFullLog(jobPath: string, branch: string, buildNumber: number): void {
    this.stopStreaming();
    this._logText.set('');
    this._error.set(false);
    this.currentPath = `${this.base}/${jobPath}/job/${branch}/${buildNumber}`;

    this.http.get(`${this.currentPath}/consoleText`, { responseType: 'text' }).subscribe({
      next: (text) => {
        this._logText.set(text);
        this.currentOffset = new Blob([text]).size;
      },
      error: () => this._error.set(true),
    });
  }

  startStreaming(jobPath: string, branch: string, buildNumber: number): void {
    this.loadFullLog(jobPath, branch, buildNumber);
    this._isStreaming.set(true);

    this.pollingTimer = setInterval(() => {
      this.http.get(`${this.currentPath}/logText/progressiveText`, {
        params: { start: String(this.currentOffset) },
        responseType: 'text',
        observe: 'response',
      }).subscribe({
        next: (response) => {
          const newText = response.body ?? '';
          if (newText.length > 0) {
            this._logText.update(current => current + newText);
          }
          const textSize = response.headers.get('X-Text-Size');
          if (textSize) this.currentOffset = parseInt(textSize, 10);

          const moreData = response.headers.get('X-More-Data');
          if (moreData !== 'true') {
            this.stopStreaming();
          }
        },
        error: () => this._error.set(true),
      });
    }, 5000);
  }

  stopStreaming(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this._isStreaming.set(false);
  }

  clear(): void {
    this.stopStreaming();
    this._logText.set('');
    this._error.set(false);
    this.currentOffset = 0;
  }
}
