const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createKeyStore, normalizeKey } = require('../electron/lib/muapiKeyStore');

const KEY = 'sk-test-1234567890abcdef';

// Reversible stand-in for safeStorage: base64 + marker, so plaintext never hits disk.
function fakeSafeStorage({ available = true } = {}) {
    return {
        isEncryptionAvailable: () => available,
        encryptString: (s) => Buffer.from('ENC:' + Buffer.from(s).toString('base64')),
        decryptString: (b) => Buffer.from(b.toString().slice(4), 'base64').toString(),
    };
}

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'muapi-key-')), 'nested', 'muapi-key.bin');

test('set/get roundtrip survives a fresh store instance', () => {
    const filePath = tmpFile();
    const store = createKeyStore({ safeStorage: fakeSafeStorage(), filePath });
    assert.equal(store.has(), false);
    store.set(`  ${KEY}  `);
    assert.equal(store.get(), KEY);

    const reopened = createKeyStore({ safeStorage: fakeSafeStorage(), filePath });
    assert.equal(reopened.get(), KEY);
    assert.equal(reopened.has(), true);
});

test('plaintext key is never written to disk', () => {
    const filePath = tmpFile();
    createKeyStore({ safeStorage: fakeSafeStorage(), filePath }).set(KEY);
    assert.ok(!fs.readFileSync(filePath).toString().includes(KEY));
});

test('refuses to store without OS encryption', () => {
    const filePath = tmpFile();
    const store = createKeyStore({ safeStorage: fakeSafeStorage({ available: false }), filePath });
    assert.throws(() => store.set(KEY), /safeStorage/);
    assert.equal(fs.existsSync(filePath), false);
});

test('clear removes the file and the cached key', () => {
    const filePath = tmpFile();
    const store = createKeyStore({ safeStorage: fakeSafeStorage(), filePath });
    store.set(KEY);
    store.clear();
    assert.equal(store.has(), false);
    assert.equal(fs.existsSync(filePath), false);
    store.clear(); // idempotent
});

test('normalizeKey rejects junk that cannot be a header value', () => {
    assert.equal(normalizeKey(` ${KEY}\n`), KEY);
    assert.throws(() => normalizeKey(42), /string/);
    assert.throws(() => normalizeKey('short'), /characters/);
    assert.throws(() => normalizeKey('abc def ghi jkl'), /invalid/);
    assert.throws(() => normalizeKey('x'.repeat(513)), /characters/);
});
