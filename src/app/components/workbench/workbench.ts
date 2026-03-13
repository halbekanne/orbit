import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WorkDataService } from '../../services/work-data.service';
import { TicketDetailComponent } from '../ticket-detail/ticket-detail';
import { PrDetailComponent } from '../pr-detail/pr-detail';
import { TodoDetailComponent } from '../todo-detail/todo-detail';

@Component({
  selector: 'app-workbench',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TicketDetailComponent, PrDetailComponent, TodoDetailComponent],
  templateUrl: './workbench.html',
  host: { class: 'flex flex-col h-full' },
})
export class WorkbenchComponent {
  protected readonly data = inject(WorkDataService);
}
