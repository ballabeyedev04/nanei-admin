import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErreurChargement } from './ErreurChargement';

/**
 * Bandeau d'échec de chargement d'une liste. Rend impossible le retour de
 * l'ancien comportement : une panne (500, 429, réseau) affichée comme une
 * liste vide (« Aucun colis », « 0 avis »), sans détail ni moyen de réessayer.
 */
describe('ErreurChargement', () => {
  it('affiche le message du back quand il y en a un', () => {
    render(<ErreurChargement erreur={{ response: { status: 500, data: { message: 'Erreur serveur lors de la récupération des colis' } } }} />);
    screen.getByText('Impossible de charger les données');
    screen.getByText('Erreur serveur lors de la récupération des colis');
  });

  it('429 : message dédié (et non le texte brut du limiteur)', () => {
    render(<ErreurChargement erreur={{ response: { status: 429, data: { message: 'Too many requests' } } }} />);
    screen.getByText('Trop de requêtes : réessayez dans quelques minutes.');
  });

  it('réponse sans message : « Erreur <statut> »', () => {
    render(<ErreurChargement erreur={{ response: { status: 502, data: '<html>Bad gateway</html>' } }} />);
    screen.getByText('Erreur 502');
  });

  it('aucune réponse (réseau, délai dépassé) : serveur injoignable', () => {
    render(<ErreurChargement erreur={new Error('Network Error')} />);
    screen.getByText('Serveur injoignable ou délai dépassé.');
  });

  it('bouton « Réessayer » seulement si onRetry est fourni, et il le déclenche', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErreurChargement erreur={null} />);
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
    rerender(<ErreurChargement erreur={null} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
