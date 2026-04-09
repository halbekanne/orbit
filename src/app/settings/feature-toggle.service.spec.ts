import { TestBed } from '@angular/core/testing';
import { FeatureToggleService, TOGGLE_REGISTRY } from './feature-toggle.service';
import { SettingsService } from './settings.service';
import { signal } from '@angular/core';
import { createDefaultSettings } from './settings.model';
import { BooleanToggle, SelectToggle } from './feature-toggle.model';

const testBoolToggle: BooleanToggle = {
  id: 'test-bool',
  type: 'boolean',
  defaultValue: false,
  label: 'Test',
  description: 'Test',
};
const testSelectToggle: SelectToggle = {
  id: 'test-select',
  type: 'select',
  defaultValue: 'a',
  options: [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ],
  label: 'Test Select',
  description: 'Test',
};

describe('FeatureToggleService', () => {
  beforeEach(() => {
    TOGGLE_REGISTRY.push(testBoolToggle, testSelectToggle);
  });

  afterEach(() => {
    TOGGLE_REGISTRY.length = 0;
  });

  function setup(experiments: Record<string, string | boolean> = {}) {
    const settings = signal({ ...createDefaultSettings(), experiments });
    TestBed.configureTestingModule({
      providers: [FeatureToggleService, { provide: SettingsService, useValue: { settings } }],
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
    const firstDef = testBoolToggle;
    const overrideValue = !firstDef.defaultValue;
    const serviceWithOverride = setup({ [firstDef.id]: overrideValue });
    expect(serviceWithOverride.getValue(firstDef.id)()).toBe(overrideValue);
  });

  it('should return default for unknown toggle id', () => {
    const service = setup();
    expect(service.getValue('nonexistent-toggle')()).toBeUndefined();
  });
});
