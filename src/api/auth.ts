import { api } from './axios';
import type { LoginPayload, User } from '@/types';

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<{ token: string; refreshToken: string; utilisateur: User }>('/auth/login', payload),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),

  me: () =>
    api.get<{ utilisateur: User }>('/account/me'),

  updateProfile: (data: { nom?: string; prenom?: string; telephone?: string; adresse?: string }) =>
    // Selon la version du back, l'utilisateur à jour est dans `utilisateur` ou `user`.
    api.put<{ utilisateur?: User; user?: User }>('/account/modifier-profil', data),

  // Le backend attend { oldPassword, newPassword } (voir changePasswordSchema).
  // Le middleware de validation retire les clés inconnues : envoyer
  // ancienMotDePasse/nouveauMotDePasse produisait un 400 « Données invalides ».
  changePassword: (data: { ancienMotDePasse: string; nouveauMotDePasse: string }) =>
    api.put<{ message: string; token: string; refreshToken: string }>('/account/change-password', {
      oldPassword: data.ancienMotDePasse,
      newPassword: data.nouveauMotDePasse,
    }),

  /** Demande de réinitialisation de mot de passe admin (envoie l'email) */
  adminForgotPassword: (email: string) =>
    api.post<{ success: boolean; message: string }>('/admin/forgot-password', { email }),

  /** Réinitialisation effective avec le token reçu par email */
  adminResetPassword: (data: { token: string; mot_de_passe: string }) =>
    api.post<{ success: boolean; message: string }>('/admin/reset-password', data),
};
