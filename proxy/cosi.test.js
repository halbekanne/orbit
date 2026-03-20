const { describe, it, mock, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

function freshRequire() {
  delete require.cache[require.resolve('./cosi')];
  return require('./cosi');
}

describe('callCoSi', () => {
  beforeEach(() => {
    process.env.COSI_API_KEY = 'test-key';
    process.env.COSI_BASE_URL = 'https://cosi.test/generate';
  });

  it('sends correct request to CoSi API', async () => {
    const mockResponse = {
      candidates: [{
        content: {
          parts: [{ text: '{"findings": []}' }]
        }
      }]
    };

    const fetchMock = mock.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }));
    mock.method(global, 'fetch', fetchMock);

    const { callCoSi } = freshRequire();
    const result = await callCoSi('test prompt', 'You are a reviewer.', { temperature: 0.2 });

    assert.equal(fetchMock.mock.calls.length, 1);
    const [url, options] = fetchMock.mock.calls[0].arguments;
    assert.equal(url, 'https://cosi.test/generate');
    assert.equal(options.method, 'POST');

    const headers = options.headers;
    assert.equal(headers['x-api-key'], 'test-key');
    assert.equal(headers['Content-Type'], 'application/json');

    const body = JSON.parse(options.body);
    assert.deepEqual(body.systemInstruction, { parts: [{ text: 'You are a reviewer.' }] });
    assert.equal(body.generationConfig.temperature, 0.2);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(body.contents, [{ role: 'user', parts: [{ text: 'test prompt' }] }]);

    assert.deepEqual(result, { findings: [] });
  });

  it('throws on non-ok response', async () => {
    mock.method(global, 'fetch', () => Promise.resolve({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    }));

    const { callCoSi } = freshRequire();
    await assert.rejects(
      () => callCoSi('prompt', 'system', {}),
      (err) => {
        assert.match(err.message, /429/);
        return true;
      }
    );
  });
});

describe('runReview', () => {
  beforeEach(() => {
    process.env.COSI_API_KEY = 'test-key';
    process.env.COSI_BASE_URL = 'https://cosi.test/generate';
  });

  it('orchestrates parallel agents and consolidation', async () => {
    const agent1Result = { findings: [{ severity: 'critical', title: 'AK #1 fehlt', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' }] };
    const agent2Result = { findings: [{ severity: 'minor', title: 'Naming', file: 'b.ts', line: 5, detail: 'd', suggestion: 's' }] };
    const consolidatedResult = {
      findings: [
        { severity: 'critical', category: 'ak-abgleich', title: 'AK #1 fehlt', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' },
        { severity: 'minor', category: 'code-quality', title: 'Naming', file: 'b.ts', line: 5, detail: 'd', suggestion: 's' },
      ],
      summary: '2 Auffälligkeiten: 1 Kritisch, 0 Wichtig, 1 Gering',
    };

    let callCount = 0;
    mock.method(global, 'fetch', () => {
      callCount++;
      const result = callCount <= 2
        ? (callCount === 1 ? agent1Result : agent2Result)
        : consolidatedResult;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }],
        }),
      });
    });

    const { runReview } = freshRequire();
    const result = await runReview('diff content', { key: 'DS-1', summary: 'Test', description: 'AK: something' });

    assert.equal(result.findings.length, 2);
    assert.equal(result.summary, '2 Auffälligkeiten: 1 Kritisch, 0 Wichtig, 1 Gering');
    assert.ok(Array.isArray(result.warnings));
    assert.equal(result.warnings.length, 0);
    assert.ok(result.reviewedAt);
    assert.equal(callCount, 3);
  });

  it('returns partial result when agent 1 fails', async () => {
    const agent2Result = { findings: [{ severity: 'minor', title: 'Test', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' }] };
    const consolidatedResult = {
      findings: [{ severity: 'minor', category: 'code-quality', title: 'Test', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' }],
      summary: '1 Auffälligkeit: 0 Kritisch, 0 Wichtig, 1 Gering',
    };

    let callCount = 0;
    mock.method(global, 'fetch', () => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('error') });
      }
      const result = callCount === 2 ? agent2Result : consolidatedResult;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }],
        }),
      });
    });

    const { runReview } = freshRequire();
    const result = await runReview('diff content', { key: 'DS-1', summary: 'Test', description: 'desc' });

    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /AK-Abgleich/);
  });

  it('skips agent 1 when no jira ticket provided', async () => {
    const agent2Result = { findings: [] };
    const consolidatedResult = { findings: [], summary: 'Keine Auffälligkeiten' };

    let callCount = 0;
    mock.method(global, 'fetch', () => {
      callCount++;
      const result = callCount === 1 ? agent2Result : consolidatedResult;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }],
        }),
      });
    });

    const { runReview } = freshRequire();
    const result = await runReview('diff content', null);

    assert.equal(callCount, 2);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /Kein Jira-Ticket/);
  });
});
