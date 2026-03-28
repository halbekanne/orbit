import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DayEntry, CompletedItem } from '../models/day-entry.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DailyReflectionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/api/logbuch`;

  readonly days = signal<DayEntry[]>([]);

  readonly todayEntry = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.days().find(d => d.date === today) ?? null;
  });

  readonly needsMorning = computed(() => {
    const entry = this.todayEntry();
    return !entry || entry.morningAnsweredAt === null;
  });

  readonly needsEvening = computed(() => {
    const entry = this.todayEntry();
    if (!entry) return false;
    if (entry.morningAnsweredAt === null) return false;
    return entry.eveningAnsweredAt === null;
  });

  readonly currentHour = signal(new Date().getHours());
  readonly cardAnimationTrigger = signal(0);

  readonly reflectionPhase = computed<'morning-open' | 'morning-filled' | 'evening-open' | 'evening-filled'>(() => {
    const entry = this.todayEntry();
    if (!entry || entry.morningAnsweredAt === null) return 'morning-open';
    if (entry.eveningAnsweredAt !== null) return 'evening-filled';
    if (this.currentHour() >= 15 && entry.morningAnsweredAt !== null) return 'evening-open';
    return 'morning-filled';
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.http.get<DayEntry[]>(this.baseUrl).subscribe({
      next: days => {
        this.days.set(days);
        this.ensureToday();
      },
      error: err => console.error('Failed to load days:', err),
    });
  }

  ensureToday(): void {
    if (this.todayEntry()) return;
    const today = new Date().toISOString().split('T')[0];
    const entry: DayEntry = {
      date: today,
      morningQuestion: null,
      morningFocus: null,
      morningAnsweredAt: null,
      eveningQuestion: null,
      eveningReflection: null,
      eveningAnsweredAt: null,
      completedItems: [],
    };
    this.days.update(days => [entry, ...days]);
    this.save();
  }

  saveMorning(focus: string, question: string): void {
    this.updateToday(entry => ({
      ...entry,
      morningFocus: focus,
      morningQuestion: question,
      morningAnsweredAt: new Date().toISOString(),
    }));
  }

  skipMorning(): void {
    this.updateToday(entry => ({
      ...entry,
      morningAnsweredAt: 'skipped',
    }));
  }

  saveEvening(reflection: string, question: string): void {
    this.updateToday(entry => ({
      ...entry,
      eveningReflection: reflection,
      eveningQuestion: question,
      eveningAnsweredAt: new Date().toISOString(),
    }));
  }

  skipEvening(): void {
    this.updateToday(entry => ({
      ...entry,
      eveningAnsweredAt: 'skipped',
    }));
  }

  recordCompletion(item: CompletedItem): void {
    this.ensureToday();
    this.updateToday(entry => ({
      ...entry,
      completedItems: [...entry.completedItems, item],
    }));
  }

  private updateToday(fn: (entry: DayEntry) => DayEntry): void {
    const today = new Date().toISOString().split('T')[0];
    this.days.update(days =>
      days.map(d => d.date === today ? fn(d) : d)
    );
    this.save();
  }

  private save(): void {
    this.http.post<DayEntry[]>(this.baseUrl, this.days()).subscribe({
      error: err => console.error('Failed to save days:', err),
    });
  }
}
