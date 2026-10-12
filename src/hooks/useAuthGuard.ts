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
  // Sans aucun jeton, il n'y a rien à vérifier : pas d'état « vérification »
  // (avant : true puis false aussitôt dans l'effet, soit un rendu en cascade).
  const [checking, setChecking] = useState(() => Boolean(token || useAuthStore.getState().refreshToken));

  useEffect(() => {
    if (!checking) return;

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

    // Vérification UNE seule fois, au montage du garde : la relancer à chaque
    // changement de jeton (renouvellement automatique) referait un appel
    // /account/me et réafficherait le spinner en pleine navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { checking };
}
