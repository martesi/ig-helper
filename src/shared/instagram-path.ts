export function assertInstagramPostShortcode(value: unknown): asserts value is string {
    const valid = typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value);
    if (!valid) {
        throw new Error('NOPATH');
    }
}
