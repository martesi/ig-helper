import { USER_SETTING, state, userIdCache } from '../settings/state';
import { getUserId } from './api';
import { logger } from './logger';
import { updateLoadingBar } from './ui/status.jsx';

export function saveFiles(downloadLink, metadata) {
    return new Promise(resolve => {
        setTimeout(() => {
            updateLoadingBar(true);

            const downloadName = getSaveFileName(downloadLink, metadata);
            const { filetype, shortcode, sourceType } = metadata;

            const finish = success => {
                updateLoadingBar(false);
                resolve(success);
            };

            if (
                USER_SETTING.MODIFY_RESOURCE_EXIF &&
                filetype === 'jpg' &&
                shortcode &&
                sourceType === 'photo'
            ) {
                fetch(downloadLink)
                    .then(res => {
                        if (!res.ok) throw new Error(`Download failed with HTTP ${res.status}`);
                        return res.blob();
                    })
                    .then(dwel => createSaveFileElement(downloadLink, dwel, metadata))
                    .then(() => finish(true))
                    .catch(err => {
                        logger('saveFiles()', 'failed', err);
                        finish(false);
                    });
                return;
            }

            if (USER_SETTING.USE_EXTERNAL_DOWNLOAD_MODE) {
                GM_download({
                    url: downloadLink,
                    name: downloadName,
                    onload: () => finish(true),
                    onerror: err => {
                        logger('saveFiles()', 'failed', err);
                        finish(false);
                    },
                });
                return;
            }

            fetch(downloadLink)
                .then(res => {
                    if (!res.ok) throw new Error(`Download failed with HTTP ${res.status}`);
                    return res.blob();
                })
                .then(dwel => createSaveFileElement(downloadLink, dwel, metadata))
                .then(() => finish(true))
                .catch(err => {
                    logger('saveFiles()', 'failed', err);
                    finish(false);
                });
        }, 50);
    });
}

export function triggerDownload(blob, filename) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);

        if (USER_SETTING.USE_EXTERNAL_DOWNLOAD_MODE) {
            GM_download({
                url: url,
                name: filename,
                onload: () => {
                    URL.revokeObjectURL(url);
                    resolve();
                },
                onerror: error => {
                    URL.revokeObjectURL(url);
                    reject(error instanceof Error ? error : new Error('GM_download failed'));
                },
            });
        }
        else {
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.rel = "noopener";
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                // eslint-disable-next-line no-unused-vars
                try { document.body.removeChild(link); } catch (e) { /* noop */ }
                URL.revokeObjectURL(url);
                resolve();
            }, 250);
        }
    });
}

/**
 * getSaveFileName
 * @description Get the file name for downloaded media according to the user settings and resource information.
 *
 * @param  {String}  downloadLink
 * @param  {Object}  metadata
 * @param  {String}  metadata.username
 * @param  {String}  metadata.sourceType
 * @param  {Integer}  metadata.timestamp
 * @param  {String}  metadata.filetype
 * @param  {String}  metadata.shortcode
 * @param  {Integer|null}  metadata.index
 * @param  {String|null}  metadata.uid
 * @return {String}  The generated filename
 */
export function getSaveFileName(downloadLink, metadata) {
    let { username, sourceType, timestamp, filetype, shortcode, index, uid } = metadata;
    timestamp = parseInt(timestamp.toString().padEnd(13, '0'));
    index = (index != null) ? index : 0;

    const date = new Date(timestamp);

    const original_name = new URL(downloadLink).pathname.split('/').at(-1).split('.').slice(0, -1).join('.');
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const second = date.getSeconds().toString().padStart(2, '0');

    var filename = state.fileRenameFormat.replace(/%([^%]+)%/g, (match, content) => {
        return `%${content.toUpperCase()}%`;
    });

    var replacements = {
        '%USERNAME%': username,
        '%SOURCE_TYPE%': sourceType,
        '%SHORTCODE%': shortcode || '',
        '%YEAR%': year,
        '%2-YEAR%': year.substr(-2),
        '%MONTH%': month,
        '%DAY%': day,
        '%HOUR%': hour,
        '%MINUTE%': minute,
        '%SECOND%': second,
        '%ORIGINAL_NAME%': original_name,
        '%ORIGINAL_NAME_FIRST%': original_name.split('_').at(0),
        '%INDEX%': index.toString(),
        '%UID%': uid || '',
    };

    // eslint-disable-next-line no-useless-escape
    filename = filename.replace(/%[\w\-]+%/g, function (str) {
        if (replacements[str] == null) {
            return str;
        }

        return replacements[str];
    });

    const originally = username + '_' + original_name + '.' + filetype;
    const downloadName = USER_SETTING.AUTO_RENAME ? filename + '.' + filetype : originally;

    return downloadName;
}


/**
 * createSaveFileElement
 * @description Download the specified media with link element.
 *
 * @param  {String}  downloadLink
 * @param  {Object}  object
 * @param  {Object}  metadata
 * @param  {String}  metadata.username
 * @param  {String}  metadata.sourceType
 * @param  {Integer}  metadata.timestamp
 * @param  {String}  metadata.filetype
 * @param  {String}  metadata.shortcode
 * @param  {Integer|null}  metadata.index
 * @param  {String|null}  metadata.uid
 * @return {void}
 */
export async function createSaveFileElement(downloadLink, object, metadata) {
    let { username, sourceType, filetype, shortcode } = metadata;

    if (metadata.uid == null) {
        username = metadata.username;
        if (!userIdCache.has(username)) {
            userIdCache.set(username, getUserId(username));
        }
        try {
            const userInfo = await userIdCache.get(username);
            metadata.uid = userInfo?.user?.id ?? null;
            // eslint-disable-next-line no-unused-vars
        } catch (err) {
            userIdCache.delete(username);
            metadata.uid = null;
        }
    }

    const downloadName = getSaveFileName(downloadLink, metadata);

    if (
        USER_SETTING.MODIFY_RESOURCE_EXIF &&
        filetype === 'jpg' &&
        shortcode &&
        sourceType === 'photo' &&
        (object.type === 'image/jpeg' || object.type === 'image/webp')
    ) {
        try {
            const newBlob = await changeExifData(object, metadata);
            await triggerDownload(newBlob, downloadName);
        } catch (err) {
            logger('createSaveFileElement()', 'EXIF processing failed; falling back to original blob', err);
            await triggerDownload(object, downloadName);
        }
        return;
    }
    else {
        await triggerDownload(object, downloadName);
    }
}

/**
 * changeExifData
 * @description Strips EXIF metadata and attaches post URLs to the EXIF of downloaded image resources.
 *
 * @param  {Object}  blob
 * @param  {Object}  metadata
 * @param  {String}  metadata.username
 * @param  {String}  metadata.sourceType
 * @param  {Integer}  metadata.timestamp
 * @param  {String}  metadata.filetype
 * @param  {String}  metadata.shortcode
 * @param  {Integer|null}  metadata.index
 * @param  {String}  metadata.uid
 * @return {Blob}
 */
async function changeExifData(blob, metadata) {
    const concat = (...arr) => {
        const len = arr.reduce((s, a) => s + a.length, 0);
        const out = new Uint8Array(len);
        let p = 0;
        for (const a of arr) {
            out.set(a, p);
            p += a.length;
        }
        return out;
    };
    const u32le = v => {
        const b = new Uint8Array(4);
        new DataView(b.buffer).setUint32(0, v, true);
        return b;
    };
    const u16le = v => {
        const b = new Uint8Array(2);
        new DataView(b.buffer).setUint16(0, v, true);
        return b;
    };
    const enc = s => new TextEncoder().encode(s);
    const encUtf16le = s => {
        const out = new Uint8Array(s.length * 2);
        for (let i = 0; i < s.length; i++) {
            const code = s.charCodeAt(i);
            out[i * 2] = code & 0xFF;
            out[i * 2 + 1] = (code >> 8) & 0xFF;
        }
        return out;
    };
    const formatExifDate = ts => {
        let parsed = Number(ts);
        if (!Number.isFinite(parsed)) {
            parsed = Date.now();
        }
        if (parsed < 1e12) {
            parsed *= 1000;
        }

        const date = new Date(parsed);
        if (Number.isNaN(date.getTime())) {
            return '1970:01:01 00:00:00';
        }

        const y = String(date.getFullYear()).padStart(4, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        return `${y}:${m}:${d} ${hh}:${mm}:${ss}`;
    };
    const makeIFDEntry = (tag, type, count, valueOrOffset) =>
        concat(u16le(tag), u16le(type), u32le(count), u32le(valueOrOffset));
    const fourCC = (dv, o) =>
        String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));

    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const isJPEG = head[0] === 0xFF && head[1] === 0xD8;
    const isWEBP = head.length >= 12 &&
        String.fromCharCode(...head.subarray(0, 4)) === 'RIFF' &&
        String.fromCharCode(...head.subarray(8, 12)) === 'WEBP';
    if (!isJPEG && !isWEBP) throw new Error('Not a JPEG or WEBP');

    const exifDateString = `${formatExifDate(metadata.timestamp)}\0`;
    const username = `${(metadata.username || 'unknown').toString()}\0`;
    const url = `https://www.instagram.com/p/${metadata.shortcode}/`;
    const commentUrl = `https://www.instagram.com/uid/${metadata.uid || 'unknown'}`;

    const dateBytes = enc(exifDateString);
    const artistBytes = enc(username);
    const keywordBytes = encUtf16le(`${url}\0`);
    const xpCommentBytes = encUtf16le(`${commentUrl}\0`);

    const exifPrefix = enc('Exif\0\0');
    const tiffHeader = Uint8Array.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00]);

    const ifd0Count = 4;
    const exifIfdCount = 1;

    const ifd0Size = 2 + (ifd0Count * 12) + 4;
    const exifIfdOffset = 8 + ifd0Size;
    const exifIfdSize = 2 + (exifIfdCount * 12) + 4;
    const dataStartOffset = 8 + ifd0Size + exifIfdSize;

    const artistOffset = dataStartOffset;
    const keywordOffset = artistOffset + artistBytes.length;
    const xpCommentOffset = keywordOffset + keywordBytes.length;
    const dateOffset = xpCommentOffset + xpCommentBytes.length;

    const ifd0 = concat(
        u16le(ifd0Count),
        makeIFDEntry(0x013B, 2, artistBytes.length, artistOffset),                 // Artist
        makeIFDEntry(0x8769, 4, 1, exifIfdOffset),                                 // Exif Offset
        makeIFDEntry(0x9C9C, 1, xpCommentBytes.length, xpCommentOffset),           // XPComment
        makeIFDEntry(0x9C9E, 1, keywordBytes.length, keywordOffset),               // XPKeywords
        u32le(0)
    );

    const exifIfd = concat(
        u16le(exifIfdCount),
        makeIFDEntry(0x9003, 2, dateBytes.length, dateOffset),
        u32le(0)
    );

    const tiffBody = concat(tiffHeader, ifd0, exifIfd, artistBytes, keywordBytes, xpCommentBytes, dateBytes);

    if (isJPEG) {
        const ab = await blob.arrayBuffer();
        const dv = new DataView(ab);
        const app1Body = concat(exifPrefix, tiffBody);
        const app1Header = new Uint8Array(4);
        new DataView(app1Header.buffer).setUint16(0, 0xFFE1);
        new DataView(app1Header.buffer).setUint16(2, app1Body.length + 2);
        const newAPP1 = concat(app1Header, app1Body);

        const parts = [new Uint8Array(ab, 0, 2)];
        let off = 2,
            added = false;
        while (off < dv.byteLength) {
            const marker = dv.getUint16(off);
            if ((marker & 0xFF00) !== 0xFF00) break;
            if (marker === 0xFFDA) {
                if (!added) parts.push(newAPP1);
                parts.push(new Uint8Array(ab, off));
                break;
            }
            const len = dv.getUint16(off + 2) + 2;
            if (marker === 0xFFE1) {
                off += len;
                continue;
            }
            parts.push(new Uint8Array(ab, off, len));
            off += len;
        }
        const total = parts.reduce((s, a) => s + a.length, 0);
        const out = new Uint8Array(total);
        let p = 0;
        parts.forEach(a => {
            out.set(a, p);
            p += a.length;
        });
        return new Blob([out], {
            type: 'image/jpeg'
        });
    }

    const ab = await blob.arrayBuffer();
    const dv = new DataView(ab);
    const chunks = [];
    let vp8xIdx = -1;
    let offset = 12;
    while (offset < dv.byteLength) {
        const cc = fourCC(dv, offset);
        const sz = dv.getUint32(offset + 4, true);
        const pad = sz & 1;
        const full = 8 + sz + pad;
        if (cc !== 'EXIF' && cc !== 'XMP ') {
            chunks.push(new Uint8Array(ab, offset, full));
            if (cc === 'VP8X') vp8xIdx = chunks.length - 1;
        }
        offset += full;
    }
    let exifChunk = concat(
        enc('EXIF'),
        u32le(exifPrefix.length + tiffBody.length),
        exifPrefix,
        tiffBody
    );
    if (exifChunk.length & 1) exifChunk = concat(exifChunk, Uint8Array.of(0));
    if (vp8xIdx !== -1) {
        const vp8x = new Uint8Array(chunks[vp8xIdx]);
        vp8x[8] |= 0x10;
        chunks[vp8xIdx] = vp8x;
        chunks.splice(vp8xIdx + 1, 0, exifChunk);
    } else {
        chunks.push(exifChunk);
    }
    const payload = chunks.reduce((s, c) => s + c.length, 0);
    const riffHeader = concat(enc('RIFF'), u32le(payload + 4), enc('WEBP'));
    const finalBuf = concat(riffHeader, ...chunks);
    return new Blob([finalBuf], {
        type: 'image/webp'
    });
}

