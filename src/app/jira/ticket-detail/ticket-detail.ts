import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { JiraTicket } from '../../shared/work-item.model';
import { JiraMarkupPipe } from '../jira-markup.pipe';
import { SubTaskListComponent } from '../../shared/sub-task-list/sub-task-list';
import { SubTask } from '../../todos/sub-task.model';
import { TicketSubtaskService } from '../ticket-subtask.service';
import { CompactHeaderBarComponent } from '../../shared/compact-header-bar/compact-header-bar';
import { DetailActionBarComponent } from '../../shared/detail-action-bar/detail-action-bar';
import { CollapsibleSectionComponent } from '../../shared/collapsible-section/collapsible-section';
import { BadgeColor, BadgeComponent } from '../../shared/badge/badge';

@Component({
  selector: 'app-ticket-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JiraMarkupPipe,
    SubTaskListComponent,
    CompactHeaderBarComponent,
    DetailActionBarComponent,
    CollapsibleSectionComponent,
    BadgeComponent,
  ],
  styles: [
    `
      @keyframes ticketFadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      :host {
        display: block;
        animation: ticketFadeIn 0.15s ease-out;
      }
    `,
  ],
  template: `
    <article [attr.aria-label]="ticket().key + ': ' + ticket().summary">
      <app-compact-header-bar
        [visible]="showCompactBar()"
        [title]="ticket().summary"
        [statusLabel]="ticket().status"
        [statusColor]="statusColor()"
        [stripeColor]="statusStripeClass()"
        [prefix]="ticket().key"
      />

      <header class="bg-[var(--color-bg-card)] border-b border-[var(--color-border-subtle)]">
        <div class="max-w-2xl mx-auto relative">
          <div
            class="absolute left-0 top-0 bottom-0 w-[3px]"
            [class]="statusStripeClass()"
            aria-hidden="true"
          ></div>

          <div class="px-6 pt-5 pb-4 pl-7">
            <div class="flex items-center justify-between gap-3 mb-3">
              <div class="flex items-center gap-2 min-w-0">
                <orbit-badge color="neutral">
                  @switch (issueTypeKey()) {
                    @case ('bug') {
                      <svg
                        class="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m8 2 1.88 1.88" />
                        <path d="M14.12 3.88 16 2" />
                        <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
                        <path
                          d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z"
                        />
                        <path d="M12 20v-9" />
                        <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
                        <path d="M6 13H2" />
                        <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
                        <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
                        <path d="M22 13h-4" />
                        <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
                      </svg>
                    }
                    @case ('story') {
                      <svg
                        class="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                    }
                    @case ('epic') {
                      <svg
                        class="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    }
                    @default {
                      <svg
                        class="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                    }
                  }
                  {{ ticket().issueType }}
                </orbit-badge>

                <span class="text-[var(--color-text-muted)]" aria-hidden="true">·</span>
                <span
                  class="font-mono text-sm font-bold text-[var(--color-primary-text)] tracking-wide shrink-0"
                  >{{ ticket().key }}</span
                >
              </div>
            </div>

            <h1 class="text-lg font-semibold text-[var(--color-text-heading)] leading-snug mb-3">
              {{ ticket().summary }}
            </h1>

            <div class="flex items-center gap-2 flex-wrap mb-2.5">
              <orbit-badge [color]="statusColor()" [status]="true">{{
                ticket().status
              }}</orbit-badge>
              @for (label of ticket().labels; track label) {
                <orbit-badge color="neutral">{{ label }}</orbit-badge>
              }
            </div>

            <p class="text-xs text-[var(--color-text-muted)] leading-relaxed">
              von
              <span class="text-[var(--color-text-muted)] font-medium">{{ ticket().creator }}</span>
              <span aria-hidden="true"> · </span>erstellt {{ formatDate(ticket().createdAt) }}
              <span aria-hidden="true"> · </span>geändert {{ formatDate(ticket().updatedAt) }}
            </p>
          </div>

          <app-detail-action-bar [item]="ticket()" />
        </div>
      </header>

      <div #headerSentinel></div>

      <div class="max-w-2xl mx-auto space-y-3 py-4 px-2">
        <app-collapsible-section label="Beschreibung" [expanded]="true">
          <svg
            sectionIcon
            class="w-4 h-4 text-[var(--color-text-muted)] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
          </svg>
          @if (ticket().description) {
            <div class="jira-markup" [innerHTML]="ticket().description | jiraMarkup"></div>
          } @else {
            <p class="text-sm text-[var(--color-text-muted)] italic">
              Keine Beschreibung vorhanden.
            </p>
          }
        </app-collapsible-section>

        <app-collapsible-section label="Teilaufgaben" [expanded]="true">
          <svg
            sectionIcon
            class="w-4 h-4 text-[var(--color-text-muted)] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <ng-container sectionMeta>
            <span class="text-xs text-[var(--color-text-muted)]">{{
              subtaskCounter(ticketSubtaskService.subtasks())
            }}</span>
          </ng-container>
          <app-sub-task-list
            [subtasks]="ticketSubtaskService.subtasks()"
            [showHeader]="false"
            (subtasksChange)="onSubtasksChange($event)"
          />
        </app-collapsible-section>

        @if (ticket().epicLink) {
          <app-collapsible-section label="Epic">
            <svg
              sectionIcon
              class="w-4 h-4 text-[var(--color-text-muted)] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span class="font-mono text-xs font-bold text-violet-600">{{ ticket().epicLink }}</span>
          </app-collapsible-section>
        }

        @if (ticket().components.length) {
          <app-collapsible-section label="Komponenten">
            <svg
              sectionIcon
              class="w-4 h-4 text-[var(--color-text-muted)] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <ng-container sectionMeta>
              <span class="text-xs text-[var(--color-text-muted)]">{{
                ticket().components.length
              }}</span>
            </ng-container>
            <div class="flex items-center gap-2 flex-wrap">
              @for (comp of ticket().components; track comp) {
                <orbit-badge color="neutral">{{ comp }}</orbit-badge>
              }
            </div>
          </app-collapsible-section>
        }

        @if (ticket().relations.length) {
          <app-collapsible-section label="Verknüpfungen" [expanded]="true">
            <svg
              sectionIcon
              class="w-4 h-4 text-[var(--color-text-muted)] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <ng-container sectionMeta>
              <span class="text-xs text-[var(--color-text-muted)]">{{
                ticket().relations.length
              }}</span>
            </ng-container>
            <div class="space-y-2.5">
              @for (rel of ticket().relations; track rel.key) {
                <div class="flex items-baseline gap-2">
                  <span class="text-xs text-[var(--color-text-muted)] shrink-0 w-32">{{
                    rel.relationLabel
                  }}</span>
                  <a
                    [href]="rel.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="group flex items-baseline gap-1.5 flex-1 min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] rounded"
                  >
                    <span
                      class="font-mono text-xs font-bold text-[var(--color-primary-text)] shrink-0"
                      >{{ rel.key }}</span
                    >
                    <span
                      class="text-xs text-[var(--color-text-body)] truncate group-hover:text-[var(--color-primary-text)] transition-colors duration-150"
                      >{{ rel.summary }}</span
                    >
                  </a>
                  <span class="text-xs text-[var(--color-text-muted)] shrink-0">{{
                    rel.status
                  }}</span>
                </div>
              }
            </div>
          </app-collapsible-section>
        }

        @if (ticket().comments.length) {
          <app-collapsible-section label="Kommentare" [expanded]="true">
            <svg
              sectionIcon
              class="w-4 h-4 text-[var(--color-text-muted)] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <ng-container sectionMeta>
              <span class="text-xs text-[var(--color-text-muted)]">{{
                ticket().comments.length
              }}</span>
            </ng-container>
            <div class="space-y-4">
              @for (comment of ticket().comments; track comment.id) {
                <div class="border-l-2 border-[var(--color-border-subtle)] pl-3">
                  <div class="flex items-center gap-2 mb-1.5">
                    <span class="text-xs font-semibold text-[var(--color-text-body)]">{{
                      comment.author
                    }}</span>
                    <span class="text-xs text-[var(--color-text-muted)]">{{
                      formatDate(comment.createdAt)
                    }}</span>
                  </div>
                  <div class="jira-markup" [innerHTML]="comment.body | jiraMarkup"></div>
                </div>
              }
            </div>
          </app-collapsible-section>
        }

        @if (ticket().attachments.length) {
          <app-collapsible-section label="Anhänge" [expanded]="true">
            <svg
              sectionIcon
              class="w-4 h-4 text-[var(--color-text-muted)] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"
              />
            </svg>
            <ng-container sectionMeta>
              <span class="text-xs text-[var(--color-text-muted)]">{{
                ticket().attachments.length
              }}</span>
            </ng-container>
            <div class="grid grid-cols-3 gap-2">
              @for (attachment of ticket().attachments; track attachment.id) {
                <a
                  [href]="attachment.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] rounded-md"
                  [attr.aria-label]="attachment.filename + ' öffnen'"
                >
                  @if (attachment.thumbnail) {
                    <div
                      class="aspect-video bg-[var(--color-bg-surface)] rounded-md overflow-hidden border border-[var(--color-border-subtle)] group-hover:border-[var(--color-primary-border)] transition-colors duration-150"
                    >
                      <img
                        [src]="attachment.thumbnail"
                        [alt]="attachment.filename"
                        class="w-full h-full object-cover"
                      />
                    </div>
                  } @else {
                    <div
                      class="aspect-video bg-[var(--color-bg-surface)] rounded-md border border-[var(--color-border-subtle)] group-hover:border-[var(--color-primary-border)] transition-colors duration-150 flex items-center justify-center"
                    >
                      <svg
                        class="w-5 h-5 text-[var(--color-text-muted)]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <path
                          d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
                        />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                  }
                  <p
                    class="text-xs text-[var(--color-text-muted)] mt-1 truncate group-hover:text-[var(--color-primary-text)] transition-colors duration-150"
                  >
                    {{ attachment.filename }}
                  </p>
                </a>
              }
            </div>
          </app-collapsible-section>
        }

        <div class="h-4" aria-hidden="true"></div>
      </div>
    </article>
  `,
})
export class TicketDetailComponent {
  ticket = input.required<JiraTicket>();

  protected readonly ticketSubtaskService = inject(TicketSubtaskService);
  private readonly destroyRef = inject(DestroyRef);

  readonly showCompactBar = signal(false);
  private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('headerSentinel');

  constructor() {
    effect(() => {
      const key = this.ticket().key;
      this.ticketSubtaskService.loadForTicket(key);
    });

    afterNextRender(() => {
      const sentinel = this.scrollSentinel()?.nativeElement;
      if (!sentinel) return;
      const observer = new IntersectionObserver(
        ([entry]) => this.showCompactBar.set(!entry.isIntersecting),
        { threshold: 0 },
      );
      observer.observe(sentinel);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  issueTypeKey = computed(() => {
    const t = this.ticket().issueType.toLowerCase();
    if (t.includes('bug') || t.includes('fehler')) return 'bug';
    if (t.includes('story')) return 'story';
    if (t.includes('epic')) return 'epic';
    if (t.includes('sub')) return 'sub';
    return 'task';
  });

  readonly statusColor = computed((): BadgeColor => {
    const status = this.ticket().status?.toLowerCase();
    if (status === 'done' || status === 'erledigt' || status === 'closed') return 'success';
    if (
      status === 'in progress' ||
      status === 'in arbeit' ||
      status === 'in review' ||
      status === 'im review'
    )
      return 'primary';
    return 'neutral';
  });

  onSubtasksChange(subtasks: SubTask[]): void {
    this.ticketSubtaskService.saveSubtasks(subtasks);
  }

  subtaskCounter(subtasks: SubTask[]): string {
    const done = subtasks.filter((s) => s.status === 'done').length;
    return `${done}/${subtasks.length}`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  statusStripeClass(): string {
    const map: Record<string, string> = {
      'In Progress': 'bg-violet-400',
      'In Review': 'bg-violet-400',
      Done: 'bg-emerald-500',
      'To Do': 'bg-stone-300',
    };
    return map[this.ticket().status] ?? 'bg-stone-300';
  }
}
