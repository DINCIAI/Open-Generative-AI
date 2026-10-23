const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const { EventEmitter } = require('events');

const { HOST, buildNextArgs, pickPort, waitForServer, startNextServer } = require('../electron/lib/nextServer');

test('next is always bound to 127.0.0.1', () => {
    assert.deepEqual(buildNextArgs('/n/next', 'dev', 4000), ['/n/next', 'dev', '--hostname', '127.0.0.1', '--port', '4000']);
    assert.equal(buildNextArgs('/n/next', 'start', 4000)[1], 'start');
    assert.throws(() => buildNextArgs('/n/next', 'build', 4000), /Unknown/);
});

test('pickPort keeps a free preferred port and falls back when it is taken', async () => {
    const blocker = net.createServer();
    await new Promise((r) => blocker.listen(0, HOST, r));
    const busy = blocker.address().port;
    try {
        const fallback = await pickPort(busy);
        assert.equal(fallback.fallback, true);
        assert.notEqual(fallback.port, busy);
    } finally {
        await new Promise((r) => blocker.close(r));
    }
    const free = await pickPort(busy);
    assert.deepEqual(free, { port: busy, fallback: false });
});

test('waitForServer retries until the server answers', async () => {
    let calls = 0;
    const fetchImpl = async () => {
        calls++;
        if (calls < 3) throw new Error('ECONNREFUSED');
        return { status: 200 };
    };
    await waitForServer('http://x', { fetchImpl, intervalMs: 1 });
    assert.equal(calls, 3);
});

test('waitForServer gives up if the process dies or time runs out', async () => {
    const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
    await assert.rejects(waitForServer('http://x', { fetchImpl, intervalMs: 1, isAlive: () => false }), /exited/);
    await assert.rejects(waitForServer('http://x', { fetchImpl, intervalMs: 1, timeoutMs: 10 }), /did not respond/);
});

test('startNextServer runs electron as node with telemetry off', async () => {
    let spawned;
    const spawnImpl = (cmd, args, opts) => {
        const child = new EventEmitter();
        child.pid = undefined; // nothing real to kill
        spawned = { cmd, args, opts };
        return child;
    };
    const server = await startNextServer({
        root: '/repo', mode: 'dev', port: 4100, execPath: '/electron', nextBin: '/n/next',
        spawnImpl, waitImpl: async () => {},
    });
    assert.equal(server.origin, 'http://127.0.0.1:4100');
    assert.equal(spawned.cmd, '/electron');
    assert.equal(spawned.opts.cwd, '/repo');
    assert.equal(spawned.opts.env.ELECTRON_RUN_AS_NODE, '1');
    assert.equal(spawned.opts.env.NEXT_TELEMETRY_DISABLED, '1');
    server.stop();
});
