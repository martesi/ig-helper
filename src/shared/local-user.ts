import * as z from 'zod/mini';
import { Effect } from 'effect';
import type { UserInfo } from './instagram-data';

export const mediaOwnerSchema = z.object({
    username: z.string(),
    id: z.nullish(z.union([z.string(), z.number()])),
    pk: z.nullish(z.union([z.string(), z.number()])),
    profile_pic_url: z.nullish(z.string()),
});

export function userInfoFromOwner(value: unknown): UserInfo | null {
    const parsed = z.safeParse(mediaOwnerSchema, value);
    if (!parsed.success) return null;
    const owner = parsed.data;
    const rawId = owner.id ?? owner.pk ?? '';
    if (typeof rawId === 'number' && !Number.isSafeInteger(rawId)) return null;
    const id = String(rawId);
    if (!/^\d+$/.test(id)) return null;
    return { user: { username: owner.username, id, pk: String(owner.pk ?? id), profile_pic_url: owner.profile_pic_url ?? '' } };
}

export function findLocalUserInfo(value: unknown, username: string): UserInfo | null {
    const pending: unknown[] = [value];
    const visited = new WeakSet<object>();
    // Page data may contain large payloads or cyclic React objects. Bound the scan.
    for (let count = 0; pending.length && count < 10000; count++) {
        const node = pending.pop();
        if (!node || typeof node !== 'object' || visited.has(node)) continue;
        visited.add(node);
        const user = userInfoFromOwner(node);
        if (user?.user.username.toLowerCase() === username.toLowerCase()) return user;
        pending.push(...Object.values(node).slice(0, 10000 - count - pending.length));
    }
    return null;
}

export function getPageUserInfo(username: string): UserInfo | null {
    if (!username) return null;
    for (const script of document.querySelectorAll('script[type="application/json"]')) {
        const data = Effect.runSync(Effect.try({
            try: (): unknown => JSON.parse(script.textContent || ''),
            catch: () => null,
        }).pipe(Effect.catchCause(() => Effect.succeed(null))));
        const user = findLocalUserInfo(data, username);
        if (user) return user;
    }
    return null;
}
