// Run in about:blank via test:agent eval, importing this module from the dev server.
export async function checkDownloadIndex() {
    let request;
    let save;
    globalThis.GM_xmlhttpRequest = details => request(details);
    globalThis.GM_download = details => save(details);
    globalThis.GM_getValue ??= (_key, fallback) => fallback;
    globalThis.GM_setValue ??= () => {};
    const $ = (await import('jquery')).default;
    const { USER_SETTING, state, DIRECT_DOWNLOAD_MODE_OPTIONS } = await import('/src/settings/state.ts');
    const { createDownloadButton, getVisibleNodeIndex } = await import('/src/features/post/post.ts');
    Object.assign(USER_SETTING, {
        DIRECT_DOWNLOAD_MODE: DIRECT_DOWNLOAD_MODE_OPTIONS.VISIBLE,
        FORCE_RESOURCE_VIA_MEDIA: true, USE_EXTERNAL_DOWNLOAD_MODE: true,
        MODIFY_RESOURCE_EXIF: false, AUTO_RENAME: true,
    });
    state.fileRenameFormat = '%SHORTCODE%-%INDEX%';
    const article = document.createElement('article');
    article.innerHTML = `<div><div><div><div><div role="presentation" style="width:300px;overflow:hidden">
        <div><ul class="carousel" style="position:relative;width:300px;height:300px;margin:0;padding:0">
        <li class="slide" style="position:absolute;width:300px;height:300px;transform:translateX(0px)"><div class="_aagv"><img alt="First" src="/first.jpg" width="300" height="300"></div></li>
        <li class="slide" style="position:absolute;width:300px;height:300px;transform:translateX(300px)"><div class="_aagv"><img alt="Second" src="/second.jpg" width="300" height="300"></div></li>
        </ul></div></div></div></div></div></div>
        <section><span><svg aria-label="Save"></svg></span></section>
        <script type="application/json">{"APP_ID":"936619743392459"}</script>`;
    document.body.append(article);
    createDownloadButton();
    $(article).data('username', 'fixture').data('igHelper_postPath', 'Race123');
    const mount = article.querySelector('.button_wrapper');
    const download = mount?.shadowRoot?.querySelector('.IG_DW_MAIN');
    if (!download) throw new Error('Download control was not mounted');

    const downloads = [];
    let release;
    const requested = new Promise(resolve => {
        request = details => {
            if (details.url.includes('/graphql/')) {
                release = () => details.onload({ status: 200, response: JSON.stringify({ data: { shortcode_media: {
                    __typename: 'GraphSidecar', id: '10', shortcode: 'Race123',
                    owner: { username: 'fixture', id: '42' }, taken_at_timestamp: 1700000000,
                    display_resources: [], edge_sidecar_to_children: { edges: [1, 2].map(index => ({ node: {
                        __typename: 'GraphImage', id: String(index),
                        display_resources: [{ src: `https://cdn.test/image-${index}.jpg` }, { src: `https://cdn.test/image-${index}.jpg` }],
                    } })) },
                } } }) });
                resolve();
            } else {
                const index = details.url.includes('/1/') ? 1 : 2;
                queueMicrotask(() => details.onload({ status: 200, finalUrl: details.url, response: JSON.stringify({ status: 'ok', items: [{
                    id: String(index), taken_at: 1700000000,
                    image_versions2: { candidates: [{ url: `https://cdn.test/image-${index}.jpg` }] },
                }] }) }));
            }
            return { abort() {} };
        };
    });
    const saved = new Promise(resolve => {
        save = details => {
            downloads.push({ url: details.url, name: details.name });
            details.onload();
            resolve();
            return { abort() {} };
        };
    });
    const clickedIndex = getVisibleNodeIndex($(article));
    download.click();
    await requested;
    article.querySelector('ul').style.left = '-300px';
    const back = document.createElement('button');
    back.className = '_afxv _al46 _al47';
    article.append(back);
    const currentIndex = getVisibleNodeIndex($(article));
    release();
    await saved;
    article.remove();
    const result = { clickedIndex, currentIndex, downloads };
    if (clickedIndex !== 0 || currentIndex !== 1) throw new Error(`Carousel fixture failed: ${JSON.stringify(result)}`);
    if (downloads[0]?.url !== 'https://cdn.test/image-1.jpg' || downloads[0]?.name !== 'Race123-1.jpg') {
        throw new Error(`Downloaded the image selected after the click: ${JSON.stringify(result)}`);
    }
    return result;
}
