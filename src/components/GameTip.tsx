import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Zap, X } from 'lucide-react';

/** A short, dismissible tip for new players. */
export default function GameTip({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="mt-3 flex items-start gap-3 rounded-2xl border border-[#FFD43B]/40 bg-[#FFD43B]/10 px-4 py-3" role="note">
      <Zap className="w-4 h-4 mt-0.5 flex-none text-[#FFD43B]" />
      <p className="flex-1 text-sm leading-snug text-white/85">{children}</p>
      <button type="button" onClick={() => setOpen(false)} aria-label={t('ui.dismissTip')} className="flex-none p-1 text-white/50 hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
