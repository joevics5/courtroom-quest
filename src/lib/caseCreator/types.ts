// Draft shape produced by the generate-case edge function (stage 1 + stage 2 merged).
// The admin edits this in the review screen, then saveDraft() writes it to Supabase.

export type KnowledgeState = 'knows' | 'partial' | 'hidden' | 'believes_falsely' | 'lying' | 'unknown';

export interface DraftWitness {
  /** DB row id when this witness already exists (hidden in the editor) */
  _id?: string;
  code: string;
  name: string;
  age: number | null;
  occupation: string;
  role: string;
  relationship: string;
  background: string;
  base_testimony: string;
  personality_traits: string[];
  secret: {
    communication_style: string;
    reliability: string;
    bias: string;
    motivation: string;
    emotional_state: string;
    wants: string;
    fears: string;
    protecting: string;
    truthfulness: string;
    knowledge: { fact_id: string; state: KnowledgeState; text: string; reveal_trigger: string }[];
    opinions: string[];
    suspicions: string[];
    secrets: string[];
    motivated_omissions: string[];
    limitations: string[];
    sample_questions: { prosecution: string[]; defence: string[]; damaging: string[] };
    /** Kept from older cases so improving them never drops what the witness could already recognise */
    evidence_recognized?: string[];
    evidence_can_authenticate?: string[];
  };
}

export interface DraftEvidence {
  /** DB row id and exhibit label when this item already exists (hidden in the editor) */
  _id?: string;
  _exhibit_label?: string;
  code: string;
  title: string;
  evidence_type: string;
  description: string;
  content: string;
  date_created: string;
  is_hidden: boolean;
  secret: {
    classification: string;
    origin: string;
    possessed_by: string;
    how_available: string;
    proves: string;
    does_not_prove: string;
    prosecution_interpretation: string;
    defence_interpretation: string;
    alternative_interpretation: string;
    hidden_implications: string;
    contradictions: string[];
    potential_objections: string[];
    authentication: string;
    importance: number | null;
    discovery_difficulty: string;
    fact_ids: string[];
    related_evidence_codes: string[];
    witnesses: { witness_code: string; role: string }[];
    generation: {
      kind: string;
      image_prompt: string;
      must_show: string[];
      subtle_details: string[];
      must_not_show: string[];
    };
  };
}

export interface Draft {
  /** Set when improving an existing case; saveDraft then updates instead of inserting */
  _case_id?: string;
  source_story: string;
  case: {
    title: string; subtitle: string; case_type: string; difficulty: string; defendant_name: string;
    description: string; jurisdiction: string; court_type: string; location: string; time_period: string;
    estimated_minutes: number | null; min_players: number | null; max_players: number | null;
    primary_dispute: string; secondary_disputes: string[];
  };
  truth: Record<string, any>;
  facts: { id: string; text: string; status: string; public: boolean }[];
  timeline: Record<string, any>[];
  theories: Record<string, any>;
  witnesses: DraftWitness[];
  evidence: DraftEvidence[];
  loopholes: Record<string, any>[];
  red_herrings: Record<string, any>[];
  contradictions: Record<string, any>[];
  legal_issues: Record<string, any>[];
  objections: Record<string, any>[];
  investigation: Record<string, any>[];
  verdict_issues: Record<string, any>[];
}

export interface GenerateOptions {
  jurisdiction: string;
  case_type: string;
  difficulty: string;
  duration: string;
  special: string;
}

/** Everything stage 1 returns (what the edge function calls "core"). */
export type CoreResult = Pick<Draft, 'case' | 'truth' | 'facts' | 'timeline' | 'theories' | 'witnesses'>;
export type AnalysisResult = Pick<
  Draft,
  'evidence' | 'loopholes' | 'red_herrings' | 'contradictions' | 'legal_issues' | 'objections' | 'investigation' | 'verdict_issues'
>;
