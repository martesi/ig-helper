export function getInstagramImageScale(url: string): number {
    if (!URL.canParse(url)) return 0;
    const stp = new URL(url).searchParams.get('stp') || '';
    const match = stp.match(/_[sp](\d+)x(\d+)(?:_|$)/);
    return match ? Math.max(Number(match[1]), Number(match[2])) : Infinity;
}

export function preferHigherResolutionImage(first: string | null, second: string | null): string | null {
    if (!first) return second;
    if (!second) return first;
    return getInstagramImageScale(second) > getInstagramImageScale(first) ? second : first;
}

export function selectMediaApiImageURL(candidates: readonly { url: string; width?: number; height?: number }[]): string | null {
    const ranked = [...candidates].sort((a, b) =>
        (b.width ?? 0) - (a.width ?? 0) ||
        (b.height ?? 0) - (a.height ?? 0) ||
        getInstagramImageScale(b.url) - getInstagramImageScale(a.url),
    );
    return ranked[0]?.url ?? null;
}
