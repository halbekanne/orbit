import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DayRhythmService } from '../../services/day-rhythm.service';
import { DayEntry } from '../../models/day-entry.model';

@Component({
  selector: 'app-view-logbuch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col h-full' },
  templateUrl: './view-logbuch.html',
})
export class ViewLogbuchComponent {
  protected readonly dayRhythm = inject(DayRhythmService);
  private readonly todayISO = new Date().toISOString().split('T')[0];

  readonly entries = computed(() =>
    this.dayRhythm.days().filter(d => this.hasMeaningfulContent(d))
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
