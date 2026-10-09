import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SessionProvider } from './contexts/SessionContext';
import Auth from './components/Auth';
import AvatarCreator from './components/AvatarCreator';
import { hasSavedAvatar } from './lib/avatars';
import HomePage from './components/HomePage';
import LoadingScreen from './components/LoadingScreen';
import LandingPage from './components/LandingPage';
import CaseBoard from './components/CaseBoard';
import CaseSelection from './components/CaseSelection';
import CustomCaseCreator from './components/CustomCaseCreator';
import Investigation from './components/Investigation';
import Courtroom from './components/Courtroom';
import VerdictDisplay from './components/VerdictDisplay';
import AdminPanel from './components/AdminPanel';
import TrialTypeSelector from './components/TrialTypeSelector';
import JurySelection from './components/JurySelection';
import PreTrialScript from './components/PreTrialScript';
import SubscriptionGate, { getTrialLimit, canCreateCustomCase } from './components/SubscriptionGate';
import { db } from './lib/database';
import { getLevelForWins, STARTING_RANK } from './lib/levels';
import { getUserDisplayName, getPublicName } from './lib/userName';
import { getRandomJudgeName, getRandomProsecutorName } from './lib/trialConfig';
import { getSessionPlayerRole } from './lib/verdictUtils';
import type { CaseInvitation, CaseSession, Verdict, TrialType, UserProfile, SubscriptionTier, Case, Difficulty, PlayerRole } from './types';
import CasePreview from './components/CasePreview';
import ChallengeBoard from './components/ChallengeBoard';
import { supabase } from './lib/supabase';
import Tutorial from './components/Tutorial';
import { markTutorialSeen, tutorialAlreadySeen } from './lib/tutorialSeen';
import Settings from './components/Settings';

type AppView =
  | 'landing'
  | 'case-board'
  | 'case-selection'
  | 'custom-case-creator'
  | 'challenge-board'
  | 'tutorial'
  | 'role-selection'
  | 'investigation'
  | 'trial-type-selection'
  | 'jury-selection'
  | 'pre-trial'
  | 'courtroom'
  | 'verdict'
  | 'settings'
  | 'admin';

function AppContent() {
  const { user, loading: authLoading, signInAsGuest } = useAuth();
  const [bootDone, setBootDone] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);
  // Ongoing games and invitations waiting — shown as badges on Home and the dashboard
  const [ongoingCount, setOngoingCount] = useState(0);
  // My challenges / invites still waiting for the other player
  const [waitingSentCount, setWaitingSentCount] = useState(0);
  // Which tab the Case Board opens on (My games when coming from the Play popup)
  const [caseBoardFilter, setCaseBoardFilter] = useState<'all' | 'ongoing'>('all');
  const [caseBoardFromHome, setCaseBoardFromHome] = useState(false);
  const [invites, setInvites] = useState<CaseInvitation[]>([]);
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);
  // Set when the challenge board is opened from the play-mode screen for an already-chosen case
  // Challenge board opened from the home PLAY popup (no case yet) or from a case file (case seeded)
  const [challengeSeed, setChallengeSeed] = useState<{ tab: 'quick' | 'local'; withCase: boolean } | null>(null);
  const [view, setView] = useState<AppView>('landing');
  const [currentSession, setCurrentSession] = useState<CaseSession | null>(null);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [currentVerdict, setCurrentVerdict] = useState<Verdict | null>(null);
  const [isCurrentCaseCustom, setIsCurrentCaseCustom] = useState(false);
  const [showCaseReview, setShowCaseReview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editCaseId, setEditCaseId] = useState<string | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showSubscriptionGate, setShowSubscriptionGate] = useState(false);
  const [subscriptionGateFeature, setSubscriptionGateFeature] = useState('');
  const [subscriptionGateRequired, setSubscriptionGateRequired] = useState<SubscriptionTier>('basic');
  const [showAuth, setShowAuth] = useState(false);

  // Refresh the badge counts whenever the player lands on Home or the dashboard
  useEffect(() => {
    if (!user) {
      setOngoingCount(0);
      setWaitingSentCount(0);
      setInvites([]);
      return;
    }
    if (!(showHome || view === 'landing')) return;
    let cancelled = false;
    (async () => {
      try {
        const [ongoing, invites, myChallenges, myInvites] = await Promise.all([
          db.sessions.getOngoingSessions(user.id),
          user.email ? db.invitations.getInvitationsByEmail(user.email) : Promise.resolve([]),
          db.challenges.getMyChallenges(user.id).catch(() => []),
          db.invitations.getInvitationsByUser(user.id).catch(() => [])
        ]);
        if (!cancelled) {
          setOngoingCount(ongoing.length);
          setInvites(invites);
          setWaitingSentCount(
            myChallenges.filter((c: any) => c.status === 'open' && c.creator_user_id === user.id).length +
            myInvites.filter(i => i.status === 'pending' && i.inviter_user_id === user.id).length
          );
        }
      } catch (error) {
        console.error('Failed to load activity counts:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [user, showHome, view]);

  // After signing out, drop back to a clean state so the next visitor
  // doesn't inherit an open popup or a leftover screen.
  useEffect(() => {
    if (!user) {
      setShowSettingsPopup(false);
      setView('landing');
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const adminEmails = [
        'joevicsworld@gmail.com',
        'joevicstown@gmail.com',
        'joevicsmovies@gmail.com',
        'joevicscrew@gmail.com',
        'joevicsland@gmail.com'
      ];
      const isUserAdmin = adminEmails.includes(user.email?.toLowerCase() || '');
      setIsAdmin(isUserAdmin);

      // A failed read must never look like "brand-new player": the placeholder below
      // has zero plays and an unset wizard flag, which is exactly what used to bring the
      // intro wizard back for old accounts whenever the profile request hiccuped.
      const placeholder = (showWizard: boolean) => ({
        user_id: user.id,
        subscription_tier: 'free',
        voice_minutes_remaining: 0,
        trial_count: 0,
        case_creation_count: 0,
        wins_count: 0,
        current_level: STARTING_RANK,
        is_admin: isUserAdmin,
        tutorial_completed: !showWizard,
        difficulty: 'medium',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as UserProfile);
      // Only a really fresh account may get the wizard from a placeholder.
      const createdMs = user.created_at ? Date.parse(user.created_at) : NaN;
      const isFreshAccount = Number.isFinite(createdMs) && Date.now() - createdMs < 24 * 60 * 60 * 1000;

      let cancelled = false;
      (async () => {
        let profile: UserProfile | null = null;
        let loaded = false;
        for (let attempt = 0; attempt < 3 && !loaded; attempt++) {
          try {
            profile = await db.users.fetchUserProfile(user.id);
            loaded = true;
          } catch (error) {
            console.error('Failed to load user profile (attempt ' + (attempt + 1) + '):', error);
            if (attempt < 2) await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
          }
        }
        if (cancelled) return;
        if (profile) {
          setUserProfile(profile);
        } else if (loaded) {
          // No row yet (signup trigger hasn't caught up): wizard only for a fresh account.
          setUserProfile(placeholder(isFreshAccount));
        } else {
          // Couldn't load at all: we don't know who this is, so never show the wizard.
          setUserProfile(placeholder(false));
        }
      })();
      return () => { cancelled = true; };
    } else {
      setUserProfile(null);
      setIsAdmin(false);
    }
  }, [user]);

  // The intro wizard is for brand-new players only, once (see lib/tutorialSeen).
  const needsTutorial = !!user && !!userProfile && !tutorialAlreadySeen(userProfile, user);

  // First-login tutorial: fires as soon as the profile loads, while still
  // on the landing view. Independent of case selection — previously this
  // only showed up after picking a case, deep inside the case flow.
  useEffect(() => {
    if (view === 'landing' && needsTutorial) {
      setView('tutorial');
    }
  }, [view, needsTutorial]);

  // Instant play: tapping a button on the home screen starts a guest
  // account when nobody is signed in. If guest sign-in isn't available
  // (e.g. not enabled in Supabase yet) fall back to the normal sign-in page.
  const ensurePlayer = async (): Promise<boolean> => {
    if (user) return true;
    const { error } = await signInAsGuest();
    if (error) {
      console.error('Guest sign-in failed, falling back to sign-in page:', error);
      setShowHome(false);
      setShowAuth(true);
      return false;
    }
    return true;
  };

  const homeScreen = (
    <>
      <HomePage
        hasAccount={!!user && !user.is_anonymous}
        signedIn={!!user}
        waitingCount={ongoingCount + invites.length}
        myGamesCount={ongoingCount + waitingSentCount}
        onOpenDashboard={() => {
          setShowHome(false);
          setView('landing');
        }}
        onPlay={async mode => {
          if (!(await ensurePlayer())) return;
          setShowHome(false);
          if (mode === 'ai') {
            setView('landing');
          } else if (mode === 'games') {
            setCaseBoardFromHome(true);
            setCaseBoardFilter('ongoing');
            setView('case-board');
          } else {
            setChallengeSeed({ tab: mode === 'online' ? 'quick' : 'local', withCase: false });
            setView('challenge-board');
          }
        }}
        onOpenSettings={async () => {
          if (await ensurePlayer()) setShowSettingsPopup(true);
        }}
        onSignIn={() => {
          setShowHome(false);
          setShowAuth(true);
        }}
      />
      {showSettingsPopup && user && userProfile && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75" onClick={() => setShowSettingsPopup(false)}>
          <div
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#14161f] border border-white/10"
            onClick={e => e.stopPropagation()}
          >
            <Settings
              popup
              userId={user.id}
              userProfile={userProfile}
              onBack={() => setShowSettingsPopup(false)}
              onProfileUpdated={setUserProfile}
            />
          </div>
        </div>
      )}
    </>
  );

  if (!bootDone) {
    return <LoadingScreen authReady={!authLoading} onDone={() => setBootDone(true)} />;
  }

  if (!user) {
    if (showAuth) {
      return <Auth onBack={() => setShowAuth(false)} />;
    }
    return homeScreen;
  }

  // Right after signup: pick a username, then build an avatar. Guests skip this
  // (they get a random avatar); existing accounts are asked once.
  if (!user.is_anonymous && !hasSavedAvatar(user)) {
    return (
      <AvatarCreator
        initialUsername={user.user_metadata?.nickname || ''}
        onDone={() => {}}
      />
    );
  }

  if (showHome) {
    return homeScreen;
  }

  if (!userProfile) {
    return null;
  }

  const handleTutorialDone = () => {
    if (user) {
      // Close for good right away, in this browser and in memory, so a failed save
      // below can never bring the wizard back.
      markTutorialSeen(user);
      setUserProfile(prev => (prev ? { ...prev, tutorial_completed: true } : prev));
      // Remember it on the account (works on other devices) and in the database.
      supabase.auth.updateUser({ data: { tutorial_done: true } }).catch(error => {
        console.error('Failed to save tutorial_done on the account:', error);
      });
      db.users
        .updateProfile(user.id, { tutorial_completed: true })
        .then(updated => setUserProfile(updated))
        .catch(error => console.error('Failed to mark tutorial complete:', error));
    }
    // New players who picked a two-player mode on the home screen continue into it
    setView(challengeSeed && !challengeSeed.withCase ? 'challenge-board' : 'landing');
  };

  // First-login tutorial: a hard gate, not an effect reacting to view
  // changes. This guarantees it shows immediately once the profile loads
  // and tutorial_completed is false — no race where a quick click into a
  // case beats the async profile fetch, and no chance of it firing later
  // mid-case if the user happens to navigate back through 'landing'.
  if (needsTutorial) {
    return <Tutorial onComplete={handleTutorialDone} onSkip={handleTutorialDone} />;
  }

  const handleSelectCase = async (caseId: string, isCustom: boolean) => {
    try {
      setIsLoading(true);

      const caseDetails = await db.cases.getCaseWithDetails(caseId);
      if (!caseDetails) {
        alert('Case not found');
        return;
      }
      setCurrentCase(caseDetails);
      setIsCurrentCaseCustom(isCustom);

      // Always start a NEW game. Existing games of this case are untouched
      // and stay in the Case Board's Ongoing list, so a player can run
      // several at once. No session is created yet; that only happens once
      // the user actually accepts a role (handleRoleSelect), so opening the
      // preview and backing out leaves nothing behind.
      setCurrentSession(null);
      setView('role-selection');
    } catch (error) {
      console.error('Failed to start case:', error);
      alert('Failed to start case. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCustomCase = () => {
    if (!canCreateCustomCase(userProfile.subscription_tier)) {
      setSubscriptionGateFeature('Custom Case Creation');
      setSubscriptionGateRequired('basic');
      setShowSubscriptionGate(true);
      return;
    }

    setEditCaseId(undefined);
    setView('custom-case-creator');
  };

  const handleEditCustomCase = (caseId: string) => {
    setEditCaseId(caseId);
    setView('custom-case-creator');
  };

  const handleCustomCaseComplete = async (caseId: string) => {
    await handleSelectCase(caseId, true);
  };

  const handleCancelCustomCase = () => {
    setEditCaseId(undefined);
    setView('case-selection');
  };

  const handleOpenAdmin = () => {
    setView('admin');
  };

  const handleNavigateToCaseBoard = () => {
    setCaseBoardFromHome(false);
    setCaseBoardFilter('all');
    setView('case-board');
  };

  const handleNavigateToCustomCases = () => {
    setView('case-selection');
  };

  const resumeSession = async (session: CaseSession) => {
    try {
      setIsLoading(true);
      const caseDetails = await db.cases.getCaseWithDetails(session.case_id);
      if (!caseDetails) {
        alert('Case not found');
        return;
      }
      setCurrentCase(caseDetails);
      setIsCurrentCaseCustom(caseDetails.is_preset === false);
      setCurrentSession(session);

      // Resume from saved phase
      switch (session.current_phase) {
        case 'role-selection':
          setView('role-selection');
          break;
        case 'investigation':
          setView('investigation');
          break;
        case 'difficulty-selection': // legacy — this phase no longer exists, redirect forward
        case 'trial-type-selection':
          setView('trial-type-selection');
          break;
        case 'jury-selection':
          setView('jury-selection');
          break;
        case 'pre-trial':
          setView('pre-trial');
          break;
        case 'trial':
          setView('courtroom');
          break;
        case 'completed':
          setView('landing');
          break;
        default:
          setView('investigation');
      }
    } catch (error) {
      console.error('Failed to resume session:', error);
      alert('Failed to resume case. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resume one specific game (Case Board "Ongoing" cards).
  const handleContinueSession = async (sessionId: string) => {
    setShowCaseReview(false);
    try {
      setIsLoading(true);
      const session = await db.sessions.getSession(sessionId);
      if (session) {
        await resumeSession(session);
      } else {
        alert('That game could not be found.');
      }
    } catch (error) {
      console.error('Failed to continue game:', error);
      alert('Failed to continue the game. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resume the most recently played game of a case (My Cases "Continue").
  const handleContinueCase = async (caseId: string) => {
    setShowCaseReview(false);
    try {
      setIsLoading(true);
      // Most recent ongoing session for this case (list is newest first)
      const ongoingSessions = await db.sessions.getOngoingSessions(user.id);
      const session = ongoingSessions.find(s => s.case_id === caseId);
      
      if (session) {
        // Resume existing session
        await resumeSession(session);
      } else {
        // No existing session, start fresh
        await handleSelectCase(caseId, false);
      }
    } catch (error) {
      console.error('Failed to continue case:', error);
      await handleSelectCase(caseId, false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackFromInvestigation = () => {
    setCurrentSession(null);
    setView(isCurrentCaseCustom ? 'case-selection' : 'landing');
  };

  const handleBackFromCourtroom = () => {
    setCurrentSession(null);
    setView('landing');
  };

  const handleProceedToTrial = async () => {
    if (!currentSession) return;

    if (!userProfile.is_admin) {
      const trialLimit = getTrialLimit(userProfile.subscription_tier);
      if (userProfile.trial_count >= trialLimit) {
        setSubscriptionGateFeature('Unlimited Trials');
        setSubscriptionGateRequired('basic');
        setShowSubscriptionGate(true);
        return;
      }

      await db.users.updateProfile(user.id, {
        trial_count: userProfile.trial_count + 1
      });

      setUserProfile({
        ...userProfile,
        trial_count: userProfile.trial_count + 1
      });
    }

    // Save progress - user has completed investigation and is proceeding to trial
    try {
      await db.sessions.updateSession(currentSession.id, {
        current_phase: 'trial-type-selection'
      });
      const updatedSession = await db.sessions.getSession(currentSession.id);
      if (updatedSession) {
        setCurrentSession(updatedSession);
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
    }

    setView('trial-type-selection');
  };

  // Invitations shown on the dashboard — same actions as the Challenge Board's Invite tab
  const handleAcceptInvite = async (invitationId: string) => {
    if (!user) return;
    setRespondingInviteId(invitationId);
    try {
      const session = await db.invitations.acceptInvitation(invitationId, user.id);
      setInvites(prev => prev.filter(i => i.id !== invitationId));
      await handleMatched(session);
    } catch (error: any) {
      console.error('Failed to accept invitation:', error);
      alert(error?.message || 'Could not accept this invitation.');
      if (user.email) {
        db.invitations.getInvitationsByEmail(user.email).then(setInvites).catch(() => {});
      }
    } finally {
      setRespondingInviteId(null);
    }
  };

  const handleDeclineInvite = async (invitationId: string) => {
    if (!user) return;
    setRespondingInviteId(invitationId);
    try {
      await db.invitations.declineInvitation(invitationId, user.id);
      setInvites(prev => prev.filter(i => i.id !== invitationId));
    } catch (error) {
      console.error('Failed to decline invitation:', error);
    } finally {
      setRespondingInviteId(null);
    }
  };

  const handleMatched = async (session: CaseSession) => {
    setChallengeSeed(null);
    // A challenge just got matched (either I created it and someone joined,
    // or I just joined someone else's) — the session already exists at
    // 'investigation', so this is the same as resuming any other session.
    await resumeSession(session);
  };

  const handleRoleSelect = async (role: PlayerRole, practiceMode: boolean = false) => {
    if (!currentCase || !user) return;

    try {
      const session = await db.sessions.createSession(currentCase.id, user.id);
      await db.sessions.updateSession(session.id, {
        current_phase: 'investigation',
        session_state: {
          playerRole: role,
          practiceMode
        }
      });
      const updatedSession = await db.sessions.getSession(session.id);
      if (updatedSession) {
        setCurrentSession(updatedSession);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
      return;
    }

    setView('investigation');
  };

  const handleTrialTypeSelect = async (trialType: TrialType, duration: number) => {
    if (!currentSession) return;

    try {
      // Judge and prosecutor are decided ONCE, here, before the flow
      // branches into jury-selection or pre-trial. Both PreTrialScript and
      // Courtroom read these from session_state instead of each rolling
      // their own — that was the source of the pretrial/trial name mismatch.
      const judgeName = getRandomJudgeName();
      const prosecutorName = getRandomProsecutorName();

      await db.sessions.updateSession(currentSession.id, {
        trial_type: trialType,
        trial_duration: duration,
        evidence_filed: true,
        witnesses_locked: true,
        current_phase: trialType === 'jury' ? 'jury-selection' : 'pre-trial',
        session_state: {
          ...currentSession.session_state,
          judgeName,
          prosecutorName,
          difficulty: userProfile?.difficulty || 'medium'
        }
      });

      const updatedSession = await db.sessions.getSession(currentSession.id);
      if (updatedSession) {
        setCurrentSession(updatedSession);
      }

      if (trialType === 'judge') {
        // No jury selection step for a bench trial — let the player know
        // who's deciding the case instead of silently skipping straight
        // past it. Written directly to trial_events (rather than through
        // any local transcript state) since it'll be picked up when
        // Courtroom loads the session's events later.
        try {
          await db.trialEvents.addEvent({
            session_id: currentSession.id,
            event_type: 'announcement',
            speaker_role: 'judge',
            speaker_name: 'Court',
            content: `Judge ${judgeName} has been assigned this case.`,
            metadata: { phase: 0 },
            event_order: 0
          });
        } catch (error) {
          console.error('Failed to record judge assignment:', error);
        }
      }

      if (trialType === 'jury') {
        setView('jury-selection');
      } else {
        setView('pre-trial');
      }
    } catch (error) {
      console.error('Failed to set trial type:', error);
    }
  };

  const handleJurySelectionComplete = async () => {
    if (!currentSession) return;

    try {
      await db.sessions.updateSession(currentSession.id, {
        jury_selection_complete: true,
        current_phase: 'pre-trial'
      });

      const updatedSession = await db.sessions.getSession(currentSession.id);
      if (updatedSession) {
        setCurrentSession(updatedSession);
      }

      // Go to pre-trial screen first
      setView('pre-trial');
    } catch (error) {
      console.error('Failed to complete jury selection:', error);
    }
  };

  const handlePreTrialComplete = async (pleaGuilty: boolean, judgeName: string, prosecutorName: string) => {
    if (!currentSession) return;

    if (pleaGuilty) {
      // If guilty plea, end the case
      try {
        await db.sessions.updateSession(currentSession.id, {
          current_phase: 'completed',
          completed_at: new Date().toISOString()
        });
        // Could show a verdict screen for guilty plea
        setView('landing');
      } catch (error) {
        console.error('Failed to complete session:', error);
      }
    } else {
      // Not guilty - proceed to trial
      await startTrial();
    }
  };

  const startTrial = async () => {
    if (!currentSession) return;

    try {
      // Start at phase 7 (Opening Statement - Prosecution)
      await db.sessions.updateSession(currentSession.id, {
        current_phase: 'trial',
        current_trial_phase: 7
      });

      const updatedSession = await db.sessions.getSession(currentSession.id);
      if (updatedSession) {
        setCurrentSession(updatedSession);
      }

      setView('courtroom');
    } catch (error) {
      console.error('Failed to start trial:', error);
    }
  };

  const handleTrialComplete = async (verdict: Verdict) => {
    setCurrentVerdict(verdict);

    // Ensure session is marked as completed (in case it wasn't already)
    if (currentSession && currentSession.current_phase !== 'completed') {
      try {
        await db.sessions.updateSession(currentSession.id, {
          current_phase: 'completed',
          completed_at: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to mark session as completed:', error);
      }
    }

    // Wins are recorded by the database the moment the verdict is saved (for
    // every winner, on any device), so the app only needs to refresh this
    // player's profile to pick up their new win count and level.
    try {
      const fresh = await db.users.getUserProfile(user.id);
      if (fresh) setUserProfile(fresh);
    } catch (error) {
      console.error('Failed to refresh profile after verdict:', error);
    }

    setView('verdict');
  };

  const handleReturnHome = () => {
    setCurrentSession(null);
    setCurrentVerdict(null);
    setView('landing');
    // Force a refresh of case board when returning home
    // This ensures completed cases appear as "new" cases
    window.dispatchEvent(new Event('caseBoardRefresh'));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading case...</div>
      </div>
    );
  }

  return (
    <>
      {view === 'landing' && (
        <LandingPage
          userProfile={userProfile}
          onNavigateToCaseBoard={handleNavigateToCaseBoard}
          onNavigateToCustomCases={handleNavigateToCustomCases}
          onNavigateToChallengeBoard={() => setView('challenge-board')}
          onPlayFeaturedCase={(caseId) => handleSelectCase(caseId, false)}
          onOpenSettings={() => setView('settings')}
          onOpenAdmin={isAdmin ? handleOpenAdmin : undefined}
          onBackToHome={() => setShowHome(true)}
          ongoingCount={ongoingCount}
          invites={invites}
          respondingInviteId={respondingInviteId}
          onAcceptInvite={handleAcceptInvite}
          onDeclineInvite={handleDeclineInvite}
        />
      )}

      {view === 'challenge-board' && user && (
        <ChallengeBoard
          userId={user.id}
          userEmail={user.email || ''}
          onBack={() => {
            const seed = challengeSeed;
            setChallengeSeed(null);
            if (seed?.withCase) {
              setView('role-selection');
            } else if (seed) {
              setView('landing');
              setShowHome(true);
            } else {
              setView('landing');
            }
          }}
          onMatched={handleMatched}
          onOpenMyGames={() => {
            setChallengeSeed(null);
            setCaseBoardFromHome(false);
            setCaseBoardFilter('ongoing');
            setView('case-board');
          }}
          initialCase={challengeSeed?.withCase && currentCase ? currentCase : undefined}
          initialTab={challengeSeed?.tab}
        />
      )}

      {view === 'case-board' && (
        <CaseBoard
          onBack={() => {
            // Came here from the Play popup's My games? Go back to Home.
            if (caseBoardFromHome) {
              setCaseBoardFromHome(false);
              setShowHome(true);
            }
            setView('landing');
          }}
          initialFilter={caseBoardFilter}
          onSelectCase={(caseId) => handleSelectCase(caseId, false)}
          onContinueSession={handleContinueSession}
        />
      )}

      {view === 'case-selection' && (
        <CaseSelection
          onSelectCase={handleSelectCase}
          onContinueCase={handleContinueCase}
          onCreateCustomCase={handleCreateCustomCase}
          onEditCustomCase={handleEditCustomCase}
          onOpenAdmin={isAdmin ? handleOpenAdmin : undefined}
          onBack={() => setView('landing')}
        />
      )}

      {view === 'admin' && (
        <AdminPanel onBack={() => setView('landing')} />
      )}

      {view === 'custom-case-creator' && (
        <CustomCaseCreator
          onComplete={handleCustomCaseComplete}
          onCancel={handleCancelCustomCase}
          editCaseId={editCaseId}
        />
      )}

      {view === 'investigation' && (currentSession || showCaseReview) && (
        <Investigation
          session={currentSession}
          onProceedToTrial={handleProceedToTrial}
          onBack={handleBackFromInvestigation}
          showCaseReview={showCaseReview}
          caseForReview={currentCase}
          onReviewAccept={async () => {
            // Check for existing session first, otherwise create new one
            if (currentCase && !currentSession) {
              try {
                setIsLoading(true);
                const session = await db.sessions.createSession(currentCase.id, user.id);
                setCurrentSession(session);
                await db.sessions.updateSession(session.id, {
                  current_phase: 'investigation'
                });
                setShowCaseReview(false);
              } catch (error) {
                console.error('Failed to create/resume session:', error);
                alert('Failed to start case. Please try again.');
              } finally {
                setIsLoading(false);
              }
            } else {
              setShowCaseReview(false);
            }
          }}
          onReviewReject={() => {
            setShowCaseReview(false);
            setCurrentCase(null);
            setCurrentSession(null);
            setView('case-board');
          }}
        />
      )}

      {view === 'role-selection' && currentCase && (
        <CasePreview
          caseId={currentCase.id}
          caseTitle={currentCase.title}
          caseText={currentCase.case_summary || currentCase.description}
          defendantName={currentCase.defendant_name || (currentCase.truth_state as any)?.defendant_name}
          onSelect={handleRoleSelect}
          playerWins={userProfile?.wins_count ?? 0}
          onCancel={handleBackFromInvestigation}
          onSwitchMode={mode => {
            setChallengeSeed({ tab: mode === 'online' ? 'quick' : 'local', withCase: true });
            setView('challenge-board');
          }}
          onlineDisabled={isCurrentCaseCustom}
        />
      )}

      {view === 'settings' && user && userProfile && (
        <Settings
          userId={user.id}
          userProfile={userProfile}
          onBack={() => setView('landing')}
          onProfileUpdated={setUserProfile}
        />
      )}

      {view === 'trial-type-selection' && currentSession && (
        <TrialTypeSelector
          onSelect={handleTrialTypeSelect}
          onCancel={handleBackFromInvestigation}
        />
      )}

      {view === 'jury-selection' && currentSession && (
        <JurySelection
          sessionId={currentSession.id}
          maxJurors={12}
          onComplete={handleJurySelectionComplete}
          onBack={handleBackFromInvestigation}
        />
      )}

      {view === 'pre-trial' && currentSession && currentCase && (
        <PreTrialScript
          caseTitle={currentCase.title}
          userName={getUserDisplayName(user)}
          judgeName={(currentSession.session_state as any)?.judgeName || ''}
          prosecutorName={(currentSession.session_state as any)?.prosecutorName || ''}
          playerRole={(currentSession.session_state as any)?.playerRole || 'defense'}
          sessionId={currentSession.id}
          playerWins={userProfile?.wins_count ?? 0}
          onComplete={handlePreTrialComplete}
        />
      )}

      {view === 'courtroom' && currentSession && (
        <Courtroom
          session={currentSession}
          onComplete={handleTrialComplete}
          onBack={handleBackFromCourtroom}
          playerWins={userProfile?.wins_count ?? 0}
        />
      )}

      {view === 'verdict' && currentVerdict && currentCase && (
        <VerdictDisplay
          verdict={currentVerdict}
          caseTitle={currentCase.title}
          currentLevel={userProfile.current_level}
          playerRole={getSessionPlayerRole(currentSession, user.id)}
          wins={userProfile?.wins_count}
          onReturnHome={handleReturnHome}
        />
      )}

      {showSubscriptionGate && userProfile && (
        <SubscriptionGate
          requiredTier={subscriptionGateRequired}
          currentTier={userProfile.subscription_tier}
          feature={subscriptionGateFeature}
          onClose={() => setShowSubscriptionGate(false)}
          onUpgrade={() => {
            setShowSubscriptionGate(false);
            alert('Upgrade functionality would be integrated with payment processor here');
          }}
        />
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <SessionProvider>
        <AppContent />
      </SessionProvider>
    </AuthProvider>
  );
}

export default App;
