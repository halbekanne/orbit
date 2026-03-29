import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Idea } from '../shared/work-item.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class IdeaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/api/ideas`;

  readonly ideas = signal<Idea[]>([]);
  readonly ideasLoading = signal(true);
  readonly ideasError = signal(false);

  readonly activeIdeas = computed(() => this.ideas().filter((i) => i.status === 'active'));
  readonly wontDoIdeas = computed(() => this.ideas().filter((i) => i.status === 'wont-do'));

  constructor() {
    this.load();
  }

  load(): void {
    this.http.get<Idea[]>(this.baseUrl).subscribe({
      next: (ideas) => {
        this.ideas.set(ideas);
        this.ideasLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load ideas:', err);
        this.ideasError.set(true);
        this.ideasLoading.set(false);
      },
    });
  }

  add(title: string, description = ''): Idea {
    const idea: Idea = {
      type: 'idea',
      id: `id-${Date.now()}`,
      title,
      description,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    this.ideas.update((ideas) => [idea, ...ideas]);
    this.save();
    return idea;
  }

  update(idea: Idea): void {
    this.ideas.update((ideas) => ideas.map((i) => (i.id === idea.id ? idea : i)));
    this.save();
  }

  reorder(fromIndex: number, toIndex: number): void {
    this.ideas.update((ideas) => {
      const arr = [...ideas];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      return arr;
    });
    this.save();
  }

  private save(): void {
    this.http.post<Idea[]>(this.baseUrl, this.ideas()).subscribe({
      error: (err) => console.error('Failed to save ideas:', err),
    });
  }
}
