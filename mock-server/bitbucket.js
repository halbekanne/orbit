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
    description: 'Implementiert die neue Navigation für das Kundenportal. Beinhaltet responsive Sidebar, Breadcrumbs und Accessibility-Verbesserungen (WCAG AA).',
    state: 'OPEN',
    open: true,
    closed: false,
    locked: false,
    createdDate: 1741694400000,
    updatedDate: 1741866600000,
    fromRef: makeRef('feature/customer-portal-nav', 'a1b2c3d4', REPO_VF),
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
    description: 'Behebt den SSO-Redirect-Loop (VERS-2799). Der AuthGuard wurde angepasst, um abgelaufene Sessions korrekt zu erkennen.',
    state: 'OPEN',
    open: true,
    closed: false,
    locked: false,
    createdDate: 1741780800000,
    updatedDate: 1741953000000,
    fromRef: makeRef('fix/sso-redirect-loop', 'b2c3d4e5', REPO_VF),
    toRef: makeRef('main', 'e5f6g7h8', REPO_VF),
    author: makeParticipant(THOMAS, 'AUTHOR', 'UNAPPROVED'),
    reviewers: [makeParticipant(CURRENT_USER, 'REVIEWER', 'UNAPPROVED')],
    participants: [],
    properties: { commentCount: 0, openTaskCount: 0 },
    links: { self: [{ href: `${BASE}/projects/VF/repos/versicherung-frontend/pull-requests/415` }] },
  },
  {
    id: 89,
    title: 'chore: Update Angular and dependencies to latest',
    description: 'Dependency-Updates auf die neuesten stabilen Versionen. Alle Tests laufen durch.',
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

app.listen(PORT, () => {
  console.log(`Mock Bitbucket server running at http://localhost:${PORT}`);
});
