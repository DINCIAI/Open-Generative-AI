const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const { register: registerLocalInference } = require('./lib/localInference');
const { register: registerWan2gp } = require('./lib/wan2gpProvider');
const { register: registerMuapiBridge } = require('./lib/muapiBridge');
const { pickPort, startNextServer } = require('./lib/nextServer');

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    try {
        dialog.showErrorBox('Open Generative AI — Unexpected Error', err && err.stack ? err.stack : String(err));
    } catch (_) {
        // dialog unavailable this early; the console log above is the fallback
    }
});

// Ubuntu 24.04+ sets kernel.apparmor_restrict_unprivileged_userns=1 which
// blocks Chromium's user namespace sandbox. The .deb package ships an AppArmor
// profile that grants the permission cleanly. When running the AppImage on an
// affected system, run once: sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
// or pass --no-sandbox on the command line.
if (process.platform === 'linux') {
    app.commandLine.appendSwitch('disable-dev-shm-usage');
}

let mainWindow;
let nextServer = null;

// The Next.js app hosts all React studios (incl. Recast). The legacy Vite UI in
// dist/ stays reachable via OGA_LEGACY_UI=1. Packaged builds don't bundle the
// Next server yet, so they keep the legacy UI for now.
const useNextApp = process.env.OGA_LEGACY_UI !== '1' && !app.isPackaged;

const LOADING_PAGE = 'data:text/html;charset=utf-8,' + encodeURIComponent(
    '<body style="margin:0;background:#0d0d0d;color:#888;font:14px sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">Studio wird gestartet …</body>'
);

async function loadNextApp(win) {
    win.loadURL(LOADING_PAGE);
    win.show();
    const { port, fallback } = await pickPort();
    if (fallback) console.warn(`Default port busy, using ${port}; local history from the default port is not visible.`);
    const mode = process.env.OGA_NEXT_MODE === 'start' ? 'start' : 'dev';
    nextServer = await startNextServer({ root: path.join(__dirname, '..'), mode, port });
    registerMuapiBridge({ appOrigin: nextServer.origin });
    // Keep the window on the local app; everything else opens in the browser.
    win.webContents.on('will-navigate', (event, url) => {
        if (new URL(url).origin !== nextServer.origin) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });
    await win.loadURL(`${nextServer.origin}/studio`);
}

function createWindow() {
    const isMac = process.platform === 'darwin';

    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 640,
        webPreferences: {
            webSecurity: true,
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.js'),
        },
        ...(isMac ? { titleBarStyle: 'hiddenInset' } : {}),
        backgroundColor: '#0d0d0d',
        show: false,
        title: 'Open Generative AI',
    });

    if (useNextApp) {
        loadNextApp(mainWindow).catch((err) => {
            console.error('Failed to start Next.js app:', err);
            dialog.showErrorBox('Studio konnte nicht starten', err && err.message ? err.message : String(err));
        });
    } else {
        const indexPath = path.join(__dirname, '../dist/index.html');
        mainWindow.loadFile(indexPath).catch((err) => {
            console.error('Failed to load index.html:', err);
            mainWindow.show();
        });
    }

    mainWindow.webContents.on('did-fail-load', (event, code, desc) => {
        console.error('did-fail-load:', code, desc);
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:/i.test(url)) shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    try {
        registerLocalInference();
        registerWan2gp();
    } catch (err) {
        console.error('Failed to register local-ai/wan2gp handlers:', err);
        dialog.showErrorBox(
            'Local AI features unavailable',
            `Open Generative AI started, but local model support failed to initialize:\n\n${err.message}`
        );
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('will-quit', () => {
    nextServer?.stop();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
