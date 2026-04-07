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
import {
  LucideBug,
  LucideBookmark,
  LucideZap,
  LucideSquareCheck,
  LucideFile,
  LucideGrid2x2,
  LucideLink,
  LucideMessageSquare,
  LucidePaperclip,
} from '@lucide/angular';

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
    LucideBug,
    LucideBookmark,
    LucideZap,
    LucideSquareCheck,
    LucideFile,
    LucideGrid2x2,
    LucideLink,
    LucideMessageSquare,
    LucidePaperclip,
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
                      <svg lucideBug [size]="12"></svg>
                    }
                    @case ('story') {
                      <svg lucideBookmark [size]="12"></svg>
                    }
                    @case ('epic') {
                      <svg lucideZap [size]="12"></svg>
                    }
                    @default {
                      <svg lucideSquareCheck [size]="12"></svg>
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
          <svg lucideFile sectionIcon [size]="16" class="text-[var(--color-text-muted)] shrink-0"></svg>
          @if (ticket().description) {
            <div class="jira-markup" [innerHTML]="ticket().description | jiraMarkup"></div>
          } @else {
            <p class="text-sm text-[var(--color-text-muted)] italic">
              Keine Beschreibung vorhanden.
            </p>
          }
        </app-collapsible-section>

        <app-collapsible-section label="Teilaufgaben" [expanded]="true">
          <svg lucideSquareCheck sectionIcon [size]="16" class="text-[var(--color-text-muted)] shrink-0"></svg>
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
            <svg lucideZap sectionIcon [size]="16" class="text-[var(--color-text-muted)] shrink-0"></svg>
            <span class="font-mono text-xs font-bold text-violet-600">{{ ticket().epicLink }}</span>
          </app-collapsible-section>
        }

        @if (ticket().components.length) {
          <app-collapsible-section label="Komponenten">
            <svg lucideGrid2x2 sectionIcon [size]="16" class="text-[var(--color-text-muted)] shrink-0"></svg>
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
            <svg lucideLink sectionIcon [size]="16" class="text-[var(--color-text-muted)] shrink-0"></svg>
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
            <svg lucideMessageSquare sectionIcon [size]="16" class="text-[var(--color-text-muted)] shrink-0"></svg>
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
            <svg lucidePaperclip sectionIcon [size]="16" class="text-[var(--color-text-muted)] shrink-0"></svg>
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
                      <svg lucideFile [size]="20" [strokeWidth]="1.5" class="text-[var(--color-text-muted)]"></svg>
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
