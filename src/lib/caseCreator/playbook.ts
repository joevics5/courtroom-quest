// Turns an AI-parsed case into a "where will opposing counsel hit me" report for the side the lawyer argues.
// Pure data in, plain objects out, so it is easy to test and the UI stays dumb.
import type { Draft } from './types';

export type Side = 'prosecution' | 'defence';
export const otherSide = (s: Side): Side => (s === 'prosecution' ? 'defence' : 'prosecution');
export const sideLabel = (s: Side) => (s === 'prosecution' ? 'Prosecution' : 'Defence');

const DIFF_RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2, expert: 3 };
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : []);

export interface Attack {
  title: string;
  kind: string;
  how: string;          // how opposing counsel would put it
  questions: string[];  // cross-examination lines they could use
  involves: string[];   // witnesses / exhibits by name
  yourAnswer: string;   // how you can answer or neutralise it
  hardToSpot: boolean;
}
export interface Playbook {
  userSide: Side;
  opponent: Side;
  attacks: Attack[];                       // opponent loopholes, most dangerous first
  weakPoints: string[];                    // weak points of the user's own theory
  exploitableFacts: string[];              // facts the opponent can use against the user's theory
  contradictions: { a: string; b: string; impact: string; found: string }[];
  exhibitsAtRisk: { title: string; challenges: string[]; theirReading: string }[];
  backfireQuestions: { witness: string; questions: string[] }[];
  objections: { type: string; example: string; ruling: string }[];
  legalIssues: { issue: string; why: string }[];
  isEmpty: boolean;
}

export function buildPlaybook(d: Draft, userSide: Side): Playbook {
  const opponent = otherSide(userSide);
  const wName = new Map(d.witnesses.map((w) => [w.code, w.name || w.code]));
  const eName = new Map(d.evidence.map((e) => [e.code, e.title || e.code]));
  const named = (code: string) => wName.get(code) ?? eName.get(code) ?? code;

  const attacks: Attack[] = d.loopholes
    .filter((l) => l.side === opponent)
    .map((l) => {
      const involves = [...strs(l.witness_codes).map((c) => wName.get(c) ?? c), ...strs(l.evidence_codes).map((c) => eName.get(c) ?? c)];
      const answer = [str(l.counterargument), str(l.how_opponent_neutralizes)].filter(Boolean).join(' ');
      return {
        title: str(l.description) || 'Untitled line of attack',
        kind: str(l.type),
        how: str(l.argument),
        questions: strs(l.sample_questions),
        involves,
        yourAnswer: answer,
        hardToSpot: (DIFF_RANK[str(l.difficulty)] ?? 1) >= 2,
      };
    })
    .sort((a, b) => Number(b.hardToSpot) - Number(a.hardToSpot) || b.involves.length - a.involves.length);

  const theory = ((d.theories as unknown as Record<string, Record<string, unknown>>)?.[userSide]) ?? {};

  const contradictions = d.contradictions
    .filter((c) => c.benefits === opponent)
    .map((c) => ({
      a: `${named(str(c.source_a))}: ${str(c.statement_a)}`,
      b: `${named(str(c.source_b))}: ${str(c.statement_b)}`,
      impact: str(c.impact),
      found: str(c.how_discovered),
    }));

  const exhibitsAtRisk = d.evidence
    .map((e) => {
      const s = e.secret;
      const theirReading = str(opponent === 'prosecution' ? s.prosecution_interpretation : s.defence_interpretation);
      const challenges = [...strs(s.potential_objections), ...strs(s.contradictions)];
      if (str(s.authentication) && (challenges.length || theirReading)) challenges.push(`Foundation: ${str(s.authentication)}`);
      return { title: e.title || e.code, challenges, theirReading };
    })
    .filter((e) => e.challenges.length > 0 || e.theirReading);

  const backfireQuestions = d.witnesses
    .map((w) => ({ witness: w.name || w.code, questions: strs(w.secret.sample_questions?.damaging) }))
    .filter((w) => w.questions.length > 0);

  const objections = d.objections
    .map((o) => ({ type: str(o.type), example: str(o.example) || str(o.trigger), ruling: str(o.likely_ruling) }))
    .filter((o) => o.type || o.example);

  const legalIssues = d.legal_issues
    .filter((l) => l.benefits === opponent || l.benefits === 'both')
    .map((l) => ({ issue: str(l.issue), why: str(l.why_it_matters) }))
    .filter((l) => l.issue);

  const weakPoints = strs(theory.weak_points);
  const exploitableFacts = strs(theory.facts_opponent_can_exploit);

  return {
    userSide, opponent, attacks, weakPoints, exploitableFacts, contradictions, exhibitsAtRisk,
    backfireQuestions, objections, legalIssues,
    isEmpty: !attacks.length && !weakPoints.length && !exploitableFacts.length && !contradictions.length,
  };
}
