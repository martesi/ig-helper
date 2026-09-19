if (location.hostname.endsWith('instagram.com')) {
    void import('./instagram.js');
} else {
    void import('../settings/bridge.js');
}
