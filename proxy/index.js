require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const { JIRA_BASE_URL, JIRA_API_KEY } = process.env;

if (!JIRA_BASE_URL || !JIRA_API_KEY) {
  console.error('ERROR: JIRA_BASE_URL and JIRA_API_KEY must be set in .env');
  process.exit(1);
}

const app = express();
const PORT = 6201;

app.use(cors({ origin: 'http://localhost:6200' }));

app.use(
  createProxyMiddleware({
    target: JIRA_BASE_URL,
    changeOrigin: true,
    pathFilter: '/rest',
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.setHeader('Authorization', `Bearer ${JIRA_API_KEY}`);
      },
    },
  }),
);

app.listen(PORT, () => {
  console.log(`Proxy running at http://localhost:${PORT} → ${JIRA_BASE_URL}`);
});
