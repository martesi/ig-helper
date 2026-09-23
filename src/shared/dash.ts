import * as Mediabunny from 'mediabunny';
import { USER_SETTING } from "../settings/state";
import { logger } from "./logger";
import { createSaveFileElement, saveFiles } from "./download";
import { openNewTab } from "./navigation";
import { updateLoadingBar } from "./ui/status.tsx";
import { Effect } from 'effect';

function fetchArrayBuffer(url: string): Effect.Effect<ArrayBuffer, Error> {
    return Effect.tryPromise({
        try: async signal => {
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.arrayBuffer();
        },
        catch: cause => cause instanceof Error ? cause : new Error('Could not fetch DASH media.', { cause }),
    });
}

/**
 * parseDashManifest
 * @description Parse Media API video_dash_manifest (MPD XML).
 *              Returns best video/audio representation URLs.
 *
 * @param  {string} mpdXml
 * @return {{ video: DashRepresentation | null, audio: DashRepresentation | null }}
 */
interface DashRepresentation {
    id: string;
    url: string;
    mimeType: string;
    contentType: string;
    codecs: string;
    bandwidth: number;
    width: number;
    height: number;
}

function parseDashManifest(mpdXml: string): { video: DashRepresentation | null; audio: DashRepresentation | null } {
    const parsed = Effect.try({
        try: () => {
            if (!mpdXml || typeof mpdXml !== 'string') return { video: null, audio: null };

            const xml = new DOMParser().parseFromString(mpdXml, 'application/xml');
            if (xml.querySelector('parsererror')) return { video: null, audio: null };

            const reps = Array.from(xml.querySelectorAll('Representation'));
            const candidates = reps.map(rep => {
                const base = rep.querySelector('BaseURL')?.textContent?.trim();
                if (!base) return null;

                const set = rep.closest('AdaptationSet');
                const mimeType = rep.getAttribute('mimeType') || set?.getAttribute('mimeType') || '';
                const contentType = set?.getAttribute('contentType') || '';
                const codecs = rep.getAttribute('codecs') || set?.getAttribute('codecs') || '';
                const bandwidth = parseInt(rep.getAttribute('bandwidth') || '0', 10) || 0;
                const width = parseInt(rep.getAttribute('width') || '0', 10) || 0;
                const height = parseInt(rep.getAttribute('height') || '0', 10) || 0;
                const id = rep.getAttribute('id') || '';

                return { id, url: base, mimeType, contentType, codecs, bandwidth, width, height };
            }).filter((candidate): candidate is DashRepresentation => candidate !== null);

            const isVideo = (candidate: DashRepresentation) => candidate.contentType.includes('video') || candidate.mimeType.startsWith('video');
            const isAudio = (candidate: DashRepresentation) => candidate.contentType.includes('audio') || candidate.mimeType.startsWith('audio');
            const bestVideo = candidates.filter(isVideo)
                .sort((a, b) => (b.height - a.height) || (b.bandwidth - a.bandwidth) || (b.width - a.width))[0] ?? null;
            const bestAudio = candidates.filter(isAudio).sort((a, b) => b.bandwidth - a.bandwidth)[0] ?? null;
            return { video: bestVideo, audio: bestAudio };
        },
        catch: error => error,
    });
    return Effect.runSync(Effect.match(parsed, {
        onFailure: error => {
            logger('[DASH]', 'parseDashManifest() error:', error);
            return { video: null, audio: null };
        },
        onSuccess: result => result,
    }));
}

/**
 * muxDashVideoAudioToMp4
 * @description Mux DASH video+audio into one MP4 using Mediabunny (demux + mux).
 *
 * @param {ArrayBuffer} videoBuf
 * @param {ArrayBuffer} audioBuf
 * @return {Effect<ArrayBuffer, Error>}
 */
function muxDashVideoAudioToMp4(videoBuf: ArrayBuffer, audioBuf: ArrayBuffer): Effect.Effect<ArrayBuffer, Error> {
    return Effect.tryPromise({
        try: async () => {
            const MB = Mediabunny;

            const videoInput = new MB.Input({
                formats: [MB.MP4],
                source: new MB.BufferSource(videoBuf),
            });
            const audioInput = new MB.Input({
                formats: [MB.MP4],
                source: new MB.BufferSource(audioBuf),
            });

            const vTrack = await videoInput.getPrimaryVideoTrack();
            if (!vTrack || !vTrack.codec) throw new Error('No video track found');

            const aTrack = await audioInput.getPrimaryAudioTrack();
            if (!aTrack || !aTrack.codec) throw new Error('No audio track found');

            const vSink = new MB.EncodedPacketSink(vTrack);
            const aSink = new MB.EncodedPacketSink(aTrack);

            const output = new MB.Output({
                format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }),
                target: new MB.BufferTarget(),
            });

            const vSource = new MB.EncodedVideoPacketSource(vTrack.codec);
            const aSource = new MB.EncodedAudioPacketSource(aTrack.codec);

            output.addVideoTrack(vSource, { rotation: vTrack.rotation || 0 });
            output.addAudioTrack(aSource);

            await output.start();

            const vDecoderConfig = await vTrack.getDecoderConfig();
            const aDecoderConfig = await aTrack.getDecoderConfig();

            const vMeta = vDecoderConfig ? { decoderConfig: vDecoderConfig } : undefined;
            const aMeta = aDecoderConfig ? { decoderConfig: aDecoderConfig } : undefined;

            const vIter = vSink.packets();
            const aIter = aSink.packets();

            let vNext = await vIter.next();
            let aNext = await aIter.next();
            let vSentMeta = false;
            let aSentMeta = false;

            while (!vNext.done || !aNext.done) {
                const takeVideo = (() => {
                    if (vNext.done) return false;
                    if (aNext.done) return true;
                    return vNext.value.timestamp <= aNext.value.timestamp;
                })();

                if (takeVideo && !vNext.done) {
                    await vSource.add(vNext.value, vSentMeta ? undefined : vMeta);
                    vSentMeta = true;
                    vNext = await vIter.next();
                } else if (!aNext.done) {
                    await aSource.add(aNext.value, aSentMeta ? undefined : aMeta);
                    aSentMeta = true;
                    aNext = await aIter.next();
                }
            }

            await output.finalize();

            const outBuf = output.target.buffer;
            if (outBuf instanceof ArrayBuffer) return outBuf;
            throw new Error('Unexpected output buffer type');
        },
        catch: cause => cause instanceof Error ? cause : new Error('Could not mux DASH media.', { cause }),
    });
}

function downloadDashStreams(videoUrl: string, audioUrl: string | null, username: string, sourceType: string, timestamp: number, shortcode: string | null): Effect.Effect<boolean, Error> {
    logger('[DASH]', 'downloadDashStreams()', {
        videoUrl: videoUrl,
        audioUrl: audioUrl || null,
        sourceType,
        shortcode
    });

    if (!audioUrl) {
        logger('[DASH]', 'Downloaded DASH video only (no audio rep / has_audio=false).');
        return Effect.tryPromise({
            try: () => saveFiles(videoUrl, { username, sourceType, timestamp, filetype: 'mp4', shortcode }),
            catch: cause => cause instanceof Error ? cause : new Error('Could not save DASH video.', { cause }),
        }).pipe(Effect.as(true));
    }

    const fallback = Effect.gen(function* () {
        yield* Effect.tryPromise({
            try: () => saveFiles(videoUrl, { username, sourceType, timestamp, filetype: 'mp4', shortcode }),
            catch: cause => cause instanceof Error ? cause : new Error('Could not save DASH video.', { cause }),
        });
        yield* Effect.tryPromise({
            try: () => saveFiles(audioUrl, { username, sourceType, timestamp, filetype: 'm4a', shortcode }),
            catch: cause => cause instanceof Error ? cause : new Error('Could not save DASH audio.', { cause }),
        });
        return true;
    });

    const merge = Effect.gen(function* () {
        logger('[DASH]', 'Fetching DASH streams for mux...');
        yield* Effect.sync(() => updateLoadingBar(true));
        const [vBuf, aBuf] = yield* Effect.all([
            fetchArrayBuffer(videoUrl),
            fetchArrayBuffer(audioUrl),
        ], { concurrency: 'unbounded' }).pipe(
            Effect.ensuring(Effect.sync(() => updateLoadingBar(false))),
        );

        logger('[DASH]', 'Muxing DASH video+audio into one MP4 (mp4box main thread)...');
        const mergedBuf = yield* muxDashVideoAudioToMp4(vBuf, aBuf);
        const mergedBlob = new Blob([mergedBuf], { type: 'video/mp4' });

        yield* Effect.tryPromise({
            try: () => createSaveFileElement(videoUrl, mergedBlob, { username, sourceType, timestamp, filetype: 'mp4', shortcode }),
            catch: cause => cause instanceof Error ? cause : new Error('Could not save merged DASH media.', { cause }),
        });
        logger('[DASH]', 'Merged MP4 download triggered.');
        return true;
    });

    return merge.pipe(Effect.catchCause(cause => {
        logger('[DASH]', 'Mux failed -> fallback to separate downloads', cause);
        return fallback;
    }));
}

/**
 * tryHandleDashFromMediaItem
 * @description Centralized DASH handling for Media API items.
 *              Uses video_dash_manifest when present.
 *              Picks best video by resolution (height/width), then bandwidth.
 *              Audio is optional.
 *
 * @return {Promise<boolean>} true if DASH path handled it, false to let caller fallback.
 */
export function tryHandleDashFromMediaItem({
    mediaItem,
    username,
    sourceType,
    timestamp,
    shortcode,
    isPreview,
    index
}: {
    mediaItem: { video_dash_manifest?: string | null; video_versions?: ReadonlyArray<{ url: string }> | null };
    username?: string;
    sourceType: string;
    timestamp: number;
    shortcode?: string | null;
    isPreview?: boolean;
    index?: number;
}): Promise<boolean> {
    const program = Effect.gen(function* () {
        if (!USER_SETTING.PREFER_DASH_MANIFEST) return false;
        if (!USER_SETTING.FORCE_RESOURCE_VIA_MEDIA) return false;
        if (!mediaItem?.video_dash_manifest) return false;
        if (!mediaItem?.video_versions) return false;

        const best = parseDashManifest(mediaItem.video_dash_manifest);
        const vUrl = best?.video?.url || '';
        const aUrl = best?.audio?.url || '';

        if (!vUrl) {
            return false;
        }

        logger('[DASH]', 'best reps selected', {
            video: best.video ? { height: best.video.height, width: best.video.width, bandwidth: best.video.bandwidth, codecs: best.video.codecs } : null,
            audio: best.audio ? { bandwidth: best.audio.bandwidth, codecs: best.audio.codecs } : '(none)'
        });

        if (isPreview) {
            openNewTab(vUrl);
            return true;
        }

        if (!aUrl) {
            logger('[DASH]', 'download mode -> VIDEO-ONLY DASH (no audio rep)');
            yield* Effect.tryPromise({
                try: () => saveFiles(vUrl, {
                    username,
                    sourceType,
                    timestamp,
                    filetype: 'mp4',
                    shortcode,
                    index,
                }),
                catch: cause => cause instanceof Error ? cause : new Error('Could not save DASH video.', { cause }),
            });
            return true;
        }

        logger('[DASH]', 'download mode -> DASH video+audio');
        yield* downloadDashStreams(vUrl, aUrl, username ?? '', sourceType, timestamp, shortcode ?? null);
        return true;
    }).pipe(Effect.catchCause(cause => Effect.sync(() => {
        logger('[DASH]', 'tryHandleDashFromMediaItem failed -> fallback', cause);
        return false;
    })));
    return Effect.runPromise(program);
}
