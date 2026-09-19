import { useEffect, useState } from 'preact/hooks';
import { Button } from '../../shared/ui/components.jsx';
import { requestDebug } from './client.js';
import '../../settings/page/settings.css';
import './debug.css';

const POLL_MS = 1000;

export function DebuggerApp() {
    const [data, setData] = useState({ enabled: false, sessions: [] });
    const [selectedId, setSelectedId] = useState(null);
    const [dom, setDom] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        async function refresh() {
            try {
                const next = await requestDebug('getState');
                if (cancelled) return;
                setData(next);
                setSelectedId(current => next.sessions.some(session => session.tabId === current)
                    ? current
                    : next.sessions[0]?.tabId ?? null);
                setError('');
            } catch (reason) {
                if (!cancelled) setError(reason.message);
            }
        }

        void refresh();
        const timer = setInterval(refresh, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, []);

    const selected = data.sessions.find(session => session.tabId === selectedId) ?? null;

    useEffect(() => {
        setDom(null);
    }, [selectedId]);

    async function toggleEnabled() {
        try {
            await requestDebug('setEnabled', { enabled: !data.enabled });
            const next = await requestDebug('getState');
            setData(next);
            setError('');
        } catch (reason) {
            setError(reason.message);
        }
    }

    async function runCommand(type) {
        if (!selected) return;
        try {
            await requestDebug('command', { tabId: selected.tabId, type });
            setError('');
        } catch (reason) {
            setError(reason.message);
        }
    }

    async function captureDom() {
        if (!selected) return;

        try {
            const before = dom?.capturedAt ?? 0;
            await requestDebug('command', { tabId: selected.tabId, type: 'captureDom' });

            for (let attempt = 0; attempt < 20; attempt += 1) {
                await delay(100);
                const next = await requestDebug('getDom', { tabId: selected.tabId });
                if (next?.capturedAt > before) {
                    setDom(next);
                    setError('');
                    return;
                }
            }
            throw new Error('DOM capture timed out');
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
                        <p>Live diagnostics from every Instagram tab running IG Helper.</p>
                    </div>
                    <Button variant={data.enabled ? 'secondary' : 'default'} onClick={toggleEnabled}>
                        {data.enabled ? 'Disable debugger' : 'Enable debugger'}
                    </Button>
                </header>

                {error && <p class="IG_SETTINGS_STATUS" role="alert">{error}</p>}

                <div class="IG_DEBUGGER_LAYOUT">
                    <aside class="IG_DEBUGGER_SIDEBAR">
                        <div class="IG_DEBUGGER_SIDEBAR_HEADING">
                            <span>Instagram tabs</span>
                            <span>{data.sessions.length}</span>
                        </div>
                        {!data.enabled && <p class="IG_DEBUGGER_EMPTY">Debugger is disabled.</p>}
                        {data.enabled && data.sessions.length === 0 && <p class="IG_DEBUGGER_EMPTY">No active Instagram tabs.</p>}
                        {data.sessions.map(session => (
                            <button key={session.tabId} type="button"
                                class="IG_DEBUGGER_SESSION"
                                aria-current={session.tabId === selectedId ? 'true' : undefined}
                                onClick={() => setSelectedId(session.tabId)}>
                                <strong>{session.page.path || '/'}</strong>
                                <span>{shortId(session.tabId)} · {session.page.visibility}</span>
                            </button>
                        ))}
                    </aside>

                    <section class="IG_DEBUGGER_CONTENT">
                        {!selected && (
                            <div class="IG_DEBUGGER_PLACEHOLDER">
                                <h3>Select an Instagram tab</h3>
                                <p>Enable the debugger and keep at least one Instagram tab open.</p>
                            </div>
                        )}

                        {selected && (
                            <>
                                <section class="IG_DEBUGGER_TITLE">
                                    <div>
                                        <h3>{selected.page.path || '/'}</h3>
                                        <p>{selected.page.url}</p>
                                    </div>
                                    <div class="IG_DEBUGGER_ACTIONS">
                                        <Button onClick={() => runCommand('refresh')}>Refresh</Button>
                                        <Button onClick={() => runCommand('clearLogs')}>Clear logs</Button>
                                        <Button onClick={captureDom}>Capture DOM</Button>
                                        <Button variant="destructive" onClick={() => runCommand('reload')}>Reload tab</Button>
                                    </div>
                                </section>

                                <section class="IG_DEBUGGER_GRID">
                                    <Metric label="Script" value={`${selected.script.name} v${selected.script.version}`} />
                                    <Metric label="Updated" value={formatAge(selected.updatedAt)} />
                                    <Metric label="Visibility" value={selected.page.visibility} />
                                    <Metric label="Logs" value={selected.runtime.loggerEntries} />
                                    <Metric label="Download targets" value={selected.dom.downloadTargets} />
                                    <Metric label="Control bars" value={selected.dom.controlBars} />
                                    <Metric label="Videos / images" value={`${selected.dom.videos} / ${selected.dom.images}`} />
                                    <Metric label="Media cache" value={selected.cache.media} />
                                </section>

                                <DebugSection title="Runtime">
                                    <pre>{JSON.stringify(selected.runtime, null, 2)}</pre>
                                </DebugSection>

                                <DebugSection title={`Errors (${selected.errors.length})`}>
                                    <pre>{selected.errors.length ? formatEntries(selected.errors) : 'No captured errors.'}</pre>
                                </DebugSection>

                                <DebugSection title={`Logs (latest ${selected.logs.length})`}>
                                    <div class="IG_DEBUGGER_SECTION_ACTIONS">
                                        <Button size="sm" onClick={() => copyText(formatEntries(selected.logs))}>Copy</Button>
                                        <Button size="sm" onClick={() => downloadText('ig-helper-debug.json', JSON.stringify(selected, null, 2))}>Export</Button>
                                    </div>
                                    <pre>{selected.logs.length ? formatEntries(selected.logs) : 'No log entries.'}</pre>
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

function shortId(value) {
    return value.slice(0, 8);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
