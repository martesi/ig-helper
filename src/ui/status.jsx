import { h, render } from 'preact';

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
        <div class="circle_wrapper ig-helper-ui">
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
