import { describe, it, expect, beforeEach } from 'vitest';
import { api } from './axios';
import { authApi } from './auth';
import { intercepter } from '@/test/axiosFactice';

/**
 * Contrat de `authApi` avec le back (routes/auth.route.js, account.route.js,
 * admin/adminAuth.route.js et leurs schémas Joi). Le middleware de validation
 * RETIRE les clés inconnues : un champ mal nommé ne produit pas une erreur
 * claire mais un 400 « Données invalides ». Rend impossible : un login sans
 * `identifiant`, un changement de mot de passe envoyé sous
 * ancienMotDePasse/nouveauMotDePasse, un refresh token perdu au login.
 */
describe('authApi', () => {
  let reseau: ReturnType<typeof intercepter>;
  beforeEach(() => {
    reseau = intercepter(api, () => ({ data: {} }));
  });

  it('login : POST /auth/login { identifiant, mot_de_passe } et relit token + refreshToken + utilisateur', async () => {
    reseau = intercepter(api, () => ({
      data: { token: 'jwt', refreshToken: 'rt', utilisateur: { id: 'a1', role: 'Admin' } },
    }));
    const res = await authApi.login({ identifiant: 'admin@nanei.com', mot_de_passe: 'Secret123' });
    expect(reseau.dernier()).toMatchObject({
      methode: 'POST', url: '/auth/login', corps: { identifiant: 'admin@nanei.com', mot_de_passe: 'Secret123' },
    });
    expect(res.data).toMatchObject({ token: 'jwt', refreshToken: 'rt', utilisateur: { role: 'Admin' } });
  });

  it('logout : POST /auth/logout { refreshToken } (révocation côté back)', async () => {
    await authApi.logout('rt-1');
    expect(reseau.dernier()).toMatchObject({ methode: 'POST', url: '/auth/logout', corps: { refreshToken: 'rt-1' } });
  });

  it('me : GET /account/me, utilisateur sous `utilisateur`', async () => {
    reseau = intercepter(api, () => ({ data: { utilisateur: { id: 'a1' } } }));
    const res = await authApi.me();
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/account/me' });
    expect(res.data.utilisateur.id).toBe('a1');
  });

  it('updateProfile : PUT /account/modifier-profil avec les champs du schéma modifierProfilSchema', async () => {
    await authApi.updateProfile({ nom: 'Ba', prenom: 'Awa', telephone: '', adresse: 'Bamako' });
    expect(reseau.dernier()).toMatchObject({
      methode: 'PUT', url: '/account/modifier-profil', corps: { nom: 'Ba', prenom: 'Awa', telephone: '', adresse: 'Bamako' },
    });
  });

  it('changePassword : traduit vers { oldPassword, newPassword } (changePasswordSchema)', async () => {
    reseau = intercepter(api, () => ({ data: { message: 'ok', token: 't2', refreshToken: 'r2' } }));
    const res = await authApi.changePassword({ ancienMotDePasse: 'Ancien123', nouveauMotDePasse: 'Nouveau123' });
    const appel = reseau.dernier();
    expect(appel).toMatchObject({ methode: 'PUT', url: '/account/change-password' });
    expect(appel.corps).toEqual({ oldPassword: 'Ancien123', newPassword: 'Nouveau123' });
    // Le back renvoie de NOUVEAUX jetons (les anciens sont révoqués).
    expect(res.data).toMatchObject({ token: 't2', refreshToken: 'r2' });
  });

  it('adminForgotPassword : POST /admin/forgot-password { email }', async () => {
    await authApi.adminForgotPassword('admin@nanei.com');
    expect(reseau.dernier()).toMatchObject({ methode: 'POST', url: '/admin/forgot-password', corps: { email: 'admin@nanei.com' } });
  });

  it('adminResetPassword : POST /admin/reset-password { token, mot_de_passe } (adminAuth.controller.js)', async () => {
    await authApi.adminResetPassword({ token: 'tok', mot_de_passe: 'Nouveau123' });
    expect(reseau.dernier()).toMatchObject({
      methode: 'POST', url: '/admin/reset-password', corps: { token: 'tok', mot_de_passe: 'Nouveau123' },
    });
  });
});
