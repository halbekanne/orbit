import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ViewLogbuchComponent } from './view-logbuch';
import { DailyReflectionService } from '../../services/daily-reflection.service';
import { DayEntry } from '../../models/day-entry.model';

const mockHttpClient = {
  get: () => of([]),
  post: () => of([]),
};

const entryWithMorning: DayEntry = {
  date: '2026-03-20',
  morningQuestion: 'Mein Fokus',
  morningFocus: 'Deep Work an der Timeline',
  morningAnsweredAt: '2026-03-20T08:00:00.000Z',
  eveningQuestion: null,
  eveningReflection: null,
  eveningAnsweredAt: null,
  completedItems: [],
};

const entryWithEvening: DayEntry = {
  date: '2026-03-19',
  morningQuestion: null,
  morningFocus: null,
  morningAnsweredAt: null,
  eveningQuestion: 'Was lief gut heute?',
  eveningReflection: 'Habe die PR-Ansicht fertiggestellt.',
  eveningAnsweredAt: '2026-03-19T18:00:00.000Z',
  completedItems: [],
};

const entryWithCompletions: DayEntry = {
  date: '2026-03-18',
  morningQuestion: null,
  morningFocus: null,
  morningAnsweredAt: null,
  eveningQuestion: null,
  eveningReflection: null,
  eveningAnsweredAt: null,
  completedItems: [
    { type: 'todo', id: 't1', title: 'Tests schreiben', completedAt: '2026-03-18T10:00:00.000Z' },
  ],
};

const emptyEntry: DayEntry = {
  date: '2026-03-17',
  morningQuestion: null,
  morningFocus: null,
  morningAnsweredAt: null,
  eveningQuestion: null,
  eveningReflection: null,
  eveningAnsweredAt: null,
  completedItems: [],
};

describe('ViewLogbuchComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewLogbuchComponent],
      providers: [
        { provide: HttpClient, useValue: mockHttpClient },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ViewLogbuchComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show empty state when no entries', () => {
    const fixture = TestBed.createComponent(ViewLogbuchComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Noch keine Einträge');
  });

  it('should render day entries with morning focus', () => {
    const fixture = TestBed.createComponent(ViewLogbuchComponent);
    const service = TestBed.inject(DailyReflectionService);
    service.days.set([entryWithMorning]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Mein Fokus');
    expect(el.textContent).toContain('Deep Work an der Timeline');
  });

  it('should show evening question and reflection when present', () => {
    const fixture = TestBed.createComponent(ViewLogbuchComponent);
    const service = TestBed.inject(DailyReflectionService);
    service.days.set([entryWithEvening]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Was lief gut heute?');
    expect(el.textContent).toContain('Habe die PR-Ansicht fertiggestellt.');
  });

  it('should render day cards as article elements', () => {
    const fixture = TestBed.createComponent(ViewLogbuchComponent);
    const service = TestBed.inject(DailyReflectionService);
    service.days.set([entryWithMorning, entryWithEvening]);
    fixture.detectChanges();
    const articles = fixture.nativeElement.querySelectorAll('article');
    expect(articles.length).toBe(2);
  });

  it('should filter out entries with no meaningful content', () => {
    const fixture = TestBed.createComponent(ViewLogbuchComponent);
    const service = TestBed.inject(DailyReflectionService);
    service.days.set([entryWithMorning, emptyEntry]);
    fixture.detectChanges();
    const articles = fixture.nativeElement.querySelectorAll('article');
    expect(articles.length).toBe(1);
  });

  it('should render completions-only entry as simple card', () => {
    const fixture = TestBed.createComponent(ViewLogbuchComponent);
    const service = TestBed.inject(DailyReflectionService);
    service.days.set([entryWithCompletions]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Tests schreiben');
  });

  it('should not show empty state when entries exist', () => {
    const fixture = TestBed.createComponent(ViewLogbuchComponent);
    const service = TestBed.inject(DailyReflectionService);
    service.days.set([entryWithMorning]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Noch keine Einträge');
  });
});
