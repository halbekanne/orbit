import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { NavigatorComponent } from '../navigator/navigator';
import { WorkbenchComponent } from '../workbench/workbench';
import { DayCalendarPanelComponent } from '../../calendar/day-calendar-panel/day-calendar-panel';
import { SettingsService } from '../../settings/settings.service';
import { LucidePanelLeftOpen, LucidePanelRightOpen } from '@lucide/angular';

const SIDEBAR_KEY = 'orbit.navigator.sidebarCollapsed';
const CALENDAR_KEY = 'orbit.dayCalendar.collapsed';

@Component({
  selector: 'app-view-arbeit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NavigatorComponent,
    WorkbenchComponent,
    DayCalendarPanelComponent,
    LucidePanelLeftOpen,
    LucidePanelRightOpen,
  ],
  templateUrl: './view-arbeit.html',
  host: { class: 'flex flex-1 h-full overflow-hidden' },
})
export class ViewArbeitComponent {
  readonly settingsService = inject(SettingsService);

  readonly sidebarCollapsed = signal(localStorage.getItem(SIDEBAR_KEY) === 'true');
  readonly calendarCollapsed = signal(localStorage.getItem(CALENDAR_KEY) === 'true');

  constructor() {
    effect(() => {
      localStorage.setItem(SIDEBAR_KEY, String(this.sidebarCollapsed()));
    });
    effect(() => {
      localStorage.setItem(CALENDAR_KEY, String(this.calendarCollapsed()));
    });
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  toggleCalendar(): void {
    this.calendarCollapsed.update((v) => !v);
  }
}
