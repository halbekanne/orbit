const { Router, json } = require('express');
const path = require('path');
const { ORBIT_DIR, readJsonObject, writeJson } = require('../lib/json-store');

const SETTINGS_FILE = path.join(ORBIT_DIR, 'settings.json');

const REQUIRED_FIELDS = [
  'connections.jira.baseUrl',
  'connections.jira.apiKey',
  'connections.bitbucket.baseUrl',
  'connections.bitbucket.apiKey',
  'connections.bitbucket.userSlug',
];

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function isConfigured(settings) {
  if (!settings) return false;
  return REQUIRED_FIELDS.every(f => {
    const val = getNestedValue(settings, f);
    return typeof val === 'string' && val.trim().length > 0;
  });
}

function createSettingsRoutes() {
  const router = Router();

  router.get('/api/settings/status', async (_req, res) => {
    const settings = await readJsonObject(SETTINGS_FILE);
    res.json({ configured: isConfigured(settings) });
  });

  router.get('/api/settings', async (_req, res) => {
    const settings = await readJsonObject(SETTINGS_FILE);
    if (!settings) return res.json({ exists: false });
    res.json(settings);
  });

  router.put('/api/settings', json(), async (req, res) => {
    const settings = req.body;
    const missing = REQUIRED_FIELDS.filter(f => {
      const val = getNestedValue(settings, f);
      return !val || typeof val !== 'string' || val.trim().length === 0;
    });
    if (missing.length > 0) {
      return res.status(400).json({ error: 'Missing required fields', fields: missing });
    }
    await writeJson(SETTINGS_FILE, settings);
    res.json(settings);
  });

  return router;
}

module.exports = { createSettingsRoutes, SETTINGS_FILE, isConfigured };
