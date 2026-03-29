import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
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

  ngOnInit(): void {
    if (this.settings.jenkinsConfigured() && this.jenkins.branches().length === 0) {
      this.refreshService.refreshSource('jenkins');
    }
  }

  protected onBranchSelect(branch: BranchBuild): void {
    this.selectedBranch.set(branch);
    this.selectedKey.set(`${branch.jobDisplayName}/${branch.branchName}`);
  }

  protected navigateToSettings(): void {
    this.router.navigate(['/einstellungen']);
  }
}
