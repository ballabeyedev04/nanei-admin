import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, Search, CheckCircle, XCircle, Shield,
  UserCog, Eye, EyeOff, Loader2, Mail, Phone, MapPin, Lock, User,
} from 'lucide-react';
import { adminsApi } from '@/api/admins';
import logger from '@/lib/logger';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import { notifySuccess, notifyError } from '@/utils/notify';
import { formatDate } from '@/utils/format';
import { confirmDeactivate, confirmActivate } from '@/utils/confirm';
import type { User as UserType } from '@/types';

interface FormData { nom: string; prenom: string; email: string; mot_de_passe: string; telephone: string; adresse: string; }
const EMPTY: FormData = { nom: '', prenom: '', email: '', mot_de_passe: '', telephone: '', adresse: '' };

/* ── Champ formulaire ─────────────────────────────────────────────── */
function Field({
  label, icon: Icon, required, type = 'text', value, onChange, placeholder, extra,
}: {
  label: string; icon: React.ElementType; required?: boolean;
  type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; extra?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-gray-700">
        {label}{required && <span className="text-[#FF7A00] ml-0.5">*</span>}
      </label>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <Icon size={15} />
        </div>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="
            w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50/80
            text-gray-900 placeholder-gray-400 text-sm font-medium
            outline-none transition-all duration-200
            hover:border-gray-300 hover:bg-white
            focus:border-[#FF7A00] focus:ring-4 focus:ring-[#FF7A00]/10 focus:bg-white
          "
        />
        {extra && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{extra}</div>
        )}
      </div>
    </div>
  );
}

/* ── Page principale ─────────────────────────────────────────────── */
export default function AdminsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [showPwd, setShowPwd] = useState(false);

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const res = await adminsApi.list();
      return (res.data as any).data ?? (res.data as any).admins ?? [];
    },
  });

  const filtered = admins.filter((a: UserType) =>
    search === '' ||
    `${a.nom} ${a.prenom} ${a.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const createMut = useMutation({
    mutationFn: adminsApi.create,
    onSuccess: (_, vars: any) => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      qc.invalidateQueries({ queryKey: ['kpi-admins'] });
      logger.action('Administrateur créé', { email: logger.maskEmail(vars?.email ?? '') });
      notifySuccess('Administrateur créé avec succès');
      setShowCreate(false);
      setForm(EMPTY);
    },
    onError: (e: any) => {
      logger.error('Erreur création admin', { page: 'AdminsPage', message: e?.response?.data?.message ?? e?.message });
      notifyError(e?.response?.data?.message ?? 'Erreur lors de la création');
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'activate' | 'deactivate' }) =>
      action === 'activate' ? adminsApi.activate(id) : adminsApi.deactivate(id),
    onSuccess: (_, { id, action }) => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      logger.action(`Admin ${action === 'activate' ? 'activé' : 'désactivé'}`, { admin_id: id });
      notifySuccess(action === 'activate' ? 'Admin activé' : 'Admin désactivé');
    },
    onError: (e: any) => {
      logger.error('Erreur toggle admin', { page: 'AdminsPage', message: e?.response?.data?.message ?? e?.message });
      notifyError(e?.response?.data?.message ?? 'Erreur');
    },
  });

  const handleToggle = async (a: UserType, action: 'activate' | 'deactivate') => {
    const fullName = `${a.prenom} ${a.nom}`;
    const ok = action === 'deactivate'
      ? await confirmDeactivate(fullName)
      : await confirmActivate(fullName);
    if (ok) toggleMut.mutate({ id: a.id, action });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom || !form.prenom || !form.email || !form.mot_de_passe) {
      notifyError('Remplissez les champs obligatoires'); return;
    }
    createMut.mutate(form);
  };

  const set = (k: keyof FormData) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-7">

      {/* ── En-tête ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Administrateurs</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {admins.length} administrateur{admins.length > 1 ? 's' : ''} enregistré{admins.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#FF7A00] hover:bg-[#E06A00] active:scale-[0.98] text-white font-bold text-sm px-5 py-3 rounded-2xl transition-all duration-200 shadow-lg shadow-[#FF7A00]/30 hover:shadow-[#FF7A00]/40"
        >
          <UserPlus size={16} />
          Ajouter
        </button>
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
            placeholder="Rechercher par nom, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
            >
              Effacer
            </button>
          )}
        </div>

        {isLoading ? <PageSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100">
                  {['Admin', 'Email', 'Téléphone', 'Statut', 'Inscrit le', 'Actions'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center">
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                          <UserCog size={22} className="text-gray-300" />
                        </div>
                        <p className="text-sm text-gray-400 font-medium">Aucun administrateur trouvé</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((a: UserType) => (
                  <tr key={a.id} className="hover:bg-[#FFF9F5] transition-colors duration-150 group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{a.prenom} {a.nom}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Shield size={10} className="text-violet-500" />
                            <span className="text-[11px] text-violet-500 font-semibold">Admin</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{a.email}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{a.telephone ?? '—'}</td>
                    <td className="px-5 py-4">
                      <Badge variant={a.statut === 'actif' ? 'active' : 'inactive'}>
                        {a.statut === 'actif' ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">{a.createdAt ? formatDate(a.createdAt) : '—'}</td>
                    <td className="px-5 py-4">
                      {a.statut === 'actif' ? (
                        <button
                          onClick={() => handleToggle(a, 'deactivate')}
                          className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 font-semibold px-3.5 py-2 rounded-xl text-xs transition-all duration-150 active:scale-95"
                        >
                          <XCircle size={13} /> Désactiver
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggle(a, 'activate')}
                          className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 font-semibold px-3.5 py-2 rounded-xl text-xs transition-all duration-150 active:scale-95"
                        >
                          <CheckCircle size={13} /> Activer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Créer admin ── */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setForm(EMPTY); }}
        title="Nouvel administrateur"
        subtitle="Remplissez les informations du nouveau compte"
        icon={<UserCog size={18} className="text-[#FF7A00]" />}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prénom" icon={User} required value={form.prenom} onChange={set('prenom')} placeholder="Jean" />
            <Field label="Nom"    icon={User} required value={form.nom}    onChange={set('nom')}    placeholder="Dupont" />
          </div>
          <Field label="Adresse email" icon={Mail} required type="email" value={form.email} onChange={set('email')} placeholder="admin@nanei.com" />
          <Field
            label="Mot de passe" icon={Lock} required
            type={showPwd ? 'text' : 'password'}
            value={form.mot_de_passe} onChange={set('mot_de_passe')}
            placeholder="••••••••"
            extra={
              <button type="button" onClick={() => setShowPwd((v) => !v)} className="text-gray-400 hover:text-[#FF7A00] transition-colors">
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
          />
          <Field label="Téléphone" icon={Phone}   value={form.telephone} onChange={set('telephone')} placeholder="+223 xx xx xx xx" />
          <Field label="Adresse"   icon={MapPin}  value={form.adresse}   onChange={set('adresse')}   placeholder="Bamako, Mali" />

          {/* Séparateur */}
          <div className="border-t border-gray-100 pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => { setShowCreate(false); setForm(EMPTY); }}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all duration-150"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createMut.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FF7A00] hover:bg-[#E06A00] text-white text-sm font-bold shadow-lg shadow-[#FF7A00]/25 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {createMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Création...</> : 'Créer le compte'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
