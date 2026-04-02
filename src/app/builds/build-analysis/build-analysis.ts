import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { BuildAnalysisService } from '../build-analysis.service';
import { BuildAnalysisRequest } from '../jenkins.model';
import { BadgeComponent } from '../../shared/badge/badge';

@Component({
  selector: 'app-build-analysis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `
    @switch (analysisService.state().status) {
      @case ('not-configured') {
        <div class="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">KI-Analyse</span>
            <orbit-badge color="primary" size="sm">Beta</orbit-badge>
          </div>
          <p class="text-sm text-[var(--color-text-muted)] mb-3">Vertex AI ist nicht konfiguriert.</p>
          <button
            type="button"
            class="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-all bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-body)] hover:border-[var(--color-border-default)] hover:shadow-sm active:scale-[0.97]"
            (click)="openSettings()">
            Einstellungen öffnen
          </button>
        </div>
      }
      @case ('loading') {
        <div class="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">KI-Analyse</span>
            <orbit-badge color="primary" size="sm">Beta</orbit-badge>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-[var(--color-primary-solid)] animate-pulse"></span>
            <span class="text-sm text-[var(--color-text-muted)]">Fehlerursache wird analysiert…</span>
          </div>
        </div>
      }
      @case ('result') {
        <div class="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] overflow-hidden">
          <div class="flex items-center gap-2 px-5 py-3 border-b border-[var(--color-border-subtle)]">
            <span class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">KI-Analyse</span>
            <orbit-badge color="primary" size="sm">Beta</orbit-badge>
          </div>
          <div class="px-5 py-4 space-y-4">
            <div>
              <h4 class="text-xs font-semibold text-[var(--color-text-heading)] uppercase tracking-wider mb-1">Ursache</h4>
              <p class="text-sm text-[var(--color-text-body)] leading-relaxed">{{ result().cause }}</p>
            </div>
            <div>
              <h4 class="text-xs font-semibold text-[var(--color-text-heading)] uppercase tracking-wider mb-1">Lösung</h4>
              <p class="text-sm text-[var(--color-text-body)] leading-relaxed">{{ result().solution }}</p>
            </div>
            <div>
              <h4 class="text-xs font-semibold text-[var(--color-text-heading)] uppercase tracking-wider mb-1">Betroffene Stelle</h4>
              <div class="rounded-lg bg-[var(--color-bg-page)] border border-[var(--color-danger-border)] border-l-4 border-l-[var(--color-danger-solid)] overflow-hidden">
                <div class="p-3 text-xs font-mono text-[var(--color-text-body)] whitespace-pre-wrap leading-5">{{ result().evidence.snippet }}</div>
              </div>
              <span class="text-[10px] text-[var(--color-text-muted)] mt-1 block">Quelle: {{ result().evidence.source === 'stage-log' ? 'Stage-Log' : 'Jenkinsfile' }}</span>
            </div>
          </div>
          <div class="flex items-center justify-between px-5 py-2.5 border-t border-[var(--color-border-subtle)]">
            <span class="text-[10px] text-[var(--color-text-muted)]">
              @if (!result().jenkinsfileAvailable) {
                Analyse ohne Jenkinsfile-Kontext
              } @else {
                Analysiert: Stage-Log + Jenkinsfile
              }
            </span>
            <button
              type="button"
              class="px-2 py-0.5 rounded text-[10px] bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)] cursor-pointer hover:text-[var(--color-text-heading)] transition-colors"
              (click)="onReanalyze()">
              ↻ Neu analysieren
            </button>
          </div>
        </div>
      }
      @case ('error') {
        <div class="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">KI-Analyse</span>
            <orbit-badge color="primary" size="sm">Beta</orbit-badge>
          </div>
          <p class="text-sm text-[var(--color-danger-text)] mb-3">{{ errorMessage() }}</p>
          <button
            type="button"
            class="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition-all bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-body)] hover:border-[var(--color-border-default)] hover:shadow-sm active:scale-[0.97]"
            (click)="onReanalyze()">
            Erneut versuchen
          </button>
        </div>
      }
    }
  `,
})
export class BuildAnalysisComponent {
  protected readonly analysisService = inject(BuildAnalysisService);
  private readonly router = inject(Router);

  readonly request = input.required<BuildAnalysisRequest>();

  protected readonly result = computed(() => {
    const state = this.analysisService.state();
    return state.status === 'result' ? state.data : null!;
  });

  protected readonly errorMessage = computed(() => {
    const state = this.analysisService.state();
    return state.status === 'error' ? state.message : '';
  });

  protected openSettings(): void {
    this.router.navigate(['/settings']);
  }

  protected onReanalyze(): void {
    this.analysisService.reanalyze(this.request());
  }
}
