const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 6204;

app.use(cors());
app.use(express.json());

const MOCK_DELAY = parseInt(process.env.MOCK_DELAY ?? '300', 10);
app.use((_req, _res, next) => {
  setTimeout(next, MOCK_DELAY);
});

const BRANCHES = {
  'frontend-app': [
    { name: 'main', color: 'blue' },
    { name: 'develop', color: 'blue' },
    { name: 'feature/ORBIT-189-dashboard', color: 'red' },
    { name: 'feature/ORBIT-234-user-auth', color: 'blue' },
    { name: 'bugfix/ORBIT-301-login-fix', color: 'blue_anime' },
  ],
  'backend-api': [
    { name: 'main', color: 'blue' },
    { name: 'develop', color: 'blue' },
    { name: 'feature/ORBIT-210-api-cache', color: 'red' },
  ],
};

const now = Date.now();
const hour = 3600000;
const minute = 60000;

const BUILDS = {
  'frontend-app': {
    'main': [
      { number: 142, result: 'SUCCESS', timestamp: now - 12 * minute, duration: 245832, building: false },
      { number: 141, result: 'FAILURE', timestamp: now - 2 * hour, duration: 89234, building: false },
    ],
    'develop': [
      { number: 312, result: 'SUCCESS', timestamp: now - 3 * hour, duration: 198000, building: false },
    ],
    'feature/ORBIT-189-dashboard': [
      { number: 45, result: 'FAILURE', timestamp: now - 1 * hour, duration: 178000, building: false },
    ],
    'feature/ORBIT-234-user-auth': [
      { number: 47, result: 'SUCCESS', timestamp: now - 30 * minute, duration: 210000, building: false },
    ],
    'bugfix/ORBIT-301-login-fix': [
      { number: 48, result: null, timestamp: now - 4 * minute, duration: 0, building: true },
    ],
  },
  'backend-api': {
    'main': [
      { number: 89, result: 'SUCCESS', timestamp: now - 2 * hour, duration: 312000, building: false },
    ],
    'develop': [
      { number: 156, result: 'SUCCESS', timestamp: now - 5 * hour, duration: 280000, building: false },
    ],
    'feature/ORBIT-210-api-cache': [
      { number: 23, result: 'FAILURE', timestamp: now - 45 * minute, duration: 95000, building: false },
    ],
  },
};

const DESCRIPTIONS = {
  142: '<b>Release 2.4.1</b> — deployed to <a href="https://staging.example.com">staging.example.com</a>',
  45: '<b>Dashboard Feature</b> — Test-Fehler in login.spec.ts',
  89: '<b>API v3.1.0</b> — deployed to <a href="https://api-staging.example.com">api-staging</a>',
};

const STAGES = {
  142: [
    { id: '6', name: 'Checkout', status: 'SUCCESS', startTimeMillis: now - 12 * minute, durationMillis: 3200 },
    { id: '14', name: 'Build', status: 'SUCCESS', startTimeMillis: now - 12 * minute + 3200, durationMillis: 120000 },
    { id: '27', name: 'Test', status: 'SUCCESS', startTimeMillis: now - 12 * minute + 123200, durationMillis: 85000 },
    { id: '45', name: 'Deploy', status: 'SUCCESS', startTimeMillis: now - 12 * minute + 208200, durationMillis: 37632 },
  ],
  45: [
    { id: '6', name: 'Checkout', status: 'SUCCESS', startTimeMillis: now - 1 * hour, durationMillis: 2800 },
    { id: '14', name: 'Build', status: 'SUCCESS', startTimeMillis: now - 1 * hour + 2800, durationMillis: 95000 },
    { id: '27', name: 'Test', status: 'FAILED', startTimeMillis: now - 1 * hour + 97800, durationMillis: 73000 },
    { id: '45', name: 'Deploy', status: 'NOT_EXECUTED', startTimeMillis: now - 1 * hour + 170800, durationMillis: 0 },
  ],
  48: [
    { id: '6', name: 'Checkout', status: 'SUCCESS', startTimeMillis: now - 4 * minute, durationMillis: 3100 },
    { id: '14', name: 'Build', status: 'SUCCESS', startTimeMillis: now - 4 * minute + 3100, durationMillis: 110000 },
    { id: '27', name: 'Test', status: 'IN_PROGRESS', startTimeMillis: now - 4 * minute + 113100, durationMillis: 0 },
    { id: '45', name: 'Deploy', status: 'NOT_EXECUTED', startTimeMillis: 0, durationMillis: 0 },
  ],
  23: [
    { id: '6', name: 'Checkout', status: 'SUCCESS', startTimeMillis: now - 45 * minute, durationMillis: 2500 },
    { id: '14', name: 'Build', status: 'SUCCESS', startTimeMillis: now - 45 * minute + 2500, durationMillis: 60000 },
    { id: '27', name: 'Test', status: 'FAILED', startTimeMillis: now - 45 * minute + 62500, durationMillis: 32500 },
    { id: '45', name: 'Deploy', status: 'NOT_EXECUTED', startTimeMillis: 0, durationMillis: 0 },
  ],
};

const STAGE_FLOW_NODES = {
  '27_45': [
    { id: '28', name: 'Shell Script', status: 'SUCCESS', parameterDescription: 'npm run lint', durationMillis: 12000, parentNodes: ['27'] },
    { id: '31', name: 'Shell Script', status: 'FAILED', parameterDescription: 'npm test', durationMillis: 73000, parentNodes: ['28'], error: { message: 'script returned exit code 1', type: 'hudson.AbortException' } },
  ],
  '27_23': [
    { id: '28', name: 'Shell Script', status: 'SUCCESS', parameterDescription: 'mvn compile', durationMillis: 20000, parentNodes: ['27'] },
    { id: '31', name: 'Shell Script', status: 'FAILED', parameterDescription: 'mvn test', durationMillis: 12500, parentNodes: ['28'], error: { message: 'script returned exit code 1', type: 'hudson.AbortException' } },
  ],
};

const STAGE_LOGS = {
  '31_45': {
    nodeId: '31', nodeStatus: 'FAILED', length: 842, hasMore: false,
    text: '<span class="pipeline-node-31">\u001b[31mFAIL\u001b[0m src/app/login.spec.ts\n  \u001b[31m● Login component › should validate email\u001b[0m\n    Expected: true\n    Received: false\n\n    at Object.<anonymous> (src/app/login.spec.ts:42:18)\n</span>',
  },
  '31_23': {
    nodeId: '31', nodeStatus: 'FAILED', length: 520, hasMore: false,
    text: '<span class="pipeline-node-31">\u001b[31m[ERROR]\u001b[0m Tests run: 15, Failures: 2, Errors: 0\n\u001b[31mFailed tests:\u001b[0m\n  CacheServiceTest.testEviction\n  CacheServiceTest.testConcurrentAccess\n</span>',
  },
};

const CONSOLE_LOG = `\u001b[36m[Pipeline]\u001b[0m Start of Pipeline
\u001b[36m[Pipeline]\u001b[0m node
Running on Jenkins in /var/jenkins_home/workspace/frontend-app/main
\u001b[36m[Pipeline]\u001b[0m {
\u001b[36m[Pipeline]\u001b[0m stage
\u001b[36m[Pipeline]\u001b[0m { (Checkout)
\u001b[32m[Checkout]\u001b[0m Cloning repository https://bitbucket.example.com/scm/VF/frontend-app.git
\u001b[32m[Checkout]\u001b[0m > git fetch --tags --progress -- https://bitbucket.example.com/scm/VF/frontend-app.git
\u001b[32m[Checkout]\u001b[0m Checking out Revision abc123def456
\u001b[36m[Pipeline]\u001b[0m }
\u001b[36m[Pipeline]\u001b[0m stage
\u001b[36m[Pipeline]\u001b[0m { (Build)
\u001b[1m> npm ci\u001b[0m
added 1523 packages in 45s
\u001b[1m> npm run build\u001b[0m
\u001b[32mCompilation complete. Watching for file changes.\u001b[0m
\u001b[32m✓ Built successfully in 38.2s\u001b[0m
\u001b[36m[Pipeline]\u001b[0m }
\u001b[36m[Pipeline]\u001b[0m stage
\u001b[36m[Pipeline]\u001b[0m { (Test)
\u001b[1m> npm test\u001b[0m
\u001b[32m PASS \u001b[0m src/app/app.spec.ts
\u001b[32m PASS \u001b[0m src/app/shared/utils.spec.ts
\u001b[32m PASS \u001b[0m src/app/dashboard/dashboard.spec.ts
\u001b[32m PASS \u001b[0m src/app/auth/auth.service.spec.ts

Test Suites: \u001b[32m4 passed\u001b[0m, 4 total
Tests:       \u001b[32m23 passed\u001b[0m, 23 total
\u001b[36m[Pipeline]\u001b[0m }
\u001b[36m[Pipeline]\u001b[0m stage
\u001b[36m[Pipeline]\u001b[0m { (Deploy)
Deploying to staging.example.com...
\u001b[32mDeployment successful\u001b[0m
\u001b[36m[Pipeline]\u001b[0m }
\u001b[36m[Pipeline]\u001b[0m End of Pipeline
\u001b[32mFinished: SUCCESS\u001b[0m
`;

const CONSOLE_LOG_FAILED = `\u001b[36m[Pipeline]\u001b[0m Start of Pipeline
\u001b[36m[Pipeline]\u001b[0m node
\u001b[36m[Pipeline]\u001b[0m { (Checkout)
\u001b[32m[Checkout]\u001b[0m Cloning repository...
\u001b[36m[Pipeline]\u001b[0m }
\u001b[36m[Pipeline]\u001b[0m { (Build)
\u001b[1m> npm ci\u001b[0m
added 1523 packages in 42s
\u001b[1m> npm run build\u001b[0m
\u001b[32m✓ Built successfully\u001b[0m
\u001b[36m[Pipeline]\u001b[0m }
\u001b[36m[Pipeline]\u001b[0m { (Test)
\u001b[1m> npm test\u001b[0m
\u001b[32m PASS \u001b[0m src/app/app.spec.ts
\u001b[32m PASS \u001b[0m src/app/shared/utils.spec.ts
\u001b[31m FAIL \u001b[0m src/app/login.spec.ts
  \u001b[31m● Login component › should validate email\u001b[0m

    expect(received).toBe(expected)

    Expected: true
    Received: false

      40 |   it('should validate email', () => {
      41 |     const result = component.validateEmail('invalid');
    \u001b[31m> 42 |     expect(result).toBe(true);\u001b[0m
      43 |   });

\u001b[31mTest Suites: 1 failed\u001b[0m, 2 passed, 3 total
\u001b[31mTests:       1 failed\u001b[0m, 22 passed, 23 total
\u001b[31mERROR: npm test returned exit code 1\u001b[0m
\u001b[36m[Pipeline]\u001b[0m }
\u001b[31mFinished: FAILURE\u001b[0m
`;

const PARAMETER_DEFINITIONS = [
  { name: 'DEPLOY_ENV', type: 'ChoiceParameterDefinition', description: 'Target environment', defaultParameterValue: { value: 'staging' }, choices: ['staging', 'production'] },
  { name: 'DRY_RUN', type: 'BooleanParameterDefinition', description: 'Skip actual deployment', defaultParameterValue: { value: true } },
  { name: 'VERSION', type: 'StringParameterDefinition', description: 'Version to deploy (leave empty for latest)', defaultParameterValue: { value: '' } },
  { name: 'RELEASE_NOTES', type: 'TextParameterDefinition', description: 'Release notes for this deployment', defaultParameterValue: { value: '' } },
  { name: 'SECRET_KEY', type: 'PasswordParameterDefinition', description: 'Deployment secret', defaultParameterValue: { value: '' } },
];

function getBranch(jobName) {
  return BRANCHES[jobName] || [];
}

function getBuilds(jobName, branchName) {
  return BUILDS[jobName]?.[branchName] || [];
}

function getBuild(jobName, branchName, buildNumber) {
  const builds = getBuilds(jobName, branchName);
  return builds.find(b => b.number === buildNumber);
}

app.get('/job/:jobName/api/json', (req, res) => {
  const branches = getBranch(req.params.jobName);
  res.json({
    jobs: branches.map(b => ({
      name: encodeURIComponent(b.name),
      color: b.color,
      url: `http://localhost:${PORT}/job/${req.params.jobName}/job/${encodeURIComponent(b.name)}/`,
    })),
  });
});

app.get('/job/:jobName/job/:branch/api/json', (req, res) => {
  const { jobName, branch } = req.params;
  const builds = getBuilds(jobName, branch);
  const tree = req.query.tree || '';

  if (tree.includes('property')) {
    res.json({
      property: [{ parameterDefinitions: PARAMETER_DEFINITIONS }],
    });
    return;
  }

  if (tree.includes('builds')) {
    res.json({ builds: builds.map(b => ({ ...b, url: `http://localhost:${PORT}/job/${jobName}/job/${branch}/${b.number}/` })) });
    return;
  }

  const build = builds[0];
  if (!build) return res.status(404).json({ error: 'No builds' });

  res.json({
    ...build,
    description: DESCRIPTIONS[build.number] || null,
    estimatedDuration: 240000,
    url: `http://localhost:${PORT}/job/${jobName}/job/${branch}/${build.number}/`,
    actions: [
      { _class: 'hudson.model.ParametersAction', parameters: [{ name: 'DEPLOY_ENV', value: 'staging' }, { name: 'DRY_RUN', value: 'false' }] },
      { _class: 'hudson.model.CauseAction' },
    ],
  });
});

app.get('/job/:jobName/job/:branch/:buildNumber/api/json', (req, res) => {
  const { jobName, branch, buildNumber } = req.params;
  const build = getBuild(jobName, branch, parseInt(buildNumber));
  if (!build) return res.status(404).json({ error: 'Build not found' });

  res.json({
    ...build,
    description: DESCRIPTIONS[build.number] || null,
    estimatedDuration: 240000,
    url: `http://localhost:${PORT}/job/${jobName}/job/${branch}/${build.number}/`,
    actions: [
      { _class: 'hudson.model.ParametersAction', parameters: [{ name: 'DEPLOY_ENV', value: 'staging' }] },
      { _class: 'hudson.model.CauseAction' },
    ],
  });
});

app.get('/job/:jobName/job/:branch/:buildNumber/wfapi/describe', (req, res) => {
  const buildNumber = parseInt(req.params.buildNumber);
  const stages = STAGES[buildNumber];
  if (!stages) return res.json({ id: String(buildNumber), name: `#${buildNumber}`, status: 'SUCCESS', stages: [] });

  const overallStatus = stages.some(s => s.status === 'FAILED') ? 'FAILED'
    : stages.some(s => s.status === 'IN_PROGRESS') ? 'IN_PROGRESS' : 'SUCCESS';

  res.json({
    id: String(buildNumber),
    name: `#${buildNumber}`,
    status: overallStatus,
    startTimeMillis: stages[0].startTimeMillis,
    durationMillis: stages.reduce((sum, s) => sum + s.durationMillis, 0),
    stages: stages.map(s => ({ ...s, execNode: '' })),
  });
});

app.get('/job/:jobName/job/:branch/:buildNumber/execution/node/:nodeId/wfapi/describe', (req, res) => {
  const { buildNumber, nodeId } = req.params;
  const key = `${nodeId}_${buildNumber}`;
  const flowNodes = STAGE_FLOW_NODES[key];
  if (!flowNodes) return res.json({ id: nodeId, name: 'Unknown', status: 'SUCCESS', stageFlowNodes: [] });

  res.json({
    id: nodeId,
    name: 'Test',
    status: 'FAILED',
    stageFlowNodes: flowNodes,
  });
});

app.get('/job/:jobName/job/:branch/:buildNumber/execution/node/:nodeId/wfapi/log', (req, res) => {
  const { buildNumber, nodeId } = req.params;
  const key = `${nodeId}_${buildNumber}`;
  const log = STAGE_LOGS[key];
  if (!log) return res.json({ nodeId, nodeStatus: 'SUCCESS', length: 0, hasMore: false, text: '' });
  res.json(log);
});

app.get('/job/:jobName/job/:branch/:buildNumber/consoleText', (req, res) => {
  const buildNumber = parseInt(req.params.buildNumber);
  const build = Object.values(BUILDS).flatMap(job => Object.values(job).flat()).find(b => b.number === buildNumber);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  if (build?.result === 'FAILURE') {
    res.send(CONSOLE_LOG_FAILED);
  } else {
    res.send(CONSOLE_LOG);
  }
});

app.get('/job/:jobName/job/:branch/:buildNumber/logText/progressiveText', (req, res) => {
  const start = parseInt(req.query.start || '0');
  const buildNumber = parseInt(req.params.buildNumber);
  const build = Object.values(BUILDS).flatMap(job => Object.values(job).flat()).find(b => b.number === buildNumber);
  const fullLog = build?.result === 'FAILURE' ? CONSOLE_LOG_FAILED : CONSOLE_LOG;

  if (start >= fullLog.length) {
    res.setHeader('X-Text-Size', String(fullLog.length));
    res.setHeader('X-More-Data', build?.building ? 'true' : 'false');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send('');
  } else {
    const chunk = fullLog.substring(start);
    res.setHeader('X-Text-Size', String(fullLog.length));
    res.setHeader('X-More-Data', build?.building ? 'true' : 'false');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(chunk);
  }
});

app.post('/job/:jobName/job/:branch/build', (_req, res) => {
  res.status(201).setHeader('Location', `http://localhost:${PORT}/queue/item/12345/`).send();
});

app.post('/job/:jobName/job/:branch/buildWithParameters', (_req, res) => {
  res.status(201).setHeader('Location', `http://localhost:${PORT}/queue/item/12346/`).send();
});

app.post('/job/:jobName/job/:branch/:buildNumber/stop', (_req, res) => {
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Jenkins mock server running at http://localhost:${PORT}`);
});
