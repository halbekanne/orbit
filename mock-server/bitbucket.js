const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 6203;

app.use(cors());
app.use(express.json());

app.use((_req, _res, next) => {
  setTimeout(next, 3000);
});

const BASE = `http://localhost:${PORT}`;

const CURRENT_USER = {
  name: 'dominik.mueller',
  slug: 'dominik.mueller',
  displayName: 'Dominik Müller',
  emailAddress: 'dominik.mueller@example.org',
  id: 42,
  active: true,
  type: 'NORMAL',
  links: { self: [{ href: `${BASE}/users/dominik.mueller` }] },
};

const makeUser = (id, slug, displayName, email) => ({
  id,
  name: slug,
  slug,
  displayName,
  emailAddress: email,
  active: true,
  type: 'NORMAL',
  links: { self: [{ href: `${BASE}/users/${slug}` }] },
});

const makeParticipant = (user, role, status) => ({
  user,
  role,
  approved: status === 'APPROVED',
  status,
});

const makeRepo = (id, slug, projectKey, projectName) => ({
  id,
  slug,
  name: slug,
  project: { key: projectKey, id: id * 10, name: projectName },
  links: { self: [{ href: `${BASE}/projects/${projectKey}/repos/${slug}/browse` }] },
});

const makeRef = (displayId, latestCommit, repo) => ({
  id: `refs/heads/${displayId}`,
  displayId,
  latestCommit,
  repository: repo,
});

const REPO_VF = makeRepo(1, 'versicherung-frontend', 'VF', 'Versicherung Frontend');
const REPO_SL = makeRepo(2, 'versicherung-shared-lib', 'SL', 'Versicherung Shared Lib');

const SARAH = makeUser(101, 'sarah.kowalski', 'Sarah Kowalski', 'sarah.kowalski@example.org');
const THOMAS = makeUser(102, 'thomas.bauer', 'Thomas Bauer', 'thomas.bauer@example.org');
const ANNA = makeUser(103, 'anna.lehmann', 'Anna Lehmann', 'anna.lehmann@example.org');
const MICHAEL = makeUser(104, 'michael.hoffmann', 'Michael Hoffmann', 'michael.hoffmann@example.org');

const mockPullRequests = [
  {
    id: 412,
    title: 'feat: Add customer portal navigation component',
    description: 'h2. Übersicht\nImplementiert die neue Navigation für das Kundenportal.\n\nh2. Änderungen\n* Responsive Sidebar mit Kollaps-Funktion\n* Breadcrumbs für alle Unterseiten\n* Accessibility-Verbesserungen (WCAG AA)\n\nh2. Technische Details\nDie Komponente nutzt das neue [Angular Router API|https://angular.dev/guide/routing] und ist vollständig mit {{aria-label}} und {{role}}-Attributen ausgestattet.\n\n{code:title=navigation.component.ts}\n@Component({\n  selector: \'app-nav\',\n  standalone: true,\n})\nexport class NavigationComponent {}\n{code}',
    state: 'OPEN',
    open: true,
    closed: false,
    locked: false,
    createdDate: 1741694400000,
    updatedDate: 1741866600000,
    fromRef: makeRef('feature/DASH-0842-customer-portal-nav', 'a1b2c3d4', REPO_VF),
    toRef: makeRef('main', 'e5f6g7h8', REPO_VF),
    author: makeParticipant(SARAH, 'AUTHOR', 'UNAPPROVED'),
    reviewers: [makeParticipant(CURRENT_USER, 'REVIEWER', 'UNAPPROVED')],
    participants: [],
    properties: { commentCount: 2, openTaskCount: 0 },
    links: { self: [{ href: `${BASE}/projects/VF/repos/versicherung-frontend/pull-requests/412` }] },
  },
  {
    id: 415,
    title: 'fix: Resolve SSO redirect loop on session expiry',
    description: 'h2. Problem\nBehebt den SSO-Redirect-Loop (*VERS-2799*). Der {{AuthGuard}} erkannte abgelaufene Sessions nicht korrekt und leitete den Nutzer in eine Endlosschleife.\n\nh2. Ursache\nbq. Der Token-Refresh wurde ausgelöst, bevor die Session-Validierung abgeschlossen war.\n\nh2. Lösung\n# {{AuthGuard}} prüft jetzt zuerst den Session-Status\n# Bei abgelaufener Session wird direkt zum Login weitergeleitet\n# Token-Refresh nur noch bei gültiger Session',
    state: 'OPEN',
    open: true,
    closed: false,
    locked: false,
    createdDate: 1741780800000,
    updatedDate: 1741953000000,
    fromRef: makeRef('fix/DASH-0824-sso-redirect-loop', 'b2c3d4e5', REPO_VF),
    toRef: makeRef('main', 'e5f6g7h8', REPO_VF),
    author: makeParticipant(THOMAS, 'AUTHOR', 'UNAPPROVED'),
    reviewers: [makeParticipant(CURRENT_USER, 'REVIEWER', 'UNAPPROVED'), makeParticipant(ANNA, 'REVIEWER', 'APPROVED')],
    participants: [],
    properties: { commentCount: 0, openTaskCount: 0 },
    links: { self: [{ href: `${BASE}/projects/VF/repos/versicherung-frontend/pull-requests/415` }] },
  },
  {
    id: 89,
    title: 'chore: Update Angular and dependencies to latest',
    description: 'h2. Aktualisierte Pakete\n|| Paket || Alt || Neu ||\n| {{@angular/core}} | 19.2.0 | 20.0.1 |\n| {{typescript}} | 5.4.5 | 5.8.3 |\n| {{rxjs}} | 7.8.1 | 7.8.2 |\n\nAlle Tests laufen durch. _Breaking Changes_ wurden geprüft und sind nicht betroffen.',
    state: 'OPEN',
    open: true,
    closed: false,
    locked: false,
    createdDate: 1741608000000,
    updatedDate: 1741780800000,
    fromRef: makeRef('chore/dependency-updates', 'c3d4e5f6', REPO_SL),
    toRef: makeRef('main', 'f6g7h8i9', REPO_SL),
    author: makeParticipant(ANNA, 'AUTHOR', 'UNAPPROVED'),
    reviewers: [makeParticipant(CURRENT_USER, 'REVIEWER', 'NEEDS_WORK')],
    participants: [],
    properties: { commentCount: 5, openTaskCount: 2 },
    links: { self: [{ href: `${BASE}/projects/SL/repos/versicherung-shared-lib/pull-requests/89` }] },
  },
  {
    id: 91,
    title: 'DASH-0831: refactor: Extract policy calculation to shared service',
    description: 'Refactoring der Berechnungslogik in einen gemeinsamen Service. Ermöglicht Wiederverwendung in anderen Formularen.',
    state: 'OPEN',
    open: true,
    closed: false,
    locked: false,
    createdDate: 1741521600000,
    updatedDate: 1741953000000,
    fromRef: makeRef('refactor/policy-calculation', 'd4e5f6a1', REPO_SL),
    toRef: makeRef('main', 'f6g7h8i9', REPO_SL),
    author: makeParticipant(MICHAEL, 'AUTHOR', 'UNAPPROVED'),
    reviewers: [makeParticipant(CURRENT_USER, 'REVIEWER', 'NEEDS_WORK')],
    participants: [],
    properties: { commentCount: 3, openTaskCount: 0 },
    links: { self: [{ href: `${BASE}/projects/SL/repos/versicherung-shared-lib/pull-requests/91` }] },
  },
  {
    id: 420,
    title: '[WIP] feat: Redesign claims submission wizard',
    description: 'h2. Arbeit in Fortschritt\nDieser PR ist noch nicht fertig. Folgende Punkte fehlen noch:\n* Unit-Tests für den neuen Wizard-Schritt 3\n* Accessibility-Review\n* Responsive Layout für mobile Ansicht',
    state: 'OPEN',
    open: true,
    closed: false,
    locked: false,
    draft: true,
    createdDate: 1741953000000,
    updatedDate: 1742039400000,
    fromRef: makeRef('feature/DASH-0855-claims-wizard-redesign', 'e5f6a1b2', REPO_VF),
    toRef: makeRef('main', 'e5f6g7h8', REPO_VF),
    author: makeParticipant(SARAH, 'AUTHOR', 'UNAPPROVED'),
    reviewers: [makeParticipant(CURRENT_USER, 'REVIEWER', 'UNAPPROVED')],
    participants: [],
    properties: { commentCount: 1, openTaskCount: 3 },
    links: { self: [{ href: `${BASE}/projects/VF/repos/versicherung-frontend/pull-requests/420` }] },
  },
  {
    id: 408,
    title: 'feat: Implement SEPA mandate form with validation',
    description: 'SEPA-Lastschriftmandat Formular mit vollständiger clientseitiger Validierung. IBAN-Format, BIC, Pflichtfelder.',
    state: 'OPEN',
    open: true,
    closed: false,
    locked: false,
    createdDate: 1741521600000,
    updatedDate: 1741694400000,
    fromRef: makeRef('feature/sepa-mandate', 'd4e5f6g7', REPO_VF),
    toRef: makeRef('main', 'e5f6g7h8', REPO_VF),
    author: makeParticipant(MICHAEL, 'AUTHOR', 'UNAPPROVED'),
    reviewers: [makeParticipant(CURRENT_USER, 'REVIEWER', 'APPROVED')],
    participants: [],
    properties: { commentCount: 3, openTaskCount: 0 },
    links: { self: [{ href: `${BASE}/projects/VF/repos/versicherung-frontend/pull-requests/408` }] },
  },
];

app.get('/rest/api/latest/dashboard/pull-requests', (_req, res) => {
  res.json({
    size: mockPullRequests.length,
    limit: 25,
    isLastPage: true,
    values: mockPullRequests,
    start: 0,
  });
});

const ACTIVITIES_FIXTURES = {
  89: {
    values: [
      {
        action: 'REVIEWED',
        user: CURRENT_USER,
        reviewedStatus: 'NEEDS_WORK',
      },
      {
        action: 'COMMENTED',
        user: ANNA,
      },
      {
        action: 'OPENED',
        user: ANNA,
      },
    ],
    isLastPage: true,
  },
  91: {
    values: [
      {
        action: 'COMMENTED',
        user: MICHAEL,
      },
      {
        action: 'REVIEWED',
        user: CURRENT_USER,
        reviewedStatus: 'NEEDS_WORK',
      },
      {
        action: 'OPENED',
        user: MICHAEL,
      },
    ],
    isLastPage: true,
  },
};

app.get(
  '/rest/api/latest/projects/:projectKey/repos/:repoSlug/pull-requests/:prId/activities',
  (req, res) => {
    const prId = parseInt(req.params.prId, 10);
    const fixture = ACTIVITIES_FIXTURES[prId];
    if (fixture) {
      res.json(fixture);
    } else {
      res.json({ values: [], isLastPage: true });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Mock Bitbucket server running at http://localhost:${PORT}`);
});
