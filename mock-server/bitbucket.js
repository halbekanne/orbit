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
  {
    id: 423,
    title: 'feat: Add dark mode toggle to settings page',
    description: 'h2. Übersicht\nImplementiert einen Dark-Mode-Toggle auf der Einstellungsseite.\n\nh2. Änderungen\n* Toggle-Switch in den Einstellungen\n* CSS-Variablen für Farbwechsel\n* Persistierung der Auswahl im LocalStorage',
    state: 'OPEN',
    open: true,
    closed: false,
    locked: false,
    createdDate: 1741866600000,
    updatedDate: 1742039400000,
    fromRef: makeRef('feature/DASH-0860-dark-mode-toggle', 'f6a1b2c3', REPO_VF),
    toRef: makeRef('main', 'e5f6g7h8', REPO_VF),
    author: makeParticipant(CURRENT_USER, 'AUTHOR', 'UNAPPROVED'),
    reviewers: [makeParticipant(SARAH, 'REVIEWER', 'APPROVED'), makeParticipant(THOMAS, 'REVIEWER', 'APPROVED')],
    participants: [],
    properties: { commentCount: 4, openTaskCount: 0 },
    links: { self: [{ href: `${BASE}/projects/VF/repos/versicherung-frontend/pull-requests/423` }] },
  },
  {
    id: 87,
    title: 'fix: Correct currency formatting in policy overview',
    description: 'Behebt die fehlerhafte Währungsformatierung (fehlende Tausender-Trennzeichen) in der Vertragsübersicht.',
    state: 'OPEN',
    open: true,
    closed: false,
    locked: false,
    createdDate: 1741780800000,
    updatedDate: 1741953000000,
    fromRef: makeRef('fix/DASH-0848-currency-format', 'a1b2c3d4', REPO_SL),
    toRef: makeRef('main', 'f6g7h8i9', REPO_SL),
    author: makeParticipant(CURRENT_USER, 'AUTHOR', 'UNAPPROVED'),
    reviewers: [makeParticipant(ANNA, 'REVIEWER', 'NEEDS_WORK')],
    participants: [],
    properties: { commentCount: 2, openTaskCount: 1 },
    links: { self: [{ href: `${BASE}/projects/SL/repos/versicherung-shared-lib/pull-requests/87` }] },
  },
];

app.get('/rest/api/latest/dashboard/pull-requests', (req, res) => {
  const role = req.query.role;
  let filtered = mockPullRequests;
  if (role === 'AUTHOR') {
    filtered = mockPullRequests.filter(pr => pr.author.user.slug === CURRENT_USER.slug);
  } else if (role === 'REVIEWER') {
    filtered = mockPullRequests.filter(pr =>
      pr.reviewers.some(r => r.user.slug === CURRENT_USER.slug),
    );
  }
  res.json({
    size: filtered.length,
    limit: 25,
    isLastPage: true,
    values: filtered,
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
  423: {
    values: [
      {
        action: 'REVIEWED',
        user: THOMAS,
        reviewedStatus: 'APPROVED',
      },
      {
        action: 'REVIEWED',
        user: SARAH,
        reviewedStatus: 'APPROVED',
      },
      {
        action: 'COMMENTED',
        user: SARAH,
      },
      {
        action: 'OPENED',
        user: CURRENT_USER,
      },
    ],
    isLastPage: true,
  },
  87: {
    values: [
      {
        action: 'REVIEWED',
        user: ANNA,
        reviewedStatus: 'NEEDS_WORK',
      },
      {
        action: 'COMMENTED',
        user: ANNA,
      },
      {
        action: 'OPENED',
        user: CURRENT_USER,
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

const DIFF_FIXTURES = {
  412: `diff --git a/src/app/components/navigation/navigation.component.ts b/src/app/components/navigation/navigation.component.ts
new file mode 100644
index 0000000..a1b2c3d
--- /dev/null
+++ b/src/app/components/navigation/navigation.component.ts
@@ -0,0 +1,42 @@
+import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
+import { RouterLink, RouterLinkActive } from '@angular/router';
+
+interface NavItem {
+  label: string;
+  path: string;
+  icon: string;
+}
+
+@Component({
+  selector: 'app-navigation',
+  changeDetection: ChangeDetectionStrategy.OnPush,
+  imports: [RouterLink, RouterLinkActive],
+  template: \`
+    <nav class="flex flex-col h-full bg-stone-50 border-r border-stone-200"
+         [class.w-64]="expanded()" [class.w-16]="!expanded()"
+         role="navigation" aria-label="Hauptnavigation">
+      <button (click)="toggle()" class="p-4" [attr.aria-expanded]="expanded()">
+        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
+          <path d="M3 12h18M3 6h18M3 18h18"/>
+        </svg>
+      </button>
+      @for (item of items(); track item.path) {
+        <a [routerLink]="item.path" routerLinkActive="bg-indigo-50 text-indigo-700"
+           class="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-100"
+           [attr.aria-label]="item.label">
+          <span class="shrink-0">{{ item.icon }}</span>
+          @if (expanded()) {
+            <span>{{ item.label }}</span>
+          }
+        </a>
+      }
+    </nav>
+  \`,
+})
+export class NavigationComponent {
+  expanded = signal(true);
+  items = signal<NavItem[]>([
+    { label: 'Dashboard', path: '/dashboard', icon: '📊' },
+    { label: 'Verträge', path: '/contracts', icon: '📋' },
+    { label: 'Kunden', path: '/customers', icon: '👥' },
+    { label: 'Einstellungen', path: '/settings', icon: '⚙️' },
+  ]);
+  toggle() { this.expanded.update(v => !v); }
+}
diff --git a/src/app/components/navigation/breadcrumb.component.ts b/src/app/components/navigation/breadcrumb.component.ts
new file mode 100644
index 0000000..b2c3d4e
--- /dev/null
+++ b/src/app/components/navigation/breadcrumb.component.ts
@@ -0,0 +1,28 @@
+import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
+
+export interface Breadcrumb {
+  label: string;
+  path?: string;
+}
+
+@Component({
+  selector: 'app-breadcrumb',
+  changeDetection: ChangeDetectionStrategy.OnPush,
+  template: \`
+    <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-xs text-stone-500 py-2">
+      @for (crumb of items(); track crumb.label; let last = $last) {
+        @if (crumb.path && !last) {
+          <a [href]="crumb.path" class="hover:text-indigo-600 hover:underline">{{ crumb.label }}</a>
+        } @else {
+          <span [class.font-semibold]="last" [class.text-stone-700]="last">{{ crumb.label }}</span>
+        }
+        @if (!last) {
+          <span aria-hidden="true" class="text-stone-300">/</span>
+        }
+      }
+    </nav>
+  \`,
+})
+export class BreadcrumbComponent {
+  items = input.required<Breadcrumb[]>();
+}
diff --git a/src/app/app.routes.ts b/src/app/app.routes.ts
index c4d5e6f..d5e6f7a 100644
--- a/src/app/app.routes.ts
+++ b/src/app/app.routes.ts
@@ -1,8 +1,14 @@
 import { Routes } from '@angular/router';

 export const routes: Routes = [
-  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
   {
-    path: 'dashboard',
-    loadComponent: () => import('./pages/dashboard/dashboard.component'),
+    path: '',
+    loadComponent: () => import('./components/navigation/navigation.component').then(m => m.NavigationComponent),
+    children: [
+      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
+      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component') },
+      { path: 'contracts', loadComponent: () => import('./pages/contracts/contracts.component') },
+      { path: 'customers', loadComponent: () => import('./pages/customers/customers.component') },
+      { path: 'settings', loadComponent: () => import('./pages/settings/settings.component') },
+    ],
   },
 ];`,

  415: `diff --git a/src/app/guards/auth.guard.ts b/src/app/guards/auth.guard.ts
index a1b2c3d..f8e9a0b 100644
--- a/src/app/guards/auth.guard.ts
+++ b/src/app/guards/auth.guard.ts
@@ -1,5 +1,6 @@
 import { Injectable, inject } from '@angular/core';
 import { Router } from '@angular/router';
+import { AuthService } from '../services/auth.service';

 @Injectable({ providedIn: 'root' })
 export class AuthGuard {
@@ -8,7 +9,16 @@ export class AuthGuard {
   private readonly authService = inject(AuthService);

   canActivate(): boolean {
-    return this.authService.isLoggedIn();
+    const session = this.authService.getSession();
+
+    if (!session.isValid()) {
+      this.router.navigate(['/login']);
+      return false;
+    }
+
+    if (session.isExpiringSoon()) {
+      this.authService.refreshToken();
+    }
+
+    return true;
   }
 }`,

  89: `diff --git a/package.json b/package.json
index 1234567..2345678 100644
--- a/package.json
+++ b/package.json
@@ -12,9 +12,9 @@
   "private": true,
   "dependencies": {
-    "@angular/core": "19.2.0",
-    "@angular/common": "19.2.0",
-    "@angular/compiler": "19.2.0",
+    "@angular/core": "20.0.1",
+    "@angular/common": "20.0.1",
+    "@angular/compiler": "20.0.1",
     "@angular/forms": "19.2.0",
-    "typescript": "5.4.5",
-    "rxjs": "7.8.1"
+    "typescript": "5.8.3",
+    "rxjs": "7.8.2"
   }
 }
diff --git a/tsconfig.json b/tsconfig.json
index 3456789..4567890 100644
--- a/tsconfig.json
+++ b/tsconfig.json
@@ -3,7 +3,7 @@
     "compilerOptions": {
       "baseUrl": "./",
       "outDir": "./dist/out-tsc",
-      "target": "ES2022",
+      "target": "ES2023",
       "module": "ES2022",
       "moduleResolution": "bundler",
       "strict": true,
diff --git a/angular.json b/angular.json
index 5678901..6789012 100644
--- a/angular.json
+++ b/angular.json
@@ -8,7 +8,7 @@
         "build": {
           "builder": "@angular/build:application",
           "options": {
-            "outputPath": "dist/versicherung-frontend",
+            "outputPath": "dist/app",
             "index": "src/index.html",
             "main": "src/main.ts"
           }`,

  91: `diff --git a/src/app/services/policy-calculation.service.ts b/src/app/services/policy-calculation.service.ts
new file mode 100644
index 0000000..1a2b3c4
--- /dev/null
+++ b/src/app/services/policy-calculation.service.ts
@@ -0,0 +1,35 @@
+import { Injectable } from '@angular/core';
+
+export interface PolicyInput {
+  baseRate: number;
+  riskFactor: number;
+  discounts: number[];
+  coverageType: 'basic' | 'standard' | 'premium';
+}
+
+export interface PolicyResult {
+  monthlyPremium: number;
+  annualPremium: number;
+  effectiveDiscount: number;
+}
+
+@Injectable({ providedIn: 'root' })
+export class PolicyCalculationService {
+  calculate(input: PolicyInput): PolicyResult {
+    const coverageMultiplier = {
+      basic: 1.0,
+      standard: 1.4,
+      premium: 1.85,
+    }[input.coverageType];
+
+    const totalDiscount = input.discounts.reduce((sum, d) => sum + d, 0);
+    const effectiveDiscount = Math.min(totalDiscount, 0.3);
+
+    const rawPremium = input.baseRate * input.riskFactor * coverageMultiplier;
+    const monthlyPremium = Math.round(rawPremium * (1 - effectiveDiscount) * 100) / 100;
+
+    return {
+      monthlyPremium,
+      annualPremium: Math.round(monthlyPremium * 12 * 100) / 100,
+      effectiveDiscount,
+    };
+  }
+}
diff --git a/src/app/components/policy-form/policy-form.component.ts b/src/app/components/policy-form/policy-form.component.ts
index 2b3c4d5..3c4d5e6 100644
--- a/src/app/components/policy-form/policy-form.component.ts
+++ b/src/app/components/policy-form/policy-form.component.ts
@@ -1,6 +1,7 @@
 import { Component, inject, signal } from '@angular/core';
 import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
-import { PolicyInput } from '../models/policy.model';
+import { PolicyCalculationService, PolicyInput } from '../../services/policy-calculation.service';

 @Component({
   selector: 'app-policy-form',
@@ -10,20 +11,9 @@ import { PolicyInput } from '../models/policy.model';
 export class PolicyFormComponent {
   private readonly fb = inject(FormBuilder);
+  private readonly calculator = inject(PolicyCalculationService);
   result = signal<{ monthlyPremium: number; annualPremium: number } | null>(null);

-  private calculatePremium(input: PolicyInput) {
-    const multiplier = input.coverageType === 'premium' ? 1.85 : input.coverageType === 'standard' ? 1.4 : 1.0;
-    const discount = Math.min(input.discounts.reduce((s, d) => s + d, 0), 0.3);
-    const monthly = Math.round(input.baseRate * input.riskFactor * multiplier * (1 - discount) * 100) / 100;
-    return { monthlyPremium: monthly, annualPremium: Math.round(monthly * 12 * 100) / 100 };
-  }
-
   onSubmit(input: PolicyInput) {
-    this.result.set(this.calculatePremium(input));
+    this.result.set(this.calculator.calculate(input));
   }
 }`,

  420: `diff --git a/src/app/components/claims-wizard/claims-wizard.component.ts b/src/app/components/claims-wizard/claims-wizard.component.ts
new file mode 100644
index 0000000..4d5e6f7
--- /dev/null
+++ b/src/app/components/claims-wizard/claims-wizard.component.ts
@@ -0,0 +1,48 @@
+import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
+import { ClaimsStep1Component } from './steps/step1.component';
+import { ClaimsStep2Component } from './steps/step2.component';
+
+@Component({
+  selector: 'app-claims-wizard',
+  changeDetection: ChangeDetectionStrategy.OnPush,
+  imports: [ClaimsStep1Component, ClaimsStep2Component],
+  template: \`
+    <div class="max-w-2xl mx-auto p-6">
+      <h1 class="text-xl font-semibold text-stone-900 mb-6">Schadenmeldung</h1>
+
+      <div class="flex items-center gap-2 mb-8">
+        @for (step of steps(); track step.id; let i = $index) {
+          <div class="flex items-center gap-2">
+            <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
+                 [class]="i <= currentStep() ? 'bg-indigo-100 text-indigo-700' : 'bg-stone-100 text-stone-400'">
+              {{ i + 1 }}
+            </div>
+            <span class="text-sm" [class]="i <= currentStep() ? 'text-stone-700' : 'text-stone-400'">
+              {{ step.label }}
+            </span>
+            @if (i < steps().length - 1) {
+              <div class="w-8 h-px bg-stone-200"></div>
+            }
+          </div>
+        }
+      </div>

+      @switch (currentStep()) {
+        @case (0) { <app-claims-step1 (next)="next()" /> }
+        @case (1) { <app-claims-step2 (next)="next()" (back)="back()" /> }
+      }
+    </div>
+  \`,
+})
+export class ClaimsWizardComponent {
+  currentStep = signal(0);
+  steps = signal([
+    { id: 'type', label: 'Schadensart' },
+    { id: 'details', label: 'Details' },
+    { id: 'upload', label: 'Dokumente' },
+    { id: 'review', label: 'Überprüfung' },
+  ]);
+
+  next() { this.currentStep.update(s => Math.min(s + 1, this.steps().length - 1)); }
+  back() { this.currentStep.update(s => Math.max(s - 1, 0)); }
+}
diff --git a/src/app/components/claims-wizard/steps/step1.component.ts b/src/app/components/claims-wizard/steps/step1.component.ts
new file mode 100644
index 0000000..5e6f7a8
--- /dev/null
+++ b/src/app/components/claims-wizard/steps/step1.component.ts
@@ -0,0 +1,22 @@
+import { Component, ChangeDetectionStrategy, output } from '@angular/core';
+
+@Component({
+  selector: 'app-claims-step1',
+  changeDetection: ChangeDetectionStrategy.OnPush,
+  template: \`
+    <div class="space-y-4">
+      <h2 class="text-lg font-medium text-stone-800">Welche Art von Schaden möchten Sie melden?</h2>
+      <div class="grid grid-cols-2 gap-3">
+        <button class="p-4 border border-stone-200 rounded-lg text-left hover:border-indigo-300 hover:bg-indigo-50">
+          <div class="font-medium text-stone-700">Kfz-Schaden</div>
+          <div class="text-xs text-stone-400 mt-1">Unfall, Diebstahl, Glasbruch</div>
+        </button>
+        <button class="p-4 border border-stone-200 rounded-lg text-left hover:border-indigo-300 hover:bg-indigo-50">
+          <div class="font-medium text-stone-700">Hausrat</div>
+          <div class="text-xs text-stone-400 mt-1">Wasserschaden, Einbruch, Brand</div>
+        </button>
+      </div>
+      <button (click)="next.emit()" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Weiter</button>
+    </div>
+  \`,
+})
+export class ClaimsStep1Component {
+  next = output();
+}
diff --git a/src/app/components/claims-wizard/steps/step2.component.ts b/src/app/components/claims-wizard/steps/step2.component.ts
new file mode 100644
index 0000000..6f7a8b9
--- /dev/null
+++ b/src/app/components/claims-wizard/steps/step2.component.ts
@@ -0,0 +1,18 @@
+import { Component, ChangeDetectionStrategy, output } from '@angular/core';
+
+@Component({
+  selector: 'app-claims-step2',
+  changeDetection: ChangeDetectionStrategy.OnPush,
+  template: \`
+    <div class="space-y-4">
+      <h2 class="text-lg font-medium text-stone-800">Beschreiben Sie den Schaden</h2>
+      <textarea class="w-full border border-stone-200 rounded-lg p-3 text-sm" rows="4"
+                placeholder="Was ist passiert?"></textarea>
+      <div class="flex gap-2">
+        <button (click)="back.emit()" class="px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-600 hover:bg-stone-50">Zurück</button>
+        <button (click)="next.emit()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Weiter</button>
+      </div>
+    </div>
+  \`,
+})
+export class ClaimsStep2Component {
+  next = output();
+  back = output();
+}`,

  408: `diff --git a/src/app/components/sepa-mandate/sepa-mandate.component.ts b/src/app/components/sepa-mandate/sepa-mandate.component.ts
index 7a8b9c0..8b9c0d1 100644
--- a/src/app/components/sepa-mandate/sepa-mandate.component.ts
+++ b/src/app/components/sepa-mandate/sepa-mandate.component.ts
@@ -1,5 +1,6 @@
 import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
 import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
+import { SepaValidationService } from '../../services/sepa-validation.service';

 @Component({
   selector: 'app-sepa-mandate',
@@ -8,6 +9,7 @@ import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
 })
 export class SepaMandateComponent {
   private readonly fb = inject(FormBuilder);
+  private readonly validator = inject(SepaValidationService);
   submitted = signal(false);

   form = this.fb.group({
@@ -18,8 +20,8 @@ export class SepaMandateComponent {

   onSubmit() {
     if (this.form.valid) {
-      const iban = this.form.value.iban!;
-      if (iban.length >= 22 && iban.startsWith('DE')) {
+      const iban = this.form.value.iban!.replace(/\\s/g, '').toUpperCase();
+      if (this.validator.isValidIban(iban)) {
         this.submitted.set(true);
       }
     }
diff --git a/src/app/services/sepa-validation.service.ts b/src/app/services/sepa-validation.service.ts
new file mode 100644
index 0000000..9c0d1e2
--- /dev/null
+++ b/src/app/services/sepa-validation.service.ts
@@ -0,0 +1,25 @@
+import { Injectable } from '@angular/core';
+
+@Injectable({ providedIn: 'root' })
+export class SepaValidationService {
+  isValidIban(iban: string): boolean {
+    const cleaned = iban.replace(/\\s/g, '').toUpperCase();
+    if (cleaned.length < 15 || cleaned.length > 34) return false;
+    if (!/^[A-Z]{2}[0-9]{2}/.test(cleaned)) return false;
+    return this.mod97Check(cleaned);
+  }
+
+  isValidBic(bic: string): boolean {
+    return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic.toUpperCase());
+  }
+
+  private mod97Check(iban: string): boolean {
+    const rearranged = iban.slice(4) + iban.slice(0, 4);
+    const numeric = rearranged
+      .split('')
+      .map(c => (c >= 'A' && c <= 'Z' ? (c.charCodeAt(0) - 55).toString() : c))
+      .join('');
+    let remainder = numeric.slice(0, 9);
+    for (let i = 9; i < numeric.length; i += 7) remainder = (parseInt(remainder, 10) % 97).toString() + numeric.slice(i, i + 7);
+    return parseInt(remainder, 10) % 97 === 1;
+  }
+}`,
};

const GENERIC_DIFF = `diff --git a/src/app/utils/helpers.ts b/src/app/utils/helpers.ts
index 0000001..0000002 100644
--- a/src/app/utils/helpers.ts
+++ b/src/app/utils/helpers.ts
@@ -1,5 +1,7 @@
 export function formatDate(date: Date): string {
-  return date.toISOString();
+  return date.toLocaleDateString('de-DE', {
+    year: 'numeric', month: '2-digit', day: '2-digit',
+  });
 }`;

app.get(
  '/rest/api/latest/projects/:projectKey/repos/:repoSlug/pull-requests/:prId.diff',
  (req, res) => {
    const prId = parseInt(req.params.prId, 10);
    const diff = DIFF_FIXTURES[prId] || GENERIC_DIFF;
    res.set('Content-Type', 'text/plain');
    res.send(diff);
  }
);

const BUILD_STATUS_FIXTURES = {
  f6a1b2c3: { successful: 3, failed: 0, inProgress: 0, cancelled: 0, unknown: 0 },
  a1b2c3d4: { successful: 1, failed: 1, inProgress: 0, cancelled: 0, unknown: 0 },
};

app.get('/rest/build-status/latest/commits/stats/:commitId', (req, res) => {
  const stats = BUILD_STATUS_FIXTURES[req.params.commitId] ?? {
    successful: 0,
    failed: 0,
    inProgress: 0,
    cancelled: 0,
    unknown: 0,
  };
  res.json(stats);
});

app.listen(PORT, () => {
  console.log(`Mock Bitbucket server running at http://localhost:${PORT}`);
});
