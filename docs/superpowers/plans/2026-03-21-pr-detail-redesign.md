# PR Detail Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the PR detail page with card-based content sections, unified typography, consistent code block styling, improved KI-Review states (idle/running/done/error), and ADHD-friendly visual design.

**Architecture:** The page switches from a flat section layout to: sticky header (with branch info + metadata integrated) + separate collapsible content cards (Jira, Beschreibung, KI-Review, Änderungen). The KI-Review card gets 5 distinct states: idle (CTA), running (stepper pipeline), done (findings), partial result (warnings), and complete error (retry). The review-pipeline component is restructured to live inside the review-findings card instead of being a separate section.

**Tech Stack:** Angular 20 (standalone, zoneless, signals), Tailwind CSS v4, Diff2Html, highlight.js

**Reference mockup:** `mockups/pr-detail-redesign.html` — open in browser for visual reference of all states.

---

## Chunk 1: Header Redesign + Card Layout Shell

This chunk restructures pr-detail.ts from flat sections to: enriched sticky header (with branch info, comments/tasks) + card-based content sections with collapsible behavior.

### Task 1: Restructure pr-detail.ts header

**Files:**
- Modify: `src/app/components/pr-detail/pr-detail.ts`

- [ ] **Step 1: Rewrite the header template**

Replace the entire template (lines 47-188) in pr-detail.ts. The new template structure:

```html
<article [attr.aria-label]="'PR: ' + pr().title">

  @if (pr().isDraft) {
    <div class="bg-amber-50 border-b border-amber-200" role="status">
      <div class="max-w-2xl mx-auto px-6 py-2.5 flex items-center gap-2">
        <svg class="w-4 h-4 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span class="text-sm font-medium text-amber-700">Entwurf — dieser PR ist noch nicht bereit zum Review oder Mergen.</span>
      </div>
    </div>
  }

  <header class="sticky top-0 z-10 bg-white border-b border-stone-200 shadow-sm">
    <div class="max-w-2xl mx-auto relative">
      <div class="absolute left-0 top-0 bottom-0 w-[3px]" [class]="stripeClass()" aria-hidden="true"></div>

      <div class="px-6 pt-5 pb-4 pl-7">
        <!-- Row 1: Repo + Status -->
        <div class="flex items-center gap-2 mb-2 flex-wrap">
          <span class="font-mono text-xs font-semibold text-stone-400 tracking-wide">{{ pr().fromRef.repository.slug }}</span>
          <span class="text-stone-300" aria-hidden="true">&middot;</span>
          <span
            class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border"
            [class]="statusBadgeClass()"
          >
            <span class="w-1.5 h-1.5 rounded-full" [class]="statusDotClass()" aria-hidden="true"></span>
            {{ pr().myReviewStatus }}
          </span>
          @if (pr().isDraft) {
            <span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">Entwurf</span>
          }
        </div>

        <!-- Row 2: Title -->
        <h1 class="text-lg font-semibold text-stone-900 leading-snug mb-2">{{ pr().title }}</h1>

        <!-- Row 3: Author + Dates -->
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-stone-200 text-stone-600 text-[9px] font-bold shrink-0" aria-hidden="true">{{ authorInitials() }}</span>
          <p class="text-sm text-stone-400">
            von <span class="text-stone-500 font-medium">{{ pr().author.user.displayName }}</span>
            <span class="text-stone-300 mx-1" aria-hidden="true">&middot;</span>erstellt {{ pr().createdDate | date:'dd.MM.yyyy' }}
            <span class="text-stone-300 mx-1" aria-hidden="true">&middot;</span>geändert {{ pr().updatedDate | date:'dd.MM.yyyy' }}
          </p>
        </div>

        <!-- Row 4: Branch Info (moved from separate section) -->
        <div class="flex items-center gap-2 mt-3 flex-wrap">
          <span class="text-sm text-stone-400 font-medium shrink-0">von</span>
          <code class="font-mono text-[13px] text-stone-600 bg-stone-50 border border-stone-200 rounded px-1.5 py-0.5 break-all">{{ pr().fromRef.displayId }}</code>
          <svg class="w-3.5 h-3.5 text-stone-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14m-4-4 4 4-4 4"/></svg>
          @if (isNonDefaultTarget()) {
            <code class="font-mono text-[13px] text-amber-700 font-semibold bg-stone-50 border border-stone-200 rounded px-1.5 py-0.5">{{ pr().toRef.displayId }}</code>
          } @else {
            <code class="font-mono text-[13px] text-stone-600 bg-stone-50 border border-stone-200 rounded px-1.5 py-0.5">{{ pr().toRef.displayId }}</code>
          }
        </div>

        <!-- Row 5: Comments + Tasks (moved from separate section) -->
        @if (pr().commentCount > 0 || pr().openTaskCount > 0) {
          <div class="flex items-center gap-4 mt-2.5">
            @if (pr().commentCount > 0) {
              <div class="flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span class="text-sm text-stone-500">{{ pr().commentCount }} Kommentar{{ pr().commentCount === 1 ? '' : 'e' }}</span>
              </div>
            }
            @if (pr().openTaskCount > 0) {
              <div class="flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                <span class="text-sm text-amber-700 font-medium">{{ pr().openTaskCount }} offene{{ pr().openTaskCount === 1 ? 'r Task' : ' Tasks' }}</span>
              </div>
            }
          </div>
        }
      </div>
    </div>
  </header>

  <!-- Content Cards -->
  <div class="max-w-2xl mx-auto space-y-3 py-4 px-2">
    <!-- Jira-Ticket Card (default: collapsed) -->
    <div class="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <button
        type="button"
        class="w-full text-left px-6 py-3.5 flex items-center gap-3 hover:bg-stone-50/50 transition-colors"
        (click)="jiraExpanded.set(!jiraExpanded())"
        [attr.aria-expanded]="jiraExpanded()"
      >
        <svg class="w-3.5 h-3.5 text-stone-400 shrink-0 transition-transform duration-150" [class.rotate-90]="jiraExpanded()" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg>
        <svg class="w-4 h-4 text-stone-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10M7 12h10M7 17h6"/></svg>
        <span class="text-xs font-semibold text-stone-400 uppercase tracking-wider">Jira-Ticket</span>
        @if (resolvedJiraTicket(); as ticket) {
          <span class="font-mono text-xs text-indigo-600 font-semibold">{{ ticket.key }}</span>
          <span class="text-xs text-stone-400">— {{ ticket.status }}</span>
        }
      </button>
      @if (jiraExpanded()) {
        <div class="border-t border-stone-100 px-6 py-4">
          <app-jira-pr-card [ticket]="jiraTicket()" />
        </div>
      }
    </div>

    <!-- Beschreibung Card (default: open) -->
    <div class="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <button
        type="button"
        class="w-full text-left px-6 py-3.5 flex items-center gap-3 hover:bg-stone-50/50 transition-colors"
        (click)="descExpanded.set(!descExpanded())"
        [attr.aria-expanded]="descExpanded()"
      >
        <svg class="w-3.5 h-3.5 text-stone-400 shrink-0 transition-transform duration-150" [class.rotate-90]="descExpanded()" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg>
        <svg class="w-4 h-4 text-stone-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
        <span class="text-xs font-semibold text-stone-400 uppercase tracking-wider">Beschreibung</span>
      </button>
      @if (descExpanded()) {
        <div class="border-t border-stone-100 px-6 pb-5 pt-4">
          @if (pr().description) {
            <div class="jira-markup" [innerHTML]="pr().description | jiraMarkup"></div>
          } @else {
            <p class="text-sm text-stone-400 italic">Keine Beschreibung vorhanden.</p>
          }
        </div>
      }
    </div>

    <!-- KI-Review Card (default: open) -->
    <app-review-findings [reviewState]="cosiReview.reviewState()" />

    <!-- Änderungen Card (default: collapsed) -->
    <div class="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <button
        type="button"
        class="w-full text-left px-6 py-3.5 flex items-center gap-3 hover:bg-stone-50/50 transition-colors"
        (click)="diffExpanded.set(!diffExpanded())"
        [attr.aria-expanded]="diffExpanded()"
      >
        <svg class="w-3.5 h-3.5 text-stone-400 shrink-0 transition-transform duration-150" [class.rotate-90]="diffExpanded()" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg>
        <svg class="w-4 h-4 text-stone-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>
        <span class="text-xs font-semibold text-stone-400 uppercase tracking-wider">Änderungen</span>
        @if (diffFileCount() > 0) {
          <span class="text-xs text-stone-400">{{ diffFileCount() }} {{ diffFileCount() === 1 ? 'Datei' : 'Dateien' }}</span>
        }
      </button>
      @if (diffExpanded()) {
        <div class="border-t border-stone-100 px-6 py-4">
          @if (diffData() === 'loading') {
            <p class="text-sm text-stone-400 italic">Änderungen laden...</p>
          } @else if (diffData() === 'error') {
            <p class="text-sm text-stone-400 italic">Änderungen konnten nicht geladen werden.</p>
          } @else if (diffFileCount() === 0) {
            <p class="text-sm text-stone-400 italic">Keine Änderungen vorhanden.</p>
          } @else {
            <div #diffContainer class="overflow-x-auto rounded border border-stone-200"></div>
          }
        </div>
      }
    </div>

    <div class="h-4" aria-hidden="true"></div>
  </div>
</article>
```

- [ ] **Step 2: Add new signals and computed for the card layout**

Add these new signals and computeds to `PrDetailComponent`:

```typescript
readonly jiraExpanded = signal(false);
readonly descExpanded = signal(true);

readonly resolvedJiraTicket = computed(() => {
  const t = this.jiraTicket();
  return (t !== 'loading' && t !== 'error' && t !== 'no-ticket') ? t : null;
});
```

Note: `diffExpanded` already exists as `signal(false)` — keep it. The `toggleDiff()` method is removed since the card toggles `diffExpanded` directly. The existing `renderEffect` continues to work because it reads `this.diffExpanded()` and `this.diffContainer()` — both remain unchanged.

Add a `statusDotClass` computed (used by the new status badge with dot):

```typescript
statusDotClass = computed((): string => {
  if (this.pr().isDraft) return 'bg-amber-300';
  const map: Record<PrStatus, string> = {
    'Awaiting Review': 'bg-indigo-400',
    'Needs Re-review': 'bg-amber-500',
    'Changes Requested': 'bg-stone-300',
    'Approved': 'bg-emerald-500',
    'Approved by Others': 'bg-stone-300',
  };
  return map[this.pr().myReviewStatus] ?? 'bg-stone-300';
});
```

Remove `toggleDiff()` method — the card uses `diffExpanded.set(!diffExpanded())` directly in template.

Update the `renderEffect` — the `#diffContainer` no longer has `id` or `aria-controls` — check that `viewChild` still resolves. The diff should render immediately when `diffExpanded()` becomes true (no toggle button delay).

- [ ] **Step 3: Run tests**

Run: `cd /Users/dominik/dev/other/orbit && npx ng test --no-watch`
Expected: Some existing tests may need updating since the template changed. Fix any failures caused by changed selectors or text content.

- [ ] **Step 4: Update pr-detail tests**

In `src/app/components/pr-detail/pr-detail.spec.ts`, these specific tests will break:
- **`'Änderungen anzeigen (1 Datei)'` text assertion** — the new card header shows file count inline, not as button text. Update to check for `'1 Datei'` in the card header.
- **`querySelector('button[aria-controls="pr-diff-content"]')` selector** — removed. Use `querySelector('button[aria-expanded]')` within the Änderungen card instead, or find the button by its text content.
- **`querySelector('#pr-diff-content')` selector** — removed. Check for `diffContainer` via `querySelector('.overflow-x-auto')` inside the card.
- **`'Änderungen ausblenden'` text assertion** — removed. The card toggle doesn't change text.
- **Jira card visibility** — the Jira card is now inside a collapsed card (`jiraExpanded` defaults to false). Tests that assert Jira content is visible need to first expand the card: `fixture.componentRef.setInput(...)` won't help — need to click the Jira card header button or set `component.jiraExpanded.set(true)` then `detectChanges()`.
- **`'#pr-jira-heading'` / `'#pr-desc-heading'` selectors** — these heading IDs are removed. Update selectors to find section headers by text content.

- [ ] **Step 5: Commit**

```
feat(pr-detail): restructure to card-based layout with enriched header
```

---

## Chunk 2: Review Findings Card Redesign

This chunk rewrites the review-findings component to be a self-contained card with 5 states: idle (CTA), running (stepper pipeline), done (findings), partial result (warnings), and error (retry). It absorbs the pipeline visualization and changes to card-based layout.

### Task 2: Add animations to global styles

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add KI-Review animations to styles.css**

Append after the existing jira-markup styles at the end of `src/styles.css`:

```css
/* ── KI-Review animations ────────────────────────────────────────── */
@keyframes pulse-ring {
  0% { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(2.2); opacity: 0; }
}

@keyframes orbit-breathe {
  0%, 100% { transform: scale(1); opacity: 0.15; }
  50% { transform: scale(1.08); opacity: 0.25; }
}

@keyframes thinking-dots {
  0%, 20% { opacity: 0.3; }
  50% { opacity: 1; }
  80%, 100% { opacity: 0.3; }
}

@keyframes shimmer-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes check-draw {
  0% { stroke-dashoffset: 20; }
  100% { stroke-dashoffset: 0; }
}

@keyframes blink-colon {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0.3; }
}

@keyframes pop-in {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes slide-in-up {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}

.cta-shimmer {
  position: relative;
  overflow: hidden;
}
.cta-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%);
  animation: shimmer-slide 3s ease-in-out infinite;
}

.pulse-dot { position: relative; }
.pulse-dot::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 9999px;
  border: 2px solid currentColor;
  opacity: 0;
  animation: pulse-ring 1.5s ease-out infinite;
}

.thinking-dot:nth-child(1) { animation: thinking-dots 1.4s ease-in-out infinite 0s; }
.thinking-dot:nth-child(2) { animation: thinking-dots 1.4s ease-in-out infinite 0.2s; }
.thinking-dot:nth-child(3) { animation: thinking-dots 1.4s ease-in-out infinite 0.4s; }

.orbit-breathe { animation: orbit-breathe 3s ease-in-out infinite; }
.slide-in { animation: slide-in-up 0.3s ease-out both; }
.timer-colon { animation: blink-colon 1s step-end infinite; }
.pop-in { animation: pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.check-animated path {
  stroke-dasharray: 20;
  stroke-dashoffset: 0;
  animation: check-draw 0.4s ease-out both;
}
```

- [ ] **Step 2: Commit**

```
style: add KI-Review animations to global styles
```

### Task 3: Rewrite review-findings component

**Files:**
- Modify: `src/app/components/review-findings/review-findings.ts`

This is the largest change. The component becomes a self-contained card that handles all 5 states. It absorbs pipeline rendering (no longer delegates to review-pipeline as a separate section — though it can still use it as a child for the collapsible pipeline details in the done state).

Key changes to the template:
1. Wrap everything in the card shell (`bg-white rounded-xl border shadow-sm`)
2. Card header shows: chevron + icon + "KI-REVIEW" + state-specific content (idle text / running indicator / severity pills / error badge)
3. **Idle state**: CTA with orbit illustration + "Review starten" button with shimmer
4. **Running state**: Overall progress bar + stepper with thinking dots
5. **Done state**: Pipeline details (collapsed) + file groups with findings
6. **Partial result**: Amber warning banner + findings
7. **Error state**: Friendly error with retry button

Key changes to the TypeScript:
1. Add `sectionExpanded = signal(true)` for card toggle
2. Add `triggerReview` output (or inject CosiReviewService directly)
3. Add computed for severity counts (for the header pills)
4. Add computed for progress (step count)
5. Add `elapsedTime` signal with interval timer for running state
6. Add `hasWarnings` computed for partial result detection

- [ ] **Step 1: Add new imports and signals**

Add to the component class:

```typescript
import { CosiReviewService } from '../../services/cosi-review.service';

// In class:
private readonly cosiReview = inject(CosiReviewService);
readonly sectionExpanded = signal(true);
readonly elapsedSeconds = signal(0);

readonly severityCounts = computed(() => {
  const state = this.reviewState();
  if (typeof state !== 'object' || state.status !== 'result') return null;
  const counts = { critical: 0, important: 0, minor: 0 };
  for (const f of state.data.findings) {
    counts[f.severity]++;
  }
  return counts;
});

readonly progressInfo = computed(() => {
  const state = this.reviewState();
  if (typeof state !== 'object') return null;
  const agents = state.pipeline.agents;
  const consolidator = state.pipeline.consolidator;
  const total = agents.length + 1; // agents + consolidator
  const done = agents.filter(a => a.status === 'done' || a.status === 'error').length
    + (consolidator.status === 'done' || consolidator.status === 'error' ? 1 : 0);
  return { done, total };
});

readonly hasWarnings = computed(() => {
  const state = this.reviewState();
  if (typeof state !== 'object' || state.status !== 'result') return false;
  return state.data.warnings.length > 0;
});

readonly isPartialResult = computed(() => {
  const state = this.reviewState();
  if (typeof state !== 'object' || state.status !== 'result') return false;
  return state.pipeline.agents.some(a => a.status === 'error');
});
```

- [ ] **Step 2: Add timer effect for elapsed time**

```typescript
constructor() {
  // existing effect for fileGroups...

  effect((onCleanup) => {
    const state = this.reviewState();
    if (typeof state === 'object' && state.status === 'running') {
      this.elapsedSeconds.set(0);
      const interval = setInterval(() => {
        this.elapsedSeconds.update(v => v + 1);
      }, 1000);
      onCleanup(() => clearInterval(interval));
    }
  });
}

formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
```

Note: Using `onCleanup` ensures the interval is cleared both when the state changes (running → done/error) and when the component is destroyed (user navigates away). No `DestroyRef` or instance field needed.

- [ ] **Step 3: Rewrite the template**

Replace the entire template with the new card-based layout implementing all 5 states. The template is large — reference `mockups/pr-detail-redesign.html` for exact HTML structure and Tailwind classes. Key structural points:

- Card wrapper: `<div class="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">`
- Card header button with chevron + icon + title + state-specific inline content
- `@if (sectionExpanded())` wraps the card body
- Inside card body: `@if` chain on reviewState status — **order matters**:
  1. `review.status === 'running'` → stepper pipeline with progress bar
  2. `review.status === 'error'` → friendly error with retry button
  3. `review.status === 'result' && isPartialResult()` → amber warning banner + findings
  4. `review.status === 'result'` → findings only (no warning)
  5. `review === 'idle'` → CTA with "Review starten" (this is the default card body when section is open and no review has run)

Typography fixes applied everywhere:
- Finding detail text: `text-sm` (14px) not `text-xs`
- Code snippets: `bg-stone-50 border border-stone-200 text-stone-700` (warm light) not `bg-stone-900 text-stone-100` (dark)
- Finding suggestion text: `text-sm` not `text-xs`
- Badge labels: `text-[11px]` not `text-[10px]`
- File paths: `break-all` not `text-ellipsis overflow-hidden whitespace-nowrap`
- Line numbers: add `pr-2` for right padding

- [ ] **Step 4: Run tests and fix**

Run: `cd /Users/dominik/dev/other/orbit && npx ng test --no-watch`
Update `review-findings.spec.ts` — these specific tests will break:
- **`'does not render when idle'`** — WRONG for new design. Idle now renders the CTA card. Change to: `'shows CTA when idle'` and assert the "Review starten" button exists.
- **`'shows loading state'` / `'KI-Review läuft'`** — the running state no longer shows this text. Assert the progress bar and "Analyse läuft..." text instead.
- **`'Review konnte nicht durchgeführt werden'`** — the error state now shows `'Review konnte nicht durchgeführt werden'` (title) + retry button. Update to assert the retry button exists.
- **`querySelector('[aria-labelledby="pr-review-heading"]')`** — this selector is gone. The card wrapper is now `querySelector('.rounded-xl')` or find by text content.
- **File group selectors** — `querySelector('[data-file-group]')` should still work if preserved in the new template.

- [ ] **Step 5: Commit**

```
feat(review-findings): redesign as self-contained card with 5 states
```

### Task 4: Update review-pipeline component

**Files:**
- Modify: `src/app/components/review-pipeline/review-pipeline.ts`

The pipeline component is now rendered INSIDE the review-findings card as a collapsible details section, not as its own bordered section. It needs to:
1. Remove its own `border-b border-stone-100` section wrapper and `max-w-2xl mx-auto px-6 py-5` padding (parent handles this now)
2. Merge the debug view pattern: single "Details anzeigen" toggle per agent instead of separate "Denkprozess"/"JSON" toggles
3. Add agent task descriptions
4. Keep `sectionOpen` signal but default to `false` (pipeline collapsed by default in done state)

- [ ] **Step 1: Simplify the template wrapper**

Remove the outer `<section>` with borders and padding. The component now renders just:
```html
<div class="border-b border-stone-100">
  <button ...> <!-- pipeline toggle header --> </button>
  @if (sectionOpen()) {
    <div ...> <!-- pipeline content --> </div>
  }
</div>
```

- [ ] **Step 2: Merge debug toggles into single "Details anzeigen"**

For each agent, replace the separate "Denkprozess anzeigen" and "JSON anzeigen" buttons with a single toggle:

```html
@if (agent.thoughts || agent.rawResponse != null) {
  <div class="mt-1.5">
    <button
      type="button"
      class="text-[11px] text-stone-400 font-medium cursor-pointer hover:text-stone-600 inline-flex items-center gap-1"
      (click)="toggleAgentDetails(agent.agent)"
    >
      <svg class="w-3 h-3 transition-transform duration-150" [class.rotate-90]="isAgentDetailsOpen(agent.agent)" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 2l4 4-4 4"/></svg>
      Details anzeigen
    </button>
    @if (isAgentDetailsOpen(agent.agent)) {
      <div class="mt-2 space-y-2">
        @if (agent.thoughts) {
          <div>
            <span class="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Denkprozess</span>
            <pre class="mt-1 bg-stone-50 border border-stone-200 text-stone-600 font-mono text-[11px] p-3 rounded-md overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">{{ agent.thoughts }}</pre>
          </div>
        }
        @if (agent.rawResponse != null) {
          <div>
            <span class="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">JSON-Antwort</span>
            <!-- Exception: JSON debug view stays dark to visually distinguish raw debug data from content -->
            <pre class="mt-1 bg-stone-900 text-stone-300 font-mono text-[11px] p-3 rounded-md overflow-x-auto max-h-48">{{ agent.rawResponse | json }}</pre>
          </div>
        }
      </div>
    }
  </div>
}
```

- [ ] **Step 3: Merge toggle state — replace separate Sets with single openAgentDetails Set**

In the TypeScript class, replace `openAgentThoughts` and `openAgentJsons` with single:
```typescript
private readonly openAgentDetails = signal<Set<string>>(new Set());

isAgentDetailsOpen(agent: string): boolean {
  return this.openAgentDetails().has(agent);
}

toggleAgentDetails(agent: string): void {
  this.openAgentDetails.update(set => {
    const next = new Set(set);
    next.has(agent) ? next.delete(agent) : next.add(agent);
    return next;
  });
}
```

Remove: `openAgentThoughts`, `openAgentJsons`, `isAgentThoughtsOpen`, `toggleAgentThoughts`, `isAgentJsonOpen`, `toggleAgentJson`.

Same pattern for consolidator: replace `consolidatorThoughtsOpen` and `consolidatorJsonOpen` with single `consolidatorDetailsOpen = signal(false)`.

- [ ] **Step 4: Default sectionOpen to false**

Change: `sectionOpen = signal(true)` → `sectionOpen = signal(false)`

- [ ] **Step 5: Add agent task descriptions**

Add a method that returns a description for each agent type:

```typescript
agentDescription(agent: string): string {
  switch (agent) {
    case 'ak-abgleich': return 'Gleicht Änderungen mit Jira-Akzeptanzkriterien ab';
    case 'code-quality': return 'Prüft allgemeine Code-Qualität, Patterns und potenzielle Fehler';
    default: return '';
  }
}

consolidatorDescription = 'Führt Ergebnisse zusammen, entfernt Duplikate, korrigiert Schweregrade';
```

Show these as `<p class="text-xs text-stone-500 mt-0.5">{{ agentDescription(agent.agent) }}</p>` under each agent label.

- [ ] **Step 6: Run tests and fix**

Run: `cd /Users/dominik/dev/other/orbit && npx ng test --no-watch`
Update `review-pipeline.spec.ts` for changed selectors and merged debug toggles.

- [ ] **Step 7: Commit**

```
feat(review-pipeline): merge debug toggles, add descriptions, simplify wrapper
```

---

## Chunk 3: Code Block Consistency + Final Polish

This chunk fixes code block styling consistency (warm light everywhere), updates the Jira noformat blocks, and removes the review trigger from the action rail (since it now lives inside the idle CTA).

### Task 5: Fix code snippet styling in review findings

**Files:**
- Modify: `src/app/components/review-findings/review-findings.ts`

- [ ] **Step 1: Change code snippet classes**

In the findings template, change the code snippet `<pre>` from:
```
bg-stone-900 text-stone-100
```
to:
```
bg-stone-50 border border-stone-200 text-stone-700
```

Full line should be:
```html
<pre class="font-mono text-[13px] bg-stone-50 border border-stone-200 text-stone-700 rounded-md px-3 py-2 mb-2 overflow-x-auto whitespace-pre-wrap">{{ finding.codeSnippet }}</pre>
```

- [ ] **Step 2: Increase finding text sizes**

Change finding detail container from `text-xs` to `text-sm`:
```html
<div class="bg-stone-50 rounded px-3 py-2 text-sm text-stone-600 leading-relaxed" [innerHTML]="finding.detail | inlineCode"></div>
```

Change suggestion text from `text-xs` to `text-sm`:
```html
<div class="mt-1.5 text-sm text-stone-600">
```

Change severity badges from `text-[10px]` to `text-[11px]`:
```html
<span class="text-[11px] px-2 py-0.5 rounded border font-semibold" ...>
```

Add `pr-2` to line number:
```html
<span class="font-mono text-xs text-stone-400 ml-auto pr-2">Zeile {{ finding.line }}</span>
```

- [ ] **Step 3: Fix file path truncation**

Change file path from `text-ellipsis overflow-hidden whitespace-nowrap` to `break-all leading-snug`:
```html
<span class="font-mono text-sm text-stone-700 min-w-0 break-all leading-snug">{{ group.file }}</span>
```

- [ ] **Step 4: Add subtle background tint per severity on findings**

Add severity-specific background to finding stripes:
```typescript
findingStripeClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'border-l-[3px] border-red-500 rounded-r-md bg-red-50/30';
    case 'important': return 'border-l-[3px] border-amber-500 rounded-r-md bg-amber-50/20';
    default: return 'border-l-[3px] border-stone-400';
  }
}
```

- [ ] **Step 5: Run tests**

Run: `cd /Users/dominik/dev/other/orbit && npx ng test --no-watch`
Expected: PASS

- [ ] **Step 6: Commit**

```
fix(review-findings): consistent warm-light code blocks, readable typography, full file paths
```

### Task 6: Wire up review trigger from idle CTA

**Files:**
- Modify: `src/app/components/review-findings/review-findings.ts`

- [ ] **Step 1: Inject CosiReviewService and wire CTA button**

The idle state CTA "Review starten" button needs to trigger the review. The component already receives `reviewState` as input. It needs to inject `CosiReviewService` to call `triggerReview()`:

```typescript
private readonly cosiReview = inject(CosiReviewService);
```

In the idle CTA button: `(click)="cosiReview.triggerReview()"`.

The button should be disabled when `!cosiReview.canReview()`:
```html
<button
  [disabled]="!cosiReview.canReview()"
  (click)="cosiReview.triggerReview()"
  class="..."
  [class.opacity-50]="!cosiReview.canReview()"
  [class.cursor-not-allowed]="!cosiReview.canReview()"
>
```

- [ ] **Step 2: Commit**

```
feat(review-findings): wire up review trigger from idle CTA
```

### Task 7: Final visual polish

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Update Jira noformat to warm light theme**

Change `.jira-markup .jira-noformat` from dark to warm light to match the rest:
```css
.jira-markup .jira-noformat {
  background: rgb(250 250 249); color: rgb(68 64 60);
  border: 1px solid rgb(231 229 228);
  border-radius: 0.5rem; padding: 0.875rem 1rem; overflow-x: auto;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 0.8125rem; line-height: 1.6; margin: 0.75rem 0;
}
```

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/dominik/dev/other/orbit && npx ng test --no-watch`
Expected: ALL PASS

- [ ] **Step 3: Visual verification**

Run: `cd /Users/dominik/dev/other/orbit && npx ng serve`
Open browser and verify:
1. Header shows branch info, comments/tasks integrated
2. Cards have `space-y-3` gaps, rounded-xl borders
3. Jira + Änderungen cards start collapsed, Beschreibung + KI-Review start open
4. KI-Review idle shows CTA with shimmer button
5. Start a review — running state shows progress bar + stepper
6. Done state shows severity pills, pipeline collapsed
7. Code blocks are warm light everywhere
8. File paths wrap instead of truncate

- [ ] **Step 4: Commit**

```
style: warm-light noformat blocks, visual polish
```
