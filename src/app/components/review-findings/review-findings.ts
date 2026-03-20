import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import { ReviewFinding, ReviewState, PipelineState } from '../../models/review.model';
import { ReviewPipelineComponent } from '../review-pipeline/review-pipeline';
import { InlineCodePipe } from '../../pipes/inline-code.pipe';

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
    @if (review !== 'idle') {
      <section aria-labelledby="pr-review-heading">
        <div class="max-w-2xl mx-auto px-6 py-5">
          <div class="flex items-center justify-between mb-3">
            <h2 id="pr-review-heading" class="text-xs font-semibold text-stone-400 uppercase tracking-wider">KI-Review</h2>
            @if (review.status === 'result') {
              <span class="text-xs text-stone-400">{{ review.data.summary }}</span>
            }
          </div>

          @if (pipelineState(); as p) {
            <app-review-pipeline [pipeline]="p" />
          }

          @if (review.status === 'running') {
            <p class="text-sm text-stone-400 italic">KI-Review läuft...</p>
          } @else if (review.status === 'error') {
            <p class="text-sm text-stone-400 italic">Review konnte nicht durchgeführt werden.</p>
          } @else if (review.status === 'result') {
            @if (review.data.warnings.length > 0) {
              @for (warning of review.data.warnings; track warning) {
                <p class="text-xs text-amber-600 mb-2">{{ warning }}</p>
              }
            }

            @if (review.data.findings.length === 0) {
              <p class="text-sm text-emerald-600">Keine Auffälligkeiten gefunden.</p>
            } @else {
              <div class="space-y-3 mt-3">
                @for (group of fileGroups(); track group.file) {
                  <div [attr.data-file-group]="group.file" class="bg-white rounded-lg shadow-sm">
                    <button
                      type="button"
                      class="w-full text-left px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-stone-50 rounded-lg"
                      [attr.aria-expanded]="isExpanded(group.file)"
                      (click)="toggleGroup(group.file)"
                    >
                      <svg
                        class="w-3 h-3 text-stone-400 shrink-0 transition-transform duration-150"
                        [class.rotate-90]="isExpanded(group.file)"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        aria-hidden="true"
                      >
                        <path d="M4 2l4 4-4 4" />
                      </svg>
                      <span class="font-mono text-sm text-stone-700 text-ellipsis overflow-hidden whitespace-nowrap min-w-0 flex-1">{{ group.file }}</span>
                      <span class="flex items-center gap-1 shrink-0">
                        @for (sev of group.severities; track sev) {
                          <span
                            data-severity-dot
                            class="w-2 h-2 rounded-full"
                            [class]="severityDotClass(sev)"
                            aria-hidden="true"
                          ></span>
                        }
                      </span>
                      <span class="text-xs text-stone-400 shrink-0">{{ group.findings.length }}</span>
                    </button>

                    @if (isExpanded(group.file)) {
                      <div class="px-4 pb-3 space-y-2">
                        @for (finding of group.findings; track $index) {
                          <div
                            class="pl-3 py-2"
                            [class]="findingStripeClass(finding.severity)"
                          >
                            <div class="flex items-center gap-2 mb-1 flex-wrap">
                              <span
                                class="text-[10px] px-1.5 py-0.5 rounded border font-medium"
                                [class]="severityBadgeClass(finding.severity)"
                              >{{ severityLabel(finding.severity) }}</span>
                              <span class="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-stone-100 text-stone-500 border-stone-200">{{ categoryLabel(finding.category) }}</span>
                              <span class="font-mono text-xs text-stone-400 ml-auto">Zeile {{ finding.line }}</span>
                            </div>
                            <p class="text-sm font-medium text-stone-800 mb-1">{{ finding.title }}</p>
                            <div class="bg-stone-50 rounded px-3 py-2 text-xs text-stone-600 leading-relaxed" [innerHTML]="finding.detail | inlineCode"></div>
                            @if (finding.suggestion) {
                              <div class="mt-1.5 text-xs text-stone-600">
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
          }
        </div>
      </section>
    }
  `,
})
export class ReviewFindingsComponent {
  reviewState = input.required<ReviewState>();

  expandedFiles = signal<Set<string>>(new Set());

  pipelineState = computed((): PipelineState | null => {
    const state = this.reviewState();
    if (typeof state === 'object') {
      return state.pipeline;
    }
    return null;
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

  severityDotClass(severity: string): string {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'important': return 'bg-amber-500';
      default: return 'bg-stone-400';
    }
  }

  findingStripeClass(severity: string): string {
    switch (severity) {
      case 'critical': return 'border-l-[3px] border-red-500';
      case 'important': return 'border-l-[3px] border-amber-500';
      default: return 'border-l-[3px] border-stone-400';
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

  categoryLabel(category: string): string {
    switch (category) {
      case 'ak-abgleich': return 'AK-Abgleich';
      default: return 'Code-Qualität';
    }
  }
}
