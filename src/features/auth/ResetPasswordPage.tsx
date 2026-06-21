import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle, KeyRound } from 'lucide-react';
import { authApi } from '@/api/auth';
import { PATHS } from '@/router';

/**
 * Règles de mot de passe identiques à la politique backend
 * (validation côté client pour le feedback immédiat)
 */
function validatePassword(pwd: string): string | null {
  if (!pwd || pwd.length < 8)       return 'Au moins 8 caractères.';
  if (!/[A-Z]/.test(pwd))           return 'Au moins une lettre majuscule.';
  if (!/[a-z]/.test(pwd))           return 'Au moins une lettre minuscule.';
  if (!/[0-9]/.test(pwd))           return 'Au moins un chiffre.';
  if (!/[!@#$%^&*]/.test(pwd))      return 'Au moins un caractère spécial (!@#$%^&*).';
  return null;
}

type PageState = 'form' | 'success' | 'invalid-token';

export default function ResetPasswordPage() {
  const [searchParams]              = useSearchParams();
  const navigate                    = useNavigate();
  const token                       = searchParams.get('token') ?? '';

  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [pageState, setPageState]   = useState<PageState>(
    token ? 'form' : 'invalid-token'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError('');

    // Validation côté client
    const policyErr = validatePassword(password);
    if (policyErr) { setFieldError(policyErr); return; }
    if (password !== confirm) { setFieldError('Les mots de passe ne correspondent pas.'); return; }

    setLoading(true);
    try {
      const res = await authApi.adminResetPassword({ token, mot_de_passe: password });
      if (res.data.success) {
        setPageState('success');
        // Redirection automatique vers login après 3 secondes
        setTimeout(() => navigate(PATHS.LOGIN, { replace: true }), 3000);
      } else {
        setFieldError(res.data.message ?? 'Une erreur est survenue.');
      }
    } catch (err: any) {
      const msg: string = err?.response?.data?.message ?? '';
      // Token invalide ou expiré → on bascule sur l'état dédié
      if (
        err?.response?.status === 400 &&
        (msg.toLowerCase().includes('expiré') || msg.toLowerCase().includes('invalide'))
      ) {
        setPageState('invalid-token');
      } else {
        setFieldError(msg || 'Erreur serveur. Veuillez réessayer.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Indicateur de force du mot de passe ──────────────────────────
  function strengthLevel(pwd: string): { level: number; label: string; color: string } {
    if (!pwd) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8)          score++;
    if (/[A-Z]/.test(pwd))        score++;
    if (/[a-z]/.test(pwd))        score++;
    if (/[0-9]/.test(pwd))        score++;
    if (/[!@#$%^&*]/.test(pwd))   score++;
    if (score <= 2) return { level: score, label: 'Faible',  color: 'bg-red-400'    };
    if (score <= 3) return { level: score, label: 'Moyen',   color: 'bg-yellow-400' };
    if (score <= 4) return { level: score, label: 'Bon',     color: 'bg-blue-400'   };
    return              { level: score, label: 'Solide',  color: 'bg-green-500'  };
  }

  const strength = strengthLevel(password);

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
              Nouveau<br />
              <span className="text-[#FF7A00]">mot de<br />passe</span>
            </h1>

            <p className="text-white/45 text-base leading-relaxed max-w-xs">
              Choisissez un mot de passe solide pour sécuriser votre compte administrateur.
            </p>
          </div>

          <p className="text-white/20 text-xs">© {new Date().getFullYear()} Nanei — Tous droits réservés</p>
        </div>
      </div>

      {/* ── Droite — contenu ── */}
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

            {/* ── Succès ── */}
            {pageState === 'success' && (
              <div className="text-center space-y-5">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle size={32} className="text-green-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Mot de passe modifié</h2>
                  <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                    Votre mot de passe a été réinitialisé avec succès. Vous allez être redirigé vers la page de connexion…
                  </p>
                </div>
                <div className="bg-[#FFF4E8] rounded-xl p-4 text-left text-sm text-[#7C2D12]">
                  <p className="font-semibold mb-1">✅ Connexion sécurisée</p>
                  <p className="text-xs text-[#92400E]">Utilisez votre nouveau mot de passe pour vous connecter.</p>
                </div>
                <Link
                  to={PATHS.LOGIN}
                  className="flex items-center justify-center gap-2 text-sm font-semibold text-[#FF7A00] hover:text-[#E06A00] transition-colors"
                >
                  Se connecter maintenant
                </Link>
              </div>
            )}

            {/* ── Token invalide / expiré ── */}
            {pageState === 'invalid-token' && (
              <div className="text-center space-y-5">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
                  <AlertCircle size={32} className="text-red-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Lien invalide</h2>
                  <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                    Ce lien de réinitialisation est invalide ou a expiré (valable 10 minutes). Veuillez faire une nouvelle demande.
                  </p>
                </div>
                <Link
                  to={PATHS.FORGOT_PASSWORD}
                  className="
                    inline-flex items-center justify-center gap-2
                    bg-[#FF7A00] hover:bg-[#E06A00] text-white font-bold text-sm
                    px-6 py-3 rounded-xl transition-all duration-200
                    shadow-lg shadow-[#FF7A00]/30
                  "
                >
                  Faire une nouvelle demande
                </Link>
                <div className="pt-1">
                  <Link
                    to={PATHS.LOGIN}
                    className="text-sm text-gray-400 hover:text-[#FF7A00] transition-colors"
                  >
                    Retour à la connexion
                  </Link>
                </div>
              </div>
            )}

            {/* ── Formulaire ── */}
            {pageState === 'form' && (
              <>
                <div className="mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFF4E8] flex items-center justify-center mb-4">
                    <KeyRound size={22} className="text-[#FF7A00]" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Nouveau mot de passe</h2>
                  <p className="text-gray-400 text-sm mt-1 leading-relaxed">
                    Choisissez un mot de passe sécurisé pour votre compte administrateur.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">

                  {/* Nouveau mot de passe */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-700">Nouveau mot de passe</label>
                    <div className="relative">
                      <input
                        type={showPwd ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setFieldError(''); }}
                        autoComplete="new-password"
                        autoFocus
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
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FF7A00] transition-colors"
                      >
                        {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>

                    {/* Barre de force */}
                    {password && (
                      <div className="space-y-1 pt-1">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                i <= strength.level ? strength.color : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-gray-400">
                          Force : <span className="font-semibold text-gray-600">{strength.label}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirmer le mot de passe */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-gray-700">Confirmer le mot de passe</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirm}
                        onChange={(e) => { setConfirm(e.target.value); setFieldError(''); }}
                        autoComplete="new-password"
                        className={`
                          w-full px-4 py-3 pr-12 rounded-xl border bg-gray-50/80
                          text-gray-900 placeholder-gray-400 text-sm font-medium
                          outline-none transition-all duration-200
                          hover:border-gray-300 hover:bg-white
                          focus:ring-4 focus:bg-white
                          ${confirm && confirm !== password
                            ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                            : confirm && confirm === password
                            ? 'border-green-300 focus:border-green-400 focus:ring-green-100'
                            : 'border-gray-200 focus:border-[#FF7A00] focus:ring-[#FF7A00]/10'
                          }
                        `}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FF7A00] transition-colors"
                      >
                        {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  {/* Prérequis */}
                  <div className="bg-gray-50 rounded-xl p-3.5 text-xs text-gray-500 space-y-1">
                    <p className="font-semibold text-gray-600 mb-1.5">Le mot de passe doit contenir :</p>
                    {[
                      { label: 'Au moins 8 caractères',             ok: password.length >= 8 },
                      { label: 'Une lettre majuscule',              ok: /[A-Z]/.test(password) },
                      { label: 'Une lettre minuscule',              ok: /[a-z]/.test(password) },
                      { label: 'Un chiffre',                        ok: /[0-9]/.test(password) },
                      { label: 'Un caractère spécial (!@#$%^&*)',   ok: /[!@#$%^&*]/.test(password) },
                    ].map(({ label, ok }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                          ok ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'
                        }`}>
                          {ok ? '✓' : '·'}
                        </span>
                        <span className={ok ? 'text-green-600' : ''}>{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Message d'erreur */}
                  {fieldError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-3 text-sm text-red-600">
                      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                      <span>{fieldError}</span>
                    </div>
                  )}

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
                    {loading ? (
                      <><Loader2 size={17} className="animate-spin" /> Modification en cours...</>
                    ) : (
                      'Modifier mon mot de passe'
                    )}
                  </button>
                </form>

                <div className="mt-6 pt-5 border-t border-gray-100 text-center">
                  <Link
                    to={PATHS.LOGIN}
                    className="text-sm text-gray-400 hover:text-[#FF7A00] transition-colors"
                  >
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
