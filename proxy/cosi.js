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
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('CoSi returned no content');
  }

  return JSON.parse(text);
}

const SHARED_CONSTRAINTS = `You are reviewing a pull request for a Design System built with TypeScript, Lit (Web Components), and SCSS.

RULES:
- Output valid JSON only. No markdown, no wrapping, no explanation outside the JSON.
- Never praise the code. No "looks good", no "well done", no "LGTM".
- Only report findings you are confident about. If unsure, omit.
- Every finding must reference a specific file and line number from the diff.
- Findings without a concrete location in the diff are not findings — discard them.
- Detail must be 1-3 sentences maximum.
- Titles must be in German. Detail and suggestion may use English for technical terms.`;

const SYSTEM_PROMPTS = {
  akAbgleich: `${SHARED_CONSTRAINTS}

TASK: You are the Akzeptanzkriterien (AK) reviewer. Compare the PR diff against the Jira ticket's Akzeptanzkriterien.

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

PROCESS (in order):
1. DEDUPLICATE: If both agents flagged the same underlying issue, keep the better-written finding (clearer title, more specific detail) and discard the other.
2. FILTER LOW-CONFIDENCE: Remove anything vague, speculative, or hedging ("might cause issues", "could potentially lead to...").
3. FILTER NOISE: Remove trivial nitpicks that a senior engineer would ignore (micro-style preferences, optional semicolons, import ordering).
4. VERIFY GROUNDING: Each finding must reference a real file and line. If a finding mentions a file or line that does not exist in the provided context, the specialist agent hallucinated it — discard it.
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
      "line": <number>,
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

function buildConsolidatorPrompt(agent1Findings, agent2Findings) {
  return `<agent_1_findings>
${JSON.stringify(agent1Findings)}
</agent_1_findings>

<agent_2_findings>
${JSON.stringify(agent2Findings)}
</agent_2_findings>

Deduplicate, filter, sort, categorize, and write the summary. Output JSON only.`;
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
    emit('agent:start', { agent: 'ak-abgleich', label: 'AK-Abgleich', temperature: 0.2 });
    const agent1Start = Date.now();
    agentCalls.push(
      callCoSi(buildAgent1Prompt(diff, jiraTicket), SYSTEM_PROMPTS.akAbgleich, { temperature: 0.2 })
        .then((result) => {
          emit('agent:done', {
            agent: 'ak-abgleich',
            duration: Date.now() - agent1Start,
            findingCount: result.findings.length,
            summary: describeFindings(result.findings),
            rawResponse: result,
          });
          return result;
        })
        .catch((err) => {
          emit('agent:error', { agent: 'ak-abgleich', error: err.message });
          warnings.push(`Agent 1 (AK-Abgleich) fehlgeschlagen: ${err.message}`);
          return { findings: [] };
        })
    );
  } else {
    emit('warning', { message: 'Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft.' });
    warnings.push('Kein Jira-Ticket verknüpft — nur Code-Qualität geprüft.');
  }

  emit('agent:start', { agent: 'code-quality', label: 'Code-Qualität', temperature: 0.4 });
  const agent2Start = Date.now();
  agentCalls.push(
    callCoSi(buildAgent2Prompt(diff), SYSTEM_PROMPTS.codeQuality, { temperature: 0.4 })
      .then((result) => {
        emit('agent:done', {
          agent: 'code-quality',
          duration: Date.now() - agent2Start,
          findingCount: result.findings.length,
          summary: describeFindings(result.findings),
          rawResponse: result,
        });
        return result;
      })
      .catch((err) => {
        emit('agent:error', { agent: 'code-quality', error: err.message });
        warnings.push(`Agent 2 (Code-Qualität) fehlgeschlagen: ${err.message}`);
        return { findings: [] };
      })
  );

  const results = await Promise.all(agentCalls);
  const agent1Result = jiraTicket ? results[0] : { findings: [] };
  const agent2Result = jiraTicket ? results[1] : results[0];

  const hasFindings = agent1Result.findings.length > 0 || agent2Result.findings.length > 0;
  if (!hasFindings) {
    emit('done', {});
    return;
  }

  emit('consolidator:start', { temperature: 0.2 });
  const consolStart = Date.now();

  const consolidated = await callCoSi(
    buildConsolidatorPrompt(agent1Result, agent2Result),
    SYSTEM_PROMPTS.consolidator,
    { temperature: 0.2 },
  );

  emit('consolidator:done', {
    duration: Date.now() - consolStart,
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
