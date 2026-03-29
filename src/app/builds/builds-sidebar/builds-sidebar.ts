import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { JenkinsService } from '../jenkins.service';
import { BranchBuild } from '../jenkins.model';
import { SyncBarComponent } from '../../shared/sync-bar/sync-bar';
import { BadgeComponent } from '../../shared/badge/badge';

@Component({
  selector: 'app-builds-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SyncBarComponent, BadgeComponent],
  templateUrl: './builds-sidebar.html',
  host: { class: 'flex flex-col h-full' },
})
export class BuildsSidebarComponent {
  protected readonly jenkins = inject(JenkinsService);

  readonly selectedBranch = input<string | null>(null);
  readonly branchSelect = output<BranchBuild>();

  protected readonly jobEntries = computed(() => [...this.jenkins.branchesByJob().entries()]);

  protected isSelected(branch: BranchBuild): boolean {
    return this.selectedBranch() === `${branch.jobDisplayName}/${branch.branchName}`;
  }

  protected getStatusColor(color: string): 'success' | 'danger' | 'info' {
    if (color.startsWith('red')) return 'danger';
    if (color.endsWith('_anime')) return 'info';
    return 'success';
  }

  protected getStatusLabel(color: string): string {
    if (color.startsWith('red')) return 'Fehler';
    if (color.endsWith('_anime')) return 'Läuft';
    if (color === 'yellow' || color === 'yellow_anime') return 'Instabil';
    if (color === 'aborted') return 'Abgebrochen';
    return 'Erfolg';
  }

  protected decodeBranch(name: string): string {
    return decodeURIComponent(name);
  }

  protected timeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'gerade eben';
    if (minutes < 60) return `vor ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `vor ${hours}h`;
    const days = Math.floor(hours / 24);
    return `vor ${days}d`;
  }
}
