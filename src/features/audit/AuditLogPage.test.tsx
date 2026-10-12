import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '@/api/axios';
import { intercepter } from '@/test/axiosFactice';
import { rendreEcran } from '@/test/rendu';
import AuditLogPage from './AuditLogPage';

/**
 * Journal d'audit, branché sur la réponse RÉELLE du back
 * (routes/admin/auditlog.route.js). Rend impossible : des filtres envoyés en
 * camelCase (ignorés par le back, qui lit admin_id / date_debut / date_fin),
 * une action saisie en minuscules qui ne trouve rien (le back compare à
 * l'identique des valeurs en MAJUSCULES : UPDATE_STATUT…), une ligne sans
 * admin (compte supprimé) qui ferait planter l'écran.
 */
let reseau: ReturnType<typeof intercepter>;
const appelsJournal = () => reseau.appels.filter((a) => a.url === '/admin/audit-logs');

beforeEach(() => {
  reseau = intercepter(api, (config) => {
    if (config.url === '/admin/liste-admins') return { data: { success: true, data: [{ id: 'a2', nom: 'Sy', prenom: 'Ali', role: 'Admin' }] } };
    return {
      data: {
        success: true, total: 1, page: 1, pages: 1,
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
        logs: [{
          id: 'l1', admin_id: null, admin: null, action: 'UPDATE_STATUT', entite: 'Colis',
          entite_id: '11111111-2222-3333-4444-555566667777', details: { statut: 'livre' }, ip_address: null,
          createdAt: '2026-10-11T09:30:00.000Z',
        }],
      },
    };
  });
});

describe('AuditLogPage', () => {
  it('rend une entrée sans admin (compte supprimé) sans planter', async () => {
    rendreEcran(<AuditLogPage />);
    await screen.findByText('UPDATE_STATUT');
    screen.getByText('66667777');
    expect(appelsJournal()[0].params).toEqual({ page: 1, limit: 20 });
  });

  it('action saisie en minuscules : envoyée en MAJUSCULES (valeurs du back)', async () => {
    rendreEcran(<AuditLogPage />);
    await screen.findByText('UPDATE_STATUT');
    fireEvent.change(screen.getByPlaceholderText('Ex: UPDATE_STATUT'), { target: { value: ' update_statut ' } });
    await waitFor(() => expect(appelsJournal().at(-1)?.params).toEqual({ page: 1, limit: 20, action: 'UPDATE_STATUT' }), { timeout: 2000 });
  });

  it('filtres admin et dates envoyés sous admin_id, date_debut, date_fin', async () => {
    const { container } = rendreEcran(<AuditLogPage />);
    await screen.findByText('UPDATE_STATUT');
    await screen.findByRole('option', { name: 'Ali Sy' });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a2' } });
    const [debut, fin] = Array.from(container.querySelectorAll('input[type="date"]'));
    fireEvent.change(debut, { target: { value: '2026-10-01' } });
    fireEvent.change(fin, { target: { value: '2026-10-11' } });
    await waitFor(() => expect(appelsJournal().at(-1)?.params).toEqual({
      page: 1, limit: 20, admin_id: 'a2', date_debut: '2026-10-01', date_fin: '2026-10-11',
    }));
  });
});
