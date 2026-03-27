import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { JiraTicket } from '../../models/work-item.model';
import { JiraMarkupPipe } from '../../pipes/jira-markup.pipe';
import { SubTaskListComponent } from '../sub-task-list/sub-task-list';
import { SubTask } from '../../models/sub-task.model';
import { TicketLocalDataService } from '../../services/ticket-local-data.service';

type CollapsibleSection = 'relations' | 'comments' | 'attachments';

@Component({
  selector: 'app-ticket-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JiraMarkupPipe, SubTaskListComponent],
  styles: [`
    @keyframes ticketFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    :host {
      display: block;
      animation: ticketFadeIn 0.15s ease-out;
    }
  `],
  template: `
    <article [attr.aria-label]="ticket().key + ': ' + ticket().summary">

      <!-- ── Sticky header ─────────────────────────────────────────── -->
      <header class="sticky top-0 z-10 bg-[var(--color-bg-card)] border-b border-[var(--color-border-subtle)]">
        <div class="max-w-2xl mx-auto relative">
          <div class="absolute left-0 top-0 bottom-0 w-[3px]" [class]="statusStripeClass()" aria-hidden="true"></div>

          <div class="px-6 pt-5 pb-4 pl-7">
            <!-- Top row: type · key  +  Jira link -->
            <div class="flex items-center justify-between gap-3 mb-3">
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium shrink-0"
                  [class]="issueTypeBadgeClass()"
                >
                  @switch (issueTypeKey()) {
                    @case ('bug') {
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>
                    }
                    @case ('story') {
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    }
                    @case ('epic') {
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    }
                    @default {
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                    }
                  }
                  {{ ticket().issueType }}
                </span>

                <span class="text-[var(--color-text-muted)]" aria-hidden="true">·</span>
                <span class="font-mono text-sm font-bold text-[var(--color-primary-text)] tracking-wide shrink-0">{{ ticket().key }}</span>
              </div>

            </div>

            <!-- Summary -->
            <h1 class="text-lg font-semibold text-[var(--color-text-heading)] leading-snug mb-3">{{ ticket().summary }}</h1>

            <!-- Status + Labels -->
            <div class="flex items-center gap-2 flex-wrap mb-2.5">
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border"
                [class]="statusBadgeClass()"
              >
                <span class="w-1.5 h-1.5 rounded-full" [class]="statusDotClass()" aria-hidden="true"></span>
                {{ ticket().status }}
              </span>
              @for (label of ticket().labels; track label) {
                <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  {{ label }}
                </span>
              }
            </div>

            <!-- Meta -->
            <p class="text-xs text-[var(--color-text-muted)] leading-relaxed">
              von <span class="text-[var(--color-text-muted)] font-medium">{{ ticket().creator }}</span>
              <span aria-hidden="true"> · </span>erstellt {{ formatDate(ticket().createdAt) }}
              <span aria-hidden="true"> · </span>geändert {{ formatDate(ticket().updatedAt) }}
            </p>
          </div>
        </div>
      </header>

      <!-- ── Body ──────────────────────────────────────────────────── -->

      <!-- Description -->
      <section class="border-b border-[var(--color-border-subtle)]" aria-labelledby="desc-heading">
        <div class="max-w-2xl mx-auto px-6 py-5">
          <h2 id="desc-heading" class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Beschreibung</h2>
          @if (ticket().description) {
            <div class="jira-markup" [innerHTML]="ticket().description | jiraMarkup"></div>
          } @else {
            <p class="text-sm text-[var(--color-text-muted)] italic">Keine Beschreibung vorhanden.</p>
          }
        </div>
      </section>

      <div class="border-b border-[var(--color-border-subtle)]">
        <div class="max-w-2xl mx-auto px-6 py-5">
          <app-sub-task-list
            [subtasks]="ticketLocalData.subtasks()"
            (subtasksChange)="onSubtasksChange($event)"
          />
        </div>
      </div>

      <!-- Epic Link -->
      @if (ticket().epicLink) {
        <section class="border-b border-[var(--color-border-subtle)]">
          <div class="max-w-2xl mx-auto px-6 py-3.5 flex items-center gap-3">
            <span class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider shrink-0">Epic</span>
            <span class="font-mono text-xs font-bold text-violet-600">{{ ticket().epicLink }}</span>
          </div>
        </section>
      }

      <!-- Components -->
      @if (ticket().components.length) {
        <section class="border-b border-[var(--color-border-subtle)]" aria-label="Komponenten">
          <div class="max-w-2xl mx-auto px-6 py-3.5 flex items-center gap-3 flex-wrap">
            <span class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider shrink-0">Komponenten</span>
            @for (comp of ticket().components; track comp) {
              <span class="text-xs text-[var(--color-text-body)] bg-[var(--color-bg-surface)] rounded px-2 py-0.5 border border-[var(--color-border-subtle)]">{{ comp }}</span>
            }
          </div>
        </section>
      }

      <!-- Relations -->
      @if (ticket().relations.length) {
        <section class="border-b border-[var(--color-border-subtle)]" aria-labelledby="relations-heading">
          <div class="max-w-2xl mx-auto">
            <button
              class="w-full flex items-center justify-between px-6 py-3.5 text-left hover:bg-[var(--color-bg-surface)] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-focus-ring)]"
              (click)="toggleSection('relations')"
              [attr.aria-expanded]="expandedSections().has('relations')"
              aria-controls="relations-content"
            >
              <div class="flex items-center gap-2">
                <h2 id="relations-heading" class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Verknüpfungen</h2>
                <span class="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] rounded-full bg-[var(--color-bg-surface)] text-[var(--color-text-body)] text-[10px] font-bold px-1" aria-label="{{ ticket().relations.length }} Verknüpfungen">{{ ticket().relations.length }}</span>
              </div>
              <svg
                class="w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform duration-150"
                [class.rotate-180]="expandedSections().has('relations')"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                aria-hidden="true"
              ><path d="m6 9 6 6 6-6"/></svg>
            </button>
            @if (expandedSections().has('relations')) {
              <div id="relations-content" class="px-6 pb-4 space-y-2.5">
                @for (rel of ticket().relations; track rel.key) {
                  <div class="flex items-baseline gap-2">
                    <span class="text-xs text-[var(--color-text-muted)] shrink-0 w-32">{{ rel.relationLabel }}</span>
                    <a
                      [href]="rel.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="group flex items-baseline gap-1.5 flex-1 min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] rounded"
                    >
                      <span class="font-mono text-xs font-bold text-[var(--color-primary-text)] shrink-0">{{ rel.key }}</span>
                      <span class="text-xs text-[var(--color-text-body)] truncate group-hover:text-[var(--color-primary-text)] transition-colors duration-150">{{ rel.summary }}</span>
                    </a>
                    <span class="text-xs text-[var(--color-text-muted)] shrink-0">{{ rel.status }}</span>
                  </div>
                }
              </div>
            }
          </div>
        </section>
      }

      <!-- Comments -->
      @if (ticket().comments.length) {
        <section class="border-b border-[var(--color-border-subtle)]" aria-labelledby="comments-heading">
          <div class="max-w-2xl mx-auto">
            <button
              class="w-full flex items-center justify-between px-6 py-3.5 text-left hover:bg-[var(--color-bg-surface)] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-focus-ring)]"
              (click)="toggleSection('comments')"
              [attr.aria-expanded]="expandedSections().has('comments')"
              aria-controls="comments-content"
            >
              <div class="flex items-center gap-2">
                <h2 id="comments-heading" class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Kommentare</h2>
                <span class="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] rounded-full bg-[var(--color-bg-surface)] text-[var(--color-text-body)] text-[10px] font-bold px-1" aria-label="{{ ticket().comments.length }} Kommentare">{{ ticket().comments.length }}</span>
              </div>
              <svg
                class="w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform duration-150"
                [class.rotate-180]="expandedSections().has('comments')"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                aria-hidden="true"
              ><path d="m6 9 6 6 6-6"/></svg>
            </button>
            @if (expandedSections().has('comments')) {
              <div id="comments-content" class="px-6 pb-4 space-y-4">
                @for (comment of ticket().comments; track comment.id) {
                  <div class="border-l-2 border-[var(--color-border-subtle)] pl-3">
                    <div class="flex items-center gap-2 mb-1.5">
                      <span class="text-xs font-semibold text-[var(--color-text-body)]">{{ comment.author }}</span>
                      <span class="text-xs text-[var(--color-text-muted)]">{{ formatDate(comment.createdAt) }}</span>
                    </div>
                    <div class="jira-markup" [innerHTML]="comment.body | jiraMarkup"></div>
                  </div>
                }
              </div>
            }
          </div>
        </section>
      }

      <!-- Attachments -->
      @if (ticket().attachments.length) {
        <section class="border-b border-[var(--color-border-subtle)]" aria-labelledby="attachments-heading">
          <div class="max-w-2xl mx-auto">
            <button
              class="w-full flex items-center justify-between px-6 py-3.5 text-left hover:bg-[var(--color-bg-surface)] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-focus-ring)]"
              (click)="toggleSection('attachments')"
              [attr.aria-expanded]="expandedSections().has('attachments')"
              aria-controls="attachments-content"
            >
              <div class="flex items-center gap-2">
                <h2 id="attachments-heading" class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Anhänge</h2>
                <span class="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] rounded-full bg-[var(--color-bg-surface)] text-[var(--color-text-body)] text-[10px] font-bold px-1" aria-label="{{ ticket().attachments.length }} Anhänge">{{ ticket().attachments.length }}</span>
              </div>
              <svg
                class="w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform duration-150"
                [class.rotate-180]="expandedSections().has('attachments')"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                aria-hidden="true"
              ><path d="m6 9 6 6 6-6"/></svg>
            </button>
            @if (expandedSections().has('attachments')) {
              <div id="attachments-content" class="px-6 pb-4">
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
                        <div class="aspect-video bg-[var(--color-bg-surface)] rounded-md overflow-hidden border border-[var(--color-border-subtle)] group-hover:border-[var(--color-primary-border)] transition-colors duration-150">
                          <img [src]="attachment.thumbnail" [alt]="attachment.filename" class="w-full h-full object-cover" />
                        </div>
                      } @else {
                        <div class="aspect-video bg-[var(--color-bg-surface)] rounded-md border border-[var(--color-border-subtle)] group-hover:border-[var(--color-primary-border)] transition-colors duration-150 flex items-center justify-center">
                          <svg class="w-5 h-5 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </div>
                      }
                      <p class="text-xs text-[var(--color-text-muted)] mt-1 truncate group-hover:text-[var(--color-primary-text)] transition-colors duration-150">{{ attachment.filename }}</p>
                    </a>
                  }
                </div>
              </div>
            }
          </div>
        </section>
      }

      <!-- Spacer -->
      <div class="h-6" aria-hidden="true"></div>
    </article>
  `,
})
export class TicketDetailComponent {
  ticket = input.required<JiraTicket>();

  protected readonly ticketLocalData = inject(TicketLocalDataService);

  constructor() {
    effect(() => {
      const key = this.ticket().key;
      this.ticketLocalData.loadForTicket(key);
    });
  }

  expandedSections = signal<Set<CollapsibleSection>>(new Set(['relations', 'comments', 'attachments']));

  issueTypeKey = computed(() => {
    const t = this.ticket().issueType.toLowerCase();
    if (t.includes('bug') || t.includes('fehler')) return 'bug';
    if (t.includes('story')) return 'story';
    if (t.includes('epic')) return 'epic';
    if (t.includes('sub')) return 'sub';
    return 'task';
  });

  onSubtasksChange(subtasks: SubTask[]): void {
    this.ticketLocalData.saveSubtasks(subtasks);
  }

  toggleSection(section: CollapsibleSection): void {
    this.expandedSections.update(current => {
      const next = new Set(current);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  statusStripeClass(): string {
    const map: Record<string, string> = {
      'In Progress': 'bg-violet-400',
      'In Review': 'bg-violet-400',
      'Done': 'bg-emerald-500',
      'To Do': 'bg-stone-300',
    };
    return map[this.ticket().status] ?? 'bg-stone-300';
  }

  statusBadgeClass(): string {
    const map: Record<string, string> = {
      'In Progress': 'bg-[var(--color-primary-bg)] text-[var(--color-primary-text)] border-[var(--color-primary-border)]',
      'In Review': 'bg-[var(--color-primary-bg)] text-[var(--color-primary-text)] border-[var(--color-primary-border)]',
      'Done': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'To Do': 'bg-[var(--color-bg-surface)] text-[var(--color-text-body)] border-[var(--color-border-subtle)]',
    };
    return map[this.ticket().status] ?? 'bg-[var(--color-bg-surface)] text-[var(--color-text-body)] border-[var(--color-border-subtle)]';
  }

  statusDotClass(): string {
    const map: Record<string, string> = {
      'In Progress': 'bg-violet-400',
      'In Review': 'bg-violet-400',
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
    return 'bg-[var(--color-type-badge-bg)] text-[var(--color-type-badge-text)] border border-[var(--color-type-badge-border)]';
  }
}
