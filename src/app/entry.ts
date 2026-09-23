if (location.hostname.endsWith('instagram.com')) {
    void import('./instagram.ts').then(({ startInstagram }) => startInstagram());
} else {
    void import('../settings/bridge.ts').then(({ startSettingsBridge }) => startSettingsBridge());
}
