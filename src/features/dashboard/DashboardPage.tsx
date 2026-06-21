import { useQuery } from '@tanstack/react-query';
import { Users, UserCog, Package, Clock, Truck, CheckCircle, TrendingUp, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { clientsApi } from '@/api/clients';
import { adminsApi } from '@/api/admins';
import { colisApi } from '@/api/colis';
import { useAuthStore } from '@/store/authStore';
import { PageSpinner } from '@/components/ui/Spinner';
import { formatDate } from '@/utils/format';
import { Badge } from '@/components/ui/Badge';
import type { Colis } from '@/types';

/* ── KPI Card ──────────────────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, color, bg, accent }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  bg: string;
  accent: string;
}) {
  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] p-5 flex items-center gap-4 overflow-hidden transition-all duration-200 hover:shadow-[0_6px_24px_0_rgba(0,0,0,0.10)] hover:-translate-y-0.5 cursor-default">
      {/* Bande colorée gauche */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${accent}`} />

      {/* Icône */}
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${bg} transition-transform duration-200 group-hover:scale-110`}>
        <Icon size={21} className={color} />
      </div>

      {/* Texte */}
      <div className="min-w-0">
        <p className="text-[26px] font-extrabold text-gray-900 leading-none tracking-tight">{value}</p>
        <p className="text-sm text-gray-500 font-medium mt-1 truncate">{label}</p>
      </div>

      {/* Flèche discrète */}
      <ArrowUpRight size={14} className={`absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${color}`} />
    </div>
  );
}

/* ── Statut badge ──────────────────────────────────────────────────── */
const statusBadge = (s: Colis['statut']) => ({
  en_attente: <Badge variant="pending">En attente</Badge>,
  recupere:   <Badge variant="picked">Récupéré</Badge>,
  livre:      <Badge variant="delivered">Livré</Badge>,
}[s]);

/* ── Page ──────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: nbClients   = 0 } = useQuery({ queryKey: ['kpi-clients'],   queryFn: async () => { const d = (await clientsApi.count()).data as any; return d.total ?? d.nombre ?? 0; } });
  const { data: nbAdmins    = 0 } = useQuery({ queryKey: ['kpi-admins'],    queryFn: async () => { const d = (await adminsApi.count()).data as any;  return d.data  ?? d.nombre ?? 0; } });
  const { data: nbColis     = 0 } = useQuery({ queryKey: ['kpi-colis'],     queryFn: async () => { const d = (await colisApi.count()).data as any;   return d.nombre_colis ?? d.total ?? d.nombre ?? 0; } });
  const { data: nbAttente   = 0 } = useQuery({ queryKey: ['kpi-attente'],   queryFn: async () => { const d = (await colisApi.countEnAttente()).data as any;  return d.nombre_colis ?? d.total ?? d.nombre ?? 0; } });
  const { data: nbRecuperes = 0 } = useQuery({ queryKey: ['kpi-recuperes'], queryFn: async () => { const d = (await colisApi.countRecuperes()).data as any; return d.nombre_colis ?? d.total ?? d.nombre ?? 0; } });
  const { data: nbLivres    = 0 } = useQuery({ queryKey: ['kpi-livres'],    queryFn: async () => { const d = (await colisApi.countLivres()).data as any;    return d.nombre_colis ?? d.total ?? d.nombre ?? 0; } });

  const { data: colisBloqués = [] } = useQuery({
    queryKey: ['colis-bloques'],
    queryFn: async () => {
      const res = await colisApi.enAttente();
      const list: Colis[] = (res.data as any).colis ?? (res.data as any).data ?? [];
      const now = Date.now();
      const TROIS_JOURS = 3 * 24 * 60 * 60 * 1000;
      return list.filter((c) => now - new Date(c.createdAt).getTime() > TROIS_JOURS);
    },
  });

  const { data: recentColis, isLoading } = useQuery({
    queryKey: ['recent-colis'],
    queryFn: async () => {
      const res = await colisApi.list();
      const list: Colis[] = (res.data as any).colis ?? (res.data as any).data ?? [];
      return list.slice(0, 8);
    },
  });

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayFormatted = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <div className="space-y-7">

      {/* ── Alertes colis bloqués ── */}
      {colisBloqués.length > 0 && (
        <div className="bg-[#FFF4E8] border border-[#FF7A00]/30 rounded-2xl px-5 py-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#FF7A00]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle size={16} className="text-[#FF7A00]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#c05c00]">
              {colisBloqués.length} colis en attente depuis plus de 3 jours
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {colisBloqués.map((c) => (
                <span key={c.id} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#FF7A00]/10 text-[#c05c00] text-xs font-bold border border-[#FF7A00]/20">
                  {c.reference}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── En-tête ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            {greet()}{user?.prenom ? `, ${user.prenom}` : ''}
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">{todayFormatted} — Vue d'ensemble de votre activité</p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 bg-[#FF7A00]/8 border border-[#FF7A00]/20 rounded-xl px-3.5 py-2">
          <TrendingUp size={14} className="text-[#FF7A00]" />
          <span className="text-xs font-semibold text-[#FF7A00]">Tableau de bord</span>
        </div>
      </div>

      {/* ── KPIs — ligne 1 : utilisateurs ── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Utilisateurs</p>
        <div className="grid grid-cols-2 gap-4">
          <KpiCard icon={Users}   label="Clients"         value={nbClients} color="text-blue-600"   bg="bg-blue-50"   accent="bg-blue-400"   />
          <KpiCard icon={UserCog} label="Administrateurs" value={nbAdmins}  color="text-violet-600" bg="bg-violet-50" accent="bg-violet-400" />
        </div>
      </div>

      {/* ── KPIs — ligne 2 : colis ── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Colis</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Package}     label="Total colis" value={nbColis}     color="text-[#FF7A00]"  bg="bg-[#FFF4E8]"  accent="bg-[#FF7A00]"  />
          <KpiCard icon={Clock}       label="En attente"  value={nbAttente}   color="text-yellow-600" bg="bg-yellow-50"   accent="bg-yellow-400" />
          <KpiCard icon={Truck}       label="Récupérés"   value={nbRecuperes} color="text-sky-600"    bg="bg-sky-50"     accent="bg-sky-400"    />
          <KpiCard icon={CheckCircle} label="Livrés"      value={nbLivres}    color="text-emerald-600" bg="bg-emerald-50" accent="bg-emerald-400" />
        </div>
      </div>

      {/* ── Tableau derniers colis ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] overflow-hidden">
        {/* Header tableau */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#FFF4E8] flex items-center justify-center">
              <Package size={14} className="text-[#FF7A00]" />
            </div>
            <h2 className="font-bold text-gray-900 text-base">Derniers colis</h2>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            {(recentColis ?? []).length} résultat{(recentColis ?? []).length > 1 ? 's' : ''}
          </span>
        </div>

        {isLoading ? <PageSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100">
                  {['Référence', 'Destination', 'Poids', 'Prix', 'Statut', 'Date'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(recentColis ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">
                      <div className="flex flex-col items-center gap-2">
                        <Package size={28} className="text-gray-200" />
                        <span>Aucun colis enregistré</span>
                      </div>
                    </td>
                  </tr>
                ) : recentColis!.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-[#FFF9F5] transition-colors duration-150 group"
                  >
                    <td className="px-5 py-4">
                      <span className="text-sm font-bold text-[#FF7A00] group-hover:underline underline-offset-2 cursor-pointer">
                        {c.reference}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-700">{c.destination}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{c.poids} kg</td>
                    <td className="px-5 py-4 text-sm font-semibold text-gray-800">{c.prix} €</td>
                    <td className="px-5 py-4">{statusBadge(c.statut)}</td>
                    <td className="px-5 py-4 text-sm text-gray-400">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
