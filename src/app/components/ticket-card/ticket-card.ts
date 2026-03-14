import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { JiraTicket } from '../../models/work-item.model';

@Component({
  selector: 'app-ticket-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="group w-full text-left rounded-lg border px-3 py-2.5 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      [class]="selected()
        ? 'bg-indigo-50 border-indigo-300 shadow-sm'
        : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-sm'"
      (click)="select.emit(ticket())"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="ticket().key + ': ' + ticket().summary"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="font-mono text-xs font-semibold tracking-wide" [class]="selected() ? 'text-indigo-600' : 'text-stone-400'">
            {{ ticket().key }}
          </span>
          @if (isOverdue()) {
            <span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700">Überfällig</span>
          }
        </div>
        <a
          [href]="ticket().url"
          target="_blank"
          rel="noopener noreferrer"
          class="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-stone-400 hover:text-indigo-500 transition-opacity p-0.5 rounded"
          [attr.aria-label]="'Öffne ' + ticket().key + ' in Jira'"
          (click)="$event.stopPropagation()"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
        </a>
      </div>

      <p class="mt-1 text-sm font-medium leading-snug text-stone-800 line-clamp-2">{{ ticket().summary }}</p>

      <div class="mt-2 flex items-center gap-2 flex-wrap">
        <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium" [class]="statusClass()">
          {{ ticket().status }}
        </span>
        <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium" [class]="priorityClass()">
          {{ ticket().priority }}
        </span>
      </div>
    </button>
  `,
})
export class TicketCardComponent {
  ticket = input.required<JiraTicket>();
  selected = input(false);
  select = output<JiraTicket>();

  isOverdue = computed(() => {
    const due = this.ticket().dueDate;
    if (!due) return false;
    return new Date(due) < new Date(new Date().toDateString());
  });

  statusClass() {
    const map: Record<string, string> = {
      'In Progress': 'bg-blue-100 text-blue-700',
      'In Review': 'bg-purple-100 text-purple-700',
      'Done': 'bg-emerald-100 text-emerald-700',
      'To Do': 'bg-stone-100 text-stone-600',
    };
    return map[this.ticket().status] ?? 'bg-stone-100 text-stone-600';
  }

  priorityClass() {
    const map: Record<string, string> = {
      'High': 'bg-red-100 text-red-700',
      'Medium': 'bg-amber-100 text-amber-700',
      'Low': 'bg-stone-100 text-stone-500',
    };
    return map[this.ticket().priority] ?? 'bg-stone-100 text-stone-500';
  }
}
