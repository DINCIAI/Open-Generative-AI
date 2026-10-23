// Adds the real MuAPI key to outgoing requests at the Chromium network layer.
//
// The Next.js renderer keeps passing an `apiKey` prop around and sets
// `x-api-key: electron-managed` on its requests. Here, in the main process, that
// placeholder is replaced with the decrypted key — but only for requests to the
// local Next server's /api routes and to api.muapi.ai. Every other host (CDNs,
// S3 upload URLs, third parties) never sees the key.

const PLACEHOLDER_KEY = 'electron-managed';
const MUAPI_API_ORIGIN = 'https://api.muapi.ai';

function filterUrls(appOrigin) {
    return [`${appOrigin}/api/*`, `${MUAPI_API_ORIGIN}/*`];
}

function isKeyTarget(url, appOrigin) {
    let parsed;
    try { parsed = new URL(url); } catch { return false; }
    if (parsed.origin === MUAPI_API_ORIGIN) return true;
    return parsed.origin === appOrigin && parsed.pathname.startsWith('/api/');
}

function findHeaderName(headers, name) {
    const lower = name.toLowerCase();
    return Object.keys(headers).find((h) => h.toLowerCase() === lower);
}

// Returns a new header object; never mutates the input.
function injectKey(requestHeaders, url, appOrigin, key) {
    const headers = { ...requestHeaders };
    const existing = findHeaderName(headers, 'x-api-key');
    if (!isKeyTarget(url, appOrigin)) {
        // A placeholder leaking to a foreign host is harmless but pointless.
        if (existing && headers[existing] === PLACEHOLDER_KEY) delete headers[existing];
        return headers;
    }
    if (existing) delete headers[existing];
    if (key) headers['x-api-key'] = key;
    return headers;
}

function attach(session, { appOrigin, getKey }) {
    session.webRequest.onBeforeSendHeaders({ urls: filterUrls(appOrigin) }, (details, callback) => {
        let key = null;
        try { key = getKey(); } catch (err) { console.error('MuAPI key unavailable:', err.message); }
        callback({ requestHeaders: injectKey(details.requestHeaders, details.url, appOrigin, key) });
    });
}

module.exports = { PLACEHOLDER_KEY, filterUrls, isKeyTarget, injectKey, attach };
