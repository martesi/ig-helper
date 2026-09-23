import { updateLoadingBar } from "./ui/status.tsx";

/**
 * replaceSameOriginHost
 * @description Replace the host of the URL to bypass the same-origin policy for certain video resources that cannot be downloaded directly.
 *
 * @param  {string}  url
 * @return {string}
 */
export function replaceSameOriginHost(url: string): string {
    // replace https://instagram.ftpe8-2.fna.fbcdn.net/ to https://scontent.cdninstagram.com/ becase of same origin policy (some video)
    const urlObj = new URL(url);
    urlObj.host = 'scontent.cdninstagram.com';

    return urlObj.href;
}

/**
 * openNewTab
 * @description Open URL in new tab.
 *
 * @param  {String}  link
 * @return {void}
 */
export function openNewTab(link: string): void {
    const a = document.createElement('a');
    a.href = link;
    a.target = '_blank';

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => { updateLoadingBar(false); }, 125);
}
