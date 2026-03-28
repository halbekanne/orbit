# Align with Design Philosophy — UX/UI Improvements

> Date: 2026-03-28
> Branch: feature/align-with-design-philosophy

## Context

An audit of Orbit's UX/UI against the ADHD design principles in AGENTS.md revealed two concrete issues:

1. **Action buttons live in the calendar sidebar.** Collapsing the calendar hides all actions. This violates Zero-Depth Navigation and creates a hidden dependency between unrelated features.
2. **PR list is unsorted.** Urgent items (failing builds, unresolved reviews) are buried among normal cards. This violates Status at a Glance.

This spec addresses both issues.

---

## Change 1: Collapsing Header with Action Bar

### Problem

The action rail component lives in the right calendar sidebar. Actions are invisible when the calendar is collapsed. The calendar couples three unrelated concerns: day timeline, pomodoro controls, and item actions.

### Solution

Move all item actions into the workbench detail view. The header uses a two-phase behavior:

**Phase 1 — Full header (scroll position = 0):**
- Full detail header with type, title, badges, dates (existing content)
- Action bar directly below the header with a subtle `--color-bg-surface` background
- Action bar border-bottom separates it from content
- Primary and secondary actions separated by a vertical divider

**Phase 2 — Compact bar (scroll position > threshold):**
- Full header and action bar scroll away naturally
- A 36px sticky compact bar slides in from the top (150ms ease transition)
- Compact bar contains: 3px status stripe, key/emoji (for tickets/ideas), truncated title, status badge
- No action buttons in the compact bar — user scrolls up to access actions

### Action Bar Content Per Type

The "Fokus setzen" button toggles: it shows "Fokus setzen" when unfocused and "Fokus entfernen" when the item is the current focus. Visual style changes from primary to neutral when focused.

**Ticket:**
- `☆ Fokus setzen` (primary) | divider | `In Jira öffnen ↗` (neutral)

**Pull Request:**
- `☆ Fokus setzen` (primary) | divider | `KI-Review starten` (success) · `In Bitbucket öffnen ↗` (neutral)
- KI-Review button states: "KI-Review starten" / "Review läuft..." (disabled) / "Erneut reviewen"

**Todo (open):**
- `☆ Fokus setzen` (primary) · `✓ Erledigt` (success) | divider | `⚡ Dringend` (warning toggle) · `→ Zur Idee machen` (neutral) · `✗ Nicht erledigen` (danger)

**Todo (done):**
- `Wieder öffnen` (neutral) · `→ Zur Idee machen` (neutral)

**Todo (won't-do):**
- `Wieder öffnen` (neutral)

**Idea (active):**
- `☆ Fokus setzen` (primary) · `→ Zur Aufgabe machen` (success) | divider | `✗ Nicht verfolgen` (neutral)

**Idea (won't-do):**
- `Wieder aufgreifen` (neutral)

### Button Styling

- Primary: `--color-primary-solid` background, white text
- Success: `--color-success-bg` background, `--color-success-text`, success border
- Warning: `--color-signal-bg` background, signal text, signal border (toggle behavior for "Dringend")
- Neutral: `--color-bg-surface` background, `--color-text-body`, subtle border
- Danger: `--color-danger-bg` background, `--color-danger-text`, danger border
- Divider: 1px vertical line in `--color-border-default`, 18px height

### Compact Bar Design

- Height: 36px
- Background: `--color-bg-card`
- Border-bottom: `--color-border-default`
- Subtle box-shadow for depth
- Left: 3px status stripe (same color logic as full header) + key in monospace (tickets/PRs) or emoji (ideas) + truncated title (ellipsis). Todos show no prefix, just the title.
- Right: status badge
- Transition: `transform 0.15s ease, opacity 0.15s ease` — slides down from translateY(-100%) to translateY(0)
- Scroll threshold: ~30px (full header out of view)

### Calendar Sidebar Decoupling

- Remove the `ActionRailComponent` from the calendar panel
- Calendar sidebar retains only: collapse toggle, "Tagesplan" title, pomodoro controls, day timeline
- The action rail component can be deleted or its logic moved into a new workbench action bar component

### Implementation Notes

- All four detail views (ticket, PR, todo, idea) must adopt the same pattern
- The compact bar can be a shared component used by all detail views
- The scroll threshold should be calculated based on the full header height (IntersectionObserver on a sentinel element is cleaner than scroll position math)
- Todo and idea detail views currently lack sticky headers — they will now get the compact sticky bar behavior
- Existing detail header content does not change — only the action bar is added below and the compact bar above

---

## Change 2: PR List Sorting by Urgency

### Problem

PRs appear in an arbitrary order. Urgent items (failing builds, overdue reviews) are not visually distinguished from normal PRs. The user must scan every card to find what needs attention.

### Solution

Split the PR list into two non-interactive subgroups with smart sorting within each.

### Subgroup Labels

Two static text labels separate the groups:
- **"Wartet auf dein Review"** — PRs where the user is a reviewer
- **"Deine PRs"** — PRs authored by the user

Labels are non-interactive (no collapse, no counter). Styled as small muted text (`9px, font-weight 600, --color-text-muted`). They serve purely as a light visual divider.

### Sort Order: "Wartet auf dein Review"

1. **Waiting ≥2 business days, no other review** — amber attention border + "Review seit X Tagen" badge
2. **Normal, waiting for review** — sorted by creation time (oldest first)
3. **Already reviewed by someone else** — inactive card (opacity 55%/62%), "Bereits reviewed" green badge, sorted to bottom

Business day calculation: Monday–Friday only. Saturdays and Sundays are excluded.

### Sort Order: "Deine PRs"

1. **Build failing** — red attention border (border-l-4 red-500) + "Build fehlgeschlagen" red badge
2. **Unresolved review comments** — amber attention border + "Änderungen angefordert" amber badge + open comment count in footer
3. **Approved** — normal card (no attention border) + "Approved" green badge. Sorted above "in review" because the user can act on it (merge)
4. **In review, no issues** — normal card, waiting on others

### New Badges

| Badge | Text | Background | Text Color | When |
|---|---|---|---|---|
| Build fail | `✗ Build fehlgeschlagen` | `--color-danger-bg` | `--color-danger-text` | My PR, build status red |
| Changes requested | `Änderungen angefordert` | `--color-signal-bg` | `--color-signal-text` | My PR, unresolved review comments |
| Review waiting | `Review seit X Tagen` | `--color-signal-bg` | `--color-signal-text` | Others' PR, ≥2 business days |
| Already reviewed | `✓ Bereits reviewed` | `--color-success-bg` | `--color-success-text` | Others' PR, another reviewer approved |
| Approved | `✓ Approved` | `--color-success-bg` | `--color-success-text` | My PR, approved status |
| Small change | `Kleine Änderung` | `--color-success-bg` | `--color-success-text` | Any PR, changed lines below threshold |

### Card Attention States (Extended)

The existing card state system gains one new state:

| State | Border | When |
|---|---|---|
| Inactive | none, opacity reduced | Done/declined PRs, or already reviewed by others |
| Normal | none | Default |
| Attention (amber) | `border-l-4 border-amber-500` | Unresolved comments, review waiting ≥2 days |
| **Attention (red)** | `border-l-4 border-red-500` | Build failing on my PR |

Red attention is new. Add a `--color-card-attention-bar-danger` token (or reuse `--color-danger-text`) for the red-500 left border.

### "Klein" Badge Threshold

A PR is considered "klein" when the total changed lines (additions + deletions) is below a configurable threshold. Initial default: 50 lines. This badge appears on normal cards alongside other badges — it has no effect on sorting or card state.

### Data Requirements

All data needed for sorting is already available from the Bitbucket API or can be derived:
- Build status: already fetched per PR
- Review comments resolved/unresolved: available in PR activity/comments endpoint
- Reviewer list and their status: available in PR participants
- Changed lines count: available in PR diffstat
- Creation/update timestamps: already fetched

Business day calculation is pure frontend logic (no API needed).

---

## Out of Scope

- Ticket sorting in the navigator (separate concern)
- AI-estimated review duration badge (added to IDEAS.md as future feature)
- Intelligent workbench empty state (added to IDEAS.md as future feature)
- Collapsible navigator sidebar
- Reflection card pulsing behavior (validated as acceptable)
