import { describe, it, expect } from 'vitest';
import { parseFileUrls, firstImageUrl, isImageUrl, checkImageFile } from './caseImages';

const png = 'https://x.supabase.co/storage/v1/object/public/case-images/evidence/a/1.png';

describe('case image helpers', () => {
  it('drops dead browser-only blob links', () => {
    expect(parseFileUrls('blob:https://courtroom-quest.vercel.app/cf8630e8')).toEqual([]);
  });

  it('reads a single URL or a JSON list, keeping only real links', () => {
    expect(parseFileUrls(png)).toEqual([png]);
    expect(parseFileUrls(JSON.stringify([png, 'blob:abc', 'https://x.test/a.pdf']))).toEqual([png, 'https://x.test/a.pdf']);
    expect(parseFileUrls(null)).toEqual([]);
    expect(parseFileUrls('  ')).toEqual([]);
  });

  it('recognises pictures by extension or by the case-images bucket', () => {
    expect(isImageUrl('https://x.test/a.JPG?v=2')).toBe(true);
    expect(isImageUrl('https://x.test/a.pdf')).toBe(false);
    expect(isImageUrl('https://x.test/storage/v1/object/public/case-images/t/9')).toBe(true);
  });

  it('picks the first picture, skipping other attachments', () => {
    expect(firstImageUrl(JSON.stringify(['https://x.test/doc.pdf', png]))).toBe(png);
    expect(firstImageUrl('https://x.test/doc.pdf')).toBeNull();
  });

  it('rejects non-pictures and files over 5 MB', () => {
    expect(checkImageFile(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toMatch(/JPG, PNG/);
    expect(checkImageFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' }))).toMatch(/5 MB/);
    expect(checkImageFile(new File(['x'], 'a.png', { type: 'image/png' }))).toBeNull();
  });
});
