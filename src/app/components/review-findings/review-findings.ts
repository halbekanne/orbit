import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { ReviewFinding, ReviewState } from '../../models/review.model';
import { ReviewPipelineComponent } from '../review-pipeline/review-pipeline';
import { InlineCodePipe } from '../../pipes/inline-code.pipe';
import { CosiReviewService } from '../../services/cosi-review.service';

interface FileGroup {
  file: string;
  findings: ReviewFinding[];
  hasCritical: boolean;
  severities: string[];
}

const SEVERITY_PRIORITY: Record<string, number> = { critical: 0, important: 1, minor: 2 };

@Component({
  selector: 'app-review-findings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReviewPipelineComponent, InlineCodePipe],
  styles: [`:host { display: block; }`],
  template: `
    @let review = reviewState();
    <div class="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <!-- Card header -->
      <button
        type="button"
        class="w-full flex items-center gap-2.5 px-5 py-4 cursor-pointer hover:bg-stone-50/50 transition-colors duration-100"
        [attr.aria-expanded]="sectionExpanded()"
        (click)="sectionExpanded.set(!sectionExpanded())"
      >
        <svg
          class="w-3.5 h-3.5 text-stone-400 shrink-0 transition-transform duration-150"
          [class.rotate-90]="sectionExpanded()"
          viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"
        ><path d="M4 2l4 4-4 4" /></svg>
        <svg class="w-4 h-4 text-stone-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          <path d="M19.5 7.125L16.862 4.487" />
        </svg>
        <span class="text-xs font-semibold text-stone-400 uppercase tracking-wider">KI-Review</span>

        @if (review === 'idle') {
          <span class="text-xs text-stone-400">Noch nicht gestartet</span>
        } @else if (review.status === 'running') {
          <span class="flex items-center gap-1.5 text-xs text-indigo-600">
            <span class="w-2 h-2 rounded-full bg-indigo-500 pulse-dot"></span>
            Analyse läuft...
          </span>
          <span class="ml-auto font-mono text-xs text-stone-400">{{ formatElapsed(elapsedSeconds()) }}</span>
        } @else if (review.status === 'error') {
          <span class="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-medium">Fehlgeschlagen</span>
        } @else if (review.status === 'result') {
          @if (severityCounts(); as counts) {
            <span class="flex items-center gap-1.5 ml-1">
              @if (counts.critical > 0) {
                <span class="pop-in text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">{{ counts.critical }} Kritisch</span>
              }
              @if (counts.important > 0) {
                <span class="pop-in text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium" style="animation-delay: 0.08s">{{ counts.important }} Wichtig</span>
              }
              @if (counts.minor > 0) {
                <span class="pop-in text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200 font-medium" style="animation-delay: 0.16s">{{ counts.minor }} Gering</span>
              }
            </span>
          }
          @if (review.pipeline.totalDuration != null) {
            <span class="ml-auto font-mono text-xs text-stone-400">{{ formatDuration(review.pipeline.totalDuration!) }}</span>
          }
        }
      </button>

      <!-- Card body -->
      @if (sectionExpanded()) {
        <div class="border-t border-stone-100">
          @if (review !== 'idle' && review.status === 'running') {
            <!-- Running state -->
            <div class="px-5 py-4">
              @if (progressInfo(); as pi) {
                <div class="h-1.5 bg-stone-100 rounded-full overflow-hidden mb-4">
                  <div
                    class="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-500"
                    [style.width.%]="pi.done / pi.total * 100"
                  ></div>
                </div>
              }

              <div class="ml-2 border-l-2 border-stone-200 pl-4 space-y-3">
                @for (agent of review.pipeline.agents; track agent.agent) {
                  <div class="relative">
                    @if (agent.status === 'done') {
                      <span class="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 flex items-center justify-center" aria-hidden="true">
                        <svg class="w-2 h-2 text-white check-animated" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2.5 6l2.5 2.5 4.5-4.5" /></svg>
                      </span>
                      <div class="flex items-baseline gap-2 flex-wrap slide-in">
                        <span class="text-sm font-medium text-stone-700">{{ agent.label }}</span>
                        <span class="text-xs text-emerald-600">&#10003; fertig</span>
                        <span class="text-[11px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200">T={{ agent.temperature }}</span>
                        @if (agent.duration != null) {
                          <span class="font-mono text-xs text-stone-400">{{ formatDuration(agent.duration!) }}</span>
                        }
                      </div>
                      @if (agent.summary) {
                        <p class="text-xs text-stone-500 mt-1">{{ agent.summary }}</p>
                      }
                    } @else if (agent.status === 'running') {
                      <span class="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-400 pulse-dot" aria-hidden="true"></span>
                      <div class="flex items-baseline gap-2 flex-wrap">
                        <span class="text-sm font-medium text-stone-700">{{ agent.label }}</span>
                        <span class="flex items-center gap-0.5 text-xs text-indigo-500">
                          <span class="thinking-dot w-1 h-1 rounded-full bg-indigo-400"></span>
                          <span class="thinking-dot w-1 h-1 rounded-full bg-indigo-400"></span>
                          <span class="thinking-dot w-1 h-1 rounded-full bg-indigo-400"></span>
                        </span>
                        <span class="text-[11px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200">T={{ agent.temperature }}</span>
                      </div>
                    } @else {
                      <span class="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-dashed border-stone-300" aria-hidden="true"></span>
                      <div class="flex items-baseline gap-2 flex-wrap opacity-50">
                        <span class="text-sm font-medium text-stone-700">{{ agent.label }}</span>
                        <span class="text-[11px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200">T={{ agent.temperature }}</span>
                      </div>
                    }
                  </div>
                }

                @if (review.pipeline.consolidator.status !== 'pending') {
                  <div class="relative">
                    @if (review.pipeline.consolidator.status === 'done') {
                      <span class="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 flex items-center justify-center" aria-hidden="true">
                        <svg class="w-2 h-2 text-white check-animated" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2.5 6l2.5 2.5 4.5-4.5" /></svg>
                      </span>
                      <div class="flex items-baseline gap-2 flex-wrap slide-in">
                        <span class="text-sm font-medium text-stone-700">Konsolidierer</span>
                        <span class="text-xs text-emerald-600">&#10003; fertig</span>
                        @if (review.pipeline.consolidator.duration != null) {
                          <span class="font-mono text-xs text-stone-400">{{ formatDuration(review.pipeline.consolidator.duration!) }}</span>
                        }
                      </div>
                    } @else if (review.pipeline.consolidator.status === 'running') {
                      <span class="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-400 pulse-dot" aria-hidden="true"></span>
                      <div class="flex items-baseline gap-2 flex-wrap">
                        <span class="text-sm font-medium text-stone-700">Konsolidierer</span>
                        <span class="flex items-center gap-0.5 text-xs text-indigo-500">
                          <span class="thinking-dot w-1 h-1 rounded-full bg-indigo-400"></span>
                          <span class="thinking-dot w-1 h-1 rounded-full bg-indigo-400"></span>
                          <span class="thinking-dot w-1 h-1 rounded-full bg-indigo-400"></span>
                        </span>
                      </div>
                    } @else if (review.pipeline.consolidator.status === 'error') {
                      <span class="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-red-500" aria-hidden="true"></span>
                      <div class="flex items-baseline gap-2 flex-wrap">
                        <span class="text-sm font-medium text-stone-700">Konsolidierer</span>
                        <span class="text-xs text-red-600">&#10007; Fehler</span>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          } @else if (review !== 'idle' && review.status === 'error') {
            <!-- Error state -->
            <div class="flex flex-col items-center justify-center py-12 px-6">
              <div class="relative w-24 h-24 mb-6 opacity-40">
                <div class="absolute inset-0 rounded-full border-2 border-dashed border-red-300"></div>
                <div class="absolute inset-3 rounded-full border-2 border-dashed border-red-300"></div>
                <svg class="absolute inset-0 m-auto w-8 h-8 text-red-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  <path d="M19.5 7.125L16.862 4.487" />
                </svg>
              </div>
              <p class="text-sm font-medium text-stone-800 mb-1">Review konnte nicht durchgeführt werden</p>
              <p class="text-sm text-stone-500 text-center max-w-xs mb-5">Der Review-Service war nicht erreichbar. Das kann an einer kurzzeitigen Störung liegen — versuch es einfach nochmal.</p>
              <button
                type="button"
                class="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors duration-100 cursor-pointer"
                (click)="cosiReview.triggerReview()"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Nochmal versuchen
              </button>
              <details class="mt-6 w-full max-w-md">
                <summary class="text-xs text-stone-400 cursor-pointer hover:text-stone-600">Technische Details</summary>
                <pre class="mt-2 bg-stone-50 border border-stone-200 text-stone-600 font-mono text-xs p-3 rounded-md overflow-x-auto whitespace-pre-wrap">{{ review.message }}</pre>
              </details>
            </div>
          } @else if (review !== 'idle' && review.status === 'result' && isPartialResult()) {
            <!-- Partial result -->
            <div class="px-5 py-4">
              <div class="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-4">
                <svg class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                </svg>
                <div>
                  <p class="text-sm font-medium text-amber-800">Ergebnis ist unvollständig</p>
                  <p class="text-xs text-amber-700 mt-0.5">
                    @for (agent of review.pipeline.agents; track agent.agent) {
                      @if (agent.status === 'error') {
                        {{ agent.label }} ist fehlgeschlagen.
                      }
                    }
                  </p>
                </div>
              </div>

              <app-review-pipeline [pipeline]="review.pipeline" />

              @if (review.data.findings.length === 0) {
                <p class="text-sm text-emerald-600 mt-3">Keine Auffälligkeiten gefunden.</p>
              } @else {
                <div class="space-y-3 mt-3">
                  @for (group of fileGroups(); track group.file) {
                    <div [attr.data-file-group]="group.file" class="bg-stone-50/50 rounded-lg border border-stone-100">
                      <button
                        type="button"
                        class="w-full text-left px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-stone-50 rounded-lg"
                        [attr.aria-expanded]="isExpanded(group.file)"
                        (click)="toggleGroup(group.file)"
                      >
                        <svg
                          class="w-3 h-3 text-stone-400 shrink-0 transition-transform duration-150"
                          [class.rotate-90]="isExpanded(group.file)"
                          viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"
                        ><path d="M4 2l4 4-4 4" /></svg>
                        <span class="font-mono text-sm text-stone-700 break-all leading-snug min-w-0 flex-1">{{ group.file }}</span>
                        <span class="flex items-center gap-1 shrink-0">
                          @for (sev of group.severities; track sev) {
                            <span data-severity-dot class="w-2 h-2 rounded-full" [class]="severityDotClass(sev)" aria-hidden="true"></span>
                          }
                        </span>
                        <span class="text-xs text-stone-400 shrink-0">{{ group.findings.length }}</span>
                      </button>

                      @if (isExpanded(group.file)) {
                        <div class="px-4 pb-3 space-y-2">
                          @for (finding of group.findings; track $index) {
                            <div class="pl-3 py-2" [class]="findingStripeClass(finding.severity)">
                              <div class="flex items-center gap-2 mb-1 flex-wrap">
                                <span class="text-[11px] px-1.5 py-0.5 rounded border font-medium" [class]="severityBadgeClass(finding.severity)">{{ severityLabel(finding.severity) }}</span>
                                <span [class]="categoryBadgeClass(finding.category)">{{ categoryLabel(finding.category) }}</span>
                                @if (finding.wcagCriterion) {
                                  <span class="text-[10px] px-1.5 py-0.5 rounded border font-mono bg-stone-100 text-stone-500 border-stone-200">WCAG {{ finding.wcagCriterion }}</span>
                                }
                                <span class="font-mono text-xs text-stone-400 ml-auto pr-2">Zeile {{ finding.line }}</span>
                              </div>
                              <p class="text-sm font-medium text-stone-800 mb-1">{{ finding.title }}</p>
                              @if (finding.codeSnippet) {
                                <pre class="font-mono text-xs bg-stone-50 border border-stone-200 text-stone-700 rounded px-3 py-2 mb-1.5 overflow-x-auto whitespace-pre-wrap">{{ finding.codeSnippet }}</pre>
                              }
                              <div class="bg-stone-50 rounded px-3 py-2 text-sm text-stone-600 leading-relaxed" [innerHTML]="finding.detail | inlineCode"></div>
                              @if (finding.suggestion) {
                                <div class="mt-1.5 text-sm text-stone-600">
                                  <span class="font-medium text-stone-700">Vorschlag:</span>
                                  <span [innerHTML]="' ' + finding.suggestion | inlineCode"></span>
                                </div>
                              }
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          } @else if (review !== 'idle' && review.status === 'result') {
            <!-- Done state -->
            <div class="px-5 py-4">
              <app-review-pipeline [pipeline]="review.pipeline" />

              @if (review.data.warnings.length > 0) {
                @for (warning of review.data.warnings; track warning) {
                  <p class="text-xs text-amber-600 mb-2">{{ warning }}</p>
                }
              }

              @if (review.data.findings.length === 0) {
                <p class="text-sm text-emerald-600 mt-3">Keine Auffälligkeiten gefunden.</p>
              } @else {
                <div class="space-y-3 mt-3">
                  @for (group of fileGroups(); track group.file) {
                    <div [attr.data-file-group]="group.file" class="bg-stone-50/50 rounded-lg border border-stone-100">
                      <button
                        type="button"
                        class="w-full text-left px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-stone-50 rounded-lg"
                        [attr.aria-expanded]="isExpanded(group.file)"
                        (click)="toggleGroup(group.file)"
                      >
                        <svg
                          class="w-3 h-3 text-stone-400 shrink-0 transition-transform duration-150"
                          [class.rotate-90]="isExpanded(group.file)"
                          viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"
                        ><path d="M4 2l4 4-4 4" /></svg>
                        <span class="font-mono text-sm text-stone-700 break-all leading-snug min-w-0 flex-1">{{ group.file }}</span>
                        <span class="flex items-center gap-1 shrink-0">
                          @for (sev of group.severities; track sev) {
                            <span data-severity-dot class="w-2 h-2 rounded-full" [class]="severityDotClass(sev)" aria-hidden="true"></span>
                          }
                        </span>
                        <span class="text-xs text-stone-400 shrink-0">{{ group.findings.length }}</span>
                      </button>

                      @if (isExpanded(group.file)) {
                        <div class="px-4 pb-3 space-y-2">
                          @for (finding of group.findings; track $index) {
                            <div class="pl-3 py-2" [class]="findingStripeClass(finding.severity)">
                              <div class="flex items-center gap-2 mb-1 flex-wrap">
                                <span class="text-[11px] px-1.5 py-0.5 rounded border font-medium" [class]="severityBadgeClass(finding.severity)">{{ severityLabel(finding.severity) }}</span>
                                <span [class]="categoryBadgeClass(finding.category)">{{ categoryLabel(finding.category) }}</span>
                                @if (finding.wcagCriterion) {
                                  <span class="text-[10px] px-1.5 py-0.5 rounded border font-mono bg-stone-100 text-stone-500 border-stone-200">WCAG {{ finding.wcagCriterion }}</span>
                                }
                                <span class="font-mono text-xs text-stone-400 ml-auto pr-2">Zeile {{ finding.line }}</span>
                              </div>
                              <p class="text-sm font-medium text-stone-800 mb-1">{{ finding.title }}</p>
                              @if (finding.codeSnippet) {
                                <pre class="font-mono text-xs bg-stone-50 border border-stone-200 text-stone-700 rounded px-3 py-2 mb-1.5 overflow-x-auto whitespace-pre-wrap">{{ finding.codeSnippet }}</pre>
                              }
                              <div class="bg-stone-50 rounded px-3 py-2 text-sm text-stone-600 leading-relaxed" [innerHTML]="finding.detail | inlineCode"></div>
                              @if (finding.suggestion) {
                                <div class="mt-1.5 text-sm text-stone-600">
                                  <span class="font-medium text-stone-700">Vorschlag:</span>
                                  <span [innerHTML]="' ' + finding.suggestion | inlineCode"></span>
                                </div>
                              }
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          } @else {
            <div class="flex flex-col items-center justify-center py-12 px-6">
              <div class="relative w-24 h-24 mb-6">
                <div class="absolute inset-0 rounded-full border-2 border-dashed border-stone-200 orbit-breathe"></div>
                <div class="absolute inset-3 rounded-full border-2 border-dashed border-stone-200 orbit-breathe" style="animation-delay: -1.5s"></div>
                <svg class="absolute inset-0 m-auto w-8 h-8 text-stone-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  <path d="M19.5 7.125L16.862 4.487" />
                </svg>
              </div>
              <p class="text-sm text-stone-500 text-center max-w-xs mb-5">Lass die KI den Code analysieren. Prüft Code-Qualität und Abgleich mit den Akzeptanzkriterien.</p>
              <button
                type="button"
                class="cta-shimmer px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors duration-100"
                [class.opacity-50]="!cosiReview.canReview()"
                [class.cursor-not-allowed]="!cosiReview.canReview()"
                [disabled]="!cosiReview.canReview()"
                (click)="cosiReview.canReview() && cosiReview.triggerReview()"
              >Review starten</button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ReviewFindingsComponent {
  readonly cosiReview = inject(CosiReviewService);
  reviewState = input.required<ReviewState>();

  readonly sectionExpanded = signal(true);
  readonly elapsedSeconds = signal(0);
  expandedFiles = signal<Set<string>>(new Set());

  readonly severityCounts = computed(() => {
    const state = this.reviewState();
    if (typeof state !== 'object' || state.status !== 'result') return null;
    const counts = { critical: 0, important: 0, minor: 0 };
    for (const f of state.data.findings) {
      counts[f.severity]++;
    }
    return counts;
  });

  readonly progressInfo = computed(() => {
    const state = this.reviewState();
    if (typeof state !== 'object') return null;
    const agents = state.pipeline.agents;
    const consolidator = state.pipeline.consolidator;
    const total = agents.length + 1;
    const done = agents.filter(a => a.status === 'done' || a.status === 'error').length
      + (consolidator.status === 'done' || consolidator.status === 'error' ? 1 : 0);
    return { done, total };
  });

  readonly isPartialResult = computed(() => {
    const state = this.reviewState();
    if (typeof state !== 'object' || state.status !== 'result') return false;
    return state.pipeline.agents.some(a => a.status === 'error');
  });

  fileGroups = computed((): FileGroup[] => {
    const state = this.reviewState();
    if (typeof state !== 'object' || state.status !== 'result') return [];

    const map = new Map<string, ReviewFinding[]>();
    for (const f of state.data.findings) {
      const list = map.get(f.file) ?? [];
      list.push(f);
      map.set(f.file, list);
    }

    const groups: FileGroup[] = [];
    for (const [file, findings] of map) {
      const sorted = findings.sort((a, b) => {
        const sp = (SEVERITY_PRIORITY[a.severity] ?? 2) - (SEVERITY_PRIORITY[b.severity] ?? 2);
        return sp !== 0 ? sp : a.line - b.line;
      });
      const severities = [...new Set(sorted.map(f => f.severity))];
      groups.push({
        file,
        findings: sorted,
        hasCritical: sorted.some(f => f.severity === 'critical'),
        severities,
      });
    }

    return groups.sort((a, b) => {
      const aMin = Math.min(...a.findings.map(f => SEVERITY_PRIORITY[f.severity] ?? 2));
      const bMin = Math.min(...b.findings.map(f => SEVERITY_PRIORITY[f.severity] ?? 2));
      return aMin - bMin;
    });
  });

  constructor() {
    effect(() => {
      const groups = this.fileGroups();
      untracked(() => {
        const expanded = new Set<string>();
        for (const g of groups) {
          if (g.hasCritical) expanded.add(g.file);
        }
        this.expandedFiles.set(expanded);
      });
    });

    effect((onCleanup) => {
      const state = this.reviewState();
      if (typeof state === 'object' && state.status === 'running') {
        this.elapsedSeconds.set(0);
        const interval = setInterval(() => {
          this.elapsedSeconds.update(v => v + 1);
        }, 1000);
        onCleanup(() => clearInterval(interval));
      }
    });
  }

  isExpanded(file: string): boolean {
    return this.expandedFiles().has(file);
  }

  toggleGroup(file: string): void {
    this.expandedFiles.update(set => {
      const next = new Set(set);
      next.has(file) ? next.delete(file) : next.add(file);
      return next;
    });
  }

  formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  formatDuration(ms: number): string {
    return (ms / 1000).toFixed(1) + 's';
  }

  severityDotClass(severity: string): string {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'important': return 'bg-amber-500';
      default: return 'bg-stone-400';
    }
  }

  findingStripeClass(severity: string): string {
    switch (severity) {
      case 'critical': return 'border-l-[3px] border-red-500 rounded-r-md bg-red-50/30';
      case 'important': return 'border-l-[3px] border-amber-500 rounded-r-md bg-amber-50/20';
      default: return 'border-l-[3px] border-stone-400 rounded-r-md';
    }
  }

  severityBadgeClass(severity: string): string {
    switch (severity) {
      case 'critical': return 'bg-red-50 text-red-700 border-red-200';
      case 'important': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-stone-100 text-stone-500 border-stone-200';
    }
  }

  severityLabel(severity: string): string {
    switch (severity) {
      case 'critical': return 'Kritisch';
      case 'important': return 'Wichtig';
      default: return 'Gering';
    }
  }

  private readonly categoryConfig: Record<string, { label: string; classes: string }> = {
    'ak-abgleich': { label: 'AK-Abgleich', classes: 'bg-stone-100 text-stone-500 border-stone-200' },
    'code-quality': { label: 'Code-Qualität', classes: 'bg-stone-100 text-stone-500 border-stone-200' },
    'accessibility': { label: 'Barrierefreiheit', classes: 'bg-teal-50 text-teal-700 border-teal-200' },
  };

  categoryLabel(category: string): string {
    return this.categoryConfig[category]?.label ?? category;
  }

  categoryBadgeClass(category: string): string {
    const dynamic = this.categoryConfig[category]?.classes ?? 'bg-stone-100 text-stone-600 border-stone-200';
    return `text-[11px] px-1.5 py-0.5 rounded border font-medium ${dynamic}`;
  }
}
