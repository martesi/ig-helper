import { state } from '../settings/state';

export function logger(...messages) {
    const now = new Date();
    state.GL_logger.push({
        time: now.getTime(),
        content: messages,
    });

    if (state.GL_logger.length > 1000) {
        state.GL_logger = [{
            time: now.getTime(),
            content: ['logger sliced'],
        }, ...state.GL_logger.slice(-999)];
    }

    console.log(`[${now.toISOString()}]`, ...messages);
}
