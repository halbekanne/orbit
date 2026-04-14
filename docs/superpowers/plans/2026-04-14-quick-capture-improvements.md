# Quick Capture UX/UI Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Quick Capture discoverability and usability by adding keyboard hints, a visible trigger button in the rail, and a Quick Capture hint in the workbench empty state.

**Architecture:** Three focused changes to existing components. No new files, no new services. The rail button emits an event that `app.ts` wires to the existing `overlayOpen` signal.

**Tech Stack:** Angular 21 (signals, zoneless), Tailwind CSS, Lucide icons, Vitest

---

### Task 1: Add keyboard hints to Quick Capture modal

**Files:**
- Modify: `src/app/shared/quick-capture/quick-capture.ts:44-72` (template, after the toggle buttons div)

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/quick-capture/quick-capture.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { QuickCaptureComponent } from './quick-capture';

const mockMatchMedia = () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
};

describe('QuickCaptureComponent', () => {
  beforeEach(async () => {
    mockMatchMedia();
    await TestBed.configureTestingModule({
      imports: [QuickCaptureComponent],
    }).compileComponents();
  });

  it('should show keyboard hints when open', () => {
    const fixture = TestBed.createComponent(QuickCaptureComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const hints = fixture.nativeElement.querySelector('[data-testid="keyboard-hints"]');
    expect(hints).toBeTruthy();
    expect(hints.textContent).toContain('Speichern');
    expect(hints.textContent).toContain('Abbrechen');
    expect(hints.textContent).toContain('Wechseln');
  });

  it('should not render anything when closed', () => {
    const fixture = TestBed.createComponent(QuickCaptureComponent);
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: FAIL — "keyboard-hints" element not found

- [ ] **Step 3: Add keyboard hints to the template**

In `src/app/shared/quick-capture/quick-capture.ts`, add after the closing `</div>` of the toggle button group (after line 72):

```html
          <div
            data-testid="keyboard-hints"
            class="text-xs text-[var(--color-text-muted)] text-center mt-2"
            aria-hidden="true"
          >
            ↵ Speichern · Esc Abbrechen · Tab Wechseln
          </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/quick-capture/quick-capture.ts src/app/shared/quick-capture/quick-capture.spec.ts
git commit -m "feat: add keyboard hints to quick capture modal (#8)"
```

---

### Task 2: Add Quick Capture button to app rail

**Files:**
- Modify: `src/app/shared/app-rail/app-rail.ts:1-101` (import LucidePlus, add button to template, add output)
- Modify: `src/app/shared/app-rail/app-rail.spec.ts` (add tests for new button)

- [ ] **Step 1: Write the failing tests**

Add to the existing `describe` block in `src/app/shared/app-rail/app-rail.spec.ts`:

```typescript
  it('should render a quick capture button', () => {
    const fixture = TestBed.createComponent(AppRailComponent);
    fixture.componentRef.setInput('activeView', 'arbeit');
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('[aria-label="Quick Capture"]');
    expect(button).toBeTruthy();
  });

  it('should show shortcut hint on quick capture button', () => {
    const fixture = TestBed.createComponent(AppRailComponent);
    fixture.componentRef.setInput('activeView', 'arbeit');
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('[aria-label="Quick Capture"]');
    const text = button.textContent;
    expect(text).toMatch(/[⌘Ctrl]\+?K/);
  });

  it('should emit quickCapture on button click', () => {
    const fixture = TestBed.createComponent(AppRailComponent);
    fixture.componentRef.setInput('activeView', 'arbeit');
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.quickCapture.subscribe(spy);
    const button = fixture.nativeElement.querySelector('[aria-label="Quick Capture"]');
    button.click();
    expect(spy).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: FAIL — quickCapture property does not exist, button not found

- [ ] **Step 3: Add the Quick Capture button to app-rail**

In `src/app/shared/app-rail/app-rail.ts`:

Add `LucidePlus` to the import from `@lucide/angular`:
```typescript
import { LucideZap, LucideActivity, LucideBookOpen, LucideSettings, LucidePlus } from '@lucide/angular';
```

Add `LucidePlus` to the component `imports` array.

Add a `quickCapture` output and a `shortcutLabel` property:
```typescript
  quickCapture = output<void>();

  protected readonly shortcutLabel = navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K';
```

In the template, add the button between the logo `div` and the `<nav>` element:

```html
    <button
      type="button"
      class="w-[52px] h-12 flex flex-col items-center justify-center rounded-lg text-[var(--color-primary-text)] hover:bg-[var(--color-bg-surface)] transition-colors duration-100 mt-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
      aria-label="Quick Capture"
      (click)="quickCapture.emit()"
    >
      <svg lucidePlus [size]="20" [strokeWidth]="1.5"></svg>
      <span class="text-[10px] font-medium leading-tight mt-0.5">{{ shortcutLabel }}</span>
    </button>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/app-rail/app-rail.ts src/app/shared/app-rail/app-rail.spec.ts
git commit -m "feat: add quick capture button to app rail (#8)"
```

---

### Task 3: Wire rail button to Quick Capture overlay

**Files:**
- Modify: `src/app/app.html:9` (add quickCapture event binding)
- Modify: `src/app/app.spec.ts` (add test for wiring)

- [ ] **Step 1: Write the failing test**

Add to the existing `describe` block in `src/app/app.spec.ts`:

```typescript
  it('should open quick capture when rail emits quickCapture', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const rail = fixture.nativeElement.querySelector('app-rail');
    rail.dispatchEvent(new Event('quickCapture'));
    fixture.detectChanges();
    expect(fixture.componentInstance.overlayOpen()).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: FAIL — overlayOpen is still false

- [ ] **Step 3: Add event binding in app.html**

In `src/app/app.html`, modify the `<app-rail>` line:

```html
    <app-rail [activeView]="routerSync.activeView()" (viewChange)="onViewChange($event)" (quickCapture)="overlayOpen.set(true)" />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/app.html src/app/app.spec.ts
git commit -m "feat: wire rail quick capture button to overlay (#8)"
```

---

### Task 4: Add Quick Capture hint to workbench empty state

**Files:**
- Modify: `src/app/shared/workbench/workbench.html:24-27` (add hint line)
- Modify: `src/app/shared/workbench/workbench.ts` (add shortcutLabel property)

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/workbench/workbench.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { WorkbenchComponent } from './workbench';
import { WorkspaceService } from '../workspace.service';
import { signal } from '@angular/core';

const mockMatchMedia = () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
};

describe('WorkbenchComponent', () => {
  beforeEach(async () => {
    mockMatchMedia();
    await TestBed.configureTestingModule({
      imports: [WorkbenchComponent],
      providers: [
        {
          provide: WorkspaceService,
          useValue: {
            selectedItem: signal(null),
            reflectionSelected: signal(false),
          },
        },
      ],
    }).compileComponents();
  });

  it('should show quick capture hint in empty state', () => {
    const fixture = TestBed.createComponent(WorkbenchComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Quick Capture');
    expect(text).toMatch(/[⌘Ctrl]\+?K/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: FAIL — "Quick Capture" not found in text

- [ ] **Step 3: Add shortcutLabel to workbench component**

In `src/app/shared/workbench/workbench.ts`, add inside the class:

```typescript
  protected readonly shortcutLabel = navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K';
```

- [ ] **Step 4: Add the hint line to workbench.html**

In `src/app/shared/workbench/workbench.html`, after the existing `<p>` tag (line 27), add:

```html
          <p class="text-sm text-[var(--color-text-muted)] mt-2">
            Oder drücke <kbd class="px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-xs font-mono">{{ shortcutLabel }}</kbd> für Quick Capture
          </p>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx ng test --no-watch 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/workbench/workbench.ts src/app/shared/workbench/workbench.html src/app/shared/workbench/workbench.spec.ts
git commit -m "feat: add quick capture hint to workbench empty state (#8)"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx ng test --no-watch`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `npx ng build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Visual verification**

Start the dev server with `npx ng serve` and verify in browser:
1. Quick Capture button visible in rail, below logo, showing ⌘K/Ctrl+K
2. Clicking the button opens Quick Capture modal
3. Modal shows keyboard hints below toggle buttons
4. Workbench empty state (no item selected) shows Quick Capture hint with kbd styling
5. Both light and dark mode work correctly
