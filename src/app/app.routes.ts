import { Routes } from '@angular/router';
import { ViewArbeitComponent } from './shared/view-arbeit/view-arbeit';
import { ViewBuildsComponent } from './builds/view-builds/view-builds';
import { ViewLogbuchComponent } from './shared/view-logbuch/view-logbuch';
import { ViewSettingsComponent } from './settings/view-settings/view-settings';
import { unsavedChangesGuard } from './settings/unsaved-changes.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'arbeit', pathMatch: 'full' },
  {
    path: 'arbeit',
    component: ViewArbeitComponent,
    children: [
      { path: '**', children: [] },
    ],
  },
  {
    path: 'builds',
    component: ViewBuildsComponent,
    children: [
      { path: '**', children: [] },
    ],
  },
  { path: 'logbuch', component: ViewLogbuchComponent },
  {
    path: 'einstellungen',
    component: ViewSettingsComponent,
    canDeactivate: [unsavedChangesGuard],
  },
  { path: '**', redirectTo: 'arbeit' },
];
