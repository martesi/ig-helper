import { useEffect, useState } from 'preact/hooks';
import { Link } from 'wouter-preact';
import { hasDebugOpener, requestDebug } from '../../debug/page/client.ts';

export function ControlNav({ active }: { active: 'debug' | 'settings' }) {
    const [debugAvailable, setDebugAvailable] = useState(false);

    useEffect(() => {
        if (!hasDebugOpener()) return;

        let cancelled = false;
        requestDebug('getSnapshot').then(
            () => !cancelled && setDebugAvailable(true),
            () => {},
        );
        return () => { cancelled = true; };
    }, []);

    return (
        <nav class="IG_CONTROL_NAV" aria-label="IG Helper">
            {debugAvailable && (
                <Link class="btn IG_CONTROL_NAV_LINK" data-variant={active === 'debug' ? 'secondary' : 'ghost'}
                    aria-current={active === 'debug' ? 'page' : undefined} href="/debug">
                    Debugger
                </Link>
            )}
            <Link class="btn IG_CONTROL_NAV_LINK" data-variant={active === 'settings' ? 'secondary' : 'ghost'}
                aria-current={active === 'settings' ? 'page' : undefined} href="/settings">
                Settings
            </Link>
        </nav>
    );
}
