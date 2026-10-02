export function selectImageURL(image: Pick<HTMLImageElement, 'srcset' | 'currentSrc' | 'src'>): string | null {
    const candidates = image.srcset.split(',').map(candidate => {
        const [url, descriptor] = candidate.trim().split(/\s+/);
        return { url, size: Number.parseFloat(descriptor || '0') };
    }).filter(candidate => candidate.url && /^https?:\/\//.test(candidate.url));
    candidates.sort((a, b) => b.size - a.size);
    const url = candidates[0]?.url || image.currentSrc || image.src;
    return /^https?:\/\//.test(url) ? url : null;
}
