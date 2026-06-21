import { X } from 'lucide-react';
import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, subtitle, icon, children, maxWidth = 'max-w-lg' }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-[fadeIn_0.15s_ease]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`relative bg-white rounded-3xl shadow-[0_24px_60px_0_rgba(0,0,0,0.18)] w-full ${maxWidth} max-h-[90vh] flex flex-col animate-[slideUp_0.2s_cubic-bezier(.22,.68,0,1.2)]`}>

        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3.5">
            {icon && (
              <div className="w-10 h-10 rounded-2xl bg-[#FFF4E8] flex items-center justify-center flex-shrink-0">
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">{title}</h2>
              {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-all duration-150 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-7 overflow-y-auto">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
}
