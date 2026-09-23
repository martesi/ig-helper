import { render } from 'preact';
import { SVG } from '../../settings/state';
import { _i18n } from '../../shared/i18n';
import { Button } from '../../shared/ui/components.tsx';
import { adoptShadowStyles } from '../../shared/ui/shadow-styles.ts';
import styles from './controls.css?inline';

interface ReelActions {
    download: () => unknown;
    newTab?: (() => unknown) | null;
    thumbnail: () => unknown;
}

export function mountReelControls(parent: HTMLElement, before: Node | null, actions: ReelActions) {
    const host = document.createElement('div');
    host.className = 'IG_REEL_CONTROLS';
    parent.insertBefore(host, before);
    const shadow = host.attachShadow({ mode: 'open' });
    adoptShadowStyles(shadow, styles);
    render(
        <>
            <ReelControl className="IG_REELS" labelKey="DW" icon={SVG.DOWNLOAD} onClick={actions.download} />
            {actions.newTab && <ReelControl className="IG_REELS_NEWTAB" labelKey="NEW_TAB" icon={SVG.NEW_TAB} onClick={actions.newTab} />}
            <ReelControl className="IG_REELS_THUMBNAIL" labelKey="VIDEO_THUMBNAIL" icon={SVG.THUMBNAIL} onClick={actions.thumbnail} />
        </>,
        shadow,
    );
    return host;
}

function ReelControl({ className, labelKey, icon, onClick }: {
    className: string; labelKey: string; icon: string; onClick?: () => unknown;
}) {
    const label = _i18n(labelKey);
    return (
        <Button class={className} variant="ghost" size="icon-sm"
            data-ih-locale-title={labelKey} title={label} aria-label={label}
            dangerouslySetInnerHTML={{ __html: icon }} onClick={onClick} />
    );
}
