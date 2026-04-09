import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { JiraTicket } from '../../shared/work-item.model';
import { TicketSubtaskService } from '../ticket-subtask.service';
import { BadgeColor, BadgeComponent } from '../../shared/badge/badge';
import {
  LucideBug,
  LucideBookmark,
  LucideZap,
  LucideSquareCheck,
  LucideExternalLink,
  LucideListChecks,
} from '@lucide/angular';

@Component({
  selector: 'app-ticket-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    LucideBug,
    LucideBookmark,
    LucideZap,
    LucideSquareCheck,
    LucideExternalLink,
    LucideListChecks,
  ],
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
            <orbit-badge color="neutral" size="sm">
              @switch (issueTypeKey()) {
                @case ('bug') {
                  <svg lucideBug [size]="10" class="shrink-0"></svg>
                }
                @case ('story') {
                  <svg lucideBookmark [size]="10" class="shrink-0"></svg>
                }
                @case ('epic') {
                  <svg lucideZap [size]="10" class="shrink-0"></svg>
                }
                @default {
                  <svg lucideSquareCheck [size]="10" class="shrink-0"></svg>
                }
              }
              {{ ticket().issueType }}
            </orbit-badge>

            <span
              class="font-mono text-[11px] font-bold tracking-wide shrink-0"
              [class]="
                selected() ? 'text-[var(--color-primary-text)]' : 'text-[var(--color-text-muted)]'
              "
              >{{ ticket().key }}</span
            >
          </div>

          <a
            [href]="ticket().url"
            target="_blank"
            rel="noopener noreferrer"
            class="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-primary-solid)] transition-all duration-150 rounded p-0.5 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)]"
            [attr.aria-label]="'Öffne ' + ticket().key + ' in Jira'"
            (click)="$event.stopPropagation()"
          >
            <svg lucideExternalLink [size]="12" [strokeWidth]="2.5"></svg>
          </a>
        </div>

        <p
          class="text-[13px] font-medium leading-snug line-clamp-2 mb-1.5"
          [class]="
            selected() ? 'text-[var(--color-text-heading)]' : 'text-[var(--color-text-heading)]'
          "
        >
          {{ ticket().summary }}
        </p>

        <div class="flex items-center gap-1.5 flex-wrap">
          <orbit-badge [color]="statusColor()" [status]="true" size="sm">{{
            ticket().status
          }}</orbit-badge>

          @if (ticket().labels.length) {
            <span class="text-[10px] font-medium text-amber-600 truncate max-w-[100px]">{{
              ticket().labels[0]
            }}</span>
          }
          @if (hasSubtasks()) {
            <span
              class="inline-flex items-center gap-1 ml-auto text-[10px]"
              [attr.aria-label]="subtaskDone() + ' von ' + subtaskTotal() + ' Aufgaben erledigt'"
            >
              <svg
                lucideListChecks
                [size]="12"
                [strokeWidth]="2.5"
                [class]="subtaskIndicatorClass().icon"
              ></svg>
              <span style="font-variant-numeric: tabular-nums;">
                <span [class]="subtaskDoneTextClass()">{{ subtaskDone() }}</span
                ><span class="text-[var(--color-text-muted)]">/{{ subtaskTotal() }}</span>
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

  private readonly ticketSubtaskService = inject(TicketSubtaskService);

  readonly ticketSubtasks = computed(() =>
    this.ticketSubtaskService.getSubtasksForKey(this.ticket().key),
  );
  readonly subtaskDone = computed(
    () => this.ticketSubtasks().filter((s) => s.status === 'done').length,
  );
  readonly subtaskTotal = computed(() => this.ticketSubtasks().length);
  readonly hasSubtasks = computed(() => this.subtaskTotal() > 0);
  readonly subtaskAllDone = computed(
    () => this.hasSubtasks() && this.subtaskDone() === this.subtaskTotal(),
  );

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

    const base =
      'group relative w-full text-left rounded-lg overflow-hidden transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]';

    let classes = sel
      ? `${base} bg-[var(--color-card-selected-bg)] shadow-sm ring-1 ring-[var(--color-card-selected-ring)]`
      : `${base} bg-[var(--color-bg-card)] ring-1 ring-[var(--color-border-subtle)] hover:ring-[var(--color-border-default)]`;

    if (state === 'inactive') {
      classes += ' opacity-[var(--card-inactive-opacity)]';
    } else if (state === 'attention') {
      classes = classes.replace('rounded-lg', 'rounded-r-lg rounded-l-none');
      classes += ' border-l-4 border-l-[var(--color-card-attention-bar)]';
    }

    return classes;
  });

  readonly subtaskIndicatorClass = computed(() => {
    if (this.subtaskAllDone())
      return { icon: 'stroke-emerald-600', text: 'text-emerald-600 font-semibold' };
    if (this.subtaskDone() > 0)
      return {
        icon: 'stroke-[var(--color-primary-solid)]',
        text: 'text-[var(--color-text-muted)]',
      };
    return { icon: 'stroke-[var(--color-text-muted)]', text: 'text-[var(--color-text-muted)]' };
  });

  readonly subtaskDoneTextClass = computed(() => {
    if (this.subtaskAllDone()) return 'text-emerald-600 font-semibold';
    if (this.subtaskDone() > 0) return 'text-[var(--color-primary-text)] font-semibold';
    return 'text-[var(--color-text-muted)] font-semibold';
  });

  issueTypeKey = computed(() => {
    const t = this.ticket().issueType.toLowerCase();
    if (t.includes('bug') || t.includes('fehler')) return 'bug';
    if (t.includes('story')) return 'story';
    if (t.includes('epic')) return 'epic';
    if (t.includes('sub')) return 'sub';
    return 'task';
  });

  readonly statusColor = computed((): BadgeColor => {
    const map: Record<string, BadgeColor> = {
      'In Progress': 'primary',
      'In Review': 'primary',
      Done: 'success',
      'To Do': 'neutral',
    };
    return map[this.ticket().status] ?? 'neutral';
  });
}
