// Run on the Vite dev-server page with:
// bun run test:agent -- eval 'async () => await (await import("/tests/agent/permalink-download.js")).checkPermalinkDownload()'
export async function checkPermalinkDownload() {
    const downloads = [];
    const gm = globalThis.__viteUserscriptGM__ ?? globalThis;
    gm.GM_getValue ??= (_key, fallback) => fallback;
    gm.GM_setValue ??= () => {};
    gm.GM_download = details => {
        downloads.push({ url: details.url, name: details.name });
        queueMicrotask(() => details.onload());
        return { abort() {} };
    };
    gm.GM_xmlhttpRequest = details => {
        queueMicrotask(() => details.onload({
            status: 200,
            finalUrl: details.url,
            response: JSON.stringify({ data: { shortcode_media: {
                __typename: 'GraphSidecar',
                id: '10',
                shortcode: 'DeufEDZEWW7',
                owner: { username: 'fixture', id: '42' },
                taken_at_timestamp: 1700000000,
                display_resources: [],
                edge_sidecar_to_children: { edges: [1, 2, 3, 4, 5].map(index => ({
                    node: {
                        __typename: index === 4 ? 'GraphVideo' : 'GraphImage',
                        id: String(index),
                        ...(index === 4 ? { video_url: `https://cdn.test/video-${index}.mp4` } : {}),
                        display_resources: [
                            { src: `https://cdn.test/preview-${index}.jpg` },
                            { src: `https://cdn.test/image-${index}.jpg` },
                        ],
                    },
                })) },
            } } }),
        }));
        return { abort() {} };
    };
    const $ = (await import('jquery')).default;
    const { USER_SETTING, state, DIRECT_DOWNLOAD_MODE_OPTIONS } = await import('/src/settings/state.ts');
    const { createDownloadButton, getVisibleNodeIndex } = await import('/src/features/post/post.ts');
    Object.assign(USER_SETTING, {
        DIRECT_DOWNLOAD_MODE: DIRECT_DOWNLOAD_MODE_OPTIONS.VISIBLE,
        FORCE_RESOURCE_VIA_MEDIA: false,
        USE_EXTERNAL_DOWNLOAD_MODE: true,
        MODIFY_RESOURCE_EXIF: false,
        AUTO_RENAME: true,
    });
    state.fileRenameFormat = '%SHORTCODE%-%INDEX%';

    // Sanitized DOM from the reported public post, not a reconstructed layout.
    const fixture = await fetch('http://127.0.0.1:9000/tests/fixtures/DeufEDZEWW7.html').then(response => response.text());
    const section = document.createElement('div');
    section.innerHTML = fixture;
    section.style.cssText = 'display:block;width:900px;height:800px;';
    const viewport = section.querySelector('[role="presentation"]');
    const list = viewport?.querySelector('ul[class]');
    if (!viewport || !list) throw new Error('Captured Instagram carousel is missing');
    viewport.style.cssText = 'width:300px;height:300px;overflow:hidden;position:relative';
    list.style.cssText = 'position:relative;width:300px;height:300px;margin:0;padding:0';
    const slides = [...list.querySelectorAll('li:has(._aagv)')];
    while (slides.length < 5) {
        const slide = slides.at(-1)?.cloneNode(true);
        if (!(slide instanceof HTMLLIElement)) throw new Error('Could not extend captured carousel');
        list.append(slide);
        slides.push(slide);
    }
    for (const [index, li] of slides.entries()) {
        li.style.cssText = `position:absolute;width:300px;height:300px;transform:translateX(${index * 300}px)`;
        const image = li.querySelector('img');
        if (!image) throw new Error(`Captured carousel item ${index + 1} is missing its image`);
        image.src = `https://cdn.test/image-${index + 1}.jpg`;
        image.removeAttribute('srcset');
        image.style.cssText = 'width:300px;height:300px';
        if (index === 3) {
            const video = document.createElement('video');
            video.style.cssText = 'width:300px;height:300px';
            li.append(video);
        }
    }
    const profile = [...section.querySelectorAll('img')].find(img => !img.closest('._aagv'));
    if (!profile) throw new Error('Captured sidebar profile picture is missing');
    profile.style.cssText = 'width:100px;height:100px';
    document.body.append(section);

    try {
        createDownloadButton();
        const active = section.querySelector('[data-snig="canDownload"]');
        const download = active?.querySelector('.button_wrapper')?.shadowRoot?.querySelector('.IG_DW_MAIN');
        if (!active?.contains(list) || !active.querySelector('svg[aria-label="Save"]') || !download) {
            throw new Error('Carousel post container or its download control was not selected');
        }
        $(active).data('username', 'fixture').data('igHelper_postPath', 'DeufEDZEWW7');

        async function clickSlide(index) {
            list.style.left = `-${index * 300}px`;
            const back = section.querySelector('button._afxv._al46._al47');
            if (index > 0 && !back) {
                const button = document.createElement('button');
                button.className = '_afxv _al46 _al47';
                active.append(button);
            }
            if (index === 0) back?.remove();
            const current = getVisibleNodeIndex($(active));
            download.click();
            await new Promise(resolve => setTimeout(resolve, 400));
            return current;
        }

        const indices = [await clickSlide(0), await clickSlide(1), await clickSlide(3), await clickSlide(4)];
        const result = { indices, downloads };
        if (indices[0] !== 0 || indices[1] !== 1 || indices[2] !== 3 || indices[3] !== 4 ||
            downloads.length !== 4 ||
            downloads[0].url !== 'https://cdn.test/image-1.jpg' ||
            downloads[1].url !== 'https://cdn.test/image-2.jpg' ||
            downloads[2].url !== 'https://cdn.test/video-4.mp4' ||
            downloads[3].url !== 'https://cdn.test/image-5.jpg' ||
            downloads[0].name !== 'DeufEDZEWW7-1.jpg' ||
            downloads[1].name !== 'DeufEDZEWW7-2.jpg' ||
            downloads[2].name !== 'DeufEDZEWW7-4.mp4' ||
            downloads[3].name !== 'DeufEDZEWW7-5.jpg') {
            throw new Error(`Incorrect media downloaded: ${JSON.stringify(result)}`);
        }
        return result;
    } finally {
        section.remove();
    }
}
