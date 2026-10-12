import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { auditLogsApi } from '@/api/auditLogs';
import { adminsApi } from '@/api/admins';
import { TAILLE_PAGE, versPage } from '@/api/pagination';
import { useDebounce } from '@/hooks/usePagination';
import { Pagination } from '@/components/ui/Pagination';
import { ErreurChargement } from '@/components/ui/ErreurChargement';
import { PageSpinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';
import type { FiltresAudit } from '@/api/auditLogs';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function truncate(str: string, max = 80) {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [adminId, setAdminId] = useState('');
  const [action, setAction] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  // Liste déroulante : appel SANS page → liste complète des admins.
  const { data: adminsData } = useQuery({
    queryKey: ['admins-list'],
    queryFn: async () => {
      const res = await adminsApi.list();
      return res.data.data ?? [];
    },
  });
  // liste-admins exclut l'admin connecté : on l'ajoute pour qu'il puisse
  // filtrer ses propres actions.
  const moi = useAuthStore((s) => s.user);
  const admins: User[] = [
    ...(moi ? [moi] : []),
    ...(adminsData ?? []).filter((a) => a.id !== moi?.id),
  ];

  // Saisie libre de l'action : envoyée au back après 400 ms sans frappe.
  const actionFiltre = useDebounce(action.trim(), 400);

  const { data, isLoading, isError, error: erreurChargement, refetch, isPlaceholderData } = useQuery({
    queryKey: ['audit-logs', { page, adminId, action: actionFiltre, dateDebut, dateFin }],
    queryFn: async () => {
      // Noms de paramètres du back : admin_id, action, date_debut, date_fin
      // (dateDebut / dateFin étaient ignorés : le filtre n'avait aucun effet).
      const params: FiltresAudit = { page, limit: TAILLE_PAGE };
      if (adminId)      params.admin_id   = adminId;
      // Le back compare l'action à l'identique et les stocke en MAJUSCULES
      // (UPDATE_STATUT…) : « update_statut » saisi tel quel ne trouvait rien.
      if (actionFiltre) params.action     = actionFiltre.toUpperCase();
      if (dateDebut)    params.date_debut = dateDebut;
      if (dateFin)      params.date_fin   = dateFin;
      const res = await auditLogsApi.list(params);
      const d = res.data;
      return versPage(d.logs, d.pagination ?? { page: d.page ?? page, limit: TAILLE_PAGE, total: d.total ?? 0, pages: d.pages ?? 1 });
    },
    placeholderData: keepPreviousData,
  });

  const logs = data?.items ?? [];

  // Tout changement de filtre revient à la première page.
  const filtrer = <T,>(maj: (v: T) => void) => (v: T) => { maj(v); setPage(1); };
  const handleFilter = () => { setPage(1); void refetch(); };

  return (
    <div className="space-y-7">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Journal d'audit</h1>
        <p className="text-gray-400 text-sm mt-0.5">Traçabilité des actions administrateurs</p>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Admin */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Administrateur</label>
            <select
              value={adminId}
              onChange={(e) => filtrer(setAdminId)(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/10 transition-all bg-white"
            >
              <option value="">Tous les admins</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>{a.prenom} {a.nom}{a.id === moi?.id ? ' (moi)' : ''}</option>
              ))}
            </select>
          </div>

          {/* Action */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Action</label>
            <input
              type="text"
              value={action}
              onChange={(e) => filtrer(setAction)(e.target.value)}
              placeholder="Ex: UPDATE_STATUT"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/10 transition-all placeholder-gray-400"
            />
          </div>

          {/* Date début */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Date début</label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => filtrer(setDateDebut)(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/10 transition-all"
            />
          </div>

          {/* Date fin */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Date fin</label>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => filtrer(setDateFin)(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/10 transition-all"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleFilter}
            className="px-5 py-2.5 rounded-xl bg-[#FF7A00] text-white text-sm font-bold hover:bg-[#e06900] transition-colors active:scale-95"
          >
            Filtrer
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] overflow-hidden">
        {isLoading ? <PageSpinner /> : isError ? <ErreurChargement erreur={erreurChargement} onRetry={() => refetch()} /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-100">
                    {['Admin', 'Action', 'Entité', 'ID entité', 'Détails', 'IP', 'Date / heure'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-14 text-center">
                        <div className="flex flex-col items-center gap-2.5">
                          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                            <Shield size={22} className="text-gray-300" />
                          </div>
                          <p className="text-sm text-gray-400 font-medium">Aucune entrée trouvée</p>
                        </div>
                      </td>
                    </tr>
                  ) : logs.map((log) => {
                    const detailsStr = log.details ? JSON.stringify(log.details) : '';
                    return (
                      <tr key={log.id} className="hover:bg-[#FFF9F5] transition-colors duration-150">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-sm font-semibold text-gray-900">{log.admin?.prenom} {log.admin?.nom}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-gray-900 text-gray-100 text-[11px] font-mono font-bold tracking-wide">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{log.entite}</td>
                        <td className="px-4 py-3 text-sm font-mono text-[#FF7A00] whitespace-nowrap">{log.entite_id ? log.entite_id.slice(-8) : '—'}</td>
                        <td className="px-4 py-3 max-w-[220px]">
                          {detailsStr ? (
                            <span
                              title={detailsStr}
                              className="text-xs text-gray-500 font-mono cursor-help"
                            >
                              {truncate(detailsStr, 80)}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs italic">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">{log.ip_address ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination pagination={data?.pagination} onChange={setPage} chargement={isPlaceholderData} />
          </>
        )}
      </div>
    </div>
  );
}
