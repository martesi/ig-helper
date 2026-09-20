import $ from 'jquery';
import * as Mediabunny from 'mediabunny';
import { USER_SETTING, state, $body } from "../settings/state";
import { _i18n } from "./i18n";
import { getPostOwner, getMediaInfo } from "./api";
import { getImageFromCache } from "../features/media/image-cache";
import { appendCounter, appendDownloadProgress, appendVolumeSlider, updateLoadingBar } from "./ui/status.jsx";
import { logger } from "./logger";
import { createSaveFileElement, saveFiles } from "./download";
export { saveFiles } from "./download";
import {
    DEFAULT_RENAME_FORMAT,
    DEFAULT_VIDEO_VOLUME,
    HOTKEY_SETTINGS,
    resolveDirectDownloadMode,
    SETTINGS_STORAGE_KEYS,
} from '../settings/schema.js';


/**
 * getStoryId
 * @description Obtain the media id through the resource URL.
 *
 * @param  {string}  url
 * @return {string}
 */
export function getStoryId(url) {
    let obj = new URL(url);
    let base64 = obj?.searchParams?.get('ig_cache_key')?.split('.').at(0);
    if (base64) {
        return atob(base64);
    }
    else {
        return null;
    }
}

/**
 * getTimeElementBaseDateSource
 * @description Get the base date text source and cache key from a time element.
 *
 * @param  {JQuery}  $time
 * @return {{dateText: ?string, cacheKey: ?string}}
 */
function getTimeElementBaseDateSource($time) {
    const titleText = $time.attr('title')?.trim();
    if (titleText) {
        return {
            dateText: titleText,
            cacheKey: `title:${titleText}`
        };
    }

    const datetime = $time.attr('datetime')?.trim();
    if (datetime) {
        const date = new Date(datetime);
        if (!Number.isNaN(date.getTime())) {
            return {
                dateText: new Intl.DateTimeFormat(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }).format(date),
                cacheKey: `datetime:${datetime}`
            };
        }
    }

    return {
        dateText: null,
        cacheKey: null
    };
}

/**
 * getTimeElementBaseDateText
 * @description Get the preserved absolute date text from a time element.
 *
 * @param  {JQuery}  $time
 * @return {?string}
 */
function getTimeElementBaseDateText($time) {
    const preservedText = $time.attr('data-ih-original-date')?.trim();
    const preservedKey = $time.attr('data-ih-original-date-key')?.trim();
    const { dateText, cacheKey } = getTimeElementBaseDateSource($time);

    if (preservedText && preservedKey && cacheKey && preservedKey === cacheKey) {
        return preservedText;
    }

    if (dateText && cacheKey) {
        $time.attr('data-ih-original-date', dateText);
        $time.attr('data-ih-original-date-key', cacheKey);
        return dateText;
    }

    return null;
}

/**
 * setTimeElementDateAndLocaleTime
 * @description Replace time element text with absolute date and localized time.
 *
 * @param  {JQuery}  $time
 * @return {void}
 */
export function setTimeElementDateAndLocaleTime($time) {
    if ($time == null || $time.length === 0) {
        return;
    }

    const datetime = $time.attr('datetime');
    if (!datetime) {
        return;
    }

    const date = new Date(datetime);
    if (Number.isNaN(date.getTime())) {
        return;
    }

    const dateText = getTimeElementBaseDateText($time);
    if (!dateText) {
        return;
    }

    const localeTime = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit'
    }).format(date);

    if (!localeTime) {
        return;
    }

    const finalText = `${dateText} ${localeTime}`;

    if ($time.text()?.trim() !== finalText) {
        $time.text(finalText);
        $time.css('white-space', 'break-spaces');
    }
}

/**
 * getHighlightCurrentTimeElement
 * @description Get the publish time element in the current highlight view.
 *
 * @param  {JQuery}  $element
 * @return {JQuery}
 */
export function getHighlightCurrentTimeElement($element) {
    if ($element == null || $element.length === 0) {
        $element = $body;
    }

    let $section = $element.closest('section:visible');
    if ($section.length === 0) {
        $section = $('body > div section:visible').last();
    }

    if ($section.length === 0) {
        return $();
    }

    let $times = $section.find('time[datetime]').filter(function () {
        const $time = $(this);

        return (
            $time.is(':visible') &&
            $time.closest('a[href^="/stories/highlights/"]').length === 0 &&
            $time.closest('[role="button"]').length === 0
        );
    });

    if ($times.length === 0) {
        return $();
    }

    return $times.first();
}

/**
 * getStoryProgress
 * @description Get the story progress of the username (post several stories).
 *
 * @param  {String}  username - Get progress of username
 * @return {Object}
 */
export function getStoryProgress(username) {
    const lowerUsername = username?.toLowerCase();
    let $header = $('body > div section:visible a[href^="/' + (username) + '"] span').filter(function () {
        const $this = $(this);
        return $this.children().length === 0 && $this.find('svg').length === 0 && $this.text()?.toLowerCase() === lowerUsername;
    }).parents('div:not([class]):not([style])').filter(function () {
        return $(this).text()?.toLowerCase() !== lowerUsername
    }).filter(function () {
        return $(this).children().length > 1
    }).first();

    if ($header.length === 0) {
        $header = $('body > div section:visible a[href^="/' + (username) + '"]').filter(function () {
            return $(this).find('img').length > 0
        }).parents('div:not([class]):not([style])').filter(function () {
            return $(this).text()?.toLowerCase() !== lowerUsername
        }).filter(function () {
            return $(this).children().length > 1
        }).first();
    }

    return $header.children().filter(function () {
        return $(this).height() < 10
    }).first().children();
}

/**
 * getStoryProgressIndex
 * @description Get the current story index and total count from Instagram's progress bar.
 *
 * @param  {Object}  $header - Progress bar items returned by getStoryProgress
 * @return {?Object}
 */
export function getStoryProgressIndex($header) {
    let current = 0;
    let total = $header.length;

    if (total === 0) {
        return null;
    }

    $header.each(function (index) {
        if ($(this).children().length > 0) {
            current = index + 1;
        }
    });

    if (current === 0) {
        return null;
    }

    return { current, total };
}

/**
 * setStoryProgressIndexText
 * @description Render the current story index and total count.
 *
 * @param  {Object}  $element - Element to append the counter to
 * @param  {Object}  $header - Progress bar items returned by getStoryProgress
 * @param  {String}  className - Counter class name
 * @return {void}
 */
export function setStoryProgressIndexText($element, $header, className) {
    let progress = getStoryProgressIndex($header);
    let $counter = $element.find('.' + className).first();

    if (progress == null || progress.total < 2) {
        if ($counter.length > 0) {
            $counter.remove();
        }
        return;
    }

    let text = progress.current + '/' + progress.total;
    let title = _i18n('ITEM_POSITION')
        .replace('%CURRENT%', progress.current)
        .replace('%TOTAL%', progress.total);

    if ($counter.length === 0) {
        $counter = $(appendCounter($element[0], className));
    }

    if ($counter.text() !== text) {
        $counter.text(text);
    }

    if ($counter.attr('title') !== title) {
        $counter.attr('title', title);
    }

    if ($counter.attr('aria-label') !== title) {
        $counter.attr('aria-label', title);
    }
}

/**
 * setStoryProgressIndexByUsername
 * @description Render current story index and total count from a username.
 *
 * @param  {Object}  $element - Element to append the counter to
 * @param  {String}  username - Story owner's username
 * @param  {String}  className - Counter class name
 * @return {void}
 */
export function setStoryProgressIndexByUsername($element, username, className) {
    if ($element == null || $element.length === 0 || username == null) {
        return;
    }

    let $header = getStoryProgress(username);
    setStoryProgressIndexText($element, $header, className);
}

/**
 * setDownloadProgress
 * @description Show and set download circle progress.
 *
 * @param  {Integer}  now
 * @param  {Integer}  total
 * @return {Void}
 */
export function setDownloadProgress(now, total) {
    // OPTIMIZATION: cache the circle wrapper lookup
    const $circle = $('.circle_wrapper');
    if ($circle.length) {
        $circle.find('span').text(`${now}/${total}`);

        if (now >= total) {
            $circle.fadeOut(250, function () {
                $(this).remove();
            });
        }
    }
    else {
        appendDownloadProgress(document.body, now, total);
    }
}

/**
 * saveFiles
 * @description Download the specified media URL to the computer.
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
 * @return {Promise}
 */
export function saveMediaThumbnail($element, fallbackPostPath = null) {
    const $link = $($element);
    let timestamp = Date.now();
    if (USER_SETTING.RENAME_PUBLISH_DATE && $link.attr('datetime')) {
        timestamp = $link.attr('datetime');
    }

    const mediaId = $link.attr('media-id');
    const cached = USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE ? getImageFromCache(mediaId) : null;
    const source = cached ?? $link.find('img').first().attr('src');
    if (!source) return Promise.resolve(false);

    if (cached) logger('[Restore Cached postThumbnail]', mediaId);

    return saveFiles(source, {
        username: $link.data('username'),
        sourceType: 'thumbnail',
        timestamp,
        filetype: 'jpg',
        shortcode: $link.data('path') ?? fallbackPostPath,
    });
}

/**
 * fetchArrayBuffer
 * @description Download URL as ArrayBuffer.
 *
 * @param {string} url
 * @return {Promise<ArrayBuffer>}
 */
async function fetchArrayBuffer(url) {
    updateLoadingBar(true);
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.arrayBuffer();
    } finally {
        updateLoadingBar(false);
    }
}

/**
 * parseDashManifest
 * @description Parse Media API video_dash_manifest (MPD XML).
 *              Returns best video/audio representation URLs.
 *
 * @param  {string} mpdXml
 * @return {{ video: any|null, audio: any|null }}
 */
function parseDashManifest(mpdXml) {
    try {
        if (!mpdXml || typeof mpdXml !== 'string') return { video: null, audio: null };

        const xml = new DOMParser().parseFromString(mpdXml, 'application/xml');
        if (xml.querySelector('parsererror')) return { video: null, audio: null };

        const reps = Array.from(xml.querySelectorAll('Representation'));
        const candidates = reps.map((rep) => {
            const base = rep.querySelector('BaseURL')?.textContent?.trim();
            if (!base) return null;

            const set = rep.closest('AdaptationSet');
            const mimeType = rep.getAttribute('mimeType') || set?.getAttribute('mimeType') || '';
            const contentType = set?.getAttribute('contentType') || '';
            const codecs = rep.getAttribute('codecs') || set?.getAttribute('codecs') || '';
            const bandwidth = parseInt(rep.getAttribute('bandwidth') || '0', 10) || 0;
            const width = parseInt(rep.getAttribute('width') || '0', 10) || 0;
            const height = parseInt(rep.getAttribute('height') || '0', 10) || 0;
            const id = rep.getAttribute('id') || '';

            return { id, url: base, mimeType, contentType, codecs, bandwidth, width, height };
        }).filter(Boolean);

        const isVideo = (c) => ((c.contentType || '').includes('video') || (c.mimeType || '').startsWith('video'));
        const isAudio = (c) => ((c.contentType || '').includes('audio') || (c.mimeType || '').startsWith('audio'));

        const bestVideo = candidates
            .filter(isVideo)
            .sort((a, b) => (b.height - a.height) || (b.bandwidth - a.bandwidth) || (b.width - a.width))[0] || null;

        const bestAudio = candidates
            .filter(isAudio)
            .sort((a, b) => (b.bandwidth - a.bandwidth))[0] || null;

        return { video: bestVideo, audio: bestAudio };
    } catch (e) {
        logger('[DASH]', 'parseDashManifest() error:', e);
        return { video: null, audio: null };
    }
}

/**
 * muxDashVideoAudioToMp4
 * @description Mux DASH video+audio into one MP4 using Mediabunny (demux + mux).
 *
 * @param {ArrayBuffer} videoBuf
 * @param {ArrayBuffer} audioBuf
 * @return {Promise<ArrayBuffer>}
 */
async function muxDashVideoAudioToMp4(videoBuf, audioBuf) {
    const MB = Mediabunny;

    const videoInput = new MB.Input({
        formats: [MB.MP4],
        source: new MB.BufferSource(videoBuf),
    });
    const audioInput = new MB.Input({
        formats: [MB.MP4],
        source: new MB.BufferSource(audioBuf),
    });

    const vTrack = await videoInput.getPrimaryVideoTrack();
    if (!vTrack || !vTrack.codec) throw new Error('No video track found');

    const aTrack = await audioInput.getPrimaryAudioTrack();
    if (!aTrack || !aTrack.codec) throw new Error('No audio track found');

    const vSink = new MB.EncodedPacketSink(vTrack);
    const aSink = new MB.EncodedPacketSink(aTrack);

    const output = new MB.Output({
        format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }),
        target: new MB.BufferTarget(),
    });

    const vSource = new MB.EncodedVideoPacketSource(vTrack.codec);
    const aSource = new MB.EncodedAudioPacketSource(aTrack.codec);

    output.addVideoTrack(vSource, { rotation: vTrack.rotation || 0 });
    output.addAudioTrack(aSource);

    await output.start();

    const vDecoderConfig = await vTrack.getDecoderConfig();
    const aDecoderConfig = await aTrack.getDecoderConfig();

    const vMeta = vDecoderConfig ? { decoderConfig: vDecoderConfig } : undefined;
    const aMeta = aDecoderConfig ? { decoderConfig: aDecoderConfig } : undefined;

    const vIter = vSink.packets();
    const aIter = aSink.packets();

    let vNext = await vIter.next();
    let aNext = await aIter.next();
    let vSentMeta = false;
    let aSentMeta = false;

    while (!vNext.done || !aNext.done) {
        const takeVideo = (() => {
            if (vNext.done) return false;
            if (aNext.done) return true;
            return vNext.value.timestamp <= aNext.value.timestamp;
        })();

        if (takeVideo) {
            await vSource.add(vNext.value, vSentMeta ? undefined : vMeta);
            vSentMeta = true;
            vNext = await vIter.next();
        } else {
            await aSource.add(aNext.value, aSentMeta ? undefined : aMeta);
            aSentMeta = true;
            aNext = await aIter.next();
        }
    }

    await output.finalize();

    const outBuf = output.target.buffer;
    if (outBuf instanceof ArrayBuffer) return outBuf;
    if (outBuf && outBuf.buffer) {
        return outBuf.buffer.slice(outBuf.byteOffset, outBuf.byteOffset + outBuf.byteLength);
    }
    throw new Error('Unexpected output buffer type');
}

async function downloadDashStreams(videoUrl, audioUrl, username, sourceType, timestamp, shortcode) {
    logger('[DASH]', 'downloadDashStreams()', {
        videoUrl: videoUrl,
        audioUrl: audioUrl || null,
        sourceType,
        shortcode
    });

    if (!audioUrl) {
        logger('[DASH]', 'Downloaded DASH video only (no audio rep / has_audio=false).');
        await saveFiles(videoUrl, {
            username,
            sourceType,
            timestamp,
            filetype: 'mp4',
            shortcode
        });
        return true;
    }

    try {
        logger('[DASH]', 'Fetching DASH streams for mux...');
        const [vBuf, aBuf] = await Promise.all([
            fetchArrayBuffer(videoUrl),
            fetchArrayBuffer(audioUrl)
        ]);

        logger('[DASH]', 'Muxing DASH video+audio into one MP4 (mp4box main thread)...');
        const mergedBuf = await muxDashVideoAudioToMp4(vBuf, aBuf);
        const mergedBlob = new Blob([mergedBuf], { type: 'video/mp4' });

        await createSaveFileElement(videoUrl, mergedBlob, { username, sourceType, timestamp, filetype: 'mp4', shortcode });
        logger('[DASH]', 'Merged MP4 download triggered.');
        return true;
    } catch (e) {
        logger('[DASH]', 'Mux failed -> fallback to separate downloads', e?.message || e);
        await saveFiles(videoUrl, {
            username,
            sourceType,
            timestamp,
            filetype: 'mp4',
            shortcode
        });
        await saveFiles(audioUrl, {
            username,
            sourceType,
            timestamp,
            filetype: 'm4a',
            shortcode
        });
        return true;
    }
}

/**
 * tryHandleDashFromMediaItem
 * @description Centralized DASH handling for Media API items.
 *              Uses video_dash_manifest when present.
 *              Picks best video by resolution (height/width), then bandwidth.
 *              Audio is optional.
 *
 * @return {Promise<boolean>} true if DASH path handled it, false to let caller fallback.
 */
export async function tryHandleDashFromMediaItem({
    mediaItem,
    username,
    sourceType,
    timestamp,
    shortcode,
    isPreview,
    index
}) {
    try {
        if (!USER_SETTING.PREFER_DASH_MANIFEST) return false;
        if (!USER_SETTING.FORCE_RESOURCE_VIA_MEDIA) return false;
        if (!mediaItem?.video_dash_manifest) return false;
        if (!mediaItem?.video_versions) return false;

        const best = parseDashManifest(mediaItem.video_dash_manifest);
        const vUrl = best?.video?.url || '';
        const aUrl = best?.audio?.url || '';

        if (!vUrl) {
            return false;
        }

        logger('[DASH]', 'best reps selected', {
            video: best.video ? { height: best.video.height, width: best.video.width, bandwidth: best.video.bandwidth, codecs: best.video.codecs } : null,
            audio: best.audio ? { bandwidth: best.audio.bandwidth, codecs: best.audio.codecs } : '(none)'
        });

        if (isPreview) {
            openNewTab(vUrl);
            return true;
        }

        if (!aUrl) {
            logger('[DASH]', 'download mode -> VIDEO-ONLY DASH (no audio rep)');
            await saveFiles(vUrl, {
                username,
                sourceType,
                timestamp,
                filetype: 'mp4',
                shortcode,
                index
            });
            return true;
        }

        logger('[DASH]', 'download mode -> DASH video+audio');
        await downloadDashStreams(vUrl, aUrl, username, sourceType, timestamp, shortcode);
        return true;
    } catch (e) {
        logger('[DASH]', 'tryHandleDashFromMediaItem failed -> fallback', e?.message || e);
        return false;
    }
}

/**
 * triggerDownload
 * @description Trigger download from Blob with filename.
 * 
 * @param {Blob} blob
 * @param {string} filename
 */
function getInstagramImageScale(url) {
    try {
        const stp = new URL(url).searchParams.get('stp') || '';
        const match = stp.match(/_[sp](\d+)x(\d+)(?:_|$)/);
        if (!match) return Infinity;
        return Math.max(Number(match[1]), Number(match[2]));
    }
    catch {
        return 0;
    }
}


/**
 * triggerLinkElement
 * @description Trigger the link element to start downloading or previewing the resource.
 *
 * @param  {Object}   element     - The element containing resource link metadata.
 * @param  {Boolean}  [isPreview] - True to preview in a new tab instead of downloading.
 * @return {void}
 */
export async function triggerLinkElement($element, isPreview = false) {
    try {
        const $el = $($element);

        let date = new Date().getTime();
        let timestamp = Math.floor(date / 1000);
        let username = $el.data('username') ? $el.data('username') : state.GL_username;
        let index = parseInt($el.attr('data-globalindex') || 0, 10) || 0;

        if (!username && $el.data('path')) {
            logger('catching owner name from shortcode', $el.data('href'));
            username = await getPostOwner($el.data('path')).catch(err => {
                logger('get username failed, replace with default string, error message', err?.message);
                return null;
            });
        }

        if (username == null) username = 'NONE';

        if (USER_SETTING.RENAME_PUBLISH_DATE && $el.attr('datetime')) {
            timestamp = parseInt($el.attr('datetime'), 10) || timestamp;
        }

        const mediaId = $el.attr('media-id') || $el.attr('data-media-id') || null;
        const sourceType = $el.data('name');
        const filetype = $el.data('type') || 'jpg';
        const shortcode = $el.data('path');
        const href = $el.data('href');

        const downloadOnly = !isPreview;

        if (!isPreview && index < 0) {
            alert(_i18n('NO_CHECK_RESOURCE'));
            return;
        }

        if (USER_SETTING.PREFER_DASH_MANIFEST && state.GL_mediaDataCache[mediaId]) {
            logger('Video Dash Stream, Processing video with DASH manifest', 'mediaId', mediaId);

            const handled = await tryHandleDashFromMediaItem(
                state.GL_mediaDataCache[mediaId],
                username,
                sourceType,
                timestamp,
                shortcode,
                downloadOnly ? false : isPreview,
                index
            );

            if (handled) return;
        }

        if (USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE) {
            const cached = getImageFromCache(mediaId);

            if (cached && filetype !== 'mp4') {
                if (!downloadOnly && isPreview) {
                    openNewTab(cached);
                } else {
                    await saveFiles(cached, {
                        username,
                        sourceType,
                        timestamp,
                        filetype: filetype || 'jpg',
                        shortcode,
                        index
                    });
                }
                return;
            }
        }

        if (USER_SETTING.FORCE_RESOURCE_VIA_MEDIA && mediaId) {
            updateLoadingBar(true);
            let result = await getMediaInfo(mediaId);
            updateLoadingBar(false);

            if (result?.status === 'ok') {
                let resource_url = null;
                // OPTIMIZATION: cache result.items[0]
                const mediaItem = result.items?.[0];

                if (mediaItem?.video_versions?.length) {
                    resource_url = mediaItem.video_versions[0].url;
                } else if (mediaItem?.image_versions2?.candidates?.length) {
                    mediaItem.image_versions2.candidates.sort(function (a, b) {
                        let aSTP = new URL(a.url).searchParams.get('stp');
                        let bSTP = new URL(b.url).searchParams.get('stp');

                        if (aSTP && bSTP) {
                            if (aSTP.length > bSTP.length) return 1;
                            if (aSTP.length < bSTP.length) return -1;
                        } else {
                            if ((a.width || 0) > (b.width || 0)) return 1;
                            if ((a.width || 0) < (b.width || 0)) return -1;
                        }

                        return 0;
                    });

                    resource_url = mediaItem.image_versions2.candidates[0].url;
                }

                if (!resource_url) {
                    alert('Cannot find download URL.');
                    return;
                }

                if (
                    href &&
                    filetype !== 'mp4' &&
                    getInstagramImageScale(href) > getInstagramImageScale(resource_url)
                ) {
                    resource_url = href;
                }

                if (!downloadOnly && isPreview) {
                    openNewTab(replaceSameOriginHost(resource_url));
                } else {
                    await saveFiles(resource_url, {
                        username,
                        sourceType,
                        timestamp,
                        filetype,
                        shortcode,
                        index
                    });
                }
                return;
            }

            if (USER_SETTING.FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED && href) {
                if (!downloadOnly && isPreview) {
                    openNewTab(replaceSameOriginHost(href));
                } else {
                    await saveFiles(href, {
                        username,
                        sourceType,
                        timestamp,
                        filetype,
                        shortcode,
                        index
                    });
                }
                return;
            }

            alert(`Fetch failed from Media API. API response message: ${result?.message}`);
            logger('triggerLinkElement()', 'Media API rejected request', result?.message);
            return;
        }

        if (href) {
            if (!downloadOnly && isPreview) {
                openNewTab(replaceSameOriginHost(href));
            } else {
                await saveFiles(href, {
                    username,
                    sourceType,
                    timestamp,
                    filetype,
                    shortcode,
                    index
                });
            }
            return;
        }

        alert('Cannot find download URL.');
    } catch (err) {
        logger('triggerLinkElement()', 'failed', err);
        logger('Occur error in triggerLinkElement:', err);
    }
}

/**
 * replaceSameOriginHost
 * @description Replace the host of the URL to bypass the same-origin policy for certain video resources that cannot be downloaded directly.
 *
 * @param  {string}  url
 * @return {string}
 */
export function replaceSameOriginHost(url) {
    // replace https://instagram.ftpe8-2.fna.fbcdn.net/ to https://scontent.cdninstagram.com/ becase of same origin policy (some video)
    var urlObj = new URL(url);
    urlObj.host = 'scontent.cdninstagram.com';

    return urlObj.href;
}

/**
 * openNewTab
 * @description Open URL in new tab.
 *
 * @param  {String}  link
 * @return {void}
 */
export function openNewTab(link) {
    var a = document.createElement('a');
    a.href = link;
    a.target = '_blank';

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => { updateLoadingBar(false); }, 125);
}

/**
 * initSettings
 * @description Initialize preferences.
 *
 * @return {void}
 */
export function initSettings() {
    for (const [name, fallback] of Object.entries(USER_SETTING)) {
        const value = name === 'DIRECT_DOWNLOAD_MODE'
            ? resolveDirectDownloadMode(
                GM_getValue(name),
                GM_getValue('DIRECT_DOWNLOAD_VISIBLE_RESOURCE'),
                GM_getValue('DIRECT_DOWNLOAD_ALL')
            )
            : GM_getValue(name);
        if (typeof value === typeof fallback) USER_SETTING[name] = value;
    }

    state.videoVolume = USER_SETTING.MODIFY_VIDEO_VOLUME
        ? Number(GM_getValue(SETTINGS_STORAGE_KEYS.videoVolume, DEFAULT_VIDEO_VOLUME))
        : DEFAULT_VIDEO_VOLUME;
    state.fileRenameFormat = GM_getValue(SETTINGS_STORAGE_KEYS.renameFormat, DEFAULT_RENAME_FORMAT);
    state.lang = GM_getValue(SETTINGS_STORAGE_KEYS.language, state.lang);

    for (const config of HOTKEY_SETTINGS) {
        state[config.stateKey] = Number(GM_getValue(config.storageKey, config.defaultKeyCode));
    }
}


/**
 * toggleVolumeSilder
 * @description Toggle display of custom volume slider.
 *
 * @param  {object}  $videos
 * @param  {object}  $buttonParent
 * @param  {string}  loggerType
 * @param  {string}  customClass
 * @return {void}
 */
export function toggleVolumeSilder($videos, $buttonParent, loggerType, customClass = "") {
    if (!$buttonParent?.length) return;

    // OPTIMIZATION: cache the volume_slider lookup
    let $existingSlider = $buttonParent.find('div.volume_slider');
    if ($existingSlider.length === 0) {
        const slider = appendVolumeSlider($buttonParent[0], Number(state.videoVolume), customClass);
        const $newSlider = $(slider);
        const $sliderInput = $newSlider.find('input');
        $sliderInput.attr('style', `--ig-track-progress: ${(state.videoVolume * 100) + '%'}`);
        $sliderInput.on('input', function () {
            const $this = $(this);
            var percent = ($this.val() * 100) + '%';

            state.videoVolume = $this.val();
            GM_setValue('G_VIDEO_VOLUME', $this.val());

            $this.attr('style', `--ig-track-progress: ${percent}`);

            $videos.each(function () {
                logger(`(${loggerType})`, 'video volume changed #slider');
                this.volume = state.videoVolume;
            });
        });

        $sliderInput.on('mouseenter', function () {
            const $this = $(this);
            var percent = (state.videoVolume * 100) + '%';
            $this.attr('style', `--ig-track-progress: ${percent}`);
            $this.val(state.videoVolume);


            $videos.each(function () {
                logger(`(${loggerType})`, 'video volume changed #slider');
                this.volume = state.videoVolume;
            });
        });

        $newSlider.on('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
        });
    }
    else {
        $existingSlider.remove();
    }
}

/**
 * triggerReactClickHandler
 * @description Trigger React onClick event handler for the given element.
 *
 * @param {HTMLElement} el 
 */
export function triggerReactClickHandler(el) {
    const reactKey = Object.keys(el).find(k => k.startsWith('__reactProps') || k.startsWith('__reactEventHandlers'));
    const props = el[reactKey];

    if (props && typeof props.onClick === 'function') {
        const mockEvent = {
            target: el,
            currentTarget: el,
            preventDefault: () => { },
            stopPropagation: () => { },
            nativeEvent: new MouseEvent('click')
        };

        props.onClick(mockEvent);
    } else {
        logger('No React click handler found for the element:', el);
    }
};

// /**
//  * getPointerElement
//  * @description Get the element at the pointer position and check if it is the target element or if it is covered by another element.
//  *
//  * @param {JQuery<HTMLElement>} $target 
//  * @param {number} clientX
//  * @param {number} clientY
//  */
// export function getPointerElement($target, clientX, clientY) {
//     let element = $target.get(0);
//     const rect = element.getBoundingClientRect();

//     const viewportWidth = window.innerWidth;
//     const viewportHeight = window.innerHeight;

//     const visibleX = Math.max(rect.left, 0) + (Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0)) / 2;
//     const visibleY = Math.max(rect.top, 0) + (Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)) / 2;

//     if (visibleX < 0 || visibleX > viewportWidth || visibleY < 0 || visibleY > viewportHeight) {
//         if (clientX == null || clientY == null) {
//             return { self: false, topElement: null, target: $target, error: 'out_of_viewport', rect };
//         }
//     }

//     const topElement = document.elementFromPoint(clientX || visibleX, clientY || visibleY);

//     if ($(topElement).height() > document.body.clientHeight) {
//         return { self: false, topElement: null, target: $target, error: 'oversize_element', rect };
//     }

//     if ($(topElement).width() < 100 || $(topElement).height() < 100) {
//         return { self: false, topElement: null, target: $target, error: 'small_element', rect };
//     }

//     if (topElement && topElement !== element && !element.contains(topElement)) {
//         if ($(topElement).find($target).length > 0) {
//             // return { self: false, topElement, target: $target };
//             return { self: false, topElement: null, target: $target, error: 'covered_by_element', rect };
//         }

//         if ($(topElement).width() != $target.width() || $(topElement).height() != $target.height()) {
//             return { self: false, topElement: null, target: $target, error: 'different_dimensions', rect };
//         }


//         // return { self: false, topElement: null, target: $target, error: 'none_of_element', rect };
//         return { self: false, topElement, target: $target };
//     } else {
//         return { self: true, topElement, target: $target };
//     }
// }
