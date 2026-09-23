import { expect, test } from 'bun:test';
import { assertInstagramPostShortcode } from '../../src/shared/instagram-path.ts';

test('validates Instagram post shortcodes before API requests', () => {
    expect(() => assertInstagramPostShortcode('Dabc_123-x')).not.toThrow();
    expect(() => assertInstagramPostShortcode('/p/shortcode')).toThrow();
    expect(() => assertInstagramPostShortcode('bad shortcode')).toThrow();
    expect(() => assertInstagramPostShortcode(null)).toThrow();
});
