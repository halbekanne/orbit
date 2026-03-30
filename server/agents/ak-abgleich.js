// @ts-check

const { buildSharedConstraints } = require('./agent-definition');

function buildSystemPrompt(projectRules) {
  return `${buildSharedConstraints(projectRules)}

TASK: You are the Akzeptanzkriterien (AK) reviewer. Compare the PR diff against the Jira ticket's Akzeptanzkriterien.

YOUR THINKING PROCESS (use your internal reasoning for these steps before generating JSON):
1. EXTRACT: List every Akzeptanzkriterium from the Jira ticket as AK-1, AK-2, etc. For each, write a one-sentence testable assertion.
2. CLASSIFY: For each AK, determine if it requires a code change at all. Some AKs are non-code tasks (e.g., "Barrierefreiheits-Audit durchführen", "Team über Bugfix informieren", "Meeting mit Stakeholdern organisieren"). Mark these as NOT_CODE_RELEVANT and skip them — they cannot have gaps in a PR diff.
3. TRACE: For each code-relevant AK, scan the diff file by file. Write one of:
   - FOUND: [file]:[line] — how the code implements it
   - PARTIAL: [file]:[line] — what is implemented, what is missing
   - NOT FOUND: no added code addresses this AK
4. FORMULATE: Only for AKs marked PARTIAL or NOT FOUND, create a finding.

EXAMPLE (for calibration — do not copy):
{
  "severity": "important",
  "title": "AK 'Fehlermeldung bei ungültiger Eingabe' nur teilweise umgesetzt",
  "file": "src/components/input-field.ts",
  "line": 87,
  "codeSnippet": "+    if (!value) return;",
  "detail": "Das AK verlangt eine sichtbare Fehlermeldung bei ungültiger Eingabe. Der Code prüft zwar auf leere Werte, zeigt aber keine Meldung an — der Nutzer bekommt kein Feedback.",
  "suggestion": "Fehlertext über das bestehende error-Slot anzeigen, z.B. this.errorMessage = 'Bitte gültigen Wert eingeben'."
}

If the Jira ticket description contains no identifiable Akzeptanzkriterien (e.g., it is empty, purely technical notes, or just a title), return an empty findings array.

SCOPE: Do NOT comment on code quality, style, structure, naming, or patterns. Only check AK coverage.`;
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
            description: "critical = AK completely unaddressed, important = AK partially addressed but key scenario missing, minor = AK addressed but deviates from spec in a small detail",
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

/** @type {import('./agent-definition').AgentDefinition} */
module.exports = {
  id: 'ak-abgleich',
  label: 'AK-Abgleich',
  buildSystemPrompt,
  responseSchema: RESPONSE_SCHEMA,
  temperature: 0.2,
  thinkingBudget: 16384,
  isApplicable(jiraTicket) { return !!jiraTicket; },
  skipMessage: 'Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft.',
  buildUserPrompt(diff, jiraTicket) {
    return `<jira_ticket>
Key: ${jiraTicket.key}
Summary: ${jiraTicket.summary}
Description:
${jiraTicket.description}
</jira_ticket>

<pr_diff>
${diff}
</pr_diff>

Follow your thinking process step by step: EXTRACT, CLASSIFY, TRACE, FORMULATE.`;
  },
};
