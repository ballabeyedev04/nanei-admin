import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  /** Refresh token (7 jours) : sert à renouveler `token` (1 h) sans reconnexion. */
  refreshToken: string | null;
  setAuth:         (user: User, token: string, refreshToken?: string | null) => void;
  setTokens:       (token: string, refreshToken: string) => void;
  setUser:         (user: User) => void;
  logout:          () => void;
  clearAuth:       () => void;
  isAuthenticated: () => boolean;
  isAdmin:         () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:  null,
      token: null,
      refreshToken: null,

      setAuth: (user, token, refreshToken = null) => set({ user, token, refreshToken }),

      // Après POST /auth/refresh : le back fait tourner le refresh token
      // (l'ancien est révoqué), il faut toujours garder le nouveau.
      setTokens: (token, refreshToken) => set({ token, refreshToken }),

      setUser: (user) => set({ user }),

      logout: () => set({ user: null, token: null, refreshToken: null }),

      // Utilisé par les guards pour nettoyer sans effets de bord
      clearAuth: () => set({ user: null, token: null, refreshToken: null }),

      isAuthenticated: () => !!get().token && !!get().user,

      // Vérifie que l'utilisateur est connecté ET qu'il est Admin
      isAdmin: () => !!get().token && get().user?.role === 'Admin',
    }),
    {
      name: 'nanei-admin-auth',
      partialize: (state) => ({ user: state.user, token: state.token, refreshToken: state.refreshToken }),
    }
  )
);
