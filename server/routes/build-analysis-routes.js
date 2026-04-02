const { Router, json } = require('express');
const { runBuildAnalysis } = require('../build-analysis');
const { runMockBuildAnalysis } = require('../ai-mock');

function createBuildAnalysisRoutes({ getSettings }) {
  const router = Router();

  router.post('/api/ai/build-analysis', json({ limit: '2mb' }), async (req, res) => {
    const { jobPath, branch, buildNumber, failedStage, stageLog } = req.body;
    if (!jobPath || !branch || !buildNumber || !failedStage || !stageLog) {
      return res.status(400).json({ error: 'jobPath, branch, buildNumber, failedStage and stageLog are required' });
    }

    try {
      const s = getSettings();
      const vertexAi = s?.connections?.vertexAi;
      if (vertexAi?.url) {
        const result = await runBuildAnalysis(req.body, { getSettings });
        return res.json(result);
      } else {
        const result = await runMockBuildAnalysis();
        return res.json(result);
      }
    } catch (err) {
      console.error('[Build Analysis] Error:', err);
      return res.status(500).json({ error: 'Analyse fehlgeschlagen: ' + err.message });
    }
  });

  return router;
}

module.exports = { createBuildAnalysisRoutes };
