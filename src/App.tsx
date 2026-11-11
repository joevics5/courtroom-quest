import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { appAlert } from './lib/appDialog';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SessionProvider } from './contexts/SessionContext';
import Auth from './components/Auth';
import { hasSavedAvatar } from './lib/avatars';
import HomePage from './components/HomePage';
import LoadingScreen from './components/LoadingScreen';
import LandingPage from './components/LandingPage';
import { countMyGames } from './lib/gameCounts';
import CaseSelection from './components/CaseSelection';
import SubscriptionGate, { getTrialLimit, canCreateCustomCase } from './components/SubscriptionGate';
import { db } from './lib/database';
import { getLevelForWins, STARTING_RANK } from './lib/levels';
import { getUserDisplayName, getPublicName } from './lib/userName';
import { getRandomJudgeName, getRandomProsecutorName } from './lib/trialConfig';
import { getSessionPlayerRole } from './lib/verdictUtils';
import { LIVE_POLL_MS, isAhead, isOnlineTwoPlayer, isSessionHost, mySideIn, opponentUserIdIn, otherSide, parseStatus, playMode, pretrialLive, readyKey, readyState, statusKey, statusLine } from './lib/liveGame';
import LiveStatusBar from './components/LiveStatusBar';
import { fetchPublicProfile } from './lib/publicProfile';
import type { AvatarConfig } from './lib/avatars';
import type { HistoryEntry } from './lib/caseHistory';
import { appealsEnabled } from './lib/appeals';
import type { CaseInvitation, CaseSession, Verdict, TrialType, UserProfile, SubscriptionTier, Case, Difficulty, PlayerRole } from './types';
import { supabase } from './lib/supabase';
import { whenIdle } from './lib/whenIdle';
import { markTutorialSeen, tutorialAlreadySeen } from './lib/tutorialSeen';
import { captureChallengeLink, clearPendingChallenge } from './lib/challengeLink';

// Heavy screens load on demand so the first screen (home → play) downloads less code.
// Screens the first paint doesn't need are loaded when first opened (and fetched in the background once the home screen is up).
const CaseBoard = lazy(() => import('./components/CaseBoard'));
const AvatarCreator = lazy(() => import('./components/AvatarCreator'));
const Settings = lazy(() => import('./components/Settings'));
const ChallengeLink = lazy(() => import('./components/ChallengeLink'));
const CustomCaseCreator = lazy(() => import('./components/CustomCaseCreator'));
const Investigation = lazy(() => import('./components/Investigation'));
const Courtroom = lazy(() => import('./components/Courtroom'));
const VerdictDisplay = lazy(() => import('./components/VerdictDisplay'));
const CaseHistory = lazy(() => import('./components/CaseHistory'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const TrialTypeSelector = lazy(() => import('./components/TrialTypeSelector'));
const JurySelection = lazy(() => import('./components/JurySelection'));
const PreTrialScript = lazy(() => import('./components/PreTrialScript'));
const WaitingRoom = lazy(() => import('./components/WaitingRoom'));
const CasePreview = lazy(() => import('./components/CasePreview'));
const ChallengeBoard = lazy(() => import('./components/ChallengeBoard'));
const Tutorial = lazy(() => import('./components/Tutorial'));

type AppView =
  | 'landing'
  | 'case-history'
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

  // Once the home screen is up, fetch the screens people open next, in the background, so tapping them feels instant.
  useEffect(() => {
    if (!bootDone) return;
    whenIdle(() => {
      void import('./components/CaseBoard');
      void import('./components/Settings');
      void import('./components/CasePreview');
    });
  }, [bootDone]);
  const [showHome, setShowHome] = useState(true);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);
  // Ongoing games and invitations waiting — shown as badges on Home and the dashboard
  const [ongoingCount, setOngoingCount] = useState(0);
  // My challenges / invites still waiting for the other player
  const [waitingSentCount, setWaitingSentCount] = useState(0);
  // Which tab the Case Board opens on (My games when coming from the Play popup)
  const [caseBoardFilter, setCaseBoardFilter] = useState<'all' | 'new' | 'ongoing'>('all');
  const [caseBoardFromHome, setCaseBoardFromHome] = useState(false);
  // Set right after the avatar is saved, so a new player lands on the Case Board (after the intro, if any)
  const [goToCasesNext, setGoToCasesNext] = useState(false);
  const [invites, setInvites] = useState<CaseInvitation[]>([]);
  // Opponent appeals waiting for this player's answer: shown on the dashboard like invites.
  const [appealRequestCount, setAppealRequestCount] = useState(0);
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);
  // Set when the challenge board is opened from the play-mode screen for an already-chosen case
  // Challenge board opened from the home PLAY popup (no case yet) or from a case file (case seeded)
  const [challengeSeed, setChallengeSeed] = useState<{ tab: 'quick' | 'local'; withCase: boolean } | null>(null);
  const [view, setView] = useState<AppView>('landing');
  // Where the Case File popup was opened from, so closing it returns there.
  const [roleReturnView, setRoleReturnView] = useState<AppView | null>(null);
  const [currentSession, setCurrentSession] = useState<CaseSession | null>(null);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [currentVerdict, setCurrentVerdict] = useState<Verdict | null>(null);
  // True when the verdict on screen was opened from the case history, so "back" returns there.
  const [verdictFromHistory, setVerdictFromHistory] = useState(false);
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
  // A private-challenge link was opened (?challenge=...): shown instead of the home screen until accepted or dismissed.
  const [linkChallengeId, setLinkChallengeId] = useState<string | null>(() => captureChallengeLink());

  // Refresh the badge counts whenever the player lands on Home or the dashboard
  useEffect(() => {
    if (!user) {
      setOngoingCount(0);
      setWaitingSentCount(0);
      setInvites([]);
      setAppealRequestCount(0);
      return;
    }
    if (!(showHome || view === 'landing')) return;
    let cancelled = false;
    (async () => {
      try {
        const [ongoing, invites, myChallenges, myInvites, appealRows] = await Promise.all([
          db.sessions.getOngoingSessions(user.id),
          user.email ? db.invitations.getInvitationsByEmail(user.email) : Promise.resolve([]),
          db.challenges.getMyChallenges(user.id).catch(() => []),
          db.invitations.getInvitationsByUser(user.id).catch(() => []),
          appealsEnabled() ? db.sessions.getAppealRequests(user.id).catch(() => []) : Promise.resolve([])
        ]);
        if (!cancelled) {
          setAppealRequestCount(appealRows.length);
          // Same rule as the Case Board, so the badges match what it lists.
          const counts = countMyGames({ userId: user.id, ongoing: ongoing as any[], challenges: myChallenges as any[], invitations: myInvites });
          setOngoingCount(counts.ongoing);
          setInvites(invites);
          setWaitingSentCount(counts.waitingSent);
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

  // ---- someone accepts MY challenge or invitation: take me into the game at once ----
  const resumeSessionRef = useRef<(session: CaseSession) => Promise<void>>(async () => {});
  const viewRef = useRef<AppView>('landing');
  viewRef.current = view;
  useEffect(() => {
    if (!user) return;
    let alive = true;
    let timer: number | undefined;
    // Challenges / invitations of mine that were still waiting the last time I looked.
    const waiting = new Set<string>();
    const handled = new Set<string>();
    const justNow = (t?: string | null) => !!t && Date.now() - Date.parse(t) < 120000;
    const inGameViews: AppView[] = ['role-selection', 'investigation', 'trial-type-selection', 'jury-selection', 'pre-trial', 'courtroom', 'verdict'];
    const tick = async () => {
      let nextDelay = 4000;
      try {
        if (document.visibilityState !== 'hidden') {
          const [mine, sent] = await Promise.all([
            db.challenges.getMyChallenges(user.id).catch(() => []),
            db.invitations.getInvitationsByUser(user.id).catch(() => [])
          ]);
          if (!alive) return;
          const matched: Array<{ key: string; sessionId: string }> = [];
          const stillOpen = new Set<string>();
          for (const c of mine as any[]) {
            if (c.creator_user_id !== user.id) continue;
            if (c.status === 'open') stillOpen.add(`c:${c.id}`);
            else if (c.status === 'matched' && c.session_id && !handled.has(`c:${c.id}`) && (waiting.has(`c:${c.id}`) || justNow(c.matched_at))) matched.push({ key: `c:${c.id}`, sessionId: c.session_id });
          }
          for (const i of sent as any[]) {
            if (i.inviter_user_id !== user.id) continue;
            if (i.status === 'pending') stillOpen.add(`i:${i.id}`);
            else if (i.status === 'accepted' && i.session_id && !handled.has(`i:${i.id}`) && (waiting.has(`i:${i.id}`) || justNow(i.accepted_at))) matched.push({ key: `i:${i.id}`, sessionId: i.session_id });
          }
          waiting.clear();
          stillOpen.forEach(k => waiting.add(k));
          if (matched.length > 0) {
            matched.forEach(m => handled.add(m.key));
            const session = await db.sessions.getSession(matched[0].sessionId);
            if (alive && session) {
              if (inGameViews.includes(viewRef.current)) {
                void appAlert({ title: 'YOUR CHALLENGE WAS ACCEPTED', message: 'Your opponent joined. Find the new game under My games.', tone: 'info' });
              } else {
                setChallengeSeed(null);
                await resumeSessionRef.current(session);
              }
            }
          }
          // While something of mine is waiting for an opponent, look often so the match shows up at once.
          nextDelay = stillOpen.size > 0 ? 2000 : 4000;
        }
      } catch { /* try again on the next tick */ }
      if (alive) timer = window.setTimeout(tick, nextDelay);
    };
    void tick();
    return () => { alive = false; if (timer) window.clearTimeout(timer); };
  }, [user?.id]);

  // ---- two players, two devices: keep both screens in step ----
  const liveOnline = isOnlineTwoPlayer(currentSession);
  const liveSessionId = currentSession?.id;
  const opponentId = user ? opponentUserIdIn(currentSession, user.id) : null;
  const [opponent, setOpponent] = useState<{ name: string; avatar: AvatarConfig | null; rank: number | null } | null>(null);
  useEffect(() => {
    if (!opponentId) { setOpponent(null); return; }
    let cancelled = false;
    fetchPublicProfile(opponentId).then(p => {
      if (!cancelled) setOpponent({ name: p?.username || 'Opposing Counsel', avatar: p?.avatar ?? null, rank: p?.rank ?? null });
    });
    return () => { cancelled = true; };
  }, [opponentId]);

  /** Writes my part of the shared game state (and can move the game on), then shows the result at once. */
  const patchLive = async (patch: Record<string, unknown>, phase?: string, trialPhase?: number): Promise<CaseSession | null> => {
    if (!currentSession) return null;
    try {
      const updated = await db.sessions.mergeState(currentSession.id, patch, phase, trialPhase);
      setCurrentSession(updated);
      return updated;
    } catch (error) {
      console.error('Failed to update the shared game:', error);
      return null;
    }
  };

  // What I am doing, for the other player's screen ("is choosing jurors"). Only written when it changes.
  const lastStatusRef = useRef('');
  const reportStatus = (text: string) => {
    if (!liveOnline || !currentSession || !user) return;
    if (lastStatusRef.current === `${currentSession.id}:${text}`) return;
    lastStatusRef.current = `${currentSession.id}:${text}`;
    void patchLive({ [statusKey(mySideIn(currentSession, user.id))]: { text, seq: Date.now() } });
  };
  useEffect(() => {
    if (!liveOnline || !user) return;
    const host = isSessionHost(currentSession, user.id);
    const byView: Partial<Record<AppView, string>> = {
      investigation: 'is investigating the case',
      'trial-type-selection': host ? 'is choosing the trial type' : 'is waiting for the trial to be set up',
      'jury-selection': 'is choosing jurors',
      'pre-trial': 'is heading into the courtroom'
    };
    const text = byView[view];
    if (text) reportStatus(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, liveOnline, liveSessionId]);

  // While the setup screens are open, follow the other player: their changes show up on their own, and
  // when the game moves to the next stage (they proceeded, set the trial up, chose the last juror…) so do I.
  useEffect(() => {
    const phaseOfView: Partial<Record<AppView, string>> = {
      investigation: 'investigation',
      'trial-type-selection': 'trial-type-selection',
      'jury-selection': 'jury-selection',
      'pre-trial': 'pre-trial'
    };
    const myPhase = phaseOfView[view];
    if (!user || !liveSessionId || !liveOnline || !myPhase) return;
    let alive = true;
    const tick = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        let fresh = await db.sessions.getSession(liveSessionId);
        if (!alive || !fresh) return;
        // Both players are ready for trial but nobody has moved the game on yet (they pressed at the same moment).
        const st = (fresh.session_state || {}) as Record<string, unknown>;
        if (fresh.current_phase === 'investigation' && st[readyKey('prosecution')] && st[readyKey('defense')]) {
          fresh = await db.sessions.mergeState(liveSessionId, {}, 'trial-type-selection');
          if (!alive) return;
        }
        const latest = fresh;
        setCurrentSession(prev => {
          if (!prev || prev.id !== latest.id) return prev;
          const same = prev.current_phase === latest.current_phase && JSON.stringify(prev.session_state) === JSON.stringify(latest.session_state);
          return same ? prev : latest;
        });
        if (isAhead(latest.current_phase, myPhase)) {
          switch (latest.current_phase) {
            case 'trial-type-selection': case 'difficulty-selection': setView('trial-type-selection'); break;
            case 'jury-selection': setView('jury-selection'); break;
            case 'pre-trial': setView('pre-trial'); break;
            case 'trial': setView('courtroom'); break;
            case 'completed': setView('landing'); break;
          }
        }
      } catch { /* try again on the next tick */ }
    };
    const id = window.setInterval(tick, LIVE_POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void tick(); };
    document.addEventListener('visibilitychange', onVisible);
    void tick();
    return () => { alive = false; window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, liveSessionId, liveOnline, view]);

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
        waitingCount={ongoingCount + invites.length + appealRequestCount}
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
            className="w-full max-w-lg lg:max-w-4xl max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#14161f] border border-white/10"
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

  const dismissChallengeLink = () => {
    clearPendingChallenge();
    setLinkChallengeId(null);
  };

  if (!user) {
    if (showAuth) {
      return <Auth onBack={() => setShowAuth(false)} />;
    }
    if (linkChallengeId) {
      return (
        <ChallengeLink
          challengeId={linkChallengeId}
          userId={null}
          onPlayAsGuest={async () => {
            const { error } = await signInAsGuest();
            // Guest sign-in unavailable: fall back to the normal sign-in page (the link is remembered).
            if (error) {
              console.error('Guest sign-in failed, falling back to sign-in page:', error);
              setShowAuth(true);
            }
          }}
          onSignIn={() => setShowAuth(true)}
          onAccepted={() => {}}
          onDismiss={dismissChallengeLink}
        />
      );
    }
    return homeScreen;
  }

  // Right after signup: pick a username, then build an avatar. Guests skip this
  // (they get a random avatar); existing accounts are asked once.
  if (!user.is_anonymous && !hasSavedAvatar(user)) {
    return (
      <AvatarCreator
        initialUsername={user.user_metadata?.nickname || ''}
        onDone={() => {
          setGoToCasesNext(true);
          setShowHome(false);
          setCaseBoardFromHome(false);
          setCaseBoardFilter('new');
          setView('case-board');
        }}
      />
    );
  }

  if (showHome && !linkChallengeId) {
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
    if (goToCasesNext) {
      setGoToCasesNext(false);
      setCaseBoardFromHome(false);
      setCaseBoardFilter('new');
      setView('case-board');
      return;
    }
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
        void appAlert({ title: 'CASE NOT FOUND', message: 'That case could not be found.', tone: 'error' });
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
      setRoleReturnView(view === 'case-board' || view === 'case-selection' ? view : null);
      setView('role-selection');
    } catch (error) {
      console.error('Failed to start case:', error);
      void appAlert({ title: "COULDN'T START THE CASE", message: 'Please try again.', tone: 'error' });
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
        void appAlert({ title: 'CASE NOT FOUND', message: 'That case could not be found.', tone: 'error' });
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
      void appAlert({ title: "COULDN'T RESUME THE CASE", message: 'Please try again.', tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Resume one specific game (Case Board "Ongoing" cards).
  resumeSessionRef.current = resumeSession;

  const handleContinueSession = async (sessionId: string) => {
    setShowCaseReview(false);
    try {
      setIsLoading(true);
      const session = await db.sessions.getSession(sessionId);
      if (session) {
        await resumeSession(session);
      } else {
        void appAlert({ title: 'GAME NOT FOUND', message: 'That game could not be found.', tone: 'error' });
      }
    } catch (error) {
      console.error('Failed to continue game:', error);
      void appAlert({ title: "COULDN'T CONTINUE THE GAME", message: 'Please try again.', tone: 'error' });
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

  /** Closing the Case File popup goes back to where it was opened (Case Board, case list or dashboard). */
  const handleCloseCasePreview = () => {
    setCurrentSession(null);
    setView(roleReturnView ?? (isCurrentCaseCustom ? 'case-selection' : 'landing'));
    setRoleReturnView(null);
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

    // Two players: pressing Proceed says "I'm ready". The game moves on once BOTH are ready; until then
    // the other player sees that I am waiting for them.
    if (isOnlineTwoPlayer(currentSession)) {
      const mine = mySideIn(currentSession, user.id);
      const latest = (await db.sessions.getSession(currentSession.id)) || currentSession;
      const { opponentReady } = readyState(latest, mine);
      const updated = await patchLive({ [readyKey(mine)]: true }, opponentReady ? 'trial-type-selection' : undefined);
      if (updated?.current_phase === 'trial-type-selection') setView('trial-type-selection');
      return;
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
      void appAlert({ title: "COULDN'T ACCEPT THE INVITATION", message: error?.message || 'Could not accept this invitation.', tone: 'error' });
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

      const nextPhase = trialType === 'jury' ? 'jury-selection' : 'pre-trial';
      if (isOnlineTwoPlayer(currentSession)) {
        // Two players: only the host gets here. Their settings are merged in (never written over the whole
        // state), and the move to the next stage is what takes the other player there too.
        await db.sessions.updateSession(currentSession.id, {
          trial_type: trialType,
          trial_duration: duration,
          evidence_filed: true,
          witnesses_locked: true
        });
        await db.sessions.mergeState(
          currentSession.id,
          { judgeName, prosecutorName, difficulty: userProfile?.difficulty || 'medium' },
          nextPhase
        );
      } else {
        await db.sessions.updateSession(currentSession.id, {
          trial_type: trialType,
          trial_duration: duration,
          evidence_filed: true,
          witnesses_locked: true,
          current_phase: nextPhase,
          session_state: {
            ...currentSession.session_state,
            judgeName,
            prosecutorName,
            difficulty: userProfile?.difficulty || 'medium'
          }
        });
      }

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

  // The judge granted an appeal: the database has put the case back at the start of the pre-trial
  // (same jurors, same transcript), so carry on from there like any resumed game.
  const handleReopenCase = async (session: CaseSession) => {
    setVerdictFromHistory(false);
    setCurrentVerdict(null);
    await resumeSession(session);
  };

  // Open a finished case from the history on its verdict screen (where a loss can be appealed).
  const handleOpenHistoryCase = async (entry: HistoryEntry) => {
    try {
      setIsLoading(true);
      const session = await db.sessions.getSession(entry.sessionId);
      const caseDetails = session ? await db.cases.getCaseWithDetails(session.case_id) : null;
      if (!session || !caseDetails) {
        void appAlert({ title: 'CASE NOT FOUND', message: 'That case could not be opened.', tone: 'error' });
        return;
      }
      setCurrentSession(session);
      setCurrentCase(caseDetails);
      setCurrentVerdict(entry.verdict);
      setVerdictFromHistory(true);
      setView('verdict');
    } catch (error) {
      console.error('Failed to open case from history:', error);
      void appAlert({ title: "COULDN'T OPEN THE CASE", message: 'Please try again.', tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // The dashboard's "Respond to appeal": open that finished game on its verdict screen, where the appeal can be answered.
  const handleOpenAppealRequest = async (sessionId: string) => {
    try {
      setIsLoading(true);
      const session = await db.sessions.getSession(sessionId);
      const [caseDetails, verdict] = await Promise.all([
        session ? db.cases.getCaseWithDetails(session.case_id) : Promise.resolve(null),
        db.verdicts.getSessionVerdict(sessionId)
      ]);
      if (!session || !caseDetails || !verdict) {
        void appAlert({ title: 'CASE NOT FOUND', message: 'That appeal could not be opened.', tone: 'error' });
        return;
      }
      setCurrentSession(session);
      setCurrentCase(caseDetails);
      setCurrentVerdict(verdict);
      setVerdictFromHistory(false);
      setView('verdict');
    } catch (error) {
      console.error('Failed to open appeal:', error);
      void appAlert({ title: "COULDN'T OPEN THE APPEAL", message: 'Please try again.', tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturnHome = () => {
    if (verdictFromHistory) {
      // Came from the case history: go back to it (it reloads, so any appeal or accepted verdict shows).
      setVerdictFromHistory(false);
      setCurrentSession(null);
      setCurrentVerdict(null);
      setView('case-history');
      return;
    }
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

  // Someone opened a challenge link: show it (case, your side, Accept) before anything else.
  if (linkChallengeId) {
    return (
      <ChallengeLink
        challengeId={linkChallengeId}
        userId={user.id}
        onPlayAsGuest={async () => {}}
        onSignIn={() => {}}
        onAccepted={async session => {
          clearPendingChallenge();
          setLinkChallengeId(null);
          setShowHome(false);
          await handleMatched(session);
        }}
        onDismiss={() => {
          dismissChallengeLink();
          setShowHome(false);
        }}
        onViewGames={() => {
          dismissChallengeLink();
          setShowHome(false);
          setCaseBoardFromHome(false);
          setCaseBoardFilter('ongoing');
          setView('case-board');
        }}
      />
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
          onNavigateToCaseHistory={user ? () => setView('case-history') : undefined}
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
          onOpenAppeal={handleOpenAppealRequest}
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

      {liveOnline && user && currentSession && (view === 'investigation' || view === 'trial-type-selection' || view === 'jury-selection' || view === 'pre-trial') && (
        <LiveStatusBar
          text={statusLine(opponent?.name || 'Opposing counsel', parseStatus(currentSession, otherSide(mySideIn(currentSession, user.id))))}
        />
      )}

      {view === 'investigation' && (currentSession || showCaseReview) && (
        <Investigation
          session={currentSession}
          onProceedToTrial={handleProceedToTrial}
          onBack={handleBackFromInvestigation}
          onStatus={liveOnline ? reportStatus : undefined}
          liveReady={
            liveOnline && user
              ? { ...readyState(currentSession, mySideIn(currentSession, user.id)), opponentName: opponent?.name || 'Opposing Counsel' }
              : undefined
          }
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
                void appAlert({ title: "COULDN'T START THE CASE", message: 'Please try again.', tone: 'error' });
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
          relief={currentCase.requested_relief}
          onSelect={handleRoleSelect}
          playerWins={userProfile?.wins_count ?? 0}
          onCancel={handleCloseCasePreview}
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

      {view === 'trial-type-selection' && currentSession && liveOnline && !isSessionHost(currentSession, user.id) && (
        <WaitingRoom
          title="SETTING UP THE TRIAL"
          message={`${opponent?.name || 'Your opponent'} is choosing the trial type and length. You'll move on together.`}
          onBack={handleBackFromInvestigation}
        />
      )}

      {view === 'trial-type-selection' && currentSession && !(liveOnline && !isSessionHost(currentSession, user.id)) && (
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
          mySide={mySideIn(currentSession, user.id)}
          mode={playMode(currentSession)}
          isHost={isSessionHost(currentSession, user.id)}
          opponentName={opponent?.name}
        />
      )}

      {view === 'pre-trial' && currentSession && currentCase && (
        <PreTrialScript
          caseTitle={currentCase.title}
          userName={getUserDisplayName(user)}
          judgeName={(currentSession.session_state as any)?.judgeName || ''}
          prosecutorName={(currentSession.session_state as any)?.prosecutorName || ''}
          playerRole={getSessionPlayerRole(currentSession, user.id)}
          mode={playMode(currentSession)}
          live={liveOnline ? pretrialLive(currentSession) : undefined}
          onLivePatch={patch => { void patchLive(patch); }}
          opponent={liveOnline ? opponent ?? { name: 'Opposing Counsel', avatar: null, rank: null } : undefined}
          sessionId={currentSession.id}
          playerWins={userProfile?.wins_count ?? 0}
          onComplete={handlePreTrialComplete}
          onBack={handleBackFromCourtroom}
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

      {view === 'case-history' && user && (
        <CaseHistory
          userId={user.id}
          onBack={() => setView('landing')}
          onOpen={handleOpenHistoryCase}
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
          onBack={handleReturnHome}
          onReopenCase={handleReopenCase}
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
            void appAlert({ title: 'UPGRADES ARE COMING SOON', message: "Paid plans aren't available just yet. Hang tight!", tone: 'info' });
          }}
        />
      )}
    </>
  );
}

function ScreenFallback() {
  return (
    <div role="status" aria-label="Loading" className="min-h-[100dvh] bg-[#05060a] flex items-center justify-center">
      <p className="font-game text-3xl text-white/70 animate-pulse">ALL RISE…</p>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <SessionProvider>
        <Suspense fallback={<ScreenFallback />}>
          <AppContent />
        </Suspense>
      </SessionProvider>
    </AuthProvider>
  );
}

export default App;
