import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NavigatorComponent } from './components/navigator/navigator';
import { WorkbenchComponent } from './components/workbench/workbench';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavigatorComponent, WorkbenchComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
