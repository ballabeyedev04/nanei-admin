import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth:         (user: User, token: string) => void;
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

      setAuth: (user, token) => set({ user, token }),

      setUser: (user) => set({ user }),

      logout: () => set({ user: null, token: null }),

      // Utilisé par les guards pour nettoyer sans effets de bord
      clearAuth: () => set({ user: null, token: null }),

      isAuthenticated: () => !!get().token && !!get().user,

      // Vérifie que l'utilisateur est connecté ET qu'il est Admin
      isAdmin: () => !!get().token && get().user?.role === 'Admin',
    }),
    {
      name: 'nanei-admin-auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
