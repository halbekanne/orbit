import { ChangeDetectionStrategy, Component, inject, input, output, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JenkinsService } from '../jenkins.service';
import { BranchBuild, JenkinsParameterDefinition } from '../jenkins.model';

@Component({
  selector: 'app-restart-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './restart-dialog.html',
  host: { class: 'fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm' },
})
export class RestartDialogComponent implements OnInit {
  private readonly jenkins = inject(JenkinsService);

  readonly branch = input.required<BranchBuild>();
  readonly close = output<void>();

  protected readonly params = signal<JenkinsParameterDefinition[]>([]);
  protected readonly values = signal<Record<string, string>>({});
  protected readonly loading = signal(true);
  protected readonly triggering = signal(false);

  ngOnInit(): void {
    const b = this.branch();
    this.jenkins.loadParameters(b.jobPath, b.branchName).subscribe({
      next: (defs) => {
        this.params.set(defs);
        const defaults: Record<string, string> = {};
        for (const p of defs) {
          defaults[p.name] = String(p.defaultParameterValue.value);
        }
        this.values.set(defaults);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected updateValue(name: string, value: string): void {
    this.values.update(v => ({ ...v, [name]: value }));
  }

  protected onSubmit(): void {
    this.triggering.set(true);
    const b = this.branch();
    this.jenkins.triggerBuild(b.jobPath, b.branchName, this.values()).subscribe({
      next: () => this.close.emit(),
      error: () => this.triggering.set(false),
    });
  }

  protected decodeBranch(name: string): string {
    return decodeURIComponent(name);
  }
}
