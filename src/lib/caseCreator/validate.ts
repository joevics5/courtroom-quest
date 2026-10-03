import type { Draft } from './types';
import { TIERS, rangeText, tierOf } from './tiers';

/** Live checks shown while the admin edits. Returns human-readable problems (empty = clean). */
/** `practice`: a player's own case file, sized by what the file supports, so game difficulty counts are not advice. */
export function validateDraft(d: Draft, opts: { practice?: boolean } = {}): { errors: string[]; warnings: string[] } {
  const practice = !!opts.practice;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!d.case.title.trim()) errors.push('Case title is empty.');
  if (!d.case.description.trim()) errors.push('Public description is empty.');
  // Hard floor: below this the case cannot be played. The tier range is only advice.
  if (d.witnesses.length < 3) errors.push(`Need at least 3 witnesses (have ${d.witnesses.length}).`);
  if (d.evidence.length < 3) errors.push(`Need at least 3 evidence items (have ${d.evidence.length}).`);
  const tier = tierOf(d.case.difficulty);
  const t = TIERS[tier];
  const outside = (n: number, r: [number, number]) => n < r[0] || n > r[1];
  if (!practice && outside(d.witnesses.length, t.witnesses))
    warnings.push(`${tier} cases usually have ${rangeText(t.witnesses)} witnesses (you have ${d.witnesses.length}).`);
  if (!practice && d.evidence.length > 0 && outside(d.evidence.length, t.evidence))
    warnings.push(`${tier} cases usually have ${rangeText(t.evidence)} evidence items (you have ${d.evidence.length}).`);

  const dup = (codes: string[], label: string) => {
    const seen = new Set<string>();
    for (const c of codes) {
      if (!c) errors.push(`A ${label} has no code.`);
      else if (seen.has(c)) errors.push(`Duplicate ${label} code ${c}.`);
      seen.add(c);
    }
  };
  dup(d.witnesses.map((w) => w.code), 'witness');
  dup(d.evidence.map((e) => e.code), 'evidence');
  dup(d.facts.map((f) => f.id), 'fact');

  const fact = new Set(d.facts.map((f) => f.id));
  const wit = new Set(d.witnesses.map((w) => w.code));
  const evi = new Set(d.evidence.map((e) => e.code));
  const dangling = (ids: string[] | undefined, set: Set<string>, where: string) => {
    for (const id of ids ?? []) if (id && !set.has(id)) warnings.push(`${where} points to "${id}", which does not exist.`);
  };

  for (const w of d.witnesses) {
    if (!w.name.trim()) errors.push(`Witness ${w.code} has no name.`);
    if (!w.base_testimony.trim()) warnings.push(`Witness ${w.code} has no base testimony.`);
    for (const k of w.secret.knowledge) dangling([k.fact_id], fact, `Witness ${w.code} knowledge`);
  }
  for (const e of d.evidence) {
    if (!e.title.trim()) errors.push(`Evidence ${e.code} has no title.`);
    dangling(e.secret.fact_ids, fact, `Evidence ${e.code}`);
    dangling(e.secret.related_evidence_codes, evi, `Evidence ${e.code} related`);
    dangling(e.secret.witnesses.map((x) => x.witness_code), wit, `Evidence ${e.code} witnesses`);
  }
  for (const l of d.loopholes) {
    dangling(l.evidence_codes, evi, `Loophole ${l.id}`);
    dangling(l.witness_codes, wit, `Loophole ${l.id}`);
  }
  for (const r of d.red_herrings) {
    dangling(r.evidence_codes, evi, `Red herring ${r.id}`);
    dangling(r.witness_codes, wit, `Red herring ${r.id}`);
  }

  const pros = d.loopholes.filter((l) => l.side === 'prosecution').length;
  const def = d.loopholes.filter((l) => l.side === 'defence').length;
  if (d.evidence.length > 0) {
    if (!practice && pros < t.loopholes[0]) warnings.push(`Only ${pros} prosecution loopholes (${tier} cases aim for ${rangeText(t.loopholes)}).`);
    if (!practice && def < t.loopholes[0]) warnings.push(`Only ${def} defence loopholes (${tier} cases aim for ${rangeText(t.loopholes)}).`);
    const hidden = d.evidence.filter((e) => e.is_hidden).length;
    if (hidden > 0)
      warnings.push(`${hidden} evidence item(s) are marked hidden. Players cannot discover hidden evidence in the app yet, so untick "Is hidden" on any you want visible now.`);
  }
  if (!practice && !d.witnesses.some((w) => w.secret.knowledge.some((k) => k.state === 'hidden')))
    warnings.push('No witness holds hidden knowledge.');
  return { errors, warnings };
}
