import { Link } from 'wouter-preact';

export function ControlNav({ active }) {
    return (
        <nav class="IG_CONTROL_NAV" aria-label="IG Helper">
            <Link class="btn IG_CONTROL_NAV_LINK" data-variant={active === 'settings' ? 'secondary' : 'ghost'}
                aria-current={active === 'settings' ? 'page' : undefined} href="/settings">
                Settings
            </Link>
            <Link class="btn IG_CONTROL_NAV_LINK" data-variant={active === 'debug' ? 'secondary' : 'ghost'}
                aria-current={active === 'debug' ? 'page' : undefined} href="/debug">
                Debugger
            </Link>
        </nav>
    );
}
