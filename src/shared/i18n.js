import { state } from "../settings/state";
import { translations } from "./locales";

/**
 * translateText
 * @description i18n translation text.
 *
 * @return {void}
 */
export function translateText() {
    var eLocale = {
        "en-US": {
            "RELOAD_SCRIPT": "Reload Script",
            "DONATE": "Donate",
            "FEEDBACK": "Feedback",
            "IMAGE_VIEWER": "Open Image In Viewer",
            "NEW_TAB": "Open in New Tab",
            "COPY_MEDIA": "Copy Media",
            "COPY_MEDIA_SUCCESS": "Media copied to clipboard.",
            "COPY_MEDIA_UNSUPPORTED": "This media type cannot be copied to the clipboard.",
            "COPY_MEDIA_CLIPBOARD_UNAVAILABLE": "Clipboard access is unavailable.",
            "COPY_MEDIA_FAILED": "Could not copy media to the clipboard.",
            "SHOW_DOM_TREE": "Show DOM Tree",
            "SELECT_AND_COPY": "Select All and Copy from the Input Box",
            "DOWNLOAD_DOM_TREE": "Download DOM Tree as a Text File",
            "REPORT_GITHUB": "Report an Issue on GitHub",
            "REPORT_DISCORD": "Report an Issue on Discord Support Server",
            "REPORT_FORK": "Report an Issue on Greasy Fork",
            "DEBUG": "Debug Window",
            "CLOSE": "Close",
            "ALL_CHECK": "Select All",
            "ITEM_COUNT_SINGULAR": "%COUNT% item",
            "ITEM_COUNT_PLURAL": "%COUNT% items",
            "ITEM_POSITION": "Item %CURRENT% of %TOTAL%",
            "SELECTED_COUNT_SINGULAR": "%COUNT% selected",
            "SELECTED_COUNT_PLURAL": "%COUNT% selected",
            "BATCH_DOWNLOAD_SELECTED": "Download Selected Resources",
            "BATCH_DOWNLOAD_DIRECT": "Download All Resources",
            "IMG": "Image",
            "VID": "Video",
            "DW": "Download",
            "DW_ALL": "Download All Resources",
            "VIDEO_THUMBNAIL": "Download Video Thumbnail",
            "LOAD_BLOB_ONE": "Loading Blob Media...",
            "LOAD_BLOB_MULTIPLE": "Loading Blob Media and Others...",
            "LOAD_BLOB_RELOAD": "Detecting Blob Media, reloading...",
            "NO_CHECK_RESOURCE": "You need to select a resource to download.",
            "NO_VID_URL": "Cannot find video URL.",
            "SETTING": "Settings",
            "SETTINGS_DESCRIPTION": "Control downloads, media behavior, and keyboard shortcuts.",
            "SETTINGS_GENERAL": "General",
            "SETTINGS_GENERAL_DESCRIPTION": "Language and core preferences.",
            "SETTINGS_DOWNLOADS": "Downloads",
            "SETTINGS_DOWNLOADS_DESCRIPTION": "Choose what downloads immediately and how resources are fetched.",
            "SETTINGS_FILES": "Files & metadata",
            "SETTINGS_FILES_DESCRIPTION": "Naming, timestamps, and metadata written to downloaded files.",
            "SETTINGS_MEDIA": "Media quality",
            "SETTINGS_MEDIA_DESCRIPTION": "Quality, API fallback, caching, and new-tab resource behavior.",
            "SETTINGS_PLAYBACK": "Playback & interface",
            "SETTINGS_PLAYBACK_DESCRIPTION": "Video playback and helper controls shown inside Instagram.",
            "SETTINGS_NAVIGATION": "Navigation",
            "SETTINGS_NAVIGATION_DESCRIPTION": "Story, shared-link, and profile navigation behavior.",
            "SETTINGS_OTHER": "Other",
            "SETTINGS_OTHER_DESCRIPTION": "Additional helper behavior.",
            "SETTINGS_KEYBOARD_DESCRIPTION": "Choose the Alt shortcut for each IG Helper action.",
            "SETTINGS_SECTIONS": "Settings sections",
            "SETTINGS_PREFERENCES": "Preferences",
            "SETTINGS_KEYBOARD": "Keyboard shortcuts",
            "SETTINGS_LANGUAGE": "Language",
            "SETTINGS_LANGUAGE_NOTE": "Some translations are machine-generated and may be inaccurate.",
            "SETTINGS_VIDEO_VOLUME": "Video volume",
            "SETTINGS_VIDEO_VOLUME_VALUE": "Video volume value",
            "SETTINGS_FILE_NAME_FORMAT": "File name format",
            "SETTINGS_SHORTCUT_NOTE": "Choose the key used with",
            "AUTO_RENAME": "Automatically Rename Files (Right-Click to Set)",
            "AUTO_RENAME_SETTINGS_LABEL": "Automatically Rename Files",
            "RENAME_PUBLISH_DATE": "Set Renamed File Timestamp to Resource Publish Date",
            "RENAME_LOCATE_DATE": "Modify Renamed File Timestamp Date Format (Right-Click to Set)",
            "DISABLE_VIDEO_LOOPING": "Disable Video Auto-looping",
            "HTML5_VIDEO_CONTROL": "Display HTML5 Video Controller",
            "REDIRECT_CLICK_USER_STORY_PICTURE": "Redirect When Clicking on User's Story Picture",
            "DIRECT_DOWNLOAD_VISIBLE_RESOURCE": "Directly Download the Visible Resources in the Post",
            "DIRECT_DOWNLOAD_ALL": "Directly Download All Resources in the Post",
            "MODIFY_VIDEO_VOLUME": "Modify Video Volume",
            "MODIFY_VIDEO_VOLUME_SETTINGS_LABEL": "Modify Video Volume",
            "MODIFY_RESOURCE_EXIF": "Modify Resource EXIF Properties",
            "FORCE_RESOURCE_VIA_MEDIA": "Force Fetch Resource via Media API",
            "PREFER_DASH_MANIFEST": "Prefer DASH Manifest (Higher-Quality Video via Media API)",
            "FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED": "Use Alternative Methods to Download When the Media API is Not Accessible",
            "NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST": "Always Use Media API for [Open in New Tab] in Posts",
            "SKIP_VIEW_STORY_CONFIRM": "Skip the Confirmation Page for Viewing a Story/Highlight",
            "SKIP_SHARED_WITH_YOU_DIALOG": "Skip \"shared this with you\" dialog on shared profile links",
            "CAPTURE_IMAGE_VIA_MEDIA_CACHE": "Capture Image Resource Using Media Cache",
            "AUTO_RENAME_INTRO": [
                "Auto rename file to custom format:",
                "Custom Format List:",
                "%USERNAME% - Username",
                "%SOURCE_TYPE% - Download Source",
                "%SHORTCODE% - Post Shortcode",
                "%YEAR% - Year when downloaded/published",
                "%2-YEAR% - Year (last two digits) when downloaded/published",
                "%MONTH% - Month when downloaded/published",
                "%DAY% - Day when downloaded/published",
                "%HOUR% - Hour when downloaded/published",
                "%MINUTE% - Minute when downloaded/published",
                "%SECOND% - Second when downloaded/published",
                "%ORIGINAL_NAME% - Original name of downloaded file",
                "%ORIGINAL_NAME_FIRST% - Original name of downloaded file (first part of name)",
                "%INDEX% - Resource index",
                "%UID% - User account unique ID",
                "",
                "If set to false, the file name will remain unchanged.",
                "Example: instagram_321565527_679025940443063_4318007696887450953_n.jpg"
            ],
            "RENAME_PUBLISH_DATE_INTRO": "Sets the timestamp in the file rename format to the resource publish date (browser time zone).\n\nThis feature only works when [Automatically Rename Files] is set to TRUE.",
            "RENAME_LOCATE_DATE_INTRO": "Modify the renamed file timestamp date format to the browser's local time, and format it to your preferred regional date format.\n\nThis feature only works when [Automatically Rename Files] is set to TRUE.",
            "DISABLE_VIDEO_LOOPING_INTRO": "Disable video auto-looping in Reels and posts.",
            "HTML5_VIDEO_CONTROL_INTRO": "Display the HTML5 video controller in video resource. The HTML5 controller can be hidden by right-clicking on the video to reveal the original details.",
            "REDIRECT_CLICK_USER_STORY_PICTURE_INTRO": "Redirect to a user's profile page when right-clicking on their avatar in the story area on the homepage.\nIf you use the middle mouse button to click, it will open in a new tab.",
            "DIRECT_DOWNLOAD_VISIBLE_RESOURCE_INTRO": "Directly download the current resources available in the post.",
            "DIRECT_DOWNLOAD_ALL_INTRO": "When you click the download button, all resources in the post will be forcibly fetched and downloaded.",
            "MODIFY_VIDEO_VOLUME_INTRO": "Set the playback volume used for Reels and posts.",
            "FORCE_RESOURCE_VIA_MEDIA_INTRO": "The Media API will try to get the highest quality photo or video possible, but it may take longer to load.",
            "PREFER_DASH_MANIFEST_INTRO": "Prefer the DASH manifest for video resources via the Media API. If a DASH manifest is available, it will download the video and audio streams SEPARATELY for the best possible quality.",
            "FALLBACK_TO_BLOB_FETCH_IF_MEDIA_API_THROTTLED_INTRO": "When the Media API reaches its rate limit or cannot be used for other reasons, the Forced Fetch API will be used to download resources (the resource quality may be slightly lower).",
            "NEW_TAB_ALWAYS_FORCE_MEDIA_IN_POST_INTRO": "The [Open in New Tab] button in posts will always use the Media API to obtain high-resolution resources.",
            "SKIP_VIEW_STORY_CONFIRM_INTRO": "Automatically skip when confirmation page is shown in story or highlight.",
            "SKIP_SHARED_WITH_YOU_DIALOG_INTRO": "Automatically click \"Not now\" on the \"X shared this with you\" dialog when opening any ?igsh= links.",
            "MODIFY_RESOURCE_EXIF_INTRO": "Modify the EXIF attribute of the image resource to include metadata such as post link, shooting date, and author.",
            "CAPTURE_IMAGE_VIA_MEDIA_CACHE_INTRO": "Use a watcher to capture any high-quality image URLs in the DOM tree into the script's storage so that they can be extracted when available and upon user input.",
            "HOTKEY_DEBUG_KEY": "Debug Window",
            "HOTKEY_SETTINGS_KEY": "Preference Settings",
            "HOTKEY_KEY_SETTINGS_KEY": "Hotkey Settings",
            "HOTKEY_DOWNLOAD_STORY_KEY": "Download Story",
            "HOTKEY_CONFLICT_WARNING": "This hotkey may conflict with other settings.",
            "HOTKEY_RESET": "Reset",
            "USE_EXTERNAL_DOWNLOAD_MODE": "Use External Download Mode",
            "USE_EXTERNAL_DOWNLOAD_MODE_INTRO": "Enabling this feature will cause the script to use extended download functions (such as GM_download) to download files, resolving the issue of missing files when download multiple files.\n\nPlease note: Enabling this feature may cause the file renaming function to malfunction. Please ensure that the download mode in your extended feature settings is set to Native."
        }
    };

    var resultUnsorted = Object.assign({}, eLocale, state.locale);
    var resultSorted = Object.keys(resultUnsorted).sort().reduce(
        (obj, key) => {
            obj[key] = resultUnsorted[key];
            return obj;
        }, {}
    );

    var result = Object.assign({}, resultSorted);
    for (const lang in result) {
        const translations = result[lang];
        if (!translations || typeof translations !== "object") {
            continue;
        }

        Object.keys(translations).forEach((key) => {
            const value = translations[key];
            if (Array.isArray(value)) {
                translations[key] = value.join("\n");
            }
        });
    }

    return result;
}

/**
 * getTranslationText
 * @description i18n translation text.
 *
 * @param  {String}  lang
 * @return {Object}
 */
export async function getTranslationText(lang) {
    const translation = translations[lang];
    if (translation == null) {
        throw new Error(`Translation not found for ${lang}`);
    }
    return translation;
}

/**
 * _i18n
 * @description Perform i18n translation.
 *
 * @param  {String}  text
 * @return {void}
 */
export function _i18n(text) {
    const translate = translateText();

    if (translate[state.lang] != undefined && translate[state.lang][text] != undefined) {
        return translate[state.lang][text];
    }
    else {
        return translate["en-US"][text];
    }
}

/**
 * repaintingTranslations
 * @description Perform i18n translation.
 *
 * @return {void}
 */
export function repaintingTranslations() {
    document.querySelectorAll('[data-ih-locale]').forEach(element => {
        element.textContent = _i18n(element.dataset.ihLocale);
    });
    document.querySelectorAll('[data-ih-locale-title]').forEach(element => {
        const label = _i18n(element.dataset.ihLocaleTitle);
        element.title = label;
        if (element.hasAttribute('aria-label')) element.setAttribute('aria-label', label);
    });
}
