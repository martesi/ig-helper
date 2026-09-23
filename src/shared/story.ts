import $ from 'jquery';
import { $body } from "../settings/state";
import { _i18n } from "./i18n";
import { appendCounter } from "./ui/status.tsx";

/**
 * getStoryId
 * @description Obtain the media id through the resource URL.
 *
 * @param  {string}  url
 * @return {string}
 */
export function getStoryId(url: string | null | undefined): string | null {
    if (!url) return null;
    const obj = new URL(url);
    const base64 = obj?.searchParams?.get('ig_cache_key')?.split('.').at(0);
    if (base64) {
        return atob(base64);
    }
    else {
        return null;
    }
}

/**
 * getTimeElementBaseDateSource
 * @description Get the base date text source and cache key from a time element.
 *
 * @param  {JQuery}  $time
 * @return {{dateText: ?string, cacheKey: ?string}}
 */
function getTimeElementBaseDateSource($time: JQuery<Element>) {
    const titleText = $time.attr('title')?.trim();
    if (titleText) {
        return {
            dateText: titleText,
            cacheKey: `title:${titleText}`
        };
    }

    const datetime = $time.attr('datetime')?.trim();
    if (datetime) {
        const date = new Date(datetime);
        if (!Number.isNaN(date.getTime())) {
            return {
                dateText: new Intl.DateTimeFormat(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }).format(date),
                cacheKey: `datetime:${datetime}`
            };
        }
    }

    return {
        dateText: null,
        cacheKey: null
    };
}

/**
 * getTimeElementBaseDateText
 * @description Get the preserved absolute date text from a time element.
 *
 * @param  {JQuery}  $time
 * @return {?string}
 */
function getTimeElementBaseDateText($time: JQuery<Element>) {
    const preservedText = $time.attr('data-ih-original-date')?.trim();
    const preservedKey = $time.attr('data-ih-original-date-key')?.trim();
    const { dateText, cacheKey } = getTimeElementBaseDateSource($time);

    if (preservedText && preservedKey && cacheKey && preservedKey === cacheKey) {
        return preservedText;
    }

    if (dateText && cacheKey) {
        $time.attr('data-ih-original-date', dateText);
        $time.attr('data-ih-original-date-key', cacheKey);
        return dateText;
    }

    return null;
}

/**
 * setTimeElementDateAndLocaleTime
 * @description Replace time element text with absolute date and localized time.
 *
 * @param  {JQuery}  $time
 * @return {void}
 */
export function setTimeElementDateAndLocaleTime($time: JQuery<Element>) {
    if ($time == null || $time.length === 0) {
        return;
    }

    const datetime = $time.attr('datetime');
    if (!datetime) {
        return;
    }

    const date = new Date(datetime);
    if (Number.isNaN(date.getTime())) {
        return;
    }

    const dateText = getTimeElementBaseDateText($time);
    if (!dateText) {
        return;
    }

    const localeTime = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit'
    }).format(date);

    if (!localeTime) {
        return;
    }

    const finalText = `${dateText} ${localeTime}`;

    if ($time.text()?.trim() !== finalText) {
        $time.text(finalText);
        $time.css('white-space', 'break-spaces');
    }
}

/**
 * getHighlightCurrentTimeElement
 * @description Get the publish time element in the current highlight view.
 *
 * @param  {JQuery}  $element
 * @return {JQuery}
 */
export function getHighlightCurrentTimeElement($element: JQuery<Element>): JQuery<Element> {
    if ($element == null || $element.length === 0) {
        $element = $body;
    }

    let $section = $element.closest('section:visible');
    if ($section.length === 0) {
        $section = $('body > div section:visible').last();
    }

    if ($section.length === 0) {
        return $();
    }

    const $times = $section.find('time[datetime]').filter(function () {
        const $time = $(this);

        return (
            $time.is(':visible') &&
            $time.closest('a[href^="/stories/highlights/"]').length === 0 &&
            $time.closest('[role="button"]').length === 0
        );
    });

    if ($times.length === 0) {
        return $();
    }

    return $times.first();
}

/**
 * getStoryProgress
 * @description Get the story progress of the username (post several stories).
 *
 * @param  {String}  username - Get progress of username
 * @return {Object}
 */
export function getStoryProgress(username: string): JQuery<Element> {
    const lowerUsername = username?.toLowerCase();
    let $header = $('body > div section:visible a[href^="/' + (username) + '"] span').filter(function () {
        const $this = $(this);
        return $this.children().length === 0 && $this.find('svg').length === 0 && $this.text()?.toLowerCase() === lowerUsername;
    }).parents('div:not([class]):not([style])').filter(function () {
        return $(this).text()?.toLowerCase() !== lowerUsername
    }).filter(function () {
        return $(this).children().length > 1
    }).first();

    if ($header.length === 0) {
        $header = $('body > div section:visible a[href^="/' + (username) + '"]').filter(function () {
            return $(this).find('img').length > 0
        }).parents('div:not([class]):not([style])').filter(function () {
            return $(this).text()?.toLowerCase() !== lowerUsername
        }).filter(function () {
            return $(this).children().length > 1
        }).first();
    }

    return $header.children().filter(function () {
        return ($(this).height() ?? Infinity) < 10
    }).first().children();
}

/**
 * getStoryProgressIndex
 * @description Get the current story index and total count from Instagram's progress bar.
 *
 * @param  {Object}  $header - Progress bar items returned by getStoryProgress
 * @return {?Object}
 */
export function getStoryProgressIndex($header: JQuery<Element>) {
    let current = 0;
    const total = $header.length;

    if (total === 0) {
        return null;
    }

    $header.each(function (index) {
        if ($(this).children().length > 0) {
            current = index + 1;
        }
    });

    if (current === 0) {
        return null;
    }

    return { current, total };
}

/**
 * setStoryProgressIndexText
 * @description Render the current story index and total count.
 *
 * @param  {Object}  $element - Element to append the counter to
 * @param  {Object}  $header - Progress bar items returned by getStoryProgress
 * @param  {String}  className - Counter class name
 * @return {void}
 */
export function setStoryProgressIndexText($element: JQuery<Element>, $header: JQuery<Element>, className: string) {
    const progress = getStoryProgressIndex($header);
    let $counter: JQuery<Element> = $element.find('.' + className).first();

    if (progress == null || progress.total < 2) {
        if ($counter.length > 0) {
            $counter.remove();
        }
        return;
    }

    const text = progress.current + '/' + progress.total;
    const title = _i18n('ITEM_POSITION')
        .replace('%CURRENT%', String(progress.current))
        .replace('%TOTAL%', String(progress.total));

    if ($counter.length === 0) {
        $counter = $(appendCounter($element[0], className));
    }

    if ($counter.text() !== text) {
        $counter.text(text);
    }

    if ($counter.attr('title') !== title) {
        $counter.attr('title', title);
    }

    if ($counter.attr('aria-label') !== title) {
        $counter.attr('aria-label', title);
    }
}

/**
 * setStoryProgressIndexByUsername
 * @description Render current story index and total count from a username.
 *
 * @param  {Object}  $element - Element to append the counter to
 * @param  {String}  username - Story owner's username
 * @param  {String}  className - Counter class name
 * @return {void}
 */
export function setStoryProgressIndexByUsername($element: JQuery<Element>, username: string, className: string) {
    if ($element == null || $element.length === 0 || username == null) {
        return;
    }

    const $header = getStoryProgress(username);
    setStoryProgressIndexText($element, $header, className);
}
