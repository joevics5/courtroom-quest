import { supabase } from '@/lib/supabase';
import type { AnalysisResult, CoreResult, Draft, GenerateOptions } from './types';

async function invokeStage<T>(stage: 'core' | 'analysis', story: string, options: GenerateOptions, core?: CoreResult) {
  const { data, error } = await supabase.functions.invoke('generate-case', {
    body: { stage, story, options, core },
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

export const generateCore = (story: string, options: GenerateOptions) => invokeStage<CoreResult>('core', story, options);
export const generateAnalysis = (story: string, options: GenerateOptions, core: CoreResult) =>
  invokeStage<AnalysisResult>('analysis', story, options, core);

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
