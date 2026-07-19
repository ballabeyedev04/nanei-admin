import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import LoginPage          from '@/features/auth/LoginPage';
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage';
import ResetPasswordPage  from '@/features/auth/ResetPasswordPage';
import DashboardLayout from '@/layouts/DashboardLayout';
import DashboardPage  from '@/features/dashboard/DashboardPage';
import AdminsPage     from '@/features/admins/AdminsPage';
import ClientsPage    from '@/features/clients/ClientsPage';
import ColisPage      from '@/features/colis/ColisPage';
import EtiquettesPage from '@/features/etiquettes/EtiquettesPage';
import CountriesPage  from '@/features/countries/CountriesPage';
import ProfilePage    from '@/features/profile/ProfilePage';
import MessagesPage    from '@/features/messages/MessagesPage';
import PaiementsPage      from '@/features/paiements/PaiementsPage';
import ReclamationsPage  from '@/features/reclamations/ReclamationsPage';
import AvisPage          from '@/features/avis/AvisPage';
import AuditLogPage      from '@/features/audit/AuditLogPage';
import RapportsPage      from '@/features/rapports/RapportsPage';
import ExportPage        from '@/features/export/ExportPage';

export const PATHS = {
  LOGIN:            '/nanei/admin/login',
  FORGOT_PASSWORD:  '/nanei/admin/forgot-password',
  RESET_PASSWORD:   '/nanei/admin/reset-password',
  DASHBOARD:        '/nanei/admin/dashboard',
  ADMINS:           '/nanei/admin/gestion-admin',
  CLIENTS:          '/nanei/admin/gestion-client',
  COLIS:            '/nanei/admin/gestion-colis',
  ETIQUETTES:       '/nanei/admin/etiquettes',
  PAYS:             '/nanei/admin/gestion-pays',
  MESSAGES:         '/nanei/admin/gestion-messages',
  PAIEMENTS:        '/nanei/admin/paiements',
  RECLAMATIONS:     '/nanei/admin/reclamations',
  AVIS:             '/nanei/admin/avis',
  AUDIT_LOGS:       '/nanei/admin/audit-logs',
  RAPPORTS:         '/nanei/admin/rapports',
  EXPORT:           '/nanei/admin/export',
  PROFILE:          '/nanei/admin/profile',
};

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
function RequireAdmin() {
  const { checking } = useAuthGuard();
  const isAdmin = useAuthStore((s) => s.isAdmin());

  if (checking) return <AuthCheckingSpinner />;
  if (!isAdmin) return <Navigate to={PATHS.LOGIN} replace />;
  return <Outlet />;
}

/* ─── Guard : routes invités (redirige si déjà connecté Admin) ─────── */
function RequireGuest() {
  const { checking } = useAuthGuard();
  const isAdmin = useAuthStore((s) => s.isAdmin());

  if (checking) return <AuthCheckingSpinner />;
  if (isAdmin)  return <Navigate to={PATHS.DASHBOARD} replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  // Redirections racines
  { path: '/',      element: <Navigate to={PATHS.DASHBOARD} replace /> },
  { path: '/login', element: <Navigate to={PATHS.LOGIN}     replace /> },

  // Login / pages publiques — accessibles uniquement si NON connecté
  {
    element: <RequireGuest />,
    children: [
      { path: PATHS.LOGIN,           element: <LoginPage /> },
      { path: PATHS.FORGOT_PASSWORD, element: <ForgotPasswordPage /> },
      { path: PATHS.RESET_PASSWORD,  element: <ResetPasswordPage /> },
    ],
  },

  // App admin — accessible uniquement si connecté ET Admin
  {
    element: <RequireAdmin />,
    children: [
      {
        path: '/nanei/admin',
        element: <DashboardLayout />,
        children: [
          { index: true,                    element: <Navigate to={PATHS.DASHBOARD} replace /> },
          { path: 'dashboard',              element: <DashboardPage />  },
          { path: 'gestion-admin',          element: <AdminsPage />     },
          { path: 'gestion-client',         element: <ClientsPage />    },
          { path: 'gestion-colis',          element: <ColisPage />      },
          { path: 'etiquettes',             element: <EtiquettesPage /> },
          { path: 'gestion-pays',           element: <CountriesPage />  },
          { path: 'gestion-messages',       element: <MessagesPage />   },
          { path: 'paiements',              element: <PaiementsPage />    },
          { path: 'reclamations',           element: <ReclamationsPage /> },
          { path: 'avis',                   element: <AvisPage />         },
          { path: 'audit-logs',             element: <AuditLogPage />     },
          { path: 'rapports',               element: <RapportsPage />     },
          { path: 'export',                 element: <ExportPage />       },
          { path: 'profile',                element: <ProfilePage />      },
        ],
      },
    ],
  },

  // Catch-all → dashboard (le guard redirige vers login si non admin)
  { path: '*', element: <Navigate to={PATHS.DASHBOARD} replace /> },
]);
