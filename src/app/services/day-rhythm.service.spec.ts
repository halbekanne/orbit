import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { DayRhythmService } from './day-rhythm.service';
import { DayEntry } from '../models/day-entry.model';

const todayISO = new Date().toISOString().split('T')[0];

const makeEntry = (overrides: Partial<DayEntry> = {}): DayEntry => ({
  date: todayISO,
  morningQuestion: null,
  morningFocus: null,
  morningAnsweredAt: null,
  eveningQuestion: null,
  eveningReflection: null,
  eveningAnsweredAt: null,
  completedItems: [],
  ...overrides,
});

function setup(http: Partial<{ get: unknown; post: unknown }>) {
  TestBed.configureTestingModule({
    providers: [
      DayRhythmService,
      { provide: HttpClient, useValue: http },
    ],
  });
  return TestBed.inject(DayRhythmService);
}

describe('DayRhythmService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('should create', () => {
    const svc = setup({ get: () => new Observable(), post: () => of([]) });
    expect(svc).toBeTruthy();
  });

  it('should initialize with empty days from API', () => {
    const svc = setup({ get: () => of([]), post: () => of([]) });
    TestBed.tick();
    expect(svc.days().length).toBe(0);
  });

  it('should return null for todayEntry when no data', () => {
    const svc = setup({ get: () => of([]), post: () => of([]) });
    TestBed.tick();
    expect(svc.todayEntry()).toBeNull();
  });

  it('should create today entry via ensureToday', () => {
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([]), post: postSpy });
    TestBed.tick();
    svc.ensureToday();
    const entry = svc.todayEntry();
    expect(entry).toBeTruthy();
    expect(entry!.date).toBe(todayISO);
    expect(entry!.morningAnsweredAt).toBeNull();
  });

  it('should save morning focus', () => {
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([]), post: postSpy });
    TestBed.tick();
    svc.ensureToday();
    svc.saveMorning('Mein Fokus', 'Test-Frage?');
    const entry = svc.todayEntry();
    expect(entry!.morningFocus).toBe('Mein Fokus');
    expect(entry!.morningQuestion).toBe('Test-Frage?');
    expect(entry!.morningAnsweredAt).toBeTruthy();
  });

  it('should save evening reflection', () => {
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([]), post: postSpy });
    TestBed.tick();
    svc.ensureToday();
    svc.saveEvening('Guter Tag', 'Abend-Frage?');
    const entry = svc.todayEntry();
    expect(entry!.eveningReflection).toBe('Guter Tag');
    expect(entry!.eveningQuestion).toBe('Abend-Frage?');
    expect(entry!.eveningAnsweredAt).toBeTruthy();
  });

  it('should record a completion', () => {
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([]), post: postSpy });
    TestBed.tick();
    svc.ensureToday();
    svc.recordCompletion({ type: 'todo', id: 'td-1', title: 'Test', completedAt: new Date().toISOString() });
    expect(svc.todayEntry()!.completedItems.length).toBe(1);
    expect(svc.todayEntry()!.completedItems[0].title).toBe('Test');
  });

  it('should skip morning via skipMorning', () => {
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([]), post: postSpy });
    TestBed.tick();
    svc.ensureToday();
    svc.skipMorning();
    const entry = svc.todayEntry();
    expect(entry!.morningAnsweredAt).toBe('skipped');
  });

  it('should report needsMorning correctly', () => {
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([]), post: postSpy });
    TestBed.tick();
    expect(svc.needsMorning()).toBe(true);
    svc.ensureToday();
    expect(svc.needsMorning()).toBe(true);
    svc.saveMorning('Focus', 'Q?');
    expect(svc.needsMorning()).toBe(false);
  });
});
