import { render } from 'preact';
import { useState } from 'preact/hooks';
import { Link, Route, Router, Switch, useLocation } from 'wouter-preact';
import { useHashLocation } from 'wouter-preact/use-hash-location';
import { DebuggerApp } from '../../debug/page/debug.jsx';
import { ControlNav } from './control-nav.jsx';
import { OptionsApp } from './settings.jsx';
import './settings.css';
import './landing.css';

const SETTINGS_HEADER = {
    title: 'Settings',
    description: 'Control downloads, media behavior, and keyboard shortcuts.',
};
const DEBUG_HEADER = {
    title: 'Debugger',
    description: 'Live diagnostics for the Instagram tab that opened this window.',
};

function Landing() {
    return (
        <main class="IG_LANDING">
            <section>
                <p class="eyebrow">IG Helper</p>
                <h1>Instagram Download Helper</h1>
                <p>Download photos and videos from posts, Reels, Stories, highlights, and profiles.</p>
                <div class="actions">
                    <Link class="primary" href="/settings">Settings</Link>
                    <Link href="/debug">Debugger</Link>
                    <a href="https://github.com/martesi/ig-helper">GitHub</a>
                </div>
            </section>
        </main>
    );
}

function ControlApp() {
    const [location] = useLocation();
    const isDebug = location === '/debug';
    const [settingsHeader, setSettingsHeader] = useState(SETTINGS_HEADER);
    const header = isDebug ? DEBUG_HEADER : settingsHeader;
    const active = isDebug ? 'debug' : 'settings';

    return (
        <main class="IG_SETTINGS_DIALOG ig-helper-ui">
            <div class="IG_SETTINGS_PANEL">
                <header class="IG_SETTINGS_HEADER">
                    <div>
                        <h2>{header.title}</h2>
                        <p>{header.description}</p>
                    </div>
                    <div class="IG_SETTINGS_HEADER_ACTIONS">
                        <ControlNav active={active} />
                    </div>
                </header>

                <div class="IG_CONTROL_BODY">
                    <Switch>
                        <Route path="/settings/:tab?">
                            <OptionsApp onHeaderChange={setSettingsHeader} />
                        </Route>
                        <Route path="/debug" component={DebuggerApp} />
                    </Switch>
                </div>
            </div>
        </main>
    );
}

function App() {
    return (
        <Router hook={useHashLocation}>
            <RoutedApp />
        </Router>
    );
}

function RoutedApp() {
    const [location] = useLocation();
    const isControlRoute = location === '/debug' || location === '/settings' || location.startsWith('/settings/');
    return isControlRoute ? <ControlApp /> : <Landing />;
}

render(<App />, document.getElementById('app'));
