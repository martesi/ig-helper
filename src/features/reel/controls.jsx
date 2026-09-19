import { render } from 'preact';
import { SVG } from '../../settings/state';
import { _i18n } from '../../shared/i18n';
import { Button } from '../../shared/ui/components.jsx';

export function mountReelControls(parent) {
    const host = document.createElement('div');
    host.className = 'IG_REEL_CONTROLS';
    parent.append(host);
    render(
        <div class="ig-helper-ui">
            <ReelControl className="IG_REELS" labelKey="DW" icon={SVG.DOWNLOAD} />
            <ReelControl className="IG_REELS_NEWTAB" labelKey="NEW_TAB" icon={SVG.NEW_TAB} />
            <ReelControl className="IG_REELS_THUMBNAIL" labelKey="VIDEO_THUMBNAIL" icon={SVG.THUMBNAIL} />
        </div>,
        host,
    );
    return host;
}

function ReelControl({ className, labelKey, icon }) {
    const label = _i18n(labelKey);
    return (
        <Button class={className} variant="ghost" size="icon-sm"
            data-ih-locale-title={labelKey} title={label} aria-label={label}
            dangerouslySetInnerHTML={{ __html: icon }} />
    );
}
