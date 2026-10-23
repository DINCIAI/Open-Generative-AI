// Runs the Next.js app (all React studios, incl. Recast) as a child process bound
// to 127.0.0.1 so the Electron window can load it over http.
//
// The port is fixed by default: localStorage (history, drafts) is per origin, so a
// random port would make the app "forget" everything on each start. Only if that
// port is taken do we fall back to a free one.

const { spawn } = require('child_process');
const net = require('net');

const HOST = '127.0.0.1';
const DEFAULT_PORT = 37615;

function isPortFree(port, host = HOST) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.listen(port, host, () => server.close(() => resolve(true)));
    });
}

function getFreePort(host = HOST) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, host, () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

async function pickPort(preferred = DEFAULT_PORT, host = HOST) {
    if (await isPortFree(preferred, host)) return { port: preferred, fallback: false };
    return { port: await getFreePort(host), fallback: true };
}

async function waitForServer(url, { timeoutMs = 120_000, intervalMs = 500, fetchImpl = fetch, isAlive = () => true } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (!isAlive()) throw new Error('Next.js server exited during startup');
        try {
            const res = await fetchImpl(url, { redirect: 'manual' });
            if (res.status < 500) return;
        } catch {
            // not listening yet
        }
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Next.js server did not respond within ${Math.round(timeoutMs / 1000)}s at ${url}`);
}

function buildNextArgs(nextBin, mode, port) {
    if (mode !== 'dev' && mode !== 'start') throw new Error(`Unknown Next.js mode: ${mode}`);
    return [nextBin, mode, '--hostname', HOST, '--port', String(port)];
}

// `execPath` is the Electron binary; ELECTRON_RUN_AS_NODE makes it behave as node.
async function startNextServer({ root, mode, port, execPath = process.execPath, nextBin = require.resolve('next/dist/bin/next'), spawnImpl = spawn, waitImpl = waitForServer }) {
    const child = spawnImpl(execPath, buildNextArgs(nextBin, mode, port), {
        cwd: root,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NEXT_TELEMETRY_DISABLED: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    });
    let exited = false;
    child.once('exit', () => { exited = true; });
    child.stdout?.on('data', (d) => process.stdout.write(`[next] ${d}`));
    child.stderr?.on('data', (d) => process.stderr.write(`[next] ${d}`));

    const stop = () => killTree(child, () => exited);
    const origin = `http://${HOST}:${port}`;
    try {
        await waitImpl(`${origin}/studio`, { isAlive: () => !exited });
    } catch (err) {
        stop();
        throw err;
    }
    return { origin, stop };
}

// `next dev` forks worker processes; on Windows child.kill() would orphan them.
function killTree(child, hasExited, platform = process.platform) {
    if (hasExited() || !child.pid) return;
    if (platform === 'win32') {
        require('child_process').spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    } else {
        child.kill();
    }
}

module.exports = { HOST, DEFAULT_PORT, isPortFree, getFreePort, pickPort, waitForServer, buildNextArgs, startNextServer };
