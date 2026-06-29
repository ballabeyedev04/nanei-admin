import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { avisApi } from '@/api/avis';
import { PageSpinner } from '@/components/ui/Spinner';
import { formatDate } from '@/utils/format';
import type { Avis, AvisStats } from '@/types';

/* ── Composant étoiles ─────────────────────────────────────────────── */
function Stars({ note, size = 14 }: { note: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= note ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  );
}

/* ── Stats distribution ────────────────────────────────────────────── */
function DistributionBar({ note, count, total }: { note: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1 w-12 justify-end flex-shrink-0">
        <span className="text-xs font-bold text-gray-600">{note}</span>
        <Star size={11} className="text-amber-400 fill-amber-400" />
      </div>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 font-medium w-10 flex-shrink-0">{pct}%</span>
      <span className="text-xs text-gray-300 font-medium w-6 flex-shrink-0">{count}</span>
    </div>
  );
}

/* ── Page principale ─────────────────────────────────────────────── */
export default function AvisPage() {
  const [filterNote, setFilterNote] = useState<number | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ['avis', filterNote],
    queryFn: async () => {
      const res = await avisApi.list(filterNote);
      const raw = res.data as any;
      const avis: Avis[]      = raw.data ?? raw.avis ?? [];
      const rawStats = raw.stats ?? {};
      const stats: AvisStats  = { moyenne: rawStats.note_moyenne ?? rawStats.moyenne ?? 0, total: rawStats.total ?? avis.length, distribution: rawStats.distribution ?? {} };
      return { avis, stats };
    },
  });

  const avis:  Avis[]     = data?.avis   ?? [];
  const stats: AvisStats  = data?.stats  ?? { moyenne: 0, total: 0, distribution: {} };

  return (
    <div className="space-y-7">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Avis clients</h1>
        <p className="text-gray-400 text-sm mt-0.5">{stats.total} avis enregistré{stats.total > 1 ? 's' : ''}</p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Note globale */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] p-6 flex flex-col items-center justify-center gap-2">
          <p className="text-[56px] font-extrabold text-gray-900 leading-none">{(stats.moyenne ?? 0).toFixed(1)}</p>
          <Stars note={Math.round(stats.moyenne ?? 0)} size={20} />
          <p className="text-sm text-gray-400 font-medium">{stats.total} avis au total</p>
        </div>

        {/* Distribution */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Distribution des notes</p>
          <div className="space-y-2.5">
            {[5, 4, 3, 2, 1].map((n) => (
              <DistributionBar
                key={n}
                note={n}
                count={stats.distribution[n] ?? 0}
                total={stats.total}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Filtres par note */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterNote(undefined)}
          className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all active:scale-95 ${
            filterNote === undefined
              ? 'bg-[#FF7A00] text-white border-[#FF7A00] shadow-lg shadow-[#FF7A00]/25'
              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          Tous
        </button>
        {[5, 4, 3, 2, 1].map((n) => (
          <button
            key={n}
            onClick={() => setFilterNote(n)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all active:scale-95 ${
              filterNote === n
                ? 'bg-[#FF7A00] text-white border-[#FF7A00] shadow-lg shadow-[#FF7A00]/25'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {n} <Star size={12} className={filterNote === n ? 'text-white fill-white' : 'text-amber-400 fill-amber-400'} />
          </button>
        ))}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] overflow-hidden">
        {isLoading ? <PageSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100">
                  {['Référence colis', 'Client', 'Note', 'Commentaire', 'Date'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {avis.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-14 text-center">
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                          <Star size={22} className="text-gray-300" />
                        </div>
                        <p className="text-sm text-gray-400 font-medium">Aucun avis</p>
                      </div>
                    </td>
                  </tr>
                ) : avis.map((a: Avis) => (
                  <tr key={a.id} className="hover:bg-[#FFF9F5] transition-colors duration-150">
                    <td className="px-5 py-4">
                      <span className="text-sm font-bold text-[#FF7A00]">{a.colisReference}</span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">{a.client.prenom} {a.client.nom}</p>
                    </td>
                    <td className="px-5 py-4">
                      <Stars note={a.note} />
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600 max-w-xs">
                      {a.commentaire ? (
                        <span className="line-clamp-2">{a.commentaire}</span>
                      ) : (
                        <span className="text-gray-300 italic">Sans commentaire</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400 whitespace-nowrap">{formatDate(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
