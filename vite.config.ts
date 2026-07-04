import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_IDENTITY } from './src/config/appIdentity';

export default defineConfig({
  base: '/OmniGame/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: APP_IDENTITY.name,
        short_name: APP_IDENTITY.shortName,
        description: 'Ad-free casual games',
        display: 'fullscreen',
        orientation: 'portrait',
        background_color: APP_IDENTITY.themeColor,
        theme_color: APP_IDENTITY.themeColor,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
