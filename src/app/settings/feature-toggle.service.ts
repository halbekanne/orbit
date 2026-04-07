import { computed, inject, Injectable } from '@angular/core';
import { SettingsService } from './settings.service';
import { ToggleDefinition } from './feature-toggle.model';

export const TOGGLE_REGISTRY: ToggleDefinition[] = [
  {
    id: 'notes',
    type: 'boolean',
    defaultValue: false,
    label: 'Notizen',
    description: 'Einfache Notizen für den Arbeitsalltag',
  },
];

@Injectable({ providedIn: 'root' })
export class FeatureToggleService {
  private readonly settingsService = inject(SettingsService);

  getDefinitions(): ToggleDefinition[] {
    return TOGGLE_REGISTRY;
  }

  getValue(id: string) {
    return computed(() => {
      const experiments = this.settingsService.settings().experiments;
      const definition = TOGGLE_REGISTRY.find(d => d.id === id);
      if (!definition) return experiments[id];
      return experiments[id] ?? definition.defaultValue;
    });
  }
}
