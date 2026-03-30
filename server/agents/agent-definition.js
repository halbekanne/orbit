// @ts-check

/**
 * @typedef {Object} AgentDefinition
 * @property {string} id
 * @property {string} label
 * @property {(projectRules?: string) => string} buildSystemPrompt
 * @property {Object} responseSchema
 * @property {number} temperature
 * @property {number} thinkingBudget
 * @property {(diff: string, jiraTicket?: JiraTicketInput) => string} buildUserPrompt
 * @property {(jiraTicket?: JiraTicketInput) => boolean} [isApplicable]
 * @property {string} [skipMessage]
 *   — Optional German message emitted as warning when this agent is skipped.
 *     If not set, no warning is emitted when the agent is skipped.
 */

/**
 * @typedef {Object} JiraTicketInput
 * @property {string} key
 * @property {string} summary
 * @property {string} description
 */

function buildSharedConstraints(projectRules) {
  let constraints = `You are reviewing a pull request.

Every line in the diff starts with [line_number]. Use this number directly as the "line" value.

RULES:
- Report only problems. Every finding must describe a concrete deficiency.
- No praise, no "looks good", no "well done", no "LGTM".
- Report a finding ONLY if you can point to a specific added line in the diff. Without an exact codeSnippet, the finding does not exist.
- CRITICAL: Only review ADDED lines (lines starting with '+' in the diff). Lines starting with '-' are removed code — do not review them. Context lines (no prefix) are for understanding only — do not create findings for them.
- An empty findings array is a valid result, not an error. Do not manufacture issues to fill the output — but when in doubt, report one finding too many rather than miss one.
- All textual fields (title, detail, suggestion) must be in informal German. English technical terms (e.g. "null check", "race condition", "lifecycle hook") may be used inline.
- All textual fields (title, detail, suggestion) must be concise. The goal for these findings is to be easily understandable while being worded as shortly as possible, so developers can quickly visually scan a lot of findings in one go.
- You will also receive project context and rules that will give you more context and help you with assessing code deviations from the "norm" (e.g. a deviation from best practices might be deliberate).

THINKING PHASE INSTRUCTIONS:
You have a dedicated thinking phase before generating the JSON. You MUST use this phase to perform a step-by-step analysis. Do NOT use the thinking phase to draft JSON syntax. Use it to reason about the code, cross-reference requirements, and verify your claims. Only after completing your analysis should you write the JSON output.`;

  if (projectRules?.trim()) {
    constraints += `\n\nPROJECT CONTEXT AND RULES (provided by user):\n${projectRules}`;
  }

  return constraints;
}

module.exports = { buildSharedConstraints };
