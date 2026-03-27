import { ChangeDetectionStrategy, Component, inject, input, signal, effect } from '@angular/core';
import { Idea } from '../../models/work-item.model';
import { IdeaService } from '../../services/idea.service';
import { WorkDataService } from '../../services/work-data.service';
import { SubTaskListComponent } from '../sub-task-list/sub-task-list';
import { SubTask } from '../../models/sub-task.model';

@Component({
  selector: 'app-idea-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SubTaskListComponent],
  template: `
    <article class="h-full flex flex-col max-w-2xl mx-auto w-full" [attr.aria-label]="'Idee: ' + idea().title">
      <header class="pb-5 border-b border-[var(--color-border-subtle)]">
        <div class="flex items-start gap-2 mb-2">
          <span class="text-lg" aria-hidden="true">💡</span>
          <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
            [class]="idea().status === 'wont-do' ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)]' : 'bg-[var(--color-primary-bg)] text-[var(--color-primary-text)]'">
            {{ idea().status === 'wont-do' ? 'Nicht verfolgt' : 'Aktiv' }}
          </span>
        </div>

        @if (editingTitle()) {
          <input
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
            [class]="idea().status === 'wont-do' ? 'line-through text-[var(--color-text-muted)]' : ''"
            (click)="startEditTitle()"
            tabindex="0"
            (keydown.enter)="startEditTitle()"
            aria-label="Titel anklicken zum Bearbeiten"
          >{{ idea().title }}</h1>
        }
      </header>

      <div class="py-5 border-b border-[var(--color-border-subtle)]">
        <dl>
          <div>
            <dt class="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Erstellt am</dt>
            <dd class="text-sm text-[var(--color-text-body)]">{{ formatDate(idea().createdAt) }}</dd>
          </div>
        </dl>
      </div>

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
            [attr.aria-label]="idea().description ? 'Notizen anklicken zum Bearbeiten' : 'Notizen hinzufügen'"
          >
            @if (idea().description) {
              {{ idea().description }}
            } @else {
              <span class="text-[var(--color-text-muted)] italic">Notizen hinzufügen…</span>
            }
          </div>
        }

        <div class="py-5 border-t border-[var(--color-border-subtle)]">
          <app-sub-task-list
            [subtasks]="idea().subtasks ?? []"
            (subtasksChange)="onSubtasksChange($event)"
          />
        </div>
      </div>
    </article>
  `,
})
export class IdeaDetailComponent {
  idea = input.required<Idea>();
  private readonly ideaService = inject(IdeaService);
  private readonly workData = inject(WorkDataService);

  editingTitle = signal(false);
  editingDescription = signal(false);
  draftTitle = signal('');
  draftDescription = signal('');

  constructor() {
    effect(() => {
      const i = this.idea();
      this.draftTitle.set(i.title);
      this.draftDescription.set(i.description);
      this.editingTitle.set(false);
      this.editingDescription.set(false);
    });
  }

  startEditTitle(): void { this.draftTitle.set(this.idea().title); this.editingTitle.set(true); }

  saveTitle(): void {
    const val = this.draftTitle().trim();
    if (val && val !== this.idea().title) {
      const updated = { ...this.idea(), title: val };
      this.ideaService.update(updated);
      this.workData.selectedItem.set(updated);
    }
    this.editingTitle.set(false);
  }

  onTitleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') { e.preventDefault(); this.saveTitle(); }
    if (e.key === 'Escape') { this.editingTitle.set(false); }
  }

  startEditDescription(): void { this.draftDescription.set(this.idea().description); this.editingDescription.set(true); }

  saveDescription(): void {
    const val = this.draftDescription().trim();
    if (val !== this.idea().description) {
      const updated = { ...this.idea(), description: val };
      this.ideaService.update(updated);
      this.workData.selectedItem.set(updated);
    }
    this.editingDescription.set(false);
  }

  onDescriptionKeydown(e: KeyboardEvent): void {
    if (e.ctrlKey && e.key === 'Enter') { this.saveDescription(); }
    if (e.key === 'Escape') { this.editingDescription.set(false); }
  }

  onSubtasksChange(subtasks: SubTask[]): void {
    const updated = { ...this.idea(), subtasks };
    this.ideaService.update(updated);
    this.workData.selectedItem.set(updated);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
