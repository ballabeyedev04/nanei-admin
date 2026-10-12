import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '@/api/axios';
import { intercepter } from '@/test/axiosFactice';
import { rendreEcran } from '@/test/rendu';
import { notifySuccess } from '@/utils/notify';
import ReclamationsPage from './ReclamationsPage';

/**
 * Écran « Réclamations » alimenté par la réponse RÉELLE du back
 * (controllers/client/reclamation.controller.js) — seule la couche réseau est
 * simulée, la conversion de api/reclamations.ts est exercée. Rend impossible
 * le retour de l'écran blanc (TypeError sur `r.client.prenom` : le back envoie
 * `utilisateur`) et d'un commentaire admin perdu (envoyé sous `commentaire`).
 */
vi.mock('@/utils/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn(), notifyInfo: vi.fn() }));

const reclamationBack = {
  id: '6f1c2a3b-0000-4000-8000-00000000abcd',
  type: 'endommagé',
  statut: 'ouverte',
  description: 'Carton écrasé à l’arrivée',
  photos: ['https://cdn/p1.jpg'],
  commentaire_admin: 'Nous vérifions avec le transporteur',
  createdAt: '2026-10-02T08:00:00.000Z',
  updatedAt: '2026-10-03T08:00:00.000Z',
  colis: { reference: 'NAN-777', statut: 'livre', destination: 'Kayes' },
  utilisateur: { nom: 'Keita', prenom: 'Awa', email: 'awa@ex.ml', telephone: '+22370000000' },
};

let reseau: ReturnType<typeof intercepter>;
beforeEach(() => {
  vi.clearAllMocks();
  reseau = intercepter(api, (config) => {
    if (config.method === 'put') {
      return { data: { success: true, message: 'Réclamation mise à jour', reclamation: { ...reclamationBack, statut: 'resolue' } } };
    }
    return {
      data: {
        success: true,
        reclamations: [reclamationBack, { id: 'sans-compte-0001', type: 'retard', statut: 'en_cours', description: 'x', photos: null, colis: null, utilisateur: null, createdAt: '2026-10-01T08:00:00.000Z' }],
        pagination: { page: 1, limit: 20, total: 2, pages: 1 },
      },
    };
  });
});

describe('ReclamationsPage', () => {
  it('rend la liste du back sans planter (client, référence, type accentué, statut)', async () => {
    rendreEcran(<ReclamationsPage />);
    await screen.findByText('NAN-777');
    screen.getByText('Awa Keita');
    screen.getByText('awa@ex.ml');
    screen.getByText('Colis endommagé');
    screen.getByText('Ouverte');
    screen.getByText('2 réclamations');
    // Réclamation sans colis ni compte (supprimé) : tirets, pas de plantage.
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(reseau.appels[0]).toMatchObject({ methode: 'GET', url: '/admin/reclamations', params: { page: 1, limit: 20 } });
  });

  it('filtre de statut envoyé au back', async () => {
    rendreEcran(<ReclamationsPage />);
    await screen.findByText('NAN-777');
    fireEvent.click(screen.getByRole('button', { name: 'Résolues' }));
    await waitFor(() => expect(reseau.dernier().params).toEqual({ page: 1, limit: 20, statut: 'resolue' }));
  });

  it('détail : affiche le dernier commentaire_admin et envoie { statut, commentaire_admin }', async () => {
    rendreEcran(<ReclamationsPage />);
    fireEvent.click(await screen.findByText('NAN-777'));
    screen.getByText('Nous vérifions avec le transporteur');
    screen.getByText('Réclamation #00ABCD');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'resolue' } });
    fireEvent.change(screen.getByPlaceholderText(/Message au client/), { target: { value: '  Remboursement effectué  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));

    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('Réclamation mise à jour'));
    const maj = reseau.appels.find((a) => a.methode === 'PUT');
    expect(maj).toMatchObject({ url: `/admin/reclamations/${reclamationBack.id}` });
    expect(maj?.corps).toEqual({ statut: 'resolue', commentaire_admin: 'Remboursement effectué' });
  });

  it('détail sans message : le commentaire existant n’est pas effacé (clé absente)', async () => {
    rendreEcran(<ReclamationsPage />);
    fireEvent.click(await screen.findByText('NAN-777'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en_cours' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
    await waitFor(() => expect(reseau.appels.some((a) => a.methode === 'PUT')).toBe(true));
    expect(reseau.appels.find((a) => a.methode === 'PUT')?.corps).toEqual({ statut: 'en_cours' });
  });
});
