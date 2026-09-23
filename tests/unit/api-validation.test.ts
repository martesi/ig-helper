import { expect, test } from 'bun:test';
import * as z from 'zod/mini';
import { assertInstagramPostShortcode } from '../../src/shared/instagram-path.ts';
import { modernMediaSchema } from '../../src/shared/instagram-data.ts';

test('validates Instagram post shortcodes before API requests', () => {
    expect(() => assertInstagramPostShortcode('Dabc_123-x')).not.toThrow();
    expect(() => assertInstagramPostShortcode('/p/shortcode')).toThrow();
    expect(() => assertInstagramPostShortcode('bad shortcode')).toThrow();
    expect(() => assertInstagramPostShortcode(null)).toThrow();
});

test('accepts null video fields in Instagram image carousel responses', () => {
    const image = {
        pk: '123',
        taken_at: 1700000000,
        video_dash_manifest: null,
        video_versions: null,
        image_versions2: { candidates: [{ url: 'https://example.test/image.jpg', width: 1080 }] },
    };
    const media = z.parse(modernMediaSchema, {
        pk: '456',
        code: 'Dc7Z80KGzLT',
        taken_at: 1700000000,
        owner: { username: 'example' },
        video_dash_manifest: null,
        video_versions: null,
        image_versions2: image.image_versions2,
        carousel_media: [image],
    });

    expect(media.video_versions).toBeNull();
    expect(media.carousel_media?.[0]?.video_versions).toBeNull();
    expect(media.carousel_media?.[0]?.image_versions2.candidates).toHaveLength(1);
});
