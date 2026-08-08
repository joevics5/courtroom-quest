import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SessionProvider } from './contexts/SessionContext';
import Auth from './components/Auth';
import HomePage from './components/HomePage';
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
import { getLevelForWins } from './lib/levels';
import { getDisplayName } from './lib/userName';
import type { CaseSession, Verdict, TrialType, UserProfile, SubscriptionTier, Case } from './types';

type AppView =
  | 'landing'
  | 'case-board'
  | 'case-selection'
  | 'custom-case-creator'
  | 'investigation'
  | 'trial-type-selection'
  | 'jury-selection'
  | 'pre-trial'
  | 'courtroom'
  | 'verdict'
  | 'admin';

function AppContent() {
  const { user } = useAuth();
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

      setUserProfile({
        user_id: user.id,
        subscription_tier: 'free',
        voice_minutes_remaining: 0,
        trial_count: 0,
        case_creation_count: 0,
        wins_count: 0,
        current_level: 'Practicing Attorney',
        is_admin: isUserAdmin,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      setIsAdmin(isUserAdmin);
    } else {
      setUserProfile(null);
      setIsAdmin(false);
    }
  }, [user]);

  if (!user) {
    if (showAuth) {
      return <Auth onBack={() => setShowAuth(false)} />;
    }
    return <HomePage onSignIn={() => setShowAuth(true)} />;
  }

  if (!userProfile) {
    return null;
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

      // Check for existing ONGOING session first
      const ongoingSessions = await db.sessions.getOngoingSessions(user.id);
      const existingOngoingSession = ongoingSessions.find(s => s.case_id === caseId);
      
      if (existingOngoingSession) {
        // Resume existing ongoing session
        await resumeSession(existingOngoingSession);
      } else {
        // No ongoing session - create a new session (even if there are completed sessions)
        // This allows users to replay completed cases while preserving history
        const session = await db.sessions.createSession(caseId, user.id);
        setCurrentSession(session);

        await db.sessions.updateSession(session.id, {
          current_phase: 'investigation'
        });

        setView('investigation');
      }
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
    setView('case-board');
  };

  const handleNavigateToCustomCases = () => {
    setView('case-selection');
  };

  const handleSelectCaseFromBoard = async (caseId: string) => {
    try {
      setIsLoading(true);
      // Load case details but don't create session yet
      const caseDetails = await db.cases.getCaseWithDetails(caseId);
      if (!caseDetails) {
        alert('Case not found');
        return;
      }
      setCurrentCase(caseDetails);
      setIsCurrentCaseCustom(false);
      setShowCaseReview(true);
      // Navigate to investigation view to show the review modal
      // But don't create session until they accept
      setView('investigation');
    } catch (error) {
      console.error('Failed to load case:', error);
      alert('Failed to load case. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
        case 'investigation':
          setView('investigation');
          break;
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

  const handleContinueCase = async (caseId: string) => {
    setShowCaseReview(false);
    try {
      setIsLoading(true);
      // Get the most recent ongoing session for this case
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

  const handleTrialTypeSelect = async (trialType: TrialType, duration: number) => {
    if (!currentSession) return;

    try {
      await db.sessions.updateSession(currentSession.id, {
        trial_type: trialType,
        trial_duration: duration,
        evidence_filed: true,
        witnesses_locked: true,
        current_phase: trialType === 'jury' ? 'jury-selection' : 'pre-trial'
      });

      const updatedSession = await db.sessions.getSession(currentSession.id);
      if (updatedSession) {
        setCurrentSession(updatedSession);
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

    if (verdict.outcome === 'win' && currentCase) {
      try {
        const newWinsCount = userProfile.wins_count + 1;
        const levelInfo = getLevelForWins(newWinsCount);

        await db.users.updateProfile(user.id, {
          wins_count: newWinsCount,
          current_level: levelInfo.title
        });

        await db.caseWinners.addWinner({
          case_id: currentCase.id,
          user_id: user.id,
          username: user.email || 'Anonymous',
          level_achieved: levelInfo.title,
          verdict_score: verdict.score || 0
        });

        setUserProfile({
          ...userProfile,
          wins_count: newWinsCount,
          current_level: levelInfo.title
        });
      } catch (error) {
        console.error('Failed to update wins:', error);
      }
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
          onNavigateToCaseBoard={handleNavigateToCaseBoard}
          onNavigateToCustomCases={handleNavigateToCustomCases}
          onOpenAdmin={isAdmin ? handleOpenAdmin : undefined}
        />
      )}

      {view === 'case-board' && (
        <CaseBoard
          onBack={() => setView('landing')}
          onSelectCase={handleSelectCaseFromBoard}
          onContinueCase={handleContinueCase}
        />
      )}

      {view === 'case-selection' && (
        <CaseSelection
          onSelectCase={handleSelectCase}
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
                // Check if there's an existing session for this case
                const ongoingSessions = await db.sessions.getOngoingSessions(user.id);
                const existingSession = ongoingSessions.find(s => s.case_id === currentCase.id);
                
                if (existingSession) {
                  // Resume existing session
                  await resumeSession(existingSession);
                } else {
                  // Create new session
                  const session = await db.sessions.createSession(currentCase.id, user.id);
                  setCurrentSession(session);
                  await db.sessions.updateSession(session.id, {
                    current_phase: 'investigation'
                  });
                }
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
          userName={getDisplayName(user?.email)}
          onComplete={handlePreTrialComplete}
        />
      )}

      {view === 'courtroom' && currentSession && (
        <Courtroom
          session={currentSession}
          onComplete={handleTrialComplete}
          onBack={handleBackFromCourtroom}
        />
      )}

      {view === 'verdict' && currentVerdict && currentCase && (
        <VerdictDisplay
          verdict={currentVerdict}
          caseTitle={currentCase.title}
          currentLevel={userProfile.current_level}
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
