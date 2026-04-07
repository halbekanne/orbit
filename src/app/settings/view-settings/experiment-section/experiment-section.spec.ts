import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExperimentSectionComponent } from './experiment-section';
import { FeatureToggleService } from '../../feature-toggle.service';
import { BooleanToggle, SelectToggle } from '../../feature-toggle.model';

describe('ExperimentSectionComponent', () => {
  const booleanToggle: BooleanToggle = {
    id: 'test-bool',
    type: 'boolean',
    defaultValue: false,
    label: 'Test-Funktion',
    description: 'Eine Testfunktion',
  };

  const selectToggle: SelectToggle = {
    id: 'test-select',
    type: 'select',
    defaultValue: 'a',
    options: [
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B' },
    ],
    label: 'Test-Auswahl',
    description: 'Eine Testauswahl',
  };

  function setup(definitions: (BooleanToggle | SelectToggle)[] = [], experiments: Record<string, string | boolean> = {}) {
    TestBed.configureTestingModule({
      imports: [ExperimentSectionComponent],
      providers: [
        {
          provide: FeatureToggleService,
          useValue: {
            getDefinitions: () => definitions,
            getValue: (id: string) => {
              const def = definitions.find(d => d.id === id);
              return () => experiments[id] ?? def?.defaultValue;
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ExperimentSectionComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should not render when there are no definitions', () => {
    const fixture = setup([]);
    expect(fixture.nativeElement.querySelector('[data-section]')).toBeNull();
  });

  it('should render a checkbox for boolean toggles', () => {
    const fixture = setup([booleanToggle]);
    const checkbox = fixture.nativeElement.querySelector('input[type="checkbox"]');
    expect(checkbox).toBeTruthy();
    expect(checkbox.checked).toBe(false);
  });

  it('should render radio buttons for select toggles', () => {
    const fixture = setup([selectToggle]);
    const radios = fixture.nativeElement.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBe(2);
  });

  it('should show warning text', () => {
    const fixture = setup([booleanToggle]);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('aktiver Entwicklung');
  });
});
