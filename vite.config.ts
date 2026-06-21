import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/nanei': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        bypass(req) {
          // Si c'est une navigation browser (Accept: text/html), renvoyer index.html
          // Sinon laisser passer vers le backend (appels API fetch/axios)
          const accept = req.headers['accept'] ?? '';
          if (accept.includes('text/html')) {
            return '/index.html';
          }
        },
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
