import { expect, test } from 'bun:test';
import * as z from 'zod/mini';
import { findLocalUserInfo, userInfoFromOwner } from '../../src/shared/local-user';
import { needsDownloadUserId } from '../../src/shared/download-metadata';
import { DEFAULT_USER_SETTINGS } from '../../src/settings/schema';
import { modernMediaSchema } from '../../src/shared/instagram-data';
import { selectImageURL } from '../../src/features/post/image-source';

const metadata = { username: 'owner', sourceType: 'photo', filetype: 'jpg', shortcode: 'Post123', timestamp: 1700000000 };

test('ordinary image saving does not need a user lookup', () => {
    expect(needsDownloadUserId(metadata, DEFAULT_USER_SETTINGS, '%USERNAME%-%SHORTCODE%')).toBe(false);
    expect(needsDownloadUserId(metadata, { ...DEFAULT_USER_SETTINGS, AUTO_RENAME: false }, '%UID%')).toBe(false);
    expect(needsDownloadUserId(metadata, DEFAULT_USER_SETTINGS, '%uid%')).toBe(true);
    expect(needsDownloadUserId(metadata, { ...DEFAULT_USER_SETTINGS, MODIFY_RESOURCE_EXIF: true }, '%USERNAME%')).toBe(true);
    expect(needsDownloadUserId({ ...metadata, filetype: 'mp4' }, { ...DEFAULT_USER_SETTINGS, MODIFY_RESOURCE_EXIF: true }, '%USERNAME%')).toBe(false);
});

test('page user lookup matches the requested owner rather than the logged-in user', () => {
    const data = { viewer: { id: '111', username: 'viewer' }, edges: [{ node: { owner: { pk: 222, username: 'Owner' } } }] };
    expect(findLocalUserInfo(data, 'owner')?.user.id).toBe('222');
    expect(findLocalUserInfo(data, 'unknown')).toBeNull();
    expect(userInfoFromOwner({ username: 'owner' })).toBeNull();
    expect(userInfoFromOwner({ username: 'owner', id: 'invalid' })).toBeNull();
    expect(userInfoFromOwner({ username: 'owner', pk: Number.MAX_SAFE_INTEGER + 1 })).toBeNull();
});

test('local lookup terminates on cyclic data', () => {
    const data: { child?: unknown } = {};
    data.child = data;
    expect(findLocalUserInfo(data, 'owner')).toBeNull();
});

test('media parsing preserves owner identity for later downloads', () => {
    const media = z.parse(modernMediaSchema, { user: { username: 'owner', pk: '222' } });
    expect(userInfoFromOwner(media.user)?.user.id).toBe('222');
});

test('local images choose the largest advertised resource and reject video blob URLs', () => {
    expect(selectImageURL({ src: 'https://cdn.test/small.jpg', currentSrc: '', srcset: 'https://cdn.test/small.jpg 320w, https://cdn.test/full.jpg 1080w' })).toBe('https://cdn.test/full.jpg');
    expect(selectImageURL({ src: 'https://cdn.test/fallback.jpg', currentSrc: 'https://cdn.test/current.jpg', srcset: '' })).toBe('https://cdn.test/current.jpg');
    expect(selectImageURL({ src: 'blob:video', currentSrc: '', srcset: '' })).toBeNull();
});
