import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-view-builds',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>Builds View — coming soon</p>`,
  host: { class: 'flex flex-1 h-full overflow-hidden' },
})
export class ViewBuildsComponent {}
