// MuAPI key storage for the Electron main process.
//
// The key is encrypted with Electron's safeStorage (DPAPI on Windows, Keychain on
// macOS, libsecret on Linux) and written to a single file under userData. The
// renderer never receives the plaintext: it can only ask whether a key exists,
// replace it, or clear it (see muapiBridge.js). Kept free of `require('electron')`
// so tests can pass a fake safeStorage.

const fs = require('fs');
const path = require('path');

const MIN_KEY_LENGTH = 8;
const MAX_KEY_LENGTH = 512;

function normalizeKey(value) {
    if (typeof value !== 'string') throw new Error('API key must be a string');
    const key = value.trim();
    if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) {
        throw new Error(`API key must be ${MIN_KEY_LENGTH}-${MAX_KEY_LENGTH} characters`);
    }
    // Header values cannot carry whitespace or control characters.
    if (/[\s\x00-\x1f\x7f]/.test(key)) throw new Error('API key contains invalid characters');
    return key;
}

function createKeyStore({ safeStorage, filePath }) {
    let cached; // undefined = not loaded yet, null = no key

    function assertEncryption() {
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error('OS encryption (safeStorage) is unavailable; refusing to store the API key in plaintext');
        }
    }

    function get() {
        if (cached !== undefined) return cached;
        try {
            const encrypted = fs.readFileSync(filePath);
            assertEncryption();
            cached = safeStorage.decryptString(encrypted) || null;
        } catch (err) {
            if (err.code !== 'ENOENT') console.error('Failed to read MuAPI key:', err.message);
            cached = null;
        }
        return cached;
    }

    function set(value) {
        const key = normalizeKey(value);
        assertEncryption();
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, safeStorage.encryptString(key), { mode: 0o600 });
        cached = key;
    }

    function clear() {
        fs.rmSync(filePath, { force: true });
        cached = null;
    }

    return { get, set, clear, has: () => Boolean(get()) };
}

module.exports = { createKeyStore, normalizeKey };
