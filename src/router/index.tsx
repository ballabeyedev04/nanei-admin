import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PATHS } from './paths';
import { RequireAdmin, RequireGuest } from './guards';
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

// Les chemins sont dans paths.ts et les gardes (composants) dans guards.tsx :
// un fichier qui mélange composants et autres exports casse le rechargement
// à chaud de Vite (règle react-refresh/only-export-components).

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
    ],
  },

  // Réinitialisation du mot de passe : accessible MÊME si une session admin
  // est ouverte dans ce navigateur (le lien reçu par e-mail ne doit pas
  // rediriger vers le tableau de bord).
  { path: PATHS.RESET_PASSWORD, element: <ResetPasswordPage /> },

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
