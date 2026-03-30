import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../settings.service';
import { createDefaultSettings, OrbitSettings } from '../settings.model';

@Component({
  selector: 'app-view-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, KeyValuePipe],
  templateUrl: './view-settings.html',
  host: {
    class: 'flex flex-1 h-full overflow-hidden bg-[var(--color-bg-page)]',
  },
})
export class ViewSettingsComponent {
  private readonly settingsService = inject(SettingsService);

  readonly draft = signal<OrbitSettings>(structuredClone(this.settingsService.settings()));
  private readonly savedSnapshot = signal(JSON.stringify(this.settingsService.settings()));

  readonly isDirty = computed(() => JSON.stringify(this.draft()) !== this.savedSnapshot());
  readonly canSave = computed(() => {
    const d = this.draft();
    if (!this.isDirty()) return false;

    const jiraOk = d.connections.jira.baseUrl.trim() !== '' && d.connections.jira.apiKey.trim() !== '';
    const bbOk = d.connections.bitbucket.baseUrl.trim() !== '' && d.connections.bitbucket.apiKey.trim() !== '' && d.connections.bitbucket.userSlug.trim() !== '';
    if (!jiraOk || !bbOk) return false;

    const j = d.connections.jenkins;
    if (j?.baseUrl?.trim()) {
      if (j.username.trim() === '' || j.apiToken.trim() === '') return false;
      if (j.jobs.length === 0) return false;
      if (j.jobs.some(job => job.displayName.trim() === '' || job.jobPath.trim() === '')) return false;
    }

    return true;
  });

  readonly saveState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly activeSection = signal('verbindungen');

  readonly showJiraToken = signal(false);
  readonly showBitbucketToken = signal(false);
  readonly showJenkinsToken = signal(false);

  readonly sections = [
    {
      id: 'verbindungen',
      label: 'Verbindungen',
      children: [
        { id: 'jira', label: 'Jira' },
        { id: 'bitbucket', label: 'Bitbucket' },
        { id: 'jenkins', label: 'Jenkins' },
        { id: 'vertex-ai', label: 'Vertex AI Proxy' },
      ],
    },
    {
      id: 'funktionen',
      label: 'Funktionen',
      children: [
        { id: 'pomodoro', label: 'Pomodoro-Timer' },
        { id: 'ai-reviews', label: 'KI-Reviews' },
        { id: 'kalender', label: 'Tageskalender' },
      ],
    },
    { id: 'darstellung', label: 'Darstellung', children: [] },
  ];

  readonly agentDescriptions: Record<string, { label: string; description: string }> = {
    'code-quality': {
      label: 'Code-Qualität',
      description: 'Prüft auf Bugs, Logikfehler, Lesbarkeit und Wartbarkeit. Empfohlen für alle Projekte.',
    },
    'ak-abgleich': {
      label: 'AK-Abgleich',
      description: 'Vergleicht den Code mit den Akzeptanzkriterien aus dem verknüpften Jira-Ticket. Empfohlen wenn Jira genutzt wird.',
    },
    'accessibility': {
      label: 'Barrierefreiheit',
      description: 'Prüft WCAG AA Konformität für HTML und UI-Komponenten. Empfohlen für Frontend-Projekte.',
    },
  };

  readonly needsVertexWarning = computed(() => {
    const d = this.draft();
    return d.features.aiReviews.enabled && d.connections.vertexAi.url.trim() === '';
  });

  constructor() {
    effect(() => {
      const settings = structuredClone(this.settingsService.settings());
      const defaults = createDefaultSettings();
      settings.connections = { ...defaults.connections, ...settings.connections };
      this.draft.set(settings);
      this.savedSnapshot.set(JSON.stringify(settings));
    });
  }

  updateDraft(mutator: (draft: OrbitSettings) => void): void {
    const clone = structuredClone(this.draft());
    mutator(clone);
    this.draft.set(clone);
  }

  addJenkinsJob(): void {
    this.updateDraft(d => d.connections.jenkins.jobs.push({ displayName: '', jobPath: '' }));
  }

  removeJenkinsJob(index: number): void {
    this.updateDraft(d => d.connections.jenkins.jobs.splice(index, 1));
  }

  addCustomHeader(): void {
    this.updateDraft((d) => d.connections.vertexAi.customHeaders.push({ name: '', value: '' }));
  }

  removeCustomHeader(index: number): void {
    this.updateDraft((d) => d.connections.vertexAi.customHeaders.splice(index, 1));
  }

  toggleAgent(agentId: string, enabled: boolean): void {
    this.updateDraft(d => {
      const agents = d.features.aiReviews.enabledAgents;
      if (enabled && !agents.includes(agentId)) {
        agents.push(agentId);
      } else if (!enabled) {
        const idx = agents.indexOf(agentId);
        if (idx !== -1) agents.splice(idx, 1);
      }
    });
  }

  setTheme(theme: 'light' | 'dark' | 'system'): void {
    this.updateDraft((d) => (d.appearance.theme = theme));
  }

  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saveState.set('saving');
    try {
      await this.settingsService.save(this.draft());
      this.savedSnapshot.set(JSON.stringify(this.draft()));
      this.saveState.set('saved');
      setTimeout(() => this.saveState.set('idle'), 2000);
    } catch {
      this.saveState.set('error');
      setTimeout(() => this.saveState.set('idle'), 3000);
    }
  }

  private scrollLock = false;

  scrollTo(sectionId: string): void {
    this.activeSection.set(sectionId);
    this.scrollLock = true;
    document.getElementById('section-' + sectionId)?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => (this.scrollLock = false), 500);
  }

  onContentScroll(event: Event): void {
    if (this.scrollLock) return;
    const container = event.target as HTMLElement;
    const sectionElements = container.querySelectorAll('[data-section]');
    let currentSection = 'verbindungen';
    for (const el of Array.from(sectionElements)) {
      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (rect.top - containerRect.top <= 100) {
        currentSection = (el as HTMLElement).dataset['section']!;
      }
    }
    this.activeSection.set(currentSection);
  }

  discard(): void {
    this.draft.set(structuredClone(this.settingsService.settings()));
  }

  readonly showNavigationDialog = signal(false);
  private navigationResolve: ((value: boolean) => void) | null = null;

  confirmNavigation(): Promise<boolean> {
    this.showNavigationDialog.set(true);
    return new Promise<boolean>((resolve) => {
      this.navigationResolve = resolve;
    });
  }

  onNavigationCancel(): void {
    this.showNavigationDialog.set(false);
    this.navigationResolve?.(false);
    this.navigationResolve = null;
  }

  onNavigationDiscard(): void {
    this.showNavigationDialog.set(false);
    this.discard();
    this.navigationResolve?.(true);
    this.navigationResolve = null;
  }

  async onNavigationSave(): Promise<void> {
    this.showNavigationDialog.set(false);
    await this.save();
    this.navigationResolve?.(true);
    this.navigationResolve = null;
  }
}
