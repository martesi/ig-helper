import { render } from 'preact';
import { Link, Route, Router, Switch } from 'wouter-preact';
import { useHashLocation } from 'wouter-preact/use-hash-location';
import { DebuggerApp } from '../../debug/page/debug.jsx';
import { OptionsApp } from './settings.jsx';
import './landing.css';

function Landing() {
    return (
        <main>
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

function App() {
    return (
        <Router hook={useHashLocation}>
            <Switch>
                <Route path="/" component={Landing} />
                <Route path="/settings/:tab?" component={OptionsApp} />
                <Route path="/debug" component={DebuggerApp} />
                <Route component={Landing} />
            </Switch>
        </Router>
    );
}

render(<App />, document.getElementById('app'));
