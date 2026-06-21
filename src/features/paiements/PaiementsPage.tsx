import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { Search, CreditCard, CheckCircle, Clock, RefreshCcw, TrendingUp, AlertCircle, Hourglass } from 'lucide-react';
import { paiementsApi, type Paiement, type StatutPaiement } from '@/api/paiements';
import logger from '@/lib/logger';
import { PageSpinner } from '@/components/ui/Spinner';
import { formatDate } from '@/utils/format';
import { confirmAction } from '@/utils/confirm';
import { notifySuccess, notifyError } from '@/utils/notify';

/* ── Config statuts ─────────────────────────────────────────────── */
const STATUTS: Record<StatutPaiement, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  en_attente: { label: 'En attente',  color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   icon: Clock        },
  en_cours:   { label: 'En cours',    color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',    icon: Hourglass    },
  paye:       { label: 'Payé',        color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle  },
  echoue:     { label: 'Échoué',      color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     icon: AlertCircle  },
  rembourse:  { label: 'Remboursé',   color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200',  icon: RefreshCcw   },
};

const MOYENS: Record<string, { label: string; color: string }> = {
  wave:         { label: 'Wave',         color: 'text-blue-600'   },
  orange_money: { label: 'Orange Money', color: 'text-orange-600' },
};

function formatXOF(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
}

/* ── Dropdown statut ────────────────────────────────────────────── */
function StatutSelector({ paiement }: { paiement: Paiement }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const btnRef          = useRef<HTMLButtonElement>(null);
  const qc              = useQueryClient();

  const mut = useMutation({
    mutationFn: (statut: StatutPaiement) => paiementsApi.changerStatut(paiement.id, statut),
    onSuccess: (_, statut) => {
      qc.invalidateQueries({ queryKey: ['paiements'] });
      qc.invalidateQueries({ queryKey: ['paiements-stats'] });
      logger.action('Statut paiement changé', { paiement_id: paiement.id, nouveau_statut: statut });
      notifySuccess('Statut mis à jour');
    },
    onError: (e: any) => {
      logger.error('Erreur changement statut paiement', { page: 'PaiementsPage', paiement_id: paiement.id, message: e?.response?.data?.message ?? e?.message });
      notifyError(e?.response?.data?.message ?? 'Erreur');
    },
  });

  const openDropdown = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('mousedown', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('mousedown', close);
    };
  }, [open]);

  const current = STATUTS[paiement.statut];
  const Icon = current.icon;

  const handleChange = async (statut: StatutPaiement) => {
    setOpen(false);
    if (statut === paiement.statut) return;
    const ok = await confirmAction({
      title: 'Changer le statut ?',
      text: `Passer à <strong>${STATUTS[statut].label}</strong> ?`,
      confirmText: 'Confirmer',
      icon: 'question',
    });
    if (ok) mut.mutate(statut);
  };

  return (
    <>
      <button ref={btnRef} onClick={openDropdown}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer hover:opacity-80 transition-all ${current.bg} ${current.color} ${current.border}`}>
        <Icon size={11} /> {current.label}
        <svg className="w-3 h-3 opacity-50 ml-0.5" viewBox="0 0 12 12"><path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
      </button>

      {open && createPortal(
        <div style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-2xl shadow-2xl shadow-black/10 overflow-hidden w-44 py-1"
          onMouseDown={(e) => e.stopPropagation()}>
          {(Object.entries(STATUTS) as [StatutPaiement, typeof STATUTS[StatutPaiement]][]).map(([key, cfg]) => {
            const S = cfg.icon;
            return (
              <button key={key} onClick={() => handleChange(key)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-bold hover:bg-gray-50 transition-colors ${key === paiement.statut ? cfg.color : 'text-gray-700'}`}>
                <S size={12} className={key === paiement.statut ? cfg.color : 'text-gray-400'} />
                {cfg.label}
                {key === paiement.statut && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-current" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

/* ── Page principale ────────────────────────────────────────────── */
export default function PaiementsPage() {
  const [search, setSearch]           = useState('');
  const [filterStatut, setFilterStatut] = useState<StatutPaiement | 'tous'>('tous');

  const { data: paiements = [], isLoading } = useQuery({
    queryKey: ['paiements'],
    queryFn: async () => { const r = await paiementsApi.list(); return r.data.data ?? []; },
  });

  const { data: stats } = useQuery({
    queryKey: ['paiements-stats'],
    queryFn: async () => { const r = await paiementsApi.stats(); return r.data.data; },
  });

  const filtered = paiements.filter((p: Paiement) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (p.colis?.reference ?? '').toLowerCase().includes(q) ||
      `${p.payeur?.prenom} ${p.payeur?.nom}`.toLowerCase().includes(q) ||
      (p.colis?.destination ?? '').toLowerCase().includes(q);
    const matchStatut = filterStatut === 'tous' || p.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paiements</h1>
        <p className="text-sm text-gray-400 mt-0.5">Suivez et gérez les paiements des colis</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={CreditCard}  color="bg-[#FFF4E8]" iconColor="text-[#FF7A00]"
          label="Total"              value={stats?.total ?? 0} />
        <KpiCard icon={CheckCircle} color="bg-emerald-50" iconColor="text-emerald-600"
          label="Payés"              value={stats?.paye ?? 0} />
        <KpiCard icon={Clock}       color="bg-amber-50"   iconColor="text-amber-600"
          label="En attente"         value={(stats?.enAttente ?? 0) + (stats?.enCours ?? 0)} />
        <KpiCard icon={TrendingUp}  color="bg-violet-50"  iconColor="text-violet-600"
          label="Montant encaissé"   value={formatXOF(stats?.montantTotal ?? 0)} isAmount />
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#FFF4E8] flex items-center justify-center">
              <CreditCard size={14} className="text-[#FF7A00]" />
            </div>
            <h2 className="font-bold text-gray-900">Historique des paiements</h2>
            <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{filtered.length}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['tous', ...Object.keys(STATUTS)] as (StatutPaiement | 'tous')[]).map((s) => (
              <button key={s} onClick={() => setFilterStatut(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  filterStatut === s
                    ? s === 'tous'
                      ? 'bg-gray-900 text-white border-gray-900'
                      : `${STATUTS[s as StatutPaiement].bg} ${STATUTS[s as StatutPaiement].color} ${STATUTS[s as StatutPaiement].border}`
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}>
                {s === 'tous' ? 'Tous' : STATUTS[s as StatutPaiement].label}
              </button>
            ))}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="pl-8 pr-3 py-1.5 text-xs font-medium border border-gray-200 rounded-xl outline-none focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/10 w-48 transition-all"
                placeholder="Référence, client…"
                value={search} onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {isLoading ? <PageSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100">
                  {['Référence', 'Payeur', 'Destination', 'Poids', 'Total', 'Payé', 'Moyen', 'Statut', 'Date'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-14 text-center">
                    <div className="flex flex-col items-center gap-2.5">
                      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                        <CreditCard size={22} className="text-gray-300" />
                      </div>
                      <p className="text-sm font-semibold text-gray-400">Aucun paiement trouvé</p>
                    </div>
                  </td></tr>
                ) : filtered.map((p: Paiement) => {
                  const moyen = p.moyenPaiement ? MOYENS[p.moyenPaiement] : null;
                  return (
                    <tr key={p.id} className="hover:bg-[#FFF9F5] transition-colors duration-150">
                      <td className="px-5 py-4">
                        <span className="text-xs font-mono font-bold text-[#FF7A00] bg-[#FFF4E8] px-2 py-1 rounded-lg">
                          {p.colis?.reference ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-bold text-gray-900">{p.payeur?.prenom} {p.payeur?.nom}</p>
                        <p className="text-xs text-gray-400">{p.payeur?.telephone}</p>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-gray-700">{p.colis?.destination ?? '—'}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-gray-700">{p.colis?.poids ?? '—'} kg</td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-extrabold text-gray-900">{formatXOF(p.prixTotal)}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-sm font-bold ${p.montantPaye > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {p.montantPaye > 0 ? formatXOF(p.montantPaye) : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {moyen ? (
                          <span className={`text-xs font-bold ${moyen.color}`}>{moyen.label}</span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <StatutSelector paiement={p} />
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400 font-medium whitespace-nowrap">
                        {formatDate(p.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, color, iconColor, label, value, isAmount }: {
  icon: React.ElementType; color: string; iconColor: string;
  label: string; value: number | string; isAmount?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className={iconColor} />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400">{label}</p>
        <p className={`font-extrabold text-gray-900 ${isAmount ? 'text-sm' : 'text-2xl'}`}>{value}</p>
      </div>
    </div>
  );
}
