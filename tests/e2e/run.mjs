import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import { readFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const configPath = path.join(root, '.config/arca.toml');
const harness = process.env.E2E_HARNESS_SCRIPT ?? path.join(root, '.agents/skills/e2e/scripts/harness.ts');
const config = globalThis.Bun.TOML.parse(readFileSync(configPath, 'utf8'));
const mode = process.argv[2] ?? 'anonymous';
const category = mode === 'ui' ? '@ui' : ['execution', 'exe'].includes(mode) ? '@execution' : null;
const onlyProfile = { anonymous: 'anonymous', auth: 'default' }[mode];
if (!['all', 'ui', 'execution', 'exe', 'anonymous', 'auth'].includes(mode)) throw new Error(`Unknown E2E mode: ${mode}`);

const profiles = onlyProfile ? [onlyProfile] : ['anonymous', 'default'];
const endpoints = Object.fromEntries(profiles.map(profile => [
    profile,
    `http://127.0.0.1:${config.profile[profile].port ?? 2000}`,
]));
const env = { ...process.env, IG_HELPER_E2E_PROJECT_ENDPOINTS: JSON.stringify(endpoints) };
const run = (args, quiet = false) => {
    const result = spawnSync('node', [harness, '--config', configPath, ...args], {
        cwd: root,
        env,
        stdio: quiet ? ['ignore', 'ignore', 'inherit'] : 'inherit',
    });
    if (result.error) throw result.error;
    return result.status ?? 1;
};
const runConcurrent = args => new Promise((resolve, reject) => {
    const child = spawn('node', [harness, '--config', configPath, ...args], {
        cwd: root,
        env,
        stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('close', status => resolve(status ?? 1));
});

let failed = false;
for (const profile of profiles) {
    const args = ['start', '--profile', profile];
    if (profile === 'anonymous') args.push('--no-cookies');
    if (run([...args, '--'], true) !== 0) {
        failed = true;
        break;
    }
}

if (failed) process.exitCode = 1;
else {
    const results = await Promise.all(profiles.map(async profile => {
        const args = ['playwright', '--profile', profile, '--', 'test'];
        if (category) args.push('--grep', category);
        else if (mode === 'auth' || mode === 'all' && profile === 'default') args.push('--grep', '@auth');
        else if (mode === 'anonymous' || mode === 'all') args.push('--grep-invert', '@auth');
        args.push('--project', profile);
        return runConcurrent(args);
    }));
    process.exitCode = results.some(status => status !== 0) ? 1 : 0;
}
