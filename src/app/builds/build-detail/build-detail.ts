import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AnsiUp } from 'ansi_up';
import { JenkinsService } from '../jenkins.service';
import { BuildLogService } from '../build-log.service';
import { BranchBuild, JenkinsBuildDetail, JenkinsRun, JenkinsStage, JenkinsStageLog } from '../jenkins.model';
import { CollapsibleSectionComponent } from '../../shared/collapsible-section/collapsible-section';
import { RestartDialogComponent } from '../restart-dialog/restart-dialog';
import { BadgeComponent } from '../../shared/badge/badge';

@Component({
  selector: 'app-build-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CollapsibleSectionComponent, RestartDialogComponent, BadgeComponent],
  templateUrl: './build-detail.html',
  host: { class: 'flex flex-col h-full overflow-hidden' },
})
export class BuildDetailComponent implements OnDestroy {
  private readonly jenkins = inject(JenkinsService);
  protected readonly logService = inject(BuildLogService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly ansi = new AnsiUp();
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private logLoaded = false;

  readonly branch = input.required<BranchBuild>();

  readonly activeTab = signal<'overview' | 'log'>('overview');
  readonly buildDetail = signal<JenkinsBuildDetail | null>(null);
  readonly stages = signal<JenkinsRun | null>(null);
  readonly stageLogs = signal<Map<string, JenkinsStageLog>>(new Map());
  readonly loadingDetail = signal(false);
  readonly showRestartDialog = signal(false);

  constructor() {
    this.ansi.use_classes = true;

    effect(() => {
      const b = this.branch();
      this.loadDetail(b);
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.logService.clear();
  }

  protected sanitizedDescription(): SafeHtml | null {
    const desc = this.buildDetail()?.description;
    if (!desc) return null;
    return this.sanitizer.bypassSecurityTrustHtml(desc);
  }

  protected stageLog(stageId: string): SafeHtml | null {
    const log = this.stageLogs().get(stageId);
    if (!log) return null;
    const stripped = log.text.replace(/<[^>]+>/g, '');
    const html = this.ansi.ansi_to_html(stripped);
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  protected renderedLog = computed<SafeHtml>(() => {
    const raw = this.logService.logText();
    if (!raw) return this.sanitizer.bypassSecurityTrustHtml('');
    const lines = raw.split('\n');
    const errorPattern = /ERROR|Exception|FAILED/;
    const html = lines.map((line, i) => {
      const num = i + 1;
      const escaped = this.ansi.ansi_to_html(line);
      const isError = errorPattern.test(line);
      const borderClass = isError ? 'border-l-2 border-l-[var(--color-danger-solid)]' : '';
      return `<div class="flex ${borderClass}"><span class="select-none text-right pr-4 text-[var(--color-text-muted)] opacity-50 w-12 shrink-0">${num}</span><span class="flex-1 whitespace-pre-wrap break-all">${escaped}</span></div>`;
    }).join('');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  protected onLoadLog(): void {
    const b = this.branch();
    const detail = this.buildDetail();
    if (!detail) return;
    if (detail.building) {
      this.logService.startStreaming(b.jobPath, b.branchName, detail.number);
    } else {
      this.logService.loadFullLog(b.jobPath, b.branchName, detail.number);
    }
  }

  protected switchTab(tab: 'overview' | 'log'): void {
    this.activeTab.set(tab);
    if (tab === 'log' && !this.logLoaded) {
      this.logLoaded = true;
      this.onLoadLog();
    }
  }

  protected onStop(): void {
    const b = this.branch();
    const detail = this.buildDetail();
    if (!detail) return;
    this.jenkins.stopBuild(b.jobPath, b.branchName, detail.number).subscribe();
  }

  protected timeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'gerade eben';
    if (minutes < 60) return `vor ${minutes} Min.`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `vor ${hours} Std.`;
    const days = Math.floor(hours / 24);
    return `vor ${days} Tagen`;
  }

  protected formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  }

  protected stageSince(stage: JenkinsStage): string {
    const diff = Date.now() - stage.startTimeMillis;
    const minutes = Math.max(1, Math.floor(diff / 60000));
    return `seit ${minutes} Min.`;
  }

  protected decodeBranch(name: string): string {
    return decodeURIComponent(name);
  }

  private loadDetail(b: BranchBuild): void {
    if (!b.lastBuild) return;
    this.stopPolling();
    this.logLoaded = false;
    this.loadingDetail.set(true);
    this.stageLogs.set(new Map());
    this.activeTab.set('overview');
    this.logService.clear();

    this.jenkins.loadBuildDetail(b.jobPath, b.branchName, b.lastBuild!.number).subscribe({
      next: ({ detail, stages }) => {
        this.buildDetail.set(detail);
        this.stages.set(stages);
        this.loadingDetail.set(false);
        this.loadFailedStageLogs(b, detail, stages);
        if (detail.building) {
          this.startPolling(b);
        }
      },
      error: () => this.loadingDetail.set(false),
    });
  }

  private loadFailedStageLogs(b: BranchBuild, detail: JenkinsBuildDetail, run: JenkinsRun): void {
    const failedStages = run.stages.filter(s => s.status === 'FAILED');
    for (const stage of failedStages) {
      this.jenkins.loadStageDetail(b.jobPath, b.branchName, detail.number, stage.id).subscribe({
        next: (stageDetail) => {
          const failedNode = stageDetail.stageFlowNodes.find(n => n.status === 'FAILED');
          if (!failedNode) return;
          this.jenkins.loadStageLog(b.jobPath, b.branchName, detail.number, failedNode.id).subscribe({
            next: (log) => {
              this.stageLogs.update(m => {
                const next = new Map(m);
                next.set(stage.id, log);
                return next;
              });
            },
          });
        },
      });
    }
  }

  private startPolling(b: BranchBuild): void {
    this.pollingTimer = setInterval(() => {
      this.jenkins.loadBuildDetail(b.jobPath, b.branchName, b.lastBuild!.number).subscribe({
        next: ({ detail, stages }) => {
          this.buildDetail.set(detail);
          this.stages.set(stages);
          if (!detail.building) {
            this.stopPolling();
            this.loadFailedStageLogs(b, detail, stages);
          }
        },
      });
    }, 5000);
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
}
