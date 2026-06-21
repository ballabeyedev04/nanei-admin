import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, CheckCircle, XCircle, Users } from 'lucide-react';
import { clientsApi } from '@/api/clients';
import logger from '@/lib/logger';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { getInitials, formatDate } from '@/utils/format';
import { confirmDeactivate, confirmActivate } from '@/utils/confirm';
import { notifySuccess, notifyError } from '@/utils/notify';
import type { User } from '@/types';

export default function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await clientsApi.list();
      return (res.data as any).data ?? (res.data as any).utilisateurs ?? [];
    },
  });

  const filtered = clients.filter((c: User) =>
    search === '' || `${c.nom} ${c.prenom} ${c.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const toggleMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'activate' | 'deactivate' }) =>
      action === 'activate' ? clientsApi.activate(id) : clientsApi.deactivate(id),
    onSuccess: (_, { id, action }) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['kpi-clients'] });
      logger.action(`Client ${action === 'activate' ? 'activé' : 'désactivé'}`, { client_id: id });
      notifySuccess(action === 'activate' ? 'Client activé' : 'Client désactivé');
    },
    onError: (e: any) => {
      logger.error('Erreur toggle client', { page: 'ClientsPage', message: e?.response?.data?.message ?? e?.message });
      notifyError(e?.response?.data?.message ?? 'Erreur');
    },
  });

  const handleToggle = async (c: User, action: 'activate' | 'deactivate') => {
    const fullName = `${c.prenom} ${c.nom}`;
    const ok = action === 'deactivate'
      ? await confirmDeactivate(fullName)
      : await confirmActivate(fullName);
    if (ok) toggleMut.mutate({ id: c.id, action });
  };

  return (
    <div className="space-y-7">

      {/* ── En-tête ── */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Clients</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {clients.length} client{clients.length > 1 ? 's' : ''} enregistré{clients.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Tableau ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] overflow-hidden">

        {/* Barre de recherche */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Search size={14} className="text-gray-400" />
          </div>
          <input
            className="flex-1 text-sm font-medium outline-none placeholder-gray-400 bg-transparent text-gray-900"
            placeholder="Rechercher par nom, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors">
              Effacer
            </button>
          )}
        </div>

        {isLoading ? <PageSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100">
                  {['Client', 'Email', 'Téléphone', 'Adresse', 'Statut', 'Inscrit le', 'Actions'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center">
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                          <Users size={22} className="text-gray-300" />
                        </div>
                        <p className="text-sm text-gray-400 font-medium">Aucun client trouvé</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((c: User) => (
                  <tr key={c.id} className="hover:bg-[#FFF9F5] transition-colors duration-150 group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 text-xs font-extrabold flex-shrink-0">
                          {getInitials(c.nom, c.prenom)}
                        </div>
                        <p className="text-sm font-bold text-gray-900">{c.prenom} {c.nom}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{c.email}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{c.telephone ?? '—'}</td>
                    <td className="px-5 py-4 text-sm text-gray-600 max-w-[160px] truncate">{c.adresse ?? '—'}</td>
                    <td className="px-5 py-4">
                      <Badge variant={c.statut === 'actif' ? 'active' : 'inactive'}>
                        {c.statut === 'actif' ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">{c.createdAt ? formatDate(c.createdAt) : '—'}</td>
                    <td className="px-5 py-4">
                      {c.statut === 'actif' ? (
                        <button
                          onClick={() => handleToggle(c, 'deactivate')}
                          className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 font-semibold px-3.5 py-2 rounded-xl text-xs transition-all duration-150 active:scale-95"
                        >
                          <XCircle size={13} /> Désactiver
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggle(c, 'activate')}
                          className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 font-semibold px-3.5 py-2 rounded-xl text-xs transition-all duration-150 active:scale-95"
                        >
                          <CheckCircle size={13} /> Activer
                        </button>
                      )}
                    </td>
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
