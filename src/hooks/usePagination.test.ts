import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useRetourPageVide } from './usePagination';
import type { PageListe } from '@/types';

/**
 * Hooks de pagination. Rend impossible :
 *  - une requête au back à CHAQUE frappe dans un champ de recherche
 *    (useDebounce : une seule valeur après 400 ms de calme) ;
 *  - un écran bloqué sur une page devenue vide (dernier élément d'une page
 *    supprimé ou changé de statut) qui affichait « Aucun résultat » alors
 *    qu'il en restait sur la page précédente ;
 *  - un retour de page déclenché sur des données PROVISOIRES (ancienne page
 *    affichée pendant le chargement) ou en page 1 (boucle).
 */
describe('useDebounce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('ne publie la valeur qu’après le délai sans nouvelle frappe', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 400), { initialProps: { v: '' } });
    rerender({ v: 'N' });
    rerender({ v: 'NA' });
    act(() => { vi.advanceTimersByTime(399); });
    expect(result.current).toBe('');
    rerender({ v: 'NAN' }); // nouvelle frappe : le délai repart
    act(() => { vi.advanceTimersByTime(399); });
    expect(result.current).toBe('');
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('NAN');
  });

  it('délai par défaut : 400 ms', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v), { initialProps: { v: 'a' } });
    rerender({ v: 'b' });
    act(() => { vi.advanceTimersByTime(399); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('b');
  });
});

describe('useRetourPageVide', () => {
  const page = (items: number[], pages: number, p = 1): PageListe<number> => ({
    items,
    pagination: { page: p, limit: 20, total: items.length, pages },
  });

  it('page vide au-delà de la première : revient à la page précédente', () => {
    const setPage = vi.fn();
    renderHook(() => useRetourPageVide(page([], 3, 3), 3, setPage, false));
    expect(setPage).toHaveBeenCalledWith(2);
  });

  it('page demandée bien au-delà de la dernière : va à la dernière page existante', () => {
    const setPage = vi.fn();
    renderHook(() => useRetourPageVide(page([], 2, 6), 6, setPage, false));
    expect(setPage).toHaveBeenCalledWith(2);
  });

  it('plus aucune donnée du tout (pages = 1) : retour en page 1', () => {
    const setPage = vi.fn();
    renderHook(() => useRetourPageVide({ items: [], pagination: { page: 2, limit: 20, total: 0, pages: 1 } }, 2, setPage, false));
    expect(setPage).toHaveBeenCalledWith(1);
  });

  it('page 1 vide : rien (pas de boucle)', () => {
    const setPage = vi.fn();
    renderHook(() => useRetourPageVide(page([], 1), 1, setPage, false));
    expect(setPage).not.toHaveBeenCalled();
  });

  it('données provisoires (ancienne page pendant le chargement) : rien', () => {
    const setPage = vi.fn();
    renderHook(() => useRetourPageVide(page([], 3, 3), 3, setPage, true));
    expect(setPage).not.toHaveBeenCalled();
  });

  it('page non vide ou données absentes : rien', () => {
    const setPage = vi.fn();
    renderHook(() => useRetourPageVide(page([1], 3, 3), 3, setPage, false));
    renderHook(() => useRetourPageVide(undefined, 3, setPage, false));
    expect(setPage).not.toHaveBeenCalled();
  });

  it('avec un vrai état React : la page se stabilise sans boucle infinie', async () => {
    const { useState } = await import('react');
    const donnees = page([], 2, 3);
    const { result } = renderHook(() => {
      const [p, setP] = useState(3);
      // Après le retour en page 2, le back renverrait une page non vide.
      useRetourPageVide(p === 3 ? donnees : page([1], 2, 2), p, setP, false);
      return p;
    });
    expect(result.current).toBe(2);
  });
});
