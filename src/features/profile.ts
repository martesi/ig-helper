import $ from 'jquery';
import { USER_SETTING } from "../settings/state";
import { saveFiles } from "../shared/download";
import { logger } from "../shared/logger";
import { getUserId, getUserHighSizeProfile } from "../shared/api";
import { mountProfileControl } from "./profile/controls.tsx";
import { currentRouteScope } from "../shared/route-scope";
import { runWithLoadingBar } from './loading';

/**
 * onProfileAvatar
 * @description Trigger user avatar download event or button display event.
 *
 * @param  {Boolean}  isDownload - Check if it is a download operation
 * @return {void}
 */
export async function onProfileAvatar(isDownload = false) {
    if (isDownload) {
        try {
            await runWithLoadingBar(async () => {
                const timestamp = Math.floor(Date.now() / 1000);
                const username = location.pathname.replaceAll(/(reels|tagged)\/$/ig, '').split('/').filter(s => s.length > 0).at(-1);
                if (!username) throw new Error('Profile username is missing');
                const userInfo = await getUserId(username);
                try {
                    const dataURL = await getUserHighSizeProfile(userInfo.user.pk);
                    await saveFiles(dataURL, {
                        username,
                        sourceType: "avatar",
                        timestamp,
                        filetype: 'jpg',
                        uid: userInfo.user.id
                    });
                }
                catch (err) {
                    logger('onProfileAvatar()', 'high-size avatar unavailable; using profile URL', err);
                    await saveFiles(userInfo.user.profile_pic_url, {
                        username,
                        sourceType: "avatar",
                        timestamp,
                        filetype: 'jpg',
                        uid: userInfo.user.id
                    });
                }
            });
        }
        catch (err) {
            logger('onProfileAvatar()', 'failed', err);
        }
    }
    else {
        if (!$('.IG_PROFILE_CONTROL').length) {
            const profileTimer = currentRouteScope().setInterval(() => {
                if ($('.IG_PROFILE_CONTROL').length) {
                    clearInterval(profileTimer);
                    return;
                }

                const selector = 'header > *[class]:first-child > *[class]:first-child img[alt]';
                const $draggableElements = $(`${selector}[draggable]`).parent().parent();
                const $nonDraggableElements = $(`${selector}:not([draggable])`).parent().parent().parent();
                $draggableElements.each((_, element) => { mountProfileControl(element as HTMLElement, () => { void onProfileAvatar(true); }); });
                $draggableElements.css('position', 'relative');
                $nonDraggableElements.each((_, element) => { mountProfileControl(element as HTMLElement, () => { void onProfileAvatar(true); }); });
                $nonDraggableElements.css('position', 'relative');
            }, 150);
        }
    }
}


/**
 * skipSharedWithYouDialog
 * @description Auto-skip the "X shared this with you" dialog for ?igsh= links.
 *
 * @return {void}
 */
export function skipSharedWithYouDialog() {
    if (!USER_SETTING.SKIP_SHARED_WITH_YOU_DIALOG) return;

    let url;
    try {
        url = new URL(window.location.href);
    }
    catch (e) {
        logger("[skipSharedWithYouDialog] invalid URL", e);
        return;
    }

    // only for shared links with the tracking param ?igsh=...
    if (!url.searchParams || !url.searchParams.has("igsh")) return;

    const $dialogs = $("div[role=\"dialog\"]");
    if (!$dialogs || !$dialogs.length) {
        return;
    }

    const profileUsername = location.pathname
        .split("/")
        .filter(s => s.length > 0)
        .at(0)?.toLowerCase();

    $dialogs.each(function () {
        const $dialog = $(this);

        if (!$dialog.is(":visible")) {
            return;
        }

        const $headers = $dialog.find("h2");
        if (!$headers.length) {
            return;
        }

        // Heuristic: header text that looks like "profile_name shared this with you"
        const isSharedHeader = $headers.filter(function () {
            const rawText = (this.textContent || "").trim().toLowerCase();
            if (!rawText) return false;

            // Typical case
            if (rawText.includes("shared this with you")) return true;
            if (rawText.includes("shared with you")) return true;

            // Fallback: contains username + "shared"
            if (profileUsername &&
                rawText.includes(profileUsername) &&
                rawText.includes("shared")) {
                return true;
            }

            return false;
        }).length > 0;

        if (!isSharedHeader) {
            return;
        }

        const $buttons = $dialog.find("div[role=\"button\"]");
        if (!$buttons.length) {
            logger("[skipSharedWithYouDialog] dialog has no buttons");
            return;
        }

        let $notNow = $buttons.filter(function () {
            return (this.textContent || '').trim().toLowerCase() === 'not now';
        }).first();

        // Fallback: if there are exactly 2 buttons, assume the second is "Not now"
        if (!$notNow.length && $buttons.length === 2) {
            $notNow = $buttons.last();
        }

        if (!$notNow.length) {
            logger("[skipSharedWithYouDialog] could not find \"Not now\" button");
            return;
        }

        logger("[skipSharedWithYouDialog] clicking \"Not now\" button");
        $notNow.trigger("click");
    });
}
