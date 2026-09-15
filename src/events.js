import $ from 'jquery';
import { state, USER_SETTING, $body } from "./settings";
import {
    reloadScript,
    triggerLinkElement, openNewTab, saveFiles, toggleVolumeSilder, updatePopupSelectionSummary,
    replaceSameOriginHost, setTimeElementDateAndLocaleTime, getHighlightCurrentTimeElement,
    triggerReactClickHandler
} from "./utils/general";
import { logger } from "./utils/logger";
import { onStory, onStoryAll, onStoryThumbnail } from "./functions/story";
import { onProfileAvatar } from "./functions/profile";
import { onHighlightsStory, onHighlightsStoryAll, onHighlightsStoryThumbnail } from "./functions/highlight";
import { onReels } from "./functions/reel";
import { _i18n } from "./utils/i18n";
import { getImageFromCache, registerPerformanceObserver } from "./utils/image_cache";
import { batchDownloadPostFiles, createDownloadButton } from "./functions/post";
import { showDebugDOM, showHotkeySetting, showSetting } from "./utils/dialog";
import {
    LEGACY_DIALOG_MOUNTED_EVENT,
    LEGACY_DIALOG_ROOT_ID,
    queryLegacyDialog,
    removeOwnedUiRoot,
} from './ui/shadow.js';

// Running if document is ready
$(function () {
    function ConvertDOM(domEl) {
        var obj = [];
        for (var ele of domEl) {
            obj.push({
                tagName: ele.tagName,
                id: ele.id,
                className: ele.className
            });
        }

        return obj;
    }

    function setDOMTreeContent(root) {
        const text = $('div[id^="mount"]')[0];
        let loggerStr = "";
        state.GL_logger.forEach(log => {
            const jsonData = JSON.stringify(log.content, function (key, value) {
                if (Array.isArray(this)) {
                    if (typeof value === "object" && value instanceof $) {
                        return ConvertDOM(value);
                    }
                    return value;
                }
                return value;
            }, "\t");
            loggerStr += `${new Date(log.time).toISOString()}: ${jsonData}\n`;
        });

        $(root).find('.IG_POPUP_DIG_BODY textarea').text(
            "Logger:\n" + loggerStr + "\n-----\n\nLocation: " + location.pathname + "\nDOM Tree with div#mount:\n" + text.innerHTML
        );
    }

    function bindLegacyDialogEvents(root) {
        const $root = $(root);
        const on = (type, selector, handler) => {
            root.addEventListener(type, event => {
                const target = event.target instanceof Element ? event.target.closest(selector) : null;
                if (!target || !root.contains(target)) return;
                handler.call(target, event);
            });
        };

        on('click', '.IG_DISPLAY_DOM_TREE', () => setDOMTreeContent(root));

        on('click', '.IG_SELECT_DOM_TREE', function () {
            const $textarea = $root.find('.IG_POPUP_DIG_BODY textarea');
            const textContent = $textarea.val() || $textarea.text();
            $textarea.trigger('select');

            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(textContent).catch(err => {
                    logger('Clipboard API failed, falling back to execCommand:', err);
                    try { document.execCommand('copy'); } catch (e) { logger('execCommand fallback failed:', e); }
                });
                return;
            }

            try { document.execCommand('copy'); } catch (e) { logger('execCommand failed:', e); }
        });

        on('click', '.IG_DOWNLOAD_DOM_TREE', function () {
            const $textarea = $root.find('.IG_POPUP_DIG_BODY textarea');
            if ($textarea.text().length === 0) setDOMTreeContent(root);

            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([$textarea.text()], { type: 'text/plain' }));
            a.download = `DOMTree-${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        });

        on('click', '.IG_POPUP_DIG_BTN, .IG_POPUP_DIG_BG', () => {
            removeOwnedUiRoot(LEGACY_DIALOG_ROOT_ID);
        });

        on('click', 'a[data-needed="direct"]', function (e) {
            e.preventDefault();
            triggerLinkElement($(this), false);
        });

        on('click', '.IG_POPUP_DIG_BODY .newTab', function () {
            const $linkA = $(this).parent().children('a');
            if (USER_SETTING.FORCE_RESOURCE_VIA_MEDIA && USER_SETTING.NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST) {
                triggerLinkElement($linkA.first()[0], true);
                return;
            }
            openNewTab(replaceSameOriginHost($linkA.data('href')));
        });

        on('click', '.IG_POPUP_DIG_BODY .videoThumbnail', function () {
            const $linkA = $(this).parent().children('a');
            let timestamp = Date.now();
            if (USER_SETTING.RENAME_PUBLISH_DATE && $linkA.attr('datetime')) timestamp = $linkA.attr('datetime');

            const postPath = $linkA.data('path') ?? $(queryLegacyDialog('#article-id')).text();
            if (USER_SETTING.CAPTURE_IMAGE_VIA_MEDIA_CACHE) {
                const mediaId = $linkA.first().attr('media-id');
                const cached = getImageFromCache(mediaId);
                if (cached) {
                    logger('[Restore Cached postThumbnail]', mediaId);
                    saveFiles(cached, {
                        username: $linkA.data('username'),
                        sourceType: 'thumbnail',
                        timestamp,
                        filetype: 'jpg',
                        shortcode: postPath,
                    });
                    return;
                }
            }

            saveFiles($linkA.find('img').first().attr('src'), {
                username: $linkA.data('username'),
                sourceType: 'thumbnail',
                timestamp,
                filetype: 'jpg',
                shortcode: postPath,
            });
        });

        on('change', '.IG_POPUP_DIG_TITLE .IG_SELECT_ALL', function () {
            const isChecked = $(this).find('input').prop('checked');
            $root.find('.IG_POPUP_DIG_BODY .inner_box').prop('checked', isChecked);
            updatePopupSelectionSummary($root.find('.IG_POPUP_DIG'));
        });

        on('change', '.IG_POPUP_DIG_BODY .inner_box', () => {
            updatePopupSelectionSummary($root.find('.IG_POPUP_DIG'));
        });

        on('click', '#batch_download_selected', function () {
            if ($root.find('#_SNLOAD').length > 0) return;

            const links = $root.find('.IG_POPUP_DIG_BODY a[data-needed="direct"]').filter(function () {
                return $(this).prev().children('input').prop('checked');
            }).map(function () { return $(this); }).get();

            if (links.length === 0) {
                alert(_i18n('NO_CHECK_RESOURCE'));
                return;
            }
            batchDownloadPostFiles(links);
        });

        on('click', '#batch_download_direct', function () {
            if ($root.find('#_SNLOAD').length > 0) return;
            const links = $root.find('.IG_POPUP_DIG_BODY a[data-needed="direct"]').map(function () { return $(this); }).get();
            batchDownloadPostFiles(links);
        });
    }

    document.addEventListener(LEGACY_DIALOG_MOUNTED_EVENT, event => bindLegacyDialogEvents(event.detail));

    $(window).on('keydown', function (e) {
        // Hot key [Alt+Q] to close legacy download/debug dialogs.
        if (e.altKey && e.which == 81) {
            removeOwnedUiRoot(LEGACY_DIALOG_ROOT_ID);
            e.preventDefault();
        }

        // Hot key [Alt+W] to open settings - use custom keycode if enabled, fallback to default Alt+W(87)
        let settingsKeyCode = state.settingsHotkeyKeyCode || 87;
        if (e.altKey && e.which == settingsKeyCode) {
            showSetting();
            e.preventDefault();
        }

        // Hot key [Alt+C] to open hotkey settings - use custom keycode if enabled, fallback to default Alt+C(67)
        let keySettingsHotkeyKeyCode = state.keySettingsHotkeyKeyCode || 67;
        if (e.altKey && e.which == keySettingsHotkeyKeyCode) {
            showHotkeySetting();
            e.preventDefault();
        }

        // Hot key [Alt+Z] to open the debug DOM - use custom keycode if enabled, fallback to default Alt+Z(90)
        let debugKeyCode = state.debugHotkeyKeyCode || 90;
        if (e.altKey && e.which == debugKeyCode) {
            showDebugDOM();
            e.preventDefault();
        }

        // Hot key [Alt+R] to reload script (fixed, not customizable)
        if (e.which == '82' && e.altKey) {
            reloadScript();
            e.preventDefault();
        }

        // Hot key [Alt+S] to download story/highlights resource - use custom keycode if enabled, fallback to default Alt+S(83)
        let downloadStoryKeyCode = state.downloadStoryHotkeyKeyCode || 83;
        if (e.altKey && e.which == downloadStoryKeyCode) {
            if (location.href.match(/^(https:\/\/www\.instagram\.com\/stories\/)/ig) && $('.IG_DWSTORY').length > 0) {
                $('.IG_DWSTORY')?.trigger("click");
            }
            if (location.href.match(/^(https:\/\/www\.instagram\.com\/stories\/highlights\/)/ig) && $('.IG_DWHISTORY').length > 0) {
                $('.IG_DWHISTORY')?.trigger("click");
            }
            e.preventDefault();
        }
    });

    // Running if user left-click download icon in stories
    $body.on('click', '.IG_DWSTORY', function () {
        onStory(true);
    });

    // Running if user left-click all download icon in stories
    $body.on('click', '.IG_DWSTORY_ALL', function () {
        onStoryAll();
    });

    // Running if user left-click 'open in new tab' icon in stories
    $body.on('click', '.IG_DWNEWTAB', function (e) {
        e.preventDefault();
        onStory(true, true, true);
    });

    // Running if user left-click download thumbnail icon in stories
    $body.on('click', '.IG_DWSTORY_THUMBNAIL', function () {
        onStoryThumbnail(true);
    });

    // Running if user left-click download icon in profile
    $body.on('click', '.IG_DWPROFILE', function (e) {
        e.stopPropagation();
        onProfileAvatar(true);
    });

    // Running if user left-click download icon in highlight stories
    $body.on('click', '.IG_DWHISTORY', function () {
        onHighlightsStory(true);
    });

    // Running if user left-click all download icon in highlight stories
    $body.on('click', '.IG_DWHISTORY_ALL', function () {
        onHighlightsStoryAll();
    });

    // Running if user left-click 'open in new tab' icon in highlight stories
    $body.on('click', '.IG_DWHINEWTAB', function (e) {
        e.preventDefault();
        onHighlightsStory(true, true);
    });

    // Running if user left-click thumbnail download icon in highlight stories
    $body.on('click', '.IG_DWHISTORY_THUMBNAIL', function () {
        onHighlightsStoryThumbnail(true);
    });

    // Running if user left-click download icon in reels
    $body.on('click', '.IG_REELS', function () {
        onReels(true, true);
    });

    // Running if user left-click newtab icon in reels
    $body.on('click', '.IG_REELS_NEWTAB', function () {
        onReels(true, true, true);
    });

    // Running if user left-click download icon in reels
    $body.on('click', '.IG_REELS_THUMBNAIL', function () {
        onReels(true, false);
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
        const hasPostMutation = location.pathname === '/' && mutationsList.some((mutation) =>
            mutation.target.closest?.('article') ||
            [...mutation.addedNodes].some((node) => node.matches?.('article') || node.querySelector?.('article'))
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
                            node.tagName === "DIV"
                        ) {
                            // replace something times ago format to publish time when switch highlight
                            var $time = getHighlightCurrentTimeElement($node);
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
                                    if (!$this.data('insert-thumbnail')) {
                                        let $video = $this;
                                        if ($video.parents('div[style][class]').filter(function () {
                                            return $(this).width() == $video.width();
                                        }).find('.IG_DWSTORY_THUMBNAIL, .IG_DWHISTORY_THUMBNAIL').length === 0) {
                                            $this.data('insert-thumbnail', true);

                                            if (isHighlight) {
                                                onHighlightsStoryThumbnail(false);
                                            }
                                            else {
                                                onStoryThumbnail(false);
                                            }

                                            logger(`(${storyType})`, 'Manually inserting thumbnail button');
                                        }
                                        else {
                                            $this.data('modify-thumbnail', true);
                                            logger(`(${storyType})`, 'Thumbnail button already inserted');
                                        }
                                    }
                                });

                                var $video = $(this);

                                if (USER_SETTING.HTML5_VIDEO_CONTROL) {
                                    if (!$video.data('controls')) {
                                        logger(`(${storyType})`, 'Added video html5 contorller #modify');

                                        if (USER_SETTING.MODIFY_VIDEO_VOLUME) {
                                            this.volume = state.videoVolume;

                                            $video.on('loadstart', function () {
                                                this.volume = state.videoVolume;
                                            });
                                        }

                                        let $videoParent = $video.parents('div').filter(function () {
                                            const $this = $(this);
                                            return $this.attr('class') == null && $this.attr('style') == null;
                                        }).first();

                                        // This is mute/unmute's icon
                                        let $element_mute_button = $videoParent.parent().find('svg > path[d^="M1.5 13.3c-.8 0-1.5.7-1.5 1.5v18.4c0"], svg > path[d^="M16.636 7.028a1.5 1.5"]').parents('[role="button"]').first();
                                        state.GL_weakCache.mutedButton.set($video[0], $element_mute_button);

                                        // story bottom bar
                                        let $bottomBar = $videoParent.next();

                                        // read more button in center
                                        let $readMoreButton = $videoParent.find('div[class][role="button"]');

                                        let $targets = $video.parent().find('video + div');

                                        const hideContextmenu = function (e) {
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
                                            $video.attr('controls', true);
                                            $targets.css('z-index', '-10');
                                            $overlayElement.css('z-index', '-10');

                                            $readMoreButton.hide();
                                            $bottomBar.hide();

                                            toggleVolumeSilder($video, $video.parents('div[style][class]').filter(function () {
                                                return $(this).width() == $video.width();
                                            }).first(), storyType, 'vertical');
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

                                            toggleVolumeSilder($video, $video.parents('div[style][class]').filter(function () {
                                                return $(this).width() == $video.width();
                                            }).first(), storyType, 'vertical');
                                        });

                                        $video.on('volumechange', function () {
                                            let $element_mute_button = state.GL_weakCache.mutedButton.get(this) || {};
                                            var is_element_muted = $element_mute_button?.find && $element_mute_button.find('svg > path[d^="M16.636"]').length === 0;

                                            if (this.muted != is_element_muted) {
                                                this.volume = state.videoVolume;

                                                triggerReactClickHandler($element_mute_button.first()[0]);
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

                                        toggleVolumeSilder($video, $video.parents('div[style][class]').filter(function () {
                                            return $(this).width() == $video.width();
                                        }).first(), storyType, 'vertical');
                                    }
                                }
                                else {
                                    toggleVolumeSilder($video, $video.parents('div[style][class]').filter(function () {
                                        return $(this).width() == $video.width();
                                    }).first(), storyType, 'vertical');
                                }
                            });
                        }
                    }
                });
            }
        }

        if (hasPostMutation) createDownloadButton();
    });

    (function installElementObserver(attempts) {
        const mountRoot = $('div[id^="mount"]')[0];
        if (mountRoot) {
            element_observer.observe(mountRoot, { childList: true, subtree: true });
            logger('[element_observer] installed on mount root');
        } else if (attempts > 0) {
            setTimeout(() => installElementObserver(attempts - 1), 250);
            logger('[element_observer] mount root not ready, retrying...');
        } else {
            logger('[element_observer] mount root not found after multiple retries');
        }
    })(20);
});
