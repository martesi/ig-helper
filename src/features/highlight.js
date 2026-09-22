import $ from 'jquery';
import { DIRECT_DOWNLOAD_MODE_OPTIONS, USER_SETTING, state } from "../settings/state";
import {
    openNewTab,
    saveFiles, getStoryProgress,
    tryHandleDashFromMediaItem,
    getHighlightCurrentTimeElement, setTimeElementDateAndLocaleTime,
    setStoryProgressIndexText, setStoryProgressIndexByUsername
} from "../shared/general";
import { updateLoadingBar } from "../shared/ui/status.jsx";
import { logger } from "../shared/logger";
import { getHighlightStories, getMediaInfo } from "../shared/api";
import { downloadStoryResources } from "./story";
import { getImageFromCache } from "./media/image-cache";
import { mountMediaControls } from './post/controls.jsx';

/**
 * getHighlightsStoryUsername
 * @description Get the current highlight story owner's username.
 *
 * @return {?String}
 */
function getHighlightsStoryUsername() {
    let href = $('body > div section:visible a[href^="/"]').filter(function () {
        return $(this).attr('href').split('/').filter(e => e.length > 0).length === 1
    }).first().attr('href');

    return href?.split('/').filter(e => e.length > 0).at(0);
}

function findHighlightControlElement() {
    let $element = $('body > div section:visible._ac0a');
    if ($element.length === 0) {
        $element = $('body > div section:visible > div > div[style]:not([class])');
    }
    if ($element.length === 0) {
        $element = $('div[id^="mount"] section > div > a[href="/"]').parent().parent().parent()
            .find('section:visible > div > div[style]:not([class])');
    }
    if ($element.length === 0) {
        $element = $('div[id^="mount"] section > div > a[href="/"]').parent().parent().parent()
            .find('section:visible > div div[style]:not([class]) > div:not([data-visualcompletion="loading-state"])');
    }
    if ($element.length === 0) {
        $element = $('div[id^="mount"] section > div a[href="/"]').parents('section:visible')
            .find('div[style]:not([class])');
    }
    if ($element.length === 0) {
        let widest = 0;
        $('body > div div:not([hidden]) section:visible > div div[class][style] > div[style]:not([class])').each(function () {
            const $candidate = $(this);
            if ($candidate.width() > widest) {
                widest = $candidate.width();
                $element = $candidate.children('div').first();
            }
        });
    }
    return $element.first();
}

function mountHighlightControlBar($element, username, mediaType) {
    const parent = $element?.[0];
    if (!parent) return null;
    parent.style.position = 'relative';

    let host = Array.from(parent.children).find(element => element.classList?.contains('IG_HIGHLIGHT_CONTROL_BAR'));
    if (!host) {
        host = document.createElement('span');
        host.className = 'IG_HIGHLIGHT_CONTROL_BAR';
        parent.append(host);
    }

    const $header = getStoryProgress(username);
    mountMediaControls(host, {
        showDownloadAll: $header.length > 1 && USER_SETTING.DIRECT_DOWNLOAD_MODE === DIRECT_DOWNLOAD_MODE_OPTIONS.VISIBLE,
        showMediaPreview: false,
        showOpenInNewTab: true,
        showCopy: false,
        mediaType,
        actions: {
            thumbnail: () => onHighlightsStoryThumbnail(true),
            newTab: () => onHighlightsStory(true, true),
            downloadAll: () => onHighlightsStoryAll(),
            download: () => onHighlightsStoryDownload(),
        },
    });
    setStoryProgressIndexText($element, $header, 'IG_HIGHLIGHT_POSITION');
    setTimeElementDateAndLocaleTime(getHighlightCurrentTimeElement($header));
    return host;
}

/**
 * onHighlightsStoryAll
 * @description Trigger user's highlight all download event.
 *
 * @return {void}
 */
export async function onHighlightsStoryAll() {
    updateLoadingBar(true);
    try {
        const highlightId = location.href.replace(/\/$/ig, '').split('/').at(-1);
        const highStories = await getHighlightStories(highlightId);
        const username = highStories.data.reels_media[0].owner.username;
        await downloadStoryResources(highStories, 'highlights', `Highlight · ${username}`);
    }
    finally {
        updateLoadingBar(false);
    }
}

export function onHighlightsStoryDownload() {
    if (USER_SETTING.DIRECT_DOWNLOAD_MODE === DIRECT_DOWNLOAD_MODE_OPTIONS.VISIBLE) {
        return onHighlightsStory(true);
    }
    return onHighlightsStoryAll();
}

/**
 * onHighlightsStory
 * @description Trigger user's highlight download event or button display event.
 *
 * @param  {Boolean}  isDownload - Check if it is a download operation
 * @param  {Boolean}  isPreview - Check if it is need to open new tab
 * @return {void}
 */
export async function onHighlightsStory(isDownload, isPreview) {
    var username = getHighlightsStoryUsername();

    if (isDownload) {
        let date = new Date().getTime();
        let timestamp = Math.floor(date / 1000);
        let highlightId = location.href.replace(/\/$/ig, '').split('/').at(-1);
        let nowIndex = $("body > div section._ac0a header._ac0k > ._ac3r ._ac3n ._ac3p[style]").length ||
            $('body > div section:visible > div > div:not([class]) > div > div div.x1ned7t2.x78zum5 div.x1caxmr6').length ||
            $('body > div div:not([hidden]) section:visible > div div[style]:not([class]) > div').find('div div.x1ned7t2.x78zum5 div.x1caxmr6').length;
        let target = 0;

        updateLoadingBar(true);

        if (state.GL_dataCache.highlights[highlightId]) {
            logger('Fetch from memory cache:', highlightId);

            // OPTIMIZATION: cache items array — avoids 4 repeated property lookups
            const items = state.GL_dataCache.highlights[highlightId].data.reels_media[0].items;
            let totIndex = items.length;
            username = state.GL_dataCache.highlights[highlightId].data.reels_media[0].owner.username;
            target = items[totIndex - nowIndex];
        }
        else {
            let highStories = await getHighlightStories(highlightId);
            const items = highStories.data.reels_media[0].items;
            let totIndex = items.length;
            username = highStories.data.reels_media[0].owner.username;
            target = items[totIndex - nowIndex];

            state.GL_dataCache.highlights[highlightId] = highStories;
        }

        logger('onHighlightsStory', highlightId, state.GL_dataCache.highlights[highlightId]);

        if (USER_SETTING.RENAME_PUBLISH_DATE) {
            timestamp = target.taken_at_timestamp;
        }

        if (USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE) {
            const cached = getImageFromCache(target.id);
            if (cached && !state.GL_dataCache.highlights[highlightId].data.reels_media[0].items.filter(item => item.id === target.id).at(0).is_video) {
                logger("[Restore Cached onHighlight]", target.id);
                if (isPreview) {
                    openNewTab(cached);
                }
                else {
                    saveFiles(cached, {
                        username,
                        sourceType: "highlights",
                        timestamp,
                        filetype: 'jpg',
                        shortcode: target.id
                    });
                }
                return;
            }
        }

        if (USER_SETTING.FORCE_RESOURCE_VIA_MEDIA && !state.tempFetchRateLimit) {
            let result = await getMediaInfo(target.id);

            if (result.status === 'ok') {
                // OPTIMIZATION: cache first media item — accessed 5+ times below
                const mediaItem = result.items[0];
                if (mediaItem.video_versions) {
                    const handled = await tryHandleDashFromMediaItem({
                        mediaItem: mediaItem,
                        username,
                        sourceType: "highlights",
                        timestamp,
                        shortcode: mediaItem.id,
                        isPreview,
                    });
                    if (handled) return;

                    if (isPreview) {
                        openNewTab(mediaItem.video_versions[0].url);
                    }
                    else {
                        saveFiles(mediaItem.video_versions[0].url,
                            {
                                username,
                                sourceType: "highlights",
                                timestamp,
                                filetype: 'mp4',
                                shortcode: mediaItem.id
                            });
                    }
                }
                else {
                    if (isPreview) {
                        openNewTab(mediaItem.image_versions2.candidates[0].url);
                    }
                    else {
                        saveFiles(mediaItem.image_versions2.candidates[0].url, {
                            username,
                            sourceType: "highlights",
                            timestamp,
                            filetype: 'jpg',
                            shortcode: mediaItem.id
                        });
                    }
                }
            }
            else {
                if (USER_SETTING.FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED) {
                    delete state.GL_dataCache.highlights[highlightId];
                    state.tempFetchRateLimit = true;

                    onHighlightsStory(true, isPreview);
                }
                else {
                    alert('Fetch failed from Media API. API response message: ' + result.message);
                }

                logger('onHighlightsStory()', 'Media API rejected request', result?.message);
            }
        }
        else {
            if (target.is_video) {
                if (isPreview) {
                    openNewTab(target.video_resources.at(-1).src, username);
                }
                else {
                    saveFiles(target.video_resources.at(-1).src, {
                        username,
                        sourceType: "highlights",
                        timestamp,
                        filetype: 'mp4',
                        shortcode: target.id
                    });
                }
            }
            else {
                if (isPreview) {
                    openNewTab(target.display_resources.at(-1).src, username);
                }
                else {
                    saveFiles(target.display_resources.at(-1).src, {
                        username,
                        sourceType: "highlights",
                        timestamp,
                        filetype: 'jpg',
                        shortcode: target.id
                    });
                }
            }

            state.tempFetchRateLimit = false;
        }

        updateLoadingBar(false);
    }
    else {
        const $element = findHighlightControlElement();
        if ($element.length > 0) {
            mountHighlightControlBar($element, username, $element.find('video').length > 0 ? 'video' : 'image');
        }
    }
}

/**
 * onHighlightsStoryThumbnail
 * @description Trigger user's highlight video thumbnail download event or button display event.
 *
 * @param  {Boolean}  isDownload - Check if it is a download operation
 * @return {void}
 */
export async function onHighlightsStoryThumbnail(isDownload) {
    if (isDownload) {
        let date = new Date().getTime();
        let timestamp = Math.floor(date / 1000);
        let highlightId = location.href.replace(/\/$/ig, '').split('/').at(-1);
        let username = "";
        let nowIndex = $("body > div section._ac0a header._ac0k > ._ac3r ._ac3n ._ac3p[style]").length ||
            $('body > div section:visible > div > div:not([class]) > div > div div.x1ned7t2.x78zum5 div.x1caxmr6').length ||
            $('body > div div:not([hidden]) section:visible > div div[style]:not([class]) > div').find('div div.x1ned7t2.x78zum5 div.x1caxmr6').length;
        let target = "";

        updateLoadingBar(true);

        if (state.GL_dataCache.highlights[highlightId]) {
            logger('Fetch from memory cache:', highlightId);

            const items = state.GL_dataCache.highlights[highlightId].data.reels_media[0].items;
            let totIndex = items.length;
            username = state.GL_dataCache.highlights[highlightId].data.reels_media[0].owner.username;
            target = items[totIndex - nowIndex];
        }
        else {
            let highStories = await getHighlightStories(highlightId);
            const items = highStories.data.reels_media[0].items;
            let totIndex = items.length;
            username = highStories.data.reels_media[0].owner.username;
            target = items[totIndex - nowIndex];

            state.GL_dataCache.highlights[highlightId] = highStories;
        }

        if (USER_SETTING.RENAME_PUBLISH_DATE) {
            timestamp = target.taken_at_timestamp;
        }

        if (USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE) {
            const cached = getImageFromCache(target.id);
            if (cached) {
                logger("[Restore Cached onHighlightsStoryThumbnail]", target.id);
                saveFiles(cached, {
                    username,
                    sourceType: "highlights",
                    timestamp,
                    filetype: 'jpg',
                    shortcode: target.id
                });
                return;
            }
        }

        if (USER_SETTING.FORCE_RESOURCE_VIA_MEDIA && !state.tempFetchRateLimit) {
            let result = await getMediaInfo(target.id);

            if (result.status === 'ok') {
                saveFiles(result.items[0].image_versions2.candidates[0].url, {
                    username,
                    sourceType: "highlights",
                    timestamp,
                    filetype: 'jpg',
                    shortcode: highlightId
                });
            }
            else {
                if (USER_SETTING.FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED) {
                    delete state.GL_dataCache.highlights[highlightId];
                    state.tempFetchRateLimit = true;

                    onHighlightsStoryThumbnail(true);
                }
                else {
                    alert('Fetch failed from Media API. API response message: ' + result.message);
                }

                logger('onHighlightsStoryThumbnail()', 'Media API rejected request', result?.message);
            }
        }
        else {
            saveFiles(target.display_resources.at(-1).src, {
                username,
                sourceType: "highlights",
                timestamp,
                filetype: 'jpg',
                shortcode: highlightId
            });
            state.tempFetchRateLimit = false;
        }

        updateLoadingBar(false);
    }
    else {
        const $element = findHighlightControlElement();
        const username = getHighlightsStoryUsername();
        if ($element.length > 0) {
            mountHighlightControlBar($element, username, $element.find('video').length > 0 ? 'video' : 'image');
        }
        setStoryProgressIndexByUsername($element, username, 'IG_HIGHLIGHT_POSITION');
    }
}
