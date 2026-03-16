# PR Diff Viewer — Orbit Warm Theme Override

## Prompt for Claude Code

> Override the diff2html default styling in the PR detail diff viewer to match Orbit's warm design language. The diff viewer is in `src/app/components/pr-detail/pr-detail.ts` and uses diff2html's generated HTML injected via `[innerHTML]`. Add CSS overrides (in the component's `styles` or a dedicated stylesheet) that replace diff2html's cool GitHub-style colors with Orbit's warm palette. Here are the specific mappings:
>
> **File headers:** `background: stone-100 (#f5f5f4)`, `border: stone-200 (#e7e5e4)`, `text: stone-600 (#57534e)`, font: monospace 11px
>
> **Hunk headers (`@@` lines):** `background: stone-50 (#fafaf9)`, `text: stone-400 (#a8a29e)`
>
> **Added lines:** `background: green-50 (#f0fdf4)`, `text: green-700 (#15803d)`, word-level highlight: `green-200 (#bbf7d0)` with 2px border-radius
>
> **Removed lines:** `background: red-50 (#fef2f2)`, `text: red-700 (#b91c1c)`, word-level highlight: `red-200 (#fecaca)` with 2px border-radius
>
> **Context lines:** `text: stone-600 (#57534e)`
>
> **Line numbers:** `color: stone-400 (#a8a29e)`
>
> **All borders:** `stone-200 (#e7e5e4)`
>
> Target the diff2html CSS classes: `.d2h-file-header`, `.d2h-file-wrapper`, `.d2h-code-line`, `.d2h-ins`, `.d2h-del`, `.d2h-info`, `.d2h-code-linenumber`. Use `::ng-deep` or `:host` scoping as appropriate. Keep the highlight.js syntax theme unchanged (github light).
