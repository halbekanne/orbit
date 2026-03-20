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

  it('emits agent:start, agent:done for both agents and consolidator events', async () => {
    const agent1Result = { findings: [{ severity: 'critical', title: 'AK #1 fehlt', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' }] };
    const agent2Result = { findings: [{ severity: 'minor', title: 'Naming', file: 'b.ts', line: 5, detail: 'd', suggestion: 's' }] };
    const consolidatedResult = {
      findings: [
        { severity: 'critical', category: 'ak-abgleich', title: 'AK #1 fehlt', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' },
      ],
      summary: '1 Auffälligkeit: 1 Kritisch',
      decisions: [
        { agent: 'ak-abgleich', finding: 'AK #1 fehlt', action: 'kept', reason: 'Valid finding' },
        { agent: 'code-quality', finding: 'Naming', action: 'removed', reason: 'Trivial nitpick' },
      ],
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
    const events = [];
    const emit = (type, data) => events.push({ type, data });

    await runReview('diff content', { key: 'DS-1', summary: 'Test', description: 'AK: something' }, emit);

    const types = events.map(e => e.type);
    assert.deepEqual(types, [
      'agent:start', 'agent:start',
      'agent:done', 'agent:done',
      'consolidator:start',
      'consolidator:done',
      'done',
    ]);

    const agent1Start = events.find(e => e.type === 'agent:start' && e.data.agent === 'ak-abgleich');
    assert.ok(agent1Start);
    assert.equal(agent1Start.data.label, 'AK-Abgleich');
    assert.equal(agent1Start.data.temperature, 0.2);

    const agent2Start = events.find(e => e.type === 'agent:start' && e.data.agent === 'code-quality');
    assert.ok(agent2Start);
    assert.equal(agent2Start.data.label, 'Code-Qualität');
    assert.equal(agent2Start.data.temperature, 0.4);

    const agent1Done = events.find(e => e.type === 'agent:done' && e.data.agent === 'ak-abgleich');
    assert.ok(agent1Done);
    assert.equal(agent1Done.data.findingCount, 1);
    assert.ok(typeof agent1Done.data.duration === 'number');
    assert.ok(agent1Done.data.summary);
    assert.deepEqual(agent1Done.data.rawResponse, agent1Result);

    const agent2Done = events.find(e => e.type === 'agent:done' && e.data.agent === 'code-quality');
    assert.ok(agent2Done);
    assert.equal(agent2Done.data.findingCount, 1);
    assert.deepEqual(agent2Done.data.rawResponse, agent2Result);

    const consolStart = events.find(e => e.type === 'consolidator:start');
    assert.ok(consolStart);
    assert.equal(consolStart.data.temperature, 0.2);

    const consolDone = events.find(e => e.type === 'consolidator:done');
    assert.ok(consolDone);
    assert.ok(typeof consolDone.data.duration === 'number');
    assert.equal(consolDone.data.result.findings.length, 1);
    assert.equal(consolDone.data.result.summary, '1 Auffälligkeit: 1 Kritisch');
    assert.ok(consolDone.data.result.reviewedAt);
    assert.deepEqual(consolDone.data.result.warnings, []);
    assert.equal(consolDone.data.decisions.length, 2);
    assert.equal(consolDone.data.summary, '2 Findings geprüft, 1 gefiltert, 1 übernommen');
    assert.deepEqual(consolDone.data.rawResponse, consolidatedResult);

    assert.equal(callCount, 3);
  });

  it('emits warning and skips agent 1 when no jira ticket', async () => {
    const agent2Result = { findings: [{ severity: 'minor', title: 'Naming', file: 'b.ts', line: 5, detail: 'd', suggestion: 's' }] };
    const consolidatedResult = {
      findings: [{ severity: 'minor', category: 'code-quality', title: 'Naming', file: 'b.ts', line: 5, detail: 'd', suggestion: 's' }],
      summary: '1 Auffälligkeit',
      decisions: [{ agent: 'code-quality', finding: 'Naming', action: 'kept', reason: 'Valid' }],
    };

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
    const events = [];
    const emit = (type, data) => events.push({ type, data });

    await runReview('diff content', null, emit);

    const types = events.map(e => e.type);
    assert.deepEqual(types, [
      'warning',
      'agent:start',
      'agent:done',
      'consolidator:start',
      'consolidator:done',
      'done',
    ]);

    const warning = events.find(e => e.type === 'warning');
    assert.match(warning.data.message, /Kein Jira-Ticket/);

    const agentStart = events.find(e => e.type === 'agent:start');
    assert.equal(agentStart.data.agent, 'code-quality');

    assert.equal(callCount, 2);
  });

  it('emits agent:error when an agent fails', async () => {
    const agent2Result = { findings: [{ severity: 'minor', title: 'Test', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' }] };
    const consolidatedResult = {
      findings: [{ severity: 'minor', category: 'code-quality', title: 'Test', file: 'a.ts', line: 1, detail: 'd', suggestion: 's' }],
      summary: '1 Auffälligkeit',
      decisions: [{ agent: 'code-quality', finding: 'Test', action: 'kept', reason: 'Valid' }],
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
    const events = [];
    const emit = (type, data) => events.push({ type, data });

    await runReview('diff content', { key: 'DS-1', summary: 'Test', description: 'desc' }, emit);

    const types = events.map(e => e.type);
    assert.ok(types.includes('agent:start'));
    assert.ok(types.includes('agent:error'));
    assert.ok(types.includes('agent:done'));
    assert.ok(types.includes('consolidator:start'));
    assert.ok(types.includes('consolidator:done'));
    assert.ok(types.includes('done'));

    const errorEvent = events.find(e => e.type === 'agent:error');
    assert.equal(errorEvent.data.agent, 'ak-abgleich');
    assert.ok(errorEvent.data.error);

    const warningInResult = events.find(e => e.type === 'consolidator:done');
    assert.equal(warningInResult.data.result.warnings.length, 1);
    assert.match(warningInResult.data.result.warnings[0], /AK-Abgleich/);
  });

  it('emits done with empty result when no findings and skips consolidator', async () => {
    const agent1Result = { findings: [] };
    const agent2Result = { findings: [] };

    let callCount = 0;
    mock.method(global, 'fetch', () => {
      callCount++;
      const result = callCount === 1 ? agent1Result : agent2Result;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }],
        }),
      });
    });

    const { runReview } = freshRequire();
    const events = [];
    const emit = (type, data) => events.push({ type, data });

    await runReview('diff content', { key: 'DS-1', summary: 'Test', description: 'AK: something' }, emit);

    const types = events.map(e => e.type);
    assert.ok(!types.includes('consolidator:start'));
    assert.ok(!types.includes('consolidator:done'));
    assert.ok(types.includes('done'));

    assert.equal(callCount, 2);
  });
});
