import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NavigatorComponent } from '../../components/navigator/navigator';
import { WorkbenchComponent } from '../../components/workbench/workbench';
import { DayCalendarPanelComponent } from '../../components/day-calendar-panel/day-calendar-panel';

@Component({
  selector: 'app-view-arbeit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavigatorComponent, WorkbenchComponent, DayCalendarPanelComponent],
  templateUrl: './view-arbeit.html',
  host: { class: 'flex h-full overflow-hidden' },
})
export class ViewArbeitComponent {}
