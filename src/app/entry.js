if (location.hostname.endsWith('instagram.com')) {
    void import('./instagram.js');
} else {
    void import('../features/settings/bridge.js');
}
