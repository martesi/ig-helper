import { render } from 'preact';
import { Link, Route, Router, Switch } from 'wouter-preact';
import { useHashLocation } from 'wouter-preact/use-hash-location';
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
                    <Link class="primary" href="/settings/preferences">Settings</Link>
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
                <Route component={Landing} />
            </Switch>
        </Router>
    );
}

render(<App />, document.getElementById('app'));
