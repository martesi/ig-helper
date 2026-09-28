import { render } from 'preact';
import { adoptShadowStyles } from './shadow-styles.ts';
import styles from './status.css?inline';

const DOWNLOAD_PROGRESS_ID = 'ig-helper-download-progress';
const FEEDBACK_ROOT_ID = 'ig-helper-feedback';
let downloadProgressTimer: ReturnType<typeof setTimeout> | undefined;
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

export type FeedbackCategory = 'success' | 'info' | 'warning' | 'error';

export function updateLoadingBar(isLoading: boolean) {
    const mount = document.querySelector<HTMLElement>('div[id^="mount"] > div > div > div');
    if (!mount) return;
    mount.classList.toggle('x1s85apg', !isLoading);
    mount.style.zIndex = isLoading ? '20000' : '';
}

export function setDownloadProgress(now: number, total: number) {
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

export function showToast(message: string, category: FeedbackCategory = 'error', duration?: number) {
    let mount = document.getElementById(FEEDBACK_ROOT_ID);
    if (!mount) {
        mount = document.createElement('div');
        mount.id = FEEDBACK_ROOT_ID;
        document.body.append(mount);
    }

    const root = mount.shadowRoot ?? mount.attachShadow({ mode: 'open' });
    adoptShadowStyles(root, styles);
    render(<FeedbackToast message={message} category={category} />, root);

    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
        render(null, root);
        mount?.remove();
    }, duration ?? (category === 'error' ? 5000 : 3000));
}

function DownloadProgress({ now, total, complete }: { now: number; total: number; complete: boolean }) {
    return (
        <div class="IG_DOWNLOAD_PROGRESS" style={{ opacity: complete ? 0 : 1, transition: 'opacity 250ms' }}>
            <span class="IG_DOWNLOAD_SPINNER" />
            <span>{now}/{total}</span>
        </div>
    );
}

function FeedbackToast({ message, category }: { message: string; category: FeedbackCategory }) {
    const mark = category === 'success' ? '\u2713' : category === 'info' ? 'i' : '!';
    return (
        <div class="toaster IG_FEEDBACK_TOASTER" data-align="center">
            <div class="toast" data-category={category} role={category === 'error' ? 'alert' : 'status'} aria-atomic="true">
                <div class="toast-content">
                    <span class="IG_FEEDBACK_MARK" aria-hidden="true">{mark}</span>
                    <section><p>{message}</p></section>
                </div>
            </div>
        </div>
    );
}

export function appendCounter(parent: Node, className: string): HTMLElement {
    const fragment = document.createDocumentFragment();
    render(<div class={className} />, fragment);
    const element = fragment.firstChild;
    if (!(element instanceof HTMLElement)) throw new Error('Could not create download counter');
    parent.appendChild(element);
    return element;
}
