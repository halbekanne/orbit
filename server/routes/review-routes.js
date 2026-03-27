const { Router, json } = require('express');
const { runReview } = require('../cosi');
const { runMockReview } = require('../cosi-mock');

function createReviewRoutes({ COSI_API_KEY }) {
  const router = Router();

  router.post('/api/cosi/review', json({ limit: '2mb' }), async (req, res) => {
    const { diff, jiraTicket } = req.body;
    if (!diff || typeof diff !== 'string') {
      return res.status(400).json({ error: 'diff is required and must be a string' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const emit = (eventType, data) => {
      res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      if (COSI_API_KEY) {
        await runReview(diff, jiraTicket || null, emit);
      } else {
        await runMockReview(emit);
      }
    } catch (err) {
      console.error('[CoSi Review] Error:', err);
      emit('error', { message: 'Review fehlgeschlagen: ' + err.message });
    }

    res.end();
  });

  return router;
}

module.exports = { createReviewRoutes };
