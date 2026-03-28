const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const children = [];

function cleanup() {
  for (const child of children) {
    try {
      child.kill();
    } catch (_) {}
  }
}

function fail(err) {
  console.error(`❌ Smoke test failed: ${err.message}`);
  cleanup();
  process.exit(1);
}

function waitForPort(port, retries = 20, delay = 300) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      const req = http.get(`http://localhost:${port}/`, () => {
        resolve();
      });
      req.on('error', () => {
        if (remaining <= 0) {
          reject(new Error(`Port ${port} did not become ready`));
          return;
        }
        setTimeout(() => attempt(remaining - 1), delay);
      });
      req.end();
    };
    attempt(retries);
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const mockServer = spawn('node', ['mock-server/jira.js'], { cwd: ROOT, stdio: 'pipe' });
  children.push(mockServer);
  mockServer.on('exit', (code) => { if (code !== null && code !== 0) fail(new Error(`mock-server exited with code ${code}`)); });

  const mockBitbucket = spawn('node', ['mock-server/bitbucket.js'], { cwd: ROOT, stdio: 'pipe' });
  children.push(mockBitbucket);
  mockBitbucket.on('exit', (code) => { if (code !== null && code !== 0) fail(new Error(`mock-bitbucket exited with code ${code}`)); });

  const server = spawn('node', ['server/index.js'], {
    cwd: ROOT,
    stdio: 'pipe',
    env: {
      ...process.env,
      JIRA_BASE_URL: 'http://localhost:6202',
      JIRA_API_KEY: 'smoke-test-token',
      BITBUCKET_BASE_URL: 'http://localhost:6203',
      BITBUCKET_API_KEY: 'smoke-test-token',
      BITBUCKET_USER_SLUG: 'dominik.mueller',
    },
  });
  children.push(server);
  server.on('exit', (code) => { if (code !== null && code !== 0) fail(new Error(`server exited with code ${code}`)); });

  try {
    await Promise.all([waitForPort(6202), waitForPort(6203), waitForPort(6201)]);

    const url =
      'http://localhost:6201/jira/rest/api/2/search?jql=assignee%20%3D%20currentUser()%20AND%20statusCategory%20%3D%20%22In%20Progress%22';
    const { status, data } = await get(url);

    if (status !== 200) {
      throw new Error(`Expected status 200, got ${status}`);
    }

    if (!Array.isArray(data.issues)) {
      throw new Error(`Response missing "issues" array`);
    }

    if (data.issues.length < 1) {
      throw new Error(`Expected at least 1 issue, got ${data.issues.length}`);
    }

    const bbUrl = 'http://localhost:6201/bitbucket/rest/api/latest/dashboard/pull-requests?role=REVIEWER&state=OPEN&limit=50';
    const { status: bbStatus, data: bbData } = await get(bbUrl);

    if (bbStatus !== 200) {
      throw new Error(`Bitbucket: Expected status 200, got ${bbStatus}`);
    }

    if (!Array.isArray(bbData.values)) {
      throw new Error(`Bitbucket: Response missing "values" array`);
    }

    if (bbData.values.length < 1) {
      throw new Error(`Bitbucket: Expected at least 1 PR, got ${bbData.values.length}`);
    }

    console.log('✅ Smoke test passed');
    cleanup();
    process.exit(0);
  } catch (err) {
    fail(err);
  }
}

process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(1);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(1);
});

run();
