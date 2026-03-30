const { buildSharedConstraints } = require('./agents/agent-definition');
const { AGENT_REGISTRY } = require('./agents');

async function callAi(userPrompt, systemInstruction, generationConfig = {}, { vertexAi } = {}) {
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

  const headers = { 'Content-Type': 'application/json' };
  if (vertexAi?.customHeaders) {
    for (const { name, value } of vertexAi.customHeaders) {
      headers[name] = value;
    }
  }

  const response = await fetch(vertexAi.url + ':generateContent', {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(300_000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} — ${errorText}`);
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
    throw new Error('AI returned no content');
  }

  return { result: JSON.parse(text), thoughts: thoughtTexts.join('\n') || null };
}

function preprocessDiff(rawDiff) {
  const lines = rawDiff.split('\n');
  const result = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[2], 10);
      result.push(line);
    } else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ') || line.startsWith('Binary ')) {
      result.push(line);
    } else if (line.startsWith('-')) {
      result.push(`[${oldLine}]${line}`);
      oldLine++;
    } else if (line.startsWith('+')) {
      result.push(`[${newLine}]${line}`);
      newLine++;
    } else {
      result.push(`[${newLine}]${line}`);
      oldLine++;
      newLine++;
    }
  }

  return result.join('\n');
}

const CONSOLIDATOR_SCHEMA = {
  type: "OBJECT",
  properties: {
    findings: {
      type: "ARRAY",
      description: "Final, filtered list of findings.",
      items: {
        type: "OBJECT",
        properties: {
          severity: {
            type: "STRING",
            enum: ["critical", "important", "minor"],
            description: "critical = real runtime risk, important = structural problem, minor = small improvement",
          },
          category: {
            type: "STRING",
            description: "Which agent originally produced the finding",
          },
          title: { type: "STRING", description: "Short German summary" },
          file: { type: "STRING", description: "File path from the diff" },
          line: { type: "INTEGER", description: "Line number from the diff" },
          codeSnippet: { type: "STRING", description: "Exact lines from the diff, copied verbatim" },
          detail: { type: "STRING", description: "Problem description in German (1-3 sentences)" },
          suggestion: { type: "STRING", description: "Improvement suggestion in German" },
          wcagCriterion: { type: "STRING", description: "WCAG criterion reference, if applicable" },
        },
        required: ["severity", "category", "title", "file", "line", "codeSnippet", "detail", "suggestion"],
        propertyOrdering: ["severity", "category", "title", "file", "line", "codeSnippet", "detail", "suggestion", "wcagCriterion"],
      },
    },
    decisions: {
      type: "ARRAY",
      description: "For each input finding, a decision explaining what happened to it.",
      items: {
        type: "OBJECT",
        properties: {
          agent: { type: "STRING" },
          finding: { type: "STRING", description: "Original title of the finding" },
          action: { type: "STRING", enum: ["kept", "removed", "merged", "severity-changed"] },
          reason: { type: "STRING", description: "Reasoning in German" },
        },
        required: ["agent", "finding", "action", "reason"],
        propertyOrdering: ["agent", "finding", "action", "reason"],
      },
    },
    summary: {
      type: "STRING",
      description: "German summary, e.g. '3 Auffälligkeiten: 1 Kritisch, 1 Wichtig, 1 Gering' or 'Keine Auffälligkeiten'",
    },
  },
  required: ["findings", "decisions", "summary"],
  propertyOrdering: ["findings", "decisions", "summary"],
};

function buildConsolidatorSystemPrompt(projectRules) {
  return `${buildSharedConstraints(projectRules)}

TASK: You receive findings from multiple specialist review agents. Produce the final review report.

YOUR THINKING PROCESS (use your internal reasoning for these steps before generating JSON):
1. OVERLAP: Compare findings from all specialist agents. Note which ones target the same underlying issue and should be merged.
2. GROUNDING: For every finding, take the codeSnippet and search for it in the <pr_diff>. Write: "Finding '[title]' snippet found? Yes/No." Flag No findings for removal.
3. QUALITY GATE: For each remaining finding, ask: "Would a senior engineer comment this in a real PR review, or would they let it go?" If they would let it go, either remove it or reduce its severity to "minor" — use your judgment on which is more appropriate.

NOISE EXAMPLES (always remove findings like these):
- Formatting, trailing commas, semicolons, quote style → enforced by ESLint/Prettier
- Import ordering or grouping → enforced by ESLint
- Type errors or null checks that TypeScript strict mode already enforces → the build will break anyway
- Purely cosmetic renames that improve neither readability nor maintainability → a matter of taste, not a defect
- Findings that name no concrete problem but only suggest an alternative ("could also use X") → only keep if the current solution has a measurable problem (readability, performance, maintainability), then as "minor"

4. SEVERITY CHECK: For each surviving finding, verify the severity is appropriate. A "critical" must be a real runtime risk, not a style issue.

EXAMPLE (for calibration — do not copy):
{
  "decisions": [
    {
      "agent": "code-quality",
      "finding": "Event Listener wird bei Disconnect nicht aufgeräumt",
      "action": "kept",
      "reason": "codeSnippet im Diff bestätigt. Memory Leak bei wiederholtem Mount/Unmount — Severity 'important' ist angemessen."
    },
    {
      "agent": "ak-abgleich",
      "finding": "AK 'Ladeanimation' nicht umgesetzt",
      "action": "removed",
      "reason": "Der codeSnippet 'showLoadingSpinner()' kommt im Diff nicht vor. Agent hat die Zeile halluziniert."
    },
    {
      "agent": "code-quality",
      "finding": "Verschachtelte Ternary-Operatoren",
      "action": "severity-changed",
      "reason": "Kein Laufzeitrisiko, aber erschwert Lesbarkeit. Von 'important' auf 'minor' herabgestuft."
    }
  ]
}

OUTPUT RULES:
- Sort findings: critical first, then important, then minor.
- Tag each finding with "category" set to the originating agent's id. Never change a finding's category — it always matches the originating agent, even when adjusting severity.
- If a finding has additional fields (e.g. wcagCriterion), pass them through unchanged.
- Write a concise German summary, e.g. "3 Auffälligkeiten: 1 Kritisch, 1 Wichtig, 1 Gering".
- For every input finding, add a decision entry explaining what you did with it.

If no findings survive filtering, return an empty findings array with decisions and summary "Keine Auffälligkeiten".`;
}

function buildConsolidatorPrompt(agentResults, diff) {
  return `<pr_diff>\n${diff}\n</pr_diff>\n\n<agent_findings>\n${JSON.stringify(agentResults)}\n</agent_findings>\n\nFollow your thinking process step by step: OVERLAP, GROUNDING, QUALITY GATE, SEVERITY CHECK.`;
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

function describeConsolidation(agentResults, consolidated) {
  const inputCount = agentResults.reduce((sum, r) => sum + r.findings.length, 0);
  const outputCount = consolidated.findings?.length ?? 0;
  const removed = inputCount - outputCount;
  if (removed === 0) return `${inputCount} Findings übernommen`;
  return `${inputCount} Findings geprüft, ${removed} gefiltert, ${outputCount} übernommen`;
}

async function runReview(diff, jiraTicket, emit, { vertexAi, enabledAgents, projectRules } = {}) {
  const warnings = [];
  const processedDiff = preprocessDiff(diff);

  const enabledFromSettings = AGENT_REGISTRY.filter(a => enabledAgents.includes(a.id));
  const applicableAgents = enabledFromSettings.filter(
    a => !a.isApplicable || a.isApplicable(jiraTicket)
  );

  const skipped = enabledFromSettings.filter(a => a.isApplicable && !a.isApplicable(jiraTicket));
  for (const agent of skipped) {
    if (agent.skipMessage) {
      emit('warning', { message: agent.skipMessage });
      warnings.push(agent.skipMessage);
    }
  }

  const agentResults = await Promise.all(
    applicableAgents.map(agent => {
      emit('agent:start', {
        agent: agent.id,
        label: agent.label,
        temperature: agent.temperature,
        thinkingBudget: agent.thinkingBudget,
      });
      const start = Date.now();
      return callAi(
        agent.buildUserPrompt(processedDiff, jiraTicket),
        agent.buildSystemPrompt(projectRules),
        {
          temperature: agent.temperature,
          maxOutputTokens: 65536,
          thinkingConfig: { thinkingBudget: agent.thinkingBudget, includeThoughts: true },
          responseSchema: agent.responseSchema,
        },
        { vertexAi },
      )
        .then(({ result, thoughts }) => {
          emit('agent:done', {
            agent: agent.id,
            duration: Date.now() - start,
            findingCount: result.findings.length,
            summary: describeFindings(result.findings),
            thoughts,
            rawResponse: result,
          });
          return { id: agent.id, label: agent.label, findings: result.findings };
        })
        .catch(err => {
          emit('agent:error', { agent: agent.id, error: err.message });
          warnings.push(`Agent (${agent.label}) fehlgeschlagen: ${err.message}`);
          return { id: agent.id, label: agent.label, findings: [] };
        });
    })
  );

  const hasFindings = agentResults.some(r => r.findings.length > 0);
  if (!hasFindings) {
    emit('done', {});
    return;
  }

  emit('consolidator:start', { temperature: 0.2, thinkingBudget: 16384 });
  const consolStart = Date.now();

  const { result: consolidated, thoughts: consolidatorThoughts } = await callAi(
    buildConsolidatorPrompt(agentResults, processedDiff),
    buildConsolidatorSystemPrompt(projectRules),
    {
      temperature: 0.2,
      maxOutputTokens: 65536,
      thinkingConfig: { thinkingBudget: 16384, includeThoughts: true },
      responseSchema: CONSOLIDATOR_SCHEMA,
    },
    { vertexAi },
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
    summary: describeConsolidation(agentResults, consolidated),
    rawResponse: consolidated,
  });

  emit('done', {});
}

module.exports = { callAi, preprocessDiff, runReview };
