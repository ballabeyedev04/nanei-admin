import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/auth';

// Codes serveur qui invalident la session
const SESSION_INVALID_CODES = new Set([401, 402, 403]);

/**
 * Vérifie au montage que le token stocké est toujours valide côté serveur.
 * Gère : token expiré, rôle non-Admin, erreurs réseau, timeout.
 */
export function useAuthGuard() {
  const { token, clearAuth, setUser } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }

    authApi.me()
      .then((res) => {
        const utilisateur = res.data?.utilisateur;
        // Rôle non Admin → session invalide
        if (!utilisateur || utilisateur.role !== 'Admin') {
          clearAuth();
        } else {
          setUser(utilisateur); // rafraîchit les données depuis le serveur
        }
      })
      .catch((err) => {
        const status = err?.response?.status;
        // Toujours déconnecter si le serveur rejette la session
        if (!status || SESSION_INVALID_CODES.has(status) || status >= 500) {
          clearAuth();
        }
        // 404 sur /me = endpoint inconnu → déconnecter aussi
        if (status === 404) clearAuth();
      })
      .finally(() => setChecking(false));

  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { checking };
}
