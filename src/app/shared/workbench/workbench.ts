import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WorkspaceService } from '../workspace.service';
import { TicketDetailComponent } from '../../jira/ticket-detail/ticket-detail';
import { PrDetailComponent } from '../../bitbucket/pr-detail/pr-detail';
import { TodoDetailComponent } from '../../todos/todo-detail/todo-detail';
import { IdeaDetailComponent } from '../../ideas/idea-detail/idea-detail';
import { ReflectionDetailComponent } from '../../reflection/reflection-detail/reflection-detail';

@Component({
  selector: 'app-workbench',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TicketDetailComponent,
    PrDetailComponent,
    TodoDetailComponent,
    IdeaDetailComponent,
    ReflectionDetailComponent,
  ],
  templateUrl: './workbench.html',
  host: { class: 'flex flex-col h-full' },
})
export class WorkbenchComponent {
  protected readonly data = inject(WorkspaceService);

  onReflectionSubmitted(): void {}
  onReflectionSkipped(): void {}
}
