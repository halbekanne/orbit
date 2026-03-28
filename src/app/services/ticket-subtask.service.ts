import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SubTask } from '../models/sub-task.model';
import { environment } from '../../environments/environment';

interface TicketSubtaskData {
  key: string;
  subtasks: SubTask[];
}

@Injectable({ providedIn: 'root' })
export class TicketSubtaskService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/api/tickets`;

  readonly currentKey = signal<string | null>(null);
  readonly subtasks = signal<SubTask[]>([]);

  readonly doneCount = computed(() => this.subtasks().filter(s => s.status === 'done').length);
  readonly totalCount = computed(() => this.subtasks().length);
  readonly allDone = computed(() => this.totalCount() > 0 && this.doneCount() === this.totalCount());

  private readonly cache = signal<ReadonlyMap<string, SubTask[]>>(new Map());
  private readonly pendingKeys = new Set<string>();

  loadForTicket(key: string): void {
    if (this.currentKey() === key) return;
    this.currentKey.set(key);

    const cached = this.cache().get(key);
    if (cached !== undefined) {
      this.subtasks.set(cached);
      return;
    }

    this.http.get<TicketSubtaskData>(`${this.baseUrl}/${key}`).subscribe({
      next: data => {
        const subtasks = data.subtasks ?? [];
        this.subtasks.set(subtasks);
        this.updateCache(key, subtasks);
      },
      error: () => this.subtasks.set([]),
    });
  }

  saveSubtasks(subtasks: SubTask[]): void {
    const key = this.currentKey();
    if (!key) return;
    this.subtasks.set(subtasks);
    this.updateCache(key, subtasks);
    this.http.post(`${this.baseUrl}/${key}`, { key, subtasks }).subscribe({
      error: err => console.error('Failed to save ticket local data:', err),
    });
  }

  getSubtasksForKey(key: string): SubTask[] {
    return this.cache().get(key) ?? [];
  }

  preloadKeys(keys: string[]): void {
    for (const key of keys) {
      if (this.cache().has(key) || this.pendingKeys.has(key)) continue;
      this.pendingKeys.add(key);
      this.http.get<TicketSubtaskData>(`${this.baseUrl}/${key}`).subscribe({
        next: data => {
          this.updateCache(key, data.subtasks ?? []);
          this.pendingKeys.delete(key);
        },
        error: () => {
          this.updateCache(key, []);
          this.pendingKeys.delete(key);
        },
      });
    }
  }

  private updateCache(key: string, subtasks: SubTask[]): void {
    this.cache.update(m => { const next = new Map(m); next.set(key, subtasks); return next; });
  }
}
