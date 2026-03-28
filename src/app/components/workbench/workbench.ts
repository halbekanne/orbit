import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WorkspaceService } from '../../services/workspace.service';
import { TicketDetailComponent } from '../ticket-detail/ticket-detail';
import { PrDetailComponent } from '../pr-detail/pr-detail';
import { TodoDetailComponent } from '../todo-detail/todo-detail';
import { IdeaDetailComponent } from '../idea-detail/idea-detail';
import { ReflectionDetailComponent } from '../reflection-detail/reflection-detail';

@Component({
  selector: 'app-workbench',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TicketDetailComponent, PrDetailComponent, TodoDetailComponent, IdeaDetailComponent, ReflectionDetailComponent],
  templateUrl: './workbench.html',
  host: { class: 'flex flex-col h-full' },
})
export class WorkbenchComponent {
  protected readonly data = inject(WorkspaceService);

  onRhythmSubmitted(): void {}
  onRhythmSkipped(): void {}
}
