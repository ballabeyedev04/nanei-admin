import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Clock, Truck, CheckCircle, Package, ChevronDown, X, Camera, Upload } from 'lucide-react';
import { colisApi } from '@/api/colis';
import { preuveLivraisonApi } from '@/api/preuveLivraison';
import logger from '@/lib/logger';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { formatDate, formatPrice } from '@/utils/format';
import { confirmAction } from '@/utils/confirm';
import { notifySuccess, notifyError } from '@/utils/notify';
import type { Colis, PreuveLivraison } from '@/types';

type Filter = 'all' | 'en_attente' | 'recupere' | 'livre';

const FILTERS: { value: Filter; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { value: 'all',        label: 'Tous',       icon: Package,      color: 'text-gray-600',    bg: '' },
  { value: 'en_attente', label: 'En attente', icon: Clock,        color: 'text-yellow-600',  bg: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
  { value: 'recupere',   label: 'Récupérés',  icon: Truck,        color: 'text-sky-600',     bg: 'bg-sky-50 border-sky-200 text-sky-700' },
  { value: 'livre',      label: 'Livrés',     icon: CheckCircle,  color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
];

const STATUS_OPTIONS: { value: Colis['statut']; label: string; icon: React.ElementType; color: string; bg: string; ring: string }[] = [
  { value: 'en_attente', label: 'En attente', icon: Clock,       color: 'text-yellow-700',  bg: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',  ring: 'ring-yellow-300' },
  { value: 'recupere',   label: 'Récupéré',   icon: Truck,       color: 'text-sky-700',     bg: 'bg-sky-50 hover:bg-sky-100 border-sky-200',           ring: 'ring-sky-300'    },
  { value: 'livre',      label: 'Livré',      icon: CheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200', ring: 'ring-emerald-300' },
];

const statusBadge = (s: Colis['statut']) => ({
  en_attente: <Badge variant="pending">En attente</Badge>,
  recupere:   <Badge variant="picked">Récupéré</Badge>,
  livre:      <Badge variant="delivered">Livré</Badge>,
}[s]);

/* ── Sélecteur de statut avec portail (évite overflow:hidden) ─────── */
function StatusSelector({ colis, onConfirm }: { colis: Colis; onConfirm: (c: Colis, s: Colis['statut']) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const current = STATUS_OPTIONS.find((o) => o.value === colis.statut)!;

  const openDropdown = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX });
    }
    setOpen(true);
  };

  // Ferme si on scroll ou resize
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);

  return (
    <div>
      <button
        ref={btnRef}
        onClick={openDropdown}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-150 active:scale-95 ${current.bg} ${current.color}`}
      >
        <current.icon size={12} />
        {current.label}
        <ChevronDown size={11} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999 }}
            className="bg-white rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.14)] border border-gray-100 p-1.5 min-w-[170px] animate-[slideUp_0.15s_cubic-bezier(.22,.68,0,1.2)]"
          >
            {STATUS_OPTIONS.map((opt) => {
              const isActive = opt.value === colis.statut;
              return (
                <button
                  key={opt.value}
                  onClick={() => { setOpen(false); if (!isActive) onConfirm(colis, opt.value); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-100 ${
                    isActive
                      ? `${opt.bg} ${opt.color} ring-1 ${opt.ring}`
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <opt.icon size={13} className={isActive ? opt.color : 'text-gray-400'} />
                  {opt.label}
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
                </button>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

/* ── Modal Preuve de Livraison ───────────────────────────────────── */
function PreuveLivraisonModal({ colis, onClose }: { colis: Colis; onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: preuve, isLoading, refetch } = useQuery<PreuveLivraison | null>({
    queryKey: ['preuve', colis.id],
    queryFn: async () => {
      try {
        const res = await preuveLivraisonApi.get(colis.id);
        return (res.data as any).data ?? null;
      } catch {
        return null;
      }
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      logger.info('Upload preuve de livraison', { colis_id: colis.id, reference: colis.reference });
      const fd = new FormData();
      fd.append('photo', file);
      await preuveLivraisonApi.upload(colis.id, fd);
      logger.action('Preuve de livraison ajoutée', { colis_id: colis.id, reference: colis.reference });
      notifySuccess('Preuve de livraison ajoutée');
      refetch();
      qc.invalidateQueries({ queryKey: ['preuve', colis.id] });
    } catch (err: any) {
      logger.error('Erreur upload preuve de livraison', { page: 'ColisPage', colis_id: colis.id, message: (err as Error).message });
      notifyError('Erreur lors de l\'upload de la preuve');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Camera size={18} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Preuve de livraison</h2>
              <p className="text-xs text-gray-400">{colis.reference}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {isLoading ? (
            <div className="py-8 flex justify-center">
              <div className="w-8 h-8 border-4 border-[#FF7A00]/30 border-t-[#FF7A00] rounded-full animate-spin" />
            </div>
          ) : preuve?.photo ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Photo de livraison</p>
              <img
                src={preuve.photo}
                alt="Preuve de livraison"
                className="w-full rounded-2xl border border-gray-200 object-cover max-h-72"
              />
              {preuve.createdAt && (
                <p className="text-xs text-gray-400">Ajoutée le {formatDate(preuve.createdAt)}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Camera size={26} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-400 font-medium text-center">Aucune preuve de livraison enregistrée</p>

              <input
                type="file"
                accept="image/*"
                ref={fileRef}
                className="hidden"
                onChange={handleUpload}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF7A00] text-white text-sm font-bold hover:bg-[#e06900] transition-colors disabled:opacity-60 active:scale-95"
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                {uploading ? 'Upload en cours…' : 'Ajouter une preuve'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Page principale ─────────────────────────────────────────────── */
export default function ColisPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selectedPreuve, setSelectedPreuve] = useState<Colis | null>(null);

  const { data: colis = [], isLoading } = useQuery({
    queryKey: ['colis', filter],
    queryFn: async () => {
      let res;
      if (filter === 'en_attente') res = await colisApi.enAttente();
      else if (filter === 'recupere') res = await colisApi.recuperes();
      else if (filter === 'livre') res = await colisApi.livres();
      else res = await colisApi.list();
      return (res.data as any).colis ?? (res.data as any).data ?? [];
    },
  });

  const filtered = colis.filter((c: Colis) =>
    search === '' ||
    c.reference.toLowerCase().includes(search.toLowerCase()) ||
    c.destination.toLowerCase().includes(search.toLowerCase())
  );

  const statusMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: Colis['statut'] }) => {
      if (action === 'en_attente') return colisApi.setEnAttente(id);
      if (action === 'recupere') return colisApi.setRecupere(id);
      return colisApi.setLivre(id);
    },
    onSuccess: (_, { id, action }) => {
      qc.invalidateQueries({ queryKey: ['colis'] });
      qc.invalidateQueries({ queryKey: ['kpi-attente'] });
      qc.invalidateQueries({ queryKey: ['kpi-recuperes'] });
      qc.invalidateQueries({ queryKey: ['kpi-livres'] });
      qc.invalidateQueries({ queryKey: ['recent-colis'] });
      const labels = { en_attente: 'En attente', recupere: 'Récupéré', livre: 'Livré' };
      logger.action('Statut colis changé', { colis_id: id, nouveau_statut: action });
      notifySuccess(`Statut mis à jour : ${labels[action]}`);
    },
    onError: (e: any) => {
      logger.error('Erreur changement statut colis', { page: 'ColisPage', message: e?.response?.data?.message ?? e?.message });
      notifyError(e?.response?.data?.message ?? 'Erreur');
    },
  });

  const handleStatusChange = async (c: Colis, action: Colis['statut']) => {
    const labels: Record<Colis['statut'], string> = { en_attente: 'En attente', recupere: 'Récupéré', livre: 'Livré' };
    const ok = await confirmAction({
      title: 'Changer le statut ?',
      text: `Colis <span class="swal-name">${c.reference}</span> → <strong>${labels[action]}</strong>`,
      confirmText: 'Confirmer',
      icon: 'question',
    });
    if (ok) statusMut.mutate({ id: c.id, action });
  };

  return (
    <div className="space-y-7">

      {/* ── En-tête ── */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Gestion des colis</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {colis.length} colis enregistré{colis.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Filtres ── */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ value, label, icon: Icon, color, bg }) => {
          const isActive = filter === value;
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold border transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'bg-[#FF7A00] text-white border-[#FF7A00] shadow-lg shadow-[#FF7A00]/25'
                  : `bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 ${bg}`
              }`}
            >
              <Icon size={14} className={isActive ? 'text-white' : color} />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Tableau ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] overflow-hidden">

        {/* Barre de recherche */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Search size={14} className="text-gray-400" />
          </div>
          <input
            className="flex-1 text-sm font-medium outline-none placeholder-gray-400 bg-transparent text-gray-900"
            placeholder="Rechercher par référence ou destination..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors">
              Effacer
            </button>
          )}
        </div>

        {isLoading ? <PageSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100">
                  {['Référence', 'Expéditeur', 'Destinataire', 'Destination', 'Poids', 'Prix', 'Statut', 'Date', 'Changer statut'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-14 text-center">
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                          <Package size={22} className="text-gray-300" />
                        </div>
                        <p className="text-sm text-gray-400 font-medium">Aucun colis trouvé</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((c: Colis) => (
                  <tr key={c.id} className="hover:bg-[#FFF9F5] transition-colors duration-150 group">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-[#FF7A00]">{c.reference}</span>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-700 whitespace-nowrap">
                      {c.expediteur ? `${c.expediteur.prenom} ${c.expediteur.nom}` : '—'}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-700 whitespace-nowrap">
                      {c.recepteur ? `${c.recepteur.prenom} ${c.recepteur.nom}` : '—'}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{c.destination}</td>
                    <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{c.poids} kg</td>
                    <td className="px-5 py-4 text-sm font-bold text-gray-900 whitespace-nowrap">{formatPrice(c.prix)}</td>
                    <td className="px-5 py-4">{statusBadge(c.statut)}</td>
                    <td className="px-5 py-4 text-sm text-gray-400 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <StatusSelector colis={c} onConfirm={handleStatusChange} />
                        {c.statut === 'livre' && (
                          <button
                            onClick={() => setSelectedPreuve(c)}
                            title="Preuve de livraison"
                            className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors"
                          >
                            <Camera size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(8px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
      `}</style>

      {selectedPreuve && (
        <PreuveLivraisonModal colis={selectedPreuve} onClose={() => setSelectedPreuve(null)} />
      )}
    </div>
  );
}
