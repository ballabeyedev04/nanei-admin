import { api } from './axios';
import type { LoginPayload, User } from '@/types';

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<{ token: string; utilisateur: User }>('/auth/login', payload),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),

  me: () =>
    api.get<{ utilisateur: User }>('/account/me'),

  updateProfile: (data: { nom?: string; prenom?: string; telephone?: string; adresse?: string }) =>
    api.put('/account/modifier-profil', data),

  changePassword: (data: { ancienMotDePasse: string; nouveauMotDePasse: string }) =>
    api.put('/account/change-password', data),

  /** Demande de réinitialisation de mot de passe admin (envoie l'email) */
  adminForgotPassword: (email: string) =>
    api.post<{ success: boolean; message: string }>('/admin/forgot-password', { email }),

  /** Réinitialisation effective avec le token reçu par email */
  adminResetPassword: (data: { token: string; mot_de_passe: string }) =>
    api.post<{ success: boolean; message: string }>('/admin/reset-password', data),
};
