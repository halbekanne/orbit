import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WorkDataService } from '../../services/work-data.service';
import { WorkItem } from '../../models/work-item.model';
import { TicketCardComponent } from '../ticket-card/ticket-card';
import { PrCardComponent } from '../pr-card/pr-card';
import { TodoCardComponent } from '../todo-card/todo-card';
import { TodoInlineInputComponent } from '../todo-inline-input/todo-inline-input';

@Component({
  selector: 'app-navigator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TicketCardComponent, PrCardComponent, TodoCardComponent, TodoInlineInputComponent],
  templateUrl: './navigator.html',
  host: { class: 'flex flex-col h-full' },
})
export class NavigatorComponent {
  protected readonly data = inject(WorkDataService);

  isSelected(item: WorkItem): boolean {
    return this.data.selectedItem()?.id === item.id;
  }

  selectItem(item: WorkItem): void {
    this.data.select(item);
  }

  toggleTodo(id: string): void {
    this.data.toggleTodo(id);
  }

  addTodo(title: string): void {
    this.data.addTodo(title);
  }
}
