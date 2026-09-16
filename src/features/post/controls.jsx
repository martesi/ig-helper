import { render } from 'preact';
import { SVG } from '../../settings/state';
import { _i18n } from '../../shared/i18n';
import { Button } from '../../shared/ui/components.jsx';

export function mountPostControls(mount, { showDownloadAll = false, mediaType = 'image', actions = {} } = {}) {
    render(<PostControls showDownloadAll={showDownloadAll} mediaType={mediaType} actions={actions} />, mount);
}


function PostControls({ showDownloadAll, mediaType, actions }) {
    return (
        <>
            {mediaType === 'video' ? (
                <ControlButton class="IG_THUMBNAIL_MAIN" labelKey="VIDEO_THUMBNAIL" icon={SVG.THUMBNAIL} onClick={actions.thumbnail} />
            ) : (
                <ControlButton class="IG_IMAGE_VIEWER" labelKey="IMAGE_VIEWER" icon={SVG.FULLSCREEN} onClick={actions.view} />
            )}
            <ControlButton class="IG_NEWTAB_MAIN" labelKey="NEW_TAB" icon={SVG.NEW_TAB} onClick={actions.newTab} />
            {showDownloadAll && <ControlButton class="IG_DW_ALL_MAIN" labelKey="DW_ALL" icon={SVG.DOWNLOAD_ALL} onClick={actions.downloadAll} />}
            <ControlButton class="IG_DW_MAIN" labelKey="DW" icon={SVG.DOWNLOAD} onClick={actions.download} />
        </>
    );
}

function ControlButton({ class: className, labelKey, icon, ...props }) {
    const label = _i18n(labelKey);
    return (
        <Button class={`IG_POST_CONTROL ${className}`} variant="ghost" size="icon-sm"
            data-ih-locale-title={labelKey} title={label} aria-label={label}
            dangerouslySetInnerHTML={{ __html: icon }} {...props} />
    );
}
