import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NavigatorComponent } from '../navigator/navigator';
import { WorkbenchComponent } from '../workbench/workbench';
import { DayCalendarPanelComponent } from '../../calendar/day-calendar-panel/day-calendar-panel';
import { SettingsService } from '../../settings/settings.service';

@Component({
  selector: 'app-view-arbeit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavigatorComponent, WorkbenchComponent, DayCalendarPanelComponent],
  templateUrl: './view-arbeit.html',
  host: { class: 'flex flex-1 h-full overflow-hidden' },
})
export class ViewArbeitComponent {
  readonly settingsService = inject(SettingsService);
}
