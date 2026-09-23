import $ from 'jquery';
import { Effect } from 'effect';
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

const profilePictureSelector = 'button[role="menuitem"], div[role="menuitem"], ul > li[tabindex="-1"] > div[role="button"]';
const documentReady = Effect.callback<void, never>(resume => {
    if (document.readyState !== 'loading') {
        resume(Effect.void);
        return Effect.void;
    }

    const onReady = () => resume(Effect.void);
    document.addEventListener('DOMContentLoaded', onReady, { once: true });
    return Effect.sync(() => document.removeEventListener('DOMContentLoaded', onReady));
});

export function registerEvents() {
    return Effect.gen(function* () {
        yield* documentReady;
        yield* Effect.acquireRelease(
            Effect.sync(() => {
                document.addEventListener('keydown', handleKeydown);
                $body.on('mousedown.IG_helper', profilePictureSelector, handleProfileMouseDown);
                return () => {
                    document.removeEventListener('keydown', handleKeydown);
                    $body.off('mousedown.IG_helper', profilePictureSelector, handleProfileMouseDown);
                };
            }),
            cleanup => Effect.sync(cleanup),
        );

        yield* registerPerformanceObserver();

        const observer = yield* Effect.acquireRelease(
            Effect.sync(() => new MutationObserver(handleMutations)),
            observer => Effect.sync(() => observer.disconnect()),
        );
        yield* Effect.acquireRelease(
            Effect.sync(() => subscribeRouteScope(scope => installElementObserver(scope, observer, 20))),
            unsubscribe => Effect.sync(unsubscribe),
        );
    });
}

function handleKeydown(event: KeyboardEvent) {
    const keyCode = event.keyCode || event.which;
    const settingsHotkey = state.settingsHotkeyKeyCode || 87;
    const hotkeySettingsHotkey = state.keySettingsHotkeyKeyCode || 67;
    const debugHotkey = state.debugHotkeyKeyCode || 90;
    const downloadStoryHotkey = state.downloadStoryHotkeyKeyCode || 83;

    if (event.altKey && keyCode === settingsHotkey) {
        showSetting();
        event.preventDefault();
    }
    if (event.altKey && keyCode === hotkeySettingsHotkey) {
        showHotkeySetting();
        event.preventDefault();
    }
    if (event.altKey && keyCode === debugHotkey) {
        showDebugger();
        event.preventDefault();
    }
    if (event.altKey && keyCode === downloadStoryHotkey) {
        if (location.pathname.startsWith('/stories/highlights/')) void onHighlightsStoryDownload();
        else if (location.pathname.startsWith('/stories/')) void onStoryDownload();
        event.preventDefault();
    }
}

function handleProfileMouseDown(this: HTMLElement, event: JQuery.TriggeredEvent) {
    if (event.which !== 3 && event.which !== 2) return;
    if (location.href !== 'https://www.instagram.com/' || !USER_SETTING.REDIRECT_CLICK_USER_STORY_PICTURE) return;
    event.preventDefault();

    const $target = $(this);
    $target.find('img').each(markContextMenuPrevented);
    if ($target.find('canvas._aarh, canvas + span > img').length === 0) return;

    const targetUrl = 'https://www.instagram.com/' + $target.children('div').last().text();
    if (event.which === 2) {
        GM_openInTab(targetUrl);
        return;
    }
    location.href = targetUrl;
}

function markContextMenuPrevented(this: HTMLElement) {
    const $image = $(this);
    if ($image.data('contextmenu')) return;
    $image.data('contextmenu', true);
    $image.on('contextmenu', preventContextMenu);
}

function preventContextMenu(event: JQuery.TriggeredEvent) {
    event.preventDefault();
}

function handleMutations(mutations: MutationRecord[]) {
    const hasPostMutation = mutations.some(mutation =>
        (mutation.target instanceof Element && mutation.target.closest('article')) ||
        [...mutation.addedNodes].some(node => node instanceof Element && (node.matches('article') || node.querySelector('article')))
    );
    const hasReelMutation = location.pathname.startsWith('/reels/') && mutations.some(mutation =>
        [...mutation.addedNodes, ...mutation.removedNodes].some(node =>
            node instanceof Element && (node.matches('video, .IG_REEL_CONTROLS') || node.querySelector('video, .IG_REEL_CONTROLS'))
        )
    );

    for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        mutation.addedNodes.forEach(handleAddedNode);
    }

    if (hasPostMutation) createDownloadButton();
    if (hasReelMutation) refreshReelsControls();
}

function handleAddedNode(node: Node) {
    const $node = $(node);
    if (isHighlightStory() && $node.attr('data-ih-locale-title') == null &&
        $node.attr('data-visualcompletion') == null && node instanceof Element && node.tagName === 'DIV') {
        setTimeElementDateAndLocaleTime(getHighlightCurrentTimeElement($(node)));
    }

    const $videos = $node.find('video').addBack('video');
    if ($videos.length === 0) return;
    if (USER_SETTING.MODIFY_VIDEO_VOLUME) $videos.each(addVolumeOnPlay);
    if (!location.pathname.startsWith('/stories/')) return;

    const isHighlight = location.pathname.startsWith('/stories/highlights/');
    $videos.each((_index, video) => prepareStoryVideo(video, isHighlight));
}

function isHighlightStory() {
    return location.pathname.startsWith('/stories/highlights/');
}

function addVolumeOnPlay(this: HTMLVideoElement) {
    $(this).one('play playing', function () {
        const $video = $(this);
        if ($video.data('modify')) return;
        $video.data('modify', true);
        this.volume = state.videoVolume;
        logger('(audio_observer) Added video event listener #modify');
    });
}

function prepareStoryVideo(video: HTMLVideoElement, isHighlight: boolean) {
    const $video = $(video);
    const storyType = isHighlight ? 'highlight' : 'story';
    $video.one('timeupdate', () => {
        if ($video.data('insert-thumbnail')) return;
        $video.data('insert-thumbnail', true);
        if (isHighlight) onHighlightsStoryThumbnail(false);
        else onStoryThumbnail(false);
        logger(`(${storyType})`, 'Updated video controls');
    });

    if (!USER_SETTING.HTML5_VIDEO_CONTROL || $video.data('controls')) return;
    logger(`(${storyType})`, 'Added video html5 contorller #modify');
    if (USER_SETTING.MODIFY_VIDEO_VOLUME) {
        video.volume = state.videoVolume;
        $video.on('loadstart', setVideoVolume);
    }
    installVideoControls(video);
}

function installVideoControls(video: HTMLVideoElement) {
    const $video = $(video);
    const $videoParent = $video.parents('div').filter(function () {
        const $this = $(this);
        return $this.attr('class') == null && $this.attr('style') == null;
    }).first();
    const $muteButton = $videoParent.parent().find(
        'svg > path[d^="M1.5 13.3c-.8 0-1.5.7-1.5 1.5v18.4c0"], svg > path[d^="M16.636 7.028a1.5 1.5"]'
    ).parents('[role="button"]').first();
    state.GL_weakCache.mutedButton.set(video, $muteButton);

    const $bottomBar = $videoParent.next();
    const $readMoreButton = $videoParent.find('div[class][role="button"]');
    const $targets = $video.parent().find('video + div');
    const hideControls = (event: JQuery.TriggeredEvent) => hideVideoControls(event, video, $video, $targets, $bottomBar, $readMoreButton);
    const showControls = (event: JQuery.TriggeredEvent) => showVideoControls(event, $video, $targets, $bottomBar, $readMoreButton);

    $targets.off('contextmenu.IG_videoControl').on('contextmenu.IG_videoControl', hideControls);
    $readMoreButton.off('contextmenu.IG_videoControl').on('contextmenu.IG_videoControl', hideControls);
    $bottomBar.off('contextmenu.IG_videoControl').on('contextmenu.IG_videoControl', hideControls);
    $videoParent.off('contextmenu.IG_videoControl').on('contextmenu.IG_videoControl', hideControls);
    $video.on('contextmenu', showControls);
    $video.on('volumechange', handleVolumeChange);
    $video.css('position', 'absolute');
    $video.data('controls', true);
}

function hideVideoControls(
    event: JQuery.TriggeredEvent,
    video: HTMLVideoElement,
    $video: JQuery<HTMLVideoElement>,
    $targets: JQuery,
    $bottomBar: JQuery,
    $readMoreButton: JQuery,
) {
    event.preventDefault();
    event.stopPropagation();

    let $overlayElement = $(event.target).parent().find('div[aria-label][data-visualcompletion="ignore"]').first();
    if ($overlayElement.length === 0) $overlayElement = $(event.target).first();
    state.GL_weakCache.overlay.set(video, $overlayElement);

    $video.css('z-index', '2');
    $video.attr('controls', '');
    $targets.css('z-index', '-10');
    $overlayElement.css('z-index', '-10');
    $readMoreButton.hide();
    $bottomBar.hide();
}

function showVideoControls(
    event: JQuery.TriggeredEvent,
    $video: JQuery<HTMLVideoElement>,
    $targets: JQuery,
    $bottomBar: JQuery,
    $readMoreButton: JQuery,
) {
    event.preventDefault();
    event.stopPropagation();
    $video.css('z-index', '-1');
    $video.removeAttr('controls');
    $targets.css('z-index', '1');
    state.GL_weakCache.overlay.get($video[0])?.css('z-index', '1');
    $bottomBar.show();
    $readMoreButton.show();
}

function setVideoVolume(this: HTMLVideoElement) {
    this.volume = state.videoVolume;
}

function handleVolumeChange(this: HTMLVideoElement) {
    const $muteButton = state.GL_weakCache.mutedButton.get(this);
    const isElementMuted = $muteButton?.find('svg > path[d^="M16.636"]').length === 0;
    if (this.muted !== isElementMuted) {
        this.volume = state.videoVolume;
        const button = $muteButton?.first()[0];
        if (button instanceof HTMLElement) triggerReactClickHandler(button);
    }

    const $video = $(this);
    if ($video.data('completed')) {
        state.videoVolume = this.volume;
        GM_setValue('G_VIDEO_VOLUME', this.volume);
    }
    if (this.volume === state.videoVolume) $video.data('completed', true);
}

function installElementObserver(scope: RouteScope, observer: MutationObserver, attempts: number) {
    if (!scope.active) return;
    const mountRoot = $('div[id^="mount"]')[0];
    if (mountRoot) {
        scope.observe(observer, mountRoot, { childList: true, subtree: true });
        logger('[element_observer] installed on mount root');
        return;
    }
    if (attempts <= 0) {
        logger('[element_observer] mount root not found after multiple retries');
        return;
    }
    scope.setTimeout(() => installElementObserver(scope, observer, attempts - 1), 250);
    logger('[element_observer] mount root not ready, retrying...');
}
