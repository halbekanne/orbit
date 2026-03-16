# PR Diff Viewer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible diff viewer to the PR detail view that fetches the unified diff from Bitbucket and renders it with diff2html and syntax highlighting.

**Architecture:** The BitbucketService gets a new `getPullRequestDiff()` method that fetches the raw unified diff as text. The PrDetailComponent fetches the diff reactively when the PR input changes, then renders it via diff2html's `html()` function inside a collapsible section. The mock Bitbucket server gets a new `.diff` endpoint with realistic fixtures.

**Tech Stack:** Angular 21 (zoneless, standalone, signals), diff2html, highlight.js, Vitest

**Spec:** `docs/superpowers/specs/2026-03-16-pr-diff-viewer-design.md`

---

## Chunk 1: Dependencies & Mock Server

### Task 1: Install diff2html

**Files:**
- Modify: `package.json`
- Modify: `src/styles.css`

- [ ] **Step 1: Install diff2html**

Run: `npm install diff2html`

- [ ] **Step 2: Add diff2html CSS to global styles**

In `src/styles.css`, add the import after the existing highlight.js import:

```css
@import 'diff2html/bundles/css/diff2html.min.css';
```

The file should start with:
```css
@import 'tailwindcss';
@import 'highlight.js/styles/github.css';
@import 'diff2html/bundles/css/diff2html.min.css';
```

- [ ] **Step 3: Verify build**

Run: `npx ng build --configuration development 2>&1 | tail -20`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/styles.css
git commit -m "feat(pr-diff): install diff2html and import CSS"
```

---

### Task 2: Add mock diff endpoint

**Files:**
- Modify: `mock-server/bitbucket.js`

- [ ] **Step 1: Add diff fixtures and endpoint**

Add the following before the `app.listen(...)` call in `mock-server/bitbucket.js`:

```javascript
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
+
+      @switch (currentStep()) {
+        @case (0) { <app-claims-step1 (next)="next()" /> }
+        @case (1) { <app-claims-step2 (next)="next()" (back)="back()" /> }
+      }
+      <!-- TODO: Step 3 noch nicht implementiert -->
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
```

- [ ] **Step 2: Verify mock server starts**

Run: `node mock-server/bitbucket.js &` then `curl -s http://localhost:6203/rest/api/latest/projects/VF/repos/versicherung-frontend/pull-requests/412.diff | head -5`
Expected: First 5 lines of the navigation component diff. Kill the server after.

- [ ] **Step 3: Commit**

```bash
git add mock-server/bitbucket.js
git commit -m "feat(pr-diff): add mock diff endpoint with fixtures for all PRs"
```

---

## Chunk 2: BitbucketService

### Task 3: Add getPullRequestDiff method with tests

**Files:**
- Modify: `src/app/services/bitbucket.service.ts`
- Modify: `src/app/services/bitbucket.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Add a new `describe` block at the end of `src/app/services/bitbucket.service.spec.ts`:

```typescript
describe('BitbucketService — getPullRequestDiff', () => {
  let service: BitbucketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BitbucketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('requests the correct diff URL with text responseType', () => {
    let result: string | undefined;
    service.getPullRequestDiff(makePrRef()).subscribe(d => (result = d));
    const req = httpTesting.expectOne(r => r.url.includes('pull-requests/89.diff'));
    expect(req.request.url).toContain('/projects/SL/repos/versicherung-shared-lib/pull-requests/89.diff');
    expect(req.request.responseType).toBe('text');
    req.flush('diff --git a/file.ts b/file.ts');
    expect(result).toBe('diff --git a/file.ts b/file.ts');
  });

  it('propagates errors', () => {
    let error: unknown;
    service.getPullRequestDiff(makePrRef()).subscribe({ error: e => (error = e) });
    httpTesting
      .expectOne(r => r.url.includes('pull-requests/89.diff'))
      .flush('error', { status: 500, statusText: 'Internal Server Error' });
    expect(error).toBeTruthy();
  });
});
```

Note: `makePrRef()` is already defined in the test file (creates a PR ref with `prNumber: 89`, project `SL`, repo `versicherung-shared-lib`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: FAIL — `service.getPullRequestDiff is not a function`

- [ ] **Step 3: Implement getPullRequestDiff**

Add this method to the `BitbucketService` class in `src/app/services/bitbucket.service.ts`:

```typescript
getPullRequestDiff(pr: Pick<PullRequest, 'prNumber' | 'toRef'>): Observable<string> {
  const { projectKey } = pr.toRef.repository;
  const repoSlug = pr.toRef.repository.slug;
  return this.http.get(
    `${this.baseUrl}/projects/${projectKey}/repos/${repoSlug}/pull-requests/${pr.prNumber}.diff`,
    { responseType: 'text' },
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/services/bitbucket.service.ts src/app/services/bitbucket.service.spec.ts
git commit -m "feat(pr-diff): add getPullRequestDiff method to BitbucketService"
```

---

## Chunk 3: PrDetailComponent Diff Section

### Task 4: Add diff fetching and collapsible UI to PrDetailComponent

**Files:**
- Modify: `src/app/components/pr-detail/pr-detail.ts`

- [ ] **Step 1: Add imports and diff data fetching**

Add the following imports to `pr-detail.ts`. Merge `signal` into the existing `@angular/core` import. The existing file already imports `catchError`, `concat`, `map`, `of`, `switchMap` from rxjs — no new rxjs imports needed.

```typescript
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { BitbucketService } from '../../services/bitbucket.service';
import * as Diff2Html from 'diff2html';
```

Add `signal` to the existing `@angular/core` import if not already present.

Add to the component class (after existing service injections). Note: the spec says `diffHtml: Signal<string>` but we use `SafeHtml` because `DomSanitizer.bypassSecurityTrustHtml()` returns `SafeHtml`, not `string`:

```typescript
private readonly bitbucketService = inject(BitbucketService);
private readonly sanitizer = inject(DomSanitizer);

readonly diffExpanded = signal(false);

readonly diffData = toSignal(
  toObservable(this.pr).pipe(
    switchMap(pr =>
      concat(
        of('loading' as const),
        this.bitbucketService.getPullRequestDiff(pr).pipe(
          catchError(() => of('error' as const)),
        ),
      )
    ),
  ),
  { initialValue: 'loading' as const },
);

readonly diffFileCount = computed(() => {
  const data = this.diffData();
  if (data === 'loading' || data === 'error') return 0;
  return Diff2Html.parse(data).length;
});

readonly diffHtml = computed((): SafeHtml | null => {
  if (!this.diffExpanded()) return null;
  const data = this.diffData();
  if (data === 'loading' || data === 'error') return null;
  const html = Diff2Html.html(data, {
    outputFormat: 'line-by-line',
    drawFileList: false,
    matching: 'lines',
    diffStyle: 'word',
    colorScheme: 'light',
  });
  return this.sanitizer.bypassSecurityTrustHtml(html);
});

toggleDiff() {
  this.diffExpanded.update(v => !v);
}
```

- [ ] **Step 2: Add diff section to the template**

Replace the final spacer `<div class="h-6" aria-hidden="true"></div>` in the template with:

```html
<section class="border-b border-stone-100" aria-labelledby="pr-diff-heading">
  <div class="max-w-2xl mx-auto px-6 py-4">
    <h2 id="pr-diff-heading" class="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Änderungen</h2>
    @if (diffData() === 'loading') {
      <p class="text-sm text-stone-400 animate-pulse">Änderungen laden...</p>
    } @else if (diffData() === 'error') {
      <p class="text-sm text-stone-400 italic">Änderungen konnten nicht geladen werden.</p>
    } @else if (diffFileCount() === 0) {
      <p class="text-sm text-stone-400 italic">Keine Änderungen vorhanden.</p>
    } @else {
      <button
        (click)="toggleDiff()"
        class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-stone-600 bg-stone-50 border border-stone-200 rounded hover:bg-stone-100 transition-colors"
        [attr.aria-expanded]="diffExpanded()"
        aria-controls="pr-diff-content"
      >
        @if (diffExpanded()) {
          Änderungen ausblenden
        } @else {
          Änderungen anzeigen ({{ diffFileCount() }} {{ diffFileCount() === 1 ? 'Datei' : 'Dateien' }})
        }
      </button>
      @if (diffExpanded()) {
        <div id="pr-diff-content" class="mt-3 overflow-x-auto rounded border border-stone-200" [innerHTML]="diffHtml()"></div>
      }
    }
  </div>
</section>

<div class="h-6" aria-hidden="true"></div>
```

- [ ] **Step 3: Verify build compiles**

Run: `npx ng build --configuration development 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/pr-detail/pr-detail.ts
git commit -m "feat(pr-diff): add collapsible diff viewer to PR detail"
```

---

### Task 5: Add syntax highlighting

**Files:**
- Modify: `src/app/components/pr-detail/pr-detail.ts`

- [ ] **Step 1: Add highlight.js imports and afterNextRender**

Add `viewChild` and `ElementRef` to the existing `@angular/core` import in `pr-detail.ts`. Then add the highlight.js imports:

```typescript
// Add viewChild, ElementRef to existing @angular/core import
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import python from 'highlight.js/lib/languages/python';
import groovy from 'highlight.js/lib/languages/groovy';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import markdown from 'highlight.js/lib/languages/markdown';
import bash from 'highlight.js/lib/languages/bash';
import plaintext from 'highlight.js/lib/languages/plaintext';
```

Register languages at the top of the component class (before any signal/inject):

```typescript
private static hljsRegistered = false;

constructor() {
  if (!PrDetailComponent.hljsRegistered) {
    hljs.registerLanguage('typescript', typescript);
    hljs.registerLanguage('javascript', javascript);
    hljs.registerLanguage('xml', xml);
    hljs.registerLanguage('html', xml);
    hljs.registerLanguage('css', css);
    hljs.registerLanguage('scss', scss);
    hljs.registerLanguage('json', json);
    hljs.registerLanguage('yaml', yaml);
    hljs.registerLanguage('ini', ini);
    hljs.registerLanguage('toml', ini);
    hljs.registerLanguage('java', java);
    hljs.registerLanguage('python', python);
    hljs.registerLanguage('groovy', groovy);
    hljs.registerLanguage('dockerfile', dockerfile);
    hljs.registerLanguage('markdown', markdown);
    hljs.registerLanguage('bash', bash);
    hljs.registerLanguage('plaintext', plaintext);
    PrDetailComponent.hljsRegistered = true;
  }
}

// Note: TOML uses `ini` grammar (close enough). MDX falls back to markdown detection.
// highlight.js has no dedicated MDX module.
```

Add a `ViewChild` ref for the diff container. Change the diff container `<div>` in the template to:

```html
<div #diffContainer id="pr-diff-content" class="mt-3 overflow-x-auto rounded border border-stone-200" [innerHTML]="diffHtml()"></div>
```

Add a `viewChild` ref and an `effect` to the component class to highlight after rendering. Use `setTimeout` to run after Angular has flushed the innerHTML update to the DOM:

```typescript
private readonly diffContainer = viewChild<ElementRef<HTMLElement>>('diffContainer');

private highlightEffect = effect(() => {
  const container = this.diffContainer();
  if (!container) return;
  const html = this.diffHtml();
  if (!html) return;
  setTimeout(() => {
    container.nativeElement.querySelectorAll('code:not(.hljs)').forEach((block) => {
      hljs.highlightElement(block as HTMLElement);
    });
  });
});
```

- [ ] **Step 2: Verify build compiles**

Run: `npx ng build --configuration development 2>&1 | tail -20`
Expected: Build succeeds. If highlight.js type issues arise, the import paths may need adjusting — check `node_modules/highlight.js/lib/languages/` for exact filenames.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/pr-detail/pr-detail.ts
git commit -m "feat(pr-diff): add syntax highlighting via highlight.js"
```

---

## Chunk 4: Component Tests

### Task 6: Add PrDetailComponent diff tests

**Files:**
- Modify: `src/app/components/pr-detail/pr-detail.spec.ts`

- [ ] **Step 1: Update test setup and add diff tests**

Update the imports at the top of `pr-detail.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { PrDetailComponent } from './pr-detail';
import { JiraService } from '../../services/jira.service';
import { BitbucketService } from '../../services/bitbucket.service';
import { PullRequest, JiraTicket } from '../../models/work-item.model';
```

Update the `beforeEach` to also mock `BitbucketService`:

```typescript
const getTicketByKey = vi.fn();
const getPullRequestDiff = vi.fn();

beforeEach(() => {
  getTicketByKey.mockReset();
  getPullRequestDiff.mockReset();
  TestBed.configureTestingModule({
    imports: [PrDetailComponent],
    providers: [
      { provide: JiraService, useValue: { getTicketByKey } },
      { provide: BitbucketService, useValue: { getPullRequestDiff } },
    ],
  });
});
```

Update all existing tests to also set up the diff mock. Add `getPullRequestDiff.mockReturnValue(of(''));` at the start of each existing test (before `fixture = TestBed.createComponent(...)`).

Add new tests:

```typescript
const SAMPLE_DIFF = `diff --git a/file.ts b/file.ts
index 0000001..0000002 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 const a = 1;
-const b = 2;
+const b = 3;
 const c = 4;`;

// No `await fixture.whenStable()` here — we want to catch the initial
// 'loading' state before the toObservable → switchMap pipeline resolves.
it('shows loading state for diff initially', async () => {
  getTicketByKey.mockReturnValue(of(mockTicket));
  getPullRequestDiff.mockReturnValue(of(SAMPLE_DIFF));
  fixture = TestBed.createComponent(PrDetailComponent);
  fixture.componentRef.setInput('pr', basePr);
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).toContain('Änderungen laden');
});

it('shows toggle button with file count after diff loads', async () => {
  getTicketByKey.mockReturnValue(of(mockTicket));
  getPullRequestDiff.mockReturnValue(of(SAMPLE_DIFF));
  fixture = TestBed.createComponent(PrDetailComponent);
  fixture.componentRef.setInput('pr', basePr);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).toContain('Änderungen anzeigen (1 Datei)');
});

it('shows error state when diff fetch fails', async () => {
  getTicketByKey.mockReturnValue(of(mockTicket));
  getPullRequestDiff.mockReturnValue(throwError(() => new Error('fail')));
  fixture = TestBed.createComponent(PrDetailComponent);
  fixture.componentRef.setInput('pr', basePr);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).toContain('Änderungen konnten nicht geladen werden');
});

it('expands and collapses diff on toggle click', async () => {
  getTicketByKey.mockReturnValue(of(mockTicket));
  getPullRequestDiff.mockReturnValue(of(SAMPLE_DIFF));
  fixture = TestBed.createComponent(PrDetailComponent);
  fixture.componentRef.setInput('pr', basePr);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  const toggleBtn = fixture.nativeElement.querySelector('button[aria-controls="pr-diff-content"]') as HTMLButtonElement;
  expect(toggleBtn).toBeTruthy();
  expect(fixture.nativeElement.querySelector('#pr-diff-content')).toBeNull();

  toggleBtn.click();
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('#pr-diff-content')).toBeTruthy();
  expect(fixture.nativeElement.textContent).toContain('Änderungen ausblenden');

  toggleBtn.click();
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('#pr-diff-content')).toBeNull();
});

it('shows empty diff message when diff has no files', async () => {
  getTicketByKey.mockReturnValue(of(mockTicket));
  getPullRequestDiff.mockReturnValue(of(''));
  fixture = TestBed.createComponent(PrDetailComponent);
  fixture.componentRef.setInput('pr', basePr);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).toContain('Keine Änderungen vorhanden');
});
```

- [ ] **Step 2: Run tests**

Run: `npx ng test --no-watch 2>&1 | tail -30`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/pr-detail/pr-detail.spec.ts
git commit -m "test(pr-diff): add tests for diff loading, toggle, error, and empty states"
```

---

## Chunk 5: Verification

### Task 7: End-to-end verification

- [ ] **Step 1: Run full test suite**

Run: `npx ng test --no-watch`
Expected: All tests pass with no failures.

- [ ] **Step 2: Check bundle size**

Run: `npx ng build 2>&1 | tail -20`
Expected: Build succeeds, initial bundle stays within 500kB budget (warning) / 1MB (error).

- [ ] **Step 3: Final commit (if any fixes needed)**

If any adjustments were needed, commit them with an appropriate message.
