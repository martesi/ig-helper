const isOptionsPage = (
    (location.origin === 'http://127.0.0.1:9100' || location.origin === 'http://localhost:9100') &&
    location.pathname === '/settings/'
) || (
    location.origin === 'https://martesi.github.io' &&
    location.pathname === '/ig-helper/settings/'
);

if (isOptionsPage) void import('./options/bridge.js');
else void import('./instagram.js');
