const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { runMockReview, setSkipDelays } = require('./cosi-mock');

describe('runMockReview', () => {
  before(() => setSkipDelays(true));

  it('emits correct event sequence', async () => {
    const events = [];
    await runMockReview((type, data) => events.push({ type, data }));

    const types = events.map(e => e.type);
    assert.ok(types.includes('agent:start'), 'should include agent:start');
    assert.ok(types.includes('done'), 'should include done');
  });

  it('emits agent:start for at least one agent', async () => {
    const events = [];
    await runMockReview((type, data) => events.push({ type, data }));

    const starts = events.filter(e => e.type === 'agent:start');
    assert.ok(starts.length >= 1);

    for (const start of starts) {
      assert.ok(['ak-abgleich', 'code-quality'].includes(start.data.agent));
      assert.equal(typeof start.data.label, 'string');
      assert.equal(typeof start.data.temperature, 'number');
    }
  });

  it('includes consolidator:done with result and decisions when findings exist', async () => {
    const allEvents = [];
    for (let i = 0; i < 20; i++) {
      const events = [];
      await runMockReview((type, data) => events.push({ type, data }));
      allEvents.push(...events);
    }

    const consolDones = allEvents.filter(e => e.type === 'consolidator:done');
    assert.ok(consolDones.length > 0, 'Expected at least one consolidator:done in 20 runs');

    for (const cd of consolDones) {
      assert.ok(cd.data.result, 'consolidator:done should have result');
      assert.ok(Array.isArray(cd.data.result.findings));
      assert.equal(typeof cd.data.result.summary, 'string');
      assert.ok(Array.isArray(cd.data.result.warnings));
      assert.equal(typeof cd.data.result.reviewedAt, 'string');
      assert.ok(Array.isArray(cd.data.decisions));
      assert.equal(typeof cd.data.summary, 'string');
      assert.ok(cd.data.rawResponse);
    }
  });

  it('emits agent:error for partial failure scenario', async () => {
    const allEvents = [];
    for (let i = 0; i < 30; i++) {
      const events = [];
      await runMockReview((type, data) => events.push({ type, data }));
      allEvents.push(...events);
    }

    const errors = allEvents.filter(e => e.type === 'agent:error');
    assert.ok(errors.length > 0, 'Expected at least one agent:error in 30 runs');

    for (const err of errors) {
      assert.equal(err.data.agent, 'ak-abgleich');
      assert.equal(typeof err.data.error, 'string');
    }
  });
});
