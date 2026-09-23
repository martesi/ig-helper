import { Data, Effect } from 'effect';

export class DownloadError extends Data.TaggedError('DownloadError')<{
    readonly operation: 'fetch' | 'save';
    readonly message: string;
    readonly cause?: unknown;
}> {}

type ManagerDownload = (details: Tampermonkey.DownloadRequest) => Tampermonkey.AbortHandle<boolean>;

export function fetchMedia(url: string) {
    return Effect.tryPromise({
        try: async signal => {
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.blob();
        },
        catch: cause => new DownloadError({ operation: 'fetch', message: 'Could not fetch media.', cause }),
    });
}

export function managerDownload(url: string, name: string, download: ManagerDownload = GM_download) {
    return Effect.callback<void, DownloadError>(resume => {
        const handle = Effect.runSync(Effect.match(Effect.try({
            try: () => download({
                url,
                name,
                onload: () => resume(Effect.void),
                onerror: cause => resume(Effect.fail(new DownloadError({
                    operation: 'save', message: 'The userscript manager could not save this file.', cause,
                }))),
                ontimeout: () => resume(Effect.fail(new DownloadError({
                    operation: 'save', message: 'The download timed out.',
                }))),
            }),
            catch: cause => new DownloadError({
                operation: 'save', message: 'The userscript manager could not start the download.', cause,
            }),
        }), {
            onFailure: error => {
                resume(Effect.fail(error));
                return undefined;
            },
            onSuccess: handle => handle,
        }));
        if (!handle) return;
        return Effect.sync(() => { handle.abort(); });
    });
}
