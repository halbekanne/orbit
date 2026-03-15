import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Todo } from '../../models/work-item.model';
import { WorkDataService } from '../../services/work-data.service';

@Component({
  selector: 'app-todo-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="h-full flex flex-col max-w-2xl mx-auto w-full" [attr.aria-label]="'Todo: ' + todo().title">
      <header class="pb-5 border-b border-stone-200">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2">
              <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium" [class]="todo().done ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'">
                {{ todo().done ? 'Erledigt' : 'Offen' }}
              </span>
            </div>
            <h1 class="text-xl font-semibold text-stone-900 leading-snug" [class]="todo().done ? 'line-through text-stone-400' : ''">{{ todo().title }}</h1>
          </div>
          <button
            type="button"
            class="shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            [class]="todo().done
              ? 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
              : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'"
            (click)="data.toggleTodo(todo().id)"
            [attr.aria-label]="todo().done ? 'Als offen markieren' : 'Als erledigt markieren'"
          >
            @if (todo().done) {
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h18"/></svg>
              Wieder öffnen
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
              Erledigt
            }
          </button>
        </div>
      </header>

      <div class="py-5 border-b border-stone-200">
        <dl class="grid grid-cols-2 gap-4">
          <div>
            <dt class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Erstellt am</dt>
            <dd class="text-sm text-stone-700">{{ formatDate(todo().createdAt) }}</dd>
          </div>
        </dl>
      </div>

      <div class="flex-1 py-5 overflow-y-auto">
        @if (todo().description) {
          <h2 class="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Notizen</h2>
          <div class="text-sm text-stone-700 leading-relaxed whitespace-pre-line">{{ todo().description }}</div>
        }
      </div>
    </article>
  `,
})
export class TodoDetailComponent {
  todo = input.required<Todo>();
  protected readonly data = inject(WorkDataService);

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
