import { startInstagram } from './instagram.js';
import { startSettingsBridge } from '../settings/bridge.js';

if (location.hostname.endsWith('instagram.com')) {
    startInstagram();
} else {
    startSettingsBridge();
}
