import { createRequire } from 'node:module';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// RDKit'in WASM dosyasi public/ altinda sabit adla durur, yani Vite'in hash'li
// dosya adlarindan yararlanamaz. Surumu onbellek adina gomuyoruz ki RDKit
// yukseltildiginde eski WASM sonsuza dek onbellekte kalmasin.
const require = createRequire(import.meta.url);
const rdkitVersion = (require('@rdkit/rdkit/package.json') as { version: string }).version;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Yeni surum bulununca sessizce guncelle; kullanicidan onay istemiyoruz.
      registerType: 'autoUpdate',
      // manifest.json: varsayilan .webmanifest uzantisini IIS tanimiyor ve dosya
      // dursa bile 404 donuyor (chemdraw.maege.tr, IIS 10). .json'u IIS
      // tanidigi icin sunucuda web.config gerekmiyor. web.config ayni uygulama
      // havuzundaki Blazor sitesini (maege.tr) cokertmisti; bkz. deploy/iis/.
      manifestFilename: 'manifest.json',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'KimyasalÇizim — 2B Kimyasal Yapı Editörü',
        short_name: 'KimyasalÇizim',
        description:
          'Fare veya parmakla kimyasal yapı çizin; SMILES, InChI ve molekül ' +
          'özelliklerini anında görün.',
        lang: 'tr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#2563eb',
        background_color: '#f7f8fa',
        categories: ['education', 'productivity', 'utilities'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Kucuk dosyalar on-onbellege girer; 6.4 MB'lik WASM bilerek disarida,
        // yoksa service worker kurulumu o indirmeyi beklerdi.
        globPatterns: ['**/*.{html,css,js,png,svg,ico,woff2}'],
        globIgnores: ['**/RDKit_minimal.wasm'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // WASM ilk kullanimda onbellege alinir; uygulama zaten aciliste
            // yukledigi icin cevrimdisi destegi ilk ziyaretten sonra hazir olur.
            urlPattern: ({ url }) => url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: {
              cacheName: `rdkit-wasm-${rdkitVersion}`,
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Gelistirirken service worker kapali: onbellek, kaynak degisikliklerini
        // golgeleyip kafa karistirir. Uretim derlemesi `npm run preview` ile denenir.
        enabled: false,
      },
    }),
  ],
  server: { port: 5173 },
});
