const { Router } = require('express');
const path = require('path');
const fsp = require('fs/promises');
const { ORBIT_DIR, TICKETS_DIR, readJson, writeJson } = require('../lib/json-store');

const router = Router();

router.get('/api/todos', async (_req, res) => {
  res.json(await readJson(path.join(ORBIT_DIR, 'todos.json')));
});

router.post('/api/todos', async (req, res) => {
  await writeJson(path.join(ORBIT_DIR, 'todos.json'), req.body);
  res.json(req.body);
});

router.get('/api/ideas', async (_req, res) => {
  res.json(await readJson(path.join(ORBIT_DIR, 'ideas.json')));
});

router.post('/api/ideas', async (req, res) => {
  await writeJson(path.join(ORBIT_DIR, 'ideas.json'), req.body);
  res.json(req.body);
});

router.get('/api/logbuch', async (_req, res) => {
  res.json(await readJson(path.join(ORBIT_DIR, 'logbuch.json')));
});

router.post('/api/logbuch', async (req, res) => {
  await writeJson(path.join(ORBIT_DIR, 'logbuch.json'), req.body);
  res.json(req.body);
});

router.get('/api/day-schedule', async (_req, res) => {
  res.json(await readJson(path.join(ORBIT_DIR, 'day-schedule.json')));
});

router.post('/api/day-schedule', async (req, res) => {
  await writeJson(path.join(ORBIT_DIR, 'day-schedule.json'), req.body);
  res.json(req.body);
});

router.get('/api/tickets/:key', async (req, res) => {
  const safeKey = req.params.key.replace(/[^A-Za-z0-9_-]/g, '');
  const file = path.join(TICKETS_DIR, `${safeKey}.json`);
  try {
    const data = await fsp.readFile(file, 'utf8');
    res.json(JSON.parse(data));
  } catch {
    res.json({ key: req.params.key, subtasks: [] });
  }
});

router.post('/api/tickets/:key', async (req, res) => {
  const safeKey = req.params.key.replace(/[^A-Za-z0-9_-]/g, '');
  const file = path.join(TICKETS_DIR, `${safeKey}.json`);
  await writeJson(file, req.body);
  res.json(req.body);
});

module.exports = router;
