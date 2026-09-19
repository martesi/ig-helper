import { useEffect, useState } from 'preact/hooks';
import { Button } from '../../shared/ui/components.jsx';
import { ControlNav } from '../../settings/page/control-nav.jsx';
import { requestDebug } from './client.js';
import '../../settings/page/settings.css';
import './debug.css';

const REFRESH_MS = 1000;

export function DebuggerApp() {
    const [data, setData] = useState(null);
    const [dom, setDom] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        async function refresh() {
            try {
                const snapshot = await requestDebug('getSnapshot');
                if (cancelled) return;
                setData(snapshot);
                setError('');
            } catch (reason) {
                if (!cancelled) setError(reason.message);
            }
        }

        void refresh();
        const timer = setInterval(refresh, REFRESH_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, []);

    async function runCommand(type) {
        try {
            const result = await requestDebug(type);
            if (type === 'clearLogs' || type === 'getSnapshot') setData(result);
            setError('');
        } catch (reason) {
            setError(reason.message);
        }
    }

    async function captureDom() {
        try {
            setDom(await requestDebug('captureDom'));
            setError('');
        } catch (reason) {
            setError(reason.message);
        }
    }

    return (
        <main class="IG_SETTINGS_DIALOG IG_DEBUGGER_PAGE ig-helper-ui">
            <div class="IG_SETTINGS_PANEL">
                <header class="IG_SETTINGS_HEADER IG_DEBUGGER_HEADER">
                    <div>
                        <h2>Debugger</h2>
                        <p>Live diagnostics for the Instagram tab that opened this window.</p>
                    </div>
                    <ControlNav active="debug" />
                </header>

                {error && <p class="IG_SETTINGS_STATUS" role="alert">{error}</p>}

                <section class="IG_DEBUGGER_CONTENT">
                    {!data && !error && <div class="IG_DEBUGGER_PLACEHOLDER"><p>Connecting to Instagram…</p></div>}
                    {!data && error && (
                        <div class="IG_DEBUGGER_PLACEHOLDER">
                            <h3>Debugger not attached</h3>
                            <p>{error}</p>
                        </div>
                    )}

                    {data && (
                        <>
                            <section class="IG_DEBUGGER_TITLE">
                                <div>
                                    <h3>{data.page.path || '/'}</h3>
                                    <p>{data.page.url}</p>
                                </div>
                                <div class="IG_DEBUGGER_ACTIONS">
                                    <Button onClick={() => runCommand('getSnapshot')}>Refresh</Button>
                                    <Button onClick={() => runCommand('clearLogs')}>Clear logs</Button>
                                    <Button onClick={captureDom}>Capture DOM</Button>
                                    <Button variant="destructive" onClick={() => runCommand('reload')}>Reload tab</Button>
                                </div>
                            </section>

                            <section class="IG_DEBUGGER_GRID">
                                <Metric label="Script" value={`${data.script.name} v${data.script.version}`} />
                                <Metric label="Updated" value={formatAge(data.updatedAt)} />
                                <Metric label="Visibility" value={data.page.visibility} />
                                <Metric label="Logs" value={data.runtime.loggerEntries} />
                                <Metric label="Download targets" value={data.dom.downloadTargets} />
                                <Metric label="Control bars" value={data.dom.controlBars} />
                                <Metric label="Videos / images" value={`${data.dom.videos} / ${data.dom.images}`} />
                                <Metric label="Media cache" value={data.cache.media} />
                            </section>

                            <DebugSection title="Runtime">
                                <pre>{JSON.stringify(data.runtime, null, 2)}</pre>
                            </DebugSection>

                            <DebugSection title={`Errors (${data.errors.length})`}>
                                <pre>{data.errors.length ? formatEntries(data.errors) : 'No captured errors.'}</pre>
                            </DebugSection>

                            <DebugSection title={`Logs (latest ${data.logs.length})`}>
                                <div class="IG_DEBUGGER_SECTION_ACTIONS">
                                    <Button size="sm" onClick={() => copyText(formatEntries(data.logs))}>Copy</Button>
                                    <Button size="sm" onClick={() => downloadText('ig-helper-debug.json', JSON.stringify(data, null, 2))}>Export</Button>
                                </div>
                                <pre>{data.logs.length ? formatEntries(data.logs) : 'No log entries.'}</pre>
                            </DebugSection>

                            <DebugSection title="DOM snapshot">
                                <div class="IG_DEBUGGER_SECTION_ACTIONS">
                                    <Button size="sm" disabled={!dom} onClick={() => copyText(dom?.html ?? '')}>Copy</Button>
                                    <Button size="sm" disabled={!dom} onClick={() => downloadText(`DOMTree-${Date.now()}.txt`, dom?.html ?? '')}>Download</Button>
                                </div>
                                <pre>{dom ? dom.html || '(mount is empty)' : 'Capture DOM on demand.'}</pre>
                            </DebugSection>
                        </>
                    )}
                </section>
            </div>
        </main>
    );
}

function Metric({ label, value }) {
    return (
        <div class="IG_DEBUGGER_METRIC">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function DebugSection({ title, children }) {
    return (
        <section class="IG_DEBUGGER_SECTION">
            <header><h4>{title}</h4></header>
            {children}
        </section>
    );
}

function formatEntries(entries) {
    return entries.map(entry => `[${new Date(entry.time).toISOString()}] ${entry.message ?? JSON.stringify(entry.content)}${entry.stack ? `\n${entry.stack}` : ''}`).join('\n');
}

function formatAge(timestamp) {
    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    return seconds < 2 ? 'now' : `${seconds}s ago`;
}

async function copyText(text) {
    await navigator.clipboard.writeText(text);
}

function downloadText(name, text) {
    const href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    link.click();
    URL.revokeObjectURL(href);
}
