import $ from 'jquery';
import { DIRECT_DOWNLOAD_MODE_OPTIONS, USER_SETTING, state, resourceCountSelector } from '../../settings/state';
import { triggerReactClickHandler } from '../../shared/react';
import { logger } from '../../shared/logger';
import { mountPostControls } from './controls.tsx';
import { currentRouteScope } from '../../shared/route-scope.ts';
import { openPostImageViewer, openPostVideoThumbnail, openPostResourceInNewTab, copyPostResourceToClipboard, downloadAllPostResources, downloadPostResource } from './actions';

export { getPostContextFromButton } from './actions';
export { filterResourceData, createMediaListDOM, batchDownloadPostFiles } from './resources';
export { getVisibleNodeIndex } from './local-image';

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
