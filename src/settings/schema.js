export const DIRECT_DOWNLOAD_MODE_OPTIONS = Object.freeze({
    ASK: 'ask',
    VISIBLE: 'visible',
    ALL: 'all',
});

export const DEFAULT_USER_SETTINGS = {
    AUTO_RENAME: true,
    CAPTURE_IMAGE_VIA_MEDIA_CACHE: true,
    DIRECT_DOWNLOAD_MODE: DIRECT_DOWNLOAD_MODE_OPTIONS.VISIBLE,
    DISABLE_VIDEO_LOOPING: false,
    FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED: false,
    FORCE_RESOURCE_VIA_MEDIA: false,
    HTML5_VIDEO_CONTROL: false,
    SHOW_MEDIA_PREVIEW: true,
    SHOW_OPEN_IN_NEW_TAB_BUTTON: false,
    MODIFY_RESOURCE_EXIF: false,
    MODIFY_VIDEO_VOLUME: false,
    NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST: false,
    PREFER_DASH_MANIFEST: false,
    REDIRECT_CLICK_USER_STORY_PICTURE: false,
    RENAME_PUBLISH_DATE: true,
    SCROLL_BUTTON: true,
    SKIP_VIEW_STORY_CONFIRM: false,
    SKIP_SHARED_WITH_YOU_DIALOG: false,
    USE_EXTERNAL_DOWNLOAD_MODE: false,
};

export function resolveDirectDownloadMode(value, legacyVisible, legacyAll) {
    if (Object.values(DIRECT_DOWNLOAD_MODE_OPTIONS).includes(value)) return value;
    if (legacyVisible === true) return DIRECT_DOWNLOAD_MODE_OPTIONS.VISIBLE;
    if (legacyAll === true) return DIRECT_DOWNLOAD_MODE_OPTIONS.ALL;
    if (legacyVisible === false || legacyAll === false) return DIRECT_DOWNLOAD_MODE_OPTIONS.ASK;
    return DIRECT_DOWNLOAD_MODE_OPTIONS.VISIBLE;
}

export const PARENT_CHILD_MAPPING = {
    AUTO_RENAME: ['RENAME_PUBLISH_DATE'],
    FORCE_RESOURCE_VIA_MEDIA: [
        'FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED',
        'NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST',
        'PREFER_DASH_MANIFEST',
    ],
};

export const HOTKEY_OPTIONS = [87, 90, 88, 68, 75, 67, 83, 192, 49, 50, 51, 52, 53];

export const HOTKEY_SETTINGS = [
    { key: 'HOTKEY_SETTINGS_KEY', stateKey: 'settingsHotkeyKeyCode', storageKey: 'G_HOTKEY_SETTINGS_KEYCODE', defaultKeyCode: 87 },
    { key: 'HOTKEY_KEY_SETTINGS_KEY', stateKey: 'keySettingsHotkeyKeyCode', storageKey: 'G_HOTKEY_KEY_SETTINGS_KEYCODE', defaultKeyCode: 67 },
    { key: 'HOTKEY_DEBUG_KEY', stateKey: 'debugHotkeyKeyCode', storageKey: 'G_HOTKEY_DEBUG_KEYCODE', defaultKeyCode: 90 },
    { key: 'HOTKEY_DOWNLOAD_STORY_KEY', stateKey: 'downloadStoryHotkeyKeyCode', storageKey: 'G_HOTKEY_DOWNLOAD_STORY_KEYCODE', defaultKeyCode: 83 },
];

export const DEFAULT_VIDEO_VOLUME = 1;
export const DEFAULT_RENAME_FORMAT = '%USERNAME%-%SOURCE_TYPE%-%SHORTCODE%-%YEAR%%MONTH%%DAY%_%HOUR%%MINUTE%%SECOND%_%ORIGINAL_NAME_FIRST%';

export const SETTINGS_STORAGE_KEYS = {
    language: 'UI_LANGUAGE',
    videoVolume: 'G_VIDEO_VOLUME',
    renameFormat: 'G_RENAME_FORMAT',
};
