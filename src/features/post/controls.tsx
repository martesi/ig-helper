import { render } from 'preact';
import type { JSX } from 'preact';
import { SVG, USER_SETTING } from '../../settings/state';
import { _i18n } from '../../shared/i18n';
import { Button } from '../../shared/ui/components.tsx';
import { CopyIcon } from '../../shared/ui/icons.tsx';
import { adoptShadowStyles } from '../../shared/ui/shadow-styles.ts';
import styles from './controls.css?inline';

interface MediaControlOptions {
    showDownloadAll?: boolean;
    showMediaPreview?: boolean;
    showOpenInNewTab?: boolean;
    showCopy?: boolean;
    mediaType?: 'image' | 'video';
    actions?: {
        thumbnail?: () => unknown; view?: () => unknown; newTab?: () => unknown;
        copy?: () => unknown; downloadAll?: () => unknown; download?: () => unknown;
    };
}

export function mountPostControls(mount: HTMLElement, options: MediaControlOptions = {}) {
    mountMediaControls(mount, options);
}

export function mountMediaControls(mount: HTMLElement, {
    showDownloadAll = false,
    showMediaPreview = USER_SETTING.SHOW_MEDIA_PREVIEW,
    showOpenInNewTab = USER_SETTING.SHOW_OPEN_IN_NEW_TAB_BUTTON,
    showCopy = true,
    mediaType = 'image',
    actions = {},
}: MediaControlOptions = {}) {
    const root = mount.shadowRoot ?? mount.attachShadow({ mode: 'open' });
    adoptShadowStyles(root, styles);
    render(<MediaControls
        showDownloadAll={showDownloadAll}
        showMediaPreview={showMediaPreview}
        showOpenInNewTab={showOpenInNewTab}
        showCopy={showCopy}
        mediaType={mediaType}
        actions={actions}
    />, root);
}


function MediaControls({ showDownloadAll, showMediaPreview, showOpenInNewTab, showCopy, mediaType, actions }: Required<MediaControlOptions>) {
    return (
        <>
            {mediaType === 'video' ? (
                <ControlButton class="IG_THUMBNAIL_MAIN" labelKey="VIDEO_THUMBNAIL" icon={SVG.THUMBNAIL} onClick={actions.thumbnail} />
            ) : showMediaPreview ? (
                <ControlButton class="IG_IMAGE_VIEWER" labelKey="IMAGE_VIEWER" icon={SVG.FULLSCREEN} onClick={actions.view} />
            ) : null}
            {showOpenInNewTab && (
                <ControlButton class="IG_NEWTAB_MAIN" labelKey="NEW_TAB" icon={SVG.NEW_TAB} onClick={actions.newTab} />
            )}
            {showCopy && <CopyControlButton onClick={actions.copy} />}
            {showDownloadAll && <ControlButton class="IG_DW_ALL_MAIN" labelKey="DW_ALL" icon={SVG.DOWNLOAD_ALL} onClick={actions.downloadAll} />}
            <ControlButton class="IG_DW_MAIN" labelKey="DW" icon={SVG.DOWNLOAD} onClick={actions.download} />
        </>
    );
}

function CopyControlButton(props: JSX.IntrinsicElements['button']) {
    const label = _i18n('COPY_MEDIA');
    return (
        <Button class="IG_POST_CONTROL IG_COPY_MAIN" variant="ghost" size="icon-sm"
            data-ih-locale-title="COPY_MEDIA" title={label} aria-label={label} {...props}>
            <CopyIcon />
        </Button>
    );
}

function ControlButton({ class: className, labelKey, icon, ...props }: JSX.IntrinsicElements['button'] & {
    labelKey: string; icon: string;
}) {
    const label = _i18n(labelKey);
    return (
        <Button class={`IG_POST_CONTROL ${className}`} variant="ghost" size="icon-sm"
            data-ih-locale-title={labelKey} title={label} aria-label={label}
            dangerouslySetInnerHTML={{ __html: icon }} {...props} />
    );
}
