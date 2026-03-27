const { Router } = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

function createProxyRoutes({ JIRA_BASE_URL, JIRA_API_KEY, BITBUCKET_BASE_URL, BITBUCKET_API_KEY, BITBUCKET_USER_SLUG }) {
  const router = Router();

  router.get('/config', (_req, res) => {
    res.json({ bitbucketUserSlug: BITBUCKET_USER_SLUG });
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
