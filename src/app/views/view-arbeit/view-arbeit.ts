import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NavigatorComponent } from '../../components/navigator/navigator';
import { WorkbenchComponent } from '../../components/workbench/workbench';
import { ActionRailComponent } from '../../components/action-rail/action-rail';

@Component({
  selector: 'app-view-arbeit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavigatorComponent, WorkbenchComponent, ActionRailComponent],
  templateUrl: './view-arbeit.html',
  host: { class: 'flex h-full overflow-hidden' },
})
export class ViewArbeitComponent {}
