import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Globe, Plane, Ship, Wrench, Coins,
  MapPin, Hash, ToggleRight, Loader2, ArrowRight,
} from 'lucide-react';
import { countriesApi, shippingRatesApi, serviceRatesApi, tauxChangeApi } from '@/api/countries';
import logger from '@/lib/logger';
import type { ShippingRate, ServiceRate, TauxChange } from '@/api/countries';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import { formatPrice } from '@/utils/format';
import { confirmAction } from '@/utils/confirm';
import { notifySuccess, notifyError } from '@/utils/notify';
import type { Country } from '@/types';

type Tab = 'countries' | 'shipping' | 'service' | 'taux';

/* ── Champ réutilisable ───────────────────────────────────────────── */
function Field({ label, icon: Icon, required, children }: {
  label: string; icon: React.ElementType; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
        <Icon size={13} className="text-gray-400" />
        {label}{required && <span className="text-[#FF7A00]">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = `w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/80 text-gray-900 placeholder-gray-400 text-sm font-medium outline-none transition-all duration-200 hover:border-gray-300 hover:bg-white focus:border-[#FF7A00] focus:ring-4 focus:ring-[#FF7A00]/10 focus:bg-white`;
const selectCls = `${inputCls} cursor-pointer`;

/* ── Boutons actions ──────────────────────────────────────────────── */
function ActionBtns({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onEdit}
        className="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 transition-all duration-150 active:scale-95"
        title="Modifier"
      >
        <Pencil size={13} />
      </button>
      <button
        onClick={onDelete}
        className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 text-red-500 transition-all duration-150 active:scale-95"
        title="Supprimer"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

/* ── Boutons submit modal ─────────────────────────────────────────── */
function ModalActions({ onCancel, pending, isEdit }: { onCancel: () => void; pending: boolean; isEdit: boolean }) {
  return (
    <div className="flex gap-3 pt-2 border-t border-gray-100 mt-2">
      <button type="button" onClick={onCancel}
        className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all duration-150">
        Annuler
      </button>
      <button type="submit" disabled={pending}
        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FF7A00] hover:bg-[#E06A00] text-white text-sm font-bold shadow-lg shadow-[#FF7A00]/25 transition-all duration-150 disabled:opacity-50 active:scale-[0.98]">
        {pending ? <><Loader2 size={15} className="animate-spin" /> Enregistrement...</> : isEdit ? 'Enregistrer' : 'Créer'}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function CountriesPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as Tab) ?? 'countries';
  const setTab = (t: Tab) => setSearchParams({ tab: t }, { replace: true });

  /* ── Countries ── */
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [editCountry, setEditCountry] = useState<Country | null>(null);
  const [countryForm, setCountryForm] = useState({ name: '', code: '', isActive: true });

  const { data: countries = [], isLoading: loadingCountries } = useQuery({
    queryKey: ['countries'],
    queryFn: async () => { const res = await countriesApi.list(); return (res.data as any).data ?? (res.data as any) ?? []; },
  });

  const countryMut = useMutation({
    mutationFn: (d: typeof countryForm) =>
      editCountry ? countriesApi.update(editCountry.id, d) : countriesApi.create(d),
    onSuccess: (_, d) => {
      qc.invalidateQueries({ queryKey: ['countries'] });
      logger.action(editCountry ? 'Pays mis à jour' : 'Pays créé', { name: d.name, code: d.code });
      notifySuccess(editCountry ? 'Pays mis à jour' : 'Pays créé');
      setShowCountryModal(false); setEditCountry(null); setCountryForm({ name: '', code: '', isActive: true });
    },
    onError: (e: any) => {
      logger.error('Erreur mutation pays', { page: 'CountriesPage', message: e?.response?.data?.message ?? e?.message });
      notifyError(e?.response?.data?.message ?? 'Erreur');
    },
  });

  const handleDeleteCountry = async (c: Country) => {
    const ok = await confirmAction({ title: 'Supprimer ce pays ?', text: `<span class="swal-name">${c.name}</span> sera définitivement supprimé.`, confirmText: 'Supprimer', icon: 'warning' });
    if (ok) deleteCountryMut.mutate(c.id);
  };
  const deleteCountryMut = useMutation({
    mutationFn: (id: string) => countriesApi.delete(id),
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: ['countries'] }); logger.action('Pays supprimé', { country_id: id }); notifySuccess('Pays supprimé'); },
    onError: (e: any) => { logger.error('Erreur suppression pays', { page: 'CountriesPage', message: e?.response?.data?.message ?? e?.message }); notifyError(e?.response?.data?.message ?? 'Erreur'); },
  });

  /* ── Shipping Rates (nouveau modèle : aérien + maritime par ligne) ── */
  const [showShipModal, setShowShipModal] = useState(false);
  const [editRate, setEditRate] = useState<ShippingRate | null>(null);
  // Étape du formulaire : 'maritime' d'abord, puis 'aerien'
  const [shipStep, setShipStep] = useState<'maritime' | 'aerien'>('maritime');
  const EMPTY_SHIP = { countryId: '', minWeightMaritime: '', maxWeightMaritime: '', priceMaritimePerKg: '', minWeightAerien: '', maxWeightAerien: '', priceAerienPerKg: '' };
  const [shipForm, setShipForm] = useState(EMPTY_SHIP);

  const { data: shippingRates = [], isLoading: loadingShip } = useQuery({
    queryKey: ['shipping-rates'],
    queryFn: async () => { const res = await shippingRatesApi.list(); return (res.data as any).data ?? []; },
  });

  const closeShipModal = () => { setShowShipModal(false); setEditRate(null); setShipForm(EMPTY_SHIP); setShipStep('maritime'); };

  const shipMut = useMutation({
    mutationFn: (d: typeof shipForm) => {
      const payload = {
        countryId: d.countryId,
        minWeightMaritime: parseFloat(d.minWeightMaritime),
        maxWeightMaritime: parseFloat(d.maxWeightMaritime),
        priceMaritimePerKg: parseFloat(d.priceMaritimePerKg),
        minWeightAerien: parseFloat(d.minWeightAerien),
        maxWeightAerien: parseFloat(d.maxWeightAerien),
        priceAerienPerKg: parseFloat(d.priceAerienPerKg),
      };
      return editRate ? shippingRatesApi.update(editRate.id, payload) : shippingRatesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipping-rates'] });
      logger.action(editRate ? 'Tarif transport mis à jour' : 'Tarif transport créé', { rate_id: editRate?.id });
      notifySuccess(editRate ? 'Tarif mis à jour' : 'Tarif créé');
      closeShipModal();
    },
    onError: (e: any) => {
      logger.error('Erreur mutation tarif transport', { page: 'CountriesPage', message: e?.response?.data?.message ?? e?.message });
      notifyError(e?.response?.data?.message ?? 'Erreur');
    },
  });

  const openShipEdit = (r: ShippingRate) => {
    setEditRate(r);
    setShipForm({
      countryId: r.countryId,
      minWeightMaritime: String(r.minWeightMaritime), maxWeightMaritime: String(r.maxWeightMaritime), priceMaritimePerKg: String(r.priceMaritimePerKg),
      minWeightAerien: String(r.minWeightAerien), maxWeightAerien: String(r.maxWeightAerien), priceAerienPerKg: String(r.priceAerienPerKg),
    });
    setShipStep('maritime');
    setShowShipModal(true);
  };

  const handleDeleteShip = async (r: ShippingRate) => {
    const name = r.country?.name ?? r.countryId;
    const ok = await confirmAction({ title: 'Supprimer ce tarif ?', text: `Les tarifs aérien + maritime pour <span class="swal-name">${name}</span> seront supprimés.`, confirmText: 'Supprimer', icon: 'warning' });
    if (ok) deleteShipMut.mutate(r.id);
  };
  const deleteShipMut = useMutation({
    mutationFn: (id: string) => shippingRatesApi.delete(id),
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: ['shipping-rates'] }); logger.action('Tarif transport supprimé', { rate_id: id }); notifySuccess('Tarif supprimé'); },
    onError: (e: any) => { logger.error('Erreur suppression tarif transport', { page: 'CountriesPage', message: e?.response?.data?.message ?? e?.message }); notifyError(e?.response?.data?.message ?? 'Erreur'); },
  });

  /* ── Service Rates ── */
  const [showSvcModal, setShowSvcModal] = useState(false);
  const [editSvcRate, setEditSvcRate] = useState<ServiceRate | null>(null);
  const [svcStep, setSvcStep] = useState<'recuperation' | 'livraison'>('recuperation');
  const EMPTY_SVC = { countryId: '', prixRecuperation: '', prixLivraison: '' };
  const [svcForm, setSvcForm] = useState(EMPTY_SVC);

  const closeSvcModal = () => { setShowSvcModal(false); setEditSvcRate(null); setSvcForm(EMPTY_SVC); setSvcStep('recuperation'); };

  const { data: serviceRates = [], isLoading: loadingSvc } = useQuery({
    queryKey: ['service-rates'],
    queryFn: async () => { const res = await serviceRatesApi.list(); return (res.data as any).data ?? []; },
  });

  const svcMut = useMutation({
    mutationFn: (d: typeof svcForm) => {
      const payload = { countryId: d.countryId, prixRecuperation: parseFloat(d.prixRecuperation), prixLivraison: parseFloat(d.prixLivraison) };
      return editSvcRate ? serviceRatesApi.update(editSvcRate.id, payload) : serviceRatesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-rates'] });
      logger.action(editSvcRate ? 'Tarif service mis à jour' : 'Tarif service créé', { rate_id: editSvcRate?.id });
      notifySuccess(editSvcRate ? 'Tarif mis à jour' : 'Tarif créé');
      closeSvcModal();
    },
    onError: (e: any) => {
      logger.error('Erreur mutation tarif service', { page: 'CountriesPage', message: e?.response?.data?.message ?? e?.message });
      notifyError(e?.response?.data?.message ?? 'Erreur');
    },
  });

  const handleDeleteSvc = async (r: ServiceRate) => {
    const name = r.country?.name ?? r.countryId;
    const ok = await confirmAction({ title: 'Supprimer ce tarif ?', text: `Les tarifs récupération + livraison pour <span class="swal-name">${name}</span> seront supprimés.`, confirmText: 'Supprimer', icon: 'warning' });
    if (ok) deleteSvcMut.mutate(r.id);
  };
  const deleteSvcMut = useMutation({
    mutationFn: (id: string) => serviceRatesApi.delete(id),
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: ['service-rates'] }); logger.action('Tarif service supprimé', { rate_id: id }); notifySuccess('Tarif supprimé'); },
    onError: (e: any) => { logger.error('Erreur suppression tarif service', { page: 'CountriesPage', message: e?.response?.data?.message ?? e?.message }); notifyError(e?.response?.data?.message ?? 'Erreur'); },
  });

  /* ── Taux de change (EUR -> FCFA) ── */
  const [showTauxModal, setShowTauxModal] = useState(false);
  const [editTaux, setEditTaux] = useState<TauxChange | null>(null);
  const [tauxForm, setTauxForm] = useState({ valeur: '' });

  const { data: tauxChanges = [], isLoading: loadingTaux } = useQuery({
    queryKey: ['taux-change'],
    queryFn: async () => { const res = await tauxChangeApi.list(); return (res.data as any).data ?? []; },
  });

  const closeTauxModal = () => { setShowTauxModal(false); setEditTaux(null); setTauxForm({ valeur: '' }); };

  const tauxMut = useMutation({
    mutationFn: (d: typeof tauxForm) => tauxChangeApi.update(editTaux!.id, parseFloat(d.valeur)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['taux-change'] });
      logger.action('Taux de change mis à jour', { taux_id: editTaux?.id, valeur: tauxForm.valeur });
      notifySuccess('Taux de change mis à jour');
      closeTauxModal();
    },
    onError: (e: any) => {
      logger.error('Erreur mutation taux de change', { page: 'CountriesPage', message: e?.response?.data?.message ?? e?.message });
      notifyError(e?.response?.data?.message ?? 'Erreur');
    },
  });

  const TABS = [
    { id: 'countries' as Tab, label: 'Pays',             icon: Globe,  color: 'text-[#FF7A00]',   bg: 'bg-[#FFF4E8]' },
    { id: 'shipping'  as Tab, label: 'Tarifs transport', icon: Plane,  color: 'text-blue-600',    bg: 'bg-blue-50'   },
    { id: 'service'   as Tab, label: 'Tarifs services',  icon: Wrench, color: 'text-violet-600',  bg: 'bg-violet-50' },
    { id: 'taux'      as Tab, label: 'Taux de change',   icon: Coins,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  const EmptyState = ({ icon: Icon, text }: { icon: React.ElementType; text: string }) => (
    <tr><td colSpan={10} className="px-5 py-14 text-center">
      <div className="flex flex-col items-center gap-2.5">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
          <Icon size={22} className="text-gray-300" />
        </div>
        <p className="text-sm text-gray-400 font-medium">{text}</p>
      </div>
    </td></tr>
  );

  const Th = ({ children }: { children: string }) => (
    <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{children}</th>
  );

  return (
    <div className="space-y-7">

      {/* ── En-tête ── */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Pays & Tarifs</h1>
        <p className="text-gray-400 text-sm mt-0.5">Gérer les pays desservis et les grilles tarifaires</p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2">
        {TABS.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold border transition-all duration-200 active:scale-95 ${
              tab === id
                ? 'bg-[#FF7A00] text-white border-[#FF7A00] shadow-lg shadow-[#FF7A00]/25'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <Icon size={14} className={tab === id ? 'text-white' : color} />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Pays ── */}
      {tab === 'countries' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#FFF4E8] flex items-center justify-center">
                <Globe size={14} className="text-[#FF7A00]" />
              </div>
              <h2 className="font-bold text-gray-900">Pays desservis</h2>
            </div>
            <button
              onClick={() => { setEditCountry(null); setCountryForm({ name: '', code: '', isActive: true }); setShowCountryModal(true); }}
              className="flex items-center gap-2 bg-[#FF7A00] hover:bg-[#E06A00] text-white font-bold text-sm px-4 py-2.5 rounded-2xl transition-all shadow-lg shadow-[#FF7A00]/25 active:scale-95"
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>
          {loadingCountries ? <PageSpinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-gray-50/70 border-b border-gray-100">
                  <Th>Nom</Th><Th>Code</Th><Th>Statut</Th><Th>Actions</Th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {countries.length === 0
                    ? <EmptyState icon={Globe} text="Aucun pays enregistré" />
                    : countries.map((c: Country) => (
                    <tr key={c.id} className="hover:bg-[#FFF9F5] transition-colors duration-150">
                      <td className="px-5 py-4 text-sm font-bold text-gray-900">{c.name}</td>
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs font-bold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">{c.code}</span>
                      </td>
                      <td className="px-5 py-4"><Badge variant={c.isActive ? 'active' : 'inactive'}>{c.isActive ? 'Actif' : 'Inactif'}</Badge></td>
                      <td className="px-5 py-4">
                        <ActionBtns
                          onEdit={() => { setEditCountry(c); setCountryForm({ name: c.name, code: c.code, isActive: c.isActive }); setShowCountryModal(true); }}
                          onDelete={() => handleDeleteCountry(c)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Tarifs transport ── */}
      {tab === 'shipping' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><Plane size={14} className="text-blue-600" /></div>
              <h2 className="font-bold text-gray-900">Tarifs de transport</h2>
              <span className="text-xs text-gray-400 font-medium">— 1 entrée par pays (aérien + maritime)</span>
            </div>
            <button
              onClick={() => { setEditRate(null); setShipForm(EMPTY_SHIP); setShipStep('maritime'); setShowShipModal(true); }}
              className="flex items-center gap-2 bg-[#FF7A00] hover:bg-[#E06A00] text-white font-bold text-sm px-4 py-2.5 rounded-2xl transition-all shadow-lg shadow-[#FF7A00]/25 active:scale-95"
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>
          {loadingShip ? <PageSpinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-gray-50/70 border-b border-gray-100">
                  <Th>Pays</Th><Th>Aérien (poids)</Th><Th>Prix aérien / kg</Th><Th>Maritime (poids)</Th><Th>Prix maritime / kg</Th><Th>Actions</Th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {(shippingRates as ShippingRate[]).length === 0
                    ? <EmptyState icon={Plane} text="Aucun tarif de transport" />
                    : (shippingRates as ShippingRate[]).map((r) => (
                    <tr key={r.id} className="hover:bg-[#FFF9F5] transition-colors duration-150">
                      <td className="px-5 py-4 text-sm font-bold text-gray-900">{r.country?.name ?? r.countryId}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5 text-xs text-blue-700">
                          <span><span className="font-medium text-gray-400">min:</span> <span className="font-bold">{r.minWeightAerien} kg</span></span>
                          <span><span className="font-medium text-gray-400">max:</span> <span className="font-bold">{r.maxWeightAerien} kg</span></span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">{formatPrice(r.priceAerienPerKg)}/kg</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5 text-xs text-teal-700">
                          <span><span className="font-medium text-gray-400">min:</span> <span className="font-bold">{r.minWeightMaritime} kg</span></span>
                          <span><span className="font-medium text-gray-400">max:</span> <span className="font-bold">{r.maxWeightMaritime} kg</span></span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">{formatPrice(r.priceMaritimePerKg)}/kg</span>
                      </td>
                      <td className="px-5 py-4">
                        <ActionBtns onEdit={() => openShipEdit(r)} onDelete={() => handleDeleteShip(r)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Tarifs services ── */}
      {tab === 'service' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                <Wrench size={14} className="text-violet-600" />
              </div>
              <h2 className="font-bold text-gray-900">Tarifs de services</h2>
            </div>
            <button
              onClick={() => { setEditSvcRate(null); setSvcForm(EMPTY_SVC); setSvcStep('recuperation'); setShowSvcModal(true); }}
              className="flex items-center gap-2 bg-[#FF7A00] hover:bg-[#E06A00] text-white font-bold text-sm px-4 py-2.5 rounded-2xl transition-all shadow-lg shadow-[#FF7A00]/25 active:scale-95"
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>
          {loadingSvc ? <PageSpinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-gray-50/70 border-b border-gray-100">
                  <Th>Pays</Th><Th>Prix récupération</Th><Th>Prix livraison</Th><Th>Actions</Th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {(serviceRates as ServiceRate[]).length === 0
                    ? <EmptyState icon={Wrench} text="Aucun tarif de service" />
                    : (serviceRates as ServiceRate[]).map((r) => (
                    <tr key={r.id} className="hover:bg-[#FFF9F5] transition-colors duration-150">
                      <td className="px-5 py-4 text-sm font-bold text-gray-900">{r.country?.name ?? r.countryId}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FFF4E8] text-[#FF7A00] border border-orange-200">
                          {formatPrice(r.prixRecuperation)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200">
                          {formatPrice(r.prixLivraison)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <ActionBtns
                          onEdit={() => { setEditSvcRate(r); setSvcForm({ countryId: r.countryId, prixRecuperation: String(r.prixRecuperation), prixLivraison: String(r.prixLivraison) }); setShowSvcModal(true); }}
                          onDelete={() => handleDeleteSvc(r)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Taux de change ── */}
      {tab === 'taux' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Coins size={14} className="text-emerald-600" />
              </div>
              <h2 className="font-bold text-gray-900">Taux de change</h2>
              <span className="text-xs text-gray-400 font-medium">— utilisé pour l'affichage FCFA dans le mobile</span>
            </div>
          </div>
          {loadingTaux ? <PageSpinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-gray-50/70 border-b border-gray-100">
                  <Th>Devise source</Th><Th>Devise cible</Th><Th>Taux</Th><Th>Actions</Th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {(tauxChanges as TauxChange[]).length === 0
                    ? <EmptyState icon={Coins} text="Aucun taux de change configuré" />
                    : (tauxChanges as TauxChange[]).map((t) => (
                    <tr key={t.id} className="hover:bg-[#FFF9F5] transition-colors duration-150">
                      <td className="px-5 py-4 text-sm font-bold text-gray-900">{t.devise_source}</td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-900">{t.devise_cible}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          1 {t.devise_source} = {t.valeur.toLocaleString('fr-FR')} {t.devise_cible}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => { setEditTaux(t); setTauxForm({ valeur: String(t.valeur) }); setShowTauxModal(true); }}
                          className="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 transition-all duration-150 active:scale-95"
                          title="Modifier"
                        >
                          <Pencil size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ MODAL : Pays ══════════════════════════════════════════════ */}
      <Modal
        open={showCountryModal}
        onClose={() => { setShowCountryModal(false); setEditCountry(null); }}
        title={editCountry ? 'Modifier le pays' : 'Nouveau pays'}
        subtitle={editCountry ? 'Modifiez les informations du pays' : 'Ajoutez un nouveau pays desservi'}
        icon={<Globe size={18} className="text-[#FF7A00]" />}
      >
        <form onSubmit={(e) => { e.preventDefault(); countryMut.mutate(countryForm); }} className="space-y-4">
          <Field label="Nom du pays" icon={MapPin} required>
            <input className={inputCls} placeholder="ex: France" value={countryForm.name} onChange={(e) => setCountryForm({ ...countryForm, name: e.target.value })} />
          </Field>
          <Field label="Code pays (3 lettres)" icon={Hash} required>
            <input className={`${inputCls} uppercase tracking-widest`} maxLength={3} placeholder="ex: FRA" value={countryForm.code} onChange={(e) => setCountryForm({ ...countryForm, code: e.target.value.toUpperCase() })} />
          </Field>
          {/* Toggle actif */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <ToggleRight size={15} className="text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">Pays actif</span>
            </div>
            <button
              type="button"
              onClick={() => setCountryForm({ ...countryForm, isActive: !countryForm.isActive })}
              className={`w-11 h-6 rounded-full transition-all duration-200 relative flex-shrink-0 ${countryForm.isActive ? 'bg-[#FF7A00]' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${countryForm.isActive ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
          <ModalActions onCancel={() => { setShowCountryModal(false); setEditCountry(null); }} pending={countryMut.isPending} isEdit={!!editCountry} />
        </form>
      </Modal>

      {/* ══ MODAL : Tarif transport en 2 étapes ══════════════════════ */}
      <Modal
        open={showShipModal}
        onClose={closeShipModal}
        title={editRate ? 'Modifier le tarif' : 'Nouveau tarif de transport'}
        subtitle={shipStep === 'maritime' ? 'Étape 1 / 2 — Tarif Maritime' : 'Étape 2 / 2 — Tarif Aérien'}
        icon={shipStep === 'maritime' ? <Ship size={18} className="text-teal-600" /> : <Plane size={18} className="text-blue-600" />}
        maxWidth="max-w-lg"
      >
        {/* Indicateur d'étapes */}
        <div className="flex gap-2 mb-6">
          {(['maritime', 'aerien'] as const).map((s, i) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0 transition-all ${
                shipStep === s ? (s === 'maritime' ? 'bg-teal-500 text-white' : 'bg-blue-500 text-white')
                : (i < (['maritime','aerien'] as const).indexOf(shipStep)) ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'
              }`}>{i + 1}</div>
              <span className={`text-xs font-bold ${shipStep === s ? 'text-gray-900' : 'text-gray-400'}`}>
                {s === 'maritime' ? 'Maritime' : 'Aérien'}
              </span>
              {i === 0 && <div className="flex-1 h-0.5 bg-gray-200 rounded-full mx-1">
                <div className={`h-full rounded-full transition-all duration-300 ${shipStep === 'aerien' ? 'bg-emerald-400 w-full' : 'w-0'}`} />
              </div>}
            </div>
          ))}
        </div>

        {/* Étape Maritime */}
        {shipStep === 'maritime' && (
          <div className="space-y-4">
            <Field label="Pays de destination" icon={Globe} required>
              <select className={selectCls} value={shipForm.countryId} onChange={(e) => setShipForm({ ...shipForm, countryId: e.target.value })} disabled={!!editRate}>
                <option value="">Choisir un pays...</option>
                {countries.map((c: Country) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="p-4 rounded-2xl border-2 border-teal-200 bg-teal-50/30 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-xl bg-teal-100 flex items-center justify-center"><Ship size={13} className="text-teal-600" /></div>
                <span className="text-sm font-extrabold text-teal-700">Transport Maritime</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Poids minimum (kg)</label>
                  <input inputMode="decimal" placeholder="ex : 0" required
                    className="w-full px-3 py-2.5 rounded-xl border border-teal-200 bg-white text-gray-900 text-sm font-medium outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100 transition-all"
                    value={shipForm.minWeightMaritime} onChange={(e) => setShipForm({ ...shipForm, minWeightMaritime: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Poids maximum (kg)</label>
                  <input inputMode="decimal" placeholder="ex : 500" required
                    className="w-full px-3 py-2.5 rounded-xl border border-teal-200 bg-white text-gray-900 text-sm font-medium outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100 transition-all"
                    value={shipForm.maxWeightMaritime} onChange={(e) => setShipForm({ ...shipForm, maxWeightMaritime: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Prix par kg (€)</label>
                <input inputMode="decimal" placeholder="ex : 2.50" required
                  className="w-full px-3 py-2.5 rounded-xl border border-teal-200 bg-white text-gray-900 text-sm font-bold outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100 transition-all"
                  value={shipForm.priceMaritimePerKg} onChange={(e) => setShipForm({ ...shipForm, priceMaritimePerKg: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button type="button" onClick={closeShipModal}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">Annuler</button>
              <button type="button"
                disabled={!shipForm.countryId || !shipForm.minWeightMaritime || !shipForm.maxWeightMaritime || !shipForm.priceMaritimePerKg}
                onClick={() => setShipStep('aerien')}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]">
                Suivant <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Étape Aérien */}
        {shipStep === 'aerien' && (
          <form onSubmit={(e) => { e.preventDefault(); shipMut.mutate(shipForm); }} className="space-y-4">
            <div className="p-4 rounded-2xl border-2 border-blue-200 bg-blue-50/30 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-xl bg-blue-100 flex items-center justify-center"><Plane size={13} className="text-blue-600" /></div>
                <span className="text-sm font-extrabold text-blue-700">Transport Aérien</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Poids minimum (kg)</label>
                  <input inputMode="decimal" placeholder="ex : 0" required
                    className="w-full px-3 py-2.5 rounded-xl border border-blue-200 bg-white text-gray-900 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all"
                    value={shipForm.minWeightAerien} onChange={(e) => setShipForm({ ...shipForm, minWeightAerien: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Poids maximum (kg)</label>
                  <input inputMode="decimal" placeholder="ex : 100" required
                    className="w-full px-3 py-2.5 rounded-xl border border-blue-200 bg-white text-gray-900 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all"
                    value={shipForm.maxWeightAerien} onChange={(e) => setShipForm({ ...shipForm, maxWeightAerien: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Prix par kg (€)</label>
                <input inputMode="decimal" placeholder="ex : 5.00" required
                  className="w-full px-3 py-2.5 rounded-xl border border-blue-200 bg-white text-gray-900 text-sm font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all"
                  value={shipForm.priceAerienPerKg} onChange={(e) => setShipForm({ ...shipForm, priceAerienPerKg: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setShipStep('maritime')}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">← Retour</button>
              <button type="submit" disabled={shipMut.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FF7A00] hover:bg-[#E06A00] text-white text-sm font-bold shadow-lg shadow-[#FF7A00]/25 transition-all disabled:opacity-50 active:scale-[0.98]">
                {shipMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Enregistrement...</> : editRate ? 'Enregistrer' : 'Créer le tarif'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ══ MODAL : Tarif service en 2 étapes ════════════════════════ */}
      <Modal
        open={showSvcModal}
        onClose={closeSvcModal}
        title={editSvcRate ? 'Modifier le tarif' : 'Nouveau tarif de service'}
        subtitle={svcStep === 'recuperation' ? 'Étape 1 / 2 — Récupération' : 'Étape 2 / 2 — Livraison'}
        icon={svcStep === 'recuperation' ? <Wrench size={18} className="text-[#FF7A00]" /> : <Wrench size={18} className="text-violet-600" />}
        maxWidth="max-w-lg"
      >
        {/* Indicateur d'étapes */}
        <div className="flex gap-2 mb-6">
          {(['recuperation', 'livraison'] as const).map((s, i) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0 transition-all ${
                svcStep === s ? (s === 'recuperation' ? 'bg-[#FF7A00] text-white' : 'bg-violet-500 text-white')
                : (i < (['recuperation','livraison'] as const).indexOf(svcStep)) ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'
              }`}>{i + 1}</div>
              <span className={`text-xs font-bold ${svcStep === s ? 'text-gray-900' : 'text-gray-400'}`}>
                {s === 'recuperation' ? 'Récupération' : 'Livraison'}
              </span>
              {i === 0 && <div className="flex-1 h-0.5 bg-gray-200 rounded-full mx-1">
                <div className={`h-full rounded-full transition-all duration-300 ${svcStep === 'livraison' ? 'bg-emerald-400 w-full' : 'w-0'}`} />
              </div>}
            </div>
          ))}
        </div>

        {/* Étape Récupération */}
        {svcStep === 'recuperation' && (
          <div className="space-y-4">
            <Field label="Pays de destination" icon={Globe} required>
              <select className={selectCls} value={svcForm.countryId} onChange={(e) => setSvcForm({ ...svcForm, countryId: e.target.value })} disabled={!!editSvcRate}>
                <option value="">Choisir un pays...</option>
                {countries.map((c: Country) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="p-4 rounded-2xl border-2 border-orange-200 bg-[#FFF9F5] space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-xl bg-[#FFF4E8] flex items-center justify-center"><Wrench size={13} className="text-[#FF7A00]" /></div>
                <span className="text-sm font-extrabold text-[#FF7A00]">Service Récupération</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Prix (€)</label>
                <input inputMode="decimal" placeholder="ex : 5.00" required
                  className="w-full px-3 py-2.5 rounded-xl border border-orange-200 bg-white text-gray-900 text-sm font-bold outline-none focus:border-[#FF7A00] focus:ring-4 focus:ring-orange-100 transition-all"
                  value={svcForm.prixRecuperation} onChange={(e) => setSvcForm({ ...svcForm, prixRecuperation: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button type="button" onClick={closeSvcModal}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">Annuler</button>
              <button type="button"
                disabled={!svcForm.countryId || !svcForm.prixRecuperation}
                onClick={() => setSvcStep('livraison')}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FF7A00] hover:bg-[#E06A00] text-white text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]">
                Suivant <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Étape Livraison */}
        {svcStep === 'livraison' && (
          <form onSubmit={(e) => { e.preventDefault(); svcMut.mutate(svcForm); }} className="space-y-4">
            <div className="p-4 rounded-2xl border-2 border-violet-200 bg-violet-50/30 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-xl bg-violet-100 flex items-center justify-center"><Wrench size={13} className="text-violet-600" /></div>
                <span className="text-sm font-extrabold text-violet-700">Service Livraison</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Prix (€)</label>
                <input inputMode="decimal" placeholder="ex : 8.00" required
                  className="w-full px-3 py-2.5 rounded-xl border border-violet-200 bg-white text-gray-900 text-sm font-bold outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 transition-all"
                  value={svcForm.prixLivraison} onChange={(e) => setSvcForm({ ...svcForm, prixLivraison: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setSvcStep('recuperation')}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">← Retour</button>
              <button type="submit" disabled={svcMut.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FF7A00] hover:bg-[#E06A00] text-white text-sm font-bold shadow-lg shadow-[#FF7A00]/25 transition-all disabled:opacity-50 active:scale-[0.98]">
                {svcMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Enregistrement...</> : editSvcRate ? 'Enregistrer' : 'Créer le tarif'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ══ MODAL : Taux de change ════════════════════════════════════ */}
      <Modal
        open={showTauxModal}
        onClose={closeTauxModal}
        title="Modifier le taux de change"
        subtitle={editTaux ? `${editTaux.devise_source} → ${editTaux.devise_cible}` : ''}
        icon={<Coins size={18} className="text-emerald-600" />}
      >
        <form onSubmit={(e) => { e.preventDefault(); tauxMut.mutate(tauxForm); }} className="space-y-4">
          <Field label={`Valeur (1 ${editTaux?.devise_source ?? 'EUR'} = ? ${editTaux?.devise_cible ?? 'FCFA'})`} icon={Coins} required>
            <input inputMode="decimal" required
              className={inputCls}
              placeholder="ex : 655.957"
              value={tauxForm.valeur}
              onChange={(e) => setTauxForm({ valeur: e.target.value })}
            />
          </Field>
          <ModalActions onCancel={closeTauxModal} pending={tauxMut.isPending} isEdit={true} />
        </form>
      </Modal>
    </div>
  );
}
