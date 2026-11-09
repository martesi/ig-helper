import { Effect } from 'effect';

export interface DashRepresentation {
    id: string;
    url: string;
    mimeType: string;
    contentType: string;
    codecs: string;
    bandwidth: number;
    width: number;
    height: number;
}

export function parseDashManifest(mpdXml: string): { video: DashRepresentation | null; audio: DashRepresentation | null } {
    const parsed = Effect.try({
        try: () => {
            if (!mpdXml || typeof mpdXml !== 'string' || typeof DOMParser === 'undefined') return { video: null, audio: null };

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
        onFailure: () => ({ video: null, audio: null }),
        onSuccess: result => result instanceof Error ? ({ video: null, audio: null }) : result,
    }));
}
