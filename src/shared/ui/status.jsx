import { render } from 'preact';
import { _i18n } from '../i18n';

const DOWNLOAD_STATUS_ID = 'ig-helper-download-status';
let downloadStatusTimer;

export function updateLoadingBar(isLoading) {
    const mount = document.querySelector('div[id^="mount"] > div > div > div');
    if (!mount) return;
    mount.classList.toggle('x1s85apg', !isLoading);
    mount.style.zIndex = isLoading ? '20000' : '';
}

export function showDownloadStatus(status) {
    let mount = document.getElementById(DOWNLOAD_STATUS_ID);
    if (!mount) {
        mount = document.createElement('div');
        mount.id = DOWNLOAD_STATUS_ID;
        mount.className = 'IG_DOWNLOAD_STATUS';
        mount.setAttribute('role', 'status');
        mount.setAttribute('aria-live', 'polite');
        document.body.append(mount);
    }

    const key = {
        started: 'DOWNLOAD_STARTED',
        complete: 'DOWNLOAD_COMPLETE',
        failed: 'DOWNLOAD_FAILED',
    }[status];
    if (!key) return;

    mount.dataset.status = status;
    mount.textContent = _i18n(key);
    mount.hidden = false;

    clearTimeout(downloadStatusTimer);
    if (status !== 'started') {
        downloadStatusTimer = setTimeout(() => {
            mount.hidden = true;
        }, 2200);
    }
}

export function appendCounter(parent, className) {
    const fragment = document.createDocumentFragment();
    render(<div class={className} />, fragment);
    const element = fragment.firstChild;
    parent.append(element);
    return element;
}

export function appendDownloadProgress(parent, now, total) {
    const fragment = document.createDocumentFragment();
    render(
        <div class="circle_wrapper">
            <circle />
            <span>{now}/{total}</span>
        </div>,
        fragment,
    );
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
