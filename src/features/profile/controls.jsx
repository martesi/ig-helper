import { render } from 'preact';
import { _i18n } from '../../shared/i18n';
import { IconButton } from '../../shared/ui/components.jsx';
import { DownloadIcon } from '../../shared/ui/icons.jsx';
import { adoptShadowStyles } from '../../shared/ui/shadow-styles.js';
import styles from './controls.css?inline';

export function mountProfileControl(parent, onDownload) {
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

function ProfileControl({ onDownload }) {
    return <IconButton class="IG_PROFILE_DOWNLOAD" icon={DownloadIcon} label={_i18n('DW')} onClick={event => {
        event.stopPropagation();
        onDownload();
    }} />;
}
