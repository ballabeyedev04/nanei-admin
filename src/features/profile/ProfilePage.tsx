import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Lock, Pencil, Eye, EyeOff, Phone, MapPin, Mail, ShieldCheck, Loader2 } from 'lucide-react';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import logger from '@/lib/logger';
import { Modal } from '@/components/ui/Modal';
import { getInitials } from '@/utils/format';
import { notifySuccess, notifyError } from '@/utils/notify';

function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
        <Icon size={13} className="text-gray-400" />{label}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm font-medium outline-none focus:border-[#FF7A00] focus:ring-4 focus:ring-[#FF7A00]/10 transition-all';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const qc = useQueryClient();

  /* ── Modal profil ── */
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    nom: user?.nom ?? '',
    prenom: user?.prenom ?? '',
    telephone: user?.telephone ?? '',
    adresse: user?.adresse ?? '',
  });

  const openProfileModal = () => {
    setProfileForm({ nom: user?.nom ?? '', prenom: user?.prenom ?? '', telephone: user?.telephone ?? '', adresse: user?.adresse ?? '' });
    setShowProfileModal(true);
  };

  const updateMut = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (res) => {
      const updated = (res.data as any).utilisateur ?? (res.data as any).user ?? null;
      if (updated) setUser(updated);
      qc.invalidateQueries({ queryKey: ['me'] });
      logger.action('Profil admin mis à jour', { admin_id: user?.id });
      notifySuccess('Profil mis à jour');
      setShowProfileModal(false);
    },
    onError: (e: any) => {
      logger.error('Erreur mise à jour profil', { page: 'ProfilePage', message: e?.response?.data?.message ?? e?.message });
      notifyError(e?.response?.data?.message ?? 'Erreur mise à jour');
    },
  });

  /* ── Modal mot de passe ── */
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ ancien: '', nouveau: '', confirmation: '' });
  const [showPw, setShowPw] = useState(false);

  const closePwModal = () => { setShowPwModal(false); setPwForm({ ancien: '', nouveau: '', confirmation: '' }); setShowPw(false); };

  const pwMut = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      logger.action('Mot de passe admin changé', { admin_id: user?.id });
      notifySuccess('Mot de passe modifié');
      closePwModal();
    },
    onError: (e: any) => {
      logger.error('Erreur changement mot de passe', { page: 'ProfilePage', message: e?.response?.data?.message ?? e?.message });
      notifyError(e?.response?.data?.message ?? 'Erreur');
    },
  });

  const handlePw = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.nouveau !== pwForm.confirmation) { notifyError('Les mots de passe ne correspondent pas'); return; }
    if (pwForm.nouveau.length < 8) { notifyError('Minimum 8 caractères'); return; }
    pwMut.mutate({ ancienMotDePasse: pwForm.ancien, nouveauMotDePasse: pwForm.nouveau });
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mon profil</h1>
        <p className="text-sm text-gray-400 mt-0.5">Gérez vos informations personnelles</p>
      </div>

      {/* Carte identité */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] p-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 bg-[#FFF4E8] rounded-2xl flex items-center justify-center text-[#FF7A00] text-2xl font-extrabold flex-shrink-0 shadow-inner">
            {getInitials(user?.nom ?? '', user?.prenom ?? '')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xl font-extrabold text-gray-900 truncate">{user?.prenom} {user?.nom}</p>
            <p className="text-sm text-gray-400 mt-0.5 truncate">{user?.email}</p>
            <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-violet-600 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full">
              <ShieldCheck size={11} /> Administrateur
            </span>
          </div>
        </div>
      </div>

      {/* Informations personnelles — lecture seule */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#FFF4E8] rounded-xl flex items-center justify-center">
              <User size={15} className="text-[#FF7A00]" />
            </div>
            <h2 className="font-bold text-gray-900">Informations personnelles</h2>
          </div>
          <button
            onClick={openProfileModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-95"
          >
            <Pencil size={13} /> Modifier
          </button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-5">
          <InfoRow icon={User} label="Prénom" value={user?.prenom} />
          <InfoRow icon={User} label="Nom" value={user?.nom} />
          <InfoRow icon={Mail} label="Email" value={user?.email} full />
          <InfoRow icon={Phone} label="Téléphone" value={user?.telephone} />
          <InfoRow icon={MapPin} label="Adresse" value={user?.adresse} />
        </div>
      </div>

      {/* Sécurité */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
              <Lock size={15} className="text-blue-600" />
            </div>
            <h2 className="font-bold text-gray-900">Sécurité</h2>
          </div>
          <button
            onClick={() => setShowPwModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-95"
          >
            <Lock size={13} /> Changer le mot de passe
          </button>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={16} className="text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Mot de passe</p>
              <p className="text-xs text-gray-400 mt-0.5">••••••••••••</p>
            </div>
          </div>
        </div>
      </div>

      {/* ══ MODAL : Modifier le profil ══ */}
      <Modal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title="Modifier le profil"
        subtitle="Mettez à jour vos informations personnelles"
        icon={<User size={18} className="text-[#FF7A00]" />}
        maxWidth="max-w-lg"
      >
        <form onSubmit={(e) => { e.preventDefault(); updateMut.mutate(profileForm); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prénom" icon={User}>
              <input className={inputCls} value={profileForm.prenom} onChange={(e) => setProfileForm({ ...profileForm, prenom: e.target.value })} placeholder="Prénom" />
            </Field>
            <Field label="Nom" icon={User}>
              <input className={inputCls} value={profileForm.nom} onChange={(e) => setProfileForm({ ...profileForm, nom: e.target.value })} placeholder="Nom" />
            </Field>
          </div>
          <Field label="Téléphone" icon={Phone}>
            <input className={inputCls} value={profileForm.telephone} onChange={(e) => setProfileForm({ ...profileForm, telephone: e.target.value })} placeholder="+221..." />
          </Field>
          <Field label="Adresse" icon={MapPin}>
            <input className={inputCls} value={profileForm.adresse} onChange={(e) => setProfileForm({ ...profileForm, adresse: e.target.value })} placeholder="Votre adresse" />
          </Field>
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowProfileModal(false)}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">
              Annuler
            </button>
            <button type="submit" disabled={updateMut.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FF7A00] hover:bg-[#E06A00] text-white text-sm font-bold shadow-lg shadow-[#FF7A00]/25 transition-all disabled:opacity-50 active:scale-[0.98]">
              {updateMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Enregistrement...</> : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══ MODAL : Changer le mot de passe ══ */}
      <Modal
        open={showPwModal}
        onClose={closePwModal}
        title="Changer le mot de passe"
        subtitle="Choisissez un mot de passe fort d'au moins 8 caractères"
        icon={<Lock size={18} className="text-blue-600" />}
        maxWidth="max-w-md"
      >
        <form onSubmit={handlePw} className="space-y-4">
          <PwField label="Mot de passe actuel" value={pwForm.ancien} show={showPw}
            onChange={(v) => setPwForm({ ...pwForm, ancien: v })} />
          <PwField label="Nouveau mot de passe" value={pwForm.nouveau} show={showPw}
            onChange={(v) => setPwForm({ ...pwForm, nouveau: v })} />
          <PwField label="Confirmer le nouveau" value={pwForm.confirmation} show={showPw}
            onChange={(v) => setPwForm({ ...pwForm, confirmation: v })} />

          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={() => setShowPw(!showPw)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${showPw ? 'border-[#FF7A00] text-[#FF7A00] bg-[#FFF4E8]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              {showPw ? <EyeOff size={12} /> : <Eye size={12} />}
              {showPw ? 'Masquer' : 'Afficher'}
            </button>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={closePwModal}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">
              Annuler
            </button>
            <button type="submit" disabled={pwMut.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 active:scale-[0.98]">
              {pwMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Modification...</> : 'Modifier'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, full }: { icon: React.ElementType; label: string; value?: string; full?: boolean }) {
  return (
    <div className={`space-y-1 ${full ? 'col-span-2' : ''}`}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
        <Icon size={11} />{label}
      </p>
      <p className="text-sm font-semibold text-gray-900">{value || <span className="text-gray-300 font-normal italic">Non renseigné</span>}</p>
    </div>
  );
}

function PwField({ label, value, show, onChange }: { label: string; value: string; show: boolean; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
        <Lock size={13} className="text-gray-400" />{label}
      </label>
      <input
        type={show ? 'text' : 'password'}
        required
        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
      />
    </div>
  );
}
