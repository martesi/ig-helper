import { useEffect, useState } from 'preact/hooks';
import { Link } from 'wouter-preact';
import { Button, IconButton } from '../../shared/ui/components.jsx';
import { RotateCwIcon } from '../../shared/ui/icons.jsx';
import { requestDebug } from './client.js';
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
                if (cancelled) return;
                setData(null);
                setError(reason.message);
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
            if (type === 'clearLogs' || type === 'getSnapshot') {
                setData(result);
            }
            setError('');
        } catch (reason) {
            setData(null);
            setError(reason.message);
        }
    }

    async function captureDom() {
        try {
            setDom(await requestDebug('captureDom'));
            setError('');
        } catch (reason) {
            setData(null);
            setError(reason.message);
        }
    }

    return (
        <>
            <section class="IG_DEBUGGER_CONTENT">
                {!data && !error && <div class="IG_DEBUGGER_PLACEHOLDER"><p>Connecting to Instagram…</p></div>}
                {!data && error && (
                    <div class="empty">
                        <header>
                            <h3>Debugger unavailable</h3>
                            <p>IG Helper could not connect to the userscript.</p>
                        </header>
                        <footer>
                            <Link class="btn" data-variant="secondary" href="/settings">Go to Settings</Link>
                        </footer>
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
                                <Button size="sm" variant="ghost" onClick={() => runCommand('clearLogs')}>Clear logs</Button>
                                {dom ? (
                                    <div class="button-group">
                                        <Button size="sm" variant="outline" onClick={() => copyText(dom.html ?? '')}>Copy</Button>
                                        <Button size="sm" variant="outline"
                                            onClick={() => downloadText(`DOMTree-${Date.now()}.txt`, dom.html ?? '')}>Download</Button>
                                        <IconButton icon={RotateCwIcon} label="Capture DOM again" variant="outline"
                                            onClick={captureDom} />
                                    </div>
                                ) : (
                                    <Button size="sm" variant="primary" onClick={captureDom}>Capture DOM</Button>
                                )}
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
                                <Button size="sm" variant="ghost" onClick={() => copyText(formatEntries(data.logs))}>Copy</Button>
                                <Button size="sm" variant="ghost" onClick={() => downloadText('ig-helper-debug.json', JSON.stringify(data, null, 2))}>Export</Button>
                            </div>
                            <pre class="IG_DEBUGGER_SCROLL">{data.logs.length ? formatEntries(data.logs) : 'No log entries.'}</pre>
                        </DebugSection>
                    </>
                )}
            </section>
        </>
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
