require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const { JIRA_BASE_URL, JIRA_API_KEY, BITBUCKET_BASE_URL, BITBUCKET_API_KEY } = process.env;

if (!JIRA_BASE_URL || !JIRA_API_KEY || !BITBUCKET_BASE_URL || !BITBUCKET_API_KEY) {
  console.error('ERROR: JIRA_BASE_URL, JIRA_API_KEY, BITBUCKET_BASE_URL and BITBUCKET_API_KEY must be set in .env');
  process.exit(1);
}

const app = express();
const PORT = 6201;

app.use(cors({ origin: 'http://localhost:6200' }));

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

app.listen(PORT, () => {
  console.log(`Proxy running at http://localhost:${PORT}`);
  console.log(`  /jira/**      → ${JIRA_BASE_URL}`);
  console.log(`  /bitbucket/** → ${BITBUCKET_BASE_URL}`);
});
