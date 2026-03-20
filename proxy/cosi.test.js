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
