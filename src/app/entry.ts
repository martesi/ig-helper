import { logger } from '../shared/logger';

if (location.hostname.endsWith('instagram.com')) {
    void import('./instagram.ts').then(({ startInstagram }) => startInstagram()).catch(cause => {
        logger('app entry', 'Instagram startup failed', cause);
    });
} else {
    void import('../settings/bridge.ts').then(({ startSettingsBridge }) => startSettingsBridge()).catch(cause => {
        logger('app entry', 'settings bridge startup failed', cause);
    });
}
