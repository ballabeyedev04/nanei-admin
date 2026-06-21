import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { authApi } from '@/api/auth';
import { PATHS } from '@/router';

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Veuillez saisir votre adresse email.');
      return;
    }

    setLoading(true);
    try {
      await authApi.adminForgotPassword(email.trim());
      setSent(true);
    } catch {
      // On affiche un message générique pour ne pas révéler d'informations
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Gauche — branding ── */}
      <div className="hidden lg:flex flex-col w-[52%] bg-[#151515] relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-[#FF7A00]/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -left-24 w-[320px] h-[320px] rounded-full bg-[#FF7A00]/6 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full p-14 justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-xl shadow-black/40 flex-shrink-0 p-1.5">
              <img src="/logo.png" alt="Nanei" className="w-full h-full rounded-xl object-contain" />
            </div>
            <span className="text-white font-bold text-2xl tracking-tight">Nanei</span>
          </div>

          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-[#FF7A00]/15 border border-[#FF7A00]/30 rounded-full px-4 py-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FF7A00] animate-pulse" />
              <span className="text-[#FF7A00] text-xs font-semibold tracking-wide uppercase">Sécurité</span>
            </div>

            <h1 className="text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
              Accès sécurisé<br />
              <span className="text-[#FF7A00]">pour les<br />admins</span>
            </h1>

            <p className="text-white/45 text-base leading-relaxed max-w-xs">
              Le lien de réinitialisation est réservé aux administrateurs actifs et expire en 10 minutes.
            </p>
          </div>

          <p className="text-white/20 text-xs">© {new Date().getFullYear()} Nanei — Tous droits réservés</p>
        </div>
      </div>

      {/* ── Droite — formulaire ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 relative">
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#FF7A00 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative w-full max-w-md">

          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow flex items-center justify-center flex-shrink-0 p-1">
              <img src="/logo.png" alt="Nanei" className="w-full h-full rounded-lg object-contain" />
            </div>
            <span className="font-bold text-lg text-gray-900">Nanei Admin</span>
          </div>

          <div className="bg-white rounded-3xl shadow-[0_8px_40px_0_rgba(0,0,0,0.10)] p-9">

            {sent ? (
              /* ── État : email envoyé ── */
              <div className="text-center space-y-5">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle size={32} className="text-green-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Email envoyé</h2>
                  <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                    Si votre adresse correspond à un compte administrateur actif, vous recevrez un lien de réinitialisation valable <strong>10 minutes</strong>.
                  </p>
                </div>
                <div className="bg-[#FFF4E8] rounded-xl p-4 text-left text-sm text-[#7C2D12]">
                  <p className="font-semibold mb-1">📬 Vérifiez votre boîte mail</p>
                  <p className="text-xs text-[#92400E]">Pensez également à vérifier votre dossier spam si vous ne trouvez pas l'email.</p>
                </div>
                <Link
                  to={PATHS.LOGIN}
                  className="flex items-center justify-center gap-2 text-sm font-semibold text-[#FF7A00] hover:text-[#E06A00] transition-colors mt-2"
                >
                  <ArrowLeft size={15} />
                  Retour à la connexion
                </Link>
              </div>
            ) : (
              /* ── État : formulaire ── */
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Mot de passe oublié</h2>
                  <p className="text-gray-400 text-sm mt-1 leading-relaxed">
                    Saisissez l'email de votre compte administrateur. Nous vous enverrons un lien de réinitialisation sécurisé.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-700">
                      Adresse email administrateur
                    </label>
                    <div className="relative">
                      <Mail
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                      />
                      <input
                        type="email"
                        placeholder="admin@nanei.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        autoComplete="email"
                        autoFocus
                        className={`
                          w-full pl-10 pr-4 py-3 rounded-xl border bg-gray-50/80
                          text-gray-900 placeholder-gray-400 text-sm font-medium
                          outline-none transition-all duration-200
                          hover:border-gray-300 hover:bg-white
                          focus:border-[#FF7A00] focus:ring-4 focus:ring-[#FF7A00]/10 focus:bg-white
                          ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-gray-200'}
                        `}
                      />
                    </div>
                    {error && (
                      <p className="text-xs text-red-500 font-medium mt-1">{error}</p>
                    )}
                  </div>

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
                    {loading ? (
                      <><Loader2 size={17} className="animate-spin" /> Envoi en cours...</>
                    ) : (
                      'Envoyer le lien de réinitialisation'
                    )}
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-gray-100">
                  <Link
                    to={PATHS.LOGIN}
                    className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#FF7A00] transition-colors"
                  >
                    <ArrowLeft size={15} />
                    Retour à la connexion
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
