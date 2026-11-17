import { expect, test } from 'bun:test';
import { DEFAULT_RENAME_FORMAT } from '../../src/settings/schema';
import { getSaveFileName, type SaveMetadata } from '../../src/shared/download-filename';

function filenameFor(sourceType: string | undefined, filetype: string, format = '%SOURCE_TYPE%', autoRename = true) {
    const metadata: SaveMetadata = {
        username: 'owner',
        timestamp: 1700000000,
        filetype,
        shortcode: 'ABC123',
    };
    if (sourceType !== undefined) metadata.sourceType = sourceType;

    return getSaveFileName(`https://cdn.example.test/media.${filetype}`, metadata, {
        renameFormat: format,
        autoRename,
    });
}

test('filename media type is inferred from the downloaded file across media paths', () => {
    const cases: Array<[string, string | undefined, string, string]> = [
        ['post photo', 'photo', 'jpg', 'photo.jpg'],
        ['post video', 'video', 'mp4', 'video.mp4'],
        ['post fallback section', 'post', 'jpg', 'photo.jpg'],
        ['carousel photo', 'photo', 'jpg', 'photo.jpg'],
        ['carousel video', 'video', 'mp4', 'video.mp4'],
        ['reel video', 'reels', 'mp4', 'video.mp4'],
        ['reel image fallback', 'reels', 'jpg', 'photo.jpg'],
        ['story photo', 'stories', 'jpg', 'photo.jpg'],
        ['story video', 'stories', 'mp4', 'video.mp4'],
        ['highlight photo', 'highlights', 'jpg', 'photo.jpg'],
        ['highlight video', 'highlights', 'mp4', 'video.mp4'],
        ['avatar', 'avatar', 'jpg', 'photo.jpg'],
        ['thumbnail', 'thumbnail', 'jpg', 'photo.jpg'],
        ['DASH audio fallback', 'reels', 'm4a', 'video.m4a'],
        ['missing section metadata for photo', undefined, 'jpg', 'photo.jpg'],
        ['missing section metadata for video', undefined, 'mp4', 'video.mp4'],
        ['empty section metadata for photo', '', 'jpg', 'photo.jpg'],
    ];

    for (const [path, sourceType, filetype, expected] of cases) {
        expect(filenameFor(sourceType, filetype), path).toBe(expected);
    }
});

test('custom format can include the source section and retains unknown tokens', () => {
    expect(filenameFor('stories', 'mp4', '%SOURCE%-%SOURCE_TYPE%-%UNLISTED%'))
        .toBe('stories-video-%UNLISTED%.mp4');
});

test('uses the original filename when automatic renaming is disabled', () => {
    expect(filenameFor('stories', 'jpg', '%SOURCE_TYPE%', false)).toBe('owner_media.jpg');
});

test('applies the saved default rename format', () => {
    const date = new Date(1700000000 * 1000);
    const pad = (value: number) => value.toString().padStart(2, '0');
    const timestamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

    expect(filenameFor('stories', 'mp4', DEFAULT_RENAME_FORMAT))
        .toBe(`owner-video-ABC123-${timestamp}_media.mp4`);
});

test('handles token case and uppercase file extensions', () => {
    expect(filenameFor('mystery', 'MP4', '%source_type%')).toBe('video.MP4');
});

test('unexpected source labels do not affect the media kind', () => {
    const cases: Array<[string, string]> = [
        ['jpg', 'photo.jpg'],
        ['mp4', 'video.mp4'],
    ];

    for (const [filetype, expected] of cases) {
        expect(filenameFor('mystery', filetype), filetype).toBe(expected);
    }
});
