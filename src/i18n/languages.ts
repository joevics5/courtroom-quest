/**
 * The game's languages.
 *
 * Only languages that are fully set up are active. The rest stay commented out until their
 * interface file, glossary and fonts are done — to launch one, add its locale file, register
 * its loader in ./index.ts, and uncomment its line here.
 *
 * `code` is the app's own key; `htmlLang` is the real BCP-47 tag written to <html lang>.
 * Spanish is Latin American Spanish (es-419), not Spain Spanish.
 */
export interface LanguageInfo {
  code: string;
  /** Name written in the language itself, shown in the picker */
  nativeName: string;
  englishName: string;
  htmlLang: string;
  dir: 'ltr' | 'rtl';
  /**
   * How to tell the AI which language to write in, plus the courtroom vocabulary to use.
   * Left out for English (the prompts are already English).
   */
  ai?: { name: string; style: string };
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', htmlLang: 'en', dir: 'ltr' },
  {
    code: 'es',
    nativeName: 'Español (Latinoamérica)',
    englishName: 'Spanish (Latin America)',
    htmlLang: 'es-419',
    dir: 'ltr',
    ai: {
      name: 'Latin American Spanish',
      style:
        'Write the way people speak in oral, adversarial courtrooms in Latin America (Mexico, Colombia, Peru, Chile). ' +
        'Address the judge as "Su Señoría" and use "usted" in court. Use these terms: objeción; the judge rules "Ha lugar" ' +
        '(sustained) or "No ha lugar" (overruled); interrogatorio directo; contrainterrogatorio; interrogatorio redirecto; ' +
        'alegato de apertura; alegato de clausura; Fiscalía (prosecution); Defensa (defense); la persona acusada; ' +
        'pregunta sugestiva; testimonio de oídas; prueba (evidence); veredicto "culpable" or "no culpable"; ' +
        '"más allá de toda duda razonable"; "carga de la prueba". Avoid gendered wording when a person\'s gender is not known.'
    }
  }
  // Next: Arabic (right-to-left, needs a non-Latin heading font).
  // { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', htmlLang: 'ar', dir: 'rtl' },
  // { code: 'fr', nativeName: 'Français', englishName: 'French', htmlLang: 'fr', dir: 'ltr' },
  // { code: 'pt', nativeName: 'Português (Brasil)', englishName: 'Portuguese', htmlLang: 'pt-BR', dir: 'ltr' },
  // { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', htmlLang: 'hi', dir: 'ltr' },
  // { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', htmlLang: 'id', dir: 'ltr' },
  // { code: 'de', nativeName: 'Deutsch', englishName: 'German', htmlLang: 'de', dir: 'ltr' },
  // { code: 'ja', nativeName: '日本語', englishName: 'Japanese', htmlLang: 'ja', dir: 'ltr' },
  // { code: 'ru', nativeName: 'Русский', englishName: 'Russian', htmlLang: 'ru', dir: 'ltr' },
  // { code: 'it', nativeName: 'Italiano', englishName: 'Italian', htmlLang: 'it', dir: 'ltr' },
  // { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', htmlLang: 'tr', dir: 'ltr' },
  // { code: 'ko', nativeName: '한국어', englishName: 'Korean', htmlLang: 'ko', dir: 'ltr' },
  // { code: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', htmlLang: 'vi', dir: 'ltr' },
  // { code: 'pl', nativeName: 'Polski', englishName: 'Polish', htmlLang: 'pl', dir: 'ltr' },
  // { code: 'nl', nativeName: 'Nederlands', englishName: 'Dutch', htmlLang: 'nl', dir: 'ltr' },
  // { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali', htmlLang: 'bn', dir: 'ltr' },
  // { code: 'ur', nativeName: 'اردو', englishName: 'Urdu', htmlLang: 'ur', dir: 'rtl' },
  // { code: 'th', nativeName: 'ไทย', englishName: 'Thai', htmlLang: 'th', dir: 'ltr' },
  // { code: 'zh', nativeName: '简体中文', englishName: 'Chinese (Simplified)', htmlLang: 'zh-Hans', dir: 'ltr' },
];

export const DEFAULT_LANGUAGE = 'en';
export const LANGUAGE_STORAGE_KEY = 'cq-lang';

export function getLanguage(code: string | null | undefined): LanguageInfo | undefined {
  return LANGUAGES.find(l => l.code === code);
}

export function isEnabledLanguage(code: string | null | undefined): boolean {
  return !!getLanguage(code);
}

/** 'es-MX' -> 'es'. Returns the app code of the first enabled match, or null. */
export function matchBrowserLanguage(tags: readonly string[]): string | null {
  for (const tag of tags) {
    const base = tag.toLowerCase().split('-')[0];
    if (isEnabledLanguage(base)) return base;
  }
  return null;
}

/** Saved choice first, then the browser's language, then English. */
export function detectLanguage(): string {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isEnabledLanguage(saved)) return saved as string;
  } catch {
    /* storage can be blocked; fall through */
  }
  const tags = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
  return matchBrowserLanguage(tags.filter(Boolean)) ?? DEFAULT_LANGUAGE;
}

/**
 * One extra instruction added to every game AI request so replies come back in the player's language.
 * English players get nothing extra. Fixed labels the game reads (JSON keys, "sustained", "win", "GUILTY"...)
 * must stay in English, and replies must never include stage directions.
 */
export function aiLanguageInstruction(code: string | null | undefined): string {
  const ai = getLanguage(code)?.ai;
  if (!ai) return '';
  return (
    `LANGUAGE: Write everything the players will read or hear (speech, testimony, questions, rulings, reasoning, summaries) in ${ai.name}. ` +
    `${ai.style} ` +
    'Keep every JSON key and every fixed label the instructions ask for exactly as written in English ' +
    '(for example "sustained", "overruled", "win", "lose", "GUILTY", "NOT_GUILTY", action names). ' +
    'Never add stage directions such as *sighs* or (looks away).'
  );
}
