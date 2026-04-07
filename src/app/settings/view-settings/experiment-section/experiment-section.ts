import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { LucideFlaskConical } from '@lucide/angular';
import { FeatureToggleService } from '../../feature-toggle.service';
import { ToggleDefinition } from '../../feature-toggle.model';

@Component({
  selector: 'app-experiment-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideFlaskConical],
  templateUrl: './experiment-section.html',
})
export class ExperimentSectionComponent {
  private readonly featureToggleService = inject(FeatureToggleService);

  readonly definitions: ToggleDefinition[] = this.featureToggleService.getDefinitions();
  readonly experimentChanged = output<{ id: string; value: string | boolean }>();

  getValue(id: string) {
    return this.featureToggleService.getValue(id);
  }

  onToggle(id: string, value: string | boolean): void {
    this.experimentChanged.emit({ id, value });
  }
}
