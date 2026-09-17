import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export async function loadLocalCookies(root = process.cwd()) {
    const files = await readdir(root);
    const json = files.includes('cookies.json') ? ['cookies.json'] : [];
    const netscape = files.filter(file => /^cookies.*\.txt$/i.test(file)).sort();
    const selected = json.length > 0 ? json : netscape;

    return (await Promise.all(selected.map(file => readCookieFile(path.join(root, file)))))
        .flat();
}

async function readCookieFile(file) {
    const source = await readFile(file, 'utf8');
    return file.endsWith('.json') ? parseJsonCookies(source) : parseNetscapeCookies(source);
}

function parseJsonCookies(source) {
    const parsed = JSON.parse(source);
    const cookies = Array.isArray(parsed) ? parsed : parsed.cookies;
    if (!Array.isArray(cookies)) throw new Error('cookies.json must contain an array or a { cookies: [] } object');

    return cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path ?? '/',
        expires: Math.floor(cookie.expirationDate ?? cookie.expires ?? -1),
        httpOnly: Boolean(cookie.httpOnly),
        secure: Boolean(cookie.secure),
        sameSite: normalizeSameSite(cookie.sameSite),
    })).filter(cookie => cookie.name && cookie.domain);
}

function parseNetscapeCookies(source) {
    return source.split(/\r?\n/).flatMap(line => {
        const httpOnly = line.startsWith('#HttpOnly_');
        if ((!httpOnly && line.startsWith('#')) || !line.trim()) return [];

        const fields = (httpOnly ? line.slice('#HttpOnly_'.length) : line).split('\t');
        if (fields.length < 7) return [];

        const [domain, , cookiePath, secure, expires, name, ...value] = fields;
        return [{
            name,
            value: value.join('\t'),
            domain,
            path: cookiePath || '/',
            expires: Number(expires) || -1,
            httpOnly,
            secure: secure.toUpperCase() === 'TRUE',
        }];
    });
}

function normalizeSameSite(value) {
    const normalized = String(value ?? '').toLowerCase();
    if (normalized === 'strict') return 'Strict';
    if (normalized === 'lax') return 'Lax';
    if (normalized === 'none' || normalized === 'no_restriction') return 'None';
    return undefined;
}
