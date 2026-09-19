import tailwindcss from '@tailwindcss/vite';
import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import userscript from 'vite-userscript-plugin';
import packageJson from './package.json' with { type: 'json' };

const mediabunnyUrl = 'https://cdn.jsdelivr.net/npm/mediabunny@1.34.5/dist/bundles/mediabunny.min.cjs#sha256-wUFR+x2bDvpqgMAVGy2CvGvULyjTGvGy4UUAm8rae5U=';
const jqueryUrl = 'https://code.jquery.com/jquery-4.0.0.min.js#sha256-OaVG6prZf4v69dPg6PhVattBXkcOWQB62pdZ3ORyrao=';
const i18nArtifactName = 'i18n.json';
const i18nReleaseUrl = `https://github.com/martesi/ig-helper/releases/download/v${packageJson.version}/${i18nArtifactName}`;

function localizedMetadata(key, values) {
    const { '': fallback, ...localized } = values;

    return {
        [key]: fallback,
        ...Object.fromEntries(
            Object.entries(localized).map(([locale, value]) => [`${key}:${locale}`, value]),
        ),
    };
}

function i18nArtifactPlugin() {
    const translationsUrl = new URL('./locale/translations/', import.meta.url);

    return {
        name: 'ig-helper-i18n-artifact',
        apply: 'build',
        generateBundle() {
            const translations = Object.fromEntries(
                readdirSync(translationsUrl)
                    .filter(file => file.endsWith('.json'))
                    .sort()
                    .map(file => [
                        file.slice(0, -'.json'.length),
                        JSON.parse(readFileSync(new URL(file, translationsUrl), 'utf8')),
                    ]),
            );

            this.emitFile({
                type: 'asset',
                fileName: i18nArtifactName,
                source: JSON.stringify(translations),
            });
        },
    };
}

export default defineConfig(({ command, mode }) => {
    const isBuild = command === 'build';
    const isScriptBuild = isBuild && mode === 'script';
    const isPageBuild = isBuild && mode === 'page';

    if (isBuild && !isScriptBuild && !isPageBuild) {
        throw new Error('Use `bun run build` so page and userscript outputs stay isolated.');
    }

    const plugins = [tailwindcss()];
    if (!isPageBuild) {
        plugins.push(
            i18nArtifactPlugin(),
            userscript({
                entry: isScriptBuild ? 'entry.prod.js' : 'src/app/entry.js',
                fileName: 'ig-helper',
                header: {
                    ...localizedMetadata('name', {
                        '': 'IG Helper',
                        ar: 'أداة IG',
                        de: 'IG-Helfer',
                        es: 'Ayudante de IG',
                        fr: 'Assistant IG',
                        id: 'Asisten IG',
                        it: 'Assistente IG',
                        ja: 'IG助手',
                        ko: 'IG조수',
                        'pt-BR': 'Assistente do IG',
                        ro: 'IG Helper',
                        ru: 'Помощник IG',
                        th: 'ตัวช่วย IG',
                        tr: 'IG Yardımcısı',
                        vi: 'Trợ lý IG',
                        'zh-CN': 'IG小助手',
                        'zh-TW': 'IG小精靈',
                    }),
                    namespace: 'github.com/martesi',
                    version: packageJson.version,
                    ...(isScriptBuild ? {
                        updateURL: 'https://github.com/martesi/ig-helper/releases/latest/download/ig-helper.meta.js',
                        downloadURL: 'https://github.com/martesi/ig-helper/releases/latest/download/ig-helper.user.js',
                    } : {}),
                    ...localizedMetadata('description', {
                        '': 'Download photos and videos from Instagram posts in one click, including Stories, Reels, and profile pictures.',
                        ar: 'نزّل صورًا ومقاطع فيديو من منشورات Instagram بنقرة واحدة، بما في ذلك القصص وReels وصور الملف الشخصي.',
                        de: 'Lade Fotos und Videos aus Instagram-Beiträgen mit einem Klick herunter, einschließlich Stories, Reels und Profilbildern.',
                        es: 'Descarga fotos y videos de publicaciones de Instagram con un clic, incluyendo Stories, Reels y fotos de perfil.',
                        fr: 'Téléchargez en un clic les photos et vidéos des publications Instagram, y compris les Stories, les Reels et les photos de profil.',
                        id: 'Unduh foto dan video dari postingan Instagram dalam satu klik, termasuk Stories, Reels, dan foto profil.',
                        it: 'Scarica foto e video dai post di Instagram con un solo clic, incluse Storie, Reels e foto del profilo.',
                        ja: 'Instagramの投稿の写真や動画をワンクリックでダウンロード。ストーリー、リール、プロフィール写真にも対応。',
                        ko: '한 번의 클릭으로 Instagram 게시물의 사진과 동영상을 다운로드하고, 스토리, 릴스, 프로필 사진도 지원합니다.',
                        'pt-BR': 'Baixe fotos e vídeos de publicações do Instagram com um clique, incluindo Stories, Reels e fotos de perfil.',
                        ro: 'Descarcă cu un singur clic fotografii și videoclipuri din postările Instagram, inclusiv storyuri, reels și fotografii de profil.',
                        ru: 'Скачивайте фото и видео из публикаций Instagram в один клик, включая Stories, Reels и фото профиля.',
                        th: 'ดาวน์โหลดรูปภาพและวิดีโอจากโพสต์ Instagram ได้ในคลิกเดียว รวมถึง Stories, Reels และรูปโปรไฟล์.',
                        tr: 'Instagram gönderilerindeki fotoğraf ve videoları tek tıkla indirin; Hikayeler, Reels ve profil fotoğrafları da dahildir.',
                        vi: 'Tải xuống ảnh và video từ bài viết trên Instagram chỉ với một cú nhấp, bao gồm Stories, Reels và ảnh đại diện.',
                        'zh-CN': '一键下载 Instagram 帖子中的照片和视频，还包括快拍、Reels 和头像。',
                        'zh-TW': '一鍵下載 Instagram 貼文中的照片、影片，還包含限時動態、Reels 與大頭貼。',
                    }),
                    author: 'SN-Koarashi (5026)',
                    match: [
                        'https://*.instagram.com/*',
                        'https://martesi.github.io/ig-helper/*',
                        ...(!isBuild ? ['http://127.0.0.1:9000/*'] : []),
                    ],
                    grant: [
                        'GM_addStyle',
                        'GM_addValueChangeListener',
                        'GM_download',
                        'GM_getResourceText',
                        'GM_getValue',
                        'GM_info',
                        'GM_openInTab',
                        'GM_registerMenuCommand',
                        'GM_setValue',
                        'GM_unregisterMenuCommand',
                        'GM_xmlhttpRequest',
                    ],
                    connect: [
                        'cdn.jsdelivr.net',
                        'i.instagram.com',
                    ],
                    ...(isScriptBuild ? { resource: [['I18N', i18nReleaseUrl]] } : {}),
                    contributionURL: 'https://ko-fi.com/snkoarashi',
                    icon: 'https://www.google.com/s2/favicons?domain=www.instagram.com&sz=32',
                    license: 'GPL-3.0-only',
                    'run-at': 'document-idle',
                },
                external: {
                    jquery: {
                        global: 'jQuery',
                        url: jqueryUrl,
                    },
                    mediabunny: {
                        global: 'Mediabunny',
                        url: mediabunnyUrl,
                    },
                },
            }),
        );
    }

    return {
        root: isScriptBuild ? 'src/app' : undefined,
        base: isPageBuild ? '/ig-helper/' : '/',
        build: isBuild ? {
            outDir: isScriptBuild ? '../../dist/script' : 'dist/page',
            emptyOutDir: true,
            minify: isScriptBuild ? false : undefined,
            target: 'es2025',
        } : undefined,
        oxc: {
            jsx: {
                runtime: 'automatic',
                importSource: 'preact',
            },
        },
        optimizeDeps: {
            rolldownOptions: {
                transform: {
                    jsx: { runtime: 'automatic', importSource: 'preact' },
                },
            },
        },
        server: {
            port: 9000,
            strictPort: true,
        },
        plugins,
    };
});
