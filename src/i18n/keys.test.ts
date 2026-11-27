// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import en from './locales/en.json';

/** Every plain t('some.key') / i18n.t('some.key') in the code must exist in the English file. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

function has(key: string): boolean {
  const parts = key.split('.');
  let node: unknown = en;
  for (const part of parts) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) node = (node as Record<string, unknown>)[part];
    else if (node && typeof node === 'object' && `${part}_one` in (node as Record<string, unknown>)) return true; // plural forms
    else return false;
  }
  return true;
}

describe('translation keys used in the code', () => {
  it('all exist in the English file', () => {
    const missing: string[] = [];
    for (const file of walk('src')) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/(?<![\w.])(?:i18n\.)?t\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        if (!has(m[1])) missing.push(`${file}: ${m[1]}`);
      }
      for (const m of text.matchAll(/i18nKey=\"([a-zA-Z0-9_.]+)\"/g)) {
        if (!has(m[1])) missing.push(`${file}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
