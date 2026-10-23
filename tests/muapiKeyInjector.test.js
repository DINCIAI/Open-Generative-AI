const test = require('node:test');
const assert = require('node:assert/strict');

const { PLACEHOLDER_KEY, filterUrls, isKeyTarget, injectKey, attach } = require('../electron/lib/muapiKeyInjector');

const ORIGIN = 'http://127.0.0.1:37615';
const KEY = 'sk-real-key-123456';

test('only local /api routes and api.muapi.ai are key targets', () => {
    assert.equal(isKeyTarget(`${ORIGIN}/api/v1/flux`, ORIGIN), true);
    assert.equal(isKeyTarget('https://api.muapi.ai/api/v1/predictions/x/result', ORIGIN), true);
    assert.equal(isKeyTarget(`${ORIGIN}/studio`, ORIGIN), false);
    assert.equal(isKeyTarget('https://cdn.muapi.ai/file.mp4', ORIGIN), false);
    assert.equal(isKeyTarget('https://api.muapi.ai.evil.com/x', ORIGIN), false);
    assert.equal(isKeyTarget('http://127.0.0.1:9999/api/v1/x', ORIGIN), false);
    assert.equal(isKeyTarget('not a url', ORIGIN), false);
});

test('placeholder is replaced with the real key, case-insensitively', () => {
    const out = injectKey({ 'X-Api-Key': PLACEHOLDER_KEY, Accept: '*/*' }, `${ORIGIN}/api/v1/x`, ORIGIN, KEY);
    assert.deepEqual(out, { Accept: '*/*', 'x-api-key': KEY });
});

test('header is added when the renderer sent none', () => {
    const out = injectKey({}, 'https://api.muapi.ai/api/v1/upload_file', ORIGIN, KEY);
    assert.equal(out['x-api-key'], KEY);
});

test('without a stored key the placeholder is stripped, not forwarded', () => {
    const out = injectKey({ 'x-api-key': PLACEHOLDER_KEY }, `${ORIGIN}/api/v1/x`, ORIGIN, null);
    assert.equal('x-api-key' in out, false);
});

test('foreign hosts never receive the key', () => {
    const input = { 'x-api-key': PLACEHOLDER_KEY };
    const out = injectKey(input, 'https://s3.amazonaws.com/bucket', ORIGIN, KEY);
    assert.equal('x-api-key' in out, false);
    assert.equal(input['x-api-key'], PLACEHOLDER_KEY, 'input is not mutated');
});

test('attach registers a filtered listener that injects lazily', () => {
    let registered;
    const session = { webRequest: { onBeforeSendHeaders: (filter, fn) => { registered = { filter, fn }; } } };
    let current = null;
    attach(session, { appOrigin: ORIGIN, getKey: () => current });
    assert.deepEqual(registered.filter.urls, filterUrls(ORIGIN));

    const run = () => new Promise((resolve) => registered.fn(
        { url: `${ORIGIN}/api/v1/x`, requestHeaders: { 'x-api-key': PLACEHOLDER_KEY } },
        resolve,
    ));
    return run()
        .then(({ requestHeaders }) => assert.equal('x-api-key' in requestHeaders, false))
        .then(() => { current = KEY; return run(); })
        .then(({ requestHeaders }) => assert.equal(requestHeaders['x-api-key'], KEY));
});
