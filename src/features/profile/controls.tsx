import { render } from 'preact';
import { _i18n } from '../../shared/i18n';
import { IconButton } from '../../shared/ui/components.tsx';
import { DownloadIcon } from '../../shared/ui/icons.tsx';
import { adoptShadowStyles } from '../../shared/ui/shadow-styles.ts';
import styles from './controls.css?inline';

export function mountProfileControl(parent: Element, onDownload: () => unknown) {
    let host = Array.from(parent.children).find(element => element.classList?.contains('IG_PROFILE_CONTROL'));
    if (!host) {
        host = document.createElement('span');
        host.className = 'IG_PROFILE_CONTROL';
        parent.append(host);
    }

    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    adoptShadowStyles(root, styles);
    render(<ProfileControl onDownload={onDownload} />, root);
    return host;
}

function ProfileControl({ onDownload }: { onDownload: () => unknown }) {
    return <IconButton class="IG_PROFILE_DOWNLOAD" icon={DownloadIcon} label={_i18n('DW')} onClick={event => {
        event.stopPropagation();
        onDownload();
    }} />;
}
