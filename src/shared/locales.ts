import localeManifest from '../../locale/manifest.json';

const localeModules = import.meta.glob<Record<string, string>>('../../locale/translations/*.json', {
    eager: true,
    import: 'default',
});

export { localeManifest };

export const translations: Record<string, Record<string, string>> = Object.fromEntries(
    Object.entries(localeModules).map(([path, locale]) => {
        const name = path.match(/([^/]+)\.json$/)?.[1];
        if (!name) throw new Error(`Invalid locale path: ${path}`);
        return [name, locale];
    }),
);
