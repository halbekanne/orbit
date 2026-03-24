import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { DayAppointment, DaySchedule } from '../models/day-schedule.model';

@Injectable({ providedIn: 'root' })
export class DayScheduleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.proxyUrl}/api/day-schedule`;

  private readonly schedule = signal<DaySchedule>({
    date: this.todayString(),
    appointments: [],
  });

  readonly appointments = computed(() => this.schedule().appointments);

  constructor() {
    this.load();
  }

  addAppointment(title: string, startTime: string, endTime: string): DayAppointment {
    const apt: DayAppointment = {
      id: `apt-${Date.now()}`,
      title,
      startTime,
      endTime,
    };
    this.schedule.update(s => ({
      ...s,
      appointments: [...s.appointments, apt],
    }));
    this.save();
    return apt;
  }

  updateAppointment(apt: DayAppointment): void {
    this.schedule.update(s => ({
      ...s,
      appointments: s.appointments.map(a => a.id === apt.id ? apt : a),
    }));
    this.save();
  }

  deleteAppointment(id: string): void {
    this.schedule.update(s => ({
      ...s,
      appointments: s.appointments.filter(a => a.id !== id),
    }));
    this.save();
  }

  private load(): void {
    this.http.get<DaySchedule | unknown[]>(this.baseUrl).subscribe({
      next: data => {
        if (Array.isArray(data) || !data || (data as DaySchedule).date !== this.todayString()) {
          this.schedule.set({ date: this.todayString(), appointments: [] });
          this.save();
        } else {
          this.schedule.set(data as DaySchedule);
        }
      },
      error: err => console.error('Failed to load day schedule:', err),
    });
  }

  private save(): void {
    this.http.post(this.baseUrl, this.schedule()).subscribe({
      error: err => console.error('Failed to save day schedule:', err),
    });
  }

  private todayString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
