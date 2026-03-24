export interface DayAppointment {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

export interface DaySchedule {
  date: string;
  appointments: DayAppointment[];
}
