import { useState } from 'react';
import { Download, Package, CreditCard } from 'lucide-react';
import { exportApi } from '@/api/export';
import { downloadBlob } from '@/utils/download';
import { notifyError } from '@/utils/notify';
import logger from '@/lib/logger';

type Format = 'csv' | 'xlsx';

interface ColisFilters {
  statut: string;
  date_debut: string;
  date_fin: string;
}

interface PaiementsFilters {
  date_debut: string;
  date_fin: string;
}

function DownloadButton({
  label,
  format,
  loading,
  onClick,
}: {
  label: string;
  format: Format;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-95 disabled:opacity-60 ${
        format === 'csv'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
          : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
      }`}
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : (
        <Download size={14} />
      )}
      {label}
    </button>
  );
}

export default function ExportPage() {
  // Colis filters
  const [colisFilters, setColisFilters] = useState<ColisFilters>({
    statut: '',
    date_debut: '',
    date_fin: '',
  });
  const [loadingColis, setLoadingColis] = useState<Format | null>(null);

  // Paiements filters
  const [paiementsFilters, setPaiementsFilters] = useState<PaiementsFilters>({
    date_debut: '',
    date_fin: '',
  });
  const [loadingPaiements, setLoadingPaiements] = useState<Format | null>(null);

  const exportColis = async (format: Format) => {
    setLoadingColis(format);
    try {
      const params: Record<string, string> = {};
      if (colisFilters.statut)     params.statut     = colisFilters.statut;
      if (colisFilters.date_debut) params.date_debut = colisFilters.date_debut;
      if (colisFilters.date_fin)   params.date_fin   = colisFilters.date_fin;
      logger.action('Export déclenché', { type: 'colis', format, filters: params });
      const res = await exportApi.colis(format, params);
      const ext = format === 'csv' ? 'csv' : 'xlsx';
      downloadBlob(res.data as Blob, `colis-export.${ext}`);
    } catch (err: any) {
      logger.error('Erreur export colis', { page: 'ExportPage', format, message: (err as Error).message });
      notifyError('Erreur lors de l\'export des colis');
    } finally {
      setLoadingColis(null);
    }
  };

  const exportPaiements = async (format: Format) => {
    setLoadingPaiements(format);
    try {
      const params: Record<string, string> = {};
      if (paiementsFilters.date_debut) params.date_debut = paiementsFilters.date_debut;
      if (paiementsFilters.date_fin)   params.date_fin   = paiementsFilters.date_fin;
      logger.action('Export déclenché', { type: 'paiements', format, filters: params });
      const res = await exportApi.paiements(format, params);
      const ext = format === 'csv' ? 'csv' : 'xlsx';
      downloadBlob(res.data as Blob, `paiements-export.${ext}`);
    } catch (err: any) {
      logger.error('Erreur export paiements', { page: 'ExportPage', format, message: (err as Error).message });
      notifyError('Erreur lors de l\'export des paiements');
    } finally {
      setLoadingPaiements(null);
    }
  };

  return (
    <div className="space-y-7">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Export de données</h1>
        <p className="text-gray-400 text-sm mt-0.5">Téléchargez vos données en CSV ou Excel</p>
      </div>

      {/* Section Colis */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FFF4E8] flex items-center justify-center">
            <Package size={18} className="text-[#FF7A00]" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-base">Colis</h2>
            <p className="text-xs text-gray-400">Filtrez et exportez la liste des colis</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Statut</label>
            <select
              value={colisFilters.statut}
              onChange={(e) => setColisFilters((f) => ({ ...f, statut: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/10 transition-all bg-white"
            >
              <option value="">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="recupere">Récupéré</option>
              <option value="livre">Livré</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Date début</label>
            <input
              type="date"
              value={colisFilters.date_debut}
              onChange={(e) => setColisFilters((f) => ({ ...f, date_debut: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/10 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Date fin</label>
            <input
              type="date"
              value={colisFilters.date_fin}
              onChange={(e) => setColisFilters((f) => ({ ...f, date_fin: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/10 transition-all"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <DownloadButton
            label="Exporter CSV"
            format="csv"
            loading={loadingColis === 'csv'}
            onClick={() => exportColis('csv')}
          />
          <DownloadButton
            label="Exporter Excel"
            format="xlsx"
            loading={loadingColis === 'xlsx'}
            onClick={() => exportColis('xlsx')}
          />
        </div>
      </div>

      {/* Section Paiements */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_0_rgba(0,0,0,0.05)] p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <CreditCard size={18} className="text-blue-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-base">Paiements</h2>
            <p className="text-xs text-gray-400">Filtrez et exportez les données de paiement</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Date début</label>
            <input
              type="date"
              value={paiementsFilters.date_debut}
              onChange={(e) => setPaiementsFilters((f) => ({ ...f, date_debut: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/10 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Date fin</label>
            <input
              type="date"
              value={paiementsFilters.date_fin}
              onChange={(e) => setPaiementsFilters((f) => ({ ...f, date_fin: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/10 transition-all"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <DownloadButton
            label="Exporter CSV"
            format="csv"
            loading={loadingPaiements === 'csv'}
            onClick={() => exportPaiements('csv')}
          />
          <DownloadButton
            label="Exporter Excel"
            format="xlsx"
            loading={loadingPaiements === 'xlsx'}
            onClick={() => exportPaiements('xlsx')}
          />
        </div>
      </div>
    </div>
  );
}
