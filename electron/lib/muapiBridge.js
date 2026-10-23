// Electron wiring for the MuAPI key: IPC handlers for the renderer and the
// network-layer header injection. The renderer can check, replace or clear the
// key, but there is deliberately no handler that returns it.

const { ipcMain, safeStorage, session, app } = require('electron');
const path = require('path');
const { createKeyStore } = require('./muapiKeyStore');
const injector = require('./muapiKeyInjector');

let store;

function getStore() {
    if (!store) {
        store = createKeyStore({ safeStorage, filePath: path.join(app.getPath('userData'), 'muapi-key.bin') });
    }
    return store;
}

function register({ appOrigin }) {
    const keyStore = getStore();
    injector.attach(session.defaultSession, { appOrigin, getKey: () => keyStore.get() });

    ipcMain.handle('muapi:key:has', () => keyStore.has());
    ipcMain.handle('muapi:key:set', (_, key) => {
        keyStore.set(key);
        return true;
    });
    ipcMain.handle('muapi:key:clear', () => {
        keyStore.clear();
        return true;
    });
}

module.exports = { register, PLACEHOLDER_KEY: injector.PLACEHOLDER_KEY };
