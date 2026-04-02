const express = require('express');
const cors = require('cors');
const { createProxyRoutes } = require('./routes/proxy-routes');
const { createAiRoutes } = require('./routes/ai-routes');
const { createBuildAnalysisRoutes } = require('./routes/build-analysis-routes');
const localDataRoutes = require('./routes/local-data-routes');
const { createSettingsRoutes, SETTINGS_FILE } = require('./routes/settings-routes');
const { readJsonObject } = require('./lib/json-store');

let settings = null;

async function loadSettings() {
  settings = await readJsonObject(SETTINGS_FILE);
  return settings;
}

function getSettings() {
  return settings;
}

(async () => {
  await loadSettings();

  const app = express();
  const PORT = 6201;

  app.use(cors({ origin: 'http://localhost:6200' }));
  app.use(createSettingsRoutes({ onSettingsSaved: loadSettings }));
  app.use(createAiRoutes({ getSettings }));
  app.use(createBuildAnalysisRoutes({ getSettings }));
  app.use(express.json());
  app.use(createProxyRoutes({ getSettings }));
  app.use(localDataRoutes);

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    if (settings?.connections?.jira?.baseUrl) {
      console.log(`  /jira/**      → ${settings.connections.jira.baseUrl}`);
    }
    if (settings?.connections?.bitbucket?.baseUrl) {
      console.log(`  /bitbucket/** → ${settings.connections.bitbucket.baseUrl}`);
    }
    if (settings?.connections?.jenkins?.baseUrl) {
      console.log(`  /jenkins/**   → ${settings.connections.jenkins.baseUrl}`);
    }
    if (!settings) {
      console.log('  No settings.json found — configure via UI');
    }
  });
})();
