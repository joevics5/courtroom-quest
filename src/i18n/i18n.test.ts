import { describe, it, expect, beforeEach } from 'vitest';
import en from './locales/en.json';
import es from './locales/es.json';
import i18n, { setLanguage } from './index';
import { LANGUAGES, matchBrowserLanguage, detectLanguage, LANGUAGE_STORAGE_KEY } from './languages';

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const placeholders = (s: string) => (s.match(/\{\{\s*\w+\s*\}\}|<\/?\w+>/g) ?? []).map(p => p.replace(/\s/g, '')).sort();

describe('language registry', () => {
  it('only has fully set-up languages enabled', () => {
    expect(LANGUAGES.map(l => l.code)).toEqual(['en', 'es']);
  });

  it('matches browser tags to enabled languages', () => {
    expect(matchBrowserLanguage(['es-MX', 'en'])).toBe('es');
    expect(matchBrowserLanguage(['es-AR'])).toBe('es');
    expect(matchBrowserLanguage(['fr-FR', 'es-CO'])).toBe('es');
    expect(matchBrowserLanguage(['fr-FR', 'ja'])).toBeNull();
  });

  describe('detectLanguage', () => {
    beforeEach(() => window.localStorage.clear());
    it('prefers the saved choice', () => {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');
      expect(detectLanguage()).toBe('es');
    });
    it('ignores a saved language that is not enabled', () => {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'ar');
      expect(detectLanguage()).toBe('en');
    });
  });
});

describe('locale files', () => {
  const enFlat = flatten(en as Tree);
  const esFlat = flatten(es as Tree);

  it('Spanish has exactly the same keys as English', () => {
    expect(Object.keys(esFlat).sort()).toEqual(Object.keys(enFlat).sort());
  });

  it('Spanish keeps every placeholder and tag from English', () => {
    for (const key of Object.keys(enFlat)) {
      expect(placeholders(esFlat[key]), key).toEqual(placeholders(enFlat[key]));
    }
  });

  it('has no empty strings', () => {
    for (const [key, value] of Object.entries(esFlat)) expect(value.trim(), key).not.toBe('');
  });
});

describe('switching language', () => {
  beforeEach(() => window.localStorage.clear());

  it('changes text, remembers the choice and sets <html lang>', async () => {
    await setLanguage('es');
    expect(i18n.t('settings.title')).toBe('AJUSTES');
    expect(document.documentElement.lang).toBe('es-419');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('es');
    await setLanguage('en');
    expect(i18n.t('settings.title')).toBe('SETTINGS');
    expect(document.documentElement.lang).toBe('en');
  });

  it('ignores languages that are not enabled', async () => {
    await setLanguage('ar');
    expect(i18n.language).toBe('en');
  });
});
