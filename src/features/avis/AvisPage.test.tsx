import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '@/api/axios';
import { intercepter } from '@/test/axiosFactice';
import { rendreEcran } from '@/test/rendu';
import AvisPage from './AvisPage';

/**
 * Écran « Avis clients » alimenté par la réponse RÉELLE du back
 * (controllers/client/avis.controller.js, `adminAvis`) — seule la couche
 * réseau est simulée. Rend impossible le retour de l'écran blanc
 * (`a.client.prenom` alors que le back envoie `utilisateur`) et d'une
 * moyenne affichée à 0.0 (le back l'envoie sous `stats.note_moyenne`).
 */
let reseau: ReturnType<typeof intercepter>;
beforeEach(() => {
  reseau = intercepter(api, () => ({
    data: {
      success: true,
      stats: { total: 3, note_moyenne: 4.3, distribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 1 } },
      avis: [
        {
          id: 'av1', note: 5, commentaire: 'Très rapide', createdAt: '2026-10-01T10:00:00.000Z',
          colis: { reference: 'NAN-500', destination: 'Bamako' },
          utilisateur: { nom: 'Traoré', prenom: 'Moussa', email: 'm@ex.ml' },
        },
        { id: 'av2', note: 4, commentaire: null, createdAt: '2026-10-02T10:00:00.000Z', colis: null, utilisateur: null },
      ],
      pagination: { page: 1, limit: 20, total: 2, pages: 1 },
    },
  }));
});

describe('AvisPage', () => {
  it('rend les avis du back : client, référence, moyenne et total', async () => {
    rendreEcran(<AvisPage />);
    await screen.findByText('NAN-500');
    screen.getByText('Moussa Traoré');
    screen.getByText('m@ex.ml');
    screen.getByText('Très rapide');
    screen.getByText('4.3');
    screen.getByText('3 avis enregistrés');
    // Avis sans colis ni compte : tirets et « Sans commentaire », pas de plantage.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    screen.getByText('Sans commentaire');
    expect(reseau.appels[0]).toMatchObject({ methode: 'GET', url: '/admin/avis', params: { page: 1, limit: 20 } });
  });

  it('filtre par note envoyé au back (`note`)', async () => {
    rendreEcran(<AvisPage />);
    await screen.findByText('NAN-500');
    const boutonsNote = screen.getAllByRole('button').filter((b) => b.textContent?.trim() === '4');
    fireEvent.click(boutonsNote[0]);
    await waitFor(() => expect(reseau.dernier().params).toEqual({ page: 1, limit: 20, note: 4 }));
  });
});
