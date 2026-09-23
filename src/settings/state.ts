import $ from 'jquery';
import type { StoryResponse, UserInfo } from '../shared/instagram-data.ts';
import {
    DEFAULT_RENAME_FORMAT,
    DEFAULT_USER_SETTINGS,
    DEFAULT_VIDEO_VOLUME,
    DIRECT_DOWNLOAD_MODE_OPTIONS,
    PARENT_CHILD_MAPPING,
} from './schema';
import type { UserSettings } from './schema';

/******** USER SETTINGS ********/
// !!! DO NOT CHANGE THIS AREA !!!
// ??? PLEASE CHANGE SETTING WITH MENU ???
export const USER_SETTING: UserSettings = { ...DEFAULT_USER_SETTINGS };
export { DIRECT_DOWNLOAD_MODE_OPTIONS, PARENT_CHILD_MAPPING };
export const IMAGE_CACHE_KEY = 'URLS_OF_IMAGES_TEMPORARILY_STORED';
export const IMAGE_CACHE_MAX_AGE = 12 * 60 * 60 * 1000; // 12h in ms
export const IMAGE_MAX_CACHE_ITEMS = 300;
/*******************************/

// Icon download by Google Fonts Material Icon & Lucide
export const SVG = {
    DOWNLOAD: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download-icon lucide-download"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>',
    NEW_TAB: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link-icon lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    THUMBNAIL: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-icon lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
    DOWNLOAD_ALL: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cloud-download-icon lucide-cloud-download"><path d="M12 13v8l-4-4"/><path d="m12 21 4-4"/><path d="M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284"/></svg>',
    FULLSCREEN: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-maximize-icon lucide-maximize"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
};

/*******************************/

// Shared post-resource selector used by rendering and download actions.
// Improve the selector by using the value from the getVisibleNodeIndex function in 'const $viewport'.
export const resourceCountSelector = '*:not([data-pagelet])>*:not([role]):not([data-pagelet])>*>*>*[role]>*>ul[class] li[class]';

/*******************************/
export const checkInterval = 250;

export const userIdCache = new Map<string, UserInfo | Promise<UserInfo>>();

// OPTIMIZATION: Cached jQuery body reference — used in many places, jQuery 4
// creates a new wrapper for each $('body') call. Reusing $body avoids that
// overhead while remaining 100% behavior-compatible.
export const $body = $('body');

export interface LogEntry {
    time: number;
    content: unknown[];
}

export const state = {
    videoVolume: Number(GM_getValue('G_VIDEO_VOLUME', DEFAULT_VIDEO_VOLUME)),
    tempFetchRateLimit: false,
    fileRenameFormat: String(GM_getValue('G_RENAME_FORMAT', DEFAULT_RENAME_FORMAT)),
    registerMenuIds: [] as number[],
    locale: {} as Record<string, Record<string, string>>,
    lang: String(GM_getValue('UI_LANGUAGE', navigator.language)),
    currentURL: location.href,
    firstStarted: false,
    pageLoaded: false,
    GL_logger: [] as LogEntry[],
    GL_referrer: null as string | null,
    GL_postPath: null as string | null,
    GL_username: null as string | null,
    GL_repeat: null as ReturnType<typeof setInterval> | null,
    GL_dataCache: {
        stories: {} as Record<string, StoryResponse>,
        highlights: {} as Record<string, StoryResponse>,
    },
    GL_observer: null as MutationObserver | null,
    GL_imageCache: GM_getValue<Record<string, { url: string; ts: number }>>(IMAGE_CACHE_KEY, {}),
    GL_mediaDataCache: {} as Record<string, {
        video_dash_manifest?: string;
        video_versions?: { url: string }[];
    }>,
    GL_weakCache: {
        overlay: new WeakMap<HTMLVideoElement, JQuery<Element>>(),
        mutedButton: new WeakMap<HTMLVideoElement, JQuery<Element>>(),
    },
    debugHotkeyKeyCode: (GM_getValue('G_HOTKEY_DEBUG_KEYCODE')) ? GM_getValue('G_HOTKEY_DEBUG_KEYCODE') : 90,
    settingsHotkeyKeyCode: (GM_getValue('G_HOTKEY_SETTINGS_KEYCODE')) ? GM_getValue('G_HOTKEY_SETTINGS_KEYCODE') : 87,
    keySettingsHotkeyKeyCode: (GM_getValue('G_HOTKEY_KEY_SETTINGS_KEYCODE')) ? GM_getValue('G_HOTKEY_KEY_SETTINGS_KEYCODE') : 67,
    downloadStoryHotkeyKeyCode: (GM_getValue('G_HOTKEY_DOWNLOAD_STORY_KEYCODE')) ? GM_getValue('G_HOTKEY_DOWNLOAD_STORY_KEYCODE') : 83
};
/*******************************/
