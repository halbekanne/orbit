import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, signal, effect, viewChild } from '@angular/core';
import { Todo } from '../../models/work-item.model';
import { TodoService } from '../../services/todo.service';
import { WorkspaceService } from '../../services/workspace.service';
import { SubTaskListComponent } from '../sub-task-list/sub-task-list';
import { SubTask } from '../../models/sub-task.model';
import { CompactHeaderBarComponent } from '../compact-header-bar/compact-header-bar';
import { DetailActionBarComponent } from '../detail-action-bar/detail-action-bar';

@Component({
  selector: 'app-todo-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SubTaskListComponent, CompactHeaderBarComponent, DetailActionBarComponent],
  template: `
    <article class="h-full flex flex-col max-w-2xl mx-auto w-full" [attr.aria-label]="'Todo: ' + todo().title">

      <app-compact-header-bar
        [visible]="showCompactBar()"
        [title]="todo().title"
        [statusLabel]="statusLabelText()"
        [statusClass]="statusBadgeClass()"
        [stripeColor]="statusStripeClass()"
      />

      <header class="pb-5 border-b border-[var(--color-border-subtle)]">
        <div class="flex items-start gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2">
              <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
                [class]="statusBadgeClass()">
                {{ statusLabel() }}
              </span>
              @if (todo().urgent) {
                <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-800 border border-amber-300">
                  Dringend
                </span>
              }
            </div>

            @if (editingTitle()) {
              <input
                #titleInput
                type="text"
                class="text-xl font-semibold text-[var(--color-text-heading)] leading-snug w-full bg-transparent border-b-2 border-[var(--color-primary-solid)] focus:outline-none"
                [value]="draftTitle()"
                (input)="draftTitle.set($any($event.target).value)"
                (blur)="saveTitle()"
                (keydown)="onTitleKeydown($event)"
                aria-label="Titel bearbeiten"
              />
            } @else {
              <h1
                class="text-xl font-semibold text-[var(--color-text-heading)] leading-snug cursor-pointer hover:text-[var(--color-primary-text)] transition-colors"
                [class]="todo().status === 'done' ? 'line-through text-[var(--color-text-muted)]' : ''"
                (click)="startEditTitle()"
                tabindex="0"
                (keydown.enter)="startEditTitle()"
                aria-label="Titel anklicken zum Bearbeiten"
              >{{ todo().title }}</h1>
            }
          </div>
        </div>
      </header>

      <div #headerSentinel></div>
      <app-detail-action-bar [item]="todo()" />

      <div class="flex-1 py-5 overflow-y-auto">
        <h2 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Notizen</h2>

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

        <div class="py-5 border-t border-[var(--color-border-subtle)]">
          <app-sub-task-list
            [subtasks]="todo().subtasks ?? []"
            (subtasksChange)="onSubtasksChange($event)"
          />
        </div>

        <div class="py-5 border-t border-[var(--color-border-subtle)]">
          <dl class="grid grid-cols-2 gap-4">
            <div>
              <dt class="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Erstellt am</dt>
              <dd class="text-sm text-[var(--color-text-body)]">{{ formatDate(todo().createdAt) }}</dd>
            </div>
            @if (todo().completedAt) {
              <div>
                <dt class="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Erledigt am</dt>
                <dd class="text-sm text-[var(--color-text-body)]">{{ formatDate(todo().completedAt!) }}</dd>
              </div>
            }
          </dl>
        </div>
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
      case 'done': return 'bg-emerald-100 text-emerald-700';
      case 'wont-do': return 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]';
      default: return 'bg-[var(--color-primary-bg)] text-[var(--color-primary-text)]';
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

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
