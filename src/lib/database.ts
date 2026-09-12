import { supabase } from './supabase';
import type {
  Case,
  Evidence,
  Witness,
  CaseSession,
  WitnessInteraction,
  TrialEvent,
  Verdict,
  CaseWithDetails,
  SessionWithDetails,
  UserProfile,
  Juror,
  CaseInvitation,
  JurySelection,
  CaseWinner,
  PlayerRole
} from '../types';

export const db = {
  users: {
    async getUserProfile(userId: string): Promise<UserProfile | null> {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }
      return data as UserProfile | null;
    },

    async isAdmin(userId: string): Promise<boolean> {
      try {
        const profile = await this.getUserProfile(userId);
        return profile?.is_admin || false;
      } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
      }
    },

    async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates as any)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data as UserProfile;
    }
  },

  cases: {
    async getPresetCases(): Promise<Case[]> {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('is_preset', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Case[];
    },

    async getUserCases(userId: string): Promise<Case[]> {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('created_by', userId)
        .eq('is_preset', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Case[];
    },

    async getUserCasesWithSessionStatus(userId: string): Promise<(Case & { has_sessions: boolean; has_completed_sessions: boolean; current_phase?: string })[]> {
      // Get all user cases
      const cases = await this.getUserCases(userId);

      // Get ongoing sessions for this user (only most recent per case)
      const ongoingSessions = await db.sessions.getOngoingSessions(userId);

      // Create a map of case_id to session info
      const caseSessionMap = new Map<string, { has_sessions: boolean; has_completed_sessions: boolean; current_phase?: string }>();

      // Initialize all cases as having no sessions
      cases.forEach(caseItem => {
        caseSessionMap.set(caseItem.id, { has_sessions: false, has_completed_sessions: false });
      });

      // Update based on ongoing session data
      ongoingSessions.forEach(session => {
        const existing = caseSessionMap.get(session.case_id);
        if (existing) {
          existing.has_sessions = true;
          existing.current_phase = session.current_phase;
          // Ongoing sessions don't have completed_at set
        }
      });

      // Return cases with session status
      return cases.map(caseItem => ({
        ...caseItem,
        ...caseSessionMap.get(caseItem.id)!
      }));
    },

    async getCaseWithDetails(caseId: string): Promise<CaseWithDetails | null> {
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .maybeSingle();

      if (caseError) throw caseError;
      if (!caseData) return null;

      const { data: evidence, error: evidenceError } = await supabase
        .from('evidence')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });

      if (evidenceError) throw evidenceError;

      const { data: witnesses, error: witnessesError } = await supabase
        .from('witnesses')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });

      if (witnessesError) throw witnessesError;

      return {
        ...(caseData as any as Case),
        evidence: (evidence || []) as Evidence[],
        witnesses: (witnesses || []) as Witness[]
      };
    },

    async createCase(caseData: Omit<Case, 'id' | 'created_at' | 'updated_at'>): Promise<Case> {
      const { data, error } = await supabase
        .from('cases')
        .insert([caseData as any])
        .select()
        .single();

      if (error) throw error;
      return data as Case;
    },

    async updateCase(caseId: string, updates: Partial<Case>): Promise<Case> {
      const { data, error } = await supabase
        .from('cases')
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', caseId)
        .select()
        .single();

      if (error) throw error;
      return data as Case;
    },

    async deleteCase(caseId: string): Promise<void> {
      const { error } = await supabase
        .from('cases')
        .delete()
        .eq('id', caseId);

      if (error) throw error;
    },

    async getNextExhibitLabel(caseId: string): Promise<string> {
      const { data, error } = await supabase
        .rpc('get_next_exhibit_label', { case_uuid: caseId });

      if (error) throw error;
      return data || 'Exhibit A';
    }
  },

  evidence: {
    async getCaseEvidence(caseId: string, includeHidden = false): Promise<Evidence[]> {
      let query = supabase
        .from('evidence')
        .select('*')
        .eq('case_id', caseId);

      if (!includeHidden) {
        query = query.eq('is_hidden', false);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as Evidence[];
    },

    async addEvidence(evidenceData: Omit<Evidence, 'id' | 'created_at'>): Promise<Evidence> {
      const { data, error } = await supabase
        .from('evidence')
        .insert([evidenceData as any])
        .select()
        .single();

      if (error) throw error;
      return data as Evidence;
    },

    async updateEvidence(evidenceId: string, updates: Partial<Evidence>): Promise<Evidence> {
      const { data, error } = await supabase
        .from('evidence')
        .update(updates as any)
        .eq('id', evidenceId)
        .select()
        .single();

      if (error) throw error;
      return data as Evidence;
    },

    async discoverEvidence(evidenceId: string): Promise<Evidence> {
      const { data, error } = await supabase
        .from('evidence')
        .update({
          is_hidden: false,
          discovered_at: new Date().toISOString()
        })
        .eq('id', evidenceId)
        .select()
        .single();

      if (error) throw error;
      return data as Evidence;
    },

    async deleteEvidence(evidenceId: string): Promise<void> {
      const { error } = await supabase
        .from('evidence')
        .delete()
        .eq('id', evidenceId);

      if (error) throw error;
    }
  },

  witnesses: {
    async getCaseWitnesses(caseId: string): Promise<Witness[]> {
      const { data, error } = await supabase
        .from('witnesses')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as Witness[];
    },

    async addWitness(witnessData: Omit<Witness, 'id' | 'created_at'>): Promise<Witness> {
      const { data, error } = await supabase
        .from('witnesses')
        .insert([witnessData as any])
        .select()
        .single();

      if (error) throw error;
      return data as Witness;
    },

    async updateWitness(witnessId: string, updates: Partial<Witness>): Promise<Witness> {
      const { data, error } = await supabase
        .from('witnesses')
        .update(updates as any)
        .eq('id', witnessId)
        .select()
        .single();

      if (error) throw error;
      return data as Witness;
    },

    async deleteWitness(witnessId: string): Promise<void> {
      const { error } = await supabase
        .from('witnesses')
        .delete()
        .eq('id', witnessId);

      if (error) throw error;
    }
  },

  challenges: {
    async createChallenge(caseId: string, creatorUserId: string, creatorRole: 'defense' | 'prosecution') {
      const { data, error } = await supabase
        .from('case_challenges')
        .insert([{
          case_id: caseId,
          creator_user_id: creatorUserId,
          creator_role: creatorRole,
          status: 'open'
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async listOpenChallenges() {
      const { data, error } = await supabase
        .from('case_challenges')
        .select('*, cases(title)')
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        case_title: row.cases?.title
      }));
    },

    async getMyChallenges(userId: string) {
      const { data, error } = await supabase
        .from('case_challenges')
        .select('*, cases(title)')
        .or(`creator_user_id.eq.${userId},opponent_user_id.eq.${userId}`)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        case_title: row.cases?.title
      }));
    },

    async cancelChallenge(challengeId: string) {
      const { error } = await supabase
        .from('case_challenges')
        .update({ status: 'cancelled' })
        .eq('id', challengeId)
        .eq('status', 'open');

      if (error) throw error;
    },

    // Joins an open challenge: claims it (optimistic concurrency via the
    // status='open' guard, so two people can't join the same challenge),
    // creates the shared session with both users and their assigned
    // roles recorded, and links the session back to the challenge.
    // Multiplayer sessions skip role/difficulty selection (already
    // decided by the challenge) and go straight to investigation.
    async joinChallenge(challengeId: string, joinerUserId: string) {
      const { data: challenge, error: fetchError } = await supabase
        .from('case_challenges')
        .select('*')
        .eq('id', challengeId)
        .single();
      if (fetchError) throw fetchError;
      if (!challenge || challenge.status !== 'open') {
        throw new Error('This challenge is no longer open — someone may have already joined it.');
      }
      if (challenge.creator_user_id === joinerUserId) {
        throw new Error("You can't join your own challenge.");
      }

      const { data: claimed, error: claimError } = await supabase
        .from('case_challenges')
        .update({ status: 'matched', opponent_user_id: joinerUserId, matched_at: new Date().toISOString() })
        .eq('id', challengeId)
        .eq('status', 'open') // guards against a double-join race
        .select()
        .single();
      if (claimError || !claimed) {
        throw new Error('This challenge was just taken by someone else. Try another one.');
      }

      const joinerRole: 'defense' | 'prosecution' = claimed.creator_role === 'defense' ? 'prosecution' : 'defense';
      const prosecutionUserId = claimed.creator_role === 'prosecution' ? claimed.creator_user_id : joinerUserId;
      const defenseUserId = claimed.creator_role === 'defense' ? claimed.creator_user_id : joinerUserId;

      const { data: session, error: sessionError } = await supabase
        .from('case_sessions')
        .insert([{
          case_id: claimed.case_id,
          user_id: claimed.creator_user_id,
          opposing_counsel_user_id: joinerUserId,
          current_phase: 'investigation',
          evidence_filed: false,
          witnesses_locked: false,
          // Quick Match games are already visible to anyone on the open
          // board, so spectating defaults on here (unlike Invite a
          // Friend / Pass & Play, which are private unless explicitly
          // opted in — see createInvitation/acceptInvitation and
          // createSameDevicePlaySession).
          allow_spectators: true,
          session_state: {
            isMultiplayer: true,
            prosecutionUserId,
            defenseUserId
          }
        }])
        .select()
        .single();
      if (sessionError) throw sessionError;

      const { error: linkError } = await supabase
        .from('case_challenges')
        .update({ session_id: session.id })
        .eq('id', challengeId);
      if (linkError) throw linkError;

      return session as CaseSession;
    }
  },

  sessions: {
    async createSession(caseId: string, userId: string): Promise<CaseSession> {
      const { data, error } = await supabase
        .from('case_sessions')
        .insert([{
          case_id: caseId,
          user_id: userId,
          current_phase: 'setup',
          evidence_filed: false,
          witnesses_locked: false,
          session_state: {}
        }])
        .select()
        .single();

      if (error) throw error;
      return data as CaseSession;
    },

    // "Pass & play": one account, one device, two humans taking turns.
    // Reuses the existing isMultiplayer session shape (so all the
    // multiplayer turn-tracking code already works unchanged) but both
    // seats belong to the same user — Courtroom.tsx uses the extra
    // sameDevicePlay flag to know to keep the input open for both sides
    // instead of expecting a second logged-in device.
    async createSameDevicePlaySession(caseId: string, userId: string, creatorRole: PlayerRole, allowSpectators: boolean = false): Promise<CaseSession> {
      const prosecutionUserId = userId;
      const defenseUserId = userId;
      const { data, error } = await supabase
        .from('case_sessions')
        .insert([{
          case_id: caseId,
          user_id: userId,
          current_phase: 'investigation',
          evidence_filed: false,
          witnesses_locked: false,
          allow_spectators: allowSpectators,
          session_state: {
            isMultiplayer: true,
            sameDevicePlay: true,
            creatorRole,
            prosecutionUserId,
            defenseUserId
          }
        }])
        .select()
        .single();

      if (error) throw error;
      return data as CaseSession;
    },

    async getSession(sessionId: string): Promise<CaseSession | null> {
      const { data, error } = await supabase
        .from('case_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (error) throw error;
      return data as CaseSession | null;
    },

    async getUserSessions(userId: string): Promise<CaseSession[]> {
      const { data, error } = await supabase
        .from('case_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CaseSession[];
    },

    async getOngoingSessions(userId: string): Promise<CaseSession[]> {
      // Also match sessions where this user is the second player in a
      // multiplayer match (opposing_counsel_user_id) — otherwise the
      // person who joined someone else's challenge/invite would never
      // see the session again after leaving it (e.g. a page refresh).
      const { data, error } = await supabase
        .from('case_sessions')
        .select('*, cases(*)')
        .or(`user_id.eq.${userId},opposing_counsel_user_id.eq.${userId}`)
        .is('completed_at', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Filter to only return the most recent session per case
      const caseMap = new Map<string, CaseSession>();
      ((data || []) as any[]).forEach(session => {
        if (!caseMap.has(session.case_id)) {
          caseMap.set(session.case_id, session as CaseSession);
        }
      });

      return Array.from(caseMap.values());
    },

    async getCompletedSessionForCase(userId: string, caseId: string): Promise<CaseSession | null> {
      const { data, error } = await supabase
        .from('case_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('case_id', caseId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as CaseSession | null;
    },

    async getSessionWithDetails(sessionId: string): Promise<SessionWithDetails | null> {
      const { data: session, error: sessionError } = await supabase
        .from('case_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (sessionError) throw sessionError;
      if (!session) return null;

      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('*')
        .eq('id', session.case_id)
        .single();

      if (caseError) throw caseError;

      const { data: interactions, error: interactionsError } = await supabase
        .from('witness_interactions')
        .select('*')
        .eq('session_id', sessionId)
        .order('asked_at', { ascending: true });

      if (interactionsError) throw interactionsError;

      const { data: events, error: eventsError } = await supabase
        .from('trial_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (eventsError) throw eventsError;

      const { data: verdict, error: verdictError } = await supabase
        .from('verdicts')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (verdictError) throw verdictError;

      return {
        ...(session as any as CaseSession),
        case: caseData as any as Case,
        interactions: (interactions || []) as WitnessInteraction[],
        trial_events: (events || []) as TrialEvent[],
        verdict: (verdict as any as Verdict) || undefined
      };
    },

    async updateSession(sessionId: string, updates: Partial<CaseSession>): Promise<CaseSession> {
      const { data, error } = await supabase
        .from('case_sessions')
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data as CaseSession;
    }
  },

  interactions: {
    async addInteraction(interaction: Omit<WitnessInteraction, 'id' | 'asked_at'>): Promise<WitnessInteraction> {
      const { data, error } = await supabase
        .from('witness_interactions')
        .insert([interaction as any])
        .select()
        .single();

      if (error) throw error;
      return data as WitnessInteraction;
    },

    async getSessionInteractions(sessionId: string): Promise<WitnessInteraction[]> {
      const { data, error } = await supabase
        .from('witness_interactions')
        .select('*')
        .eq('session_id', sessionId)
        .order('asked_at', { ascending: true });

      if (error) throw error;
      return (data || []) as WitnessInteraction[];
    }
  },

  trialEvents: {
    async addEvent(event: Omit<TrialEvent, 'id' | 'timestamp'>): Promise<TrialEvent> {
      const { data, error } = await supabase
        .from('trial_events')
        .insert([event as any])
        .select()
        .single();

      if (error) throw error;
      return data as TrialEvent;
    },

    async getSessionEvents(sessionId: string): Promise<TrialEvent[]> {
      const { data, error } = await supabase
        .from('trial_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return (data || []) as TrialEvent[];
    },

    async deleteSessionEvents(sessionId: string): Promise<void> {
      const { error } = await supabase
        .from('trial_events')
        .delete()
        .eq('session_id', sessionId);

      if (error) throw error;
    }
  },

  verdicts: {
    async createVerdict(verdict: Omit<Verdict, 'id' | 'delivered_at'>): Promise<Verdict> {
      const { data, error } = await supabase
        .from('verdicts')
        .insert([verdict as any])
        .select()
        .single();

      if (error) throw error;
      return data as Verdict;
    },

    async getSessionVerdict(sessionId: string): Promise<Verdict | null> {
      const { data, error } = await supabase
        .from('verdicts')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error) throw error;
      return data as Verdict | null;
    }
  },

  jurors: {
    async getAllJurors(): Promise<Juror[]> {
      const { data, error } = await supabase
        .from('jurors')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as Juror[];
    },

    async getRandomJurors(count: number): Promise<Juror[]> {
      const { data, error } = await supabase
        .from('jurors')
        .select('*')
        .limit(count * 2);

      if (error) throw error;

      const shuffled = ((data || []) as Juror[]).sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    }
  },

  jurySelections: {
    async addJurySelection(selection: Omit<JurySelection, 'id' | 'created_at'>): Promise<JurySelection> {
      const { data, error } = await supabase
        .from('jury_selections')
        .insert([selection as any])
        .select()
        .single();

      if (error) throw error;
      return data as JurySelection;
    },

    async getSessionJurySelections(sessionId: string): Promise<JurySelection[]> {
      const { data, error } = await supabase
        .from('jury_selections')
        .select('*')
        .eq('session_id', sessionId)
        .order('selection_order', { ascending: true });

      if (error) throw error;
      return (data || []) as JurySelection[];
    },

    async removeJurySelection(selectionId: string): Promise<void> {
      const { error } = await supabase
        .from('jury_selections')
        .delete()
        .eq('id', selectionId);

      if (error) throw error;
    },

    async clearSessionJury(sessionId: string): Promise<void> {
      const { error } = await supabase
        .from('jury_selections')
        .delete()
        .eq('session_id', sessionId);

      if (error) throw error;
    }
  },

  invitations: {
    async createInvitation(caseId: string, inviterUserId: string, inviterRole: PlayerRole, inviteeEmail: string, allowSpectators: boolean = false): Promise<CaseInvitation> {
      const { data, error } = await supabase
        .from('case_invitations')
        .insert([{
          case_id: caseId,
          inviter_user_id: inviterUserId,
          inviter_role: inviterRole,
          invitee_email: inviteeEmail.trim().toLowerCase(),
          allow_spectators: allowSpectators,
          status: 'pending'
        }])
        .select('*, cases(title)')
        .single();

      if (error) throw error;
      return { ...(data as any), case_title: (data as any)?.cases?.title } as CaseInvitation;
    },

    // Invitations sent by this user, plus any already claimed by them
    // (invitee_user_id set once they've accepted/declined at least once).
    async getInvitationsByUser(userId: string): Promise<CaseInvitation[]> {
      const { data, error } = await supabase
        .from('case_invitations')
        .select('*, cases(title)')
        .or(`inviter_user_id.eq.${userId},invitee_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return ((data || []) as any[]).map(row => ({ ...row, case_title: row.cases?.title }));
    },

    // Pending invitations addressed to this email that haven't been
    // claimed by a user_id yet — the "you've been invited" inbox.
    async getInvitationsByEmail(email: string): Promise<CaseInvitation[]> {
      const { data, error } = await supabase
        .from('case_invitations')
        .select('*, cases(title)')
        .eq('invitee_email', email.trim().toLowerCase())
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return ((data || []) as any[]).map(row => ({ ...row, case_title: row.cases?.title }));
    },

    async declineInvitation(invitationId: string, userId: string): Promise<void> {
      const { error } = await supabase
        .from('case_invitations')
        .update({ status: 'declined', invitee_user_id: userId })
        .eq('id', invitationId)
        .eq('status', 'pending');

      if (error) throw error;
    },

    async cancelInvitation(invitationId: string): Promise<void> {
      const { error } = await supabase
        .from('case_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId)
        .eq('status', 'pending');

      if (error) throw error;
    },

    // Accepts a pending invite: claims it, creates the shared session
    // with the invitee on the opposite side from the inviter, and links
    // the session back to the invitation. Mirrors challenges.joinChallenge.
    async acceptInvitation(invitationId: string, joinerUserId: string): Promise<CaseSession> {
      const { data: invitation, error: fetchError } = await supabase
        .from('case_invitations')
        .select('*')
        .eq('id', invitationId)
        .single();
      if (fetchError) throw fetchError;
      if (!invitation || invitation.status !== 'pending') {
        throw new Error('This invitation is no longer available — it may have already been accepted or declined.');
      }
      if (invitation.inviter_user_id === joinerUserId) {
        throw new Error("You can't accept your own invitation.");
      }

      const { data: claimed, error: claimError } = await supabase
        .from('case_invitations')
        .update({ status: 'accepted', invitee_user_id: joinerUserId, accepted_at: new Date().toISOString() })
        .eq('id', invitationId)
        .eq('status', 'pending') // guards against a double-accept race
        .select()
        .single();
      if (claimError || !claimed) {
        throw new Error('This invitation was just handled elsewhere. Refresh and try again.');
      }

      const inviterRole = claimed.inviter_role as 'defense' | 'prosecution';
      const prosecutionUserId = inviterRole === 'prosecution' ? claimed.inviter_user_id : joinerUserId;
      const defenseUserId = inviterRole === 'defense' ? claimed.inviter_user_id : joinerUserId;

      const { data: session, error: sessionError } = await supabase
        .from('case_sessions')
        .insert([{
          case_id: claimed.case_id,
          user_id: claimed.inviter_user_id,
          opposing_counsel_user_id: joinerUserId,
          current_phase: 'investigation',
          evidence_filed: false,
          witnesses_locked: false,
          allow_spectators: !!claimed.allow_spectators,
          session_state: {
            isMultiplayer: true,
            prosecutionUserId,
            defenseUserId
          }
        }])
        .select()
        .single();
      if (sessionError) throw sessionError;

      const { error: linkError } = await supabase
        .from('case_invitations')
        .update({ session_id: session.id })
        .eq('id', invitationId);
      if (linkError) throw linkError;

      return session as CaseSession;
    }
  },

  caseWinners: {
    async addWinner(winner: Omit<CaseWinner, 'id' | 'won_at'>): Promise<CaseWinner> {
      const { data, error } = await supabase
        .from('case_winners')
        .insert([winner as any])
        .select()
        .single();

      if (error) throw error;
      return data as CaseWinner;
    },

    async getCaseWinners(caseId: string): Promise<CaseWinner[]> {
      const { data, error } = await supabase
        .from('case_winners')
        .select('*')
        .eq('case_id', caseId)
        .order('won_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CaseWinner[];
    },

    async getCaseLeaderboard(caseId: string, limit: number = 10): Promise<CaseWinner[]> {
      const { data, error } = await supabase
        .from('case_winners')
        .select('*')
        .eq('case_id', caseId)
        .order('verdict_score', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as CaseWinner[];
    },

    async getLeaderboard(limit: number = 100): Promise<Array<UserProfile & { username: string }>> {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*, username:user_id')
        .order('wins_count', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as any;
    }
  }
};
