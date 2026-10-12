import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Search, Clock, Truck, CheckCircle, Package, ChevronDown, X, Camera, Upload, Layers } from 'lucide-react';
import { colisApi } from '@/api/colis';
import { TAILLE_PAGE, versPage } from '@/api/pagination';
import { useDebounce, useRetourPageVide } from '@/hooks/usePagination';
import { Pagination } from '@/components/ui/Pagination';
import { preuveLivraisonApi } from '@/api/preuveLivraison';
import logger from '@/lib/logger';
import { Badge } from '@/components/ui/Badge';
import { ErreurChargement } from '@/components/ui/ErreurChargement';
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

/** Transitions permises par le back (un colis livré ne change plus de statut). */
const TRANSITIONS: Record<Colis['statut'], Colis['statut'][]> = {
  en_attente: ['recupere', 'livre'],
  recupere:   ['livre', 'en_attente'],
  livre:      [],
};

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
  const permis = TRANSITIONS[colis.statut] ?? [];
  // Statut actuel en tête, puis uniquement les transitions autorisées.
  const options = STATUS_OPTIONS.filter((o) => o.value === colis.statut || permis.includes(o.value));

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

  // Livré : statut définitif, aucun menu.
  if (permis.length === 0) {
    return (
      <span
        title="Statut définitif : un colis livré ne peut plus changer de statut"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${current.bg} ${current.color}`}
      >
        <current.icon size={12} />
        {current.label}
      </span>
    );
  }

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
            {options.map((opt) => {
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

  const { data: preuve, isLoading, isError, refetch } = useQuery<PreuveLivraison | null>({
    queryKey: ['preuve', colis.id],
    // null = aucune preuve (404). Une autre erreur est affichée telle quelle :
    // on ne propose PAS d'envoyer une preuve si on n'a pas pu vérifier
    // qu'il n'en existe pas déjà une.
    queryFn: () => preuveLivraisonApi.get(colis.id),
    retry: false,
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const remplacer = Boolean(preuve);
    if (remplacer && !window.confirm('Une preuve existe déjà pour ce colis. La remplacer par cette nouvelle photo ?')) {
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      logger.info('Upload preuve de livraison', { colis_id: colis.id, reference: colis.reference, remplacer });
      const fd = new FormData();
      fd.append('photo', file);
      await preuveLivraisonApi.upload(colis.id, fd, remplacer);
      logger.action(remplacer ? 'Preuve de livraison remplacée' : 'Preuve de livraison ajoutée', { colis_id: colis.id, reference: colis.reference });
      notifySuccess(remplacer ? 'Preuve de livraison remplacée' : 'Preuve de livraison ajoutée');
      await qc.invalidateQueries({ queryKey: ['preuve', colis.id] });
      refetch();
    } catch (err: any) {
      logger.error('Erreur upload preuve de livraison', { page: 'ColisPage', colis_id: colis.id, message: (err as Error).message });
      notifyError(err?.response?.data?.message ?? "Erreur lors de l'upload de la preuve");
      if (err?.response?.status === 409) refetch();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const gps = preuve && preuve.gps_lat != null && preuve.gps_lng != null
    ? { lat: Number(preuve.gps_lat), lng: Number(preuve.gps_lng) }
    : null;

  const boutonEnvoi = (libelle: string) => (
    <>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
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
        {uploading ? 'Upload en cours…' : libelle}
      </button>
    </>
  );

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
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-red-500 font-medium text-center">Impossible de charger la preuve de livraison.</p>
              <button onClick={() => refetch()} className="text-sm font-bold text-[#FF7A00] hover:underline">Réessayer</button>
            </div>
          ) : preuve ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Photo de livraison</p>
              <a href={preuve.photo_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={preuve.photo_url}
                  alt="Preuve de livraison"
                  className="w-full rounded-2xl border border-gray-200 object-cover max-h-72"
                />
              </a>
              {preuve.commentaire && (
                <p className="text-sm text-gray-600">{preuve.commentaire}</p>
              )}
              {gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lng) && (
                <a
                  href={`https://www.google.com/maps?q=${gps.lat},${gps.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#FF7A00] hover:underline"
                >
                  Position GPS : {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                </a>
              )}
              {(preuve.updatedAt ?? preuve.createdAt) && (
                <p className="text-xs text-gray-400">Enregistrée le {formatDate((preuve.updatedAt ?? preuve.createdAt) as string)}</p>
              )}
              <div className="pt-2 flex justify-center">{boutonEnvoi('Remplacer la photo')}</div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Camera size={26} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-400 font-medium text-center">Aucune preuve de livraison enregistrée</p>
              {boutonEnvoi('Ajouter une preuve')}
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
  const [page, setPage] = useState(1);
  const [selectedPreuve, setSelectedPreuve] = useState<Colis | null>(null);
  const q = useDebounce(search.trim(), 400);

  // Recherche (référence ou destination) faite CÔTÉ SERVEUR via `q`.
  const { data, isLoading, isError, error: erreurChargement, refetch, isPlaceholderData } = useQuery({
    queryKey: ['colis', filter, { page, q }],
    queryFn: async () => {
      const params = { page, limit: TAILLE_PAGE, q };
      let res;
      if (filter === 'en_attente') res = await colisApi.enAttente(params);
      else if (filter === 'recupere') res = await colisApi.recuperes(params);
      else if (filter === 'livre') res = await colisApi.livres(params);
      else res = await colisApi.list(params);
      return versPage(res.data.colis, res.data.pagination);
    },
    placeholderData: keepPreviousData,
  });
  useRetourPageVide(data, page, setPage, isPlaceholderData);

  const colis = data?.items ?? [];
  const filtered = colis;
  const total = data?.pagination.total ?? 0;

  const changerFiltre = (f: Filter) => { setFilter(f); setPage(1); };
  const changerRecherche = (texte: string) => { setSearch(texte); setPage(1); };

  // Nombre de colis par lot_id — pour afficher le badge "Lot (n)" uniquement
  // quand un lot regroupe réellement plusieurs colis. Le back renvoie la
  // taille réelle du lot (`taille_lot`, toutes pages) ; repli sur le compte
  // de la page affichée.
  const tailleLot = colis.reduce((acc: Record<string, number>, c: Colis) => {
    if (c.lot_id) acc[c.lot_id] = c.taille_lot ?? (acc[c.lot_id] ?? 0) + 1;
    return acc;
  }, {});

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
      qc.invalidateQueries({ queryKey: ['colis-bloques'] });
      const labels = { en_attente: 'En attente', recupere: 'Récupéré', livre: 'Livré' };
      logger.action('Statut colis changé', { colis_id: id, nouveau_statut: action });
      notifySuccess(`Statut mis à jour : ${labels[action]}`);
    },
    onError: (e: any) => {
      logger.error('Erreur changement statut colis', { page: 'ColisPage', message: e?.response?.data?.message ?? e?.message });
      // 409 : transition refusée par le back (colis livré, déjà dans ce statut…) — on affiche son message.
      notifyError(e?.response?.data?.message ?? 'Erreur');
      if (e?.response?.status === 409 || e?.response?.status === 404) qc.invalidateQueries({ queryKey: ['colis'] });
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
          {total} colis {q ? 'trouvé' : 'enregistré'}{total > 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Filtres ── */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ value, label, icon: Icon, color, bg }) => {
          const isActive = filter === value;
          return (
            <button
              key={value}
              onClick={() => changerFiltre(value)}
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
            onChange={(e) => changerRecherche(e.target.value)}
          />
          {search && (
            <button onClick={() => changerRecherche('')} className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors">
              Effacer
            </button>
          )}
        </div>

        {isLoading ? <PageSpinner /> : isError ? <ErreurChargement erreur={erreurChargement} onRetry={() => refetch()} /> : (<>
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
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#FF7A00]">{c.reference}</span>
                        {c.lot_id && tailleLot[c.lot_id] > 1 && (
                          <span
                            title={`Fait partie d'un lot de ${tailleLot[c.lot_id]} colis (même commande)`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-violet-50 text-violet-600 border border-violet-200"
                          >
                            <Layers size={10} />
                            Lot ({tailleLot[c.lot_id]})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-700 whitespace-nowrap">
                      {c.expediteur ? `${c.expediteur.prenom} ${c.expediteur.nom}` : '—'}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-700 whitespace-nowrap">
                      {c.recepteur ? `${c.recepteur.prenom} ${c.recepteur.nom}` : '—'}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{c.destination}</td>
                    <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {c.poids} kg
                      {c.type_transport && (
                        <span className="block text-[11px] font-semibold text-gray-400">
                          {c.type_transport === 'maritime' ? 'Maritime' : 'Aérien'}
                        </span>
                      )}
                    </td>
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
          <Pagination pagination={data?.pagination} onChange={setPage} chargement={isPlaceholderData} />
        </>)}
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
