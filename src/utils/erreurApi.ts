/**
 * Forme (partielle) d'une erreur d'appel API telle qu'axios la produit :
 * `response` n'existe que si le serveur a répondu (sinon : réseau, délai).
 *
 * Tous les champs sont facultatifs : une `Error` ordinaire (levée avant
 * l'appel, ou par react-query) est aussi une `ErreurApi` valide, ce qui permet
 * de typer directement les `onError` de `useMutation`.
 */
export interface ErreurApi {
  message?: string;
  code?: string;
  response?: {
    status?: number;
    data?: CorpsErreurApi;
  };
}

/** Corps JSON d'une réponse d'erreur du back : `{ message, details? }`. */
export interface CorpsErreurApi {
  message?: string;
  /** 400 de validation (Joi) : liste des raisons précises. */
  details?: unknown;
}

/**
 * Convertit une valeur levée (bloc `catch`, de type `unknown`) en `ErreurApi`.
 * Une valeur qui n'est pas un objet (chaîne, null…) donne un objet vide :
 * chaque champ lu vaut alors `undefined`, comme avec l'ancien `err?.champ`.
 */
export function erreurApi(err: unknown): ErreurApi {
  return typeof err === 'object' && err !== null ? (err as ErreurApi) : {};
}
