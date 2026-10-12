import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/auth';

// Codes serveur qui invalident la session. Un 401 a déjà fait l'objet d'un
// renouvellement du jeton dans api/axios.ts : s'il revient ici, la session
// est vraiment morte.
const SESSION_INVALID_CODES = new Set([401, 403, 404]);

/**
 * Vérifie au montage que le token stocké est toujours valide côté serveur.
 * Gère : token expiré, rôle non-Admin, erreurs réseau, timeout.
 */
export function useAuthGuard() {
  const { token, clearAuth, setUser } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!token && !useAuthStore.getState().refreshToken) {
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
        // Déconnecter seulement si le serveur REJETTE la session. Serveur
        // injoignable ou en erreur (pas de réponse, 5xx) : on garde la
        // session, les appels suivants réessaieront.
        if (status && SESSION_INVALID_CODES.has(status)) clearAuth();
      })
      .finally(() => setChecking(false));

  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { checking };
}
