import $ from 'jquery';
import { Effect } from 'effect';
import { state } from '../../settings/state';
import { getBlobMedia } from '../../shared/api';
import { triggerLinkElement } from '../../shared/media-download';
import { setDownloadProgress } from '../../shared/ui/status.tsx';
import { appendLoadingMessage, appendMediaResource } from '../../shared/ui/media-resource.tsx';
import { logger } from '../../shared/logger';
import { _i18n } from '../../shared/i18n';
import type { LegacyMedia, LegacyMediaRoot, ModernMedia } from '../../shared/instagram-data';

/**
 * filterResourceData
 * @description Standardized resource object format.
 *
 * @param  {Object}  data
 * @return {Object}
 */
export function filterResourceData(data: LegacyMediaRoot): LegacyMedia;
export function filterResourceData(data: ModernMedia): ModernMedia;
export function filterResourceData(data: LegacyMediaRoot | ModernMedia): LegacyMedia | ModernMedia;
export function filterResourceData(data: LegacyMediaRoot | ModernMedia): LegacyMedia | ModernMedia {
    return 'shortcode_media' in data ? data.shortcode_media : data;
}

function appendLegacyMediaResources(root: HTMLElement, resource: LegacyMedia) {
    let index = 1;
    if (resource.__typename === 'GraphVideo' && resource.video_url) {
        appendMediaResource(root, { mediaId: resource.id, datetime: resource.taken_at_timestamp, blob: true, path: resource.shortcode, name: 'video', type: 'mp4', username: resource.owner.username, index, href: resource.video_url, preview: resource.display_resources[1].src, labelKey: 'VID', label: _i18n('VID') });
        if (resource.video_dash_manifest) state.GL_mediaDataCache[resource.id] = resource;
        index++;
    }
    if (resource.__typename === 'GraphImage') {
        appendMediaResource(root, { mediaId: resource.id, datetime: resource.taken_at_timestamp, blob: true, path: resource.shortcode, name: 'photo', type: 'jpg', username: resource.owner.username, index, href: resource.display_resources[resource.display_resources.length - 1].src, preview: resource.display_resources[1].src, labelKey: 'IMG', label: _i18n('IMG') });
        index++;
    }
    if (resource.__typename === 'GraphSidecar') appendLegacySidecarResources(root, resource, index);
}

function appendLegacySidecarResources(root: HTMLElement, resource: LegacyMedia, startIndex: number) {
    if (resource.__typename !== 'GraphSidecar' || !resource.edge_sidecar_to_children) return;
    let index = startIndex;
    for (const edge of resource.edge_sidecar_to_children.edges) {
        const media = edge.node;
        if (media.__typename === 'GraphVideo' && media.video_url) {
            appendMediaResource(root, { mediaId: media.id, datetime: resource.taken_at_timestamp, blob: true, path: resource.shortcode, name: 'video', type: 'mp4', username: resource.owner.username, index, href: media.video_url, preview: media.display_resources[1].src, labelKey: 'VID', label: _i18n('VID') });
            if (media.video_dash_manifest) state.GL_mediaDataCache[media.id] = media;
        }
        if (media.__typename === 'GraphImage') {
            appendMediaResource(root, { mediaId: media.id, datetime: resource.taken_at_timestamp, blob: true, path: resource.shortcode, name: 'photo', type: 'jpg', username: resource.owner.username, index, href: media.display_resources[media.display_resources.length - 1].src, preview: media.display_resources[1].src, labelKey: 'IMG', label: _i18n('IMG') });
        }
        index++;
    }
}

function appendModernMediaResources(root: HTMLElement, resource: ModernMedia) {
    if (resource.carousel_media) {
        logger('carousel_media');
        resource.carousel_media.forEach((media, position) => {
            const index = position + 1;
            if (media.video_versions == null) {
                media.image_versions2.candidates.sort(compareImageCandidates);
                appendMediaResource(root, { mediaId: media.pk, datetime: media.taken_at, blob: true, path: resource.code, name: 'photo', type: 'jpg', username: resource.owner.username, index, href: media.image_versions2.candidates[0].url, preview: media.image_versions2.candidates[0].url, labelKey: 'IMG', label: _i18n('IMG') });
                return;
            }

            appendMediaResource(root, { mediaId: media.pk, datetime: media.taken_at, blob: true, path: resource.code, name: 'video', type: 'mp4', username: resource.owner.username, index, href: media.video_versions[0].url, preview: media.image_versions2.candidates[0].url, labelKey: 'VID', label: _i18n('VID') });
            if (media.video_dash_manifest) state.GL_mediaDataCache[media.pk] = media;
        });
        return;
    }

    if (resource.video_versions == null) {
        resource.image_versions2.candidates.sort(compareImageCandidates);
        appendMediaResource(root, { mediaId: resource.pk, datetime: resource.taken_at, blob: true, path: resource.code, name: 'photo', type: 'jpg', username: resource.owner.username, index: 1, href: resource.image_versions2.candidates[0].url, preview: resource.image_versions2.candidates[0].url, labelKey: 'IMG', label: _i18n('IMG') });
        return;
    }

    if (resource.video_dash_manifest) state.GL_mediaDataCache[resource.pk] = resource;
    appendMediaResource(root, { mediaId: resource.pk, datetime: resource.taken_at, blob: true, path: resource.code, name: 'video', type: 'mp4', username: resource.owner.username, index: 1, href: resource.video_versions[0].url, preview: resource.image_versions2.candidates[0].url, labelKey: 'VID', label: _i18n('VID') });
}

function compareImageCandidates(a: { url: string; width?: number }, b: { url: string; width?: number }) {
    const aSTP = new URL(a.url).searchParams.get('stp');
    const bSTP = new URL(b.url).searchParams.get('stp');
    if (aSTP && bSTP) return aSTP.length - bSTP.length;
    return (b.width ?? 0) - (a.width ?? 0);
}


/**
 * createMediaListDOM
 * @description Create a list of media elements from post URLs.
 *
 * @param  {String}  postURL
 * @param  {Element|JQuery}  root - Popup body where resources are rendered.
 * @param  {String}  message - i18n display loading message
 * @return {Promise<number>}  The number of <a> elements inserted into the DOM
 */
export async function createMediaListDOM(postURL: string, root: HTMLElement, message: string): Promise<number> {
    const $target = $(root);
    $target.find('a').remove();
    appendLoadingMessage($target[0], message);
    return getBlobMedia(postURL).then(result => {
        if (result.type === 'query_hash') appendLegacyMediaResources($target[0], filterResourceData(result.data));
        else appendModernMediaResources($target[0], filterResourceData(result.data));
        return $target.find('a').length;
    }).finally(() => {
        $target.find('#_SNLOAD').remove();
    });
}


/**
 * batchDownloadPostFiles
 * @description Batch download media files in posts to prevent browser crashes.
 * @param {jQuery} $elements
 * @return {Promise<void>}
 */
export async function batchDownloadPostFiles($elements: Array<Element | JQuery<Element>>): Promise<void> {
    let index = 0;
    const totalLen = $elements.length;
    setDownloadProgress(0, totalLen);

    for (const element of $elements) {
        await triggerLinkElement($(element), false).catch(err => {
            logger('batchDownloadPostFiles()', 'failed', err);
        });

        index++;
        setDownloadProgress(index, totalLen);
        if (index < totalLen) await Effect.runPromise(Effect.sleep('1 second'));
    }
}
