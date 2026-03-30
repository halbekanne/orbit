// @ts-check

const { buildSharedConstraints } = require("./agent-definition");

function buildSystemPrompt(projectRules) {
  return `${buildSharedConstraints(projectRules)}

TASK: You are the code quality reviewer. Review the PR diff for code quality issues.

YOUR THINKING PROCESS (use your internal reasoning for these steps before generating JSON):
1. SCAN: Go through the added lines ('+' lines) across all files. Focus on logic, not listing files. For each block of added code that catches your attention, check:
   - What filetype is this? What technology is being used? What are known best practices for this kind of filetype or technology and are they being followed? For example, when you see a "something.ts" file where a Lit/Webcomponent is being defined, you immediately think about known best practices as well as anti-patterns for this technology (e.g. missing cleanup, inefficient rendering, lifecycle errors).
   - Could this cause problems at runtime? (race conditions, broken control flow, unhandled edge cases)
   - Would a new team member understand this in under 10 seconds? (unclear naming of variables/methods, long/complicated files or methods that could be split up, ...)
   Only note files and lines where you actually find something worth reporting.
2. FORMULATE: For each confirmed issue, draft the finding with the exact codeSnippet.

EXAMPLE (for calibration — do not copy):
{
  "severity": "important",
  "title": "Event Listener wird bei Disconnect nicht aufgeräumt",
  "file": "src/components/tooltip.ts",
  "line": 34,
  "codeSnippet": "+    window.addEventListener('scroll', this.handleScroll);",
  "detail": "Der Scroll-Listener wird in connectedCallback registriert, aber in disconnectedCallback nicht entfernt. Bei mehrfachem Mount/Unmount sammeln sich Listener an und verursachen Memory Leaks.",
  "suggestion": "In disconnectedCallback ergänzen: window.removeEventListener('scroll', this.handleScroll);"
}

FOCUS AREAS (in priority order):
Ignore issues that a static analysis (e.g. by the IDE, TypeScript strict mode, common linters for this technology like ESLint, ...) would already catch (type errors, null access on strict types, unused variables, import order, formatting). There is an exception for Jenkinsfiles/Groovy Code, for them, please also report ANY issues, even as small as typos. Otherwise, focus on problems that only a human reviewer would find:

1. Logic errors that compile but behave incorrectly — race conditions, off-by-one, wrong conditions, unhandled edge cases
2. Readability and maintainability — convoluted logic, deep nesting, unclear intent, functions doing too much
3. Best practices for filetype / technology used — e.g. for Lit/Webcomponents/TS this would include lifecycle errors, missing cleanup logic (event listeners, subscriptions), inefficient rendering, incorrect reactive property usage
4. Clean code structure — single responsibility, sensible naming, DRY (no premature abstraction)

SCOPE: Do NOT check Akzeptanzkriterien, design tokens, or accessibility. Focus only on code quality.

Do NOT suggest features, abstractions, or patterns not needed for the current change (YAGNI).`;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    findings: {
      type: "ARRAY",
      description: "List of found issues. Empty array if no issues found.",
      items: {
        type: "OBJECT",
        properties: {
          severity: {
            type: "STRING",
            enum: ["critical", "important", "minor"],
            description: "critical = runtime error or broken functionality, important = structural problem hurting maintainability or missing cleanup logic, minor = readability improvement or small inconsistency",
          },
          title: { type: "STRING", description: "Short German summary of the issue" },
          file: { type: "STRING", description: "File path from the diff" },
          line: { type: "INTEGER", description: "Line number from the diff (the number in square brackets)" },
          codeSnippet: { type: "STRING", description: "The exact 1-2 lines from the diff that this finding targets, copied verbatim" },
          detail: { type: "STRING", description: "What the problem is and why it matters (1-3 sentences, in German)" },
          suggestion: { type: "STRING", description: "Concrete improvement suggestion (in German, English technical terms allowed inline)" },
        },
        required: ["severity", "title", "file", "line", "codeSnippet", "detail", "suggestion"],
        propertyOrdering: ["severity", "title", "file", "line", "codeSnippet", "detail", "suggestion"],
      },
    },
  },
  required: ["findings"],
  propertyOrdering: ["findings"],
};

/** @type {import("./agent-definition").AgentDefinition} */
const codeQualityAgent = {
  id: "code-quality",
  label: "Code-Qualität",
  buildSystemPrompt,
  responseSchema: RESPONSE_SCHEMA,
  temperature: 0.4,
  thinkingBudget: 16384,
  buildUserPrompt(diff) {
    return `<pr_diff>
${diff}
</pr_diff>

Follow your thinking process step by step: SCAN the added lines, then FORMULATE for confirmed issues only.`;
  },
};

module.exports = codeQualityAgent;
