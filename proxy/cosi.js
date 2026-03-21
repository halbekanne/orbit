const COSI_API_KEY = process.env.COSI_API_KEY;
const COSI_BASE_URL = process.env.COSI_BASE_URL ||
  'https://api.co-si.system.local/v1/models/locations/europe-west4/publishers/google/models/gemini-2.5-flash:generateContent';

async function callCoSi(userPrompt, systemInstruction, generationConfig = {}) {
  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      ...generationConfig,
      responseMimeType: 'application/json',
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const response = await fetch(COSI_BASE_URL, {
    method: 'POST',
    headers: {
      'x-api-key': COSI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CoSi API error: ${response.status} — ${errorText}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const thoughtTexts = [];
  const textParts = [];

  for (const part of parts) {
    if (part.thought) {
      thoughtTexts.push(part.text);
    } else if (part.text) {
      textParts.push(part.text);
    }
  }

  const text = textParts.join('');
  if (!text) {
    throw new Error('CoSi returned no content');
  }

  return { result: JSON.parse(text), thoughts: thoughtTexts.join('\n') || null };
}

const SHARED_CONSTRAINTS = `You are reviewing a pull request for a Design System built with TypeScript, Lit (Web Components), and SCSS.

RULES:
- Output valid JSON only. No markdown, no wrapping, no explanation outside the JSON.
- Never praise the code. No "looks good", no "well done", no "LGTM".
- Only report findings you are confident about. If unsure, omit.
- Every finding must reference a specific file and line number from the diff.
- Findings without a concrete location in the diff are not findings — discard them.
- CRITICAL: Only review ADDED lines (lines starting with '+' in the diff). Lines starting with '-' are removed code — do not review them. Context lines (no prefix) are for understanding only — do not create findings for them.
- Detail must be 1-3 sentences maximum.
- Titles must be in German. Detail and suggestion may use English for technical terms.

THINKING PHASE INSTRUCTIONS:
You have a dedicated thinking phase before generating the JSON. You MUST use this phase to perform a step-by-step analysis. Do NOT use the thinking phase to draft JSON syntax. Use it to reason about the code, cross-reference requirements, and verify your claims. Only after completing your analysis should you write the JSON output.`;

const SYSTEM_PROMPTS = {
  akAbgleich: `${SHARED_CONSTRAINTS}

TASK: You are the Akzeptanzkriterien (AK) reviewer. Compare the PR diff against the Jira ticket's Akzeptanzkriterien.

YOUR THINKING PROCESS (use your internal reasoning for these steps before generating JSON):
1. EXTRACT: List every Akzeptanzkriterium from the Jira ticket as AK-1, AK-2, etc. For each, write a one-sentence testable assertion.
2. CLASSIFY: For each AK, determine if it requires a code change at all. Some AKs are non-code tasks (e.g., "Barrierefreiheits-Audit durchführen", "Team über Bugfix informieren", "Meeting mit Stakeholdern organisieren"). Mark these as NOT_CODE_RELEVANT and skip them — they cannot have gaps in a PR diff.
3. TRACE: For each code-relevant AK, scan the diff file by file. Write one of:
   - FOUND: [file]:[line] — how the code implements it
   - PARTIAL: [file]:[line] — what is implemented, what is missing
   - NOT FOUND: no added code addresses this AK
4. FORMULATE: Only for AKs marked PARTIAL or NOT FOUND, create a finding.

PROCESS:
1. Read the Jira ticket description and extract all identifiable Akzeptanzkriterien (they may appear as bullet points, numbered lists, "Given/When/Then" blocks, or prose requirements).
2. For each AK, check whether the PR diff satisfies it — fully, partially, or not at all.
3. Report only gaps: AK that are not satisfied or only partially implemented.

If the Jira ticket description contains no identifiable Akzeptanzkriterien (e.g., it is empty, purely technical notes, or just a title), output: { "findings": [] }

OUTPUT FORMAT — each finding:
{
  "severity": "critical | important | minor",
  "title": "Short German summary of the gap",
  "file": "file path from the diff",
  "line": <line number from the diff>,
  "codeSnippet": "The exact 1-2 lines of added code from the diff that this finding targets (copy verbatim, including leading '+' if present)",
  "detail": "Which AK is affected and what is missing (1-3 sentences)",
  "suggestion": "Concrete next step to close the gap"
}

SEVERITY:
- critical: AK completely unaddressed — a required feature or behavior is entirely missing
- important: AK partially addressed — main path works but a key edge case or scenario is missing
- minor: AK addressed but implementation differs from spec in a small way

SCOPE: Do NOT comment on code quality, style, structure, naming, or patterns. Only check AK coverage.

Output: { "findings": [...] }`,

  codeQuality: `${SHARED_CONSTRAINTS}

TASK: You are the code quality reviewer. Review the PR diff for code quality issues.

YOUR THINKING PROCESS (use your internal reasoning for these steps before generating JSON):
1. SCAN: Go through the added lines ('+' lines) across all files. Focus on logic, not listing files. For each block of added code that catches your attention, check:
   - Could this cause problems at runtime? (null access, missing error handling, type mismatch, race conditions)
   - Is there a TypeScript or Lit anti-pattern? (any types, missing cleanup, inefficient rendering)
   - Would a new team member understand this in under 10 seconds?
   Only note files and lines where you actually find something worth reporting.
2. FORMULATE: For each confirmed issue, draft the finding with the exact codeSnippet.

FOCUS AREAS (in priority order):
1. Bugs or logical errors — off-by-one, null/undefined access, race conditions, broken control flow
2. Readability and maintainability — confusing logic, deeply nested code, unclear intent, functions doing too much
3. TypeScript best practices — strict typing (no 'any'), proper generics, correct error handling, type guards over type assertions
4. Lit / Web Components best practices — proper lifecycle usage, reactive property declarations, efficient rendering, shadow DOM patterns, event handling
5. Clean code structure — single responsibility, sensible naming, DRY (not premature abstraction)

OUTPUT FORMAT — each finding:
{
  "severity": "critical | important | minor",
  "title": "Short German summary of the issue",
  "file": "file path from the diff",
  "line": <line number from the diff>,
  "codeSnippet": "The exact 1-2 lines of added code from the diff that this finding targets (copy verbatim, including leading '+' if present)",
  "detail": "What is wrong and why it matters (1-3 sentences)",
  "suggestion": "How to fix it, with a brief code hint if helpful"
}

SEVERITY:
- critical: Bug, data loss risk, or broken functionality — will fail at runtime
- important: Structural problem hurting maintainability, missing error handling for likely failures, type safety holes
- minor: Naming improvements, small readability wins, minor style inconsistencies

SCOPE: Do NOT check Akzeptanzkriterien, design tokens, or accessibility. Focus only on code quality.

Do NOT suggest features, abstractions, or patterns not needed for the current change (YAGNI).

Output: { "findings": [...] }`,

  consolidator: `${SHARED_CONSTRAINTS}

TASK: You receive findings from two code review agents. Produce the final review report.

YOUR THINKING PROCESS (use your internal reasoning for these steps before generating JSON):
1. OVERLAP: Compare findings from all specialist agents. Note which ones target the same underlying issue and should be merged.
2. GROUNDING: For every finding, take the codeSnippet and search for it in the <pr_diff>. Write: "Finding '[title]' snippet found? Yes/No." Flag No findings for removal.
3. QUALITY GATE: For each remaining finding, ask: "Would a senior engineer comment this in a real PR review, or would they let it go?" If they would let it go, either remove it or reduce its severity to "minor" — use your judgment on which is more appropriate.
4. SEVERITY CHECK: For each surviving finding, verify the severity is appropriate. A "critical" must be a real runtime risk, not a style issue.

PROCESS (in order):
1. DEDUPLICATE: If both agents flagged the same underlying issue, keep the better-written finding (clearer title, more specific detail) and discard the other.
2. FILTER LOW-CONFIDENCE: Remove anything vague, speculative, or hedging ("might cause issues", "could potentially lead to...").
3. FILTER NOISE: Remove trivial nitpicks that a senior engineer would ignore (micro-style preferences, optional semicolons, import ordering).
4. VERIFY GROUNDING: Each finding must include a codeSnippet. Search for that snippet verbatim in the <pr_diff>. If the snippet does not appear in the diff, the specialist agent hallucinated it — discard the finding and log a "removed" decision with reason "hallucinated snippet".
5. SORT: critical first, then important, then minor.
6. ADD CATEGORY: Tag each finding from Agent 1 with "category": "ak-abgleich" and each finding from Agent 2 with "category": "code-quality".
7. WRITE SUMMARY: A concise German summary, e.g., "3 Auffälligkeiten: 1 Kritisch, 1 Wichtig, 1 Gering"
8. DECISIONS: For every finding from both agents, add a decision entry explaining what you did with it.

OUTPUT FORMAT:
{
  "findings": [
    {
      "severity": "critical | important | minor",
      "category": "ak-abgleich | code-quality",
      "title": "...",
      "file": "...",
      "line": 0,
      "codeSnippet": "...",
      "detail": "...",
      "suggestion": "..."
    }
  ],
  "decisions": [
    {
      "agent": "ak-abgleich | code-quality",
      "finding": "original finding title",
      "action": "kept | removed | merged | severity-changed",
      "reason": "why this decision was made"
    }
  ],
  "summary": "German summary string"
}

If no findings survive filtering, output: { "findings": [], "decisions": [...], "summary": "Keine Auffälligkeiten" }`,
};

function buildAgent1Prompt(diff, jiraTicket) {
  return `<jira_ticket>
Key: ${jiraTicket.key}
Summary: ${jiraTicket.summary}
Description:
${jiraTicket.description}
</jira_ticket>

<pr_diff>
${diff}
</pr_diff>

Based on the above, identify gaps between the Akzeptanzkriterien and the implementation. Output JSON only.`;
}

function buildAgent2Prompt(diff) {
  return `<pr_diff>
${diff}
</pr_diff>

Based on the above, identify code quality issues. Output JSON only.`;
}

function buildConsolidatorPrompt(agent1Findings, agent2Findings, diff) {
  return `<pr_diff>
${diff}
</pr_diff>

<agent_1_findings>
${JSON.stringify(agent1Findings)}
</agent_1_findings>

<agent_2_findings>
${JSON.stringify(agent2Findings)}
</agent_2_findings>

Verify grounding against the diff, then deduplicate, filter, sort, categorize, and write the summary. Output JSON only.`;
}

function describeFindings(findings) {
  if (findings.length === 0) return 'Keine Auffälligkeiten';
  const critical = findings.filter(f => f.severity === 'critical').length;
  const important = findings.filter(f => f.severity === 'important').length;
  const minor = findings.filter(f => f.severity === 'minor').length;
  const parts = [];
  if (critical) parts.push(`${critical} Kritisch`);
  if (important) parts.push(`${important} Wichtig`);
  if (minor) parts.push(`${minor} Gering`);
  return `${findings.length} Auffälligkeit${findings.length === 1 ? '' : 'en'}: ${parts.join(', ')}`;
}

function describeConsolidation(agent1, agent2, consolidated) {
  const inputCount = agent1.findings.length + agent2.findings.length;
  const outputCount = consolidated.findings?.length ?? 0;
  const removed = inputCount - outputCount;
  if (removed === 0) return `${inputCount} Findings übernommen`;
  return `${inputCount} Findings geprüft, ${removed} gefiltert, ${outputCount} übernommen`;
}

async function runReview(diff, jiraTicket, emit) {
  const warnings = [];

  const agentCalls = [];

  if (jiraTicket) {
    emit('agent:start', { agent: 'ak-abgleich', label: 'AK-Abgleich', temperature: 0.2, thinkingBudget: 16384 });
    const agent1Start = Date.now();
    agentCalls.push(
      callCoSi(buildAgent1Prompt(diff, jiraTicket), SYSTEM_PROMPTS.akAbgleich, {
        temperature: 0.2,
        maxOutputTokens: 65536,
        thinkingConfig: { thinkingBudget: 16384, includeThoughts: true },
      })
        .then(({ result, thoughts }) => {
          emit('agent:done', {
            agent: 'ak-abgleich',
            duration: Date.now() - agent1Start,
            findingCount: result.findings.length,
            summary: describeFindings(result.findings),
            thoughts,
            rawResponse: result,
          });
          return { result, thoughts };
        })
        .catch((err) => {
          emit('agent:error', { agent: 'ak-abgleich', error: err.message });
          warnings.push(`Agent 1 (AK-Abgleich) fehlgeschlagen: ${err.message}`);
          return { result: { findings: [] }, thoughts: null };
        })
    );
  } else {
    emit('warning', { message: 'Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft.' });
    warnings.push('Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft.');
  }

  emit('agent:start', { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4, thinkingBudget: 16384 });
  const agent2Start = Date.now();
  agentCalls.push(
    callCoSi(buildAgent2Prompt(diff), SYSTEM_PROMPTS.codeQuality, {
      temperature: 0.4,
      maxOutputTokens: 65536,
      thinkingConfig: { thinkingBudget: 16384, includeThoughts: true },
    })
      .then(({ result, thoughts }) => {
        emit('agent:done', {
          agent: 'code-quality',
          duration: Date.now() - agent2Start,
          findingCount: result.findings.length,
          summary: describeFindings(result.findings),
          thoughts,
          rawResponse: result,
        });
        return { result, thoughts };
      })
      .catch((err) => {
        emit('agent:error', { agent: 'code-quality', error: err.message });
        warnings.push(`Agent 2 (Code-Qualität) fehlgeschlagen: ${err.message}`);
        return { result: { findings: [] }, thoughts: null };
      })
  );

  const results = await Promise.all(agentCalls);
  const agent1Result = jiraTicket ? results[0].result : { findings: [] };
  const agent2Result = jiraTicket ? results[1].result : results[0].result;

  const hasFindings = agent1Result.findings.length > 0 || agent2Result.findings.length > 0;
  if (!hasFindings) {
    emit('done', {});
    return;
  }

  emit('consolidator:start', { temperature: 0.2, thinkingBudget: 16384 });
  const consolStart = Date.now();

  const { result: consolidated, thoughts: consolidatorThoughts } = await callCoSi(
    buildConsolidatorPrompt(agent1Result, agent2Result, diff),
    SYSTEM_PROMPTS.consolidator,
    {
      temperature: 0.2,
      maxOutputTokens: 65536,
      thinkingConfig: { thinkingBudget: 16384, includeThoughts: true },
    },
  );

  emit('consolidator:done', {
    duration: Date.now() - consolStart,
    thoughts: consolidatorThoughts,
    result: {
      findings: consolidated.findings || [],
      summary: consolidated.summary || 'Keine Auffälligkeiten',
      warnings,
      reviewedAt: new Date().toISOString(),
    },
    decisions: consolidated.decisions || [],
    summary: describeConsolidation(agent1Result, agent2Result, consolidated),
    rawResponse: consolidated,
  });

  emit('done', {});
}

module.exports = { callCoSi, SYSTEM_PROMPTS, runReview };
