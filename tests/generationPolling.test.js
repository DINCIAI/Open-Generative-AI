const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const lifecycleUrl = pathToFileURL(path.join(__dirname, '../packages/studio/src/utils/generationLifecycle.js')).href;
const load = () => import(lifecycleUrl);

const json = (body, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
});

test('nextPollDelay grows from 2 s and caps at 30 s', async () => {
    const { nextPollDelay } = await load();
    const delays = Array.from({ length: 10 }, (_, i) => nextPollDelay(i + 1));
    assert.deepEqual(delays, [2000, 3000, 4500, 6750, 10125, 15188, 22781, 30000, 30000, 30000]);
});

test('polls with backoff until the job completes', async () => {
    const { pollForGenerationResult } = await load();
    const waits = [];
    const responses = [json({ status: 'processing' }), json({ status: 'processing' }), json({ status: 'completed', outputs: ['u'] })];
    const result = await pollForGenerationResult({
        baseUrl: 'http://x', requestId: 'r1', apiKey: 'k',
        fetchImpl: async () => responses.shift(),
        waitImpl: async (ms) => { waits.push(ms); },
    });
    assert.equal(result.status, 'completed');
    assert.deepEqual(waits, [2000, 3000, 4500]);
});

test('keeps the caller\'s total budget (maxAttempts x interval) and then times out', async () => {
    const { pollForGenerationResult } = await load();
    let waited = 0;
    let polls = 0;
    await assert.rejects(pollForGenerationResult({
        baseUrl: 'http://x', requestId: 'r2', apiKey: 'k', maxAttempts: 900, interval: 2000,
        fetchImpl: async () => { polls++; return json({ status: 'processing' }); },
        waitImpl: async (ms) => { waited += ms; },
    }), /timed out/);
    assert.equal(waited, 900 * 2000);
    assert.ok(polls < 80, `expected far fewer polls than 900, got ${polls}`);
});

test('5xx is retried, 4xx aborts and reports auth problems', async () => {
    const { pollForGenerationResult } = await load();
    const responses = [json({}, 502), json({ status: 'completed' })];
    const ok = await pollForGenerationResult({
        baseUrl: 'http://x', requestId: 'r3', apiKey: 'k',
        fetchImpl: async () => responses.shift(), waitImpl: async () => {},
    });
    assert.equal(ok.status, 'completed');

    let authStatus;
    await assert.rejects(pollForGenerationResult({
        baseUrl: 'http://x', requestId: 'r4', apiKey: 'k',
        fetchImpl: async () => json({ detail: 'nope' }, 401), waitImpl: async () => {},
        onAuthRequired: (status) => { authStatus = status; },
    }), /Poll Failed: 401/);
    assert.equal(authStatus, 401);
});

test('failed generations surface the error and request id', async () => {
    const { pollForGenerationResult } = await load();
    await assert.rejects(pollForGenerationResult({
        baseUrl: 'http://x', requestId: 'r5', apiKey: 'k',
        fetchImpl: async () => json({ status: 'failed', error: 'NSFW' }), waitImpl: async () => {},
    }), (err) => err.requestId === 'r5' && /NSFW/.test(err.message));
});
