import { supabase } from './supabase';

/** Public bucket for case thumbnails and evidence pictures (admins upload, everyone can read). */
export const CASE_IMAGE_BUCKET = 'case-images';
export const MAX_CASE_IMAGE_BYTES = 5 * 1024 * 1024;

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * The file URLs saved on an evidence row (one URL, or a JSON array of them). Browser-only `blob:` links are
 * dropped: they only work inside the tab that created them, so they can never show a picture to anyone else.
 */
export function parseFileUrls(fileUrl?: string | null): string[] {
  const raw = fileUrl?.trim();
  if (!raw) return [];
  let urls: unknown = [raw];
  if (raw.startsWith('[')) {
    try { urls = JSON.parse(raw); } catch { urls = [raw]; }
  }
  return (Array.isArray(urls) ? urls : [raw])
    .filter((u): u is string => typeof u === 'string')
    .map((u) => u.trim())
    .filter((u) => u && !u.startsWith('blob:'));
}

export function isImageUrl(url: string): boolean {
  return IMAGE_EXT.test(url) || url.includes(`/${CASE_IMAGE_BUCKET}/`);
}

/** The first picture attached to an evidence row, if any. */
export function firstImageUrl(fileUrl?: string | null): string | null {
  return parseFileUrls(fileUrl).find(isImageUrl) ?? null;
}

/** A readable reason the file can't be used, or null when it's fine. */
export function checkImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Please choose a JPG, PNG, WebP or GIF picture.';
  if (file.size > MAX_CASE_IMAGE_BYTES) return 'That picture is over 5 MB. Please choose a smaller one.';
  return null;
}

/** Uploads a picture to the public case-images bucket and returns its public URL. Admins only (enforced by the database). */
export async function uploadCaseImage(file: File, folder: string): Promise<string> {
  const problem = checkImageFile(file);
  if (problem) throw new Error(problem);
  const ext = (file.name.split('.').pop() || file.type.split('/')[1] || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(CASE_IMAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000'
  });
  if (error) throw error;
  return supabase.storage.from(CASE_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
