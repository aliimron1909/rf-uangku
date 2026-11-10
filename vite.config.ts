import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['logo.svg', 'icons/apple-touch-180.png'],
      manifest: {
        name: 'RF Uangku — Manajemen Keuangan Pribadi',
        short_name: 'RF Uangku',
        description:
          'Catat pemasukan, pengeluaran, dan laporan keuangan pribadi. Bekerja offline, data tersimpan di perangkat.',
        theme_color: '#065f46',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'id',
        categories: ['finance', 'productivity'],
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Tambah Transaksi',
            short_name: 'Tambah',
            url: 'transactions?new=1',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Chat AI Transaksi',
            short_name: 'Chat AI',
            url: 'transactions?chat=1',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Lihat Laporan',
            short_name: 'Laporan',
            url: 'reports',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
})
