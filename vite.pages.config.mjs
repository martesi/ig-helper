import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
    base: command === 'serve' ? '/' : '/ig-helper/',
    build: {
        outDir: 'pages-dist',
        target: 'es2015',
        rolldownOptions: {
            input: {
                index: 'index.html',
                settings: 'settings/index.html',
            },
        },
    },
    server: {
        port: 9100,
        strictPort: true,
    },
    esbuild: {
        jsx: 'transform',
        jsxFactory: 'h',
        jsxFragment: 'Fragment',
    },
    plugins: [tailwindcss()],
}));
