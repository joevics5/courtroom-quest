import { supabase } from '@/lib/supabase';
import { BLANK_EVIDENCE, BLANK_THEORY, BLANK_TRUTH, BLANK_WITNESS } from './blank';
import type { Draft, DraftEvidence, DraftWitness, KnowledgeState } from './types';

const sb = supabase as any;
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

/** What the AI sees of the existing case so it keeps and builds on it. */
export interface ExistingContext {
  case: Record<string, any>;
  witnesses: Record<string, any>[];
  evidence: Record<string, any>[];
  facts?: Record<string, any>[];
}

function legacyWitnessSecret(row: any) {
  const ks = row.knowledge_scope ?? {};
  const entries: DraftWitness['secret']['knowledge'] = [];
  const push = (list: unknown, state: KnowledgeState) =>
    arr(list).forEach((text) => entries.push({ fact_id: '', state, text, reveal_trigger: '' }));
  push(ks.known_facts, 'knows');
  push(ks.hidden_knowledge, 'hidden');
  push(ks.partial_knowledge, 'partial');
  push(ks.unknown_information, 'unknown');
  push(ks.incorrect_beliefs, 'believes_falsely');
  return {
    knowledge: entries,
    opinions: arr(ks.personal_opinions),
    suspicions: arr(ks.suspicions),
    secrets: arr(ks.secrets),
    motivated_omissions: arr(ks.motivated_omissions),
    evidence_recognized: arr(ks.evidence_recognized),
    evidence_can_authenticate: arr(ks.evidence_can_authenticate),
  };
}

function traitsOf(row: any): string[] {
  const p = row.personality_traits;
  if (!p || typeof p !== 'object') return [];
  if (Array.isArray(p.traits)) return arr(p.traits);
  return Object.entries(p).filter(([, v]) => v === true).map(([k]) => k);
}

const unique = (code: string, taken: Set<string>, prefix: string, n: number) => {
  let c = code || `${prefix}${n}`;
  let i = n;
  while (taken.has(c)) c = `${prefix}${++i}`;
  taken.add(c);
  return c;
};

export async function loadExistingCase(caseId: string): Promise<{ draft: Draft; context: ExistingContext }> {
  const [caseRes, wRes, eRes, csRes, wsRes, esRes] = await Promise.all([
    sb.from('cases').select('*').eq('id', caseId).single(),
    sb.from('witnesses').select('*').eq('case_id', caseId).order('created_at', { ascending: true }),
    sb.from('evidence').select('*').eq('case_id', caseId).order('created_at', { ascending: true }),
    sb.from('case_secrets').select('*').eq('case_id', caseId).maybeSingle(),
    sb.from('witness_secrets').select('*').eq('case_id', caseId),
    sb.from('evidence_secrets').select('*').eq('case_id', caseId),
  ]);
  if (caseRes.error) throw new Error(`Could not load case: ${caseRes.error.message}`);
  for (const r of [wRes, eRes]) if (r.error) throw new Error(r.error.message);
  // The secret tables may be empty (old cases) or blocked for non-admins; treat that as "no secrets yet".
  const cs = csRes.data?.data ?? {};
  const wSecrets = new Map<string, any>((wsRes.data ?? []).map((r: any) => [r.witness_id, r.data]));
  const eSecrets = new Map<string, any>((esRes.data ?? []).map((r: any) => [r.evidence_id, r.data]));

  const c = caseRes.data;
  const wCodes = new Set<string>();
  const eCodes = new Set<string>();

  const witnesses: DraftWitness[] = (wRes.data ?? []).map((row: any, i: number) => {
    const base = BLANK_WITNESS(i + 1);
    const stored = wSecrets.get(row.id);
    const secret = stored
      ? { ...base.secret, ...stored, sample_questions: { ...base.secret.sample_questions, ...(stored.sample_questions ?? {}) } }
      : { ...base.secret, ...legacyWitnessSecret(row) };
    return {
      ...base,
      _id: row.id,
      code: unique(row.code, wCodes, 'W', i + 1),
      name: row.name ?? '',
      age: row.age ?? null,
      occupation: row.occupation ?? '',
      role: row.role ?? '',
      relationship: row.relationship ?? '',
      background: row.background ?? '',
      base_testimony: row.base_testimony ?? '',
      personality_traits: traitsOf(row),
      secret,
    };
  });

  const evidence: DraftEvidence[] = (eRes.data ?? []).map((row: any, i: number) => {
    const base = BLANK_EVIDENCE(i + 1);
    const stored = eSecrets.get(row.id);
    return {
      ...base,
      _id: row.id,
      _exhibit_label: row.exhibit_label ?? undefined,
      code: unique(row.code, eCodes, 'E', i + 1),
      title: row.title ?? '',
      evidence_type: row.evidence_type ?? 'documents',
      description: row.description ?? '',
      content: row.content ?? '',
      is_hidden: !!row.is_hidden,
      secret: stored
        ? { ...base.secret, ...stored, generation: { ...base.secret.generation, ...(stored.generation ?? {}) } }
        : base.secret,
    };
  });

  const composed = [
    `${c.title}`,
    c.description,
    c.defendant_name ? `Defendant: ${c.defendant_name}` : '',
    witnesses.length ? `Witnesses: ${witnesses.map((w) => `${w.name} (${w.role})`).join('; ')}` : '',
    evidence.length ? `Evidence: ${evidence.map((e) => e.title).join('; ')}` : '',
  ].filter(Boolean).join('\n');
  const source_story = (csRes.data?.source_story as string) || composed.padEnd(80, ' ');

  const draft: Draft = {
    _case_id: caseId,
    source_story,
    case: {
      title: c.title ?? '', subtitle: c.subtitle ?? '', case_type: c.case_type ?? 'other', difficulty: c.difficulty ?? 'medium',
      defendant_name: c.defendant_name ?? '', description: c.description ?? '', jurisdiction: c.jurisdiction ?? '',
      court_type: c.court_type ?? '', location: c.location ?? '', time_period: c.time_period ?? '',
      estimated_minutes: c.estimated_minutes ?? null, min_players: c.min_players ?? null, max_players: c.max_players ?? null,
      primary_dispute: cs.primary_dispute ?? '', secondary_disputes: arr(cs.secondary_disputes),
    },
    truth: { ...BLANK_TRUTH(), ...(cs.truth ?? {}) },
    facts: cs.facts ?? [],
    timeline: cs.timeline ?? [],
    theories: {
      prosecution: { ...BLANK_THEORY(), ...(cs.theories?.prosecution ?? {}) },
      defence: { ...BLANK_THEORY(), ...(cs.theories?.defence ?? {}) },
      alternative: { ...BLANK_THEORY(), ...(cs.theories?.alternative ?? {}) },
    },
    witnesses,
    evidence,
    loopholes: cs.loopholes ?? [],
    red_herrings: cs.red_herrings ?? [],
    contradictions: cs.contradictions ?? [],
    legal_issues: cs.legal_issues ?? [],
    objections: cs.objections ?? [],
    investigation: cs.investigation ?? [],
    verdict_issues: cs.verdict_issues ?? [],
  };

  const context: ExistingContext = {
    case: {
      title: draft.case.title, description: draft.case.description, case_type: draft.case.case_type,
      difficulty: draft.case.difficulty, defendant_name: draft.case.defendant_name,
    },
    witnesses: witnesses.map((w) => ({
      name: w.name, role: w.role, relationship: w.relationship, background: w.background, base_testimony: w.base_testimony,
    })),
    evidence: evidence.map((e) => ({
      title: e.title, evidence_type: e.evidence_type, description: e.description, content: (e.content ?? '').slice(0, 1500),
      is_hidden: e.is_hidden,
    })),
    facts: draft.facts.length ? draft.facts : undefined,
  };
  return { draft, context };
}
