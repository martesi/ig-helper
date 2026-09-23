import { localeManifest, translations } from '../../shared/locales.ts';

export { localeManifest };

const english: Record<string, string> = {
    SETTING: 'Settings',
    SETTINGS_DESCRIPTION: 'Control downloads, media behavior, and keyboard shortcuts.',
    SETTINGS_GENERAL: 'General',
    SETTINGS_GENERAL_DESCRIPTION: 'Language and core preferences.',
    SETTINGS_DOWNLOADS: 'Downloads',
    SETTINGS_DOWNLOADS_DESCRIPTION: 'Choose what downloads immediately and how resources are fetched.',
    SETTINGS_FILES: 'Files & metadata',
    SETTINGS_FILES_DESCRIPTION: 'Naming, timestamps, and metadata written to downloaded files.',
    SETTINGS_MEDIA: 'Media quality',
    SETTINGS_MEDIA_DESCRIPTION: 'Quality, API fallback, caching, and new-tab resource behavior.',
    SETTINGS_PLAYBACK: 'Playback & interface',
    SETTINGS_PLAYBACK_DESCRIPTION: 'Video playback and helper controls shown inside Instagram.',
    SETTINGS_NAVIGATION: 'Navigation',
    SETTINGS_NAVIGATION_DESCRIPTION: 'Story, shared-link, and profile navigation behavior.',
    SETTINGS_ADVANCED: 'Advanced',
    SETTINGS_ADVANCED_DESCRIPTION: 'Compatibility, API, caching, and metadata controls.',
    SETTINGS_KEYBOARD_DESCRIPTION: 'Choose the Alt shortcut for each IG Helper action.',
    SETTINGS_ABOUT: 'About',
    SETTINGS_ABOUT_DESCRIPTION: 'IG Helper build information.',
    SETTINGS_VERSION: 'Version',
    SETTINGS_SECTIONS: 'Settings sections',
    SETTINGS_PREFERENCES: 'Preferences',
    SETTINGS_KEYBOARD: 'Keyboard shortcuts',
    SETTINGS_LANGUAGE: 'Language',
    SETTINGS_LANGUAGE_NOTE: 'Some translations are machine-generated and may be inaccurate.',
    SETTINGS_VIDEO_VOLUME: 'Video volume',
    SETTINGS_VIDEO_VOLUME_VALUE: 'Video volume value',
    SETTINGS_FILE_NAME_FORMAT: 'File name format',
    SETTINGS_SHORTCUT_NOTE: 'Choose the key used with',
    AUTO_RENAME: 'Automatically Rename Files (Right-Click to Set)',
    AUTO_RENAME_SETTINGS_LABEL: 'Automatically Rename Files',
    RENAME_PUBLISH_DATE: 'Set Renamed File Timestamp to Resource Publish Date',
    DISABLE_VIDEO_LOOPING: 'Disable Video Auto-looping',
    HTML5_VIDEO_CONTROL: 'Display HTML5 Video Controller',
    SHOW_MEDIA_PREVIEW: 'Show media preview button',
    SHOW_OPEN_IN_NEW_TAB_BUTTON: 'Show Open in New Tab button',
    REDIRECT_CLICK_USER_STORY_PICTURE: "Redirect When Clicking on User's Story Picture",
    DIRECT_DOWNLOAD_MODE: 'Download button behavior',
    DIRECT_DOWNLOAD_MODE_ASK: 'Ask',
    DIRECT_DOWNLOAD_MODE_VISIBLE: 'Visible',
    DIRECT_DOWNLOAD_MODE_ALL: 'All',
    MODIFY_VIDEO_VOLUME: 'Modify Video Volume',
    MODIFY_VIDEO_VOLUME_SETTINGS_LABEL: 'Modify Video Volume',
    MODIFY_RESOURCE_EXIF: 'Modify Resource EXIF Properties',
    FORCE_RESOURCE_VIA_MEDIA: 'Force Fetch Resource via Media API',
    PREFER_DASH_MANIFEST: 'Prefer DASH Manifest (Higher-Quality Video via Media API)',
    FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED: 'Use Alternative Methods to Download When the Media API is Not Accessible',
    NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST: 'Always Use Media API for [Open in New Tab] in Posts',
    SKIP_VIEW_STORY_CONFIRM: 'Skip the Confirmation Page for Viewing a Story/Highlight',
    SKIP_SHARED_WITH_YOU_DIALOG: 'Skip "shared this with you" dialog on shared profile links',
    CAPTURE_IMAGE_VIA_MEDIA_CACHE: 'Capture Image Resource Using Media Cache',
    USE_EXTERNAL_DOWNLOAD_MODE: 'Use External Download Mode',
    AUTO_RENAME_INTRO: 'Auto rename file to a custom format.',
    RENAME_PUBLISH_DATE_INTRO: 'Use the resource publish date in the renamed file timestamp.',
    DISABLE_VIDEO_LOOPING_INTRO: 'Disable video auto-looping in Reels and posts.',
    HTML5_VIDEO_CONTROL_INTRO: 'Display the native HTML5 video controller.',
    SHOW_MEDIA_PREVIEW_INTRO: 'Show the button that opens the current post image in the lightbox viewer.',
    SHOW_OPEN_IN_NEW_TAB_BUTTON_INTRO: 'Show the button that opens the current post, Reel, or story resource in a new tab.',
    REDIRECT_CLICK_USER_STORY_PICTURE_INTRO: "Redirect to a user's profile page when interacting with their story avatar.",
    DIRECT_DOWNLOAD_MODE_INTRO: 'Choose what the download button does for posts, stories, and highlights.',
    MODIFY_VIDEO_VOLUME_INTRO: 'Set the playback volume used for Reels and posts.',
    MODIFY_RESOURCE_EXIF_INTRO: 'Write available post metadata to downloaded image EXIF data.',
    FORCE_RESOURCE_VIA_MEDIA_INTRO: 'Use the Media API to prefer the highest quality resource available.',
    PREFER_DASH_MANIFEST_INTRO: 'Prefer DASH video and audio streams when available for higher quality.',
    FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED_INTRO: 'Use alternative resource fetching when the Media API is unavailable or throttled.',
    NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST_INTRO: 'Use the Media API for Open in New Tab actions in posts.',
    SKIP_VIEW_STORY_CONFIRM_INTRO: 'Automatically skip the story or highlight confirmation page.',
    SKIP_SHARED_WITH_YOU_DIALOG_INTRO: 'Automatically dismiss the shared-link prompt on ?igsh= links.',
    CAPTURE_IMAGE_VIA_MEDIA_CACHE_INTRO: 'Capture high-quality image URLs observed in the page for later extraction.',
    USE_EXTERNAL_DOWNLOAD_MODE_INTRO: 'Use the userscript manager download API for downloads.',
    HOTKEY_DEBUG_KEY: 'Debug Window',
    HOTKEY_SETTINGS_KEY: 'Preference Settings',
    HOTKEY_KEY_SETTINGS_KEY: 'Hotkey Settings',
    HOTKEY_DOWNLOAD_STORY_KEY: 'Download Story',
    HOTKEY_CONFLICT_WARNING: 'This hotkey conflicts with another IG Helper action.',
    HOTKEY_RESET: 'Reset',
};

export function resolveLanguage(language: string | null | undefined): string {
    if (language && Object.hasOwn(localeManifest, language)) return language;
    const base = String(language || '').split('-')[0];
    return Object.keys(localeManifest).find(candidate => candidate === base || candidate.startsWith(`${base}-`)) || 'en-US';
}

export async function loadLocale(language: string): Promise<Record<string, string>> {
    const resolved = resolveLanguage(language);
    if (resolved === 'en-US') return {};
    return translations[resolved] ?? {};
}

export function createTranslator(locale: Record<string, string> = {}): (key: string) => string {
    return key => locale[key] ?? english[key] ?? key;
}
