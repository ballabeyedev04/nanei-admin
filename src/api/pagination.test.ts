import { describe, it, expect } from 'vitest';
import { nettoyerParams, versPage, TAILLE_PAGE } from './pagination';

/**
 * Outils de pagination partagés par tous les clients d'API. Rend impossible :
 * un `q=` vide ou fait d'espaces envoyé au back (filtre sur une chaîne vide),
 * un `0` ou `false` retiré à tort, une liste sans `pagination` (route appelée
 * sans `page`) qui ferait planter l'écran au lieu de donner UNE page.
 */
describe('nettoyerParams', () => {
  it('retire undefined, null et chaînes vides ; rogne les chaînes', () => {
    expect(nettoyerParams({ page: 1, q: '  abc ', vide: '', espaces: '   ', rien: undefined, nul: null })).toEqual({ page: 1, q: 'abc' });
  });

  it('garde 0 et false (valeurs légitimes)', () => {
    expect(nettoyerParams({ note: 0, actif: false })).toEqual({ note: 0, actif: false });
  });

  it('sans paramètres : undefined (aucune pagination demandée → liste complète)', () => {
    expect(nettoyerParams()).toBeUndefined();
  });
});

describe('versPage', () => {
  it('reprend la pagination du back', () => {
    const p = { page: 2, limit: 20, total: 45, pages: 3 };
    expect(versPage([1, 2], p)).toEqual({ items: [1, 2], pagination: p });
  });

  it('pagination absente : une seule page', () => {
    expect(versPage(['a', 'b', 'c'])).toEqual({ items: ['a', 'b', 'c'], pagination: { page: 1, limit: 3, total: 3, pages: 1 } });
  });

  it('liste absente ou invalide : page vide', () => {
    expect(versPage(undefined)).toEqual({ items: [], pagination: { page: 1, limit: 0, total: 0, pages: 1 } });
    expect(versPage(null, null).items).toEqual([]);
  });

  it('taille de page compatible avec la limite du back (100 max)', () => {
    expect(TAILLE_PAGE).toBeGreaterThan(0);
    expect(TAILLE_PAGE).toBeLessThanOrEqual(100);
  });
});
