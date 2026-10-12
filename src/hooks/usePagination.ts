import { useEffect, useState } from 'react';
import type { PageListe } from '@/types';

/** Valeur retardée : ne change qu'après `delai` ms sans nouvelle frappe. */
export function useDebounce<T>(valeur: T, delai = 400): T {
  const [retardee, setRetardee] = useState(valeur);
  useEffect(() => {
    const minuteur = setTimeout(() => setRetardee(valeur), delai);
    return () => clearTimeout(minuteur);
  }, [valeur, delai]);
  return retardee;
}

/**
 * Si la page affichée est devenue vide (suppression, changement de statut…)
 * et qu'elle n'est pas la première, revient à la page précédente (ou à la
 * dernière page existante). Ajustement fait pendant le rendu, sans effet.
 */
export function useRetourPageVide<T>(
  donnees: PageListe<T> | undefined,
  page: number,
  setPage: (page: number) => void,
  estProvisoire: boolean,
) {
  if (donnees && !estProvisoire && donnees.items.length === 0 && page > 1) {
    setPage(Math.max(1, Math.min(page - 1, donnees.pagination.pages)));
  }
}
