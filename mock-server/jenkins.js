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
  47: '<b>User Auth Feature</b> — alle Tests bestanden',
  312: '<b>Develop Build</b> — nightly',
  156: '<b>Backend Develop</b> — nightly',
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
  312: [
    { id: '6', name: 'Checkout', status: 'SUCCESS', startTimeMillis: now - 3 * hour, durationMillis: 2900 },
    { id: '14', name: 'Build', status: 'SUCCESS', startTimeMillis: now - 3 * hour + 2900, durationMillis: 100000 },
    { id: '27', name: 'Test', status: 'SUCCESS', startTimeMillis: now - 3 * hour + 102900, durationMillis: 65000 },
    { id: '45', name: 'Deploy', status: 'SUCCESS', startTimeMillis: now - 3 * hour + 167900, durationMillis: 30100 },
  ],
  47: [
    { id: '6', name: 'Checkout', status: 'SUCCESS', startTimeMillis: now - 30 * minute, durationMillis: 3000 },
    { id: '14', name: 'Build', status: 'SUCCESS', startTimeMillis: now - 30 * minute + 3000, durationMillis: 105000 },
    { id: '27', name: 'Test', status: 'SUCCESS', startTimeMillis: now - 30 * minute + 108000, durationMillis: 72000 },
    { id: '45', name: 'Deploy', status: 'SUCCESS', startTimeMillis: now - 30 * minute + 180000, durationMillis: 30000 },
  ],
  89: [
    { id: '6', name: 'Checkout', status: 'SUCCESS', startTimeMillis: now - 2 * hour, durationMillis: 3500 },
    { id: '14', name: 'Build', status: 'SUCCESS', startTimeMillis: now - 2 * hour + 3500, durationMillis: 150000 },
    { id: '27', name: 'Test', status: 'SUCCESS', startTimeMillis: now - 2 * hour + 153500, durationMillis: 100000 },
    { id: '45', name: 'Deploy', status: 'SUCCESS', startTimeMillis: now - 2 * hour + 253500, durationMillis: 58500 },
  ],
  156: [
    { id: '6', name: 'Checkout', status: 'SUCCESS', startTimeMillis: now - 5 * hour, durationMillis: 3200 },
    { id: '14', name: 'Build', status: 'SUCCESS', startTimeMillis: now - 5 * hour + 3200, durationMillis: 140000 },
    { id: '27', name: 'Test', status: 'SUCCESS', startTimeMillis: now - 5 * hour + 143200, durationMillis: 95000 },
    { id: '45', name: 'Deploy', status: 'SUCCESS', startTimeMillis: now - 5 * hour + 238200, durationMillis: 41800 },
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
    text: '<span class="pipeline-node-31">09:08:41 [2026-03-30T07:08:41.003Z] [336/338] [chromium] \u001b[31m› libs/storybook-host/docs/components/table-footer/table-footer.e2e.ts:3:5 › TableFooter Default Test ---\u001b[0m\n09:08:41 [2026-03-30T07:08:41.120Z] [337/338] [chromium] \u001b[31m› libs/storybook-host/docs/components/login/login.e2e.ts:12:5 › Login › should validate email\u001b[0m\n09:08:42 [2026-03-30T07:08:42.450Z]\n09:08:42 [2026-03-30T07:08:42.451Z]   \u001b[31m1) Login › should validate email\u001b[0m\n09:08:42 [2026-03-30T07:08:42.452Z]     Expected: true\n09:08:42 [2026-03-30T07:08:42.453Z]     Received: false\n09:08:42 [2026-03-30T07:08:42.454Z]\n09:08:42 [2026-03-30T07:08:42.455Z]     at Object.<anonymous> (libs/storybook-host/docs/components/login/login.e2e.ts:42:18)\n09:08:43 [2026-03-30T07:08:43.100Z]\n09:08:43 [2026-03-30T07:08:43.101Z]   \u001b[31m338 passed, 2 failed\u001b[0m\n</span>',
  },
  '31_23': {
    nodeId: '31', nodeStatus: 'FAILED', length: 520, hasMore: false,
    text: '<span class="pipeline-node-31">14:22:10 [2026-03-30T12:22:10.200Z] \u001b[31m[ERROR]\u001b[0m Tests run: 15, Failures: 2, Errors: 0\n14:22:10 [2026-03-30T12:22:10.300Z] \u001b[31mFailed tests:\u001b[0m\n14:22:10 [2026-03-30T12:22:10.400Z]   CacheServiceTest.testEviction\n14:22:10 [2026-03-30T12:22:10.500Z]   CacheServiceTest.testConcurrentAccess\n</span>',
  },
};

const CONSOLE_LOG = `[2026-03-30T07:05:00.100Z] \u001b[36m[Pipeline]\u001b[0m Start of Pipeline
[2026-03-30T07:05:00.200Z] \u001b[36m[Pipeline]\u001b[0m node
[2026-03-30T07:05:00.300Z] Running on Jenkins in /var/jenkins_home/workspace/frontend-app/main
[2026-03-30T07:05:00.400Z] \u001b[36m[Pipeline]\u001b[0m {
[2026-03-30T07:05:00.500Z] \u001b[36m[Pipeline]\u001b[0m stage
[2026-03-30T07:05:00.600Z] \u001b[36m[Pipeline]\u001b[0m { (Checkout)
[2026-03-30T07:05:01.100Z] \u001b[32m[Checkout]\u001b[0m Cloning repository https://bitbucket.example.com/scm/VF/frontend-app.git
[2026-03-30T07:05:02.200Z] \u001b[32m[Checkout]\u001b[0m > git fetch --tags --progress
[2026-03-30T07:05:03.300Z] \u001b[32m[Checkout]\u001b[0m Checking out Revision abc123def456
[2026-03-30T07:05:03.400Z] \u001b[36m[Pipeline]\u001b[0m }
[2026-03-30T07:05:03.500Z] \u001b[36m[Pipeline]\u001b[0m stage
[2026-03-30T07:05:03.600Z] \u001b[36m[Pipeline]\u001b[0m { (Build)
[2026-03-30T07:05:03.700Z] \u001b[1m> npm ci\u001b[0m
[2026-03-30T07:05:48.800Z] added 1523 packages in 45s
[2026-03-30T07:05:48.900Z] \u001b[1m> npm run build\u001b[0m
[2026-03-30T07:06:27.100Z] \u001b[32m✓ Built successfully in 38.2s\u001b[0m
[2026-03-30T07:06:27.200Z] \u001b[36m[Pipeline]\u001b[0m }
[2026-03-30T07:06:27.300Z] \u001b[36m[Pipeline]\u001b[0m stage
[2026-03-30T07:06:27.400Z] \u001b[36m[Pipeline]\u001b[0m { (Test)
[2026-03-30T07:06:27.500Z] \u001b[1m> npm test\u001b[0m
[2026-03-30T07:07:12.100Z] \u001b[32m PASS \u001b[0m src/app/app.spec.ts
[2026-03-30T07:07:25.200Z] \u001b[32m PASS \u001b[0m src/app/shared/utils.spec.ts
[2026-03-30T07:07:38.300Z] \u001b[32m PASS \u001b[0m src/app/dashboard/dashboard.spec.ts
[2026-03-30T07:07:52.400Z] \u001b[32m PASS \u001b[0m src/app/auth/auth.service.spec.ts
[2026-03-30T07:07:52.500Z]
[2026-03-30T07:07:52.600Z] Test Suites: \u001b[32m4 passed\u001b[0m, 4 total
[2026-03-30T07:07:52.700Z] Tests:       \u001b[32m23 passed\u001b[0m, 23 total
[2026-03-30T07:07:52.800Z] \u001b[36m[Pipeline]\u001b[0m }
[2026-03-30T07:07:52.900Z] \u001b[36m[Pipeline]\u001b[0m stage
[2026-03-30T07:07:53.000Z] \u001b[36m[Pipeline]\u001b[0m { (Deploy)
[2026-03-30T07:07:53.100Z] Deploying to staging.example.com...
[2026-03-30T07:08:21.200Z] \u001b[32mDeployment successful\u001b[0m
[2026-03-30T07:08:21.300Z] \u001b[36m[Pipeline]\u001b[0m }
[2026-03-30T07:08:21.400Z] \u001b[36m[Pipeline]\u001b[0m End of Pipeline
[2026-03-30T07:08:21.500Z] \u001b[32mFinished: SUCCESS\u001b[0m
`;

const CONSOLE_LOG_FAILED = `[2026-03-30T07:05:00.100Z] \u001b[36m[Pipeline]\u001b[0m Start of Pipeline
[2026-03-30T07:05:00.200Z] \u001b[36m[Pipeline]\u001b[0m node
[2026-03-30T07:05:00.300Z] \u001b[36m[Pipeline]\u001b[0m { (Checkout)
[2026-03-30T07:05:01.100Z] \u001b[32m[Checkout]\u001b[0m Cloning repository...
[2026-03-30T07:05:03.400Z] \u001b[36m[Pipeline]\u001b[0m }
[2026-03-30T07:05:03.500Z] \u001b[36m[Pipeline]\u001b[0m { (Build)
[2026-03-30T07:05:03.600Z] \u001b[1m> npm ci\u001b[0m
[2026-03-30T07:05:45.700Z] added 1523 packages in 42s
[2026-03-30T07:05:45.800Z] \u001b[1m> npm run build\u001b[0m
[2026-03-30T07:06:24.900Z] \u001b[32m✓ Built successfully\u001b[0m
[2026-03-30T07:06:25.000Z] \u001b[36m[Pipeline]\u001b[0m }
[2026-03-30T07:06:25.100Z] \u001b[36m[Pipeline]\u001b[0m { (Test)
[2026-03-30T07:06:25.200Z] \u001b[1m> npm test\u001b[0m
[2026-03-30T07:07:10.300Z] \u001b[32m PASS \u001b[0m src/app/app.spec.ts
[2026-03-30T07:07:23.400Z] \u001b[32m PASS \u001b[0m src/app/shared/utils.spec.ts
[2026-03-30T07:07:36.500Z] \u001b[31m FAIL \u001b[0m src/app/login.spec.ts
[2026-03-30T07:07:36.600Z]   \u001b[31m● Login component › should validate email\u001b[0m
[2026-03-30T07:07:36.700Z]
[2026-03-30T07:07:36.800Z]     expect(received).toBe(expected)
[2026-03-30T07:07:36.900Z]
[2026-03-30T07:07:37.000Z]     Expected: true
[2026-03-30T07:07:37.100Z]     Received: false
[2026-03-30T07:07:37.200Z]
[2026-03-30T07:07:37.300Z]       40 |   it('should validate email', () => {
[2026-03-30T07:07:37.400Z]       41 |     const result = component.validateEmail('invalid');
[2026-03-30T07:07:37.500Z]     \u001b[31m> 42 |     expect(result).toBe(true);\u001b[0m
[2026-03-30T07:07:37.600Z]       43 |   });
[2026-03-30T07:07:37.700Z]
[2026-03-30T07:07:37.800Z] \u001b[31mTest Suites: 1 failed\u001b[0m, 2 passed, 3 total
[2026-03-30T07:07:37.900Z] \u001b[31mTests:       1 failed\u001b[0m, 22 passed, 23 total
[2026-03-30T07:07:38.000Z] \u001b[31mERROR: npm test returned exit code 1\u001b[0m
[2026-03-30T07:07:38.100Z] \u001b[36m[Pipeline]\u001b[0m }
[2026-03-30T07:07:38.200Z] \u001b[31mFinished: FAILURE\u001b[0m
`;

const PARAMETER_DEFINITIONS = [
  { name: 'DEPLOY_ENV', type: 'ChoiceParameterDefinition', description: 'Target environment', defaultParameterValue: { value: 'staging' }, choices: ['staging', 'production'] },
  { name: 'DRY_RUN', type: 'BooleanParameterDefinition', description: 'Skip actual deployment', defaultParameterValue: { value: true } },
  { name: 'VERSION', type: 'StringParameterDefinition', description: 'Version to deploy (leave empty for latest)', defaultParameterValue: { value: '' } },
  { name: 'RELEASE_NOTES', type: 'TextParameterDefinition', description: 'Release notes for this deployment', defaultParameterValue: { value: '' } },
  { name: 'SECRET_KEY', type: 'PasswordParameterDefinition', description: 'Deployment secret', defaultParameterValue: { value: '' } },
];

function getBuilds(jobName, branchName) {
  return BUILDS[jobName]?.[branchName] || [];
}

function parseRequest(rawUrl) {
  const [pathPart] = rawUrl.split('?');
  const m = pathPart.match(/^\/job\/([^/]+)\/job\/(.+)/);
  if (!m) return null;
  const jobName = decodeURIComponent(m[1]);
  const rest = m[2];

  const endpointMarkers = ['/api/json', '/wfapi/', '/consoleText', '/logText/', '/execution/', '/buildWithParameters', '/build', '/stop'];
  let splitIdx = rest.length;
  for (const marker of endpointMarkers) {
    const idx = rest.indexOf(marker);
    if (idx !== -1 && idx < splitIdx) splitIdx = idx;
  }

  let branchPart = rest.substring(0, splitIdx);
  const endpointPart = rest.substring(splitIdx);

  let buildNumber = null;
  const buildMatch = branchPart.match(/^(.+?)\/(\d+)$/);
  if (buildMatch) {
    branchPart = buildMatch[1];
    buildNumber = parseInt(buildMatch[2]);
  }

  return {
    jobName,
    branch: decodeURIComponent(branchPart),
    buildNumber,
    endpoint: endpointPart,
  };
}

const CONFIG_XML = `<?xml version="1.0" encoding="UTF-8"?>
<org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject>
  <sources class="jenkins.branch.MultiBranchProject$BranchSourceList">
    <data>
      <jenkins.branch.BranchSource>
        <source class="jenkins.plugins.git.GitSCMSource">
          <remote>ssh://git@localhost:7999/proj/my-repo.git</remote>
          <traits>
            <jenkins.plugins.git.traits.GitBrowserSCMSourceTrait>
              <browser class="hudson.plugins.git.browser.BitbucketServer">
                <url>http://localhost:6203/projects/PROJ/repos/my-repo/</url>
              </browser>
            </jenkins.plugins.git.traits.GitBrowserSCMSourceTrait>
          </traits>
        </source>
      </jenkins.branch.BranchSource>
    </data>
  </sources>
  <factory class="org.jenkinsci.plugins.workflow.multibranch.WorkflowBranchProjectFactory">
    <scriptPath>Jenkinsfile</scriptPath>
  </factory>
</org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject>`;

app.get('/job/:jobName/config.xml', (_req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.send(CONFIG_XML);
});

app.use((req, res, next) => {
  if (!req.path.startsWith('/job/')) return next();

  const jobListMatch = req.path.match(/^\/job\/([^/]+)\/api\/json$/);
  if (jobListMatch) {
    const jobName = decodeURIComponent(jobListMatch[1]);
    const branches = BRANCHES[jobName] || [];
    return res.json({
      jobs: branches.map(b => ({
        name: encodeURIComponent(b.name),
        color: b.color,
        url: `http://localhost:${PORT}/job/${jobName}/job/${encodeURIComponent(b.name)}/`,
      })),
    });
  }

  const parsed = parseRequest(req.originalUrl);
  if (!parsed) return next();

  const { jobName, branch, buildNumber, endpoint } = parsed;
  const builds = getBuilds(jobName, branch);
  const tree = req.query.tree || '';

  if (endpoint.startsWith('/api/json') || endpoint === '') {
    if (buildNumber) {
      const build = builds.find(b => b.number === buildNumber);
      if (!build) return res.status(404).json({ error: 'Build not found' });
      return res.json({
        ...build,
        description: DESCRIPTIONS[build.number] || null,
        estimatedDuration: 240000,
        url: `http://localhost:${PORT}/job/${jobName}/job/${encodeURIComponent(branch)}/${build.number}/`,
        actions: [
          { _class: 'hudson.model.ParametersAction', parameters: [{ name: 'DEPLOY_ENV', value: 'staging' }] },
          { _class: 'hudson.model.CauseAction' },
        ],
      });
    }

    if (tree.includes('property')) {
      return res.json({ property: [{ parameterDefinitions: PARAMETER_DEFINITIONS }] });
    }

    if (tree.includes('builds')) {
      return res.json({ builds: builds.map(b => ({ ...b, url: `http://localhost:${PORT}/job/${jobName}/job/${encodeURIComponent(branch)}/${b.number}/` })) });
    }

    const build = builds[0];
    if (!build) return res.status(404).json({ error: 'No builds' });
    return res.json({
      ...build,
      description: DESCRIPTIONS[build.number] || null,
      estimatedDuration: 240000,
      url: `http://localhost:${PORT}/job/${jobName}/job/${encodeURIComponent(branch)}/${build.number}/`,
      actions: [
        { _class: 'hudson.model.ParametersAction', parameters: [{ name: 'DEPLOY_ENV', value: 'staging' }, { name: 'DRY_RUN', value: 'false' }] },
        { _class: 'hudson.model.CauseAction' },
      ],
    });
  }

  if (endpoint.includes('/wfapi/describe') && !endpoint.includes('/execution/')) {
    const bn = buildNumber || builds[0]?.number;
    const stages = STAGES[bn];
    if (!stages) return res.json({ id: String(bn), name: `#${bn}`, status: 'SUCCESS', stages: [] });

    const overallStatus = stages.some(s => s.status === 'FAILED') ? 'FAILED'
      : stages.some(s => s.status === 'IN_PROGRESS') ? 'IN_PROGRESS' : 'SUCCESS';

    return res.json({
      id: String(bn),
      name: `#${bn}`,
      status: overallStatus,
      startTimeMillis: stages[0].startTimeMillis,
      durationMillis: stages.reduce((sum, s) => sum + s.durationMillis, 0),
      stages: stages.map(s => ({ ...s, execNode: '' })),
    });
  }

  if (endpoint.includes('/execution/node/') && endpoint.includes('/wfapi/describe')) {
    const nodeMatch = endpoint.match(/\/execution\/node\/(\d+)\/wfapi\/describe/);
    if (nodeMatch) {
      const nodeId = nodeMatch[1];
      const bn = buildNumber || builds[0]?.number;
      const key = `${nodeId}_${bn}`;
      const flowNodes = STAGE_FLOW_NODES[key];
      if (!flowNodes) return res.json({ id: nodeId, name: 'Unknown', status: 'SUCCESS', stageFlowNodes: [] });
      return res.json({ id: nodeId, name: 'Test', status: 'FAILED', stageFlowNodes: flowNodes });
    }
  }

  if (endpoint.includes('/execution/node/') && endpoint.includes('/wfapi/log')) {
    const nodeMatch = endpoint.match(/\/execution\/node\/(\d+)\/wfapi\/log/);
    if (nodeMatch) {
      const nodeId = nodeMatch[1];
      const bn = buildNumber || builds[0]?.number;
      const key = `${nodeId}_${bn}`;
      const log = STAGE_LOGS[key];
      if (!log) return res.json({ nodeId, nodeStatus: 'SUCCESS', length: 0, hasMore: false, text: '' });
      return res.json(log);
    }
  }

  if (endpoint.includes('/consoleText')) {
    const bn = buildNumber || builds[0]?.number;
    const build = builds.find(b => b.number === bn);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(build?.result === 'FAILURE' ? CONSOLE_LOG_FAILED : CONSOLE_LOG);
  }

  if (endpoint.includes('/logText/progressiveText')) {
    const start = parseInt(req.query.start || '0');
    const bn = buildNumber || builds[0]?.number;
    const build = builds.find(b => b.number === bn);
    const fullLog = build?.result === 'FAILURE' ? CONSOLE_LOG_FAILED : CONSOLE_LOG;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (start >= fullLog.length) {
      res.setHeader('X-Text-Size', String(fullLog.length));
      res.setHeader('X-More-Data', build?.building ? 'true' : 'false');
      return res.send('');
    }
    res.setHeader('X-Text-Size', String(fullLog.length));
    res.setHeader('X-More-Data', build?.building ? 'true' : 'false');
    return res.send(fullLog.substring(start));
  }

  if (req.method === 'POST' && (endpoint.includes('/build') || endpoint.includes('/buildWithParameters'))) {
    return res.status(201).setHeader('Location', `http://localhost:${PORT}/queue/item/12345/`).send();
  }

  if (req.method === 'POST' && endpoint.includes('/stop')) {
    return res.sendStatus(200);
  }

  res.status(404).json({ error: 'Unknown endpoint' });
});

app.listen(PORT, () => {
  console.log(`Jenkins mock server running at http://localhost:${PORT}`);
});
