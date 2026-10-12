import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from './Pagination';

/**
 * Pagination serveur partagée par toutes les listes. Rend impossible : un
 * « Précédent » cliquable en page 1 (requête page 0 → le back la ramène à 1,
 * l'écran ne bouge pas), un « Suivant » cliquable en dernière page (page vide),
 * un double clic pendant le chargement qui saute une page, une page hors
 * bornes affichée (« Page 5 sur 3 ») après une suppression.
 */
const desactive = (el: HTMLElement) => (el as HTMLButtonElement).disabled;
const infos = (page: number, pages: number, total = pages * 20) => ({ page, limit: 20, total, pages });

describe('Pagination', () => {
  // jsdom n'implémente pas le défilement : remontée en haut de liste neutralisée.
  beforeEach(() => { vi.stubGlobal('scrollTo', vi.fn()); });

  it('affiche « Page X sur Y » et le nombre de résultats', () => {
    render(<Pagination pagination={infos(2, 5, 93)} onChange={() => {}} />);
    const texte = screen.getByText(/Page/).textContent;
    expect(texte).toMatch(/Page\s*2\s*sur\s*5/);
    expect(texte).toMatch(/93 résultats/);
  });

  it('singulier pour un seul résultat', () => {
    render(<Pagination pagination={infos(1, 1, 1)} onChange={() => {}} />);
    expect(screen.getByText(/Page/).textContent).toMatch(/1 résultat$/);
  });

  it('première page : « Précédent » désactivé, « Suivant » actif', () => {
    const onChange = vi.fn();
    render(<Pagination pagination={infos(1, 3)} onChange={onChange} />);
    expect(desactive(screen.getByRole('button', { name: 'Page précédente' }))).toBe(true);
    const suivant = screen.getByRole('button', { name: 'Page suivante' });
    expect(desactive(suivant)).toBe(false);
    fireEvent.click(suivant);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('dernière page : « Suivant » désactivé, « Précédent » va à la page d’avant', () => {
    const onChange = vi.fn();
    render(<Pagination pagination={infos(3, 3)} onChange={onChange} />);
    expect(desactive(screen.getByRole('button', { name: 'Page suivante' }))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Page précédente' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('page unique : les deux boutons désactivés', () => {
    render(<Pagination pagination={infos(1, 1, 4)} onChange={() => {}} />);
    expect(desactive(screen.getByRole('button', { name: 'Page précédente' }))).toBe(true);
    expect(desactive(screen.getByRole('button', { name: 'Page suivante' }))).toBe(true);
  });

  it('chargement en cours : boutons désactivés (pas de double saut)', () => {
    render(<Pagination pagination={infos(2, 3)} onChange={() => {}} chargement />);
    expect(desactive(screen.getByRole('button', { name: 'Page précédente' }))).toBe(true);
    expect(desactive(screen.getByRole('button', { name: 'Page suivante' }))).toBe(true);
  });

  it('page hors bornes renvoyée par le back : ramenée à la dernière page', () => {
    render(<Pagination pagination={infos(5, 3)} onChange={() => {}} />);
    expect(screen.getByText(/Page/).textContent).toMatch(/Page\s*3\s*sur\s*3/);
    expect(desactive(screen.getByRole('button', { name: 'Page suivante' }))).toBe(true);
  });

  it('aucun résultat ou pagination absente : rien n’est affiché', () => {
    const { container, rerender } = render(<Pagination pagination={{ page: 1, limit: 20, total: 0, pages: 1 }} onChange={() => {}} />);
    expect(container.innerHTML).toBe('');
    rerender(<Pagination pagination={undefined} onChange={() => {}} />);
    expect(container.innerHTML).toBe('');
  });
});
