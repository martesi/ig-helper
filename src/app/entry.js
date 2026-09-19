if (location.hostname.endsWith('instagram.com')) {
    void import('./instagram.js').then(({ startInstagram }) => startInstagram());
} else {
    void import('../settings/bridge.js').then(({ startSettingsBridge }) => startSettingsBridge());
}
