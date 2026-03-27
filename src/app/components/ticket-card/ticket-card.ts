import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { JiraTicket } from '../../models/work-item.model';
import { TicketLocalDataService } from '../../services/ticket-local-data.service';

@Component({
  selector: 'app-ticket-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="cardClasses()"
      (click)="select.emit(ticket())"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="ticket().key + ': ' + ticket().summary"
    >
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
              [class]="selected() ? 'text-[var(--color-primary-text)]' : 'text-[var(--color-text-muted)]'"
            >{{ ticket().key }}</span>
          </div>

          <a
            [href]="ticket().url"
            target="_blank"
            rel="noopener noreferrer"
            class="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-primary-solid)] transition-all duration-150 rounded p-0.5 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)]"
            [attr.aria-label]="'Öffne ' + ticket().key + ' in Jira'"
            (click)="$event.stopPropagation()"
          >
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          </a>
        </div>

        <p
          class="text-[13px] font-medium leading-snug line-clamp-2 mb-1.5"
          [class]="selected() ? 'text-[var(--color-text-heading)]' : 'text-[var(--color-text-heading)]'"
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
            @if (hasSubtasks()) {
              <span class="inline-flex items-center gap-1 ml-auto text-[10px]" [attr.aria-label]="subtaskDone() + ' von ' + subtaskTotal() + ' Aufgaben erledigt'">
                <svg class="w-3 h-3" [class]="subtaskIndicatorClass().icon" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M11 18H3"/><path d="m15 18 2 2 4-4"/>
                  <path d="M16 12H3"/><path d="M16 6H3"/>
                </svg>
                <span style="font-variant-numeric: tabular-nums;">
                  <span [class]="subtaskDoneTextClass()">{{ subtaskDone() }}</span><span class="text-stone-400">/{{ subtaskTotal() }}</span>
                </span>
              </span>
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

  private readonly ticketLocalData = inject(TicketLocalDataService);

  readonly ticketSubtasks = computed(() => this.ticketLocalData.getSubtasksForKey(this.ticket().key));
  readonly subtaskDone = computed(() => this.ticketSubtasks().filter(s => s.status === 'done').length);
  readonly subtaskTotal = computed(() => this.ticketSubtasks().length);
  readonly hasSubtasks = computed(() => this.subtaskTotal() > 0);
  readonly subtaskAllDone = computed(() => this.hasSubtasks() && this.subtaskDone() === this.subtaskTotal());

  readonly cardState = computed<'inactive' | 'normal' | 'attention'>(() => {
    const ticket = this.ticket();
    if (ticket.status === 'Done') return 'inactive';
    const prio = ticket.priority?.toLowerCase() ?? '';
    if (prio === 'highest' || prio === 'high') return 'attention';
    return 'normal';
  });

  readonly cardClasses = computed(() => {
    const state = this.cardState();
    const sel = this.selected();

    const base = 'group relative w-full text-left rounded-lg overflow-hidden transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]';

    if (sel) {
      return `${base} bg-[var(--color-card-selected-bg)] shadow-sm ring-1 ring-[var(--color-card-selected-ring)]`;
    }

    let classes = `${base} bg-[var(--color-bg-card)] ring-1 ring-[var(--color-border-subtle)] hover:ring-[var(--color-border-default)]`;

    if (state === 'inactive') {
      classes += ' opacity-[var(--card-inactive-opacity)]';
    } else if (state === 'attention') {
      classes = classes.replace('rounded-lg', 'rounded-r-lg rounded-l-none');
      classes += ' border-l-4 border-l-[var(--color-card-attention-bar)]';
    }

    return classes;
  });

  readonly subtaskIndicatorClass = computed(() => {
    if (this.subtaskAllDone()) return { icon: 'stroke-emerald-600', text: 'text-emerald-600 font-semibold' };
    if (this.subtaskDone() > 0) return { icon: 'stroke-[var(--color-primary-solid)]', text: 'text-stone-500' };
    return { icon: 'stroke-stone-400', text: 'text-stone-400' };
  });

  readonly subtaskDoneTextClass = computed(() => {
    if (this.subtaskAllDone()) return 'text-emerald-600 font-semibold';
    if (this.subtaskDone() > 0) return 'text-[var(--color-primary-text)] font-semibold';
    return 'text-stone-400 font-semibold';
  });

  issueTypeKey = computed(() => {
    const t = this.ticket().issueType.toLowerCase();
    if (t.includes('bug') || t.includes('fehler')) return 'bug';
    if (t.includes('story')) return 'story';
    if (t.includes('epic')) return 'epic';
    if (t.includes('sub')) return 'sub';
    return 'task';
  });

  statusBadgeClass(): string {
    const map: Record<string, string> = {
      'In Progress': 'bg-[var(--color-primary-bg)] text-[var(--color-primary-text)] border-[var(--color-primary-border)]',
      'In Review': 'bg-[var(--color-primary-bg)] text-[var(--color-primary-text)] border-[var(--color-primary-border)]',
      'Done': 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]',
      'To Do': 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border-[var(--color-border-default)]',
    };
    return map[this.ticket().status] ?? 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border-[var(--color-border-default)]';
  }

  statusDotClass(): string {
    const map: Record<string, string> = {
      'In Progress': 'bg-[var(--color-primary-solid)]',
      'In Review': 'bg-[var(--color-primary-solid)]',
      'Done': 'bg-[var(--color-success-solid)]',
      'To Do': 'bg-[var(--color-text-muted)]',
    };
    return map[this.ticket().status] ?? 'bg-[var(--color-text-muted)]';
  }

  issueTypeBadgeClass(): string {
    return 'bg-[var(--color-type-badge-bg)] text-[var(--color-type-badge-text)] border border-[var(--color-type-badge-border)]';
  }
}
