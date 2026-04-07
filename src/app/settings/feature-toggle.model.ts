interface BaseToggleDefinition {
  id: string;
  label: string;
  description: string;
}

export interface BooleanToggle extends BaseToggleDefinition {
  type: 'boolean';
  defaultValue: boolean;
}

export interface SelectToggle extends BaseToggleDefinition {
  type: 'select';
  options: { value: string; label: string }[];
  defaultValue: string;
}

export type ToggleDefinition = BooleanToggle | SelectToggle;
