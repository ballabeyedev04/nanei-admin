import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { reclamationsApi } from '@/api/reclamations';
import { PageSpinner } from '@/components/ui/Spinner';
import logger from '@/lib/logger';
import { formatDate } from '@/utils/format';
import { notifySuccess, notifyError } from '@/utils/notify';
import type { Reclamation, StatutReclamation, TypeReclamation } from '@/types';

/* ── Config badges ─────────────────────────────────────────────────── */
const STATUT_CONFIG: Record<StatutReclamation, { label: string; color: string; bg: string; border: string }> = {
  ouverte:  { label: 'Ouverte',    color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200'    },
  en_cours: { label: 'En cours',   color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  resolue:  { label: 'Résolue',    color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200'},
  rejetee:  { label: 'Rejetée',    color: 'text-gray-600',   bg: 'bg-gray-100',  border: 'border-gray-200'   },
};

const TYPE_LABELS: Record<TypeReclamation, string> = {
  perdu:      'Colis perdu',
  endommage:  'Colis endommagé',
  retard:     'Retard de livraison',
  autre:      'Autre',
};

const FILTER_OPTIONS: { value: StatutReclamation | 'tous'; label: string }[] = [
  { value: 'tous',     label: 'Toutes'   },
  { value: 'ouverte',  label: 'Ouvertes' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'resolue',  label: 'Résolues' },
  { value: 'rejetee',  label: 'Rejetées' },
];

/* ── Badge statut ──────────────────────────────────────────────────── */
function StatutBadge({ statut }: { statut: StatutReclamation }) {
  const cfg = STATUT_CONFIG[statut];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

/* ── Galerie photos ────────────────────────────────────────────────── */
function PhotoGallery({ photos }: { photos: string[] }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (!photos || photos.length === 0) {
    return <p className="text-sm text-gray-400 italic">Aucune photo jointe</p>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-2">
        {photos.map((src, i) => (
          <button
            key={i}
            onClick={() => setLightbox(i)}
            className="w-20 h-20 rounded-xl overflow-hidden border border-gray-200 hover:border-[#FF7A00] transition-colors focus:outline-none"
          >
            <img src={src} alt={`photo-${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {lightbox !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80" onClick={() => setLightbox(null)}>
          <button
            className="absolute top-4 right-4 text-white bg-black/40 rounded-full p-1.5 hover:bg-black/60"
            onClick={() => setLightbox(null)}
          >
            <X size={20} />
          </button>
          {lightbox > 0 && (
            <button
              className="absolute left-4 text-white bg-black/40 rounded-full p-1.5 hover:bg-black/60"
              onClick={(e) => { e.stopPropagation(); setLightbox((l) => (l ?? 1) - 1); }}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          {lightbox < photos.length - 1 && (
            <button
              className="absolute right-4 text-white bg-black/40 rounded-full p-1.5 hover:bg-black/60"
              onClick={(e) => { e.stopPropagation(); setLightbox((l) => (l ?? 0) + 1); }}
            >
              <ChevronRight size={20} />
            </button>
          )}
          <img
            src={photos[lightbox]}
            alt="lightbox"
            className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

/* ── Modal détail ──────────────────────────────────────────────────── */
function ReclamationModal({
  reclamation,
  onClose,
}: {
  reclamation: Reclamation;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [newStatut, setNewStatut] = useState<StatutReclamation>(reclamation.statut);
  const [commentaire, setCommentaire] = useState('');

  const mut = useMutation({
    mutationFn: () => reclamationsApi.update(reclamation.id, newStatut, commentaire || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reclamations'] });
      logger.action('Réclamation mise à jour', { reclamation_id: reclamation.id, nouveau_statut: newStatut });
      notifySuccess('Réclamation mise à jour');
      onClose();
    },
    onError: (e: any) => {
      logger.error('Erreur mise à jour réclamation', { page: 'ReclamationsPage', reclamation_id: reclamation.id, message: e?.response?.data?.message ?? e?.message });
      notifyError(e?.response?.data?.message ?? 'Erreur');
    },
  });

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
              <AlertTriangle size={18} className="text-[#FF7A00]" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Réclamation #{reclamation.id.slice(-6).toUpperCase()}</h2>
              <p className="text-xs text-gray-400">{TYPE_LABELS[reclamation.type]}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Infos */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Colis</p>
              <p className="text-sm font-bold text-[#FF7A00]">{reclamation.colisReference}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Client</p>
              <p className="text-sm font-bold text-gray-900">{reclamation.client.prenom} {reclamation.client.nom}</p>
              <p className="text-xs text-gray-400">{reclamation.client.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Statut actuel</p>
              <StatutBadge statut={reclamation.statut} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Date</p>
              <p className="text-sm text-gray-600">{formatDate(reclamation.createdAt)}</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Description</p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-4 leading-relaxed">{reclamation.description}</p>
          </div>

          {/* Photos */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Photos</p>
            <PhotoGallery photos={reclamation.photos ?? []} />
          </div>

          {/* Historique */}
          {reclamation.historique && reclamation.historique.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Historique</p>
              <div className="space-y-2">
                {reclamation.historique.map((h, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-2 h-2 rounded-full bg-[#FF7A00] mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatutBadge statut={h.statut} />
                        {h.admin && <span className="text-xs text-gray-400">par {h.admin}</span>}
                        <span className="text-xs text-gray-400 ml-auto">{formatDate(h.date)}</span>
                      </div>
                      {h.commentaire && <p className="text-xs text-gray-600 mt-1">{h.commentaire}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action */}
          <div className="border-t border-gray-100 pt-5 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Changer le statut</p>
            <select
              value={newStatut}
              onChange={(e) => setNewStatut(e.target.value as StatutReclamation)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-800 outline-none focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/10 transition-all"
            >
              {(Object.entries(STATUT_CONFIG) as [StatutReclamation, typeof STATUT_CONFIG[StatutReclamation]][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Commentaire admin (optionnel)"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/10 resize-none transition-all placeholder-gray-400"
            />
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => mut.mutate()}
                disabled={mut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-[#FF7A00] text-white text-sm font-bold hover:bg-[#e06900] transition-colors disabled:opacity-60"
              >
                {mut.isPending ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Page principale ─────────────────────────────────────────────── */
export default function ReclamationsPage() {
  const [filterStatut, setFilterStatut] = useState<StatutReclamation | 'tous'>('tous');
  const [selected, setSelected] = useState<Reclamation | null>(null);

  const { data: reclamations = [], isLoading } = useQuery({
    queryKey: ['reclamations', filterStatut],
    queryFn: async () => {
      const res = await reclamationsApi.list(filterStatut !== 'tous' ? filterStatut : undefined);
      return (res.data as any).data ?? (res.data as any).reclamations ?? [];
    },
  });

  return (
    <div className="space-y-7">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Réclamations</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {reclamations.length} réclamation{reclamations.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilterStatut(value)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all duration-150 active:scale-95 ${
              filterStatut === value
                ? 'bg-[#FF7A00] text-white border-[#FF7A00] shadow-lg shadow-[#FF7A00]/25'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {label}
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
                  {['Référence colis', 'Client', 'Type', 'Statut', 'Date', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reclamations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center">
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                          <AlertTriangle size={22} className="text-gray-300" />
                        </div>
                        <p className="text-sm text-gray-400 font-medium">Aucune réclamation</p>
                      </div>
                    </td>
                  </tr>
                ) : reclamations.map((r: Reclamation) => (
                  <tr
                    key={r.id}
                    className="hover:bg-[#FFF9F5] transition-colors duration-150 cursor-pointer"
                    onClick={() => setSelected(r)}
                  >
                    <td className="px-5 py-4">
                      <span className="text-sm font-bold text-[#FF7A00]">{r.colisReference}</span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">{r.client.prenom} {r.client.nom}</p>
                      <p className="text-xs text-gray-400">{r.client.email}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{TYPE_LABELS[r.type]}</td>
                    <td className="px-5 py-4"><StatutBadge statut={r.statut} /></td>
                    <td className="px-5 py-4 text-sm text-gray-400 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-[#FF7A00] font-semibold hover:underline">Voir détail →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <ReclamationModal reclamation={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
