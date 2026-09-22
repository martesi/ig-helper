import { render } from 'preact';
import { adoptShadowStyles } from './shadow-styles.js';
import styles from './status.css?inline';

const DOWNLOAD_PROGRESS_ID = 'ig-helper-download-progress';
let downloadProgressTimer;

export function updateLoadingBar(isLoading) {
    const mount = document.querySelector('div[id^="mount"] > div > div > div');
    if (!mount) return;
    mount.classList.toggle('x1s85apg', !isLoading);
    mount.style.zIndex = isLoading ? '20000' : '';
}

export function setDownloadProgress(now, total) {
    let mount = document.getElementById(DOWNLOAD_PROGRESS_ID);
    if (!mount) {
        mount = document.createElement('div');
        mount.id = DOWNLOAD_PROGRESS_ID;
        document.body.append(mount);
    }

    const root = mount.shadowRoot ?? mount.attachShadow({ mode: 'open' });
    adoptShadowStyles(root, styles);
    const complete = now >= total;
    render(<DownloadProgress now={now} total={total} complete={complete} />, root);

    clearTimeout(downloadProgressTimer);
    if (complete) {
        downloadProgressTimer = setTimeout(() => {
            render(null, root);
            mount.remove();
        }, 250);
    }
}

function DownloadProgress({ now, total, complete }) {
    return (
        <div class="IG_DOWNLOAD_PROGRESS" style={{ opacity: complete ? 0 : 1, transition: 'opacity 250ms' }}>
            <span class="IG_DOWNLOAD_SPINNER" />
            <span>{now}/{total}</span>
        </div>
    );
}

export function appendCounter(parent, className) {
    const fragment = document.createDocumentFragment();
    render(<div class={className} />, fragment);
    const element = fragment.firstChild;
    parent.append(element);
    return element;
}

export function appendVolumeSlider(parent, value, customClass = '') {
    const fragment = document.createDocumentFragment();
    render(
        <div class={`volume_slider ${customClass}`.trim()}>
            <div>
                <input type="range" max="1" min="0" step="0.05" value={value}
                    style={{ '--ig-track-progress': `${value * 100}%` }} />
            </div>
        </div>,
        fragment,
    );
    const element = fragment.firstChild;
    parent.append(element);
    return element;
}
