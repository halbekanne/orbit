require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createProxyRoutes } = require('./routes/proxy-routes');
const { createReviewRoutes } = require('./routes/review-routes');
const localDataRoutes = require('./routes/local-data-routes');

const { JIRA_BASE_URL, JIRA_API_KEY, BITBUCKET_BASE_URL, BITBUCKET_API_KEY, BITBUCKET_USER_SLUG, COSI_API_KEY } = process.env;

if (!JIRA_BASE_URL || !JIRA_API_KEY || !BITBUCKET_BASE_URL || !BITBUCKET_API_KEY || !BITBUCKET_USER_SLUG) {
  console.error('ERROR: JIRA_BASE_URL, JIRA_API_KEY, BITBUCKET_BASE_URL, BITBUCKET_API_KEY and BITBUCKET_USER_SLUG must be set in .env');
  process.exit(1);
}

if (!COSI_API_KEY) {
  console.warn('[CoSi] Mock-Modus aktiv — kein API Key gesetzt');
}

const app = express();
const PORT = 6201;

app.use(cors({ origin: 'http://localhost:6200' }));
app.use(createReviewRoutes({ COSI_API_KEY }));
app.use(express.json());
app.use(createProxyRoutes({ JIRA_BASE_URL, JIRA_API_KEY, BITBUCKET_BASE_URL, BITBUCKET_API_KEY, BITBUCKET_USER_SLUG }));
app.use(localDataRoutes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`  /jira/**      → ${JIRA_BASE_URL}`);
  console.log(`  /bitbucket/** → ${BITBUCKET_BASE_URL}`);
});
