export function assertInstagramPostShortcode(value: unknown): asserts value is string {
    const valid = typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value);
    if (!valid) {
        throw new Error('NOPATH');
    }
}

export function getPostShortcodeFromURL(url: string | null | undefined): string | null {
    return url?.match(/(?:^\/|instagram\.com\/)(?:[^/?#]+\/)?(?:p|reel)\/([^/?#;]+)/i)?.[1] ?? null;
}
