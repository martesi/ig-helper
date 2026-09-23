import $ from 'jquery';
import { USER_SETTING, state } from "../settings/state";
import { saveFiles } from "../shared/download";
import { openNewTab } from "../shared/navigation";
import { triggerReactClickHandler } from "../shared/react";
import { logger } from "../shared/logger";
import { getBlobMedia } from "../shared/api";
import { filterResourceData } from "./post/post";
import { mountReelControls } from "./reel/controls.tsx";
import { currentRouteScope } from "../shared/route-scope";
import { runWithLoadingBar } from './loading';

/**
 * onReels
 * @description Trigger user's reels download event or button display event.
 *
 * @param  {Boolean}  isDownload - Check if it is a download operation
 * @param  {Boolean}  isVideo - Check if reel is a video element
 * @param  {Boolean}  isPreview - Check if it is need to open new tab
 * @return {void}
 */
export async function onReels(isDownload = false, isVideo = false, isPreview = false) {
    try {
        if (isDownload) {
            await runWithLoadingBar(async () => {
                const reelsPath = (location.href.split('?').at(0) ?? '').split('instagram.com/reels/').at(-1)?.replaceAll('/', '') ?? '';
                const result = await getBlobMedia(reelsPath);

                if (result.type === 'query_hash') {
                    const media = filterResourceData(result.data);
                    const timestamp = USER_SETTING.RENAME_PUBLISH_DATE ? media.taken_at_timestamp : Date.now();
                    if (isVideo && media.is_video) {
                        if (!media.video_url) throw new Error('Reel response has no video URL');
                        if (isPreview) {
                            openNewTab(media.video_url);
                        }
                        else {
                            const type = 'mp4';
                            await saveFiles(media.video_url, {
                                username: media.owner.username,
                                sourceType: "reels",
                                timestamp,
                                filetype: type,
                                shortcode: reelsPath
                            });
                        }
                    }
                    else {
                        const imageUrl = media.display_resources.at(-1)?.src;
                        if (!imageUrl) throw new Error('Reel response has no image URL');
                        if (isPreview) {
                            openNewTab(imageUrl);
                        }
                        else {
                            const type = 'jpg';
                            await saveFiles(imageUrl, {
                                username: media.owner.username,
                                sourceType: "reels",
                                timestamp,
                                filetype: type,
                                shortcode: reelsPath
                            });
                        }
                    }
                }
                else {
                    const media = filterResourceData(result.data);
                    const timestamp = USER_SETTING.RENAME_PUBLISH_DATE ? media.taken_at : Date.now();
                    if (isVideo && media.video_versions != null) {
                        if (isPreview) {
                            openNewTab(media.video_versions[0].url);
                        }
                        else {
                            const type = 'mp4';
                            await saveFiles(media.video_versions[0].url, {
                                username: media.owner.username,
                                sourceType: "reels",
                                timestamp,
                                filetype: type,
                                shortcode: reelsPath
                            });
                        }
                    }
                    else {
                        if (isPreview) {
                            openNewTab(media.image_versions2.candidates[0].url);
                        }
                        else {
                            const type = 'jpg';
                            await saveFiles(media.image_versions2.candidates[0].url, {
                                username: media.owner.username,
                                sourceType: "reels",
                                timestamp,
                                filetype: type,
                                shortcode: reelsPath
                            });
                        }
                    }
                }

            });
        }
        else {
            const svgClose = 'svg > polyline[points^="20.643 3.357 12 12 3.353 20.647"] ~ line';
            const timer = currentRouteScope().setInterval(() => {
                const hasTiktokStyleLayout = $(svgClose).length > 0;
                if (hasTiktokStyleLayout || $('section > main[role="main"] > div div.x1qjc9v5 video').length > 0) {
                    clearInterval(timer);
                    refreshReelsControls();
                }
            }, 250);
        }
    }
    catch (err) {
        logger('onReels()', 'failed', err);
    }
}

export function refreshReelsControls() {
    if (!location.pathname.startsWith('/reels/')) return;

    const seen = new Set<HTMLElement>();
    ($('video:visible') as JQuery<HTMLVideoElement>).each(function () {
        const rect = this.getBoundingClientRect();
        if (rect.width < 240 || rect.height < 240) return;

        const main = this.parentElement?.parentElement;
        if (!main || seen.has(main)) return;
        seen.add(main);
        appendReelsButton($(main));
    });
}

function appendReelsButton($main: JQuery<HTMLElement>) {
    const $mainChildren = $main.children();
    const reelControls = findReelActionControls($mainChildren[0]);
    if (reelControls && !reelControls.parent.querySelector(':scope > .IG_REEL_CONTROLS')) {
        mountReelControls(reelControls.parent, reelControls.before, {
            download: () => onReels(true, true),
            newTab: USER_SETTING.SHOW_OPEN_IN_NEW_TAB_BUTTON ? () => onReels(true, true, true) : null,
            thumbnail: () => onReels(true, false),
        });
    }

    const $videos = $main.find<HTMLVideoElement>('video');

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

    // Reloading the helper can revisit the same video node after controls are rebuilt.
    $videos.off('ended.igHelperLoop');
    if (USER_SETTING.DISABLE_VIDEO_LOOPING) {
        $videos.on('ended.igHelperLoop', function () {
            const $this = $(this);
            const $element_play_button = $this.next().find('div[role="presentation"] > div svg > path[d^="M5.888"]').parents('button[role="button"], div[role="button"]');
            if ($element_play_button.length > 0) {
                $element_play_button.trigger("click");
                logger('(reel) Stop video playing #loop, then paused click()');
                return;
            }

            $this.parent().find('.xpgaw4o').removeAttr('style');
            this.pause();
            logger('(reel) Stop video playing #loop, then paused pause()');
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
                    const $v = $(this);
                    $v.css('z-index', '2');
                    $v.attr('controls', '');
                    state.GL_weakCache.overlay.set(this, $overlayElement);
                });

                $overlayElement.css('z-index', '-10');
                $main.find('a[href^="/reels/"]').first().attr("draggable", 'false');
            };

            $main.off('contextmenu.IG_videoControl').on('contextmenu.IG_videoControl', handleSwitchController);
            $videos.each(function () {
                const $video = $(this);
                if (!$video.data('controls')) {

                    logger('(reel) Added video html5 contorller #modify');

                    if (USER_SETTING.MODIFY_VIDEO_VOLUME) {
                        this.volume = state.videoVolume;

                        $video.on('loadstart', function () {
                            this.volume = state.videoVolume;
                        });
                    }

                    let $mute_button_wrapper = $video.parent().find('video + div > div');
                    $mute_button_wrapper = $mute_button_wrapper.add($main);


                    const $element_mute_button = $mute_button_wrapper.find('button[type="button"], div[role="button"]').filter(function () {
                        const $b = $(this);
                        return ($b.width() ?? Infinity) <= 64 && ($b.height() ?? Infinity) <= 64 && $b.find('svg > path[d^="M16.636 7.028a1.5"], svg > path[d^="M1.5 13.3c-.8"]').length > 0;
                    });

                    state.GL_weakCache.mutedButton.set(this, $element_mute_button);

                    const $targets = $video.parent().find('video + div div[role="button"]').filter(function () {
                        const $t = $(this);
                        return $t.parent('div[role="presentation"]').length > 0 && $t.css('cursor') === 'pointer' && $t.attr('style') != null;
                    }).first();

                    $video.on('contextmenu', function (e) {
                        e.preventDefault();
                        e.stopPropagation();

                        $video.css('z-index', '-1');
                        $video.removeAttr('controls');
                        $targets.css('z-index', '1');
                        state.GL_weakCache.overlay.get(this)?.css('z-index', '1');
                    });

                    $targets.off('contextmenu.IG_videoControl').on('contextmenu.IG_videoControl', handleSwitchController);

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

                    $video.css('position', 'relative');
                    $video.data('controls', true);
                }
            });
    }

}

function findReelActionControls(main: Element | undefined) {
    let container: Element | null | undefined = main;
    let saveIcon: Element | undefined;

    while (container && container !== document.body) {
        saveIcon = Array.from(container.querySelectorAll('svg[aria-label="Save"]'))
            .find(icon => icon.getBoundingClientRect().width > 0);
        if (saveIcon) break;
        container = container.parentElement;
    }
    if (!saveIcon) return null;

    let saveItem = saveIcon;
    while (saveItem.parentElement && !Array.from(saveItem.parentElement.children).some(child =>
        child !== saveItem && child.querySelector?.('svg[aria-label="Share"]')
    )) {
        saveItem = saveItem.parentElement;
    }

    return saveItem.parentElement ? { parent: saveItem.parentElement, before: saveItem } : null;
}
