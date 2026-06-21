import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import logger from '@/lib/logger';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/nanei';

const LOGIN_URL = '/nanei/admin/login';

// Codes qui indiquent une session invalide ou expirée → redirection login
const AUTH_ERROR_CODES = new Set([401, 402, 403]);

// Routes publiques exemptées de la redirection automatique
// (ex: le login lui-même ne doit pas se rediriger en boucle)
const PUBLIC_PATHS = ['/auth/login', '/auth/refresh'];

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

// Intercepteur de réponse
api.interceptors.response.use(
  (res) => {
    if (!import.meta.env.PROD) {
      logger.debug(`← ${res.status} ${res.config.url}`);
    }
    return res;
  },
  (error) => {
    const status  = error.response?.status;
    const url     = error.config?.url ?? '';
    const message = error.response?.data?.message || error.message;
    const isPublic = PUBLIC_PATHS.some((p) => url.includes(p));

    if (!isPublic && status && AUTH_ERROR_CODES.has(status)) {
      logger.warn('Session expirée ou non autorisée', { url, status });
      forceLogout();
    } else if (status >= 500) {
      logger.error('Erreur serveur', { url, status, message });
    } else if (status >= 400) {
      logger.warn('Erreur client', { url, status, message });
    } else if (!error.response) {
      // Timeout ou pas de réseau → si l'utilisateur est connecté, on déconnecte aussi
      if (useAuthStore.getState().isAuthenticated()) {
        const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
        if (isTimeout) {
          logger.warn('Timeout — déconnexion forcée', { url, code: error.code });
          forceLogout();
        }
      }
      logger.error('Erreur réseau', { url, message });
    }

    return Promise.reject(error);
  }
);
