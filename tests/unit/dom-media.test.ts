import { expect, test } from 'bun:test';
import { extractMediaFromDOM } from '../../src/shared/dom-media';

test('extractMediaFromDOM extracts video and manifest from video element React fiber', async () => {
    const previousDoc = globalThis.document;
    const shortcode = 'DePGjozSaez';
    const hdSrc = 'https://scontent.cdninstagram.com/o1/v/t2/video_hd.mp4';
    const sdSrc = 'https://scontent.cdninstagram.com/o1/v/t2/video_sd.mp4';
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period>
    <AdaptationSet contentType="video" mimeType="video/mp4">
      <Representation id="1" bandwidth="1500000" width="720" height="1280">
        <BaseURL>https://scontent.cdninstagram.com/o1/v/t2/dash_video.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

    const videoEl: Record<string, unknown> = {
        tagName: 'VIDEO',
        poster: 'https://cdn.example.test/poster.jpg',
        src: 'blob:https://www.instagram.com/blob-id',
        __reactFiber$test: {
            memoizedProps: {
                manifest,
                videoData: { hdSrc, sdSrc },
            },
        },
    };

    const containerEl: Record<string, unknown> = {
        tagName: 'DIV',
        dataset: { igHelperPostPath: shortcode, username: 'northidahoexperience' },
        getAttribute: (attr: string) => attr === 'data-username' ? 'northidahoexperience' : null,
        querySelector: (selector: string) => {
            if (selector === 'video') return videoEl;
            if (selector.includes('time')) return { getAttribute: () => '2024-10-08T12:00:00.000Z' };
            if (selector.includes('a[href*=')) return { href: `/p/${shortcode}/` };
            return null;
        },
    };

    globalThis.document = {
        querySelectorAll: () => [containerEl],
        querySelector: () => containerEl,
    } as unknown as Document;

    try {
        const media = extractMediaFromDOM(shortcode);
        expect(media).not.toBeNull();
        if (!media) return;

        expect(media.code).toBe(shortcode);
        expect(media.media_type).toBe(2);
        expect(media.owner.username).toBe('northidahoexperience');
        expect(media.video_dash_manifest).toBe(manifest);
        expect(media.video_versions?.length).toBeGreaterThanOrEqual(2);
        expect(media.video_versions?.some(v => v.url === hdSrc)).toBe(true);
        expect(media.video_versions?.some(v => v.url === sdSrc)).toBe(true);
        expect(media.image_versions2.candidates[0]?.url).toBe('https://cdn.example.test/poster.jpg');
    } finally {
        globalThis.document = previousDoc;
    }
});

test('extractMediaFromDOM extracts image post when no video exists', async () => {
    const previousDoc = globalThis.document;
    const shortcode = 'ImgPost123';
    const imgUrl = 'https://scontent.cdninstagram.com/v/photo.jpg';

    const imgEl = {
        tagName: 'IMG',
        src: imgUrl,
    };

    const containerEl: Record<string, unknown> = {
        tagName: 'DIV',
        dataset: { igHelperPostPath: shortcode },
        getAttribute: () => null,
        querySelector: (selector: string) => {
            if (selector === 'video') return null;
            if (selector.includes('img')) return imgEl;
            if (selector.includes('time')) return { getAttribute: () => '2024-10-08T12:00:00.000Z' };
            return null;
        },
    };

    globalThis.document = {
        querySelectorAll: () => [containerEl],
        querySelector: () => containerEl,
    } as unknown as Document;

    try {
        const media = extractMediaFromDOM(shortcode);
        expect(media).not.toBeNull();
        if (!media) return;

        expect(media.code).toBe(shortcode);
        expect(media.media_type).toBe(1);
        expect(media.image_versions2.candidates[0]?.url).toBe(imgUrl);
    } finally {
        globalThis.document = previousDoc;
    }
});
