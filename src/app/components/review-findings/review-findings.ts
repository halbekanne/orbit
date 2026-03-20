import { ChangeDetectionStrategy, Component, effect, input, signal, untracked } from '@angular/core';
import { ReviewState } from '../../models/review.model';

@Component({
  selector: 'app-review-findings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`:host { display: block; }`],
  template: `
    @let review = reviewState();
    @if (review !== 'idle') {
      <section class="border-b border-stone-100" aria-labelledby="pr-review-heading">
        <div class="max-w-2xl mx-auto px-6 py-5">
          <div class="flex items-center justify-between mb-3">
            <h2 id="pr-review-heading" class="text-xs font-semibold text-stone-400 uppercase tracking-wider">KI-Review</h2>
            @if (review.status === 'result') {
              <span class="text-xs text-stone-400">{{ review.data.summary }}</span>
            }
          </div>

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
              <div role="list" aria-label="Review-Ergebnisse">
                @for (finding of review.data.findings; track $index) {
                  <div role="listitem" class="border-b border-stone-200 last:border-b-0">
                    <button
                      type="button"
                      class="w-full text-left py-2.5 flex items-start gap-2 cursor-pointer hover:bg-stone-50 -mx-1 px-1 rounded"
                      [attr.aria-expanded]="isFindingExpanded($index, finding.severity)"
                      (click)="toggleFinding($index, finding.severity)"
                    >
                      <span
                        class="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        [class]="severityDotClass(finding.severity)"
                        aria-hidden="true"
                      ></span>
                      <span class="text-sm font-medium text-stone-800 flex-1 min-w-0">{{ finding.title }}</span>
                      <span class="font-mono text-xs text-stone-400 shrink-0">{{ finding.file }}:{{ finding.line }}</span>
                    </button>

                    @if (isFindingExpanded($index, finding.severity)) {
                      <div class="ml-4 mb-2.5 px-3 py-2 bg-stone-100 rounded text-xs text-stone-500 leading-relaxed">
                        <p>{{ finding.detail }}</p>
                        @if (finding.suggestion) {
                          <p class="mt-1"><span class="font-medium text-stone-600">Vorschlag:</span> {{ finding.suggestion }}</p>
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

  private readonly expandedNonCritical = signal<Set<number>>(new Set());
  private readonly collapsedCritical = signal<Set<number>>(new Set());

  constructor() {
    effect(() => {
      const state = this.reviewState();
      if (typeof state === 'object' && state.status === 'result') {
        untracked(() => {
          this.expandedNonCritical.set(new Set());
          this.collapsedCritical.set(new Set());
        });
      }
    });
  }

  isFindingExpanded(index: number, severity: string): boolean {
    if (severity === 'critical') {
      return !this.collapsedCritical().has(index);
    }
    return this.expandedNonCritical().has(index);
  }

  toggleFinding(index: number, severity: string): void {
    if (severity === 'critical') {
      this.collapsedCritical.update(set => {
        const next = new Set(set);
        next.has(index) ? next.delete(index) : next.add(index);
        return next;
      });
    } else {
      this.expandedNonCritical.update(set => {
        const next = new Set(set);
        next.has(index) ? next.delete(index) : next.add(index);
        return next;
      });
    }
  }

  severityDotClass(severity: string): string {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'important': return 'bg-amber-500';
      default: return 'bg-stone-400';
    }
  }
}
