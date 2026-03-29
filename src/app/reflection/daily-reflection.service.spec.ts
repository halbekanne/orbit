import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { DailyReflectionService } from './daily-reflection.service';
import { DayEntry } from './day-entry.model';

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
    providers: [DailyReflectionService, { provide: HttpClient, useValue: http }],
  });
  return TestBed.inject(DailyReflectionService);
}

describe('DailyReflectionService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('should create', () => {
    const svc = setup({ get: () => new Observable(), post: () => of([]) });
    expect(svc).toBeTruthy();
  });

  it('should auto-create today entry after loading empty data', () => {
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([]), post: postSpy });
    TestBed.tick();
    expect(svc.days().length).toBe(1);
    expect(svc.todayEntry()).toBeTruthy();
    expect(svc.todayEntry()!.date).toBe(todayISO);
    expect(svc.todayEntry()!.morningAnsweredAt).toBeNull();
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('should not create duplicate when today already exists', () => {
    const existing = makeEntry({ morningFocus: 'Existing' });
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([existing]), post: postSpy });
    TestBed.tick();
    expect(svc.days().length).toBe(1);
    expect(svc.todayEntry()!.morningFocus).toBe('Existing');
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('should save morning focus', () => {
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([]), post: postSpy });
    TestBed.tick();
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
    svc.recordCompletion({
      type: 'todo',
      id: 'td-1',
      title: 'Test',
      completedAt: new Date().toISOString(),
    });
    expect(svc.todayEntry()!.completedItems.length).toBe(1);
    expect(svc.todayEntry()!.completedItems[0].title).toBe('Test');
  });

  it('should skip morning via skipMorning', () => {
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([]), post: postSpy });
    TestBed.tick();
    svc.skipMorning();
    const entry = svc.todayEntry();
    expect(entry!.morningAnsweredAt).toBe('skipped');
  });

  it('should report needsMorning correctly', () => {
    const postSpy = vi.fn().mockReturnValue(of([]));
    const svc = setup({ get: () => of([]), post: postSpy });
    TestBed.tick();
    expect(svc.needsMorning()).toBe(true);
    svc.saveMorning('Focus', 'Q?');
    expect(svc.needsMorning()).toBe(false);
  });
});
