const { callAi } = require('./ai');

const repoMappingCache = new Map();

const BUILD_ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    cause: {
      type: 'STRING',
      description: 'Fehlerursache, 1-2 Sätze, extrem prägnant mit technischen Details',
    },
    solution: {
      type: 'STRING',
      description: 'Lösungsvorschlag, konkret und direkt umsetzbar',
    },
    evidence: {
      type: 'OBJECT',
      properties: {
        source: {
          type: 'STRING',
          enum: ['stage-log', 'jenkinsfile'],
          description: 'Woher der Beleg stammt',
        },
        snippet: {
          type: 'STRING',
          description: 'Relevanter Ausschnitt, wenige Zeilen',
        },
      },
      required: ['source', 'snippet'],
      propertyOrdering: ['source', 'snippet'],
    },
  },
  required: ['cause', 'solution', 'evidence'],
  propertyOrdering: ['cause', 'solution', 'evidence'],
};

function buildSystemPrompt(hasJenkinsfile) {
  const context = hasJenkinsfile
    ? 'Du erhältst das Jenkinsfile einer Pipeline und das Log einer fehlgeschlagenen Stage.'
    : 'Du erhältst das Log einer fehlgeschlagenen Stage. Das Jenkinsfile war nicht verfügbar.';

  return `Du bist ein Build-Fehler-Analyst. ${context} Analysiere die Fehlerursache.

Regeln:
- Fehlerursache: Maximal 1-2 Sätze. Extrem prägnant. Technische Details (Paketnamen, Pfade, Fehlercodes) einbauen.
- Lösungsvorschlag: Konkrete Handlungsanweisung, die der Entwickler sofort umsetzen kann. Kein "prüf ob..." sondern "mach X".
- Beleg: Exakt die relevanten Zeilen aus dem Log oder Jenkinsfile zitieren, nicht paraphrasieren. Wenige Zeilen, nur das Wesentliche.
- Sprache: Deutsch, informell (Du-Form).`;
}

function buildUserPrompt(jenkinsfile, stageName, stageLog) {
  let prompt = '';
  if (jenkinsfile) {
    prompt += `Jenkinsfile:\n---\n${jenkinsfile}\n---\n\n`;
  }
  prompt += `Fehlgeschlagene Stage: "${stageName}"\nStage-Log:\n---\n${stageLog}\n---`;
  return prompt;
}

function parseRepoMapping(configXml) {
  const browserUrlMatch = configXml.match(/<browser class="[^"]*BitbucketServer">\s*<url>([^<]+)<\/url>/);
  const scriptPathMatch = configXml.match(/<scriptPath>([^<]+)<\/scriptPath>/);

  if (!browserUrlMatch) return null;

  const browserUrl = browserUrlMatch[1];
  const repoMatch = browserUrl.match(/\/projects\/([^/]+)\/repos\/([^/]+)/);
  if (!repoMatch) return null;

  return {
    project: repoMatch[1],
    repo: repoMatch[2],
    scriptPath: scriptPathMatch ? scriptPathMatch[1] : 'Jenkinsfile',
  };
}

async function fetchRepoMapping(jobPath, { getSettings }) {
  if (repoMappingCache.has(jobPath)) {
    return repoMappingCache.get(jobPath);
  }

  const s = getSettings();
  const jenkins = s?.connections?.jenkins;
  if (!jenkins?.baseUrl) return null;

  const { username, apiToken, baseUrl } = jenkins;
  const auth = Buffer.from(`${username}:${apiToken}`).toString('base64');

  try {
    const url = `${baseUrl}/${jobPath}/config.xml`;
    console.log('[Build Analysis] Fetching config.xml:', url);
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.log('[Build Analysis] config.xml response:', response.status);
      return null;
    }
    const xml = await response.text();
    const mapping = parseRepoMapping(xml);
    console.log('[Build Analysis] Repo mapping:', mapping);
    if (mapping) {
      repoMappingCache.set(jobPath, mapping);
    }
    return mapping;
  } catch (err) {
    console.error('[Build Analysis] config.xml error:', err.message);
    return null;
  }
}

async function fetchJenkinsfile(mapping, branch, { getSettings }) {
  const s = getSettings();
  const bitbucket = s?.connections?.bitbucket;
  if (!bitbucket?.baseUrl) return null;

  const encodedPath = encodeURIComponent(mapping.scriptPath);
  const url = `${bitbucket.baseUrl}/rest/api/latest/projects/${mapping.project}/repos/${mapping.repo}/browse/${encodedPath}?at=refs/heads/${encodeURIComponent(branch)}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${bitbucket.apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.lines) {
      return data.lines.map(l => l.text).join('\n');
    }
    return null;
  } catch {
    return null;
  }
}

function stripControlChars(text) {
  return text
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

async function runBuildAnalysis({ jobPath, branch, failedStage, stageLog }, { getSettings }) {
  const s = getSettings();
  const vertexAi = s?.connections?.vertexAi;

  const mapping = await fetchRepoMapping(jobPath, { getSettings });
  let jenkinsfile = null;
  if (mapping) {
    jenkinsfile = await fetchJenkinsfile(mapping, branch, { getSettings });
  }

  const cleanLog = stripControlChars(stageLog);
  const systemPrompt = buildSystemPrompt(!!jenkinsfile);
  const userPrompt = buildUserPrompt(jenkinsfile, failedStage.name, cleanLog);

  const { result } = await callAi(userPrompt, systemPrompt, {
    temperature: 0.2,
    maxOutputTokens: 8192,
    thinkingConfig: { thinkingBudget: 8192, includeThoughts: false },
    responseSchema: BUILD_ANALYSIS_SCHEMA,
  }, { vertexAi });

  return {
    ...result,
    jenkinsfileAvailable: !!jenkinsfile,
  };
}

module.exports = { runBuildAnalysis, parseRepoMapping };
