import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCog, Globe,
  LogOut, Menu, ChevronRight, User, MessageSquare, Package, CreditCard,
  AlertTriangle, Star, Shield, BarChart2, Download,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/auth';
import { PATHS } from '@/router';
import { getInitials } from '@/utils/format';
import { confirmLogout } from '@/utils/confirm';
import { notifySuccess } from '@/utils/notify';

const NAV = [
  { to: '/nanei/admin/dashboard',        icon: LayoutDashboard, label: 'Dashboard'         },
  { to: '/nanei/admin/gestion-admin',    icon: UserCog,         label: 'Administrateurs'   },
  { to: '/nanei/admin/gestion-client',   icon: Users,           label: 'Clients'           },
  { to: '/nanei/admin/gestion-colis',    icon: Package,         label: 'Colis'             },
  { to: '/nanei/admin/paiements',        icon: CreditCard,      label: 'Paiements'         },
  { to: '/nanei/admin/gestion-pays',     icon: Globe,           label: 'Pays & Tarifs'     },
  { to: '/nanei/admin/gestion-messages', icon: MessageSquare,   label: 'Messages clients'  },
  { to: '/nanei/admin/reclamations',     icon: AlertTriangle,   label: 'Réclamations'      },
  { to: '/nanei/admin/avis',             icon: Star,            label: 'Avis clients'      },
  { to: '/nanei/admin/audit-logs',       icon: Shield,          label: 'Audit Log'         },
  { to: '/nanei/admin/rapports',         icon: BarChart2,       label: 'Rapports'          },
  { to: '/nanei/admin/export',           icon: Download,        label: 'Export'            },
  { to: '/nanei/admin/profile',          icon: User,            label: 'Mon Profil'        },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const ok = await confirmLogout();
    if (!ok) return;
    try { await authApi.logout(''); } catch (_) {}
    logout();
    navigate(PATHS.LOGIN);
    notifySuccess('À bientôt !');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-lg shadow-orange-900/30 flex-shrink-0 p-1">
            <img src="/logo.png" alt="Nanei" className="w-full h-full rounded-lg object-contain" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">Nanei</p>
            <p className="text-white/40 text-xs">Administration</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                isActive
                  ? 'bg-[#FF7A00] text-white shadow-lg shadow-orange-900/20'
                  : 'text-white/60 hover:bg-white/8 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-60 transition-opacity" />
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 mb-1">
          <div className="w-8 h-8 bg-[#FF7A00] rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user ? getInitials(user.nom, user.prenom) : 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-semibold truncate">{user?.prenom} {user?.nom}</p>
            <p className="text-white/40 text-[10px] truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-[#1E1E1E] flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 bg-[#1E1E1E] h-full flex flex-col z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar mobile */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center flex-shrink-0 p-0.5">
              <img src="/logo.png" alt="Nanei" className="w-full h-full rounded object-contain" />
            </div>
            <span className="font-bold text-sm">Nanei Admin</span>
          </div>
          <div className="w-8 h-8 bg-[#FF7A00] rounded-lg flex items-center justify-center text-white text-xs font-bold">
            {user ? getInitials(user.nom, user.prenom) : 'A'}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
