// Upload helpers for the PDF a player gives the AI case parser. Pure checks live here so they can be tested.
export const DOC_BUCKET = 'case-documents';
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

/** Cheap client-side checks; the edge function re-checks everything. */
export async function validatePdf(file: Pick<File, 'name' | 'type' | 'size' | 'slice'>): Promise<string | null> {
  const looksPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!looksPdf) return 'Please choose a PDF file.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_DOC_BYTES) return `That PDF is too large (max ${MAX_DOC_BYTES / 1024 / 1024} MB).`;
  try {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...head.subarray(0, 4)) !== '%PDF') return 'That file does not look like a valid PDF.';
  } catch {
    return 'Could not read that file.';
  }
  return null;
}

export const docPath = (userId: string, id: string) => `${userId}/${id}.pdf`;
