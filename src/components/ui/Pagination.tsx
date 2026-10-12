import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Pagination as InfosPagination } from '@/types';

interface Props {
  pagination?: InfosPagination | null;
  onChange: (page: number) => void;
  /** Élément à faire remonter en haut de l'écran au changement de page (sinon : haut de la zone défilante). */
  ancre?: React.RefObject<HTMLElement | null>;
  /** Requête en cours (page suivante en chargement) : boutons désactivés. */
  chargement?: boolean;
  /** Filet au-dessus (sous un tableau). Désactiver quand la pagination est seule dans sa carte. */
  bordure?: boolean;
  className?: string;
}

/**
 * Pagination serveur : « Précédent » / « Suivant », « Page X sur Y · N résultats ».
 * Rien n'est affiché s'il n'y a aucun résultat.
 */
export function Pagination({ pagination, onChange, ancre, chargement = false, bordure = true, className = '' }: Props) {
  const racine = useRef<HTMLDivElement>(null);
  if (!pagination || pagination.total <= 0) return null;

  const pages = Math.max(1, pagination.pages);
  const page = Math.min(Math.max(1, pagination.page), pages);
  const premiere = page <= 1;
  const derniere = page >= pages;

  const aller = (cible: number) => {
    if (cible < 1 || cible > pages || cible === page) return;
    onChange(cible);
    if (ancre?.current) {
      ancre.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      const zone = racine.current?.closest('main');
      if (zone) zone.scrollTo({ top: 0, behavior: 'smooth' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const bouton =
    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold border transition-all duration-150 ' +
    'bg-white border-gray-200 text-gray-600 hover:border-[#FF7A00] hover:text-[#FF7A00] active:scale-95 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:text-gray-600 disabled:active:scale-100';

  return (
    <div
      ref={racine}
      className={`flex flex-wrap items-center justify-between gap-3 px-6 py-4 ${bordure ? 'border-t border-gray-100' : ''} ${className}`}
    >
      <p className="text-sm text-gray-500">
        Page <span className="font-bold text-gray-900">{page}</span> sur{' '}
        <span className="font-bold text-gray-900">{pages}</span>
        <span className="text-gray-300 mx-1.5">·</span>
        {pagination.total} résultat{pagination.total > 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => aller(page - 1)}
          disabled={premiere || chargement}
          className={bouton}
          aria-label="Page précédente"
        >
          <ChevronLeft size={15} />
          Précédent
        </button>
        <button
          type="button"
          onClick={() => aller(page + 1)}
          disabled={derniere || chargement}
          className={bouton}
          aria-label="Page suivante"
        >
          Suivant
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
