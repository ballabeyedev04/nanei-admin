import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '@/api/axios';
import { intercepter } from '@/test/axiosFactice';
import { rendreEcran } from '@/test/rendu';
import { useAuthStore } from '@/store/authStore';
import { notifyError } from '@/utils/notify';
import LoginPage from './LoginPage';

/**
 * Écran de connexion admin, branché sur la réponse RÉELLE de POST /auth/login
 * (controllers/auth.controller.js : `{ token, refreshToken, utilisateur }`).
 * Rend impossible : un refresh token jeté à la connexion (session coupée au
 * bout d'1 h, aucun renouvellement possible), un compte « Particulier »
 * admis dans le back-office, un identifiant envoyé sous un autre nom que
 * `identifiant` (schéma Joi loginSchema : 400 « Données invalides »).
 */
// Le routeur réel importe tous les écrans : seules les routes sont utiles ici.
vi.mock('@/router', () => ({ PATHS: { DASHBOARD: '/nanei/admin/dashboard', FORGOT_PASSWORD: '/nanei/admin/forgot-password' } }));
vi.mock('@/utils/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn(), notifyInfo: vi.fn() }));

const ADMIN = { id: 'a1', nom: 'Ba', prenom: 'Awa', email: 'awa@nanei.com', role: 'Admin', statut: 'actif' };

const remplirEtEnvoyer = () => {
  fireEvent.change(screen.getByPlaceholderText('admin@nanei.com'), { target: { value: 'awa@nanei.com' } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'Secret123' } });
  fireEvent.submit(screen.getByPlaceholderText('admin@nanei.com').closest('form') as HTMLFormElement);
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().clearAuth();
});

describe('LoginPage', () => {
  it('connexion admin : token ET refreshToken enregistrés (store et stockage persistant)', async () => {
    const reseau = intercepter(api, () => ({ data: { token: 'jwt-acces', refreshToken: 'jwt-refresh', utilisateur: ADMIN } }));
    rendreEcran(<LoginPage />);
    remplirEtEnvoyer();

    await waitFor(() => expect(useAuthStore.getState().token).toBe('jwt-acces'));
    expect(useAuthStore.getState()).toMatchObject({ refreshToken: 'jwt-refresh', user: { id: 'a1', role: 'Admin' } });
    const stocke = JSON.parse(window.localStorage.getItem('nanei-admin-auth') ?? '{}');
    expect(stocke.state).toMatchObject({ token: 'jwt-acces', refreshToken: 'jwt-refresh' });
    expect(reseau.dernier()).toMatchObject({
      methode: 'POST', url: '/auth/login', corps: { identifiant: 'awa@nanei.com', mot_de_passe: 'Secret123' },
    });
  });

  it('compte non admin : refusé, aucune session enregistrée', async () => {
    intercepter(api, () => ({ data: { token: 't', refreshToken: 'r', utilisateur: { ...ADMIN, role: 'Particulier' } } }));
    rendreEcran(<LoginPage />);
    remplirEtEnvoyer();
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Accès réservé aux administrateurs'));
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('identifiants refusés (400 du back) : son message est affiché', async () => {
    intercepter(api, () => ({ status: 400, data: { message: 'Identifiant ou mot de passe incorrect' } }));
    rendreEcran(<LoginPage />);
    remplirEtEnvoyer();
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Identifiant ou mot de passe incorrect'));
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('champs vides : aucun appel au back', async () => {
    const reseau = intercepter(api);
    rendreEcran(<LoginPage />);
    fireEvent.submit(screen.getByPlaceholderText('admin@nanei.com').closest('form') as HTMLFormElement);
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('Remplissez tous les champs'));
    expect(reseau.appels).toHaveLength(0);
  });
});
