import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { DayScheduleService } from './day-schedule.service';
import { DaySchedule } from './day-schedule.model';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const emptySchedule: DaySchedule = { date: todayStr(), appointments: [] };

function setup(getData: unknown = emptySchedule) {
  const postSpy = vi.fn().mockReturnValue(of({}));
  const getSpy = vi.fn().mockReturnValue(of(getData));
  TestBed.configureTestingModule({
    providers: [
      DayScheduleService,
      { provide: HttpClient, useValue: { get: getSpy, post: postSpy } },
    ],
  });
  const svc = TestBed.inject(DayScheduleService);
  TestBed.tick();
  return { svc, postSpy, getSpy };
}

describe('DayScheduleService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('loads today schedule on init', () => {
    const schedule: DaySchedule = {
      date: todayStr(),
      appointments: [{ id: 'apt-1', title: 'Test', startTime: '09:00', endTime: '10:00' }],
    };
    const { svc } = setup(schedule);
    expect(svc.appointments().length).toBe(1);
    expect(svc.appointments()[0].title).toBe('Test');
  });

  it('clears appointments when stored date does not match today', () => {
    const stale: DaySchedule = {
      date: '2025-01-01',
      appointments: [{ id: 'apt-1', title: 'Old', startTime: '09:00', endTime: '10:00' }],
    };
    const { svc, postSpy } = setup(stale);
    expect(svc.appointments()).toEqual([]);
    expect(postSpy).toHaveBeenCalled();
  });

  it('handles empty array response from backend (fresh install)', () => {
    const { svc } = setup([]);
    expect(svc.appointments()).toEqual([]);
  });

  it('addAppointment creates appointment with generated id and saves', () => {
    const { svc, postSpy } = setup();
    svc.addAppointment('Daily', '09:00', '09:30');
    expect(svc.appointments().length).toBe(1);
    expect(svc.appointments()[0].title).toBe('Daily');
    expect(svc.appointments()[0].id).toMatch(/^apt-/);
    expect(postSpy).toHaveBeenCalled();
  });

  it('updateAppointment replaces appointment by id and saves', () => {
    const { svc, postSpy } = setup();
    svc.addAppointment('Daily', '09:00', '09:30');
    postSpy.mockClear();
    const apt = svc.appointments()[0];
    svc.updateAppointment({ ...apt, title: 'Updated' });
    expect(svc.appointments()[0].title).toBe('Updated');
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('deleteAppointment removes appointment by id and saves', () => {
    const { svc, postSpy } = setup();
    svc.addAppointment('Daily', '09:00', '09:30');
    postSpy.mockClear();
    const id = svc.appointments()[0].id;
    svc.deleteAppointment(id);
    expect(svc.appointments()).toEqual([]);
    expect(postSpy).toHaveBeenCalledTimes(1);
  });
});
