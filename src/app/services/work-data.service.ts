import { Injectable, signal, computed } from '@angular/core';
import { JiraTicket, PullRequest, Todo, WorkItem } from '../models/work-item.model';

@Injectable({ providedIn: 'root' })
export class WorkDataService {
  readonly tickets = signal<JiraTicket[]>([
    {
      type: 'ticket',
      id: 't1',
      key: 'VERS-2847',
      summary: 'Frontend-Integration: Neues Kunden-Dashboard',
      status: 'In Progress',
      priority: 'High',
      assignee: 'Dominik M.',
      reporter: 'Sarah K.',
      description: 'Implementierung des neuen Kunden-Dashboards gemäß Figma-Design. Anbindung an die bestehende REST-API für Vertragsdaten. Responsives Layout für alle Breakpoints sicherstellen.\n\nAkzeptanzkriterien:\n- Dashboard lädt in unter 2 Sekunden\n- Alle Vertragsdaten werden korrekt angezeigt\n- Mobile-Ansicht ist vollständig nutzbar',
      dueDate: '2026-03-13',
      updatedAt: '2026-03-13T09:15:00',
      url: 'https://jira.example.com/browse/VERS-2847',
      overdue: false,
    },
    {
      type: 'ticket',
      id: 't2',
      key: 'VERS-2801',
      summary: 'API-Anbindung: Schadensmeldung Formular',
      status: 'In Progress',
      priority: 'Medium',
      assignee: 'Dominik M.',
      reporter: 'Thomas B.',
      description: 'REST-API Integration für das Schadensmeldungs-Formular. Backend-Endpunkte sind bereits verfügbar. Frontend-Validierung und Fehlerbehandlung müssen noch implementiert werden.\n\nEndpoints:\n- POST /api/v2/claims\n- GET /api/v2/claims/{id}/status',
      dueDate: '2026-03-20',
      updatedAt: '2026-03-12T16:30:00',
      url: 'https://jira.example.com/browse/VERS-2801',
      overdue: false,
    },
    {
      type: 'ticket',
      id: 't3',
      key: 'VERS-2799',
      summary: 'Bug: Login-Fehler bei SSO-Weiterleitung',
      status: 'In Review',
      priority: 'High',
      assignee: 'Dominik M.',
      reporter: 'Anna L.',
      description: 'Nach dem SSO-Login über den Azure AD werden Nutzer nicht korrekt weitergeleitet. Der Redirect-Loop tritt auf, wenn die Session abgelaufen ist.\n\nReproduktion:\n1. Session ablaufen lassen\n2. Auf geschützte Seite navigieren\n3. SSO-Login durchführen\n4. → Loop tritt auf',
      dueDate: '2026-03-10',
      updatedAt: '2026-03-13T08:00:00',
      url: 'https://jira.example.com/browse/VERS-2799',
      overdue: true,
    },
    {
      type: 'ticket',
      id: 't4',
      key: 'VERS-2756',
      summary: 'Refactoring: Angular 21 Migration',
      status: 'In Progress',
      priority: 'Low',
      assignee: 'Dominik M.',
      reporter: 'Dominik M.',
      description: 'Schrittweise Migration auf Angular 21. Fokus auf Signal-basierte State-Management Patterns und die neuen Control Flow Blöcke (@if, @for).\n\nFortschritt:\n- ✓ Core-Module migriert\n- ✓ Routing auf neue API umgestellt\n- → Komponenten-Migration läuft',
      dueDate: '2026-04-01',
      updatedAt: '2026-03-11T14:20:00',
      url: 'https://jira.example.com/browse/VERS-2756',
      overdue: false,
    },
    {
      type: 'ticket',
      id: 't5',
      key: 'VERS-2823',
      summary: 'Unit Tests: PolicyService Coverage erhöhen',
      status: 'In Progress',
      priority: 'Medium',
      assignee: 'Dominik M.',
      reporter: 'Sarah K.',
      description: 'Test-Coverage für den PolicyService von aktuell 42% auf mindestens 80% erhöhen. Fehlende Edge-Cases abdecken, insbesondere bei der Vertragslaufzeit-Berechnung.',
      dueDate: '2026-03-25',
      updatedAt: '2026-03-10T11:00:00',
      url: 'https://jira.example.com/browse/VERS-2823',
      overdue: false,
    },
  ]);

  readonly pullRequests = signal<PullRequest[]>([
    {
      type: 'pr',
      id: 'pr1',
      title: 'feat: Add customer portal navigation component',
      repo: 'versicherung-frontend',
      branch: 'feature/customer-portal-nav',
      author: 'sarah.kowalski',
      status: 'Awaiting Review',
      commentCount: 2,
      updatedAt: '2026-03-13T10:30:00',
      url: 'https://bitbucket.example.com/projects/VF/repos/versicherung-frontend/pull-requests/412',
      description: 'Implementiert die neue Navigation für das Kundenportal. Beinhaltet responsive Sidebar, Breadcrumbs und Accessibility-Verbesserungen (WCAG AA).\n\nÄnderungen:\n- Neue NavComponent mit Signal-basiertem State\n- ARIA-Labels für alle interaktiven Elemente\n- E2E Tests mit Playwright',
    },
    {
      type: 'pr',
      id: 'pr2',
      title: 'fix: Resolve SSO redirect loop on session expiry',
      repo: 'versicherung-frontend',
      branch: 'fix/sso-redirect-loop',
      author: 'thomas.bauer',
      status: 'Awaiting Review',
      commentCount: 0,
      updatedAt: '2026-03-13T08:45:00',
      url: 'https://bitbucket.example.com/projects/VF/repos/versicherung-frontend/pull-requests/415',
      description: 'Behebt den SSO-Redirect-Loop (VERS-2799). Der AuthGuard wurde angepasst, um abgelaufene Sessions korrekt zu erkennen und den State vor dem Redirect zu speichern.',
    },
    {
      type: 'pr',
      id: 'pr3',
      title: 'chore: Update Angular and dependencies to latest',
      repo: 'versicherung-shared-lib',
      branch: 'chore/dependency-updates',
      author: 'anna.lehmann',
      status: 'Changes Requested',
      commentCount: 5,
      updatedAt: '2026-03-12T15:00:00',
      url: 'https://bitbucket.example.com/projects/VF/repos/versicherung-shared-lib/pull-requests/89',
      description: 'Dependency-Updates auf die neuesten stabilen Versionen. Betrifft Angular, RxJS und alle Dev-Dependencies. Breaking Changes wurden geprüft und angepasst.',
    },
    {
      type: 'pr',
      id: 'pr4',
      title: 'feat: Implement SEPA mandate form with validation',
      repo: 'versicherung-frontend',
      branch: 'feature/sepa-mandate',
      author: 'michael.hoffmann',
      status: 'Approved',
      commentCount: 3,
      updatedAt: '2026-03-11T17:20:00',
      url: 'https://bitbucket.example.com/projects/VF/repos/versicherung-frontend/pull-requests/408',
      description: 'SEPA-Lastschriftmandat Formular mit vollständiger Validierung. Reactive Forms, IBAN-Validierung via Bibliothek, Fehlerbehandlung.',
    },
  ]);

  readonly todos = signal<Todo[]>([
    {
      type: 'todo',
      id: 'td1',
      title: 'Standup-Notizen vorbereiten',
      description: 'Kurze Zusammenfassung der gestrigen Arbeit und heutige Ziele für das Team-Standup um 09:30 Uhr.',
      done: false,
      createdAt: '2026-03-13T07:00:00',
    },
    {
      type: 'todo',
      id: 'td2',
      title: 'PR-Review Block im Kalender eintragen',
      description: 'Täglich 14:00-15:00 Uhr als festen Block für Code Reviews reservieren, damit PRs nicht liegen bleiben.',
      done: false,
      createdAt: '2026-03-12T16:00:00',
    },
    {
      type: 'todo',
      id: 'td3',
      title: 'API-Spec mit Thomas abstimmen',
      description: 'Offene Fragen zur Schadensmeldungs-API klären: Fehler-Codes, Rate-Limiting, Auth-Header Format.',
      done: false,
      createdAt: '2026-03-12T10:00:00',
    },
    {
      type: 'todo',
      id: 'td4',
      title: 'Code-Review Checkliste aktualisieren',
      description: 'Checkliste um Punkte für Accessibility und Performance-Budget erweitern.',
      done: true,
      createdAt: '2026-03-11T09:00:00',
    },
  ]);

  readonly selectedItem = signal<WorkItem | null>(null);

  readonly pendingTodoCount = computed(() => this.todos().filter(t => !t.done).length);
  readonly awaitingReviewCount = computed(() => this.pullRequests().filter(pr => pr.status === 'Awaiting Review').length);

  select(item: WorkItem): void {
    this.selectedItem.set(item);
  }

  addTodo(title: string, description: string): void {
    const todo: Todo = {
      type: 'todo',
      id: `td-${Date.now()}`,
      title,
      description,
      done: false,
      createdAt: new Date().toISOString(),
    };
    this.todos.update(todos => [todo, ...todos]);
  }

  toggleTodo(id: string): void {
    this.todos.update(todos =>
      todos.map(t => t.id === id ? { ...t, done: !t.done } : t)
    );
    const updated = this.todos().find(t => t.id === id);
    if (updated && this.selectedItem()?.id === id) {
      this.selectedItem.set(updated);
    }
  }
}
