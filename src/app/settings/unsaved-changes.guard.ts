import { CanDeactivateFn } from '@angular/router';
import { ViewSettingsComponent } from './view-settings/view-settings';

export const unsavedChangesGuard: CanDeactivateFn<ViewSettingsComponent> = (component) => {
  if (!component.isDirty()) return true;
  return component.confirmNavigation();
};
