export type CaseType = 'criminal' | 'civil' | 'burglary' | 'fraud' | 'assault' | 'murder' | 'theft' | 'other';
export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'max' | 'family';
export type TrialType = 'judge' | 'jury';
export type PlayerRole = 'defense' | 'prosecution';
export type ChallengeStatus = 'open' | 'matched' | 'cancelled';

export interface CaseChallenge {
  id: string;
  case_id: string;
  creator_user_id: string;
  creator_role: PlayerRole;
  status: ChallengeStatus;
  opponent_user_id?: string;
  session_id?: string;
  created_at: string;
  matched_at?: string;
  // Joined fields (not in the DB row itself) for display convenience
  case_title?: string;
  creator_name?: string;
}
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type EvidenceType =
  | 'documents'
  | 'photographs'
  | 'images'
  | 'video_recordings'
  | 'audio_recordings'
  | 'witness_testimony'
  | 'physical_evidence'
  | 'digital_evidence'
  | 'expert_reports'
  | 'confessions_statements'
  | 'timeline_logs'
  | 'story';
export type Relevance = 'favorable' | 'neutral' | 'risky';
export type Phase = 'setup' | 'role-selection' | 'investigation' | 'difficulty-selection' | 'trial-type-selection' | 'jury-selection' | 'pre-trial' | 'trial' | 'completed';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type InteractionPhase = 'pre_trial' | 'trial';
export type EventType = 'opening' | 'witness_examination' | 'cross_examination' | 'objection' | 'ruling' | 'closing' | 'verdict' | 'evidence_submission' | 'witness_call' | 'announcement';
export type SpeakerRole = 'judge' | 'counsel' | 'witness' | 'opposing_counsel' | 'prosecution' | 'defense' | 'jury';
export type Outcome = 'win' | 'lose' | 'partial';

export interface Case {
  id: string;
  title: string;
  description: string;
  case_type: CaseType;
  difficulty?: Difficulty;
  defendant_name?: string;
  is_preset: boolean;
  is_multiplayer?: boolean;
  truth_state?: Record<string, any>;
  case_summary?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Evidence {
  id: string;
  case_id: string;
  exhibit_label?: string;
  title: string;
  description?: string;
  evidence_type: EvidenceType;
  content?: string;
  file_urls?: string[];
  file_url?: string; // Keep for backward compatibility
  file_data?: string;
  relevance?: Relevance;
  is_hidden: boolean;
  tags?: string[];
  auto_tagged?: boolean;
  discovered_at?: string;
  created_at: string;
}

export interface WitnessKnowledgeScope {
  // Facts the witness genuinely knows and will state naturally when
  // relevantly asked — this is the bulk of ordinary, cooperative testimony.
  known_facts?: string[];
  // Facts they know but won't volunteer unless questioned skillfully or
  // pressed — these should NOT come out from a generic "tell me what
  // happened", only from specific, well-aimed questions.
  hidden_knowledge?: string[];
  // Facts they know only part of — answering should reflect the gap, not
  // fill it in.
  partial_knowledge?: string[];
  // Things they genuinely do not know — the only legitimate territory for
  // an "I don't know" style answer.
  unknown_information?: string[];
  // Things they sincerely believe but are factually wrong about — they
  // should state these with the same confidence as known_facts, since
  // they don't know they're mistaken.
  incorrect_beliefs?: string[];
  // What they personally think happened — opinion, framed as opinion, not
  // stated as established fact.
  personal_opinions?: string[];
  // What they suspect but can't prove — should come across as
  // speculation/hedging if raised at all.
  suspicions?: string[];
  // Information they're reluctant to reveal — expect evasion, deflection,
  // or minimizing when approached, not an outright lie, unless the
  // witness is also marked deceptive.
  secrets?: string[];
  // Information they intentionally leave out unless directly confronted
  // with it (e.g. via evidence or a pointed question) — similar to
  // secrets, but specifically about omission rather than concealment.
  motivated_omissions?: string[];
  // Evidence (by title or id) this witness recognizes and can speak to.
  evidence_recognized?: string[];
  // Evidence (by title or id) this witness is positioned to authenticate.
  evidence_can_authenticate?: string[];
  // Things this witness cannot reliably testify about (wasn't present,
  // outside their expertise, etc.) — should be met with a clear
  // "I can't speak to that" rather than a guess.
}

export interface Witness {
  id: string;
  case_id: string;
  name: string;
  role: string;
  background: string;
  base_testimony: string;
  knowledge_scope?: WitnessKnowledgeScope;
  personality_traits?: Record<string, any>;
  photo_url?: string;
  use_ai?: boolean;
  created_at: string;
}

export type TrialDuration = 15 | 30 | 60;

export interface CaseSession {
  id: string;
  user_id: string;
  case_id: string;
  current_phase: Phase;
  evidence_filed: boolean;
  witnesses_locked: boolean;
  session_state: Record<string, any>;
  trial_duration?: number;
  current_trial_phase?: number;
  phase_timings?: Record<string, any>;
  timer_started_at?: string;
  timer_paused_at?: string;
  total_pause_duration?: number;
  phase_start_times?: Record<string, any>;
  opposing_counsel_user_id?: string;
  trial_type?: TrialType;
  jury_selection_complete?: boolean;
  is_shared?: boolean;
  allow_spectators?: boolean;
  started_at: string;
  completed_at?: string;
  updated_at: string;
}

export interface WitnessInteraction {
  id: string;
  session_id: string;
  witness_id: string;
  question: string;
  response: string;
  asked_at: string;
  phase: InteractionPhase;
  revealed_evidence?: string;
  interaction_order?: number;
}

export interface TrialEvent {
  id: string;
  session_id: string;
  event_type: EventType;
  speaker_role: SpeakerRole;
  speaker_name?: string;
  content: string;
  timestamp: string;
  metadata: Record<string, any>;
  event_order?: number;
}

export interface Verdict {
  id: string;
  session_id: string;
  outcome: Outcome;
  reasoning: string;
  evidence_cited: string[];
  witness_performance?: Record<string, any>;
  missed_opportunities?: string[];
  score?: number;
  delivered_at: string;
}

export interface CaseWithDetails extends Case {
  evidence: Evidence[];
  witnesses: Witness[];
}

export interface UserProfile {
  user_id: string;
  subscription_tier: SubscriptionTier;
  voice_minutes_remaining: number;
  trial_count: number;
  case_creation_count: number;
  wins_count: number;
  current_level: string;
  is_admin: boolean;
  tutorial_completed: boolean;
  difficulty: Difficulty;
  created_at: string;
  updated_at: string;
}

export interface CaseWinner {
  id: string;
  case_id: string;
  user_id: string;
  username: string;
  level_achieved: string;
  verdict_score: number;
  won_at: string;
}

export interface SessionWithDetails extends CaseSession {
  case: Case;
  interactions: WitnessInteraction[];
  trial_events: TrialEvent[];
  verdict?: Verdict;
}

export interface Juror {
  id: string;
  name: string;
  age: number;
  occupation: string;
  background: string;
  personality_traits: string[];
  biases: string[];
  photo_url?: string;
  created_at: string;
}

export interface CaseInvitation {
  id: string;
  case_id: string;
  session_id?: string;
  inviter_user_id: string;
  inviter_role: PlayerRole;
  invitee_email: string;
  invitee_user_id?: string;
  status: InvitationStatus;
  allow_spectators?: boolean;
  created_at: string;
  accepted_at?: string;
  // Joined fields (not in the DB row itself) for display convenience
  case_title?: string;
}

export interface JurySelection {
  id: string;
  session_id: string;
  juror_id: string;
  selected_by: 'prosecution' | 'defense';
  selection_order: number;
  created_at: string;
}
