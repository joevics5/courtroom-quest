// Pure helpers for the user-facing Custom Case creator (no React, no Supabase) so they can be unit tested.
import i18n from '../i18n';
import { exhibitLabel } from './exhibitLabel';
import { TIERS, rangeText, tierOf } from './caseCreator/tiers';

/** Below these a case cannot be played (same floor the admin creator enforces). */
export const MIN_WITNESSES = 3;
export const MIN_EVIDENCE = 3;

export const PHOTO_BUCKET = 'witness-photos';
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type CreatorStep = 'info' | 'evidence' | 'witnesses';
export interface Issue { step: CreatorStep; message: string }

export interface CaseInfoInput { title: string; description: string; caseType: string; difficulty: string; defendant_name: string }
export interface EvidenceInput { title: string; description: string; content: string }
export interface WitnessInput { name: string; role: string; background: string; testimony: string }

const blank = (...vals: string[]) => vals.every((v) => !v.trim());

/** A row the user never touched is ignored on save; a half-filled row is a mistake worth flagging. */
export const isBlankEvidence = (e: EvidenceInput) => blank(e.title, e.description, e.content);
export const isBlankWitness = (w: WitnessInput) => blank(w.name, w.role, w.background, w.testimony);

export function validateCustomCase(
  info: CaseInfoInput,
  evidence: EvidenceInput[],
  witnesses: WitnessInput[],
): { errors: Issue[]; warnings: string[] } {
  const errors: Issue[] = [];
  const warnings: string[] = [];
  const err = (step: CreatorStep, message: string) => errors.push({ step, message });

  if (!info.title.trim()) err('info', i18n.t('creator.v.giveTitle'));
  if (!info.description.trim()) err('info', i18n.t('creator.v.addDesc'));
  if (!info.caseType) err('info', i18n.t('creator.v.pickType'));

  const ev = evidence.map((e, i) => ({ e, n: i + 1 })).filter(({ e }) => !isBlankEvidence(e));
  ev.forEach(({ e, n }) => {
    if (!e.title.trim()) err('evidence', i18n.t('creator.v.evNoTitle', { n }));
  });
  const evCount = ev.filter(({ e }) => e.title.trim()).length;
  if (evCount < MIN_EVIDENCE) err('evidence', i18n.t('creator.v.evMin', { min: MIN_EVIDENCE, count: evCount }));

  const wi = witnesses.map((w, i) => ({ w, n: i + 1 })).filter(({ w }) => !isBlankWitness(w));
  wi.forEach(({ w, n }) => {
    if (!w.name.trim()) err('witnesses', i18n.t('creator.v.wNoName', { n }));
    else if (!w.testimony.trim()) err('witnesses', `${w.name.trim()} needs testimony, or the witness will have nothing to say.`);
  });
  const wCount = wi.filter(({ w }) => w.name.trim()).length;
  if (wCount < MIN_WITNESSES) err('witnesses', i18n.t('creator.v.wMin', { min: MIN_WITNESSES, count: wCount }));

  const names = wi.map(({ w }) => w.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) warnings.push(i18n.t('creator.v.sameName'));

  const tier = tierOf(info.difficulty);
  const t = TIERS[tier];
  if (wCount >= MIN_WITNESSES && (wCount < t.witnesses[0] || wCount > t.witnesses[1]))
    warnings.push(`${tier} cases usually have ${rangeText(t.witnesses)} witnesses (you have ${wCount}).`);
  if (evCount >= MIN_EVIDENCE && (evCount < t.evidence[0] || evCount > t.evidence[1]))
    warnings.push(`${tier} cases usually have ${rangeText(t.evidence)} evidence items (you have ${evCount}).`);

  return { errors, warnings };
}

/** First "Exhibit X" label not in `used`. */
export function nextExhibitLabel(used: Iterable<string>): string {
  const taken = new Set([...used].map((s) => s.trim().toLowerCase()));
  for (let i = 0; ; i++) {
    const l = exhibitLabel(i);
    if (!taken.has(l.toLowerCase())) return l;
  }
}

/**
 * One unique label per item. Items keep the label they already have (so saved exhibits are never
 * renumbered); blanks and duplicates get the first unused label.
 */
export function assignExhibitLabels(labels: (string | undefined)[]): string[] {
  const used = new Set<string>();
  const out: (string | null)[] = labels.map((raw) => {
    const l = raw?.trim();
    if (l && !used.has(l.toLowerCase())) { used.add(l.toLowerCase()); return l; }
    return null;
  });
  return out.map((l) => {
    if (l) return l;
    const next = nextExhibitLabel(used);
    used.add(next.toLowerCase());
    return next;
  });
}

export function validatePhoto(file: { type: string; size: number }): string | null {
  if (!PHOTO_TYPES[file.type]) return i18n.t('creator.v.photoType');
  if (file.size > MAX_PHOTO_BYTES) return i18n.t('creator.v.photoBig', { mb: MAX_PHOTO_BYTES / 1024 / 1024 });
  return null;
}

export const photoPath = (userId: string, mime: string, id: string) => `${userId}/${id}.${PHOTO_TYPES[mime] ?? 'jpg'}`;

/** Storage path inside our bucket for a public URL, or null if the URL isn't one of ours. */
export function photoPathFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const marker = `/${PHOTO_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}
