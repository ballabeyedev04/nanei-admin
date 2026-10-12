import { AlertCircle } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Affiché quand le chargement d'une liste échoue (500, 429, réseau…).
 * Avant, l'écran montrait une liste vide (« Aucun colis », « 0 avis ») :
 * on ne distinguait pas une panne d'une absence de données.
 */
export function ErreurChargement({ erreur, onRetry }: { erreur?: unknown; onRetry?: () => void }) {
  const reponse = (erreur as any)?.response;
  const detail =
    reponse?.status === 429
      ? 'Trop de requêtes : réessayez dans quelques minutes.'
      : reponse?.data?.message ?? (reponse ? `Erreur ${reponse.status}` : 'Serveur injoignable ou délai dépassé.');

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
        <AlertCircle size={22} className="text-red-500" />
      </div>
      <p className="text-sm font-semibold text-gray-800">Impossible de charger les données</p>
      <p className="text-xs text-gray-400 max-w-sm">{String(detail)}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 px-4 py-2 rounded-xl bg-[#FF7A00] text-white text-sm font-bold hover:bg-[#e06900] transition-colors"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
