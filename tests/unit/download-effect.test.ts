import { expect, test } from 'bun:test';
import { Effect, Fiber } from 'effect';
import { managerDownload } from '../../src/shared/download-effect.ts';

test('reports a manager download failure', async () => {
    const download = (details: Tampermonkey.DownloadRequest) => {
        queueMicrotask(() => details.onerror?.({ error: 'not_permitted' } as Tampermonkey.DownloadErrorResponse));
        return { abort: () => false };
    };
    const exit = await Effect.runPromiseExit(managerDownload('/media', 'image.jpg', download));
    expect(exit._tag).toBe('Failure');
});

test('aborts an interrupted manager download', async () => {
    let aborts = 0;
    const download = () => ({ abort() { aborts += 1; return true; } });
    const fiber = Effect.runFork(managerDownload('/media', 'image.jpg', download));
    await Effect.runPromise(Fiber.interrupt(fiber));
    expect(aborts).toBe(1);
});
