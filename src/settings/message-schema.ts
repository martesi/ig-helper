import * as z from 'zod/mini';

const methods = ['getState', 'setSetting', 'setLanguage', 'setVideoVolume', 'setRenameFormat', 'setHotkey'] as const;
export type SettingsMethod = typeof methods[number];

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
    method: z.enum(methods),
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

export type SettingsSnapshot = z.infer<typeof resultSchemas.getState>;

export function parseSettingsRequest(value: unknown) {
    const envelope = z.parse(requestEnvelopeSchema, value);
    switch (envelope.method) {
        case 'getState':
            return { ...envelope, method: envelope.method, payload: z.parse(payloadSchemas.getState, envelope.payload) };
        case 'setSetting':
            return { ...envelope, method: envelope.method, payload: z.parse(payloadSchemas.setSetting, envelope.payload) };
        case 'setLanguage':
            return { ...envelope, method: envelope.method, payload: z.parse(payloadSchemas.setLanguage, envelope.payload) };
        case 'setVideoVolume':
            return { ...envelope, method: envelope.method, payload: z.parse(payloadSchemas.setVideoVolume, envelope.payload) };
        case 'setRenameFormat':
            return { ...envelope, method: envelope.method, payload: z.parse(payloadSchemas.setRenameFormat, envelope.payload) };
        case 'setHotkey':
            return { ...envelope, method: envelope.method, payload: z.parse(payloadSchemas.setHotkey, envelope.payload) };
    }
}

export type SettingsRequest = ReturnType<typeof parseSettingsRequest>;

export function parseSettingsResponse(method: SettingsMethod, value: unknown) {
    const envelope = z.parse(responseEnvelopeSchema, value);
    if (!envelope.ok) return envelope;
    return {
        ...envelope,
        result: z.parse(resultSchemas[method], envelope.result),
    };
}
