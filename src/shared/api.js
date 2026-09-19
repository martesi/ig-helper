import { userIdCache } from "../settings/state";
import { updateLoadingBar } from "./ui/status.jsx";
import { logger } from "./logger";
import * as z from "zod/mini";

const objectResponseSchema = z.record(z.string(), z.unknown());

function parseResponse(response) {
    return z.parse(objectResponseSchema, JSON.parse(response.response));
}
function getAppID() {
    for (const script of document.querySelectorAll('script[type="application/json"]')) {
        const match = script.textContent?.match(/"APP_ID":"([0-9]+)"/i);
        if (match) return match[1];
    }
    return null;
}


/**
 * getHighlightStories
 * @description Get a list of all stories in highlight Id.
 *
 * @param  {Integer}  highlightId
 * @return {Object}
 */
export function getHighlightStories(highlightId) {
    return new Promise((resolve, reject) => {
        const getURL = `https://www.instagram.com/graphql/query/?query_hash=45246d3fe16ccc6577e0bd297a5db1ab&variables=%7B%22highlight_reel_ids%22:%5B%22${highlightId}%22%5D,%22precomposed_overlay%22:false%7D`;

        GM_xmlhttpRequest({
            method: "GET",
            url: getURL,
            onload: function (response) {
                try {
                    const obj = parseResponse(response);
                    resolve(obj);
                }
                catch (err) {
                    logger('getHighlightStories()', 'reject', err.message);
                    reject(err);
                }
            },
            onerror: function (err) {
                logger('getHighlightStories()', 'reject', err);
                reject(err);
            }
        });
    });
}

/**
 * getStories
 * @description Get a list of all stories in user Id.
 *
 * @param  {Integer}  userId
 * @return {Object}
 */
export function getStories(userId) {
    return new Promise((resolve, reject) => {
        const getURL = `https://www.instagram.com/graphql/query/?query_hash=15463e8449a83d3d60b06be7e90627c7&variables=%7B%22reel_ids%22:%5B%22${userId}%22%5D,%22precomposed_overlay%22:false%7D`;

        GM_xmlhttpRequest({
            method: "GET",
            url: getURL,
            onload: function (response) {
                try {
                    const obj = parseResponse(response);
                    logger('getStories()', 'success');
                    resolve(obj);
                }
                catch (err) {
                    logger('getStories()', 'reject', err.message);
                    reject(err);
                }
            },
            onerror: function (err) {
                logger('getStories()', 'reject', err);
                reject(err);
            }
        });
    });
}

/**
 * getUserId
 * @description Get user's id with username.
 *
 * @param  {String}  username
 * @return {Promise<Integer>}
 */
export function getUserId(username) {
    return new Promise((resolve, reject) => {
        if (userIdCache.has(username)) {
            logger('getUserId()', 'cache hit');
            resolve(userIdCache.get(username));
            return;
        }

        let getURL = `https://www.instagram.com/web/search/topsearch/?query=${username}`;

        GM_xmlhttpRequest({
            method: "GET",
            url: getURL,
            onload: function (response) {
                try {
                    // Fix search issue by Discord: sno_w_
                    const obj = parseResponse(response);
                    let result = null;
                    (obj.users ?? []).forEach(pos => {
                        if (pos.user.username?.toLowerCase() === username?.toLowerCase()) {
                            result = pos;
                        }
                    });

                    if (result != null) {
                        logger('getUserId()', 'success');
                        userIdCache.set(username, result);
                        resolve(result);
                    }
                    else {
                        getUserIdWithAgent(username).then((result) => {
                            userIdCache.set(username, result);
                            resolve(result);
                        }).catch((err) => {
                            userIdCache.delete(username);
                            logger('getUserId()', 'fallback reject', err);
							alert("Cannot find user info from getUserId()\nDetails may be in the console.");
                            reject(err);
                        });
                    }
                } catch (err) {
                    userIdCache.delete(username);
                    logger('getUserId()', 'parse reject', err);
                    reject(err);
                }
            },
            onerror: function (err) {
                logger('getUserId()', 'reject', err);
                userIdCache.delete(username);
                reject(err);
            }
        });
    });
}

/**
 * getUserIdWithAgent
 * @description Get user's id with username.
 *
 * @param  {String}  username
 * @return {Integer}
 */
export function getUserIdWithAgent(username) {
    return new Promise((resolve, reject) => {
        const getURL = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;

        GM_xmlhttpRequest({
            method: "GET",
            url: getURL,
            headers: {
                'X-IG-App-ID': getAppID()
            },
            onload: function (response) {
                try {
                    const obj = parseResponse(response);
                    let hasUser = obj?.data?.user;

                    if (hasUser != null) {
                        let userInfo = obj?.data;
                        userInfo.user.pk = userInfo.user.id;
                        logger('getUserIdWithAgent()', 'success');
                        resolve(userInfo);
                    }
                    else {
                        logger('getUserIdWithAgent()', 'reject', 'undefined');
                        reject('undefined');
                    }
                }
                catch (err) {
                    logger('getUserIdWithAgent()', 'reject', err.message);
                    reject(err);
                }
            },
            onerror: function (err) {
                logger('getUserIdWithAgent()', 'reject', err);
                reject(err);
            }
        });
    });
}

/**
 * getUserHighSizeProfile
 * @description Get user's high quality avatar image.
 *
 * @param  {Integer}  userId
 * @return {String}
 */
export function getUserHighSizeProfile(userId) {
    return new Promise((resolve, reject) => {
        const getURL = `https://www.instagram.com/api/v1/users/${userId}/info/`;

        GM_xmlhttpRequest({
            method: "GET",
            url: getURL,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 7 XL)Build/RP1A.20845.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 Chrome/117.0.5938.60 Mobile Safari/537.36 Instagram 307.0.0.34.111'
            },
            onload: function (response) {
                try {
                    const obj = parseResponse(response);
                    if (obj.status !== 'ok') {
                        logger('getUserHighSizeProfile()', 'reject', obj.status);
                        reject('faild');
                    }
                    else {
                        logger('getUserHighSizeProfile()', 'success');
                        resolve(obj.user.hd_profile_pic_url_info?.url);
                    }
                }
                catch (err) {
                    logger('getUserHighSizeProfile()', 'reject', err);
                    reject(err);
                }
            },
            onerror: function (err) {
                logger('getUserHighSizeProfile()', 'reject', err);
                reject(err);
            }
        });
    });
}

/**
 * getPostOwner
 * @description Get post's author with post shortcode.
 *
 * @param  {String}  postPath
 * @return {String}
 */
export function getPostOwner(postPath) {
    return new Promise((resolve, reject) => {
        if (!postPath) {
            reject(new Error("NOPATH"));
            return;
        }
        const postShortCode = postPath;
        const getURL = `https://www.instagram.com/graphql/query/?query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8&variables=%7B%22shortcode%22:%22${postShortCode}%22}`;

        GM_xmlhttpRequest({
            method: "GET",
            url: getURL,
            onload: function (response) {
                try {
                    const obj = parseResponse(response);
                    logger('getPostOwner()', 'success');
                    resolve(obj.data.shortcode_media.owner.username);
                }
                catch (err) {
                    logger('getPostOwner()', 'reject', err.message);
                    reject(err);
                }
            },
            onerror: function (err) {
                logger('getPostOwner()', 'reject', err);
                reject(err);
            }
        });
    });
}

/**
 * getBlobMedia
 * @description Get list of all media files in post with post shortcode.
 *
 * @param  {String}  postPath
 * @return {Object}
 */
export function getBlobMedia(postPath, request = GM_xmlhttpRequest) {
    return new Promise((resolve, reject) => {
        if (!postPath) {
            reject(new Error("NOPATH"));
            return;
        }
        const postShortCode = postPath;
        const getURL = `https://www.instagram.com/graphql/query/?query_hash=2c4c2e343a8f64c625ba02b2aa12c7f8&variables=%7B%22shortcode%22:%22${postShortCode}%22}`;

        request({
            method: "GET",
            url: getURL,
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; Pixel 7 XL)Build/RP1A.20845.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 Chrome/117.0.5938.60 Mobile Safari/537.36 Instagram 307.0.0.34.111"
            },
            onload: function (response) {
                try {
                    const obj = parseResponse(response);
                    logger('getBlobMedia()', 'response received');

                    if (obj.status === 'fail') {
                        // alert(`Request failed with API response:\n${obj.message}: ${obj.feedback_message}`);
                        logger('Request with:', 'getBlobMediaWithQuery()', postShortCode);
                        getBlobMediaWithQueryID(postShortCode, request)
                            .then(res => resolve(toQueryIdBlobMedia(res)))
                            .catch(reject);
                    }
                    else {
                        const legacy = { type: 'query_hash', data: obj.data };
                        if (!legacyCarouselMayBeTruncated(obj.data)) {
                            resolve(legacy);
                            return;
                        }

                        // The legacy sidecar response tops out at the old 10-item carousel
                        // size. Ask the current web-info endpoint before accepting it so
                        // 11-20 item posts do not silently lose their tail.
                        getBlobMediaWithQueryID(postShortCode, request)
                            .then(toQueryIdBlobMedia)
                            .then(modern => resolve(carouselItemCount(modern.data) > carouselItemCount(legacy.data) ? modern : legacy))
                            .catch(err => {
                                logger('getBlobMedia()', 'query_id completeness fallback failed', err);
                                resolve(legacy);
                            });
                    }
                }
                catch (err) {
                    logger('getBlobMedia()', 'reject', err.message);
                    reject(err);
                }
            },
            onerror: function (err) {
                logger('getBlobMedia()', 'reject', err);
                reject(err);
            }
        });
    });
}

function legacyCarouselMayBeTruncated(data) {
    const media = data?.shortcode_media ?? data;
    return media?.__typename === 'GraphSidecar' && carouselItemCount(media) >= 10;
}

function carouselItemCount(data) {
    const media = data?.shortcode_media ?? data;
    return media?.carousel_media?.length ?? media?.edge_sidecar_to_children?.edges?.length ?? 0;
}

function toQueryIdBlobMedia(response) {
    const data = response?.xdt_api__v1__media__shortcode__web_info?.items?.[0];
    if (!data) throw new Error('query_id response did not include media');
    return { type: 'query_id', data };
}

/**
 * getBlobMediaWithQueryID
 * @description Get list of all media files in post with post shortcode.
 *
 * @param  {String}  postPath
 * @return {Object}
 */
export function getBlobMediaWithQueryID(postPath, request = GM_xmlhttpRequest) {
    return new Promise((resolve, reject) => {
        if (!postPath) {
            reject(new Error("NOPATH"));
            return;
        }
        const postShortCode = postPath;
        const getURL = `https://www.instagram.com/graphql/query/?query_id=9496392173716084&variables={%22shortcode%22:%22${postShortCode}%22,%22__relay_internal__pv__PolarisFeedShareMenurelayprovider%22:true,%22__relay_internal__pv__PolarisIsLoggedInrelayprovider%22:true}`;

        request({
            method: "GET",
            url: getURL,
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; Pixel 7 XL)Build/RP1A.20845.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 Chrome/117.0.5938.60 Mobile Safari/537.36 Instagram 307.0.0.34.111",
                'X-IG-App-ID': getAppID()
            },
            onload: function (response) {
                try {
                    const obj = parseResponse(response);
                    logger('getBlobMediaWithQueryID()', 'response received');

                    if (obj.status === 'fail') {
                        alert(`getBlobMediaWithQueryID(): Request failed with API response:\n${obj.message}: ${obj.feedback_message}`);
                        logger('getBlobMediaWithQueryID()', 'API rejected request', obj.message);
                        reject(response);
                    }
                    else {
                        logger('getBlobMediaWithQueryID()', 'success');
                        resolve(obj.data);
                    }
                }
                catch (err) {
                    logger('getBlobMediaWithQueryID()', 'reject', err.message);
                    reject(err);
                }
            },
            onerror: function (err) {
                logger('getBlobMediaWithQueryID()', 'reject', err);
                reject(err);
            }
        });
    });
}

/**
 * getMediaInfo
 * @description Get Instagram Media object.
 *
 * @param  {String}  mediaId
 * @return {Object}
 */
export function getMediaInfo(mediaId) {
    return new Promise((resolve, reject) => {
        const getURL = `https://i.instagram.com/api/v1/media/${mediaId}/info/`;

        if (mediaId == null) {
            alert("Cannot call Media API because of the media id is invalid.");
            logger('getMediaInfo()', 'reject', 'Cannot call Media API because of the media id is invalid.');

            updateLoadingBar(false);
            reject(-1);
            return;
        }
        if (getAppID() == null) {
            alert("Cannot call Media API because of the app id is invalid.");
            logger('getMediaInfo()', 'reject', 'Cannot call Media API because of the app id is invalid.');
            updateLoadingBar(false);
            reject(-1);
            return;
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: getURL,
            headers: {
                "User-Agent": window.navigator.userAgent,
                "Accept": "*/*",
                'X-IG-App-ID': getAppID()
            },
            onload: function (response) {
                if (response.finalUrl == getURL) {
                    const obj = parseResponse(response);
                    logger('getMediaInfo()', 'success');
                    resolve(obj);
                }
                else {
                    let finalURL = new URL(response.finalUrl);
                    if (finalURL.pathname.startsWith('/accounts/login')) {
                        logger('getMediaInfo()', 'reject', 'The account must be logged in to access Media API.');
                        alert("The account must be logged in to access Media API.");
                    }
                    else {
                        logger('getMediaInfo()', 'reject', 'Unable to retrieve content because the API was redirected to "' + response.finalUrl + '"');
                        alert('Unable to retrieve content because the API was redirected to "' + response.finalUrl + '"');
                    }
                    updateLoadingBar(false);
                    reject(-1);
                }
            },
            onerror: function (err) {
                logger('getMediaInfo()', 'reject', err);
                reject(err);
            }
        });
    });
}