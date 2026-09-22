import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const harness = process.env.E2E_HARNESS_SCRIPT ?? path.join(root, '.agents/skills/e2e/scripts/harness.ts');
const config = path.join(root, '.config/arca.toml');
const mode = process.argv[2] ?? 'all';
const category = mode === 'ui' || mode === 'execution' ? `@${mode}` : null;

const runs = [];
if (mode !== 'auth') {
    runs.push([
        '--profile', 'anonymous', '--no-cookies', '--', 'test',
        ...(category ? ['--grep', category] : []),
        '--grep-invert', '@auth',
    ]);
}
if (mode !== 'anonymous') {
    runs.push([
        '--profile', 'default', '--', 'test', '--grep',
        category ? `(?=.*${category})(?=.*@auth)` : '@auth',
    ]);
}

let failed = false;
for (const args of runs) {
    const result = spawnSync(process.execPath, [harness, 'playwright', '--config', config, ...args], {
        cwd: root,
        env: process.env,
        stdio: 'inherit',
    });
    if (result.status !== 0) failed = true;
}

process.exitCode = failed ? 1 : 0;
