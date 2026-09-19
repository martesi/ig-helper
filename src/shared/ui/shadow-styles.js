import baseStyles from './shadow.css?inline';

const PROPERTY_RULE = /@property\s+--[\w-]+\s*\{[^{}]*\}/g;
const sheets = new Map();
const installedProperties = new Set();

export function adoptShadowStyles(shadow, ...styles) {
    shadow.adoptedStyleSheets = [baseStyles, ...styles].map(getStyleSheet);
}

function getStyleSheet(styles) {
    const isolatedStyles = styles.replaceAll('--tw-', '--ih-tw-');
    let sheet = sheets.get(isolatedStyles);
    if (sheet) return sheet;

    installProperties(isolatedStyles);
    sheet = new CSSStyleSheet();
    sheet.replaceSync(isolatedStyles.replace(PROPERTY_RULE, ''));
    sheets.set(isolatedStyles, sheet);
    return sheet;
}

function installProperties(styles) {
    const rules = (styles.match(PROPERTY_RULE) ?? []).filter(rule => !installedProperties.has(rule));
    if (rules.length === 0) return;

    const style = document.createElement('style');
    style.textContent = rules.join('\n');
    document.head.append(style);
    rules.forEach(rule => installedProperties.add(rule));
}
