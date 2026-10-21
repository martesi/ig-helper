export function assertInstagramPostShortcode(value: unknown): asserts value is string {
    const valid = typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value);
    if (!valid) {
        throw new Error('NOPATH');
    }
}

export function getPostShortcodeFromURL(url: string | null | undefined): string | null {
    const segment = url?.match(/(?:^\/|instagram\.com\/)(?:[^/?#]+\/)?(?:p|reel)\/([^/?#;]+)/i)?.[1];
    // Private-share URLs append an access token to the normal shortcode.
    return segment && segment.length > 20 ? segment.slice(0, 11) : segment ?? null;
}
