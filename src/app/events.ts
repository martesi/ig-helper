import $ from 'jquery';
import { state, USER_SETTING, $body } from "../settings/state";
import {
    setTimeElementDateAndLocaleTime,
    getHighlightCurrentTimeElement
} from "../shared/story";
import { triggerReactClickHandler } from "../shared/react";
import { logger } from "../shared/logger";
import { onStoryDownload, onStoryThumbnail } from "../features/story";
import { onHighlightsStoryDownload, onHighlightsStoryThumbnail } from "../features/highlight";
import { refreshReelsControls } from "../features/reel";
import { registerPerformanceObserver } from "../features/media/image-cache";
import { createDownloadButton } from "../features/post/post";
import { showDebugger, showHotkeySetting, showSetting } from "../features/menu";
import { subscribeRouteScope, type RouteScope } from "../shared/route-scope";

export function registerEvents() {
    // Running if document is ready
    $(function () {
    document.addEventListener('keydown', function (e) {
        const keyCode = e.keyCode || e.which;

        // Hot key [Alt+W] to open settings - use custom keycode if enabled, fallback to default Alt+W(87)
        const settingsKeyCode = state.settingsHotkeyKeyCode || 87;
        if (e.altKey && keyCode === settingsKeyCode) {
            showSetting();
            e.preventDefault();
        }

        // Hot key [Alt+C] to open hotkey settings - use custom keycode if enabled, fallback to default Alt+C(67)
        const keySettingsHotkeyKeyCode = state.keySettingsHotkeyKeyCode || 67;
        if (e.altKey && keyCode === keySettingsHotkeyKeyCode) {
            showHotkeySetting();
            e.preventDefault();
        }

        // Hot key [Alt+Z] to open debugger - use custom keycode if enabled, fallback to default Alt+Z(90)
        const debugKeyCode = state.debugHotkeyKeyCode || 90;
        if (e.altKey && keyCode === debugKeyCode) {
            showDebugger();
            e.preventDefault();
        }

        // Hot key [Alt+S] to download story/highlights resource - use custom keycode if enabled, fallback to default Alt+S(83)
        const downloadStoryKeyCode = state.downloadStoryHotkeyKeyCode || 83;
        if (e.altKey && keyCode === downloadStoryKeyCode) {
            if (location.pathname.startsWith('/stories/highlights/')) void onHighlightsStoryDownload();
            else if (location.pathname.startsWith('/stories/')) void onStoryDownload();
            e.preventDefault();
        }
    });

    // Running if user right-click profile picture in stories area
    $body.on('mousedown', 'button[role="menuitem"], div[role="menuitem"], ul > li[tabindex="-1"] > div[role="button"]', function (e) {
        // Right-Click || Middle-Click
        if (e.which === 3 || e.which === 2) {
            if (location.href === 'https://www.instagram.com/' && USER_SETTING.REDIRECT_CLICK_USER_STORY_PICTURE) {
                e.preventDefault();

                const $this = $(this);
                $this.find('img').each(function () {
                    const $img = $(this);
                    if (!$img.data('contextmenu')) {
                        $img.data('contextmenu', true);
                        $img.on('contextmenu', function (e) {
                            e.preventDefault();
                        });
                    }
                });

                if ($this.find('canvas._aarh, canvas + span > img').length > 0) {
                    const targetUrl = 'https://www.instagram.com/' + $this.children('div').last().text();
                    if (e.which === 2) {
                        GM_openInTab(targetUrl);
                    }
                    else {
                        location.href = targetUrl;
                    }
                }
            }
        }
    });

    registerPerformanceObserver();

    const element_observer = new MutationObserver((mutationsList) => {
        const hasPostMutation = mutationsList.some((mutation) =>
            (mutation.target instanceof Element && mutation.target.closest('article')) ||
            [...mutation.addedNodes].some((node) => node instanceof Element && (node.matches('article') || node.querySelector('article')))
        );
        const hasReelMutation = location.pathname.startsWith('/reels/') && mutationsList.some((mutation) =>
            [...mutation.addedNodes, ...mutation.removedNodes].some((node) =>
                node instanceof Element && (node.matches('video, .IG_REEL_CONTROLS') || node.querySelector('video, .IG_REEL_CONTROLS'))
            )
        );

        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    const $node = $(node);
                    const $videos = $node.find('video').addBack('video');

                    if (location.pathname.startsWith("/stories/highlights/")) {
                        if (
                            $node.attr("data-ih-locale-title") == null &&
                            $node.attr("data-visualcompletion") == null &&
                            node instanceof Element && node.tagName === "DIV"
                        ) {
                            // replace something times ago format to publish time when switch highlight
                            const $time = getHighlightCurrentTimeElement($(node as Element));
                            setTimeElementDateAndLocaleTime($time);
                        }
                    }

                    if ($videos.length > 0) {
                        // Modify video volume
                        if (USER_SETTING.MODIFY_VIDEO_VOLUME) {
                            $videos.each(function () {
                                $(this).one('play playing', function () {
                                    const $this = $(this);
                                    if (!$this.data('modify')) {
                                        $this.data('modify', true);
                                        this.volume = state.videoVolume;
                                        logger('(audio_observer) Added video event listener #modify');
                                    }
                                });
                            });
                        }

                        if (location.pathname.match(/^(\/stories\/)/ig)) {
                            const isHighlight = location.pathname.match(/^(\/stories\/highlights\/)/ig) != null;
                            const storyType = isHighlight ? 'highlight' : 'story';

                            $videos.each(function () {
                                $(this).one('timeupdate', function () {
                                    const $this = $(this);
                                    if ($this.data('insert-thumbnail')) return;
                                    $this.data('insert-thumbnail', true);

                                    if (isHighlight) {
                                        onHighlightsStoryThumbnail(false);
                                    }
                                    else {
                                        onStoryThumbnail(false);
                                    }

                                    logger(`(${storyType})`, 'Updated video controls');
                                });

                                const $video = $(this);

                                if (USER_SETTING.HTML5_VIDEO_CONTROL) {
                                    if (!$video.data('controls')) {
                                        logger(`(${storyType})`, 'Added video html5 contorller #modify');

                                        if (USER_SETTING.MODIFY_VIDEO_VOLUME) {
                                            this.volume = state.videoVolume;

                                            $video.on('loadstart', function () {
                                                this.volume = state.videoVolume;
                                            });
                                        }

                                        const $videoParent = $video.parents('div').filter(function () {
                                            const $this = $(this);
                                            return $this.attr('class') == null && $this.attr('style') == null;
                                        }).first();

                                        // This is mute/unmute's icon
                                        const $element_mute_button = $videoParent.parent().find('svg > path[d^="M1.5 13.3c-.8 0-1.5.7-1.5 1.5v18.4c0"], svg > path[d^="M16.636 7.028a1.5 1.5"]').parents('[role="button"]').first();
                                        state.GL_weakCache.mutedButton.set($video[0], $element_mute_button);

                                        // story bottom bar
                                        const $bottomBar = $videoParent.next();

                                        // read more button in center
                                        const $readMoreButton = $videoParent.find('div[class][role="button"]');

                                        const $targets = $video.parent().find('video + div');

                                        const hideContextmenu = function (e: JQuery.TriggeredEvent) {
                                            e.preventDefault();
                                            e.stopPropagation();

                                            let $overlayElement = null;

                                            if ($overlayElement == null) {
                                                $overlayElement = $(e.target).parent().find('div[aria-label][data-visualcompletion="ignore"]').first();

                                                if ($overlayElement.length === 0) {
                                                    $overlayElement = $(e.target).first();
                                                }
                                            }

                                            state.GL_weakCache.overlay.set($video[0], $overlayElement);

                                            $video.css('z-index', '2');
                                            $video.attr('controls', '');
                                            $targets.css('z-index', '-10');
                                            $overlayElement.css('z-index', '-10');

                                            $readMoreButton.hide();
                                            $bottomBar.hide();

                                        };

                                        // Hide layout to show controller
                                        $targets.off('contextmenu.IG_videoControl').on('contextmenu.IG_videoControl', hideContextmenu);
                                        $readMoreButton.off('contextmenu.IG_videoControl').on('contextmenu.IG_videoControl', hideContextmenu);
                                        $bottomBar.off('contextmenu.IG_videoControl').on('contextmenu.IG_videoControl', hideContextmenu);
                                        $videoParent.off('contextmenu.IG_videoControl').on('contextmenu.IG_videoControl', hideContextmenu);

                                        // Restore layout to show details interface
                                        $video.on('contextmenu', function (e) {
                                            e.preventDefault();
                                            e.stopPropagation();

                                            $video.css('z-index', '-1');
                                            $video.removeAttr('controls');
                                            $targets.css('z-index', '1');
                                            state.GL_weakCache.overlay.get($video[0])?.css('z-index', '1');

                                            $bottomBar.show();
                                            $readMoreButton.show();

                                        });

                                        $video.on('volumechange', function () {
                                            const $element_mute_button = state.GL_weakCache.mutedButton.get(this);
                                            const is_element_muted = $element_mute_button?.find('svg > path[d^="M16.636"]').length === 0;

                                            if (this.muted != is_element_muted) {
                                                this.volume = state.videoVolume;

                                                const button = $element_mute_button?.first()[0];
                                                if (button instanceof HTMLElement) triggerReactClickHandler(button);
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

                                        $video.css('position', 'absolute');
                                        $video.data('controls', true);
                                    }
                                }
                            });
                        }
                    }
                });
            }
        }

        if (hasPostMutation) createDownloadButton();
        if (hasReelMutation) refreshReelsControls();
    });

    function installElementObserver(scope: RouteScope, attempts: number) {
        if (!scope.active) return;
        const mountRoot = $('div[id^="mount"]')[0];
        if (mountRoot) {
            scope.observe(element_observer, mountRoot, { childList: true, subtree: true });
            logger('[element_observer] installed on mount root');
        } else if (attempts > 0) {
            scope.setTimeout(() => installElementObserver(scope, attempts - 1), 250);
            logger('[element_observer] mount root not ready, retrying...');
        } else {
            logger('[element_observer] mount root not found after multiple retries');
        }
    }

    subscribeRouteScope(scope => installElementObserver(scope, 20));
    });
}
