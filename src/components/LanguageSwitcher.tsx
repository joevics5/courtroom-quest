import { useState } from 'react';
import { Check, Globe, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n/languages';
import { setLanguage } from '../i18n';

/** The list of active languages. Used by the header popup and by Settings. */
export function LanguageList({ onPicked }: { onPicked?: () => void }) {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage || i18n.language;
  const [busy, setBusy] = useState<string | null>(null);

  const pick = async (code: string) => {
    if (code === current || busy) return;
    setBusy(code);
    try {
      await setLanguage(code);
      onPicked?.();
    } catch (err) {
      console.error('Could not switch language:', err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      {LANGUAGES.map(lang => {
        const active = lang.code === current;
        return (
          <button
            key={lang.code}
            onClick={() => pick(lang.code)}
            disabled={busy !== null}
            lang={lang.htmlLang}
            dir={lang.dir}
            className={`w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-start border-2 transition-all disabled:opacity-70 ${
              active ? 'bg-[#FFD43B]/10 border-[#FFD43B]' : 'bg-white/5 border-white/15'
            }`}
          >
            <span className="text-lg font-bold text-white">{lang.nativeName}</span>
            {active && (
              <span className="flex-none flex items-center justify-center w-7 h-7 rounded-full bg-[#FFD43B]">
                <Check className="w-4 h-4 text-black" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Header switch: a globe button that opens the language list. */
export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const code = (i18n.resolvedLanguage || i18n.language || 'en').toUpperCase();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t('language.switcher')}
        className={`flex-none flex items-center justify-center gap-1 h-11 min-w-11 px-3 rounded-full bg-black/55 border border-white/15 text-white ${className}`}
      >
        <Globe className="w-5 h-5" />
        <span className="text-xs font-black tracking-wide">{code}</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('language.choose')}
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#14161f] border border-white/15 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-game text-3xl text-white leading-none">{t('language.choose')}</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label={t('language.close')}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <LanguageList onPicked={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
