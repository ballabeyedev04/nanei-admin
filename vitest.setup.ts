import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Journal de l'application rendu muet pendant les tests : en développement
 * il écrit chaque requête dans la console (bruit illisible dans la sortie
 * de `npm test`). Les tests qui veulent l'observer le re-mockent.
 */
vi.mock('@/lib/logger', () => {
  const logger = {
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    action: vi.fn(), apiError: vi.fn(),
    maskEmail: (e: string) => e,
  };
  return { default: logger, logger };
});

/**
 * Démonte les composants rendus après chaque test.
 *
 * React Testing Library le fait automatiquement — mais SEULEMENT si un
 * `afterEach` global est disponible, c'est-à-dire avec `globals: true`. Cette
 * configuration utilise `globals: false` (les fonctions de test sont importées
 * explicitement) : sans cet appel, chaque `render()` d'un fichier s'ajoutait
 * au même DOM, et un test pouvait réussir ou échouer selon le rendu du test
 * PRÉCÉDENT.
 *
 * Les globales remplacées (vi.stubGlobal) sont restaurées et le stockage
 * local est vidé : la session admin y est persistée
 * (clé nanei-admin-auth) et ne doit jamais passer d'un test à l'autre.
 */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});
