import { render } from 'preact';
import { SVG } from '../../settings/state';
import { _i18n } from '../../shared/i18n';
import { Button } from '../../shared/ui/components.jsx';
import { adoptShadowStyles } from '../../shared/ui/shadow-styles.js';
import styles from './controls.css?inline';

export function mountReelControls(parent, actions) {
    const host = document.createElement('div');
    host.className = 'IG_REEL_CONTROLS';
    parent.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    adoptShadowStyles(shadow, styles);
    render(
        <>
            <ReelControl className="IG_REELS" labelKey="DW" icon={SVG.DOWNLOAD} onClick={actions.download} />
            <ReelControl className="IG_REELS_NEWTAB" labelKey="NEW_TAB" icon={SVG.NEW_TAB} onClick={actions.newTab} />
            <ReelControl className="IG_REELS_THUMBNAIL" labelKey="VIDEO_THUMBNAIL" icon={SVG.THUMBNAIL} onClick={actions.thumbnail} />
        </>,
        shadow,
    );
    return host;
}

function ReelControl({ className, labelKey, icon, onClick }) {
    const label = _i18n(labelKey);
    return (
        <Button class={className} variant="ghost" size="icon-sm"
            data-ih-locale-title={labelKey} title={label} aria-label={label}
            dangerouslySetInnerHTML={{ __html: icon }} onClick={onClick} />
    );
}
