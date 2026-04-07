import { TestBed } from '@angular/core/testing';
import { FeatureToggleService } from './feature-toggle.service';
import { SettingsService } from './settings.service';
import { signal } from '@angular/core';
import { createDefaultSettings } from './settings.model';

describe('FeatureToggleService', () => {
  function setup(experiments: Record<string, string | boolean> = {}) {
    const settings = signal({ ...createDefaultSettings(), experiments });
    TestBed.configureTestingModule({
      providers: [
        FeatureToggleService,
        { provide: SettingsService, useValue: { settings } },
      ],
    });
    return TestBed.inject(FeatureToggleService);
  }

  it('should return default value when no experiment is saved', () => {
    const service = setup();
    const definitions = service.getDefinitions();
    for (const def of definitions) {
      expect(service.getValue(def.id)()).toBe(def.defaultValue);
    }
  });

  it('should return saved value when experiment is set', () => {
    const service = setup();
    const defs = service.getDefinitions();
    if (defs.length === 0) return;

    const firstDef = defs[0];
    const overrideValue = firstDef.type === 'boolean' ? !firstDef.defaultValue : firstDef.defaultValue;
    const serviceWithOverride = setup({ [firstDef.id]: overrideValue });
    expect(serviceWithOverride.getValue(firstDef.id)()).toBe(overrideValue);
  });

  it('should return default for unknown toggle id', () => {
    const service = setup();
    expect(service.getValue('nonexistent-toggle')()).toBeUndefined();
  });
});
