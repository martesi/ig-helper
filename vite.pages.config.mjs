import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
    base: command === 'serve' ? '/' : '/ig-helper/',
    build: {
        outDir: 'pages-dist',
        target: 'es2025',
    },
    server: {
        port: 9100,
        strictPort: true,
    },
    oxc: {
        jsx: {
            runtime: 'classic',
            pragma: 'h',
            pragmaFrag: 'Fragment',
        },
    },
    plugins: [tailwindcss()],
}));
