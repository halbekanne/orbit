import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-view-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center justify-center h-full' },
  template: `
    <div class="text-center max-w-sm">
      <div class="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-400"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
      </div>
      <h2 class="text-lg font-semibold text-stone-800 mb-1">Timeline</h2>
      <p class="text-sm text-stone-400 leading-relaxed">Dein Tagesrückblick wird hier angezeigt — kommt bald.</p>
    </div>
  `,
})
export class ViewTimelineComponent {}
