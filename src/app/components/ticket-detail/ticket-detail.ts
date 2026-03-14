import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { JiraTicket } from '../../models/work-item.model';

@Component({
  selector: 'app-ticket-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="h-full flex flex-col" [attr.aria-label]="ticket().key + ': ' + ticket().summary">
      <header class="pb-5 border-b border-stone-200">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <span class="font-mono text-sm font-bold text-indigo-600 tracking-wide">{{ ticket().key }}</span>
              <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium" [class]="statusClass()">{{ ticket().status }}</span>
              <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium" [class]="priorityClass()">{{ ticket().priority }}</span>
              @if (isOverdue()) {
                <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">Überfällig</span>
              }
            </div>
            <h1 class="text-xl font-semibold text-stone-900 leading-snug">{{ ticket().summary }}</h1>
          </div>
          <a
            [href]="ticket().url"
            target="_blank"
            rel="noopener noreferrer"
            class="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            [attr.aria-label]="'Öffne ' + ticket().key + ' in Jira'"
          >
            In Jira öffnen
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          </a>
        </div>
      </header>

      <div class="py-5 border-b border-stone-200">
        <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Assignee</dt>
            <dd class="text-sm text-stone-700 font-medium">{{ ticket().assignee }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Reporter</dt>
            <dd class="text-sm text-stone-700">{{ ticket().reporter }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Fälligkeitsdatum</dt>
            <dd class="text-sm font-medium" [class]="isOverdue() ? 'text-red-600' : 'text-stone-700'">
              {{ ticket().dueDate ?? 'Kein Datum' }}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Zuletzt geändert</dt>
            <dd class="text-sm text-stone-700">{{ formatDate(ticket().updatedAt) }}</dd>
          </div>
        </dl>
      </div>

      <div class="flex-1 py-5 overflow-y-auto">
        <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Beschreibung</h2>
        <div class="text-sm text-stone-700 leading-relaxed whitespace-pre-line">{{ ticket().description }}</div>
      </div>
    </article>
  `,
})
export class TicketDetailComponent {
  ticket = input.required<JiraTicket>();

  isOverdue = computed(() => {
    const due = this.ticket().dueDate;
    if (!due) return false;
    return new Date(due) < new Date(new Date().toDateString());
  });

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  statusClass(): string {
    const map: Record<string, string> = {
      'In Progress': 'bg-blue-100 text-blue-700',
      'In Review': 'bg-purple-100 text-purple-700',
      'Done': 'bg-emerald-100 text-emerald-700',
      'To Do': 'bg-stone-100 text-stone-600',
    };
    return map[this.ticket().status] ?? 'bg-stone-100 text-stone-600';
  }

  priorityClass(): string {
    const map: Record<string, string> = {
      'High': 'bg-red-100 text-red-700',
      'Medium': 'bg-amber-100 text-amber-700',
      'Low': 'bg-stone-100 text-stone-500',
    };
    return map[this.ticket().priority] ?? 'bg-stone-100 text-stone-500';
  }
}
