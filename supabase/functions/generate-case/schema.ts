// Schemas + validation for the AI case generator.
// Gemini output is untrusted: everything is coerced leniently, then checked
// for structural problems (counts, dangling IDs) which drive a retry.
import { z } from "npm:zod@3.25.76";

// ---------- lenient primitives ----------
const S = z.preprocess(
  (v) => (v == null ? "" : typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v)),
  z.string(),
);
const SA = z.preprocess(
  (v) =>
    Array.isArray(v)
      ? v.map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
      : v == null || v === ""
      ? []
      : [String(v)],
  z.array(z.string()),
);
const N = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}, z.number().optional());
const B = z.preprocess((v) => v === true || v === "true", z.boolean());
const norm = (v: unknown) => String(v ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
const E = (vals: string[], fallback: string, alias: Record<string, string> = {}) =>
  z.preprocess((v) => {
    const s = norm(v);
    const mapped = alias[s] ?? s;
    return vals.includes(mapped) ? mapped : fallback;
  }, z.string());
const arr = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(item));
const obj = <T extends z.ZodRawShape>(shape: T) =>
  z.preprocess((v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {}), z.object(shape));

// ---------- vocab (matches src/types.ts) ----------
export const CASE_TYPES = ["criminal", "civil", "burglary", "fraud", "assault", "murder", "theft", "other"];
export const EVIDENCE_TYPES = [
  "documents", "photographs", "images", "video_recordings", "audio_recordings", "witness_testimony",
  "physical_evidence", "digital_evidence", "expert_reports", "confessions_statements", "timeline_logs", "story",
];
const EVIDENCE_ALIAS: Record<string, string> = {
  document: "documents", record: "documents", photo: "photographs", photograph: "photographs",
  image: "images", physical: "physical_evidence", digital: "digital_evidence", screenshot: "digital_evidence",
  testimony: "witness_testimony", expert_report: "expert_reports", statement: "confessions_statements",
  log: "timeline_logs", video: "documents", audio: "documents",
};
export const KNOWLEDGE_STATES = ["knows", "partial", "hidden", "believes_falsely", "lying", "unknown"];
const STATUS = ["confirmed", "disputed", "uncertain"];
const VISIBILITY = ["public", "discoverable", "hidden"];
const CLASSIFICATION = ["direct", "circumstantial", "corroborating", "contradictory", "ambiguous", "misleading", "background"];
const DIFFICULTY_LEVELS = ["easy", "medium", "hard", "expert"];
const SIDE = ["prosecution", "defence"];
const EVIDENCE_ROLES = ["created", "knows", "authenticates", "explains", "challenges", "contradicted_by", "benefits"];

// ---------- stage 1: case + facts + witnesses ----------
const Theory = obj({
  core_claim: S, supporting_fact_ids: SA, weak_points: SA, assumptions: SA,
  facts_opponent_can_exploit: SA, evidence_that_would_strengthen: SA, evidence_that_would_weaken: SA,
});

const Witness = obj({
  code: S, name: S, age: N, occupation: S, role: S,
  relationship: S,        // PUBLIC: how they relate to the defendant/victim/parties
  background: S,          // PUBLIC
  base_testimony: S,      // PUBLIC: what they'd say on ordinary examination
  personality_traits: SA, // PUBLIC-ish short traits
  secret: obj({
    communication_style: S, reliability: S, bias: S, motivation: S, emotional_state: S,
    wants: S, fears: S, protecting: S,
    truthfulness: E(["truthful", "mistaken", "deceptive", "withholding", "mixed"], "truthful"),
    knowledge: arr(obj({ fact_id: S, state: E(KNOWLEDGE_STATES, "knows", { believes_false: "believes_falsely", false_belief: "believes_falsely", lies: "lying", unaware: "unknown" }), text: S, reveal_trigger: S })),
    opinions: SA, suspicions: SA, secrets: SA, motivated_omissions: SA, limitations: SA,
    sample_questions: obj({ prosecution: SA, defence: SA, damaging: SA }),
  }),
});

export const CoreSchema = obj({
  case: obj({
    title: S, subtitle: S,
    case_type: E(CASE_TYPES, "other"),
    difficulty: z.preprocess((v) => {
      const s = norm(v);
      return s === "expert" ? "hard" : ["easy", "medium", "hard"].includes(s) ? s : "medium";
    }, z.string()),
    defendant_name: S, description: S,
    jurisdiction: S, court_type: S, location: S, time_period: S,
    estimated_minutes: N, min_players: N, max_players: N,
    primary_dispute: S, secondary_disputes: SA,
  }),
  truth: obj({
    summary: S, who_did_what: S, motive: S, key_moments: SA,
    misleading_elements: SA, missing_evidence: SA,
  }),
  facts: arr(obj({ id: S, text: S, status: E(STATUS, "confirmed"), public: B })),
  timeline: arr(obj({
    when: S, where: S, people: SA, event: S, fact_ids: SA,
    status: E(STATUS, "confirmed"), visibility: E(VISIBILITY, "public"),
  })),
  theories: obj({ prosecution: Theory, defence: Theory, alternative: Theory }),
  witnesses: arr(Witness),
});

// ---------- stage 2: evidence + analysis ----------
const Evidence = obj({
  code: S, title: S,
  evidence_type: E(EVIDENCE_TYPES, "documents", EVIDENCE_ALIAS),
  description: S,  // PUBLIC
  content: S,      // PUBLIC: the visible text of a document/chat/log/etc.
  date_created: S,
  is_hidden: B,    // true = must be discovered during investigation
  secret: obj({
    classification: E(CLASSIFICATION, "ambiguous"),
    origin: S, possessed_by: S, how_available: S,
    proves: S, does_not_prove: S,
    prosecution_interpretation: S, defence_interpretation: S, alternative_interpretation: S,
    hidden_implications: S, contradictions: SA, potential_objections: SA, authentication: S,
    importance: N, discovery_difficulty: E(DIFFICULTY_LEVELS, "medium"),
    fact_ids: SA, related_evidence_codes: SA,
    witnesses: arr(obj({ witness_code: S, role: E(EVIDENCE_ROLES, "knows") })),
    generation: obj({
      kind: E(["image", "photo", "document", "screenshot", "none"], "none"),
      image_prompt: S, must_show: SA, subtle_details: SA, must_not_show: SA,
    }),
  }),
});

export const AnalysisSchema = obj({
  evidence: arr(Evidence),
  loopholes: arr(obj({
    id: S, side: E(SIDE, "prosecution", { defense: "defence" }),
    type: S, description: S, discoverable_by: S,
    evidence_codes: SA, witness_codes: SA, fact_ids: SA, sample_questions: SA,
    argument: S, counterargument: S, how_opponent_neutralizes: S,
    difficulty: E(DIFFICULTY_LEVELS, "medium"),
  })),
  red_herrings: arr(obj({
    id: S, description: S, why_it_looks_important: S, real_explanation: S,
    evidence_codes: SA, witness_codes: SA,
  })),
  contradictions: arr(obj({
    id: S, statement_a: S, source_a: S, statement_b: S, source_b: S,
    evidence_codes: SA, true_position: S, how_discovered: S, impact: S,
    benefits: E([...SIDE, "neither"], "neither", { defense: "defence" }),
  })),
  legal_issues: arr(obj({
    issue: S, why_it_matters: S, benefits: S, evidence_codes: SA, witness_codes: SA,
    possible_objections: SA, counterarguments: SA,
  })),
  objections: arr(obj({ type: S, trigger: S, example: S, why_valid: S, likely_ruling: S })),
  investigation: arr(obj({
    level: E(DIFFICULTY_LEVELS, "easy"), discovery: S, how_found: S, evidence_codes: SA,
  })),
  verdict_issues: arr(obj({ issue: S, prosecution_support: S, defence_support: S, unresolved: S })),
});

export type Core = z.infer<typeof CoreSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;

// ---------- difficulty tiers (keep in sync with src/lib/caseCreator/tiers.ts) ----------
export type Tier = "easy" | "medium" | "hard";
type Range = [number, number];
export const TIERS: Record<Tier, {
  witnesses: Range; evidence: Range; facts: Range; timeline: Range; loopholes: Range;
  redHerrings: Range; contradictions: Range; objections: Range; hidden: Range;
}> = {
  easy:   { witnesses: [3, 5],  evidence: [3, 5],  facts: [8, 12],  timeline: [6, 8],   loopholes: [3, 4],  redHerrings: [1, 2], contradictions: [3, 4], objections: [4, 6], hidden: [1, 1] },
  medium: { witnesses: [6, 8],  evidence: [6, 8],  facts: [12, 18], timeline: [8, 12],  loopholes: [5, 7],  redHerrings: [2, 3], contradictions: [4, 6], objections: [5, 7], hidden: [2, 3] },
  hard:   { witnesses: [9, 12], evidence: [9, 12], facts: [18, 26], timeline: [10, 16], loopholes: [8, 12], redHerrings: [3, 5], contradictions: [6, 9], objections: [6, 8], hidden: [3, 4] },
};
export const tierOf = (d?: string): Tier => (d === "easy" || d === "hard" ? d : "medium");
const rng = (r: Range) => (r[0] === r[1] ? `${r[0]}` : `${r[0]}-${r[1]}`);

// ---------- validation ----------
// lenient = improving an existing case: never fail because there are MORE items than the tier maximum
// (existing witnesses/evidence are kept), only because there are too few.
const codes = (xs: { code?: string; id?: string }[], key: "code" | "id") =>
  new Set(xs.map((x) => (x as any)[key]).filter(Boolean));

export function validateCore(c: Core, lenient = false): string[] {
  const e: string[] = [];
  const t = TIERS[tierOf(c.case.difficulty)];
  const label = tierOf(c.case.difficulty);
  if (!c.case.title) e.push("case.title is empty");
  if (!c.case.description) e.push("case.description is empty");
  if (c.facts.length < t.facts[0]) e.push(`${label} difficulty needs at least ${t.facts[0]} facts (got ${c.facts.length})`);
  if (c.witnesses.length < t.witnesses[0] || (!lenient && c.witnesses.length > t.witnesses[1]))
    e.push(`${label} difficulty needs ${rng(t.witnesses)} witnesses (got ${c.witnesses.length})`);
  const factIds = codes(c.facts as any, "id");
  if (factIds.size !== c.facts.length) e.push("fact ids must be unique and non-empty (F1, F2, ...)");
  const wCodes = codes(c.witnesses as any, "code");
  if (wCodes.size !== c.witnesses.length) e.push("witness codes must be unique and non-empty (W1, W2, ...)");
  const missing = new Set<string>();
  for (const w of c.witnesses) {
    if (!w.name || !w.base_testimony || !w.background) e.push(`witness ${w.code} missing name/background/base_testimony`);
    if (w.secret.knowledge.length < 3) e.push(`witness ${w.code} needs at least 3 knowledge entries`);
    for (const k of w.secret.knowledge) if (!factIds.has(k.fact_id)) missing.add(`${w.code}->${k.fact_id}`);
  }
  for (const tl of c.timeline) for (const f of tl.fact_ids) if (!factIds.has(f)) missing.add(`timeline->${f}`);
  for (const [name, th] of Object.entries(c.theories)) {
    for (const f of (th as any).supporting_fact_ids) if (!factIds.has(f)) missing.add(`${name} theory->${f}`);
    if (!(th as any).core_claim) e.push(`${name} theory has no core_claim`);
  }
  if (missing.size) e.push(`references to fact ids that do not exist: ${[...missing].slice(0, 12).join(", ")}`);
  if (!c.witnesses.some((w) => w.secret.knowledge.some((k) => k.state === "hidden")))
    e.push("at least one witness must hold hidden knowledge");
  if (c.timeline.length < t.timeline[0]) e.push(`timeline too short (${c.timeline.length}); need at least ${t.timeline[0]} events`);
  return e;
}

export function validateAnalysis(a: Analysis, core: Core, lenient = false): string[] {
  const e: string[] = [];
  const label = tierOf(core.case.difficulty);
  const t = TIERS[label];
  if (a.evidence.length < t.evidence[0] || (!lenient && a.evidence.length > t.evidence[1]))
    e.push(`${label} difficulty needs ${rng(t.evidence)} evidence items (got ${a.evidence.length})`);
  const eCodes = codes(a.evidence as any, "code");
  if (eCodes.size !== a.evidence.length) e.push("evidence codes must be unique and non-empty (E1, E2, ...)");
  const wCodes = codes(core.witnesses as any, "code");
  const factIds = codes(core.facts as any, "id");
  const bad = new Set<string>();
  for (const ev of a.evidence) {
    if (!ev.title || !ev.description) e.push(`evidence ${ev.code} missing title/description`);
    for (const f of ev.secret.fact_ids) if (!factIds.has(f)) bad.add(`${ev.code}->${f}`);
    for (const r of ev.secret.related_evidence_codes) if (!eCodes.has(r)) bad.add(`${ev.code}->${r}`);
    for (const w of ev.secret.witnesses) if (!wCodes.has(w.witness_code)) bad.add(`${ev.code}->${w.witness_code}`);
  }
  const loopholeSides = { prosecution: 0, defence: 0 } as Record<string, number>;
  for (const l of a.loopholes) {
    loopholeSides[l.side] = (loopholeSides[l.side] ?? 0) + 1;
    for (const c of l.evidence_codes) if (!eCodes.has(c)) bad.add(`${l.id}->${c}`);
    for (const w of l.witness_codes) if (!wCodes.has(w)) bad.add(`${l.id}->${w}`);
  }
  for (const side of ["prosecution", "defence"])
    if (loopholeSides[side] < t.loopholes[0])
      e.push(`${label} difficulty needs ${rng(t.loopholes)} ${side} loopholes (got ${loopholeSides[side]})`);
  for (const r of a.red_herrings) {
    for (const c of r.evidence_codes) if (!eCodes.has(c)) bad.add(`${r.id}->${c}`);
    for (const w of r.witness_codes) if (!wCodes.has(w)) bad.add(`${r.id}->${w}`);
  }
  if (a.red_herrings.length < t.redHerrings[0]) e.push(`need at least ${t.redHerrings[0]} red herrings`);
  if (a.contradictions.length < t.contradictions[0]) e.push(`need at least ${t.contradictions[0]} contradictions`);
  if (a.objections.length < t.objections[0]) e.push(`need at least ${t.objections[0]} objections`);
  if (bad.size) e.push(`references to codes that do not exist: ${[...bad].slice(0, 12).join(", ")}`);
  const hidden = a.evidence.filter((x) => x.is_hidden).length;
  if (hidden < t.hidden[0]) e.push(`at least ${t.hidden[0]} evidence item(s) must be hidden (discoverable via investigation)`);
  return e;
}

// Last-resort cleanup so a draft with a few bad references is still usable:
// removes dangling references instead of failing the whole generation.
export function stripDanglingCore(c: Core): void {
  const f = codes(c.facts as any, "id");
  for (const w of c.witnesses) w.secret.knowledge = w.secret.knowledge.filter((k) => f.has(k.fact_id));
  for (const t of c.timeline) t.fact_ids = t.fact_ids.filter((x) => f.has(x));
  for (const th of Object.values(c.theories) as any[]) th.supporting_fact_ids = th.supporting_fact_ids.filter((x: string) => f.has(x));
}
export function stripDanglingAnalysis(a: Analysis, core: Core): void {
  const e = codes(a.evidence as any, "code");
  const w = codes(core.witnesses as any, "code");
  const f = codes(core.facts as any, "id");
  for (const ev of a.evidence) {
    ev.secret.fact_ids = ev.secret.fact_ids.filter((x) => f.has(x));
    ev.secret.related_evidence_codes = ev.secret.related_evidence_codes.filter((x) => e.has(x));
    ev.secret.witnesses = ev.secret.witnesses.filter((x) => w.has(x.witness_code));
  }
  for (const l of a.loopholes) {
    l.evidence_codes = l.evidence_codes.filter((x) => e.has(x));
    l.witness_codes = l.witness_codes.filter((x) => w.has(x));
    l.fact_ids = l.fact_ids.filter((x) => f.has(x));
  }
  for (const r of a.red_herrings) {
    r.evidence_codes = r.evidence_codes.filter((x) => e.has(x));
    r.witness_codes = r.witness_codes.filter((x) => w.has(x));
  }
  for (const c of a.contradictions) c.evidence_codes = c.evidence_codes.filter((x) => e.has(x));
  for (const l of a.legal_issues) {
    l.evidence_codes = l.evidence_codes.filter((x) => e.has(x));
    l.witness_codes = l.witness_codes.filter((x) => w.has(x));
  }
  for (const i of a.investigation) i.evidence_codes = i.evidence_codes.filter((x) => e.has(x));
}
