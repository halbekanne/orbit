import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { BuildsSidebarComponent } from '../builds-sidebar/builds-sidebar';
import { BuildDetailComponent } from '../build-detail/build-detail';
import { JenkinsService } from '../jenkins.service';
import { SettingsService } from '../../settings/settings.service';
import { DataRefreshService } from '../../shared/data-refresh.service';
import { BranchBuild } from '../jenkins.model';

@Component({
  selector: 'app-view-builds',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BuildsSidebarComponent, BuildDetailComponent],
  templateUrl: './view-builds.html',
  host: { class: 'flex flex-1 h-full overflow-hidden' },
})
export class ViewBuildsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly refreshService = inject(DataRefreshService);
  protected readonly settings = inject(SettingsService);
  protected readonly jenkins = inject(JenkinsService);

  readonly selectedBranch = signal<BranchBuild | null>(null);
  readonly selectedKey = signal<string | null>(null);

  private syncing = false;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  constructor() {
    effect(() => {
      const u = this.url();
      untracked(() => this.resolveUrl(u));
    });

    effect(() => {
      const branches = this.jenkins.branches();
      const key = this.pendingKey;
      if (!key || branches.length === 0) return;
      untracked(() => {
        const branch = branches.find(b => `${b.jobDisplayName}/${b.branchName}` === key);
        if (branch) {
          this.pendingKey = null;
          this.selectBranch(branch);
        }
      });
    });
  }

  private pendingKey: string | null = null;

  ngOnInit(): void {
    if (this.settings.jenkinsConfigured() && this.jenkins.branches().length === 0) {
      this.refreshService.refreshSource('jenkins');
    }
  }

  protected onBranchSelect(branch: BranchBuild): void {
    this.selectBranch(branch);
    this.router.navigate(['/builds', branch.jobDisplayName, branch.branchName]);
  }

  private selectBranch(branch: BranchBuild): void {
    this.selectedBranch.set(branch);
    this.selectedKey.set(`${branch.jobDisplayName}/${branch.branchName}`);
  }

  private resolveUrl(url: string): void {
    if (!url.startsWith('/builds')) return;
    const segments = url.split('/').filter(Boolean);
    if (segments.length < 3) {
      this.selectedBranch.set(null);
      this.selectedKey.set(null);
      return;
    }
    const jobName = decodeURIComponent(segments[1]);
    const branchName = decodeURIComponent(segments[2]);
    const key = `${jobName}/${branchName}`;

    const branches = this.jenkins.branches();
    const branch = branches.find(b => `${b.jobDisplayName}/${b.branchName}` === key);
    if (branch) {
      this.selectBranch(branch);
    } else {
      this.pendingKey = key;
    }
  }

  protected navigateToSettings(): void {
    this.router.navigate(['/einstellungen']);
  }
}
