import { TestBed } from '@angular/core/testing';
import { PomodoroService, PomodoroState } from './pomodoro.service';

describe('PomodoroService', () => {
  let service: PomodoroService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [PomodoroService] });
    service = TestBed.inject(PomodoroService);
  });

  afterEach(() => {
    service.cancel();
  });

  it('starts in idle state', () => {
    expect(service.state()).toBe('idle');
  });

  it('transitions to running on start', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    expect(service.state()).toBe('running');
    expect(service.focusMinutes()).toBe(25);
    expect(service.breakMinutes()).toBe(5);
  });

  it('stores startedAt timestamp on start', () => {
    const before = Date.now();
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    expect(service.startedAt()).toBeGreaterThanOrEqual(before);
    expect(service.startedAt()).toBeLessThanOrEqual(Date.now());
  });

  it('computes elapsed and remaining correctly', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    expect(service.remainingMinutes()).toBeCloseTo(25, 0);
    expect(service.progress()).toBeCloseTo(0, 1);
  });

  it('returns to idle on cancel', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    service.cancel();
    expect(service.state()).toBe('idle');
    expect(service.startedAt()).toBeNull();
  });

  it('transitions to break state', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    service.startBreak();
    expect(service.state()).toBe('break');
  });

  it('snooze extends focus by 5 minutes', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    const originalMinutes = service.focusMinutes();
    service.snooze();
    expect(service.focusMinutes()).toBe(originalMinutes + 5);
    expect(service.state()).toBe('running');
  });

  it('finishes break and returns to idle', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    service.startBreak();
    service.finishBreak();
    expect(service.state()).toBe('idle');
  });

  it('starts new round from break', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    service.startBreak();
    service.startNewRound();
    expect(service.state()).toBe('running');
  });

  it('persists session to localStorage', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    TestBed.tick();
    const stored = JSON.parse(localStorage.getItem('orbit.pomodoro.session')!);
    expect(stored.state).toBe('running');
    expect(stored.focusMinutes).toBe(25);
  });

  it('persists default durations to localStorage', () => {
    service.start({ focusMinutes: 30, breakMinutes: 10 });
    TestBed.tick();
    const defaults = JSON.parse(localStorage.getItem('orbit.pomodoro.defaults')!);
    expect(defaults.focusMinutes).toBe(30);
    expect(defaults.breakMinutes).toBe(10);
  });

  it('loads default durations from localStorage', () => {
    localStorage.setItem('orbit.pomodoro.defaults', JSON.stringify({ focusMinutes: 45, breakMinutes: 10 }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [PomodoroService] });
    const freshService = TestBed.inject(PomodoroService);
    expect(freshService.defaultFocusMinutes()).toBe(45);
    expect(freshService.defaultBreakMinutes()).toBe(10);
  });

  it('computes timeline block from running session', () => {
    service.start({ focusMinutes: 25, breakMinutes: 5 });
    const block = service.timelineBlock();
    expect(block).not.toBeNull();
    expect(block!.endTime).toBeDefined();
    expect(block!.startTime).toBeDefined();
  });

  it('returns null timeline block when idle', () => {
    expect(service.timelineBlock()).toBeNull();
  });
});
