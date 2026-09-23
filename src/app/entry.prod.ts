import { startInstagram } from './instagram.ts';
import { startSettingsBridge } from '../settings/bridge.ts';

if (location.hostname.endsWith('instagram.com')) {
    startInstagram();
} else {
    startSettingsBridge();
}
