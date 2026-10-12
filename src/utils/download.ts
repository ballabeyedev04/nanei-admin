import { erreurApi, type CorpsErreurApi } from './erreurApi';

/**
 * Déclenche le téléchargement d'un Blob reçu depuis l'API.
 *
 * L'URL temporaire est libérée APRÈS le clic (tâche suivante) : révoquée dans
 * la foulée, certains navigateurs (Safari, Firefox) annulaient le
 * téléchargement avant qu'il ne démarre.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Message d'erreur d'un téléchargement (`responseType: 'blob'`). En mode blob,
 * le corps JSON de l'erreur (`{ message }`) arrive lui aussi en Blob : il faut
 * le lire pour afficher la vraie raison au lieu d'un texte fixe.
 */
export async function messageErreurTelechargement(err: unknown, parDefaut: string): Promise<string> {
  const reponse = erreurApi(err).response;
  // En mode blob, le corps est un Blob ; sinon l'objet JSON { message }.
  const corps: Blob | CorpsErreurApi | undefined = reponse?.data;
  try {
    if (corps instanceof Blob) {
      const texte = await corps.text();
      const json = JSON.parse(texte);
      if (json?.message) return String(json.message);
    } else if (corps?.message) {
      return String(corps.message);
    }
  } catch {
    // corps illisible : message par défaut
  }
  if (reponse?.status === 429) return 'Trop de requêtes. Réessayez dans quelques minutes.';
  if (!reponse) return `${parDefaut} (serveur injoignable ou délai dépassé)`;
  return parDefaut;
}
