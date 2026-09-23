import $ from 'jquery';
import { Effect } from 'effect';
import { DIRECT_DOWNLOAD_MODE_OPTIONS, USER_SETTING, state, resourceCountSelector } from "../../settings/state";
import { triggerLinkElement, saveMediaThumbnail } from "../../shared/media-download";
import { openNewTab, replaceSameOriginHost } from "../../shared/navigation";
import { triggerReactClickHandler } from "../../shared/react";
import { setDownloadProgress, updateLoadingBar } from "../../shared/ui/status.tsx";
import { logger } from "../../shared/logger";
import { getBlobMedia, getMediaInfo } from "../../shared/api";
import { _i18n } from "../../shared/i18n";
import { openImageViewer } from "../media/image-viewer.tsx";
import { mountPostControls } from "./controls.tsx";
import { appendLoadingMessage, appendMediaResource } from "../../shared/ui/media-resource.tsx";
import { mediaIdFromURL } from "../media/image-cache";
import { openResourcePicker } from '../../shared/ui/resource-picker.tsx';
import type { LegacyMedia, LegacyMediaRoot, ModernMedia } from '../../shared/instagram-data.ts';
import { currentRouteScope } from '../../shared/route-scope.ts';

/**
 * onReadyMyDW
 * @description Create an event entry point for the download button for the post.
 *
 * @param  {Boolean}  NoDialog    - Check if it not showing the dialog
 * @param  {?Boolean}  hasReferrer - Check if the source of the previous page is a story page
 * @return {void}
 */
export function onReadyMyDW(NoDialog = false, hasReferrer = false) {
    const routeScope = currentRouteScope();
    if (hasReferrer === true) {
        logger('hasReferrer', 'regenerated');
        $('article[data-snig="canDownload"], div[data-snig="canDownload"]').filter(function () {
            return $(this).find('.IG_DW_MAIN').length === 0
        }).removeAttr('data-snig');
    }

    clearInterval(state.GL_repeat ?? undefined);
    state.GL_repeat = null;

    // Whether is Instagram dialog?
    if (NoDialog == false) {
        const maxCall = 100;
        let i = 0;
        state.GL_repeat = routeScope.setInterval(() => {
            // <hr> is the line beneath the poster's username on a standalone post.
            if (i > maxCall || $(`article[data-snig="canDownload"],
                section:visible > main [data-snig="canDownload"] hr,
                div[id^="mount"] div div div.x1n2onr6.x1vjfegm div[data-snig="canDownload"]
            `).length > 0) {
                clearInterval(state.GL_repeat ?? undefined);
                state.GL_repeat = null;

                if (i > maxCall) {
                    //alert('Trying to call button creation method reached to maximum try times. If you want to re-register method, please open script menu and press "Reload Script" button or hotkey "R" to reload main timer.');
                    logger('onReadyMyDW()', 'maximum number of repetitions reached, terminated');
                }
            }

            logger('onReadyMyDW() Timer', 'repeating to call detection createDownloadButton()');
            createDownloadButton();
            i++;
        }, 50);
    }
    else {
        createDownloadButton();
    }
}


/**
 * initPostVideoFunction
 * @description Initialize settings related to the video resources in the post.
 *
 * @param  {JQuery<HTMLElement>}  $mainElement
 * @return {Void}
 */
export function initPostVideoFunction($mainElement: JQuery<Element>) {
    // OPTIMIZATION: cache $videos — used in 3-4 separate .find('video') traversals below
    const $videos = $mainElement.find<HTMLVideoElement>('video');

    $videos.each(function () {
        $(this).off('fullscreenchange.IG_videoControl').on('fullscreenchange.IG_videoControl', function () {
            const $vid = $(this);
            if (($vid.attr('style') ?? '').includes('object-fit')) {
                if (document.fullscreenElement == this) {
                    $vid.css('object-fit', 'contain');
                }
                else {
                    $vid.css('object-fit', 'cover');
                }
            }
        });
    });

    // Re-initialization happens when carousel media changes. Namespace these listeners so
    // each video owns at most one copy and current settings replace prior behavior.
    $videos.off('ended.igHelperLoop play.igHelperVolume playing.igHelperVolume');

    if (USER_SETTING.DISABLE_VIDEO_LOOPING) {
        $videos.on('ended.igHelperLoop', function () {
            this.pause();
            logger('(post) Stop video playing #loop');
        });
    }

    if (USER_SETTING.MODIFY_VIDEO_VOLUME) {
        $videos.on('play.igHelperVolume playing.igHelperVolume', function () {
            const $vid = $(this);
            if (!$vid.data('modify')) {
                $vid.data('modify', true);
                this.volume = state.videoVolume;
                logger('(post) Added video event listener #modify');
            }
        });
    }

    if (USER_SETTING.HTML5_VIDEO_CONTROL) {
        const handleSwitchController = function (e: JQuery.TriggeredEvent) {
            e.preventDefault();
            e.stopPropagation();

            let $overlayElement = null;

            if ($overlayElement == null) {
                $overlayElement = $(e.target).parents('div[aria-label][data-visualcompletion="ignore"]').first();
            }

            $videos.each(function () {
                $(this).css('z-index', '2');
                $(this).attr('controls', '');
                state.GL_weakCache.overlay.set(this, $overlayElement);
            });

            $overlayElement.css('z-index', '-10');
            $mainElement.find('a[href^="/reels/"]').first().attr("draggable", 'false');
        };

        $mainElement.off('contextmenu.IG_videoControl').on('contextmenu.IG_videoControl', handleSwitchController);

        $videos.each(function () {
            const $video = $(this);
            if (!$video.data('controls')) {

                logger('(post) Added video html5 contorller #modify');

                if (USER_SETTING.MODIFY_VIDEO_VOLUME) {
                    this.volume = state.videoVolume;

                    $video.on('loadstart', function () {
                        this.volume = state.videoVolume;
                    });
                }


                let $mute_button_wrapper = $video.parent().find('video + div > div');
                const mainElement = $mainElement[0];
                if (mainElement instanceof HTMLElement) $mute_button_wrapper = $mute_button_wrapper.add(mainElement);


                const $element_mute_button = $mute_button_wrapper.find('button[type="button"], div[role="button"]').filter(function () {
                    const $b = $(this);
                    // This is mute/unmute's icon
                    return ($b.width() ?? Infinity) <= 64 && ($b.height() ?? Infinity) <= 64 && $b.find('svg > path[d^="M16.636 7.028a1.5"], svg > path[d^="M1.5 13.3c-.8"]').length > 0;
                });

                state.GL_weakCache.mutedButton.set(this, $element_mute_button);

                const $targets = $video.parent().find('video + div > div').first();

                // Hide layout to show controller
                $targets.off('contextmenu.IG_videoControl').on('contextmenu.IG_videoControl', handleSwitchController);

                // Restore layout to show details interface
                $video.on('contextmenu', function (e) {
                    e.preventDefault();
                    e.stopPropagation();

                    $video.css('z-index', '-1');
                    $video.removeAttr('controls');

                    $targets.css('z-index', '1');
                    state.GL_weakCache.overlay.get(this)?.css('z-index', '1');
                    $(this).parents('a[href^="/reels/"]').first().removeAttr("draggable");
                });

                $video.on('volumechange', function (event) {
                    const overlay = state.GL_weakCache.overlay.get(event.currentTarget as HTMLVideoElement)?.[0];
                    const $element_mute_button = state.GL_weakCache.mutedButton.get(this);
                    const is_element_muted = $element_mute_button?.find('svg > path[d^="M16.636"]').length === 0;

                    if (this.muted != is_element_muted) {
                        this.volume = state.videoVolume;

                        if ($element_mute_button?.length === 1) {
                            const button = $element_mute_button.first()[0];
                            if (button instanceof HTMLElement) triggerReactClickHandler(button);
                        }
                        else if ($element_mute_button) {
                            const $firstElementMuteButton = $element_mute_button.filter(function () {
                                return overlay ? $(this).closest(overlay).length > 0 : false;
                            }).first();

                            const button = $firstElementMuteButton.first()[0];
                            if (button instanceof HTMLElement) triggerReactClickHandler(button);
                        }
                    }

                    const $v = $(this);
                    if ($v.data('completed')) {
                        state.videoVolume = this.volume;
                        GM_setValue('G_VIDEO_VOLUME', this.volume);
                    }

                    if (this.volume == state.videoVolume) {
                        $v.data('completed', true);
                    }
                });

                $video.parents('a[href^="/reels/"]').first().on('click', function (e) {
                    if ($video.attr('controls')) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                });

                $video.css('position', 'absolute');
                $video.data('controls', true);
            }
        });
    }

};


/**
 * createDownloadButton
 * @description Create a download button in the upper right corner of each post.
 *
 * @return {void}
 */
export function createDownloadButton() {
    const routeScope = currentRouteScope();
    // Add download icon per each posts

    $('article, section:visible > main > div > div > div > div > div > hr').map(function () {
        return this.tagName === 'ARTICLE' ? this : findPermalinkPostContainer(this);
    }).filter(function () {
        const $this = $(this);
        return document.hidden || (($this.height() ?? 0) > 0 && ($this.width() ?? 0) > 0);
    })
        .each(function (index) {
            // OPTIMIZATION: cache $(this) — referenced 8+ times in this each() body
            const $self = $(this);
            // If it is have not download icon
            // class x1iyjqo2 mean user profile pages post list container
            const hasPostControls = $self.find('.button_wrapper').length > 0;
            if ((!$self.attr('data-snig') || !hasPostControls) && !$self.hasClass('x1iyjqo2') && !$self.children('article')?.hasClass('x1iyjqo2')) {
                logger("Found post container", $self);

                const $mainElement = $self;
                const tagName = this.tagName;

                // not loop each in single top post
                if (tagName === "DIV" && index != 0) {
                    return;
                }

                const $childElement = $mainElement.children("div").children("div");

                if ($mainElement.find('> .button_wrapper, .button_wrapper').length > 0) {
                    $mainElement.attr('data-snig', 'canDownload');
                    return;
                }

                if ($childElement.length === 0) return;

                logger("Found insert point", $childElement);

                // Modify carousel post counter's position to not interfere with our buttons
                // OPTIMIZATION: cache repeated ._acay lookup
                const $acay = $mainElement.find('._acay');
                if ($acay.length > 0) {
                    const $acayX24 = $mainElement.find('._acay + .x24i39r');
                    if ($acayX24.length > 0) {
                        $acayX24.css('top', '37px');
                    }

                    const observeNode = $acay.first().parent()[0];
                    const observer = new MutationObserver(function () {
                        $mainElement.find('._acay + .x24i39r').css('top', '37px');
                    });

                    if (observeNode) routeScope.observe(observer, observeNode, { childList: true });
                }

                const $resourceLayout = $childElement.filter(function () {
                    return containsPostMedia($(this));
                }).first();

                if ($resourceLayout.length === 0) return;

                const $actionSection = findPostActionSection($mainElement);
                if ($actionSection.length === 0) return;

                const controlsMount = getPostControlsMount($actionSection);

                const resource_count = $mainElement.find(resourceCountSelector).length;
                const showDownloadAll = resource_count > 1 && USER_SETTING.DIRECT_DOWNLOAD_MODE === DIRECT_DOWNLOAD_MODE_OPTIONS.VISIBLE;
                const postControlActions = {
                    view: () => openPostImageViewer(controlsMount),
                    thumbnail: () => openPostVideoThumbnail(controlsMount),
                    newTab: () => openPostResourceInNewTab(controlsMount),
                    copy: () => copyPostResourceToClipboard(controlsMount),
                    downloadAll: () => downloadAllPostResources(controlsMount),
                    download: () => downloadPostResource(controlsMount),
                };
                mountPostControls(controlsMount, { showDownloadAll, showMediaPreview: USER_SETTING.SHOW_MEDIA_PREVIEW, mediaType: 'image', actions: postControlActions });

                routeScope.setTimeout(() => {
                    if (!routeScope.active) return;

                    const checkNodeCallback = (entries: IntersectionObserverEntry[]) => {
                        if (!routeScope.active) return;
                        entries.forEach((entry) => {
                            if (entry.isIntersecting) {
                                const $targetNode = $(entry.target);
                                // Check if video?
                                if ($targetNode.find('video').length > 0) {
                                    $mainElement.removeData('igHelper_displayResourceURL');
                                    mountPostControls(controlsMount, { showDownloadAll, mediaType: 'video', actions: postControlActions });
                                    initPostVideoFunction($mainElement);
                                }
                                else {
                                    const imgSrc = $targetNode.find('img').attr('src');
                                    $mainElement.data('igHelper_displayResourceURL', imgSrc ?? '');
                                    mountPostControls(controlsMount, { showDownloadAll, mediaType: 'image', actions: postControlActions });
                                }
                            }
                        });
                    };

                    const observer_i = new IntersectionObserver(checkNodeCallback, {
                        root: $resourceLayout[0],
                        rootMargin: "0px",
                        threshold: 0.1,
                    });
                    routeScope.defer(() => observer_i.disconnect());

                    // trigger when switching resources

                    const observer = new MutationObserver(function (mutation) {
                        if (!routeScope.active) return;
                        const target = mutation.at(0)?.target;
                        observer_i.disconnect();

                        if (!(target instanceof Element)) return;

                        $(target).find('li').each(function () {
                            const $t = $(this);
                            if ($t.find('video').length > 0 || $t.find('img').length > 0) {
                                observer_i.observe(this);
                            }
                        });
                    });

                    let $triggeredTarget: JQuery<Element> | null = null;
                    // first onload
                    $resourceLayout.find('ul li, div[role="button"] > div, div[class] > div').each(function () {
                        const $li = $(this);
                        const $targetNode = $li.find('video').length > 0
                            ? $li.find('video')?.first()
                            : $li.find('img')?.first();

                        // Check if the node is visible and has size,
                        // and not the same node as last triggered one to avoid duplicated trigger
                        // when switching resources with same container
                        if (
                            $targetNode.length > 0 &&
                            $targetNode.is(':visible') &&
                            ($targetNode.get(0)?.getBoundingClientRect().width ?? 0) > 0 &&
                            ($targetNode.get(0)?.getBoundingClientRect().height ?? 0) > 0 &&
                            this.getBoundingClientRect().width > 64 &&
                            this.getBoundingClientRect().height > 64 &&
                            $triggeredTarget?.get(0) != $targetNode.get(0)
                        ) {
                            // ignore the image without alt attribute,
                            // because it is usually used for video thumbnail
                            if (
                                $targetNode.get(0)?.tagName === "IMG" &&
                                $targetNode.attr('alt')?.length == 0
                            ) {
                                return;
                            }

                            $triggeredTarget = $targetNode;
                            observer_i.observe(this);
                        }
                    });

                    const listRoot =
                        $resourceLayout.find('ul li, div[role="button"] > div').first().parent()[0] ||
                        $resourceLayout.find('ul').first()[0];

                    if (listRoot) {
                        routeScope.observe(observer, listRoot, {
                            attributes: true,
                            childList: true,
                        });
                    } else {
                        initPostVideoFunction($mainElement);
                        logger("Cannot find resource list root element, thumbnail and viewer button may not work.");
                    }

                }, 50);


                // Add the mark that download is ready
                const username = $self.find("header > div:last-child > div:first-child span a").first().text() || $self.find('a[href^="/"]').filter(function () {
                    return $(this)?.text()?.length > 0;
                }).first().text();

                $self.attr('data-snig', 'canDownload');
                $self.data('username', username);
            }
        });
}


function openPostImageViewer(target: HTMLElement) {
    const url = getCurrentPostImageUrl(target);

    if (url) {
        openImageViewer(url);
    } else {
        alert("Cannot find resource url.");
    }
}

function getCurrentPostImageUrl(target: HTMLElement): string | null {
    const $article = getPostContainerFromButton(target);
    let url = $article.data('igHelper_displayResourceURL');

    if (!url) {
        url = $article.find('img:visible').filter(function () {
            const $img = $(this);
            return (($img.attr('alt') || '').length > 0) && (($img.attr('src') || '').length > 0);
        }).first().attr('src');
    }

    return typeof url === 'string' ? url : null;
}

async function copyPostResourceToClipboard(target: HTMLElement) {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        alert(_i18n('COPY_MEDIA_CLIPBOARD_UNAVAILABLE'));
        return;
    }

    if ($(target).find('.IG_THUMBNAIL_MAIN').length > 0) {
        alert(_i18n('COPY_MEDIA_UNSUPPORTED'));
        return;
    }

    const url = getCurrentPostImageUrl(target);
    if (!url) {
        alert(_i18n('COPY_MEDIA_FAILED'));
        return;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const blob = await response.blob();
        const type = blob.type === 'image/png' || ClipboardItem.supports?.(blob.type)
            ? blob.type
            : 'image/png';
        const data = type === blob.type ? blob : await toClipboardPng(blob);

        await navigator.clipboard.write([new ClipboardItem({ [type]: data })]);
        alert(_i18n('COPY_MEDIA_SUCCESS'));
    }
    catch (err) {
        logger('copyPostResourceToClipboard', err);
        alert(_i18n('COPY_MEDIA_FAILED'));
    }
}

async function toClipboardPng(blob: Blob): Promise<Blob> {
    if (blob.type === 'image/png') return blob;

    const bitmap = await createImageBitmap(blob);
    try {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas 2D context unavailable');
        context.drawImage(bitmap, 0, 0);

        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                result => result ? resolve(result) : reject(new Error('PNG conversion failed')),
                'image/png',
            );
        });
    }
    finally {
        bitmap.close();
    }
}

async function openPostVideoThumbnail(target: HTMLElement) {
    updateLoadingBar(true);

    try {
        const { $article, postPath } = await getPostContextFromButton(target);
        if ($article.length === 0 || !postPath) {
            alert('Cannot determine post path.');
            return;
        }

        state.GL_username = $article.data('username');
        state.GL_postPath = postPath;
        const index = getVisibleNodeIndex($article);
        const resourceRoot = document.createElement('div');

        const totalInserted = await createMediaListDOM(
            postPath,
            resourceRoot,
            ""
        );

        if (!totalInserted || totalInserted < 1) {
            alert('Cannot find thumbnail URL.');
            return;
        }

        const $link = $(resourceRoot).find('a[data-globalindex="' + (index + 1) + '"]').first();
        if ($link.length === 0 || !await saveMediaThumbnail($link, postPath)) {
            alert('Cannot find thumbnail URL.');
        }
    }
    catch (err) {
        logger('openPostVideoThumbnail', err);
        alert('Cannot find thumbnail URL.');
    }
    finally {
        updateLoadingBar(false);
    }
}

async function openPostResourceInNewTab(target: HTMLElement) {
    updateLoadingBar(true);

    try {
        const { $article, postPath } = await getPostContextFromButton(target);
        if ($article.length === 0 || !postPath) {
            alert('Cannot determine post path.');
            return;
        }

        state.GL_username = $article.data('username');
        state.GL_postPath = postPath;
        const index = getVisibleNodeIndex($article);
        const resourceRoot = document.createElement('div');

        const totalInserted = await createMediaListDOM(
            postPath,
            resourceRoot,
            ""
        );

        if (!totalInserted || totalInserted < 1) {
            alert('Cannot find open tab URL.');
            return;
        }

        const $link = $(resourceRoot).find('a[data-globalindex="' + (index + 1) + '"]').first();
        if ($link.length === 0) {
            alert('Cannot find open tab URL.');
            return;
        }

        if (USER_SETTING.FORCE_RESOURCE_VIA_MEDIA && USER_SETTING.NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST) {
            await triggerLinkElement($link[0], true);
            return;
        }

        const href = $link.data('href');
        if (href) openNewTab(replaceSameOriginHost(href));
        else alert('Cannot find open tab URL.');
    }
    catch (err) {
        logger('openPostResourceInNewTab', err);
        alert('Cannot find open tab URL.');
    }
    finally {
        updateLoadingBar(false);
    }
}

async function downloadAllPostResources(target: HTMLElement) {
    try {
        const { $article, postPath } = await getPostContextFromButton(target);
        if ($article.length === 0 || !postPath) {
            alert('Cannot determine post path.');
            return;
        }

        state.GL_username = $article.data('username');
        state.GL_postPath = postPath;

        const popupBody = document.createElement('div');
        updateLoadingBar(true);

        const totalInserted = await createMediaListDOM(
            state.GL_postPath,
            popupBody,
            _i18n("LOAD_BLOB_MULTIPLE")
        );

        if (!totalInserted || totalInserted < 1) return;

        const links: JQuery<Element>[] = [];
        $(popupBody).find('a').each(function () {
            links.push($(this));
        });

        await batchDownloadPostFiles(links);
    }
    catch (err) {
        logger('downloadAllPostResources', err);
    }
    finally {
        updateLoadingBar(false);
    }
}

async function downloadPostResource(target: HTMLElement) {
    try {
        const { $article, postPath } = await getPostContextFromButton(target);
        if ($article.length === 0 || !postPath) {
            alert('Cannot determine post path.');
            return;
        }

        state.GL_username = $article.data('username');
        state.GL_postPath = postPath;

        if (USER_SETTING.DIRECT_DOWNLOAD_MODE === DIRECT_DOWNLOAD_MODE_OPTIONS.ASK) {
            updateLoadingBar(true);
            const resourceRoot = document.createElement('div');

            try {
                const totalInserted = await createMediaListDOM(
                    state.GL_postPath,
                    resourceRoot,
                    _i18n("LOAD_BLOB_MULTIPLE")
                );

                if (!totalInserted) {
                    alert('Cannot find download URL.');
                    return;
                }

                const resources = Array.from(resourceRoot.querySelectorAll<HTMLAnchorElement>('a[data-needed="direct"]')).map(anchor => ({
                    mediaId: anchor.getAttribute('media-id'),
                    preview: anchor.dataset.preview ?? anchor.dataset.href,
                    label: _i18n(anchor.dataset.type === 'mp4' ? 'VID' : 'IMG'),
                    element: anchor,
                }));

                openResourcePicker({
                    title: `Post ${state.GL_postPath}`,
                    resources,
                    onDownload: selected => batchDownloadPostFiles(selected.map(resource => $(resource.element))),
                });
            }
            finally {
                updateLoadingBar(false);
            }

            return;
        }

        const popupBody = document.createElement('div');

        if (USER_SETTING.DIRECT_DOWNLOAD_MODE === DIRECT_DOWNLOAD_MODE_OPTIONS.VISIBLE) {
            updateLoadingBar(true);

            try {
                const index = getVisibleNodeIndex($article);

                const totalInserted = await createMediaListDOM(
                    state.GL_postPath,
                    popupBody,
                    ""
                );

                if (!totalInserted || totalInserted < 1) {
                    alert('Cannot find download URL.');
                    return;
                }

                const $popupBody = $(popupBody);
                const $targetLink = $popupBody.find('a[data-globalindex="' + (index + 1) + '"]');

                if ($targetLink.length > 0 && $targetLink.data('href')) {
                    await triggerLinkElement($targetLink.first()[0], false);
                }
                else {
                    alert('Cannot find download URL.');
                }
            }
            catch (err) {
                logger('downloadPostResource visibleResource', err);
                alert('Cannot find download URL.');
            }
            finally {
                updateLoadingBar(false);
            }

            return;
        }

        if (USER_SETTING.DIRECT_DOWNLOAD_MODE !== DIRECT_DOWNLOAD_MODE_OPTIONS.ALL) {
            let s = 0;
            const $resourceItems = $article.find(resourceCountSelector);
            const multiple = $resourceItems.length;
            let blob = false;
            const publish_time = new Date(
                $article.find('a[href] time[datetime]').filter(function () {
                    const href = $(this).parents("a[href]").attr("href");
                    return href?.startsWith("/p/") || href?.match(/\/([\w.\-_]+)\/(p|reel)\//ig) != null;
                }).first().attr('datetime') ?? ''
            ).getTime();

            if (multiple) {
                $resourceItems.each(function () {
                    const element_videos = $(this).parent().parent().parent().find('video');
                    if (element_videos && element_videos.attr('src')) {
                        blob = true;
                    }
                });

                if (blob || USER_SETTING.FORCE_RESOURCE_VIA_MEDIA) {
                    await createMediaListDOM(
                        state.GL_postPath,
                        popupBody,
                        _i18n("LOAD_BLOB_MULTIPLE")
                    );
                }
                else {
                    const $popupBody = $(popupBody);
                    $resourceItems.each(function () {
                        s++;
                        const $this = $(this);
                        const element_videos = $this.find('video');
                        const element_images = $this.find('._aagv img');
                        const imgLink = element_images.attr('srcset')?.split(" ")[0] || element_images.attr('src');

                        if (element_videos && element_videos.attr('src')) {
                            blob = true;
                        }
                        if (element_images && imgLink) {
                            appendMediaResource($popupBody[0], { datetime: publish_time, name: 'photo', type: 'jpg', username: state.GL_username, path: state.GL_postPath, index: s, href: imgLink, preview: imgLink, labelKey: 'IMG', label: _i18n('IMG') });
                        }
                    });

                    if (blob) {
                        await createMediaListDOM(
                            state.GL_postPath,
                            popupBody,
                            _i18n("LOAD_BLOB_RELOAD")
                        );
                    }
                }
            }
            else {
                if (USER_SETTING.FORCE_RESOURCE_VIA_MEDIA) {
                    await createMediaListDOM(
                        state.GL_postPath,
                        popupBody,
                        _i18n("LOAD_BLOB_MULTIPLE")
                    );
                }
                else {
                    s++;
                    const element_videos = $article.find('video');
                    const element_images = $article.find('._aagv img');
                    const imgLink = element_images.attr('srcset')?.split(" ")[0] || element_images.attr('src');

                    if (element_videos && element_videos.attr('src')) {
                        await createMediaListDOM(
                            state.GL_postPath,
                            popupBody,
                            _i18n("LOAD_BLOB_ONE")
                        );
                    }
                    if (element_images && imgLink) {
                        appendMediaResource(popupBody, { datetime: publish_time, name: 'photo', type: 'jpg', username: state.GL_username, path: state.GL_postPath, index: s, href: imgLink, preview: imgLink, labelKey: 'IMG', label: _i18n('IMG') });
                    }
                }
            }
        }

        if (USER_SETTING.DIRECT_DOWNLOAD_MODE === DIRECT_DOWNLOAD_MODE_OPTIONS.ALL) {
            const totalInserted = await createMediaListDOM(
                state.GL_postPath,
                popupBody,
                _i18n("LOAD_BLOB_MULTIPLE")
            );

            if (!totalInserted || totalInserted < 1) {
                return;
            }

            const links: JQuery<Element>[] = [];
            $(popupBody).find('a').each(function () {
                links.push($(this));
            });

            await batchDownloadPostFiles(links);
        }
    }
    catch (err) {
        logger('downloadPostResource', err);
    }
}


/**
 * filterResourceData
 * @description Standardized resource object format.
 *
 * @param  {Object}  data
 * @return {Object}
 */
export function filterResourceData(data: LegacyMediaRoot): LegacyMedia;
export function filterResourceData(data: ModernMedia): ModernMedia;
export function filterResourceData(data: LegacyMediaRoot | ModernMedia): LegacyMedia | ModernMedia;
export function filterResourceData(data: LegacyMediaRoot | ModernMedia): LegacyMedia | ModernMedia {
    return 'shortcode_media' in data ? data.shortcode_media : data;
}


/**
 * createMediaListDOM
 * @description Create a list of media elements from post URLs.
 *
 * @param  {String}  postURL
 * @param  {Element|JQuery}  root - Popup body where resources are rendered.
 * @param  {String}  message - i18n display loading message
 * @return {Promise<number>}  The number of <a> elements inserted into the DOM
 */
export async function createMediaListDOM(postURL: string, root: HTMLElement, message: string): Promise<number> {
    const $target = $(root);
    try {
        $target.find('a').remove();
        appendLoadingMessage($target[0], message);
        const result = await getBlobMedia(postURL);

        if (result.type === 'query_hash') {
            const resource = filterResourceData(result.data);
            let idx = 1;

            // GraphVideo
            if (resource.__typename == "GraphVideo" && resource.video_url) {
                appendMediaResource($target[0], { mediaId: resource.id, datetime: resource.taken_at_timestamp, blob: true, path: resource.shortcode, name: 'video', type: 'mp4', username: resource.owner.username, index: idx, href: resource.video_url, preview: resource.display_resources[1].src, labelKey: 'VID', label: _i18n('VID') });
                idx++;

                if (resource.video_dash_manifest) {
                    state.GL_mediaDataCache[resource.id] = resource;
                }
            }
            // GraphImage
            if (resource.__typename == "GraphImage") {
                appendMediaResource($target[0], { mediaId: resource.id, datetime: resource.taken_at_timestamp, blob: true, path: resource.shortcode, name: 'photo', type: 'jpg', username: resource.owner.username, index: idx, href: resource.display_resources[resource.display_resources.length - 1].src, preview: resource.display_resources[1].src, labelKey: 'IMG', label: _i18n('IMG') });
                idx++;
            }
            // GraphSidecar
            if (resource.__typename == "GraphSidecar" && resource.edge_sidecar_to_children) {
                for (const e of resource.edge_sidecar_to_children.edges) {
                    if (e.node.__typename == "GraphVideo" && e.node.video_url) {
                        appendMediaResource($target[0], { mediaId: e.node.id, datetime: resource.taken_at_timestamp, blob: true, path: resource.shortcode, name: 'video', type: 'mp4', username: resource.owner.username, index: idx, href: e.node.video_url, preview: e.node.display_resources[1].src, labelKey: 'VID', label: _i18n('VID') });
                        if (e.node.video_dash_manifest) {
                            state.GL_mediaDataCache[e.node.id] = e.node;
                        }
                    }

                    if (e.node.__typename == "GraphImage") {
                        appendMediaResource($target[0], { mediaId: e.node.id, datetime: resource.taken_at_timestamp, blob: true, path: resource.shortcode, name: 'photo', type: 'jpg', username: resource.owner.username, index: idx, href: e.node.display_resources[e.node.display_resources.length - 1].src, preview: e.node.display_resources[1].src, labelKey: 'IMG', label: _i18n('IMG') });
                    }
                    idx++;
                }
            }
        }
        else {
            const resource = filterResourceData(result.data);
            if (resource.carousel_media) {
                logger('carousel_media');

                resource.carousel_media.forEach((mda, ind) => {
                    const idx = ind + 1;
                    // Image
                    if (mda.video_versions == null) {
                        mda.image_versions2.candidates.sort(function (a, b) {
                            const aSTP = new URL(a.url).searchParams.get('stp');
                            const bSTP = new URL(b.url).searchParams.get('stp');

                            if (aSTP && bSTP) {
                                if (aSTP.length > bSTP.length) return 1;
                                if (aSTP.length < bSTP.length) return -1;
                            }
                            else {
                                if ((a.width ?? 0) < (b.width ?? 0)) return 1;
                                if ((a.width ?? 0) > (b.width ?? 0)) return -1;
                            }

                            return 0;
                        });

                        appendMediaResource($target[0], { mediaId: mda.pk, datetime: mda.taken_at, blob: true, path: resource.code, name: 'photo', type: 'jpg', username: resource.owner.username, index: idx, href: mda.image_versions2.candidates[0].url, preview: mda.image_versions2.candidates[0].url, labelKey: 'IMG', label: _i18n('IMG') });
                    }
                    // Video
                    else {
                        appendMediaResource($target[0], { mediaId: mda.pk, datetime: mda.taken_at, blob: true, path: resource.code, name: 'video', type: 'mp4', username: resource.owner.username, index: idx, href: mda.video_versions[0].url, preview: mda.image_versions2.candidates[0].url, labelKey: 'VID', label: _i18n('VID') });
                        if (mda.video_dash_manifest) {
                            state.GL_mediaDataCache[mda.pk] = mda;
                        }
                    }
                });
            }
            else {
                const idx = 1;
                // Image
                if (resource.video_versions == null) {
                    resource.image_versions2.candidates.sort(function (a, b) {
                        const aSTP = new URL(a.url).searchParams.get('stp');
                        const bSTP = new URL(b.url).searchParams.get('stp');

                        if (aSTP && bSTP) {
                            if (aSTP.length > bSTP.length) return 1;
                            if (aSTP.length < bSTP.length) return -1;
                        }
                        else {
                            if ((a.width ?? 0) < (b.width ?? 0)) return 1;
                            if ((a.width ?? 0) > (b.width ?? 0)) return -1;
                        }

                        return 0;
                    });

                    appendMediaResource($target[0], { mediaId: resource.pk, datetime: resource.taken_at, blob: true, path: resource.code, name: 'photo', type: 'jpg', username: resource.owner.username, index: idx, href: resource.image_versions2.candidates[0].url, preview: resource.image_versions2.candidates[0].url, labelKey: 'IMG', label: _i18n('IMG') });
                }
                // Video
                else {
                    if (resource.video_dash_manifest) {
                        state.GL_mediaDataCache[resource.pk] = resource;
                    }
                    appendMediaResource($target[0], { mediaId: resource.pk, datetime: resource.taken_at, blob: true, path: resource.code, name: 'video', type: 'mp4', username: resource.owner.username, index: idx, href: resource.video_versions[0].url, preview: resource.image_versions2.candidates[0].url, labelKey: 'VID', label: _i18n('VID') });
                }
            }
        }

        $target.find('#_SNLOAD').remove();

        return $target.find('a').length;
    }
    catch (err) {
        logger('createMediaListDOM', err);
        $target.find('#_SNLOAD').remove();
        return 0;
    }
}


/**
 * getVisibleNodeIndex
 * @description Get element visible node.
 *
 * @param  {Object}  $main
 * @return {Integer}
 */
export function getVisibleNodeIndex($main: JQuery<Element>): number {
    // 1. Prioritize the most efficient rule: check if the "back" button exists.
    const hasBackButton = $main.find('button._afxv._al46._al47').length > 0;

    // 2. If the "back" button does not exist, it is determined to be the first image, and the result is returned immediately.
    if (!hasBackButton) {
        return 0;
    }
    let index = 0;

    // 3. If the code execution reaches here, it means it is not the first image, and the final geometric algorithm is enabled.

    // a. Locate the "viewport" element: it is the grandparent of ul
    // "_acay" class of <ul> has been removed by Instagram; [class] added to <ul> to get much lesser matches in page
    // The parent of the parent of ul[class] always has the attributes "role"
    // '*:not([data-pagelet])>*:not([role]):not([data-pagelet])>*>*>*[role]>*>ul[class]' is useful for avoiding the homepage stories section, account highlights section, and notes section in Messages.
    const $viewport = $main.find('*:not([data-pagelet])>*:not([role]):not([data-pagelet])>*>*>*[role]>*>ul[class]').parent().parent('[role]');

    if ($viewport.length > 0) {
        const viewportRect = $viewport.get(0)?.getBoundingClientRect();
        if (!viewportRect) return 0;
        // b. Get itemWidth: directly use the width of the viewport, this method is the most generalizable
        const itemWidth = viewportRect.width;

        // Must successfully obtain the width to continue, to prevent division by zero errors
        if (itemWidth > 0) {
            // STAGE 1: Visual positioning, find the currently displayed <li> element
            // "_acaz" class of <li> has been removed by Instagram; [class] added to <li> to get much lesser matches in page
            const viewportRight = viewportRect.right;
            const closestSlideElement = $main.find('li[class]').toArray()
                .filter(element => element.getBoundingClientRect().width > 0)
                .sort((a, b) => Math.abs(a.getBoundingClientRect().right - viewportRight) - Math.abs(b.getBoundingClientRect().right - viewportRight))[0];

            // STAGE 2: Index calculation, use the found <li> and itemWidth to calculate the global index
            if (closestSlideElement) {
                const style = $(closestSlideElement).attr('style');
                if (style && style.includes('translateX')) {
                    const offsetMatch = style.match(/translateX\(([^p]+)px\)/);
                    if (offsetMatch && offsetMatch[1]) {
                        const totalOffset = parseFloat(offsetMatch[1]);
                        // c. Execute the final calculation formula
                        index = Math.round(totalOffset / itemWidth);
                    }
                }
            }
        }
    }
    return index;
}


/**
 * batchDownloadPostFiles
 * @description Batch download media files in posts to prevent browser crashes.
 * @param {jQuery} $elements
 * @return {Promise<void>}
 */
export async function batchDownloadPostFiles($elements: Array<Element | JQuery<Element>>): Promise<void> {
    let index = 0;
    const totalLen = $elements.length;
    setDownloadProgress(0, totalLen);

    for (const element of $elements) {
        try {
            await triggerLinkElement($(element), false);
        } catch (err) {
            logger('batchDownloadPostFiles()', 'failed', err);
        }

        index++;
        setDownloadProgress(index, totalLen);
        if (index < totalLen) await Effect.runPromise(Effect.sleep('1 second'));
    }
}



function findPostActionSection($mainElement: JQuery<Element>): JQuery<Element> {
    return $mainElement.find('section').filter(function () {
        return $(this).find('svg[aria-label="Save"], svg[aria-label="Remove"]').length > 0;
    }).first();
}

function getPostControlsMount($actionSection: JQuery<Element>): HTMLElement {
    const existingMount = $actionSection.find('.button_wrapper.IG_CONTROL_BAR').first()[0];
    if (existingMount instanceof HTMLElement) return existingMount;

    const controlsMount = document.createElement('span');
    controlsMount.className = 'button_wrapper IG_CONTROL_BAR';

    const $saveIcon = $actionSection.find('svg[aria-label="Save"], svg[aria-label="Remove"]').first();
    const $saveItem = $actionSection.children().filter(function () {
        return this === $saveIcon[0] || ($saveIcon[0] ? $.contains(this, $saveIcon[0]) : false);
    }).first();

    if ($saveItem.length > 0) {
        $saveItem.addClass('IG_POST_SAVE_GROUP').prepend(controlsMount);
        return controlsMount;
    }

    $actionSection.append(controlsMount);
    return controlsMount;
}

function findPermalinkPostContainer(marker: Element): Element | undefined {
    return $(marker).parents('div').filter(function () {
        const $candidate = $(this);
        return containsPostMedia($candidate) && findPostActionSection($candidate).length > 0;
    }).first()[0];
}

function containsPostMedia($candidate: JQuery<Element>): boolean {
    if ($candidate.find('video').length > 0) return true;

    return $candidate.find<HTMLImageElement>('img').filter(function () {
        const rect = this.getBoundingClientRect();
        const width = rect.width || this.naturalWidth;
        const height = rect.height || this.naturalHeight;
        return width > 64 && height > 64;
    }).length > 0;
}

const postLinkPattern = /(?:^\/|instagram\.com\/)(?:[^/?#]+\/)?(?:p|reel)\/([^/?#;]+)/i;

function getPostContainerFromButton(target: HTMLElement): JQuery<Element> {
    return $(target).closest('[data-snig="canDownload"]');
}

function getPostPathFromURL(url: string | undefined | null): string | null {
    return url?.match(postLinkPattern)?.[1] || null;
}

async function getPostPathFromMedia(target: HTMLElement): Promise<string | null> {
    const $mediaRoot = getPostContainerFromButton(target);
    const mediaElement = $mediaRoot.find('img[src*="ig_cache_key="], video[poster*="ig_cache_key="]').first()[0];
    const mediaURL = mediaElement instanceof HTMLImageElement
        ? mediaElement.currentSrc || mediaElement.src
        : mediaElement instanceof HTMLVideoElement ? mediaElement.currentSrc || mediaElement.src || mediaElement.poster : '';
    const mediaId = mediaURL ? mediaIdFromURL(mediaURL) : null;
    if (!mediaId) return null;

    try {
        const mediaItem = (await getMediaInfo(mediaId))?.items?.[0];
        if (!mediaItem?.code) return null;
        if (mediaItem.product_type !== 'carousel_item') return mediaItem.code;

        const response = await fetch(`/p/${mediaItem.code}/`, { credentials: 'same-origin' });
        return getPostPathFromURL(response.url) || mediaItem.code;
    }
    catch (err) {
        logger('getPostPathFromMedia', err);
        return null;
    }
}

/**
 * getPostContextFromButton
 * @description Resolve the current post container and shortcode safely across
 * homepage, dialog, /p/, /reel/, and feed layouts without post permalinks.
 *
 * @param {HTMLElement|JQuery} target
 * @return {Promise<{ $article: JQuery<HTMLElement>, postPath: (string|null) }>}
 */
export async function getPostContextFromButton(target: HTMLElement): Promise<{ $article: JQuery<Element>; postPath: string | null }> {
    const $article = getPostContainerFromButton(target);
    if ($article.length === 0) {
        return { $article: $(), postPath: null };
    }

    const cachedPath = $article.data('igHelper_postPath');
    if (typeof cachedPath === 'string') return { $article, postPath: cachedPath };

    const candidates: string[] = [];
    $article.find('a[href]').each(function () {
        const href = $(this).attr('href');
        if (href && getPostPathFromURL(href)) candidates.push(href);
    });

    let postPath = candidates.map(getPostPathFromURL).find(Boolean) || getPostPathFromURL(location.href);
    if (!postPath) postPath = await getPostPathFromMedia(target);
    if (postPath) $article.data('igHelper_postPath', postPath);

    return { $article, postPath };
}
