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

  router.use('/jenkins', requireSettings, (req, res, next) => {
    const s = getSettings();
    if (!s.connections.jenkins?.baseUrl) {
      return res.status(503).json({ error: 'Jenkins not configured' });
    }
    const { username, apiToken } = s.connections.jenkins;
    const basicAuth = Buffer.from(`${username}:${apiToken}`).toString('base64');
    createProxyMiddleware({
      target: s.connections.jenkins.baseUrl,
      changeOrigin: true,
      pathRewrite: { '^/jenkins': '' },
      on: {
        proxyReq: (proxyReq) => {
          proxyReq.setHeader('Authorization', `Basic ${basicAuth}`);
        },
        proxyRes: (proxyRes, req, res) => {
          const textSize = proxyRes.headers['x-text-size'];
          const moreData = proxyRes.headers['x-more-data'];
          if (textSize) res.setHeader('X-Text-Size', textSize);
          if (moreData) res.setHeader('X-More-Data', moreData);
        },
      },
    })(req, res, next);
  });

  return router;
}

module.exports = { createProxyRoutes };
