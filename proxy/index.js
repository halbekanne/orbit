require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');

const { JIRA_BASE_URL, JIRA_API_KEY, BITBUCKET_BASE_URL, BITBUCKET_API_KEY, BITBUCKET_USER_SLUG } = process.env;

if (!JIRA_BASE_URL || !JIRA_API_KEY || !BITBUCKET_BASE_URL || !BITBUCKET_API_KEY || !BITBUCKET_USER_SLUG) {
  console.error('ERROR: JIRA_BASE_URL, JIRA_API_KEY, BITBUCKET_BASE_URL, BITBUCKET_API_KEY and BITBUCKET_USER_SLUG must be set in .env');
  process.exit(1);
}

const app = express();
const PORT = 6201;

app.use(cors({ origin: 'http://localhost:6200' }));
app.use(express.json());

app.get('/config', (_req, res) => {
  res.json({ bitbucketUserSlug: BITBUCKET_USER_SLUG });
});

app.use(
  '/jira',
  createProxyMiddleware({
    target: JIRA_BASE_URL,
    changeOrigin: true,
    pathRewrite: { '^/jira': '' },
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.setHeader('Authorization', `Bearer ${JIRA_API_KEY}`);
      },
    },
  }),
);

app.use(
  '/bitbucket',
  createProxyMiddleware({
    target: BITBUCKET_BASE_URL,
    changeOrigin: true,
    pathRewrite: { '^/bitbucket': '' },
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.setHeader('Authorization', `Bearer ${BITBUCKET_API_KEY}`);
      },
    },
  }),
);

const ORBIT_DIR = path.join(os.homedir(), '.orbit');

async function readJson(file) {
  try {
    const data = await fsp.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeJson(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = file.replace(/\.json$/, '.tmp.json');
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(tmp, file);
}

app.get('/api/todos', async (_req, res) => {
  res.json(await readJson(path.join(ORBIT_DIR, 'todos.json')));
});

app.post('/api/todos', async (req, res) => {
  await writeJson(path.join(ORBIT_DIR, 'todos.json'), req.body);
  res.json(req.body);
});

app.get('/api/ideas', async (_req, res) => {
  res.json(await readJson(path.join(ORBIT_DIR, 'ideas.json')));
});

app.post('/api/ideas', async (req, res) => {
  await writeJson(path.join(ORBIT_DIR, 'ideas.json'), req.body);
  res.json(req.body);
});

app.listen(PORT, () => {
  console.log(`Proxy running at http://localhost:${PORT}`);
  console.log(`  /jira/**      → ${JIRA_BASE_URL}`);
  console.log(`  /bitbucket/** → ${BITBUCKET_BASE_URL}`);
});
