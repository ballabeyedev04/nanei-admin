import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Configuration de test — séparée de `vite.config.ts` pour que la
 * construction de production n'embarque rien du harnais de test.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Même alias que vite.config.ts : les tests importent comme l'application.
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // `jsdom` : les composants et `renderHook` sont réellement montés.
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
    // Nettoyage du DOM et du stockage entre les tests — voir vitest.setup.ts
    // (il n'est PAS automatique avec `globals: false`).
    setupFiles: ['./vitest.setup.ts'],
    // Aucun appel réseau réel : une URL d'API factice, jamais joignable.
    env: { VITE_API_URL: 'http://api.test/nanei' },
  },
});
