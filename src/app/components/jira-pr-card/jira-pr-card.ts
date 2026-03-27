import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { JiraMarkupPipe } from '../../pipes/jira-markup.pipe';
import { JiraTicket } from '../../models/work-item.model';

@Component({
  selector: 'app-jira-pr-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JiraMarkupPipe],
  template: `
    <section aria-label="Jira-Ticket">
      @if (ticket() === 'loading') {
        <div
          class="border border-[var(--color-primary-border)] bg-[var(--color-primary-bg)] rounded-lg p-3"
          aria-busy="true"
          aria-label="Lade Jira-Ticket"
        >
          <div class="flex gap-2 mb-2">
            <div class="h-4 w-16 rounded bg-[var(--color-primary-bg)] animate-pulse"></div>
            <div class="h-4 w-20 rounded bg-[var(--color-primary-bg)] animate-pulse"></div>
          </div>
          <div class="h-4 w-3/4 rounded bg-[var(--color-primary-bg)] animate-pulse mb-1.5"></div>
          <div class="h-4 w-1/2 rounded bg-[var(--color-primary-bg)] animate-pulse"></div>
        </div>
      } @else if (ticket() === 'no-ticket') {
        <p
          class="text-sm text-[var(--color-text-muted)] italic py-1"
          role="status"
        >Kein Jira-Ticket gefunden</p>
      } @else if (ticket() === 'error') {
        <p
          class="text-sm text-red-500 py-1"
          role="status"
        >Ticket konnte nicht geladen werden</p>
      } @else {
        <div class="border-[1.5px] border-[var(--color-primary-border)] rounded-lg overflow-hidden">

          <div class="px-3 py-2.5 bg-[var(--color-primary-bg)] border-b border-[var(--color-primary-border)]">
            <div class="flex items-center gap-1.5 flex-wrap mb-2">
              <span
                class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold border leading-none"
                [class]="issueTypeBadgeClass()"
              >
                @switch (issueTypeKey()) {
                  @case ('bug') {
                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>
                  }
                  @case ('story') {
                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  }
                  @case ('epic') {
                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  }
                  @default {
                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  }
                }
                {{ ticketData()!.issueType }}
              </span>

              <span class="font-mono text-[11px] font-bold text-[var(--color-primary-text)] tracking-wide">{{ ticketData()!.key }}</span>

              <span
                class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold border leading-none"
                [class]="statusBadgeClass()"
              >
                <span class="w-1.5 h-1.5 rounded-full" [class]="statusDotClass()" aria-hidden="true"></span>
                {{ ticketData()!.status }}
              </span>

              <a
                [href]="ticketData()!.url"
                target="_blank"
                rel="noopener noreferrer"
                class="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold text-[var(--color-primary-text)] border border-[var(--color-primary-border)] rounded-md px-2 py-1 bg-[var(--color-bg-card)] hover:bg-[var(--color-primary-bg)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)]"
                [attr.aria-label]="'Öffne ' + ticketData()!.key + ' in Jira'"
              >
                In Jira öffnen
                <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
              </a>
            </div>

            <p class="text-[13px] font-semibold text-[var(--color-text-heading)] leading-snug mb-2">{{ ticketData()!.summary }}</p>

            <div class="flex items-center gap-1.5">
              <span class="text-[9.5px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Zugewiesen</span>
              @if (ticketData()!.assignee !== 'Nicht zugeordnet') {
                <span
                  class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--color-primary-bg)] text-[var(--color-primary-text)] text-[8px] font-bold shrink-0"
                  aria-hidden="true"
                >{{ assigneeInitials() }}</span>
              }
              <span class="text-[11.5px] text-[var(--color-text-body)] font-medium">{{ ticketData()!.assignee }}</span>
            </div>
          </div>

          @if (ticketData()!.description) {
            <div class="px-3 py-2.5" data-testid="jira-description">
              <div class="jira-markup text-sm" [innerHTML]="ticketData()!.description | jiraMarkup"></div>
            </div>
          }

        </div>
      }
    </section>
  `,
})
export class JiraPrCardComponent {
  ticket = input.required<JiraTicket | 'loading' | 'no-ticket' | 'error'>();

  readonly ticketData = computed(() => {
    const t = this.ticket();
    return typeof t === 'object' ? t : null;
  });

  issueTypeKey = computed(() => {
    const ticket = this.ticketData();
    if (!ticket) return 'task';
    const t = ticket.issueType.toLowerCase();
    if (t.includes('bug') || t.includes('fehler')) return 'bug';
    if (t.includes('story')) return 'story';
    if (t.includes('epic')) return 'epic';
    return 'task';
  });

  assigneeInitials = computed(() =>
    this.ticketData()?.assignee
      .split(' ')
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '',
  );

  issueTypeBadgeClass = computed(() => {
    const k = this.issueTypeKey();
    if (k === 'bug')   return 'bg-red-50 text-red-600 border-red-200';
    if (k === 'story') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (k === 'epic')  return 'bg-violet-50 text-violet-700 border-violet-200';
    return 'bg-[var(--color-type-badge-bg)] text-[var(--color-type-badge-text)] border-[var(--color-type-badge-border)]';
  });

  statusBadgeClass = computed(() => {
    const status = this.ticketData()?.status;
    const map: Record<string, string> = {
      'In Progress': 'bg-[var(--color-primary-bg)] text-[var(--color-primary-text)] border-[var(--color-primary-border)]',
      'In Review':   'bg-amber-50 text-amber-700 border-amber-200',
      'Done':        'bg-emerald-50 text-emerald-700 border-emerald-200',
      'To Do':       'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]',
    };
    return (status && map[status]) ?? 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]';
  });

  statusDotClass = computed(() => {
    const status = this.ticketData()?.status;
    const map: Record<string, string> = {
      'In Progress': 'bg-[var(--color-primary-solid)]',
      'In Review':   'bg-amber-400',
      'Done':        'bg-emerald-500',
      'To Do':       'bg-stone-400',
    };
    return (status && map[status]) ?? 'bg-stone-400';
  });
}
