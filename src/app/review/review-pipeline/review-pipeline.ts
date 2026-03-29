import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { ConsolidatorDecision, PipelineState } from '../review.model';
import { BadgeColor, BadgeComponent } from '../../shared/badge/badge';

@Component({
  selector: 'app-review-pipeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, BadgeComponent],
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
  template: `
    @let p = pipeline();
    @if (p.agents.length > 0) {
      <div class="border-b border-[var(--color-border-subtle)]">
        <button
          type="button"
          class="px-6 py-2.5 flex items-center gap-2 text-xs text-[var(--color-text-muted)] w-full cursor-pointer hover:text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface)] transition-colors"
          [attr.aria-expanded]="sectionOpen()"
          aria-controls="pipeline-content"
          (click)="sectionOpen.set(!sectionOpen())"
        >
          <h2
            id="pipeline-heading"
            class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
          >
            Review-Pipeline
          </h2>
          @if (p.totalDuration != null) {
            <span class="font-mono text-xs text-[var(--color-text-muted)]">{{
              formatDuration(p.totalDuration!)
            }}</span>
          }
          <svg
            class="w-3 h-3 text-[var(--color-text-muted)] ml-auto transition-transform duration-150"
            [class.rotate-180]="sectionOpen()"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </button>

        @if (sectionOpen()) {
          <div id="pipeline-content" class="mt-3 space-y-3 px-6 pb-5">
            @for (agent of p.agents; track agent.agent) {
              <div class="flex gap-3">
                <span
                  class="mt-[5px] w-3 h-3 shrink-0 rounded-full"
                  [class]="statusDotClass(agent.status)"
                  [attr.data-status]="agent.status"
                  aria-hidden="true"
                ></span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline gap-2 flex-wrap">
                    <span class="text-sm font-medium text-[var(--color-text-body)]">{{
                      agent.label
                    }}</span>
                    <span class="text-xs" [class]="statusTextClass(agent.status)">{{
                      statusText(agent.status)
                    }}</span>
                    <orbit-badge color="neutral" size="sm">T={{ agent.temperature }}</orbit-badge>
                    @if (agent.thinkingBudget != null) {
                      <orbit-badge color="neutral" size="sm"
                        >TB={{ agent.thinkingBudget }}</orbit-badge
                      >
                    }
                    @if (agent.duration != null) {
                      <span class="font-mono text-xs text-[var(--color-text-muted)]">{{
                        formatDuration(agent.duration!)
                      }}</span>
                    }
                  </div>
                  <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {{ agentDescription(agent.agent) }}
                  </p>
                  @if (agent.summary) {
                    <p class="text-xs text-[var(--color-text-muted)] mt-1">{{ agent.summary }}</p>
                  }
                  @if (agent.error) {
                    <p class="text-xs text-red-600 mt-1">{{ agent.error }}</p>
                  }
                  @if (agent.thoughts || agent.rawResponse != null) {
                    <div class="mt-1.5">
                      <button
                        type="button"
                        class="text-[11px] text-[var(--color-text-muted)] font-medium cursor-pointer hover:text-[var(--color-text-body)] inline-flex items-center gap-1"
                        (click)="toggleAgentDetails(agent.agent)"
                      >
                        <svg
                          class="w-3 h-3 transition-transform duration-150"
                          [class.rotate-90]="isAgentDetailsOpen(agent.agent)"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path d="M4 2l4 4-4 4" />
                        </svg>
                        Details anzeigen
                      </button>
                      @if (isAgentDetailsOpen(agent.agent)) {
                        <div class="mt-2 space-y-2">
                          @if (agent.thoughts) {
                            <div>
                              <span
                                class="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                                >Denkprozess</span
                              >
                              <pre
                                class="mt-1 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-body)] font-mono text-[11px] p-3 rounded-md overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed"
                                >{{ agent.thoughts }}</pre
                              >
                            </div>
                          }
                          @if (agent.rawResponse != null) {
                            <div>
                              <span
                                class="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                                >JSON-Antwort</span
                              >
                              <pre
                                class="mt-1 bg-stone-900 text-stone-300 font-mono text-[11px] p-3 rounded-md overflow-x-auto max-h-48"
                                >{{ agent.rawResponse | json }}</pre
                              >
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            }

            @if (showConsolidator()) {
              <div class="flex gap-3">
                <span
                  class="mt-[5px] w-3 h-3 shrink-0 rounded-full"
                  [class]="
                    statusDotClass(
                      p.consolidator.status === 'pending' ? 'done' : p.consolidator.status
                    )
                  "
                  [attr.data-status]="p.consolidator.status"
                  aria-hidden="true"
                ></span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline gap-2 flex-wrap">
                    <span class="text-sm font-medium text-[var(--color-text-body)]"
                      >Konsolidierer</span
                    >
                    <span class="text-xs" [class]="statusTextClass(consolidatorDisplayStatus())">{{
                      statusText(consolidatorDisplayStatus())
                    }}</span>
                    @if (p.consolidator.temperature != null) {
                      <orbit-badge color="neutral" size="sm"
                        >T={{ p.consolidator.temperature }}</orbit-badge
                      >
                    }
                    @if (p.consolidator.thinkingBudget != null) {
                      <orbit-badge color="neutral" size="sm"
                        >TB={{ p.consolidator.thinkingBudget }}</orbit-badge
                      >
                    }
                    @if (p.consolidator.duration != null) {
                      <span class="font-mono text-xs text-[var(--color-text-muted)]">{{
                        formatDuration(p.consolidator.duration!)
                      }}</span>
                    }
                  </div>
                  <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {{ consolidatorDescription }}
                  </p>
                  @if (p.consolidator.summary) {
                    <p class="text-xs text-[var(--color-text-muted)] mt-1">
                      {{ p.consolidator.summary }}
                    </p>
                  }
                  @if (p.consolidator.error) {
                    <p class="text-xs text-red-600 mt-1">{{ p.consolidator.error }}</p>
                  }
                  @if (p.consolidator.decisions && p.consolidator.decisions.length > 0) {
                    <div class="mt-2 space-y-1.5">
                      @for (decision of p.consolidator.decisions; track decision.finding) {
                        <div class="flex items-start gap-2 text-xs">
                          <orbit-badge [color]="decisionColor(decision.action)" size="sm">{{
                            decisionLabel(decision.action)
                          }}</orbit-badge>
                          <span class="text-[var(--color-text-body)]">{{ decision.finding }}</span>
                          <span class="text-[var(--color-text-muted)] italic">{{
                            decision.reason
                          }}</span>
                        </div>
                      }
                    </div>
                  }
                  @if (p.consolidator.thoughts || p.consolidator.rawResponse != null) {
                    <div class="mt-1.5">
                      <button
                        type="button"
                        class="text-[11px] text-[var(--color-text-muted)] font-medium cursor-pointer hover:text-[var(--color-text-body)] inline-flex items-center gap-1"
                        (click)="consolidatorDetailsOpen.set(!consolidatorDetailsOpen())"
                      >
                        <svg
                          class="w-3 h-3 transition-transform duration-150"
                          [class.rotate-90]="consolidatorDetailsOpen()"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path d="M4 2l4 4-4 4" />
                        </svg>
                        Details anzeigen
                      </button>
                      @if (consolidatorDetailsOpen()) {
                        <div class="mt-2 space-y-2">
                          @if (p.consolidator.thoughts) {
                            <div>
                              <span
                                class="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                                >Denkprozess</span
                              >
                              <pre
                                class="mt-1 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-body)] font-mono text-[11px] p-3 rounded-md overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed"
                                >{{ p.consolidator.thoughts }}</pre
                              >
                            </div>
                          }
                          @if (p.consolidator.rawResponse != null) {
                            <div>
                              <span
                                class="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                                >JSON-Antwort</span
                              >
                              <pre
                                class="mt-1 bg-stone-900 text-stone-300 font-mono text-[11px] p-3 rounded-md overflow-x-auto max-h-48"
                                >{{ p.consolidator.rawResponse | json }}</pre
                              >
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class ReviewPipelineComponent {
  pipeline = input.required<PipelineState>();

  sectionOpen = signal(false);
  private readonly openAgentDetails = signal<Set<string>>(new Set());
  consolidatorDetailsOpen = signal(false);

  showConsolidator = computed(() => {
    const c = this.pipeline().consolidator;
    return c.status !== 'pending';
  });

  consolidatorDisplayStatus = computed((): 'running' | 'done' | 'error' => {
    const s = this.pipeline().consolidator.status;
    return s === 'pending' ? 'done' : s;
  });

  readonly consolidatorDescription =
    'Führt Ergebnisse zusammen, entfernt Duplikate, korrigiert Schweregrade';

  statusDotClass(status: 'running' | 'done' | 'error'): string {
    switch (status) {
      case 'done':
        return 'bg-emerald-500';
      case 'running':
        return 'bg-violet-400 animate-pulse';
      case 'error':
        return 'bg-red-500';
    }
  }

  statusTextClass(status: 'running' | 'done' | 'error'): string {
    switch (status) {
      case 'done':
        return 'text-emerald-600';
      case 'running':
        return 'text-[var(--color-primary-solid)]';
      case 'error':
        return 'text-red-600';
    }
  }

  statusText(status: 'running' | 'done' | 'error'): string {
    switch (status) {
      case 'done':
        return '\u2713 fertig';
      case 'running':
        return 'läuft...';
      case 'error':
        return '\u2717 Fehler';
    }
  }

  decisionColor(action: ConsolidatorDecision['action']): BadgeColor {
    switch (action) {
      case 'kept':
        return 'success';
      case 'removed':
        return 'danger';
      case 'merged':
        return 'primary';
      case 'severity-changed':
        return 'signal';
    }
  }

  decisionLabel(action: ConsolidatorDecision['action']): string {
    switch (action) {
      case 'kept':
        return 'behalten';
      case 'removed':
        return 'entfernt';
      case 'merged':
        return 'zusammengeführt';
      case 'severity-changed':
        return 'geändert';
    }
  }

  isAgentDetailsOpen(agent: string): boolean {
    return this.openAgentDetails().has(agent);
  }

  toggleAgentDetails(agent: string): void {
    this.openAgentDetails.update((set) => {
      const next = new Set(set);
      next.has(agent) ? next.delete(agent) : next.add(agent);
      return next;
    });
  }

  agentDescription(agent: string): string {
    switch (agent) {
      case 'ak-abgleich':
        return 'Gleicht Änderungen mit Jira-Akzeptanzkriterien ab';
      case 'code-quality':
        return 'Prüft allgemeine Code-Qualität, Patterns und potenzielle Fehler';
      case 'accessibility':
        return 'Prüft Barrierefreiheit nach WCAG AA — Rollen, ARIA, Tastatur, Semantik';
      default:
        return '';
    }
  }

  formatDuration(ms: number): string {
    return (ms / 1000).toFixed(1) + 's';
  }
}
