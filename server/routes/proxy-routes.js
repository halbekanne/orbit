const { Router } = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

function parseDiffStats(diffText) {
  let additions = 0;
  let deletions = 0;
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      additions++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions++;
    }
  }
  return { additions, deletions, total: additions + deletions };
}

function createProxyRoutes({ JIRA_BASE_URL, JIRA_API_KEY, BITBUCKET_BASE_URL, BITBUCKET_API_KEY, BITBUCKET_USER_SLUG }) {
  const router = Router();

  router.get('/config', (_req, res) => {
    res.json({ bitbucketUserSlug: BITBUCKET_USER_SLUG });
  });

  router.get('/bitbucket/diffstat/:projectKey/:repoSlug/:prId', async (req, res) => {
    const { projectKey, repoSlug, prId } = req.params;
    const url = `${BITBUCKET_BASE_URL}/rest/api/latest/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}.diff`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${BITBUCKET_API_KEY}` },
      });
      if (!response.ok) {
        return res.status(response.status).json({ error: `Bitbucket responded with ${response.status}` });
      }
      const diffText = await response.text();
      res.json(parseDiffStats(diffText));
    } catch (err) {
      res.status(502).json({ error: 'Failed to fetch diff from Bitbucket' });
    }
  });

  router.use(
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

  router.use(
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

  return router;
}

module.exports = { createProxyRoutes };
