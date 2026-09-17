import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { loadLocalCookies } from './cookie-loader.js';

const repoRoot = process.cwd();
const runtimeDir = path.join(repoRoot, '.browser-state', 'agent-runtime');
const devPidFile = path.join(runtimeDir, 'dev.pid');
const devLogFile = path.join(runtimeDir, 'dev.log');
const xvfbPidFile = path.join(runtimeDir, 'xvfb.pid');
const xvfbLogFile = path.join(runtimeDir, 'xvfb.log');

const action = process.argv[2];
if (action === 'start') await start();
else if (action === 'stop') stop();
else throw new Error(`Unknown agent test action: ${action}`);

async function start() {
    mkdirSync(runtimeDir, { recursive: true });
    await ensureDisplay();
    if (!await devServersReady()) startDevServers();
    await waitForDevServers();
    runAgentBrowser(['--headed', 'open']);
    await importCookies();
    runAgentBrowser(['open', 'https://www.instagram.com/']);
    await sleep(500);
    focusInstagramTab();
}

function stop() {
    runAgentBrowser(['close'], { allowFailure: true });
    stopOwnedProcess(devPidFile);
    stopOwnedProcess(xvfbPidFile);
    rmSync(runtimeDir, { recursive: true, force: true });
}

async function ensureDisplay() {
    const display = process.env.DISPLAY ?? ':99';
    process.env.DISPLAY = display;
    if (spawnSync('xdpyinfo', { stdio: 'ignore' }).status === 0) return;

    if (!hasRunningProcess(xvfbPidFile)) {
        spawnOwned('Xvfb', [display, '-screen', '0', '1280x900x24', '-nolisten', 'tcp', '-noreset'], xvfbPidFile, xvfbLogFile);
    }

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        if (spawnSync('xdpyinfo', { stdio: 'ignore' }).status === 0) return;
        await sleep(100);
    }
    throw new Error(`Xvfb did not become ready; see ${xvfbLogFile}`);
}

function startDevServers() {
    if (!hasRunningProcess(devPidFile)) {
        spawnOwned('bun', ['run', 'dev'], devPidFile, devLogFile);
    }
}

function spawnOwned(command, args, pidFile, logFile) {
    const output = openSync(logFile, 'a');
    const child = spawn(command, args, {
        cwd: repoRoot,
        detached: true,
        stdio: ['ignore', output, output],
    });
    closeSync(output);
    writeFileSync(pidFile, String(child.pid));
    child.unref();
}

function hasRunningProcess(pidFile) {
    try {
        process.kill(Number(readFileSync(pidFile, 'utf8')), 0);
        return true;
    } catch {
        rmSync(pidFile, { force: true });
        return false;
    }
}

function stopOwnedProcess(pidFile) {
    if (!hasRunningProcess(pidFile)) return;
    const pid = Number(readFileSync(pidFile, 'utf8'));
    try {
        process.kill(-pid, 'SIGTERM');
    } catch (error) {
        if (error.code !== 'ESRCH') throw error;
    }
    rmSync(pidFile, { force: true });
}

async function devServersReady() {
    const urls = [
        'http://127.0.0.1:9000/__vite-plugin-monkey.install.user.js',
        'http://127.0.0.1:9100/settings/',
    ];
    const ready = await Promise.all(urls.map(async url => {
        try {
            return (await fetch(url)).ok;
        } catch {
            return false;
        }
    }));
    return ready.every(Boolean);
}

async function waitForDevServers() {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        if (await devServersReady()) return;
        await sleep(100);
    }
    throw new Error(`Dev servers did not become ready; see ${devLogFile}`);
}

async function importCookies() {
    const cookies = await loadLocalCookies(repoRoot);
    const byDomain = Map.groupBy(cookies, cookie => cookie.domain);
    const cookieFile = path.join(runtimeDir, 'cookies.json');

    try {
        for (const [domain, domainCookies] of byDomain) {
            writeFileSync(cookieFile, JSON.stringify(domainCookies.map(({ name, value }) => ({ name, value }))));
            runAgentBrowser(['cookies', 'set', '--curl', cookieFile, '--domain', domain]);
        }
    } finally {
        rmSync(cookieFile, { force: true });
    }
}

function focusInstagramTab() {
    const result = spawnSync('agent-browser', ['tab', 'list', '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error(`agent-browser exited with ${result.status}`);

    const tab = JSON.parse(result.stdout).data.tabs.find(item => item.url.startsWith('https://www.instagram.com/'));
    if (tab) runAgentBrowser(['tab', tab.tabId]);
}

function runAgentBrowser(args, { allowFailure = false } = {}) {
    const result = spawnSync('agent-browser', args, { cwd: repoRoot, stdio: 'inherit' });
    if (!allowFailure && result.status !== 0) {
        throw new Error(`agent-browser exited with ${result.status}`);
    }
}
