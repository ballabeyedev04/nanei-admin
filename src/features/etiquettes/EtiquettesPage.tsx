import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Tag, Download, Printer, FileCode2, ExternalLink, Copy, Check } from 'lucide-react';
import { colisApi } from '@/api/colis';
import { etiquettesApi } from '@/api/etiquettes';
import logger from '@/lib/logger';
import { PageSpinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/utils/format';
import { downloadBlob } from '@/utils/download';
import { notifyError, notifySuccess } from '@/utils/notify';
import type { Colis } from '@/types';

export default function EtiquettesPage() {
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingZplId, setDownloadingZplId] = useState<string | null>(null);
  const [zplModal, setZplModal] = useState<{ reference: string; content: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: colis = [], isLoading } = useQuery({
    queryKey: ['colis', 'all'],
    queryFn: async () => {
      const res = await colisApi.list();
      return (res.data as any).colis ?? (res.data as any).data ?? [];
    },
  });

  const filtered = colis.filter((c: Colis) =>
    search === '' ||
    c.reference.toLowerCase().includes(search.toLowerCase()) ||
    c.destination.toLowerCase().includes(search.toLowerCase())
  );

  const handleDownload = async (c: Colis) => {
    setDownloadingId(c.id);
    try {
      const res = await etiquettesApi.telecharger(c.id);
      downloadBlob(res.data as Blob, `etiquette-${c.reference}.pdf`);
      logger.action('Étiquette téléchargée', { colis_id: c.id, reference: c.reference });
    } catch (err: any) {
      logger.error('Erreur téléchargement étiquette', { page: 'EtiquettesPage', colis_id: c.id, message: err?.message });
      notifyError('Impossible de télécharger l\'étiquette');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadZpl = async (c: Colis) => {
    setDownloadingZplId(c.id);
    try {
      const res = await etiquettesApi.telechargerZPL(c.id);
      const blob = res.data as Blob;
      const content = await blob.text();
      downloadBlob(blob, `etiquette-${c.reference}.zpl`);
      logger.action('Étiquette ZPL téléchargée', { colis_id: c.id, reference: c.reference });
      setZplModal({ reference: c.reference, content });
    } catch (err: any) {
      logger.error('Erreur téléchargement étiquette ZPL', { page: 'EtiquettesPage', colis_id: c.id, message: err?.message });
      notifyError('Impossible de télécharger le fichier ZPL');
    } finally {
      setDownloadingZplId(null);
    }
  };

  const handleCopyZpl = async () => {
    if (!zplModal) return;
    await navigator.clipboard.writeText(zplModal.content);
    setCopied(true);
    notifySuccess('Contenu ZPL copié');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-7">

      {/* ── En-tête ── */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Étiquettes</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {colis.length} colis · téléchargez l'étiquette d'expédition de n'importe quel colis
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
            placeholder="Rechercher par référence ou destination..."
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
                  {['Référence', 'Expéditeur', 'Destinataire', 'Destination', 'Date', 'Étiquette'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center">
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                          <Tag size={22} className="text-gray-300" />
                        </div>
                        <p className="text-sm text-gray-400 font-medium">Aucun colis trouvé</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((c: Colis) => (
                  <tr key={c.id} className="hover:bg-[#FFF9F5] transition-colors duration-150 group">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-[#FF7A00]">{c.reference}</span>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-700 whitespace-nowrap">
                      {c.expediteur ? `${c.expediteur.prenom} ${c.expediteur.nom}` : '—'}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-700 whitespace-nowrap">
                      {c.recepteur ? `${c.recepteur.prenom} ${c.recepteur.nom}` : '—'}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{c.destination}</td>
                    <td className="px-5 py-4 text-sm text-gray-400 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownload(c)}
                          disabled={downloadingId === c.id}
                          title="Télécharger le PDF"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-[#FF7A00]/30 bg-[#FFF4EC] text-[#FF7A00] hover:bg-[#FF7A00] hover:text-white transition-colors disabled:opacity-50"
                        >
                          {downloadingId === c.id ? (
                            <div className="w-3 h-3 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                          ) : (
                            <Download size={12} />
                          )}
                          PDF
                        </button>
                        <button
                          onClick={() => handleDownloadZpl(c)}
                          disabled={downloadingZplId === c.id}
                          title="Télécharger le fichier ZPL (imprimante thermique 100x150mm)"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-800 hover:text-white hover:border-gray-800 transition-colors disabled:opacity-50"
                        >
                          {downloadingZplId === c.id ? (
                            <div className="w-3 h-3 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                          ) : (
                            <Printer size={12} />
                          )}
                          ZPL
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ MODAL : explication fichier ZPL ══════════════════════════ */}
      <Modal
        open={!!zplModal}
        onClose={() => setZplModal(null)}
        title="Fichier ZPL téléchargé"
        subtitle={zplModal?.reference}
        icon={<FileCode2 size={18} className="text-gray-700" />}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Ce fichier <span className="font-mono font-bold text-gray-800">.zpl</span> n'est pas un document à
            ouvrir comme un PDF — c'est le langage compris nativement par les imprimantes d'étiquettes
            thermiques (Zebra, Godex, TSC…). Pour l'utiliser :
          </p>
          <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
            <li>Branchez votre imprimante thermique à l'ordinateur ou au réseau.</li>
            <li>Ouvrez son utilitaire d'impression (ex : Zebra Setup Utilities) et envoyez-lui ce fichier.</li>
            <li>Ou copiez le contenu ci-dessous et collez-le sur <span className="font-semibold">labelary.com/viewer.html</span> pour voir un aperçu visuel avant impression.</li>
          </ol>
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={handleCopyZpl}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
            >
              {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
              {copied ? 'Copié' : 'Copier le contenu ZPL'}
            </button>
            <a
              href="https://labelary.com/viewer.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FF7A00] hover:bg-[#E06A00] text-white text-sm font-bold shadow-lg shadow-[#FF7A00]/25 transition-all active:scale-[0.98]"
            >
              <ExternalLink size={15} /> Ouvrir l'aperçu
            </a>
          </div>
        </div>
      </Modal>
    </div>
  );
}
