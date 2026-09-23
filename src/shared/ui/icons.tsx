
import type { ComponentChildren, JSX } from 'preact';

function Icon({ children, ...props }: JSX.SVGAttributes<SVGSVGElement> & { children?: ComponentChildren }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {...props}>
            {children}
        </svg>
    );
}

export function XIcon(props: JSX.SVGAttributes<SVGSVGElement>) {
    return <Icon {...props}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Icon>;
}

export function CopyIcon(props: JSX.SVGAttributes<SVGSVGElement>) {
    return <Icon {...props}><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></Icon>;
}

export function Trash2Icon(props: JSX.SVGAttributes<SVGSVGElement>) {
    return <Icon {...props}><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M10 11v6" /><path d="M14 11v6" /></Icon>;
}

export function DownloadIcon(props: JSX.SVGAttributes<SVGSVGElement>) {
    return <Icon {...props}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></Icon>;
}

export function RotateCcwIcon(props: JSX.SVGAttributes<SVGSVGElement>) {
    return <Icon {...props}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></Icon>;
}

export function RotateCwIcon(props: JSX.SVGAttributes<SVGSVGElement>) {
    return <Icon {...props}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></Icon>;
}

export function SlidersHorizontalIcon(props: JSX.SVGAttributes<SVGSVGElement>) {
    return <Icon {...props}><path d="M10 5H3" /><path d="M12 19H3" /><path d="M14 3v4" /><path d="M16 17v4" /><path d="M21 12h-9" /><path d="M21 19h-5" /><path d="M21 5h-7" /><path d="M8 10v4" /><path d="M8 12H3" /></Icon>;
}

export function KeyboardIcon(props: JSX.SVGAttributes<SVGSVGElement>) {
    return <Icon {...props}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" /></Icon>;
}
