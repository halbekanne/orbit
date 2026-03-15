import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { JiraTicket } from '../../models/work-item.model';

@Component({
  selector: 'app-ticket-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="group relative w-full text-left rounded-lg overflow-hidden transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      [class]="selected()
        ? 'bg-indigo-50/70 shadow-sm ring-1 ring-indigo-200/80'
        : 'bg-white ring-1 ring-stone-200 hover:ring-stone-300 hover:bg-stone-50/60'"
      (click)="select.emit(ticket())"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="ticket().key + ': ' + ticket().summary"
    >
      <div
        class="absolute left-0 top-0 bottom-0 w-[3px] transition-opacity duration-150"
        [class]="statusStripeClass()"
        aria-hidden="true"
      ></div>

      <div class="pl-4 pr-3 pt-2.5 pb-2.5">
        <div class="flex items-start justify-between gap-2 mb-1.5">
          <div class="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span
              class="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold shrink-0 leading-none"
              [class]="issueTypeBadgeClass()"
            >
              @switch (issueTypeKey()) {
                @case ('bug') {
                  <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>
                }
                @case ('story') {
                  <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                }
                @case ('epic') {
                  <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                }
                @default {
                  <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                }
              }
              {{ ticket().issueType }}
            </span>

            <span
              class="font-mono text-[11px] font-bold tracking-wide shrink-0"
              [class]="selected() ? 'text-indigo-600' : 'text-stone-400'"
            >{{ ticket().key }}</span>
          </div>

          <a
            [href]="ticket().url"
            target="_blank"
            rel="noopener noreferrer"
            class="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-stone-400 hover:text-indigo-500 transition-all duration-150 rounded p-0.5 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500"
            [attr.aria-label]="'Öffne ' + ticket().key + ' in Jira'"
            (click)="$event.stopPropagation()"
          >
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          </a>
        </div>

        <p
          class="text-[13px] font-medium leading-snug line-clamp-2 mb-1.5"
          [class]="selected() ? 'text-stone-900' : 'text-stone-700'"
        >{{ ticket().summary }}</p>

        <div class="flex items-center gap-1.5 flex-wrap">
          <span
            class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold border leading-none"
            [class]="statusBadgeClass()"
          >
            <span class="w-1 h-1 rounded-full shrink-0" [class]="statusDotClass()" aria-hidden="true"></span>
            {{ ticket().status }}
          </span>

          @if (ticket().labels.length) {
            <span class="text-[10px] font-medium text-amber-600 truncate max-w-[100px]">{{ ticket().labels[0] }}</span>
          }
        </div>
      </div>
    </button>
  `,
})
export class TicketCardComponent {
  ticket = input.required<JiraTicket>();
  selected = input(false);
  select = output<JiraTicket>();

  issueTypeKey = computed(() => {
    const t = this.ticket().issueType.toLowerCase();
    if (t.includes('bug') || t.includes('fehler')) return 'bug';
    if (t.includes('story')) return 'story';
    if (t.includes('epic')) return 'epic';
    if (t.includes('sub')) return 'sub';
    return 'task';
  });

  statusStripeClass(): string {
    const map: Record<string, string> = {
      'In Progress': 'bg-indigo-400',
      'In Review': 'bg-indigo-400',
      'Done': 'bg-emerald-500',
      'To Do': 'bg-stone-300',
    };
    return map[this.ticket().status] ?? 'bg-stone-300';
  }

  statusBadgeClass(): string {
    const map: Record<string, string> = {
      'In Progress': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'In Review': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'Done': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'To Do': 'bg-stone-100 text-stone-500 border-stone-200',
    };
    return map[this.ticket().status] ?? 'bg-stone-100 text-stone-500 border-stone-200';
  }

  statusDotClass(): string {
    const map: Record<string, string> = {
      'In Progress': 'bg-indigo-400',
      'In Review': 'bg-indigo-400',
      'Done': 'bg-emerald-500',
      'To Do': 'bg-stone-400',
    };
    return map[this.ticket().status] ?? 'bg-stone-400';
  }

  issueTypeBadgeClass(): string {
    const k = this.issueTypeKey();
    if (k === 'bug') return 'bg-red-50 text-red-600 border border-red-200';
    if (k === 'story') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    if (k === 'epic') return 'bg-violet-50 text-violet-700 border border-violet-200';
    return 'bg-sky-50 text-sky-700 border border-sky-200';
  }
}
