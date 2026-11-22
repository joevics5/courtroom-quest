import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, detectLanguage, getLanguage, isEnabledLanguage } from './languages';

/** Other languages load only when chosen, so English players never download them. */
const LOADERS: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  es: () => import('./locales/es.json')
};

function applyDocumentLanguage(code: string) {
  const info = getLanguage(code);
  if (!info || typeof document === 'undefined') return;
  document.documentElement.lang = info.htmlLang;
  document.documentElement.dir = info.dir;
}

async function ensureLoaded(code: string) {
  if (code === DEFAULT_LANGUAGE || i18n.hasResourceBundle(code, 'translation')) return;
  const loader = LOADERS[code];
  if (!loader) throw new Error(`No locale file registered for "${code}"`);
  const mod = await loader();
  i18n.addResourceBundle(code, 'translation', mod.default, true, true);
}

/** Switch language and remember the choice on this device. */
export async function setLanguage(code: string): Promise<void> {
  if (!isEnabledLanguage(code)) return;
  await ensureLoaded(code);
  await i18n.changeLanguage(code);
  applyDocumentLanguage(code);
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    /* storage can be blocked; the choice just won't persist */
  }
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: Object.keys(LOADERS).concat(DEFAULT_LANGUAGE),
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false
});

/** Resolves once the starting language (saved choice or browser language) is loaded. */
export const i18nReady: Promise<void> = (async () => {
  const code = detectLanguage();
  if (code !== DEFAULT_LANGUAGE) {
    try {
      await ensureLoaded(code);
      await i18n.changeLanguage(code);
    } catch (err) {
      console.error('Could not load language, using English:', err);
    }
  }
  applyDocumentLanguage(i18n.language || DEFAULT_LANGUAGE);
})();

export default i18n;
