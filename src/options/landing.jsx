import { h, render } from 'preact';
import './landing.css';

function Landing() {
    return (
        <main>
            <section>
                <p class="eyebrow">IG Helper</p>
                <h1>Instagram Download Helper</h1>
                <p>Download photos and videos from posts, Reels, Stories, highlights, and profiles.</p>
                <div class="actions">
                    <a class="primary" href="./settings/">Settings</a>
                    <a href="https://github.com/martesi/ig-helper">GitHub</a>
                </div>
            </section>
        </main>
    );
}

render(<Landing />, document.getElementById('app'));
