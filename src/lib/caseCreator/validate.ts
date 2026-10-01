import type { Draft } from './types';

/** Live checks shown while the admin edits. Returns human-readable problems (empty = clean). */
export function validateDraft(d: Draft): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!d.case.title.trim()) errors.push('Case title is empty.');
  if (!d.case.description.trim()) errors.push('Public description is empty.');
  if (d.witnesses.length < 4) errors.push(`Need at least 4 witnesses (have ${d.witnesses.length}).`);
  if (d.evidence.length < 5) errors.push(`Need at least 5 evidence items (have ${d.evidence.length}).`);
  if (d.witnesses.length > 12) warnings.push(`${d.witnesses.length} witnesses is a lot; most cases work best with 6-8.`);
  if (d.evidence.length > 14) warnings.push(`${d.evidence.length} evidence items is a lot; most cases work best with 6-12.`);

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
    if (pros < 5) warnings.push(`Only ${pros} prosecution loopholes (aim for 5+).`);
    if (def < 5) warnings.push(`Only ${def} defence loopholes (aim for 5+).`);
    const hidden = d.evidence.filter((e) => e.is_hidden).length;
    if (hidden > 0)
      warnings.push(`${hidden} evidence item(s) are marked hidden. Players cannot discover hidden evidence in the app yet, so untick "Is hidden" on any you want visible now.`);
  }
  if (!d.witnesses.some((w) => w.secret.knowledge.some((k) => k.state === 'hidden')))
    warnings.push('No witness holds hidden knowledge.');
  return { errors, warnings };
}
