import axios, { type AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';
import logger from '@/lib/logger';
import { erreurApi } from '@/utils/erreurApi';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/nanei';

const LOGIN_URL = '/nanei/admin/login';

// Routes publiques exemptées du renouvellement et de la redirection
// (ex: le login lui-même ne doit pas se rediriger en boucle)
const PUBLIC_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout', '/admin/forgot-password', '/admin/reset-password'];

// 403 qui signifient « session refusée » (compte désactivé, rôle non admin).
// Les autres 403 sont des refus métier : on affiche l'erreur sans déconnecter.
const MESSAGES_403_SESSION = /désactivé|desactive|accès refusé|acces refuse/i;

let redirecting = false; // anti-boucle : une seule redirection à la fois

function forceLogout() {
  if (redirecting) return;
  redirecting = true;
  useAuthStore.getState().clearAuth();
  window.location.replace(LOGIN_URL);
}

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
  timeout: 15_000, // 15s — évite les requêtes suspendues indéfiniment
});

// Client SANS intercepteur, réservé au renouvellement du jeton : un 401 sur
// /auth/refresh ne doit jamais relancer un renouvellement (boucle).
const refreshClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// ── Session partagée entre onglets ────────────────────────────────────────
// Le store est persisté dans localStorage (clé nanei-admin-auth), commun à
// tous les onglets. Le back fait TOURNER le refresh token : dès qu'un onglet
// renouvelle, l'ancien refresh token est révoqué. Sans synchronisation, les
// autres onglets envoyaient ce jeton révoqué, recevaient 401 et déconnectaient
// tout le monde.
const CLE_STOCKAGE = 'nanei-admin-auth';

function relireSession(): Promise<void> {
  return Promise.resolve(useAuthStore.persist.rehydrate());
}

if (typeof window !== 'undefined') {
  // Un autre onglet a renouvelé la session, s'est connecté ou déconnecté.
  window.addEventListener('storage', (e) => {
    if (e.key === CLE_STOCKAGE) void relireSession();
  });
}

// Un seul renouvellement à la fois dans cet onglet (requêtes en échec
// regroupées sur la même promesse)…
let refreshEnCours: Promise<string | null> | null = null;

async function renouvelerSansConcurrence(jetonEchoue: string | null): Promise<string | null> {
  // Un autre onglet a peut-être déjà renouvelé pendant que la requête échouait.
  await relireSession();
  const actuel = useAuthStore.getState();
  if (actuel.token && actuel.token !== jetonEchoue) return actuel.token;

  const refreshToken = actuel.refreshToken;
  if (!refreshToken) return null;

  try {
    const res = await refreshClient.post<{ token: string; refreshToken: string }>('/auth/refresh', { refreshToken });
    const { token, refreshToken: nouveau } = res.data;
    if (!token || !nouveau) return null;
    useAuthStore.getState().setTokens(token, nouveau);
    logger.debug('Jeton admin renouvelé');
    return token;
  } catch (err) {
    const status = erreurApi(err).response?.status;
    logger.warn('Renouvellement du jeton refusé', { status });
    if (status === 400 || status === 401) {
      // Refus : peut-être parce qu'un autre onglet vient de faire tourner le
      // refresh token. On relit avant de conclure que la session est morte.
      await relireSession();
      const apres = useAuthStore.getState();
      if (apres.refreshToken && apres.refreshToken !== refreshToken && apres.token) return apres.token;
      return null;
    }
    // Réseau, 429, 5xx : impossible de conclure, la session est conservée.
    throw err;
  }
}

/**
 * Renouvelle le jeton d'accès. Renvoie le nouveau jeton, ou null si la
 * session est morte. …et un seul renouvellement à la fois entre ONGLETS,
 * via un verrou du navigateur (Web Locks) quand il est disponible.
 */
export function renouvelerJeton(jetonEchoue: string | null = useAuthStore.getState().token): Promise<string | null> {
  if (refreshEnCours) return refreshEnCours;

  // Web Locks absent de certains navigateurs (et de jsdom) : d'où le type élargi.
  const verrous: LockManager | undefined = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const tache = verrous?.request
    // lib.dom type le résultat Promise<Promise<…>> (il est en réalité aplati) ;
    // Promise.resolve rend le bon type et renvoie la même promesse native.
    ? Promise.resolve(verrous.request('nanei-admin-refresh', () => renouvelerSansConcurrence(jetonEchoue)))
    : renouvelerSansConcurrence(jetonEchoue);

  refreshEnCours = tache.finally(() => {
    refreshEnCours = null;
  });
  return refreshEnCours;
}

// Injecter le token sur chaque requête
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (!import.meta.env.PROD) {
    logger.debug(`→ ${config.method?.toUpperCase()} ${config.url}`);
  }
  return config;
}, (error) => {
  logger.error('Erreur configuration requête', { message: error.message });
  return Promise.reject(error);
});

type ConfigRejouable = AxiosRequestConfig & { _rejoue?: boolean };

// Intercepteur de réponse
api.interceptors.response.use(
  (res) => {
    if (!import.meta.env.PROD) {
      logger.debug(`← ${res.status} ${res.config.url}`);
    }
    return res;
  },
  async (error) => {
    const status  = error.response?.status;
    const config  = (error.config ?? {}) as ConfigRejouable;
    const url     = config.url ?? '';
    const message = error.response?.data?.message || error.message;
    const isPublic = PUBLIC_PATHS.some((p) => url.includes(p));

    // 401 : jeton d'accès expiré (1 h) → renouvellement puis nouvel essai,
    // une seule fois par requête. Avant : déconnexion directe au bout d'1 h.
    if (status === 401 && !isPublic && !config._rejoue) {
      config._rejoue = true;
      // Jeton avec lequel la requête a échoué (pour détecter qu'un autre
      // onglet a déjà renouvelé la session).
      const entete = String(config.headers?.Authorization ?? '');
      const jetonEchoue = entete.startsWith('Bearer ') ? entete.slice(7) : null;
      let nouveauJeton: string | null;
      try {
        nouveauJeton = await renouvelerJeton(jetonEchoue);
      } catch (erreurRenouvellement) {
        // Renouvellement impossible pour l'instant (réseau, 429, 5xx) : on
        // remonte CETTE erreur (et non le 401 d'origine), pour que l'écran et
        // useAuthGuard ne la prennent pas pour une session morte.
        return Promise.reject(erreurRenouvellement);
      }
      if (nouveauJeton) {
        // L'intercepteur de requête remet le nouveau jeton dans l'en-tête.
        return api.request(config);
      }
      logger.warn('Session expirée', { url });
      forceLogout();
      return Promise.reject(error);
    }

    if (!isPublic && status === 401) {
      logger.warn('Session expirée', { url });
      forceLogout();
    } else if (!isPublic && status === 403 && MESSAGES_403_SESSION.test(String(message))) {
      // Compte désactivé ou rôle retiré : la session n'est plus valable.
      logger.warn('Session refusée par le serveur', { url, status, message });
      forceLogout();
    } else if (status >= 500) {
      logger.error('Erreur serveur', { url, status, message });
    } else if (status >= 400) {
      // 402, 403 métier, 404, 409… : erreur affichée par l'écran, pas de déconnexion.
      logger.warn('Erreur client', { url, status, message });
    } else if (!error.response) {
      // Timeout ou pas de réseau : l'écran affiche l'erreur. On ne déconnecte
      // plus (avant, un délai dépassé faisait perdre la saisie en cours).
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
      logger.error(isTimeout ? 'Délai dépassé' : 'Erreur réseau', { url, code: error.code, message });
    }

    return Promise.reject(error);
  }
);
