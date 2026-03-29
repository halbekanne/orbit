import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DailyReflectionService } from '../../reflection/daily-reflection.service';
import { DayEntry } from '../../reflection/day-entry.model';

@Component({
  selector: 'app-view-logbuch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col flex-1 h-full overflow-hidden bg-[var(--color-bg-page)]' },
  templateUrl: './view-logbuch.html',
})
export class ViewLogbuchComponent {
  protected readonly dailyReflection = inject(DailyReflectionService);
  private readonly todayISO = new Date().toISOString().split('T')[0];

  readonly entries = computed(() =>
    this.dailyReflection.days().filter((d) => this.hasMeaningfulContent(d)),
  );

  isToday(date: string): boolean {
    return date === this.todayISO;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  hasMorning(entry: DayEntry): boolean {
    return entry.morningFocus !== null && entry.morningAnsweredAt !== 'skipped';
  }

  hasEvening(entry: DayEntry): boolean {
    return entry.eveningReflection !== null && entry.eveningAnsweredAt !== 'skipped';
  }

  isFull(entry: DayEntry): boolean {
    return this.hasMorning(entry) || this.hasEvening(entry);
  }

  private hasMeaningfulContent(entry: DayEntry): boolean {
    return this.hasMorning(entry) || this.hasEvening(entry) || entry.completedItems.length > 0;
  }
}
