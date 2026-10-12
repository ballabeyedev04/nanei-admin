import type { PageListe, Pagination } from '@/types';

/** Taille de page de l'admin (le back accepte jusqu'à 100). */
export const TAILLE_PAGE = 20;

/** Retire les paramètres vides (undefined, null, chaîne vide) avant l'appel. */
export function nettoyerParams<T extends object>(params?: T): Partial<T> | undefined {
  if (!params) return undefined;
  const propres: Partial<T> = {};
  for (const [cle, valeur] of Object.entries(params)) {
    if (valeur === undefined || valeur === null) continue;
    if (typeof valeur === 'string' && valeur.trim() === '') continue;
    (propres as Record<string, unknown>)[cle] = typeof valeur === 'string' ? valeur.trim() : valeur;
  }
  return propres;
}

/**
 * Construit une page à partir de la réponse du back. Si `pagination` est
 * absente (ne devrait pas arriver quand `page` est fournie), on considère
 * qu'il n'y a qu'une seule page.
 */
export function versPage<T>(items: T[] | undefined | null, pagination?: Pagination | null): PageListe<T> {
  const liste = Array.isArray(items) ? items : [];
  return {
    items: liste,
    pagination: pagination ?? { page: 1, limit: liste.length, total: liste.length, pages: 1 },
  };
}
