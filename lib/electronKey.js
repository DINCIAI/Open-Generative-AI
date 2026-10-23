// Renderer side of the Electron key handling (see electron/lib/muapiBridge.js).
// In Electron the real MuAPI key stays in the main process; the UI only ever holds
// a placeholder that the main process swaps for the key on outgoing requests.
// In a plain browser (no bridge) every function here is a no-op.

const COOKIE_NAME = 'muapi_key';

export function getMuapiBridge() {
  if (typeof window === 'undefined') return null;
  return window.muapiBridge?.isElectron ? window.muapiBridge : null;
}

function setPlaceholderCookie(bridge) {
  // Agents pages read this cookie server-side. It only ever carries the placeholder.
  document.cookie = `${COOKIE_NAME}=${bridge.placeholderKey}; path=/; SameSite=Strict`;
}

// Resolves to the placeholder if a key is stored (migrating a legacy
// localStorage key into the main process first), otherwise null.
export async function loadElectronKey(bridge, storageKey) {
  const legacy = localStorage.getItem(storageKey);
  if (legacy && legacy !== bridge.placeholderKey) {
    await bridge.setKey(legacy);
  }
  if (legacy) localStorage.removeItem(storageKey);
  if (!(await bridge.hasKey())) return null;
  setPlaceholderCookie(bridge);
  return bridge.placeholderKey;
}

export async function saveElectronKey(bridge, key) {
  await bridge.setKey(key);
  setPlaceholderCookie(bridge);
  return bridge.placeholderKey;
}

export async function clearElectronKey(bridge) {
  await bridge.clearKey();
  document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
