import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import { rendreEcran } from '@/test/rendu';
import { colisApi } from '@/api/colis';
import { preuveLivraisonApi } from '@/api/preuveLivraison';
import { confirmAction } from '@/utils/confirm';
import { notifyError, notifySuccess } from '@/utils/notify';
import type { Colis } from '@/types';
import ColisPage from './ColisPage';

/**
 * Écran « Gestion des colis ». Rend impossible :
 *  - de proposer une transition que le back refuse (409) : le menu ne
 *    contient que les transitions de services/admin/gestioncolis.service.js
 *    (en_attente → recupere, livre ; recupere → livre, en_attente) ;
 *  - un menu de statut sur un colis LIVRÉ (statut définitif) ;
 *  - un changement de statut sans confirmation, ou envoyé sur la mauvaise route ;
 *  - un refus du back (409) masqué derrière un « Erreur » générique ;
 *  - une recherche envoyée au back à chaque frappe.
 */
vi.mock('@/api/colis', () => ({
  colisApi: {
    list: vi.fn(), enAttente: vi.fn(), recuperes: vi.fn(), livres: vi.fn(),
    setEnAttente: vi.fn(), setRecupere: vi.fn(), setLivre: vi.fn(),
  },
}));
vi.mock('@/api/preuveLivraison', () => ({ preuveLivraisonApi: { get: vi.fn(), upload: vi.fn() } }));
vi.mock('@/utils/confirm', () => ({ confirmAction: vi.fn() }));
vi.mock('@/utils/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn(), notifyInfo: vi.fn() }));


/** Colis tel que renvoyé par listerColis() du back. */
const colis = (id: string, reference: string, statut: Colis['statut'], extra: Partial<Colis> = {}): Colis => ({
  id, reference, statut,
  poids: 2.5, prix: 25, destination: 'Bamako', createdAt: '2026-10-01T10:00:00.000Z',
  expediteur: { nom: 'Diallo', prenom: 'Fatou', email: 'f@ex.fr' },
  recepteur: { nom: 'Traoré', prenom: 'Moussa', email: 'm@ex.ml' },
  type_transport: 'aerien',
  ...extra,
});

const reponse = (liste: Colis[]) => ({
  data: { success: true, message: 'ok', colis: liste, pagination: { page: 1, limit: 20, total: liste.length, pages: 1 } },
});

const ligne = (reference: string) => screen.getByText(reference).closest('tr') as HTMLElement;
/** Menu ouvert par le sélecteur : rendu en portail, dernier enfant du body. */
const optionsDuMenu = () =>
  within(document.body.lastElementChild as HTMLElement).getAllByRole('button').map((b) => b.textContent?.trim());

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(colisApi.list).mockResolvedValue(reponse([
    colis('c1', 'NAN-001', 'en_attente'),
    colis('c2', 'NAN-002', 'recupere'),
    colis('c3', 'NAN-003', 'livre'),
  ]) as never);
  vi.mocked(confirmAction).mockResolvedValue(true);
});

describe('ColisPage — transitions de statut', () => {
  it('en attente : propose Récupéré et Livré (statut actuel en tête)', async () => {
    rendreEcran(<ColisPage />);
    await screen.findByText('NAN-001');
    fireEvent.click(within(ligne('NAN-001')).getByRole('button', { name: /En attente/ }));
    expect(optionsDuMenu()).toEqual(['En attente', 'Récupéré', 'Livré']);
  });

  it('récupéré : propose Livré et En attente (correction de saisie)', async () => {
    rendreEcran(<ColisPage />);
    await screen.findByText('NAN-002');
    fireEvent.click(within(ligne('NAN-002')).getByRole('button', { name: /Récupéré/ }));
    expect(optionsDuMenu()).toEqual(['En attente', 'Récupéré', 'Livré']);
  });

  it('livré : aucun menu (statut définitif), seulement la preuve de livraison', async () => {
    rendreEcran(<ColisPage />);
    await screen.findByText('NAN-003');
    const l = ligne('NAN-003');
    expect(within(l).queryByRole('button', { name: /Livré/ })).toBeNull();
    within(l).getByTitle('Statut définitif : un colis livré ne peut plus changer de statut');
    within(l).getByTitle('Preuve de livraison');
    // Les colis non livrés n'ont pas de bouton de preuve.
    expect(within(ligne('NAN-001')).queryByTitle('Preuve de livraison')).toBeNull();
  });

  it('choix confirmé : appel de la route du statut choisi, puis rechargement', async () => {
    vi.mocked(colisApi.setLivre).mockResolvedValue({ data: { success: true } } as never);
    rendreEcran(<ColisPage />);
    await screen.findByText('NAN-001');
    fireEvent.click(within(ligne('NAN-001')).getByRole('button', { name: /En attente/ }));
    fireEvent.click(within(document.body.lastElementChild as HTMLElement).getByRole('button', { name: 'Livré' }));

    await waitFor(() => expect(colisApi.setLivre).toHaveBeenCalledWith('c1'));
    expect(confirmAction).toHaveBeenCalledTimes(1);
    expect(colisApi.setEnAttente).not.toHaveBeenCalled();
    expect(colisApi.setRecupere).not.toHaveBeenCalled();
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('Statut mis à jour : Livré'));
    await waitFor(() => expect(colisApi.list).toHaveBeenCalledTimes(2));
  });

  it('confirmation refusée : aucun appel', async () => {
    vi.mocked(confirmAction).mockResolvedValue(false);
    rendreEcran(<ColisPage />);
    await screen.findByText('NAN-002');
    fireEvent.click(within(ligne('NAN-002')).getByRole('button', { name: /Récupéré/ }));
    fireEvent.click(within(document.body.lastElementChild as HTMLElement).getByRole('button', { name: 'Livré' }));
    await waitFor(() => expect(confirmAction).toHaveBeenCalled());
    expect(colisApi.setLivre).not.toHaveBeenCalled();
  });

  it('refus 409 du back : son message est affiché', async () => {
    vi.mocked(colisApi.setRecupere).mockRejectedValue({
      response: { status: 409, data: { success: false, message: 'Le colis est déjà « Récupéré »' } },
    });
    rendreEcran(<ColisPage />);
    await screen.findByText('NAN-001');
    fireEvent.click(within(ligne('NAN-001')).getByRole('button', { name: /En attente/ }));
    fireEvent.click(within(document.body.lastElementChild as HTMLElement).getByRole('button', { name: 'Récupéré' }));
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Le colis est déjà « Récupéré »'));
  });
});

describe('ColisPage — liste', () => {
  it('appelle la liste paginée (page 1, 20 par page), puis la route du filtre choisi', async () => {
    vi.mocked(colisApi.livres).mockResolvedValue(reponse([colis('c3', 'NAN-003', 'livre')]) as never);
    rendreEcran(<ColisPage />);
    await screen.findByText('NAN-001');
    expect(colisApi.list).toHaveBeenCalledWith({ page: 1, limit: 20, q: '' });

    fireEvent.click(screen.getByRole('button', { name: 'Livrés' }));
    await waitFor(() => expect(colisApi.livres).toHaveBeenCalledWith({ page: 1, limit: 20, q: '' }));
    await waitFor(() => expect(screen.queryByText('NAN-001')).toBeNull());
  });

  it('recherche : une seule requête après la saisie (anti-rebond)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      rendreEcran(<ColisPage />);
      await screen.findByText('NAN-001');
      const champ = screen.getByPlaceholderText('Rechercher par référence ou destination...');
      fireEvent.change(champ, { target: { value: 'N' } });
      fireEvent.change(champ, { target: { value: 'NA' } });
      fireEvent.change(champ, { target: { value: 'NAN-9' } });
      await act(async () => { vi.advanceTimersByTime(450); });
      await waitFor(() => expect(colisApi.list).toHaveBeenCalledWith({ page: 1, limit: 20, q: 'NAN-9' }));
      const recherches = vi.mocked(colisApi.list).mock.calls.filter(([p]) => p?.q);
      expect(recherches).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('badge « Lot (n) » avec la taille réelle du lot renvoyée par le back', async () => {
    vi.mocked(colisApi.list).mockResolvedValue(reponse([
      colis('c1', 'NAN-001', 'en_attente', { lot_id: 'L1', taille_lot: 4 }),
      colis('c2', 'NAN-002', 'en_attente', { lot_id: 'L2', taille_lot: 1 }),
    ]) as never);
    rendreEcran(<ColisPage />);
    await screen.findByText('NAN-001');
    within(ligne('NAN-001')).getByText('Lot (4)');
    expect(within(ligne('NAN-002')).queryByText(/Lot \(/)).toBeNull();
  });

  it('échec du chargement : bandeau d’erreur, pas « Aucun colis »', async () => {
    vi.mocked(colisApi.list).mockRejectedValue({ response: { status: 500, data: { message: 'Erreur serveur lors de la récupération des colis' } } });
    rendreEcran(<ColisPage />);
    await screen.findByText('Impossible de charger les données');
    expect(screen.queryByText('Aucun colis trouvé')).toBeNull();
  });
});

describe('ColisPage — preuve de livraison', () => {
  it('ouvre la preuve du colis livré (photo du back)', async () => {
    vi.mocked(preuveLivraisonApi.get).mockResolvedValue({ photo_url: 'https://r2/preuve.jpg', gps_lat: '12.6392', gps_lng: '-8.0029', createdAt: '2026-10-05T09:00:00.000Z' });
    rendreEcran(<ColisPage />);
    await screen.findByText('NAN-003');
    fireEvent.click(within(ligne('NAN-003')).getByTitle('Preuve de livraison'));
    const photo = await screen.findByAltText('Preuve de livraison');
    expect(photo.getAttribute('src')).toBe('https://r2/preuve.jpg');
    expect(preuveLivraisonApi.get).toHaveBeenCalledWith('c3');
    screen.getByText('Position GPS : 12.63920, -8.00290');
  });

  it('aucune preuve (404 → null) : propose d’en ajouter une', async () => {
    vi.mocked(preuveLivraisonApi.get).mockResolvedValue(null);
    rendreEcran(<ColisPage />);
    await screen.findByText('NAN-003');
    fireEvent.click(within(ligne('NAN-003')).getByTitle('Preuve de livraison'));
    await screen.findByText('Aucune preuve de livraison enregistrée');
    screen.getByRole('button', { name: /Ajouter une preuve/ });
  });
});
