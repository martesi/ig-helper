import localeManifest from '../../locale/manifest.json';

const localeModules = import.meta.glob('../../locale/translations/*.json', {
    eager: true,
    import: 'default',
});

export { localeManifest };

export const translations = Object.fromEntries(
    Object.entries(localeModules).map(([path, locale]) => [path.match(/([^/]+)\.json$/)[1], locale]),
);
