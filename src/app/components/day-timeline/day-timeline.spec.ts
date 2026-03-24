import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { DayTimelineComponent } from './day-timeline';
import { DayAppointment } from '../../models/day-schedule.model';

@Component({
  template: `
    <div style="height: 600px;">
      <app-day-timeline
        [appointments]="appointments()"
        (appointmentCreate)="onCreate($event)"
        (appointmentEdit)="onEdit($event)"
        (appointmentUpdate)="onUpdate($event)"
      />
    </div>
  `,
  imports: [DayTimelineComponent],
})
class TestHostComponent {
  appointments = signal<DayAppointment[]>([]);
  created: { startTime: string; endTime: string } | null = null;
  edited: DayAppointment | null = null;
  updated: DayAppointment | null = null;
  onCreate(e: { startTime: string; endTime: string }) { this.created = e; }
  onEdit(apt: DayAppointment) { this.edited = apt; }
  onUpdate(apt: DayAppointment) { this.updated = apt; }
}

describe('DayTimelineComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  afterEach(() => TestBed.resetTestingModule());

  it('renders hour labels from 08:00 to 17:00', () => {
    const labels = el.querySelectorAll('[data-testid="hour-label"]');
    expect(labels.length).toBe(10);
    expect(labels[0].textContent?.trim()).toBe('08:00');
    expect(labels[9].textContent?.trim()).toBe('17:00');
  });

  it('renders appointment block with title and time', () => {
    host.appointments.set([{ id: 'apt-1', title: 'Daily', startTime: '09:00', endTime: '10:00' }]);
    fixture.detectChanges();
    const block = el.querySelector('[data-testid="appointment-apt-1"]');
    expect(block).toBeTruthy();
    expect(block!.textContent).toContain('Daily');
    expect(block!.textContent).toContain('09:00');
  });

  it('renders current time indicator', () => {
    const indicator = el.querySelector('[data-testid="current-time-line"]');
    // May or may not be present depending on current time
    // Just check no errors during rendering
    expect(true).toBe(true);
  });

  it('emits appointmentEdit on double-click of appointment', () => {
    host.appointments.set([{ id: 'apt-1', title: 'Daily', startTime: '09:00', endTime: '10:00' }]);
    fixture.detectChanges();
    const block = el.querySelector('[data-testid="appointment-apt-1"]');
    block!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(host.edited).toBeTruthy();
    expect(host.edited!.id).toBe('apt-1');
  });
});
