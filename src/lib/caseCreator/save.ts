import { supabase } from '@/lib/supabase';
import { exhibitLabel } from '@/lib/exhibitLabel';
import type { Draft, DraftEvidence, DraftWitness } from './types';

// The generated tables (case_secrets etc.) are newer than the generated Supabase types.
const sb = supabase as any;

const int = (v: unknown): number | null => {
  const n = Number(v);
  return v === null || v === '' || v === undefined || !Number.isFinite(n) ? null : Math.round(n);
};
const withTrigger = (text: string, trigger: string, label: string) =>
  trigger?.trim() ? `${text} (${label}: ${trigger.trim()})` : text;


/**
 * Turns the fact-ID knowledge model into the flat categories the trial engine's
 * buildWitnessPrompt() already understands (WitnessKnowledgeScope).
 */
export function deriveKnowledgeScope(w: DraftWitness, evidence: DraftEvidence[]) {
  const by = (state: string) => w.secret.knowledge.filter((k) => k.state === state && k.text.trim());
  const rel = (roles: string[]) =>
    evidence
      .filter((e) => e.secret.witnesses.some((x) => x.witness_code === w.code && roles.includes(x.role)))
      .map((e) => e.title);
  return {
    known_facts: by('knows').map((k) => k.text),
    hidden_knowledge: by('hidden').map((k) => withTrigger(k.text, k.reveal_trigger, 'reveals only if')),
    partial_knowledge: by('partial').map((k) => withTrigger(k.text, k.reveal_trigger, 'fuller answer only if')),
    unknown_information: [...by('unknown').map((k) => k.text), ...w.secret.limitations],
    incorrect_beliefs: by('believes_falsely').map((k) => k.text),
    personal_opinions: w.secret.opinions,
    suspicions: w.secret.suspicions,
    secrets: [
      ...w.secret.secrets,
      ...by('lying').map((k) => withTrigger(`You will falsely claim: ${k.text}`, k.reveal_trigger, 'you only admit it if')),
    ],
    motivated_omissions: w.secret.motivated_omissions,
    evidence_recognized: rel(['created', 'knows', 'explains', 'authenticates', 'challenges']),
    evidence_can_authenticate: rel(['created', 'authenticates']),
  };
}

/** The engine reads boolean personality flags (cooperative, defensive, nervous, hostile, deceptive...). */
export function derivePersonality(w: DraftWitness) {
  const text = [...w.personality_traits, w.secret.communication_style, w.secret.emotional_state].join(' ').toLowerCase();
  const has = (re: RegExp) => re.test(text);
  const deceptive = w.secret.truthfulness === 'deceptive';
  const hostile = has(/hostile|aggressive|angry|combative/);
  const defensive = has(/defensive|guarded|evasive|reluctant|withhold/) || w.secret.truthfulness === 'withholding';
  return {
    cooperative: !(hostile || defensive || deceptive),
    defensive, hostile, deceptive,
    nervous: has(/nervous|anxious|fidget|jumpy|stress/),
    detail_oriented: has(/detail|precise|meticulous|methodical/),
    helpful: has(/helpful|forthcoming|friendly|eager/),
    traits: w.personality_traits,
    communication_style: w.secret.communication_style,
  };
}

/** Writes the reviewed draft to Supabase. Returns the new case id. Rolls the case back on failure. */
export async function saveDraft(d: Draft): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('You must be signed in as an admin to save.');

  const c = d.case;
  const { data: caseRow, error: caseErr } = await sb
    .from('cases')
    .insert({
      title: c.title.trim(),
      description: c.description.trim(),
      case_type: c.case_type || 'other',
      difficulty: c.difficulty || 'medium',
      defendant_name: c.defendant_name?.trim() || null,
      subtitle: c.subtitle?.trim() || null,
      jurisdiction: c.jurisdiction?.trim() || null,
      court_type: c.court_type?.trim() || null,
      location: c.location?.trim() || null,
      time_period: c.time_period?.trim() || null,
      estimated_minutes: int(c.estimated_minutes),
      min_players: int(c.min_players),
      max_players: int(c.max_players),
      is_preset: true,
      created_by: auth.user.id,
    })
    .select('id')
    .single();
  if (caseErr) throw new Error(`Saving case failed: ${caseErr.message}`);
  const caseId: string = caseRow.id;

  try {
    // Witnesses
    const { data: wRows, error: wErr } = await sb
      .from('witnesses')
      .insert(
        d.witnesses.map((w) => ({
          case_id: caseId,
          code: w.code,
          name: w.name.trim(),
          role: w.role.trim() || 'Witness',
          background: w.background.trim(),
          base_testimony: w.base_testimony.trim(),
          age: int(w.age),
          occupation: w.occupation?.trim() || null,
          relationship: w.relationship?.trim() || null,
          personality_traits: derivePersonality(w),
          knowledge_scope: deriveKnowledgeScope(w, d.evidence),
          use_ai: true,
        })),
      )
      .select('id, code');
    if (wErr) throw new Error(`Saving witnesses failed: ${wErr.message}`);

    // Evidence
    const { data: eRows, error: eErr } = await sb
      .from('evidence')
      .insert(
        d.evidence.map((e, i) => ({
          case_id: caseId,
          code: e.code,
          exhibit_label: exhibitLabel(i),
          title: e.title.trim(),
          description: e.description.trim(),
          evidence_type: e.evidence_type,
          content: e.content?.trim() || null,
          is_hidden: !!e.is_hidden,
          relevance: 'neutral',
        })),
      )
      .select('id, code');
    if (eErr) throw new Error(`Saving evidence failed: ${eErr.message}`);

    // Admin-only data
    const wId = new Map<string, string>((wRows as any[]).map((r) => [r.code, r.id]));
    const eId = new Map<string, string>((eRows as any[]).map((r) => [r.code, r.id]));

    const { error: sErr } = await sb.from('case_secrets').insert({
      case_id: caseId,
      source_story: d.source_story,
      data: {
        primary_dispute: c.primary_dispute, secondary_disputes: c.secondary_disputes,
        truth: d.truth, facts: d.facts, timeline: d.timeline, theories: d.theories,
        loopholes: d.loopholes, red_herrings: d.red_herrings, contradictions: d.contradictions,
        legal_issues: d.legal_issues, objections: d.objections, investigation: d.investigation,
        verdict_issues: d.verdict_issues,
      },
    });
    if (sErr) throw new Error(`Saving case secrets failed: ${sErr.message}`);

    const { error: wsErr } = await sb.from('witness_secrets').insert(
      d.witnesses.map((w) => ({ witness_id: wId.get(w.code), case_id: caseId, data: w.secret })),
    );
    if (wsErr) throw new Error(`Saving witness secrets failed: ${wsErr.message}`);

    const { error: esErr } = await sb.from('evidence_secrets').insert(
      d.evidence.map((e) => ({ evidence_id: eId.get(e.code), case_id: caseId, data: e.secret })),
    );
    if (esErr) throw new Error(`Saving evidence secrets failed: ${esErr.message}`);

    return caseId;
  } catch (err) {
    // Cascade delete removes any partial witnesses/evidence/secrets
    await sb.from('cases').delete().eq('id', caseId);
    throw err;
  }
}
