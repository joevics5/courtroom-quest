import {
  MIN_EVIDENCE, MIN_WITNESSES, assignExhibitLabels, isBlankEvidence, isBlankWitness, nextExhibitLabel,
  photoPath, photoPathFromUrl, validateCustomCase, validatePhoto,
} from './customCase';

const info = { title: 'State v. Doe', description: 'A burglary.', caseType: 'burglary', difficulty: 'easy', defendant_name: 'Doe' };
const ev = (title: string) => ({ title, description: 'd', content: 'c' });
const wi = (name: string, testimony = 'I saw it.') => ({ name, role: 'neighbor', background: '', testimony });
const three = <T,>(f: (n: number) => T) => [1, 2, 3].map(f);

describe('validateCustomCase', () => {
  it('accepts a complete case', () => {
    const r = validateCustomCase(info, three((n) => ev(`E${n}`)), three((n) => wi(`W${n}`)));
    expect(r.errors).toEqual([]);
  });

  it('requires title, description and the minimum counts', () => {
    const r = validateCustomCase({ ...info, title: ' ', description: '' }, [ev('a')], [wi('x')]);
    const msgs = r.errors.map((e) => e.message).join('|');
    expect(msgs).toMatch(/title/);
    expect(msgs).toMatch(/description/);
    expect(msgs).toContain(`at least ${MIN_EVIDENCE} evidence`);
    expect(msgs).toContain(`at least ${MIN_WITNESSES} witnesses`);
  });

  it('ignores untouched blank rows but flags half-filled ones', () => {
    const blankE = { title: '', description: '', content: '' };
    const blankW = { name: '', role: '', background: '', testimony: '' };
    const ok = validateCustomCase(info, [...three((n) => ev(`E${n}`)), blankE], [...three((n) => wi(`W${n}`)), blankW]);
    expect(ok.errors).toEqual([]);

    const bad = validateCustomCase(
      info,
      [...three((n) => ev(`E${n}`)), { title: '', description: 'orphan', content: '' }],
      [...three((n) => wi(`W${n}`)), { ...blankW, testimony: 'no name' }],
    );
    expect(bad.errors.map((e) => e.message)).toEqual(
      expect.arrayContaining(['Evidence 4 has details but no title.', 'Witness 4 has details but no name.']),
    );
  });

  it('requires testimony for named witnesses', () => {
    const r = validateCustomCase(info, three((n) => ev(`E${n}`)), [wi('A'), wi('B'), wi('C', '  ')]);
    expect(r.errors.some((e) => e.step === 'witnesses' && /needs testimony/.test(e.message))).toBe(true);
  });

  it('warns (does not block) when counts miss the difficulty range or names repeat', () => {
    const r = validateCustomCase({ ...info, difficulty: 'hard' }, three((n) => ev(`E${n}`)), [wi('A'), wi('a'), wi('C')]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('|')).toMatch(/hard cases usually have 9-12 witnesses/);
    expect(r.warnings.join('|')).toMatch(/share the same name/);
  });

  it('treats whitespace-only rows as blank', () => {
    expect(isBlankEvidence({ title: ' ', description: '', content: '\n' })).toBe(true);
    expect(isBlankWitness({ name: '', role: '', background: '', testimony: ' ' })).toBe(true);
  });
});

describe('exhibit labels', () => {
  it('picks the first unused label (the delete-then-add duplicate bug)', () => {
    expect(nextExhibitLabel(['Exhibit A', 'Exhibit C'])).toBe('Exhibit B');
    expect(nextExhibitLabel([])).toBe('Exhibit A');
  });

  it('keeps existing labels, fixes duplicates and blanks', () => {
    expect(assignExhibitLabels(['Exhibit A', 'Exhibit C', undefined, 'Exhibit C', ''])).toEqual([
      'Exhibit A', 'Exhibit C', 'Exhibit B', 'Exhibit D', 'Exhibit E',
    ]);
  });

  it('is case-insensitive and handles more than 26 items', () => {
    expect(nextExhibitLabel(['exhibit a'])).toBe('Exhibit B');
    const many = assignExhibitLabels(Array(30).fill(undefined));
    expect(new Set(many).size).toBe(30);
  });
});

describe('photos', () => {
  it('validates type and size', () => {
    expect(validatePhoto({ type: 'image/png', size: 1000 })).toBeNull();
    expect(validatePhoto({ type: 'image/gif', size: 1000 })).toMatch(/JPG, PNG or WebP/);
    expect(validatePhoto({ type: 'image/jpeg', size: 3 * 1024 * 1024 })).toMatch(/too large/);
  });

  it('builds a per-user path and maps a public URL back to it', () => {
    const p = photoPath('user-1', 'image/webp', 'abc');
    expect(p).toBe('user-1/abc.webp');
    const url = `https://x.supabase.co/storage/v1/object/public/witness-photos/${p}?t=1`;
    expect(photoPathFromUrl(url)).toBe(p);
    expect(photoPathFromUrl('https://elsewhere.com/a.png')).toBeNull();
    expect(photoPathFromUrl(undefined)).toBeNull();
  });
});
