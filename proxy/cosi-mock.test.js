const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { runMockReview } = require('./cosi-mock');

describe('runMockReview', () => {
  it('returns a valid ReviewResult shape', async () => {
    const result = await runMockReview();

    assert.ok(Array.isArray(result.findings));
    assert.equal(typeof result.summary, 'string');
    assert.ok(Array.isArray(result.warnings));
    assert.equal(typeof result.reviewedAt, 'string');
    assert.ok(!isNaN(Date.parse(result.reviewedAt)));
  });

  it('delays between 2 and 3 seconds', async () => {
    const start = Date.now();
    await runMockReview();
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 2000, `Expected >= 2000ms, got ${elapsed}ms`);
    assert.ok(elapsed < 3100, `Expected < 3100ms, got ${elapsed}ms`);
  });

  it('returns findings with correct field types when present', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => runMockReview())
    );
    const withFindings = results.filter((r) => r.findings.length > 0);
    assert.ok(withFindings.length > 0, 'Expected at least one result with findings after 20 calls');

    for (const finding of withFindings[0].findings) {
      assert.ok(['critical', 'important', 'minor'].includes(finding.severity));
      assert.ok(['ak-abgleich', 'code-quality'].includes(finding.category));
      assert.equal(typeof finding.title, 'string');
      assert.equal(typeof finding.file, 'string');
      assert.equal(typeof finding.line, 'number');
      assert.equal(typeof finding.detail, 'string');
      assert.equal(typeof finding.suggestion, 'string');
    }
  });
});
