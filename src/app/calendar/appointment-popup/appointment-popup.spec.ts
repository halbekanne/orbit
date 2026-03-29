import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppointmentPopupComponent } from './appointment-popup';
import { DayAppointment } from '../day-schedule.model';

@Component({
  template: `
    <app-appointment-popup
      [appointment]="appointment()"
      [isNew]="isNew()"
      (save)="onSave($event)"
      (delete)="onDelete($event)"
      (cancel)="onCancel()"
    />
  `,
  imports: [AppointmentPopupComponent],
})
class TestHostComponent {
  appointment = signal<Partial<DayAppointment>>({ startTime: '09:00', endTime: '10:00' });
  isNew = signal(true);
  saved: DayAppointment | null = null;
  deleted: string | null = null;
  cancelled = false;
  onSave(apt: DayAppointment) {
    this.saved = apt;
  }
  onDelete(id: string) {
    this.deleted = id;
  }
  onCancel() {
    this.cancelled = true;
  }
}

describe('AppointmentPopupComponent', () => {
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

  it('renders name input with auto-focus attribute', () => {
    const input = el.querySelector<HTMLInputElement>('[data-testid="apt-name"]');
    expect(input).toBeTruthy();
  });

  it('renders Von and Bis time inputs with provided values', () => {
    const von = el.querySelector<HTMLInputElement>('[data-testid="apt-start"]');
    const bis = el.querySelector<HTMLInputElement>('[data-testid="apt-end"]');
    expect(von?.value).toBe('09:00');
    expect(bis?.value).toBe('10:00');
  });

  it('hides delete button when isNew is true', () => {
    const deleteBtn = el.querySelector('[data-testid="apt-delete"]');
    expect(deleteBtn).toBeNull();
  });

  it('shows delete button when isNew is false', () => {
    host.isNew.set(false);
    host.appointment.set({ id: 'apt-1', title: 'Test', startTime: '09:00', endTime: '10:00' });
    fixture.detectChanges();
    const deleteBtn = el.querySelector('[data-testid="apt-delete"]');
    expect(deleteBtn).toBeTruthy();
  });

  it('emits cancel on Escape key', () => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.cancelled).toBe(true);
  });

  it('emits save with form data on save button click', () => {
    const nameInput = el.querySelector<HTMLInputElement>('[data-testid="apt-name"]');
    nameInput!.value = 'Daily';
    nameInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const saveBtn = el.querySelector<HTMLButtonElement>('[data-testid="apt-save"]');
    saveBtn!.click();
    fixture.detectChanges();
    expect(host.saved).toBeTruthy();
    expect(host.saved!.title).toBe('Daily');
    expect(host.saved!.startTime).toBe('09:00');
    expect(host.saved!.endTime).toBe('10:00');
  });
});
