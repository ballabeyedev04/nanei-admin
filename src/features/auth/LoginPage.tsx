import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/auth';
import { PATHS } from '@/router';
import { notifySuccess, notifyError } from '@/utils/notify';
import logger from '@/lib/logger';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const { setAuth }             = useAuthStore();
  const navigate                = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { notifyError('Remplissez tous les champs'); return; }
    setLoading(true);
    try {
      logger.info('Tentative de connexion admin', { email: logger.maskEmail(email) });
      const res = await authApi.login({ identifiant: email, mot_de_passe: password });
      const { token, utilisateur } = res.data;
      if (utilisateur.role !== 'Admin') {
        logger.warn('Tentative connexion refusée — rôle insuffisant', { role: utilisateur.role });
        notifyError('Accès réservé aux administrateurs');
        return;
      }
      setAuth(utilisateur, token);
      logger.action('Admin connecté', { admin_id: utilisateur.id, email: logger.maskEmail(utilisateur.email) });
      notifySuccess(`Bienvenue, ${utilisateur.prenom} !`);
      navigate(PATHS.DASHBOARD);
    } catch (err: any) {
      logger.error('Erreur connexion admin', { page: 'LoginPage', message: err?.response?.data?.message ?? err?.message });
      notifyError(err?.response?.data?.message ?? 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Gauche — branding ── */}
      <div className="hidden lg:flex flex-col w-[52%] bg-[#151515] relative overflow-hidden">

        {/* Cercles décoratifs */}
        <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-[#FF7A00]/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -left-24 w-[320px] h-[320px] rounded-full bg-[#FF7A00]/6 blur-2xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#FF7A00]/3 blur-3xl pointer-events-none" />

        {/* Contenu */}
        <div className="relative z-10 flex flex-col h-full p-14 justify-between">

          {/* Logo + nom */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-xl shadow-black/40 flex-shrink-0 p-1.5">
              <img src="/logo.png" alt="Nanei" className="w-full h-full rounded-xl object-contain" />
            </div>
            <span className="text-white font-bold text-2xl tracking-tight">Nanei</span>
          </div>

          {/* Texte principal centré verticalement */}
          <div className="space-y-6">
            {/* Pill tag */}
            <div className="inline-flex items-center gap-2 bg-[#FF7A00]/15 border border-[#FF7A00]/30 rounded-full px-4 py-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FF7A00] animate-pulse" />
              <span className="text-[#FF7A00] text-xs font-semibold tracking-wide uppercase">Administration</span>
            </div>

            <h1 className="text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
              Expédiez vos colis<br />
              <span className="text-[#FF7A00]">en toute<br />confiance</span>
            </h1>

            <p className="text-white/45 text-base leading-relaxed max-w-xs">
              Tableau de bord admin pour gérer clients, colis et tarifs en temps réel.
            </p>
          </div>

          {/* Footer discret */}
          <p className="text-white/20 text-xs">© {new Date().getFullYear()} Nanei — Tous droits réservés</p>
        </div>
      </div>

      {/* ── Droite — formulaire ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 relative">

        {/* Motif de fond très subtil */}
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#FF7A00 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative w-full max-w-md">

          {/* Logo mobile uniquement */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow flex items-center justify-center flex-shrink-0 p-1">
              <img src="/logo.png" alt="Nanei" className="w-full h-full rounded-lg object-contain" />
            </div>
            <span className="font-bold text-lg text-gray-900">Nanei Admin</span>
          </div>

          {/* Card formulaire */}
          <div className="bg-white rounded-3xl shadow-[0_8px_40px_0_rgba(0,0,0,0.10)] p-9">

            {/* En-tête */}
            <div className="mb-8">
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Connexion</h2>
              <p className="text-gray-400 text-sm mt-1">Accès réservé aux administrateurs</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-gray-700">Adresse email</label>
                <input
                  type="email"
                  placeholder="admin@nanei.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="
                    w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/80
                    text-gray-900 placeholder-gray-400 text-sm font-medium
                    outline-none transition-all duration-200
                    hover:border-gray-300 hover:bg-white
                    focus:border-[#FF7A00] focus:ring-4 focus:ring-[#FF7A00]/10 focus:bg-white
                  "
                />
              </div>

              {/* Mot de passe */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-700">Mot de passe</label>
                  <Link
                    to={PATHS.FORGOT_PASSWORD}
                    className="text-xs font-semibold text-[#FF7A00] hover:text-[#E06A00] transition-colors"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
                <div className="relative group">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="
                      w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 bg-gray-50/80
                      text-gray-900 placeholder-gray-400 text-sm font-medium
                      outline-none transition-all duration-200
                      hover:border-gray-300 hover:bg-white
                      focus:border-[#FF7A00] focus:ring-4 focus:ring-[#FF7A00]/10 focus:bg-white
                    "
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FF7A00] transition-colors duration-200"
                  >
                    {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Bouton */}
              <button
                type="submit"
                disabled={loading}
                className="
                  group w-full flex items-center justify-center gap-2 mt-2
                  bg-[#FF7A00] hover:bg-[#E06A00] active:scale-[0.98]
                  text-white font-bold text-sm py-3.5 rounded-xl
                  transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                  shadow-lg shadow-[#FF7A00]/30 hover:shadow-[#FF7A00]/40
                "
              >
                {loading
                  ? <><Loader2 size={17} className="animate-spin" /> Connexion...</>
                  : <> Se connecter <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" /></>
                }
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
