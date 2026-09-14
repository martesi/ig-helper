import { Fragment, h, render } from 'preact';
import { SVG } from '../settings';
import { _i18n } from '../utils/i18n';
import { Button } from './components.jsx';

export function mountPostControls(mount, { showDownloadAll = false, mediaType = 'image' } = {}) {
    render(<PostControls showDownloadAll={showDownloadAll} mediaType={mediaType} />, mount);
}


function PostControls({ showDownloadAll, mediaType }) {
    return (
        <>
            {mediaType === 'video' ? (
                <ControlButton class="IG_THUMBNAIL_MAIN" labelKey="VIDEO_THUMBNAIL" icon={SVG.THUMBNAIL} />
            ) : (
                <ControlButton class="IG_IMAGE_VIEWER" labelKey="IMAGE_VIEWER" icon={SVG.FULLSCREEN} />
            )}
            <ControlButton class="IG_NEWTAB_MAIN" labelKey="NEW_TAB" icon={SVG.NEW_TAB} />
            {showDownloadAll && <ControlButton class="IG_DW_ALL_MAIN" labelKey="DW_ALL" icon={SVG.DOWNLOAD_ALL} />}
            <ControlButton class="IG_DW_MAIN" labelKey="DW" icon={SVG.DOWNLOAD} />
        </>
    );
}

function ControlButton({ class: className, labelKey, icon }) {
    const label = _i18n(labelKey);
    return (
        <Button class={`IG_POST_CONTROL ${className}`} variant="ghost" size="icon-sm"
            data-ih-locale-title={labelKey} title={label} aria-label={label}
            dangerouslySetInnerHTML={{ __html: icon }} />
    );
}
