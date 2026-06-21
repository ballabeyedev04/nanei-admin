import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Search, Mail, Send, Clock } from 'lucide-react';
import { messagesApi, type MessageClient } from '@/api/messages';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import { formatDate } from '@/utils/format';
import { notifySuccess, notifyError } from '@/utils/notify';

export default function MessagesPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MessageClient | null>(null);
  const [reponse, setReponse] = useState('');

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const res = await messagesApi.list();
      return res.data?.data ?? [];
    },
  });

  const repondreMut = useMutation({
    mutationFn: ({ id, reponse }: { id: string; reponse: string }) =>
      messagesApi.repondre(id, reponse),
    onSuccess: () => {
      notifySuccess('Réponse envoyée par email avec succès');
      setSelected(null);
      setReponse('');
    },
    onError: (e: any) => notifyError(e?.response?.data?.message ?? 'Erreur lors de l\'envoi'),
  });

  const handleEnvoyer = () => {
    if (!selected || !reponse.trim()) return;
    repondreMut.mutate({ id: selected.id, reponse: reponse.trim() });
  };

  const filtered = messages.filter((m: MessageClient) =>
    search === '' ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.objet.toLowerCase().includes(search.toLowerCase()) ||
    m.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messages clients</h1>
        <p className="text-gray-500 text-sm mt-0.5">{messages.length} message{messages.length > 1 ? 's' : ''} reçu{messages.length > 1 ? 's' : ''}</p>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            className="flex-1 text-sm outline-none placeholder-gray-400 bg-transparent"
            placeholder="Rechercher par email, objet, message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? <PageSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {['Email', 'Objet', 'Message', 'Date', 'Action'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">
                      {search ? `Aucun résultat pour "${search}"` : 'Aucun message reçu pour l\'instant'}
                    </td>
                  </tr>
                ) : filtered.map((m: MessageClient) => (
                  <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Mail size={14} className="text-[#FF7A00]" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{m.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-gray-700 max-w-[180px] truncate">{m.objet}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-500 max-w-[260px]">
                      <span className="line-clamp-2">{m.description}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock size={12} />
                        {m.createdAt ? formatDate(m.createdAt) : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        className="inline-flex items-center gap-1.5 bg-[#FF7A00] text-white font-semibold px-3 py-1.5 rounded-xl text-xs hover:bg-[#e56e00] transition-all active:scale-95"
                        onClick={() => { setSelected(m); setReponse(''); }}
                      >
                        <Send size={12} /> Répondre
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal réponse */}
      <Modal
        open={!!selected}
        onClose={() => { setSelected(null); setReponse(''); }}
        title="Répondre au message"
        maxWidth="max-w-xl"
      >
        {selected && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">De</span>
                <span className="text-sm font-medium text-gray-700">{selected.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Objet</span>
                <span className="text-sm font-semibold text-gray-800">{selected.objet}</span>
              </div>
              <div className="pt-1 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Message</p>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{selected.description}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Votre réponse <span className="text-red-400">*</span>
              </label>
              <textarea
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#FF7A00]/30 focus:border-[#FF7A00] transition-all resize-none"
                rows={5}
                placeholder="Écrivez votre réponse ici..."
                value={reponse}
                onChange={(e) => setReponse(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">
                Cette réponse sera envoyée par email à <strong>{selected.email}</strong>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all"
                onClick={() => { setSelected(null); setReponse(''); }}
              >
                Annuler
              </button>
              <button
                className="inline-flex items-center gap-2 bg-[#FF7A00] text-white font-semibold px-5 py-2 rounded-xl text-sm hover:bg-[#e56e00] transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleEnvoyer}
                disabled={!reponse.trim() || repondreMut.isPending}
              >
                <Send size={14} />
                {repondreMut.isPending ? 'Envoi...' : 'Envoyer la réponse'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
