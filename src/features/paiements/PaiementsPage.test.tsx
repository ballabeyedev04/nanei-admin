import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import { api } from '@/api/axios';
import { intercepter, type ReponseFactice } from '@/test/axiosFactice';
import { rendreEcran } from '@/test/rendu';
import PaiementsPage from './PaiementsPage';

/**
 * Écran « Paiements » alimenté par les réponses RÉELLES du back
 * (services/admin/paiement.service.js, tauxChange.service.js). Les montants
 * du back sont en EUROS (prix du colis) ; le montant débité chez Wave /
 * Orange Money est en FCFA = euros × taux de change. Rend impossible : des
 * euros affichés comme des FCFA (ou l'inverse), un équivalent FCFA calculé
 * avec un taux codé en dur alors que l'admin l'a modifié, un filtre de statut
 * ignoré par le back.
 */
vi.mock('@/utils/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn(), notifyInfo: vi.fn() }));
vi.mock('@/utils/confirm', () => ({ confirmAction: vi.fn().mockResolvedValue(true) }));

/** Espaces insécables (Intl fr-FR) ramenés à des espaces simples. */
const normaliser = (s: string | null | undefined) => (s ?? '').replace(/[\u00a0\u202f]/g, ' ');

const paiementBack = {
  id: 'p1', colisId: 'c1', payeurId: 'u1',
  prixTotal: 12.5, montantPaye: 12.5, moyenPaiement: 'wave', statut: 'paye',
  referenceTransaction: 'WAVE-1', checkoutUrl: null,
  createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:05:00.000Z',
  colis: { id: 'c1', reference: 'NAN-321', poids: 3, destination: 'Dakar', type_colis: 'Vêtements', statut: 'livre' },
  payeur: { id: 'u1', nom: 'Sow', prenom: 'Aminata', email: 'a@ex.sn', telephone: '+221770000000' },
};

let taux: ReponseFactice;
let reseau: ReturnType<typeof intercepter>;
beforeEach(() => {
  vi.clearAllMocks();
  taux = { data: { data: [{ id: 't1', devise_source: 'EUR', devise_cible: 'FCFA', valeur: 656 }] } };
  reseau = intercepter(api, (config) => {
    if (config.url === '/admin/paiements/stats') {
      return { data: { success: true, data: { total: 4, paye: 1, enAttente: 1, enCours: 1, echoue: 1, rembourse: 0, montantTotal: 100 } } };
    }
    if (config.url === '/admin/taux-change') return taux;
    if (config.method === 'put') return { data: { success: true } };
    return { data: { success: true, data: [paiementBack], pagination: { page: 1, limit: 20, total: 1, pages: 1 } } };
  });
});

describe('PaiementsPage', () => {
  it('montants en euros avec l’équivalent FCFA au taux du back', async () => {
    rendreEcran(<PaiementsPage />);
    const ligne = (await screen.findByText('NAN-321')).closest('tr') as HTMLElement;
    const texte = normaliser(ligne.textContent);
    // 12,50 € × 656 = 8 200 FCFA
    expect(texte).toContain('12,50 €');
    expect(texte).toContain('≈ 8 200 FCFA');
    within(ligne).getByText('Wave');
    within(ligne).getByText('Aminata Sow');
  });

  it('KPI « Montant encaissé » : euros + FCFA, en attente = en_attente + en_cours', async () => {
    rendreEcran(<PaiementsPage />);
    await screen.findByText('NAN-321');
    await waitFor(() => expect(normaliser(document.body.textContent)).toContain('≈ 65 600 FCFA'));
    expect(normaliser(document.body.textContent)).toContain('100,00 €');
    const carteAttente = screen.getByText('En attente', { selector: 'p' }).parentElement as HTMLElement;
    within(carteAttente).getByText('2');
  });

  it('taux indisponible : repli sur la parité fixe 655,957', async () => {
    taux = { status: 500, data: { message: 'Erreur serveur' } };
    rendreEcran(<PaiementsPage />);
    const ligne = (await screen.findByText('NAN-321')).closest('tr') as HTMLElement;
    // 12,50 × 655,957 = 8 199,46 → 8 199
    await waitFor(() => expect(normaliser(ligne.textContent)).toContain('≈ 8 199 FCFA'));
  });

  it('filtre de statut et requête paginée envoyés au back', async () => {
    rendreEcran(<PaiementsPage />);
    await screen.findByText('NAN-321');
    const liste = () => reseau.appels.filter((a) => a.url === '/admin/paiements');
    expect(liste()[0].params).toEqual({ page: 1, limit: 20 });
    fireEvent.click(screen.getByRole('button', { name: 'Remboursé' }));
    await waitFor(() => expect(liste().at(-1)?.params).toEqual({ page: 1, limit: 20, statut: 'rembourse' }));
  });
});
