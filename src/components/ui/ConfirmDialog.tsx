import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmer', danger = false, loading }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center gap-4">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${danger ? 'bg-red-50' : 'bg-[#FFF4E8]'}`}>
          <AlertTriangle size={24} className={danger ? 'text-red-500' : 'text-[#FF7A00]'} />
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
        <div className="flex gap-3 w-full">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Annuler</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 justify-center inline-flex items-center gap-2 font-semibold px-5 py-2.5 rounded-xl transition-all text-sm active:scale-95 disabled:opacity-50 ${danger ? 'bg-red-500 text-white hover:bg-red-600' : 'btn-primary'}`}
          >
            {loading && <Spinner size={14} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
