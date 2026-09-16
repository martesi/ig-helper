const isOptionsPage = (
    (location.origin === 'http://127.0.0.1:9100' || location.origin === 'http://localhost:9100') &&
    location.pathname === '/'
) || (
    location.origin === 'https://martesi.github.io' &&
    location.pathname === '/ig-helper/'
);

if (isOptionsPage) void import('./features/settings/bridge.js');
else void import('./app/instagram.js');
