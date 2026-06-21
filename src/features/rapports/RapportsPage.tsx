import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, RefreshCw } from 'lucide-react';
import { rapportsApi } from '@/api/rapports';
import logger from '@/lib/logger';
import { PageSpinner } from '@/components/ui/Spinner';
import { downloadBlob } from '@/utils/download';
import { notifySuccess, notifyError } from '@/utils/notify';
import type { Rapport } from '@/types';

export default function RapportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: rapports = [], isLoading } = useQuery({
    queryKey: ['rapports'],
    queryFn: async () => {
      const res = await rapportsApi.list();
      const raw = res.data as any;
      return (raw.data ?? raw.rapports ?? []) as Rapport[];
    },
  });

  const generateMut = useMutation({
    mutationFn: () => rapportsApi.generate(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rapports'] });
      logger.action('Rapport généré');
      notifySuccess('Rapport généré avec succès');
    },
    onError: (e: any) => {
      logger.error('Erreur génération rapport', { page: 'RapportsPage', message: e?.response?.data?.message ?? e?.message });
      notifyError(e?.response?.data?.message ?? 'Erreur lors de la génération');
    },
  });

  const handleDownload = async (rapport: Rapport) => {
    setDownloading(rapport.filename);
    try {
      logger.action('Export déclenché', { type: 'rapport', format: 'pdf', filename: rapport.filename });
      const res = await rapportsApi.download(rapport.filename);
      downloadBlob(res.data as Blob, rapport.filename);
    } catch (err: any) {
      logger.error('Erreur téléchargement rapport', { page: 'RapportsPage', filename: rapport.filename, message: (err as Error).message });
      notifyError('Impossible de télécharger ce rapport');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-7">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Rapports financiers</h1>
          <p className="text-gray-400 text-sm mt-0.5">Générés automatiquement le 1er de chaque mois</p>
        </div>
        <button
          onClick={() => generateMut.mutate()}
          disabled={generateMut.isPending}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF7A00] text-white text-sm font-bold hover:bg-[#e06900] transition-colors disabled:opacity-60 active:scale-95"
        >
          <RefreshCw size={14} className={generateMut.isPending ? 'animate-spin' : ''} />
          {generateMut.isPending ? 'Génération…' : 'Générer maintenant'}
        </button>
      </div>

      {/* Grille rapports */}
      {isLoading ? <PageSpinner /> : rapports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] p-16 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
            <FileText size={26} className="text-red-400" />
          </div>
          <p className="text-sm text-gray-500 font-medium text-center max-w-sm">
            Aucun rapport généré. Les rapports sont générés automatiquement le 1er de chaque mois.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {rapports.map((rapport) => (
            <div
              key={rapport.filename}
              className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] p-5 flex items-center gap-4 hover:shadow-[0_6px_24px_0_rgba(0,0,0,0.10)] transition-all duration-200 hover:-translate-y-0.5"
            >
              {/* Icône PDF */}
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <FileText size={22} className="text-red-500" />
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">
                  Rapport — {rapport.label ?? `${rapport.mois} ${rapport.annee}`}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{rapport.filename}</p>
              </div>

              {/* Bouton télécharger */}
              <button
                onClick={() => handleDownload(rapport)}
                disabled={downloading === rapport.filename}
                className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#FF7A00] flex items-center justify-center text-white hover:bg-[#e06900] transition-colors disabled:opacity-60 active:scale-95"
                title="Télécharger"
              >
                {downloading === rapport.filename ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
