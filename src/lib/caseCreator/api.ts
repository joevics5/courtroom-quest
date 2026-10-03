import { supabase } from '@/lib/supabase';
import type { AnalysisResult, CoreResult, Draft, DraftEvidence, DraftWitness, GenerateOptions } from './types';
import type { ExistingContext } from './load';

export interface ImproveExtras { existing: ExistingContext; instructions: string }
/** Player "practice" mode: faithful extraction from the user's own notes and/or an uploaded PDF. */
export interface PracticeExtras { document?: { path: string } }

async function invokeStage<T>(
  stage: 'core' | 'analysis', story: string, options: GenerateOptions, core?: CoreResult, extras?: ImproveExtras, practice?: PracticeExtras,
) {
  const { data, error } = await supabase.functions.invoke('generate-case', {
    body: {
      stage, story, options, core, existing: extras?.existing, instructions: extras?.instructions,
      ...(practice ? { mode: 'practice', document: practice.document } : {}),
    },
  });
  if (error) {
    // Surface the server's message (FunctionsHttpError carries the Response in .context)
    let msg = error.message;
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) msg = body.error;
    } catch { /* keep default message */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as { data: T; warnings: string[]; model: string };
}

export const generateCore = (story: string, options: GenerateOptions, extras?: ImproveExtras, practice?: PracticeExtras) =>
  invokeStage<CoreResult>('core', story, options, undefined, extras, practice);
export const generateAnalysis = (story: string, options: GenerateOptions, core: CoreResult, extras?: ImproveExtras, practice?: PracticeExtras) =>
  invokeStage<AnalysisResult>('analysis', story, options, core, extras, practice);

export const EMPTY_ANALYSIS: AnalysisResult = {
  evidence: [], loopholes: [], red_herrings: [], contradictions: [], legal_issues: [],
  objections: [], investigation: [], verdict_issues: [],
};

/** Merge both stages and make sure every editable key exists so the review form can render it. */
export function toDraft(story: string, core: CoreResult, analysis: AnalysisResult = EMPTY_ANALYSIS): Draft {
  return {
    source_story: story,
    ...core,
    ...analysis,
    case: {
      ...core.case,
      estimated_minutes: core.case.estimated_minutes ?? null,
      min_players: core.case.min_players ?? null,
      max_players: core.case.max_players ?? null,
    },
    witnesses: core.witnesses.map((w) => ({ ...w, age: w.age ?? null })),
    evidence: analysis.evidence.map((e) => ({ ...e, secret: { ...e.secret, importance: e.secret.importance ?? null } })),
  };
}

/** The part of the draft stage 2 needs as input (reflects the admin's edits to facts/witnesses). */
export const draftToCore = (d: Draft): CoreResult => ({
  case: d.case, truth: d.truth, facts: d.facts, timeline: d.timeline, theories: d.theories, witnesses: d.witnesses,
});

// ---------- improving an existing case: re-attach DB ids so saving updates rows instead of duplicating them ----------
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const freshCode = (taken: Set<string>, prefix: string) => {
  let n = taken.size + 1;
  while (taken.has(`${prefix}${n}`)) n++;
  const c = `${prefix}${n}`;
  taken.add(c);
  return c;
};

/** AI stage-1 result for an existing case. Matches witnesses by name; anything the AI dropped is kept unchanged. */
export function applyExistingCore(prev: Draft, core: CoreResult): Draft {
  const used = new Set<string>();
  const witnesses: DraftWitness[] = core.witnesses.map((w) => {
    const m = prev.witnesses.find((p) => p._id && !used.has(p._id) && norm(p.name) === norm(w.name));
    if (!m) return { ...w, age: w.age ?? null };
    used.add(m._id!);
    return {
      ...w, _id: m._id, age: w.age ?? m.age ?? null,
      secret: { ...w.secret, evidence_recognized: m.secret.evidence_recognized ?? [], evidence_can_authenticate: m.secret.evidence_can_authenticate ?? [] },
    };
  });
  const taken = new Set(witnesses.map((w) => w.code));
  for (const p of prev.witnesses) {
    if (p._id && !used.has(p._id)) witnesses.push({ ...p, code: taken.has(p.code) ? freshCode(taken, 'W') : p.code });
  }
  return {
    ...prev,
    case: {
      ...core.case,
      title: prev.case.title || core.case.title,
      defendant_name: prev.case.defendant_name || core.case.defendant_name,
      estimated_minutes: core.case.estimated_minutes ?? prev.case.estimated_minutes,
      min_players: core.case.min_players ?? prev.case.min_players,
      max_players: core.case.max_players ?? prev.case.max_players,
    },
    truth: core.truth, facts: core.facts, timeline: core.timeline, theories: core.theories, witnesses,
  };
}

/** AI stage-2 result for an existing case. Matches evidence by title; keeps ids, exhibit labels and dropped items. */
export function applyExistingAnalysis(prev: Draft, a: AnalysisResult): Draft {
  const used = new Set<string>();
  const evidence: DraftEvidence[] = a.evidence.map((e) => {
    const m = prev.evidence.find((p) => p._id && !used.has(p._id) && norm(p.title) === norm(e.title));
    if (!m) return { ...e, secret: { ...e.secret, importance: e.secret.importance ?? null } };
    used.add(m._id!);
    return { ...e, _id: m._id, _exhibit_label: m._exhibit_label, secret: { ...e.secret, importance: e.secret.importance ?? null } };
  });
  const taken = new Set(evidence.map((e) => e.code));
  for (const p of prev.evidence) {
    if (p._id && !used.has(p._id)) evidence.push({ ...p, code: taken.has(p.code) ? freshCode(taken, 'E') : p.code });
  }
  return { ...prev, ...a, evidence };
}
