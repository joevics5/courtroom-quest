import { supabase } from '@/lib/supabase';
import { exhibitLabel } from '@/lib/exhibitLabel';
import type { Draft, DraftEvidence, DraftWitness } from './types';

// The generated tables (case_secrets etc.) are newer than the generated Supabase types.
const sb = supabase as any;

const int = (v: unknown): number | null => {
  const n = Number(v);
  return v === null || v === '' || v === undefined || !Number.isFinite(n) ? null : Math.round(n);
};
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
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
    evidence_recognized: uniq([...rel(['created', 'knows', 'explains', 'authenticates', 'challenges']), ...(w.secret.evidence_recognized ?? [])]),
    evidence_can_authenticate: uniq([...rel(['created', 'authenticates']), ...(w.secret.evidence_can_authenticate ?? [])]),
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

/** Writes a brand-new case. Rolls the case back on failure. */
async function insertDraft(d: Draft): Promise<string> {
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

const casePayload = (d: Draft) => {
  const c = d.case;
  return {
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
  };
};

const secretsPayload = (d: Draft) => ({
  primary_dispute: d.case.primary_dispute, secondary_disputes: d.case.secondary_disputes,
  truth: d.truth, facts: d.facts, timeline: d.timeline, theories: d.theories,
  loopholes: d.loopholes, red_herrings: d.red_herrings, contradictions: d.contradictions,
  legal_issues: d.legal_issues, objections: d.objections, investigation: d.investigation,
  verdict_issues: d.verdict_issues,
});

/**
 * Updates an existing case in place. Existing rows keep their ids (so player sessions and history stay linked),
 * columns the creator doesn't manage (file_url, tags, relevance, exhibit labels) are never touched, and
 * witnesses/evidence removed in the review screen are deleted unless player history still points at them.
 */
async function updateDraft(d: Draft): Promise<{ caseId: string; warnings: string[] }> {
  const caseId = d._case_id!;
  const warnings: string[] = [];

  const { error: cErr } = await sb.from('cases').update(casePayload(d)).eq('id', caseId);
  if (cErr) throw new Error(`Updating case failed: ${cErr.message}`);

  // ---- witnesses ----
  const { data: oldW } = await sb.from('witnesses').select('id, name').eq('case_id', caseId);
  const keepW = new Set(d.witnesses.map((w) => w._id).filter(Boolean));
  for (const row of (oldW ?? []) as any[]) {
    if (keepW.has(row.id)) continue;
    const { error } = await sb.from('witnesses').delete().eq('id', row.id);
    if (error) warnings.push(`Could not remove witness "${row.name}" (players have already questioned them). It was kept.`);
  }
  const wIds = new Map<string, string>();
  for (const w of d.witnesses) {
    const hasKnowledge = w.secret.knowledge.length > 0;
    const payload: Record<string, any> = {
      code: w.code, name: w.name.trim(), role: w.role.trim() || 'Witness',
      background: w.background.trim(), base_testimony: w.base_testimony.trim(),
      age: int(w.age), occupation: w.occupation?.trim() || null, relationship: w.relationship?.trim() || null,
    };
    // Never blank out the legacy knowledge/personality of a witness we have nothing new for.
    if (hasKnowledge || !w._id) {
      payload.knowledge_scope = deriveKnowledgeScope(w, d.evidence);
      payload.personality_traits = derivePersonality(w);
    }
    if (w._id) {
      const { error } = await sb.from('witnesses').update(payload).eq('id', w._id);
      if (error) throw new Error(`Updating witness ${w.name} failed: ${error.message}`);
      wIds.set(w.code, w._id);
    } else {
      const { data, error } = await sb.from('witnesses').insert({ ...payload, case_id: caseId, use_ai: true }).select('id').single();
      if (error) throw new Error(`Adding witness ${w.name} failed: ${error.message}`);
      wIds.set(w.code, data.id);
    }
  }

  // ---- evidence ----
  const { data: oldE } = await sb.from('evidence').select('id, title, exhibit_label').eq('case_id', caseId);
  const keepE = new Set(d.evidence.map((e) => e._id).filter(Boolean));
  const usedLabels = new Set<string>();
  for (const row of (oldE ?? []) as any[]) {
    if (keepE.has(row.id)) { if (row.exhibit_label) usedLabels.add(row.exhibit_label); continue; }
    const { error } = await sb.from('evidence').delete().eq('id', row.id);
    if (error) warnings.push(`Could not remove evidence "${row.title}" (it is referenced by player history). It was kept.`);
  }
  const nextLabel = () => {
    for (let i = 0; ; i++) {
      const l = exhibitLabel(i);
      if (!usedLabels.has(l)) { usedLabels.add(l); return l; }
    }
  };
  const eIds = new Map<string, string>();
  for (const e of d.evidence) {
    const payload = {
      code: e.code, title: e.title.trim(), description: e.description.trim(), evidence_type: e.evidence_type,
      content: e.content?.trim() || null, is_hidden: !!e.is_hidden,
    };
    if (e._id) {
      const { error } = await sb.from('evidence').update(payload).eq('id', e._id);
      if (error) throw new Error(`Updating evidence ${e.title} failed: ${error.message}`);
      eIds.set(e.code, e._id);
    } else {
      const { data, error } = await sb.from('evidence').insert({ ...payload, case_id: caseId, exhibit_label: nextLabel(), relevance: 'neutral' }).select('id').single();
      if (error) throw new Error(`Adding evidence ${e.title} failed: ${error.message}`);
      eIds.set(e.code, data.id);
    }
  }

  // ---- admin-only data (upsert: old cases have no secret rows yet) ----
  const { error: sErr } = await sb.from('case_secrets').upsert(
    { case_id: caseId, source_story: d.source_story, data: secretsPayload(d), updated_at: new Date().toISOString() },
    { onConflict: 'case_id' },
  );
  if (sErr) throw new Error(`Saving case secrets failed: ${sErr.message}`);

  const { error: wsErr } = await sb.from('witness_secrets').upsert(
    d.witnesses.map((w) => ({ witness_id: wIds.get(w.code), case_id: caseId, data: w.secret, updated_at: new Date().toISOString() })),
    { onConflict: 'witness_id' },
  );
  if (wsErr) throw new Error(`Saving witness secrets failed: ${wsErr.message}`);

  const { error: esErr } = await sb.from('evidence_secrets').upsert(
    d.evidence.map((e) => ({ evidence_id: eIds.get(e.code), case_id: caseId, data: e.secret, updated_at: new Date().toISOString() })),
    { onConflict: 'evidence_id' },
  );
  if (esErr) throw new Error(`Saving evidence secrets failed: ${esErr.message}`);

  return { caseId, warnings };
}

/** Saves the reviewed draft: creates a new case, or updates the existing one when the draft came from loadExistingCase. */
export async function saveDraft(d: Draft): Promise<{ caseId: string; warnings: string[] }> {
  if (d._case_id) return updateDraft(d);
  return { caseId: await insertDraft(d), warnings: [] };
}
