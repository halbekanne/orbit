import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Idea } from '../../shared/work-item.model';
import { IdeaService } from '../idea.service';
import { WorkspaceService } from '../../shared/workspace.service';
import { SubTaskListComponent } from '../../shared/sub-task-list/sub-task-list';
import { SubTask } from '../../todos/sub-task.model';
import { CompactHeaderBarComponent } from '../../shared/compact-header-bar/compact-header-bar';
import { DetailActionBarComponent } from '../../shared/detail-action-bar/detail-action-bar';
import { CollapsibleSectionComponent } from '../../shared/collapsible-section/collapsible-section';
import { BadgeColor, BadgeComponent } from '../../shared/badge/badge';

@Component({
  selector: 'app-idea-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SubTaskListComponent,
    CompactHeaderBarComponent,
    DetailActionBarComponent,
    CollapsibleSectionComponent,
    BadgeComponent,
  ],
  styles: [
    `
      @keyframes ideaFadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      :host {
        display: block;
        animation: ideaFadeIn 0.15s ease-out;
      }
    `,
  ],
  template: `
    <article [attr.aria-label]="'Idee: ' + idea().title">
      <app-compact-header-bar
        [visible]="showCompactBar()"
        [title]="idea().title"
        [statusLabel]="statusLabelText()"
        [statusColor]="statusColor()"
        [stripeColor]="statusStripeClass()"
        [prefix]="'💡'"
      />

      <header class="bg-[var(--color-bg-card)] border-b border-[var(--color-border-subtle)]">
        <div class="max-w-2xl mx-auto relative">
          <div
            class="absolute left-0 top-0 bottom-0 w-[3px]"
            [class]="statusStripeClass()"
            aria-hidden="true"
          ></div>

          <div class="px-6 pt-5 pb-4 pl-7">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <span class="text-lg" aria-hidden="true">💡</span>
              <orbit-badge [color]="statusColor()" [status]="true">{{
                idea().status === 'wont-do' ? 'Nicht verfolgt' : 'Aktiv'
              }}</orbit-badge>
            </div>

            @if (editingTitle()) {
              <input
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
                [class]="
                  idea().status === 'wont-do' ? 'line-through text-[var(--color-text-muted)]' : ''
                "
                (click)="startEditTitle()"
                tabindex="0"
                (keydown.enter)="startEditTitle()"
                aria-label="Titel anklicken zum Bearbeiten"
              >
                {{ idea().title }}
              </h1>
            }

            <p class="text-xs text-[var(--color-text-muted)] mt-2">
              erstellt {{ formatDate(idea().createdAt) }}
            </p>
          </div>

          <app-detail-action-bar [item]="idea()" />
        </div>
      </header>

      <div #headerSentinel></div>

      <div class="max-w-2xl mx-auto space-y-3 py-4 px-2">
        <app-collapsible-section label="Notizen" [expanded]="true">
          <svg
            sectionIcon
            class="w-4 h-4 text-[var(--color-text-muted)] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
          </svg>
          @if (editingDescription()) {
            <textarea
              class="text-sm text-[var(--color-text-body)] leading-relaxed w-full bg-transparent border border-[var(--color-primary-solid)] rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] min-h-[120px] resize-none"
              [value]="draftDescription()"
              (input)="draftDescription.set($any($event.target).value)"
              (blur)="saveDescription()"
              (keydown)="onDescriptionKeydown($event)"
              aria-label="Notizen bearbeiten"
            ></textarea>
            <p class="text-xs text-[var(--color-text-muted)] mt-1">
              Ctrl+Enter zum Speichern · Escape zum Abbrechen
            </p>
          } @else {
            <div
              class="text-sm text-[var(--color-text-body)] leading-relaxed whitespace-pre-line cursor-pointer min-h-[60px] hover:bg-[var(--color-bg-surface)] rounded-md p-1 -m-1 transition-colors"
              (click)="startEditDescription()"
              tabindex="0"
              (keydown.enter)="startEditDescription()"
              [attr.aria-label]="
                idea().description ? 'Notizen anklicken zum Bearbeiten' : 'Notizen hinzufügen'
              "
            >
              @if (idea().description) {
                {{ idea().description }}
              } @else {
                <span class="text-[var(--color-text-muted)] italic">Notizen hinzufügen…</span>
              }
            </div>
          }
        </app-collapsible-section>

        <app-collapsible-section label="Teilaufgaben" [expanded]="true">
          <svg
            sectionIcon
            class="w-4 h-4 text-[var(--color-text-muted)] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <ng-container sectionMeta>
            <span class="text-xs text-[var(--color-text-muted)]">{{
              subtaskCounter(idea().subtasks ?? [])
            }}</span>
          </ng-container>
          <app-sub-task-list
            [subtasks]="idea().subtasks ?? []"
            [showHeader]="false"
            (subtasksChange)="onSubtasksChange($event)"
          />
        </app-collapsible-section>

        <div class="h-4" aria-hidden="true"></div>
      </div>
    </article>
  `,
})
export class IdeaDetailComponent {
  idea = input.required<Idea>();
  private readonly ideaService = inject(IdeaService);
  private readonly workData = inject(WorkspaceService);
  private readonly destroyRef = inject(DestroyRef);

  editingTitle = signal(false);
  editingDescription = signal(false);
  draftTitle = signal('');
  draftDescription = signal('');

  readonly showCompactBar = signal(false);
  private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('headerSentinel');

  readonly statusStripeClass = computed(() =>
    this.idea().status === 'wont-do' ? 'bg-stone-400' : 'bg-amber-500',
  );

  readonly statusLabelText = computed(() =>
    this.idea().status === 'wont-do' ? 'Nicht verfolgt' : 'Aktiv',
  );

  readonly statusColor = computed(
    (): BadgeColor => (this.idea().status === 'wont-do' ? 'neutral' : 'primary'),
  );

  constructor() {
    effect(() => {
      const i = this.idea();
      this.draftTitle.set(i.title);
      this.draftDescription.set(i.description);
      this.editingTitle.set(false);
      this.editingDescription.set(false);
    });

    afterNextRender(() => {
      const sentinel = this.scrollSentinel()?.nativeElement;
      if (!sentinel) return;
      const observer = new IntersectionObserver(
        ([entry]) => this.showCompactBar.set(!entry.isIntersecting),
        { threshold: 0 },
      );
      observer.observe(sentinel);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  startEditTitle(): void {
    this.draftTitle.set(this.idea().title);
    this.editingTitle.set(true);
  }

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
    if (e.key === 'Enter') {
      e.preventDefault();
      this.saveTitle();
    }
    if (e.key === 'Escape') {
      this.editingTitle.set(false);
    }
  }

  startEditDescription(): void {
    this.draftDescription.set(this.idea().description);
    this.editingDescription.set(true);
  }

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
    if (e.ctrlKey && e.key === 'Enter') {
      this.saveDescription();
    }
    if (e.key === 'Escape') {
      this.editingDescription.set(false);
    }
  }

  onSubtasksChange(subtasks: SubTask[]): void {
    const updated = { ...this.idea(), subtasks };
    this.ideaService.update(updated);
    this.workData.selectedItem.set(updated);
  }

  subtaskCounter(subtasks: SubTask[]): string {
    const done = subtasks.filter((s) => s.status === 'done').length;
    return `${done}/${subtasks.length}`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
