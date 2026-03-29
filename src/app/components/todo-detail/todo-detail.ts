import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, signal, effect, viewChild } from '@angular/core';
import { Todo } from '../../models/work-item.model';
import { TodoService } from '../../services/todo.service';
import { WorkspaceService } from '../../services/workspace.service';
import { SubTaskListComponent } from '../sub-task-list/sub-task-list';
import { SubTask } from '../../models/sub-task.model';
import { CompactHeaderBarComponent } from '../compact-header-bar/compact-header-bar';
import { DetailActionBarComponent } from '../detail-action-bar/detail-action-bar';
import { CollapsibleSectionComponent } from '../collapsible-section/collapsible-section';

@Component({
  selector: 'app-todo-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SubTaskListComponent, CompactHeaderBarComponent, DetailActionBarComponent, CollapsibleSectionComponent],
  styles: [`
    @keyframes todoFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    :host {
      display: block;
      animation: todoFadeIn 0.15s ease-out;
    }
  `],
  template: `
    <article [attr.aria-label]="'Todo: ' + todo().title">

      <app-compact-header-bar
        [visible]="showCompactBar()"
        [title]="todo().title"
        [statusLabel]="statusLabelText()"
        [statusClass]="statusBadgeClass()"
        [stripeColor]="statusStripeClass()"
      />

      <header class="bg-[var(--color-bg-card)] border-b border-[var(--color-border-subtle)]">
        <div class="max-w-2xl mx-auto relative">
          <div class="absolute left-0 top-0 bottom-0 w-[3px]" [class]="statusStripeClass()" aria-hidden="true"></div>

          <div class="px-6 pt-5 pb-4 pl-7">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border"
                [class]="statusBadgeClass()">
                <span class="w-1.5 h-1.5 rounded-full" [class]="statusDotClass()" aria-hidden="true"></span>
                {{ statusLabel() }}
              </span>
              @if (todo().urgent) {
                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                  Dringend
                </span>
              }
            </div>

            @if (editingTitle()) {
              <input
                #titleInput
                type="text"
                class="text-lg font-semibold text-[var(--color-text-heading)] leading-snug w-full bg-transparent border-b-2 border-[var(--color-primary-solid)] focus:outline-none"
                [value]="draftTitle()"
                (input)="draftTitle.set($any($event.target).value)"
                (blur)="saveTitle()"
                (keydown)="onTitleKeydown($event)"
                aria-label="Titel bearbeiten"
              />
            } @else {
              <h1
                class="text-lg font-semibold text-[var(--color-text-heading)] leading-snug cursor-pointer hover:text-[var(--color-primary-text)] transition-colors"
                [class]="todo().status === 'done' ? 'line-through text-[var(--color-text-muted)]' : ''"
                (click)="startEditTitle()"
                tabindex="0"
                (keydown.enter)="startEditTitle()"
                aria-label="Titel anklicken zum Bearbeiten"
              >{{ todo().title }}</h1>
            }

            <p class="text-xs text-[var(--color-text-muted)] mt-2">
              erstellt {{ formatDate(todo().createdAt) }}
              @if (todo().completedAt) {
                <span aria-hidden="true"> · </span>erledigt {{ formatDate(todo().completedAt!) }}
              }
            </p>
          </div>

          <app-detail-action-bar [item]="todo()" />
        </div>
      </header>

      <div #headerSentinel></div>

      <div class="max-w-2xl mx-auto space-y-3 py-4 px-2">
        <app-collapsible-section label="Notizen" [expanded]="true">
          <svg sectionIcon class="w-4 h-4 text-[var(--color-text-muted)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
          @if (editingDescription()) {
            <textarea
              class="text-sm text-[var(--color-text-body)] leading-relaxed w-full bg-transparent border border-[var(--color-primary-solid)] rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] min-h-[120px] resize-none"
              [value]="draftDescription()"
              (input)="draftDescription.set($any($event.target).value)"
              (blur)="saveDescription()"
              (keydown)="onDescriptionKeydown($event)"
              aria-label="Notizen bearbeiten"
            ></textarea>
            <p class="text-xs text-[var(--color-text-muted)] mt-1">Ctrl+Enter zum Speichern · Escape zum Abbrechen</p>
          } @else {
            <div
              class="text-sm text-[var(--color-text-body)] leading-relaxed whitespace-pre-line cursor-pointer min-h-[60px] hover:bg-[var(--color-bg-surface)] rounded-md p-1 -m-1 transition-colors"
              (click)="startEditDescription()"
              tabindex="0"
              (keydown.enter)="startEditDescription()"
              [attr.aria-label]="todo().description ? 'Notizen anklicken zum Bearbeiten' : 'Notizen hinzufügen'"
            >
              @if (todo().description) {
                {{ todo().description }}
              } @else {
                <span class="text-[var(--color-text-muted)] italic">Notizen hinzufügen…</span>
              }
            </div>
          }
        </app-collapsible-section>

        <app-collapsible-section label="Teilaufgaben" [expanded]="true">
          <svg sectionIcon class="w-4 h-4 text-[var(--color-text-muted)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <ng-container sectionMeta>
            <span class="text-xs text-[var(--color-text-muted)]">{{ subtaskCounter(todo().subtasks ?? []) }}</span>
          </ng-container>
          <app-sub-task-list
            [subtasks]="todo().subtasks ?? []"
            [showHeader]="false"
            (subtasksChange)="onSubtasksChange($event)"
          />
        </app-collapsible-section>

        <div class="h-4" aria-hidden="true"></div>
      </div>
    </article>
  `,
})
export class TodoDetailComponent {
  todo = input.required<Todo>();
  private readonly todoService = inject(TodoService);
  private readonly workData = inject(WorkspaceService);
  private readonly destroyRef = inject(DestroyRef);

  editingTitle = signal(false);
  editingDescription = signal(false);
  draftTitle = signal('');
  draftDescription = signal('');

  readonly showCompactBar = signal(false);
  private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('headerSentinel');

  readonly statusStripeClass = computed(() => {
    const s = this.todo().status;
    if (s === 'done') return 'bg-emerald-500';
    if (s === 'wont-do') return 'bg-stone-400';
    return 'bg-violet-500';
  });

  readonly statusLabelText = computed(() => {
    const s = this.todo().status;
    if (s === 'done') return 'Erledigt';
    if (s === 'wont-do') return 'Nicht erledigt';
    return 'Offen';
  });

  readonly statusDotClass = computed(() => {
    const s = this.todo().status;
    if (s === 'done') return 'bg-emerald-500';
    if (s === 'wont-do') return 'bg-stone-400';
    return 'bg-violet-500';
  });

  constructor() {
    effect(() => {
      const t = this.todo();
      this.draftTitle.set(t.title);
      this.draftDescription.set(t.description);
      this.editingTitle.set(false);
      this.editingDescription.set(false);
    });

    afterNextRender(() => {
      const sentinel = this.scrollSentinel()?.nativeElement;
      if (!sentinel) return;
      const observer = new IntersectionObserver(
        ([entry]) => this.showCompactBar.set(!entry.isIntersecting),
        { threshold: 0 }
      );
      observer.observe(sentinel);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  statusBadgeClass(): string {
    switch (this.todo().status) {
      case 'done': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'wont-do': return 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]';
      default: return 'bg-[var(--color-primary-bg)] text-[var(--color-primary-text)] border-[var(--color-primary-border)]';
    }
  }

  statusLabel(): string {
    switch (this.todo().status) {
      case 'done': return 'Erledigt';
      case 'wont-do': return 'Nicht verfolgt';
      default: return 'Offen';
    }
  }

  startEditTitle(): void {
    this.draftTitle.set(this.todo().title);
    this.editingTitle.set(true);
  }

  saveTitle(): void {
    const val = this.draftTitle().trim();
    if (val && val !== this.todo().title) {
      const updated = { ...this.todo(), title: val };
      this.todoService.update(updated);
      this.workData.selectedItem.set(updated);
    }
    this.editingTitle.set(false);
  }

  onTitleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') { e.preventDefault(); this.saveTitle(); }
    if (e.key === 'Escape') { this.editingTitle.set(false); }
  }

  startEditDescription(): void {
    this.draftDescription.set(this.todo().description);
    this.editingDescription.set(true);
  }

  saveDescription(): void {
    const val = this.draftDescription().trim();
    if (val !== this.todo().description) {
      const updated = { ...this.todo(), description: val };
      this.todoService.update(updated);
      this.workData.selectedItem.set(updated);
    }
    this.editingDescription.set(false);
  }

  onDescriptionKeydown(e: KeyboardEvent): void {
    if (e.ctrlKey && e.key === 'Enter') { this.saveDescription(); }
    if (e.key === 'Escape') { this.editingDescription.set(false); }
  }

  onSubtasksChange(subtasks: SubTask[]): void {
    const updated = { ...this.todo(), subtasks };
    this.todoService.update(updated);
    this.workData.selectedItem.set(updated);
  }

  subtaskCounter(subtasks: SubTask[]): string {
    const done = subtasks.filter(s => s.status === 'done').length;
    return `${done}/${subtasks.length}`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
