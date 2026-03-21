# Hybrid Rail Navigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-level view navigation rail (64px, icon + label) to the left edge of Orbit, extracting the current layout into a "Arbeit" view and providing a placeholder "Timeline" view.

**Architecture:** A new `HybridRailComponent` renders the vertical nav rail. The existing Navigator + Workbench + ActionRail layout moves into `ViewArbeitComponent`. `AppComponent` manages the active view via a signal and `@switch`. No router — instant signal-driven switching with localStorage persistence.

**Tech Stack:** Angular 21 (standalone, zoneless, signals), Tailwind CSS, Vitest, Lucide inline SVGs

**Spec:** `docs/superpowers/specs/2026-03-21-hybrid-rail-navigation-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/app/components/hybrid-rail/hybrid-rail.ts` | Nav rail component with view items, active state, keyboard nav |
| Create | `src/app/components/hybrid-rail/hybrid-rail.spec.ts` | Tests for rail rendering, selection, keyboard, a11y |
| Create | `src/app/views/view-arbeit/view-arbeit.ts` | Wraps existing Navigator + Workbench + ActionRail layout |
| Create | `src/app/views/view-arbeit/view-arbeit.html` | Template extracted from current `app.html` |
| Create | `src/app/views/view-timeline/view-timeline.ts` | Placeholder timeline view |
| Modify | `src/app/app.ts` | Add rail + view switching via `@switch`, persist activeView |
| Modify | `src/app/app.html` | Replace layout with rail + view container |
| Modify | `src/app/app.spec.ts` | Update tests for new structure |

---

### Task 1: Create HybridRailComponent with tests

**Files:**
- Create: `src/app/components/hybrid-rail/hybrid-rail.ts`
- Create: `src/app/components/hybrid-rail/hybrid-rail.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/app/components/hybrid-rail/hybrid-rail.spec.ts
import { TestBed } from '@angular/core/testing';
import { HybridRailComponent } from './hybrid-rail';

describe('HybridRailComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HybridRailComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(HybridRailComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render all view items', () => {
    const fixture = TestBed.createComponent(HybridRailComponent);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain('Arbeit');
    expect(buttons[1].textContent).toContain('Timeline');
  });

  it('should mark the active view with aria-current', () => {
    const fixture = TestBed.createComponent(HybridRailComponent);
    fixture.componentRef.setInput('activeView', 'arbeit');
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[0].getAttribute('aria-current')).toBe('page');
    expect(buttons[1].getAttribute('aria-current')).toBeNull();
  });

  it('should emit viewChange on click', () => {
    const fixture = TestBed.createComponent(HybridRailComponent);
    fixture.componentRef.setInput('activeView', 'arbeit');
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.viewChange.subscribe(spy);
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[1].click();
    expect(spy).toHaveBeenCalledWith('timeline');
  });

  it('should navigate with arrow keys', () => {
    const fixture = TestBed.createComponent(HybridRailComponent);
    fixture.componentRef.setInput('activeView', 'arbeit');
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].focus();
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(buttons[1]);
  });

  it('should have nav with correct aria-label', () => {
    const fixture = TestBed.createComponent(HybridRailComponent);
    fixture.detectChanges();
    const nav = fixture.nativeElement.querySelector('nav');
    expect(nav.getAttribute('aria-label')).toBe('Hauptnavigation');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --no-watch`
Expected: FAIL — `HybridRailComponent` does not exist yet.

- [ ] **Step 3: Implement HybridRailComponent**

```typescript
// src/app/components/hybrid-rail/hybrid-rail.ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

interface OrbitView {
  id: string;
  label: string;
}

const VIEWS: OrbitView[] = [
  { id: 'arbeit', label: 'Arbeit' },
  { id: 'timeline', label: 'Timeline' },
];

@Component({
  selector: 'app-hybrid-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'w-16 shrink-0 bg-stone-900 flex flex-col items-center',
  },
  template: `
    <div class="w-full h-12 flex items-center justify-center border-b border-white/[0.06]" aria-hidden="true">
      <div class="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.25)]">
        <div class="w-3 h-3 rounded-full border-2 border-white"></div>
      </div>
    </div>

    <nav aria-label="Hauptnavigation" class="flex flex-col items-center gap-1 mt-2">
      @for (view of views; track view.id) {
        <button
          type="button"
          class="flex flex-col items-center justify-center w-[52px] h-12 rounded-lg text-center transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 cursor-pointer"
          [class.bg-indigo-600]="activeView() === view.id"
          [class.text-white]="activeView() === view.id"
          [class.text-stone-400]="activeView() !== view.id"
          [class.hover:text-stone-200]="activeView() !== view.id"
          [class.hover:bg-stone-800]="activeView() !== view.id"
          [attr.aria-current]="activeView() === view.id ? 'page' : null"
          (click)="viewChange.emit(view.id)"
          (keydown)="onKeydown($event)"
        >
          @switch (view.id) {
            @case ('arbeit') {
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
            }
            @case ('timeline') {
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
            }
          }
          <span class="text-[10px] font-medium leading-tight mt-0.5">{{ view.label }}</span>
        </button>
      }
    </nav>
  `,
})
export class HybridRailComponent {
  activeView = input.required<string>();
  viewChange = output<string>();

  protected readonly views = VIEWS;

  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const buttons = Array.from(
      target.closest('nav')!.querySelectorAll('button')
    ) as HTMLElement[];
    const index = buttons.indexOf(target);

    let next = -1;
    if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
    if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;

    if (next >= 0) {
      event.preventDefault();
      buttons[next].focus();
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: All 6 HybridRailComponent tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/hybrid-rail/
git commit -m "feat(hybrid-rail): add HybridRailComponent with keyboard navigation and a11y"
```

---

### Task 2: Create ViewArbeitComponent and update navigator header

**Files:**
- Create: `src/app/views/view-arbeit/view-arbeit.ts`
- Create: `src/app/views/view-arbeit/view-arbeit.html`
- Modify: `src/app/components/navigator/navigator.html` (replace logo+brand with view title)

- [ ] **Step 1: Create the ViewArbeitComponent**

Extract the current `app.html` layout into this component. The template is the exact content of the current `app.html` minus the `<app-quick-capture>` line and the outer wrapping `<div>`.

**Note:** The Orbit logo moves to the HybridRail. The navigator header (`navigator.html`) should be updated separately to replace the logo+brand with the view name "Arbeit". This is a minor template change in the navigator component — replace the logo div + "Orbit" span with just `<span class="font-semibold text-stone-800 text-sm tracking-wide">Arbeit</span>` and keep the subtitle.

```typescript
// src/app/views/view-arbeit/view-arbeit.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NavigatorComponent } from '../../components/navigator/navigator';
import { WorkbenchComponent } from '../../components/workbench/workbench';
import { ActionRailComponent } from '../../components/action-rail/action-rail';

@Component({
  selector: 'app-view-arbeit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavigatorComponent, WorkbenchComponent, ActionRailComponent],
  templateUrl: './view-arbeit.html',
  host: { class: 'flex h-full overflow-hidden' },
})
export class ViewArbeitComponent {}
```

```html
<!-- src/app/views/view-arbeit/view-arbeit.html -->
<aside
  class="w-[360px] xl:w-[400px] shrink-0 border-r border-stone-200 bg-stone-100 overflow-hidden flex flex-col"
  aria-label="Navigator"
>
  <app-navigator />
</aside>

<div class="flex-1 overflow-hidden flex">
  <div class="flex-1 overflow-hidden bg-stone-50">
    <app-workbench />
  </div>
  <app-action-rail />
</div>
```

- [ ] **Step 2: Verify it compiles**

Run: `npx ng build 2>&1 | head -5`
Expected: Build succeeds (component is created but not yet used).

- [ ] **Step 3: Commit**

```bash
git add src/app/views/view-arbeit/
git commit -m "feat(views): add ViewArbeitComponent wrapping existing layout"
```

---

### Task 3: Create ViewTimelineComponent placeholder

**Files:**
- Create: `src/app/views/view-timeline/view-timeline.ts`

- [ ] **Step 1: Create the placeholder component**

```typescript
// src/app/views/view-timeline/view-timeline.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-view-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center justify-center h-full' },
  template: `
    <div class="text-center max-w-sm">
      <div class="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-400"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
      </div>
      <h2 class="text-lg font-semibold text-stone-800 mb-1">Timeline</h2>
      <p class="text-sm text-stone-400 leading-relaxed">Dein Tagesrückblick wird hier angezeigt — kommt bald.</p>
    </div>
  `,
})
export class ViewTimelineComponent {}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/views/view-timeline/
git commit -m "feat(views): add ViewTimelineComponent placeholder"
```

---

### Task 4: Wire up AppComponent with rail and view switching

**Files:**
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`

- [ ] **Step 1: Update AppComponent class**

Replace `src/app/app.ts` with:

```typescript
// src/app/app.ts
import { ChangeDetectionStrategy, Component, effect, signal } from '@angular/core';
import { HybridRailComponent } from './components/hybrid-rail/hybrid-rail';
import { ViewArbeitComponent } from './views/view-arbeit/view-arbeit';
import { ViewTimelineComponent } from './views/view-timeline/view-timeline';
import { QuickCaptureComponent } from './components/quick-capture/quick-capture';

const STORAGE_KEY = 'orbit.activeView';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HybridRailComponent, ViewArbeitComponent, ViewTimelineComponent, QuickCaptureComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class App {
  activeView = signal(localStorage.getItem(STORAGE_KEY) ?? 'arbeit');
  overlayOpen = signal(false);
  private previousFocus: HTMLElement | null = null;

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY, this.activeView());
    });
  }

  onKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      this.previousFocus = document.activeElement as HTMLElement;
      this.overlayOpen.set(true);
    }
  }

  onOverlayClose(): void {
    this.overlayOpen.set(false);
    this.previousFocus?.focus();
  }
}
```

- [ ] **Step 2: Update app.html template**

Replace `src/app/app.html` with:

```html
<div class="flex h-screen overflow-hidden">
  <app-hybrid-rail
    [activeView]="activeView()"
    (viewChange)="activeView.set($event)"
  />

  @switch (activeView()) {
    @case ('arbeit') {
      <app-view-arbeit class="flex-1 overflow-hidden" />
    }
    @case ('timeline') {
      <app-view-timeline class="flex-1 overflow-hidden bg-stone-50" />
    }
  }
</div>
<app-quick-capture [open]="overlayOpen()" (close)="onOverlayClose()" />
```

- [ ] **Step 3: Run the full test suite**

Run: `npx ng test --no-watch`
Expected: All tests pass. The app.spec.ts test should still pass because `App` imports haven't changed structurally.

- [ ] **Step 4: Verify visually in the browser**

Run: `npm start`
Expected: Dark rail on the left with "Arbeit" (active, indigo) and "Timeline" icons. Clicking Timeline shows placeholder. Clicking Arbeit shows existing layout. Cmd+K still works.

- [ ] **Step 5: Commit**

```bash
git add src/app/app.ts src/app/app.html
git commit -m "feat(app): wire up hybrid rail with view switching and localStorage persistence"
```

---

### Task 5: Update app.spec.ts for new structure

**Files:**
- Modify: `src/app/app.spec.ts`

- [ ] **Step 1: Update the test file**

```typescript
// src/app/app.spec.ts
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should default to arbeit view', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance.activeView()).toBe('arbeit');
  });

  it('should render the hybrid rail', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const rail = fixture.nativeElement.querySelector('app-hybrid-rail');
    expect(rail).toBeTruthy();
  });

  it('should persist active view to localStorage', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.activeView.set('timeline');
    TestBed.tick();
    expect(localStorage.getItem('orbit.activeView')).toBe('timeline');
  });

  it('should restore active view from localStorage', () => {
    localStorage.setItem('orbit.activeView', 'timeline');
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance.activeView()).toBe('timeline');
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx ng test --no-watch`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/app.spec.ts
git commit -m "test(app): update tests for hybrid rail and view switching"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx ng test --no-watch`
Expected: All tests pass, zero failures.

- [ ] **Step 2: Run the app and verify**

Run: `npm start`

Verify checklist:
- Dark rail (bg-stone-900) visible on the far left, 64px wide
- "Arbeit" item shows Zap icon + label, highlighted in indigo
- "Timeline" item shows Calendar icon + label, in stone-400
- Clicking "Timeline" switches to placeholder view
- Clicking "Arbeit" switches back to full work layout
- Navigator, Workbench, ActionRail all render correctly
- Cmd+K overlay still works across all views
- Arrow Up/Down navigates between rail items
- Active rail item has `aria-current="page"`
- Refreshing the page preserves the last active view

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(hybrid-rail): address verification issues"
```
