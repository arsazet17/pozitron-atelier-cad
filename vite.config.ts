import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

// Сборка кладётся в docs/ — GitHub Pages раздаёт её из ветки main, папка /docs.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    sourcemap: false,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', '.nojekyll'],
      manifest: {
        id: './',
        name: 'ПОЗИТРОН АТЕЛЬЕ CAD',
        short_name: 'Ателье CAD',
        description: 'Замеры окон, чертежи, расчёт ткани и сметы для шторного ателье',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f4f2ee',
        theme_color: '#1d2b3a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as never);
