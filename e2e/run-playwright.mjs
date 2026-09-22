import { spawnSync } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const harness = path.join(root, '.agents', 'skills', 'e2e', 'scripts', 'harness.ts');
const endpoint = 'http://127.0.0.1:2000';

function run(command, args, env = process.env) {
    return spawnSync(command, args, {
        cwd: root,
        env,
        stdio: 'inherit',
    });
}

const start = run(process.execPath, [harness, 'start', '--session', 'playwright']);
if (start.status !== 0) process.exit(start.status ?? 1);

let status = 1;
try {
    const result = run('bunx', ['playwright', 'test', ...process.argv.slice(2)], {
        ...process.env,
        PLAYWRIGHT_CDP_ENDPOINT: endpoint,
    });
    status = result.status ?? 1;
} finally {
    const stop = run(process.execPath, [harness, 'stop']);
    if (status === 0 && stop.status !== 0) status = stop.status ?? 1;
}

process.exitCode = status;
