import { vi } from 'vitest';
import { AxiosError, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

/**
 * Adaptateur axios factice : remplace la couche réseau d'une instance (ou des
 * valeurs par défaut d'axios) sans toucher aux intercepteurs. Aucune requête
 * ne quitte le test ; chaque appel est enregistré (verbe, chemin, paramètres,
 * corps) pour être comparé à ce que le back attend réellement.
 */
export interface ReponseFactice {
  status?: number;
  data?: unknown;
}

export type Repondeur = (config: InternalAxiosRequestConfig) => ReponseFactice | Promise<ReponseFactice>;

export interface Appel {
  methode: string;
  url: string;
  params: unknown;
  corps: unknown;
  config: InternalAxiosRequestConfig;
}

/** Corps tel qu'envoyé : JSON relu en objet, FormData et vide laissés tels quels. */
function lireCorps(data: unknown): unknown {
  if (typeof data !== 'string') return data;
  try { return JSON.parse(data); } catch { return data; }
}

export function creerAdaptateur(repondre: Repondeur = () => ({ data: {} })) {
  const appels: Appel[] = [];
  const adaptateur = vi.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    appels.push({
      methode: String(config.method).toUpperCase(),
      url: String(config.url),
      params: config.params,
      corps: lireCorps(config.data),
      config,
    });
    const { status = 200, data = {} } = await repondre(config);
    const reponse: AxiosResponse = { status, statusText: String(status), data, headers: {}, config, request: {} };
    if (status >= 400) {
      throw new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_RESPONSE, config, {}, reponse);
    }
    return reponse;
  });
  return { adaptateur, appels, dernier: () => appels[appels.length - 1] };
}

/** Branche l'adaptateur factice sur une instance axios (ex. `api`). */
export function intercepter(instance: AxiosInstance, repondre?: Repondeur) {
  const f = creerAdaptateur(repondre);
  instance.defaults.adapter = f.adaptateur;
  return f;
}

/** Erreur réseau (aucune réponse) telle qu'axios la produit. */
export function erreurReseau(config: InternalAxiosRequestConfig) {
  return new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {});
}
