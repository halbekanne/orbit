const { Router } = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

function parseDiffStats(diffText) {
  let additions = 0;
  let deletions = 0;
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++;
    else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
  }
  return { additions, deletions, total: additions + deletions };
}

function createProxyRoutes({ getSettings }) {
  const router = Router();

  const requireSettings = (req, res, next) => {
    const s = getSettings();
    if (!s?.connections) return res.status(503).json({ error: 'Settings not configured' });
    next();
  };

  router.get('/bitbucket/diffstat/:projectKey/:repoSlug/:prId', requireSettings, async (req, res) => {
    const s = getSettings();
    const { projectKey, repoSlug, prId } = req.params;
    const url = `${s.connections.bitbucket.baseUrl}/rest/api/latest/projects/${projectKey}/repos/${repoSlug}/pull-requests/${prId}.diff`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${s.connections.bitbucket.apiKey}` },
      });
      if (!response.ok) return res.status(response.status).json({ error: `Bitbucket responded with ${response.status}` });
      const diffText = await response.text();
      res.json(parseDiffStats(diffText));
    } catch (err) {
      res.status(502).json({ error: 'Failed to fetch diff from Bitbucket' });
    }
  });

  router.use('/jira', requireSettings, (req, res, next) => {
    const s = getSettings();
    createProxyMiddleware({
      target: s.connections.jira.baseUrl,
      changeOrigin: true,
      pathRewrite: { '^/jira': '' },
      on: {
        proxyReq: (proxyReq) => {
          proxyReq.setHeader('Authorization', `Bearer ${s.connections.jira.apiKey}`);
        },
      },
    })(req, res, next);
  });

  router.use('/bitbucket', requireSettings, (req, res, next) => {
    const s = getSettings();
    createProxyMiddleware({
      target: s.connections.bitbucket.baseUrl,
      changeOrigin: true,
      pathRewrite: { '^/bitbucket': '' },
      on: {
        proxyReq: (proxyReq) => {
          proxyReq.setHeader('Authorization', `Bearer ${s.connections.bitbucket.apiKey}`);
        },
      },
    })(req, res, next);
  });

  return router;
}

module.exports = { createProxyRoutes };
