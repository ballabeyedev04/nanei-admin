import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { PATHS } from './paths';

/* ─── Spinner de vérification ─────────────────────────────────────── */
function AuthCheckingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-[#FF7A00]/30 border-t-[#FF7A00] rounded-full animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Vérification en cours…</p>
      </div>
    </div>
  );
}

/* ─── Guard : routes protégées (connecté + Admin obligatoire) ─────── */
export function RequireAdmin() {
  const { checking } = useAuthGuard();
  const isAdmin = useAuthStore((s) => s.isAdmin());

  if (checking) return <AuthCheckingSpinner />;
  if (!isAdmin) return <Navigate to={PATHS.LOGIN} replace />;
  return <Outlet />;
}

/* ─── Guard : routes invités (redirige si déjà connecté Admin) ─────── */
export function RequireGuest() {
  const { checking } = useAuthGuard();
  const isAdmin = useAuthStore((s) => s.isAdmin());

  if (checking) return <AuthCheckingSpinner />;
  if (isAdmin)  return <Navigate to={PATHS.DASHBOARD} replace />;
  return <Outlet />;
}
