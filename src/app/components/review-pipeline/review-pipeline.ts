import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { AgentStep, ConsolidatorDecision, ConsolidatorStep, PipelineState } from '../../models/review.model';

@Component({
  selector: 'app-review-pipeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe],
  styles: [`:host { display: block; }`],
  template: `
    @let p = pipeline();
    @if (p.agents.length > 0) {
      <section data-pipeline class="border-b border-stone-100" aria-labelledby="pipeline-heading">
        <div class="max-w-2xl mx-auto px-6 py-5">
          <button
            type="button"
            class="flex items-center gap-2 w-full text-left cursor-pointer"
            [attr.aria-expanded]="sectionOpen()"
            aria-controls="pipeline-content"
            (click)="sectionOpen.set(!sectionOpen())"
          >
            <h2 id="pipeline-heading" class="text-xs font-semibold text-stone-400 uppercase tracking-wider">
              Review-Pipeline
            </h2>
            @if (p.totalDuration != null) {
              <span class="font-mono text-xs text-stone-400">{{ formatDuration(p.totalDuration!) }}</span>
            }
            <svg
              class="w-3 h-3 text-stone-400 ml-auto transition-transform duration-150"
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
            <div id="pipeline-content" class="mt-3 ml-2 border-l-2 border-stone-200 pl-4 space-y-3">
              @for (agent of p.agents; track agent.agent) {
                <div class="relative">
                  <span
                    class="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full"
                    [class]="statusDotClass(agent.status)"
                    [attr.data-status]="agent.status"
                    aria-hidden="true"
                  ></span>
                  <div class="flex items-baseline gap-2 flex-wrap">
                    <span class="text-sm font-medium text-stone-700">{{ agent.label }}</span>
                    <span class="text-xs" [class]="statusTextClass(agent.status)">{{ statusText(agent.status) }}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200">T={{ agent.temperature }}</span>
                    @if (agent.duration != null) {
                      <span class="font-mono text-xs text-stone-400">{{ formatDuration(agent.duration!) }}</span>
                    }
                  </div>
                  @if (agent.summary) {
                    <p class="text-xs text-stone-500 mt-1">{{ agent.summary }}</p>
                  }
                  @if (agent.error) {
                    <p class="text-xs text-red-600 mt-1">{{ agent.error }}</p>
                  }
                  @if (agent.rawResponse != null) {
                    <button
                      type="button"
                      class="text-[10px] text-stone-400 mt-1 cursor-pointer hover:text-stone-600"
                      (click)="toggleAgentJson(agent.agent)"
                    >
                      {{ isAgentJsonOpen(agent.agent) ? 'JSON ausblenden' : 'JSON anzeigen' }}
                    </button>
                    @if (isAgentJsonOpen(agent.agent)) {
                      <pre class="bg-stone-900 text-stone-400 font-mono text-[10px] p-2 rounded mt-1 overflow-x-auto max-h-48">{{ agent.rawResponse | json }}</pre>
                    }
                  }
                </div>
              }

              @if (showConsolidator()) {
                <div class="relative">
                  <span
                    class="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full"
                    [class]="statusDotClass(p.consolidator.status === 'pending' ? 'done' : p.consolidator.status)"
                    [attr.data-status]="p.consolidator.status"
                    aria-hidden="true"
                  ></span>
                  <div class="flex items-baseline gap-2 flex-wrap">
                    <span class="text-sm font-medium text-stone-700">Konsolidierer</span>
                    <span class="text-xs" [class]="statusTextClass(consolidatorDisplayStatus())">{{ statusText(consolidatorDisplayStatus()) }}</span>
                    @if (p.consolidator.temperature != null) {
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200">T={{ p.consolidator.temperature }}</span>
                    }
                    @if (p.consolidator.duration != null) {
                      <span class="font-mono text-xs text-stone-400">{{ formatDuration(p.consolidator.duration!) }}</span>
                    }
                  </div>
                  @if (p.consolidator.summary) {
                    <p class="text-xs text-stone-500 mt-1">{{ p.consolidator.summary }}</p>
                  }
                  @if (p.consolidator.error) {
                    <p class="text-xs text-red-600 mt-1">{{ p.consolidator.error }}</p>
                  }
                  @if (p.consolidator.decisions && p.consolidator.decisions.length > 0) {
                    <div class="mt-2 space-y-1.5">
                      @for (decision of p.consolidator.decisions; track decision.finding) {
                        <div class="flex items-start gap-2 text-xs">
                          <span
                            class="shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-medium"
                            [class]="decisionBadgeClass(decision.action)"
                          >{{ decisionLabel(decision.action) }}</span>
                          <span class="text-stone-700">{{ decision.finding }}</span>
                          <span class="text-stone-400 italic">{{ decision.reason }}</span>
                        </div>
                      }
                    </div>
                  }
                  @if (p.consolidator.rawResponse != null) {
                    <button
                      type="button"
                      class="text-[10px] text-stone-400 mt-1 cursor-pointer hover:text-stone-600"
                      (click)="toggleConsolidatorJson()"
                    >
                      {{ consolidatorJsonOpen() ? 'JSON ausblenden' : 'JSON anzeigen' }}
                    </button>
                    @if (consolidatorJsonOpen()) {
                      <pre class="bg-stone-900 text-stone-400 font-mono text-[10px] p-2 rounded mt-1 overflow-x-auto max-h-48">{{ p.consolidator.rawResponse | json }}</pre>
                    }
                  }
                </div>
              }
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class ReviewPipelineComponent {
  pipeline = input.required<PipelineState>();

  sectionOpen = signal(true);
  private readonly openAgentJsons = signal<Set<string>>(new Set());
  consolidatorJsonOpen = signal(false);

  showConsolidator = computed(() => {
    const c = this.pipeline().consolidator;
    return c.status !== 'pending';
  });

  consolidatorDisplayStatus = computed((): 'running' | 'done' | 'error' => {
    const s = this.pipeline().consolidator.status;
    return s === 'pending' ? 'done' : s;
  });

  statusDotClass(status: 'running' | 'done' | 'error'): string {
    switch (status) {
      case 'done': return 'bg-emerald-500';
      case 'running': return 'bg-indigo-400 animate-pulse';
      case 'error': return 'bg-red-500';
    }
  }

  statusTextClass(status: 'running' | 'done' | 'error'): string {
    switch (status) {
      case 'done': return 'text-emerald-600';
      case 'running': return 'text-indigo-500';
      case 'error': return 'text-red-600';
    }
  }

  statusText(status: 'running' | 'done' | 'error'): string {
    switch (status) {
      case 'done': return '\u2713 fertig';
      case 'running': return 'läuft...';
      case 'error': return '\u2717 Fehler';
    }
  }

  decisionBadgeClass(action: ConsolidatorDecision['action']): string {
    switch (action) {
      case 'kept': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'removed': return 'bg-red-50 text-red-700 border-red-200';
      case 'merged': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'severity-changed': return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  }

  decisionLabel(action: ConsolidatorDecision['action']): string {
    switch (action) {
      case 'kept': return 'behalten';
      case 'removed': return 'entfernt';
      case 'merged': return 'zusammengeführt';
      case 'severity-changed': return 'geändert';
    }
  }

  isAgentJsonOpen(agent: string): boolean {
    return this.openAgentJsons().has(agent);
  }

  toggleAgentJson(agent: string): void {
    this.openAgentJsons.update(set => {
      const next = new Set(set);
      if (next.has(agent)) {
        next.delete(agent);
      } else {
        next.add(agent);
      }
      return next;
    });
  }

  toggleConsolidatorJson(): void {
    this.consolidatorJsonOpen.update(v => !v);
  }

  formatDuration(ms: number): string {
    return (ms / 1000).toFixed(1) + 's';
  }
}
