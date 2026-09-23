import * as z from 'zod/mini';

export const DEBUG_CHANNEL = 'ig-helper:debug';
export const DEBUG_COMMANDS = new Set(['getSnapshot', 'clearLogs', 'captureDom'] as const);
export type DebugMethod = 'getSnapshot' | 'clearLogs' | 'captureDom';

const snapshotSchema = z.object({
    startedAt: z.number(),
    updatedAt: z.number(),
    page: z.object({ url: z.string(), path: z.string(), visibility: z.string() }),
    script: z.object({ name: z.string(), version: z.string() }),
    runtime: z.object({
        firstStarted: z.boolean(),
        pageLoaded: z.boolean(),
        currentPath: z.union([z.string(), z.null()]),
        referrerPath: z.union([z.string(), z.null()]),
        repeatTimerActive: z.boolean(),
        loggerEntries: z.number(),
    }),
    dom: z.object({
        mounts: z.number(), downloadTargets: z.number(), controlBars: z.number(),
        videos: z.number(), images: z.number(),
    }),
    cache: z.object({ stories: z.number(), highlights: z.number(), media: z.number(), images: z.number() }),
    settings: z.record(z.string(), z.union([z.boolean(), z.string()])),
    logs: z.array(z.object({ time: z.number(), content: z.unknown() })),
    errors: z.array(z.object({ time: z.number(), message: z.string(), stack: z.string() })),
});

const domSchema = z.object({ capturedAt: z.number(), url: z.string(), html: z.string() });
const envelopeSchema = z.object({
    channel: z.literal(DEBUG_CHANNEL),
    direction: z.literal('response'),
    id: z.int(),
    ok: z.boolean(),
    result: z.optional(z.unknown()),
    error: z.optional(z.string()),
});

export type DebugSnapshot = z.infer<typeof snapshotSchema>;
export type DomCapture = z.infer<typeof domSchema>;
export class DebugRequestError extends Error {}

export function parseDebugResponse(method: 'getSnapshot' | 'clearLogs', value: unknown): DebugSnapshot;
export function parseDebugResponse(method: 'captureDom', value: unknown): DomCapture;
export function parseDebugResponse(method: DebugMethod, value: unknown): DebugSnapshot | DomCapture;
export function parseDebugResponse(method: DebugMethod, value: unknown): DebugSnapshot | DomCapture {
    const envelope = z.parse(envelopeSchema, value);
    if (!envelope.ok) throw new DebugRequestError(envelope.error || 'IG Helper debugger request failed');
    return method === 'captureDom'
        ? z.parse(domSchema, envelope.result)
        : z.parse(snapshotSchema, envelope.result);
}

export const CONTROL_ORIGIN = import.meta.env.DEV
    ? 'http://127.0.0.1:9000'
    : 'https://martesi.github.io';
