import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CdkDragDrop, CdkDrag, CdkDropList, CdkDragHandle } from '@angular/cdk/drag-drop';
import { SubTask, createSubTask } from '../../models/sub-task.model';
import { spawnConfetti, playChime } from '../../utils/celebration';

@Component({
  selector: 'app-sub-task-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropList, CdkDrag, CdkDragHandle],
  styles: [`
    @keyframes celebrateBounce {
      0% { transform: scale(1); }
      30% { transform: scale(1.4); }
      60% { transform: scale(0.9); }
      100% { transform: scale(1); }
    }
    @keyframes confettiFly {
      0% { transform: translate(0,0) scale(1); opacity: 1; }
      100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
    }
    .celebrating .st-checkbox {
      animation: celebrateBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
  `],
  template: `
    <section aria-label="Aufgaben">
      @if (showHeader()) {
        <div class="flex items-center gap-2 mb-3">
          <h2 class="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Aufgaben</h2>
          <span
            data-testid="subtask-counter"
            class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border transition-colors duration-150"
            [class]="counterClasses()"
          >
            @if (allDone() && totalCount() > 0) {
              ✓
            }
            {{ doneCount() }}/{{ totalCount() }}
          </span>
        </div>
      }

      <div
        cdkDropList
        [cdkDropListData]="subtasks()"
        (cdkDropListDropped)="onDrop($event)"
        class="space-y-1"
      >
        @for (subtask of subtasks(); track subtask.id; let i = $index) {
          <div
            cdkDrag
            data-testid="subtask-item"
            class="group flex items-start gap-2 rounded-md ps-1 pe-2 py-1.5 transition-colors hover:bg-[var(--color-bg-surface)]"
            [class]="celebratingId() === subtask.id ? 'celebrating' : ''"
          >
            <div
              cdkDragHandle
              class="opacity-100 transition-opacity text-[var(--color-text-muted)] cursor-grab active:cursor-grabbing shrink-0 select-none text-base px-2 py-1 rounded-md hover:bg-[var(--color-bg-surface)]"
              aria-label="Aufgabe verschieben"
            >⠿</div>

            <button
              type="button"
              data-testid="subtask-checkbox"
              class="st-checkbox w-4 h-4 rounded border-2 transition-colors flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)] mt-2"
              [class]="subtask.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-[var(--color-border-default)] hover:border-[var(--color-primary-border)]'"
              (click)="toggleSubtask(i, $event)"
              [attr.aria-label]="subtask.status === 'done' ? 'Als offen markieren' : 'Als erledigt markieren'"
              [attr.aria-checked]="subtask.status === 'done'"
              role="checkbox"
            >
              @if (subtask.status === 'done') {
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
              }
            </button>

            @if (editingIndex() === i) {
              <input
                type="text"
                class="flex-1 text-sm text-[var(--color-text-heading)] bg-transparent border-b-2 border-[var(--color-primary-solid)] focus:outline-none mt-1.5"
                [value]="editDraft()"
                (input)="editDraft.set($any($event.target).value)"
                (blur)="saveEdit(i)"
                (keydown)="onEditKeydown($event, i)"
                aria-label="Aufgabe bearbeiten"
              />
            } @else {
              <span
                class="flex-1 text-sm cursor-pointer mt-1.5 transition-colors"
                [class]="subtask.status === 'done' ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text-heading)] hover:text-[var(--color-primary-text)]'"
                (click)="startEdit(i)"
                tabindex="0"
                (keydown.enter)="startEdit(i)"
                [attr.aria-label]="subtask.title + ' — anklicken zum Bearbeiten'"
              >{{ subtask.title }}</span>
            }

            <button
              type="button"
              data-testid="subtask-delete"
              class="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-red-500 shrink-0 p-0.5 rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)]"
              (click)="deleteSubtask(i)"
              [attr.aria-label]="'Aufgabe löschen: ' + subtask.title"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        }
      </div>

      <div class="mt-2">
        <input
          type="text"
          data-testid="subtask-input"
          class="w-full text-sm text-[var(--color-text-body)] bg-transparent border-b border-[var(--color-border-subtle)] focus:border-[var(--color-primary-border)] focus:outline-none py-1.5 px-2 placeholder:text-[var(--color-text-muted)] placeholder:italic transition-colors"
          placeholder="Neue Aufgabe hinzufügen…"
          [value]="newTitle()"
          (input)="newTitle.set($any($event.target).value)"
          (keydown)="onAddKeydown($event)"
          aria-label="Neue Aufgabe hinzufügen"
        />
      </div>
    </section>
  `,
})
export class SubTaskListComponent {
  subtasks = input<SubTask[]>([]);
  showHeader = input(true);
  subtasksChange = output<SubTask[]>();

  newTitle = signal('');
  editingIndex = signal<number | null>(null);
  editDraft = signal('');
  celebratingId = signal<string | null>(null);
  private celebrateTimer: ReturnType<typeof setTimeout> | null = null;

  doneCount = computed(() => this.subtasks().filter(s => s.status === 'done').length);
  totalCount = computed(() => this.subtasks().length);
  allDone = computed(() => this.totalCount() > 0 && this.doneCount() === this.totalCount());

  counterClasses = computed(() => {
    if (this.allDone()) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (this.doneCount() > 0) return 'bg-[var(--color-primary-bg)] text-[var(--color-primary-text)] border-[var(--color-primary-border)]';
    return 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border-[var(--color-border-subtle)]';
  });

  onAddKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      const title = this.newTitle().trim();
      if (!title) return;
      const updated = [...this.subtasks(), createSubTask(title)];
      this.newTitle.set('');
      this.subtasksChange.emit(updated);
    }
  }

  toggleSubtask(index: number, event: Event): void {
    const current = this.subtasks()[index];
    const toggled: SubTask = current.status === 'open'
      ? { ...current, status: 'done', completedAt: new Date().toISOString() }
      : { ...current, status: 'open', completedAt: null };

    const updated = this.subtasks().map((s, i) => i === index ? toggled : s);
    this.subtasksChange.emit(updated);

    if (toggled.status === 'done') {
      const btn = event.target as HTMLElement;
      const anchor = btn.closest('[data-testid="subtask-item"]')?.querySelector('.st-checkbox') as HTMLElement ?? btn;
      try { spawnConfetti(anchor); } catch { /* not available in test/SSR */ }
      try { playChime(); } catch { /* not available in test/SSR */ }
      if (this.celebrateTimer) clearTimeout(this.celebrateTimer);
      this.celebratingId.set(toggled.id);
      this.celebrateTimer = setTimeout(() => this.celebratingId.set(null), 1500);
    }
  }

  startEdit(index: number): void {
    this.editDraft.set(this.subtasks()[index].title);
    this.editingIndex.set(index);
  }

  saveEdit(index: number): void {
    const val = this.editDraft().trim();
    if (val && val !== this.subtasks()[index].title) {
      const updated = this.subtasks().map((s, i) => i === index ? { ...s, title: val } : s);
      this.subtasksChange.emit(updated);
    }
    this.editingIndex.set(null);
  }

  onEditKeydown(e: KeyboardEvent, index: number): void {
    if (e.key === 'Enter') { e.preventDefault(); this.saveEdit(index); }
    if (e.key === 'Escape') { this.editingIndex.set(null); }
  }

  deleteSubtask(index: number): void {
    const updated = this.subtasks().filter((_, i) => i !== index);
    this.subtasksChange.emit(updated);
  }

  onDrop(event: CdkDragDrop<SubTask[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const arr = [...this.subtasks()];
    const [moved] = arr.splice(event.previousIndex, 1);
    arr.splice(event.currentIndex, 0, moved);
    this.subtasksChange.emit(arr);
  }
}
