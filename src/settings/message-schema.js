import * as z from 'zod/mini';

const payloadSchemas = {
    getState: z.union([z.undefined(), z.null()]),
    setSetting: z.object({ name: z.string(), value: z.unknown() }),
    setLanguage: z.object({ value: z.string() }),
    setVideoVolume: z.object({ value: z.union([z.string(), z.number()]) }),
    setRenameFormat: z.object({ value: z.string() }),
    setHotkey: z.object({ stateKey: z.string(), value: z.union([z.string(), z.number()]) }),
};

const requestEnvelopeSchema = z.object({
    channel: z.literal('ig-helper:settings'),
    direction: z.literal('request'),
    id: z.int(),
    method: z.enum(Object.keys(payloadSchemas)),
    payload: z.optional(z.unknown()),
});

const responseEnvelopeSchema = z.object({
    channel: z.literal('ig-helper:settings'),
    direction: z.literal('response'),
    id: z.int(),
    ok: z.boolean(),
    result: z.optional(z.unknown()),
    error: z.optional(z.string()),
});

const resultSchemas = {
    getState: z.object({
        settings: z.record(z.string(), z.unknown()),
        language: z.string(),
        videoVolume: z.number(),
        renameFormat: z.string(),
        hotkeys: z.record(z.string(), z.number()),
        version: z.string(),
    }),
    setSetting: z.unknown(),
    setLanguage: z.string(),
    setVideoVolume: z.number(),
    setRenameFormat: z.string(),
    setHotkey: z.number(),
};

export function parseSettingsRequest(value) {
    const envelope = z.parse(requestEnvelopeSchema, value);
    return {
        ...envelope,
        payload: z.parse(payloadSchemas[envelope.method], envelope.payload),
    };
}

export function parseSettingsResponse(method, value) {
    const envelope = z.parse(responseEnvelopeSchema, value);
    if (!envelope.ok) return envelope;
    return {
        ...envelope,
        result: z.parse(resultSchemas[method], envelope.result),
    };
}
