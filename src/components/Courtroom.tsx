import { useLockPageScroll } from '@/lib/useLockPageScroll';
import { questionRestSeconds, questionRestLabel, OBJECTION_WINDOW_SECONDS } from '@/lib/questionRest';
import { HANDOFF_SECONDS, STATEMENT_READ_SECONDS, statementGiven, legacyStatementMinutes } from '@/lib/witnessPool';
import { planNextPhase as planNextPhasePure } from '@/lib/witnessPlan';
import { usedBySide, usedByEither } from '@/lib/usedBySide';
import { useState, useEffect, useRef, useMemo } from 'react';
import { appAlert, appConfirm } from '../lib/appDialog';
import { Scale, Send, ArrowLeft, Pause, Play, FileText, User, SkipForward, AlertCircle, RotateCcw, Mic, Gavel, Shield, Landmark, ChevronDown } from 'lucide-react';
import { db } from '../lib/database';
import { useAuth } from '../contexts/AuthContext';
import TrialOutline from './TrialOutline';
import TrialStage from './TrialStage';
import { pickStageScene } from '../lib/stageScene';
import { witnessAvatar } from '../lib/stageCast';
import SceneBackdrop from './SceneBackdrop';
import TranscriptMessage from './TranscriptMessage';
import { gameButton, ICON_BUTTON, PANEL_SOFT } from './ui';
import { useKeyboardOpen } from './stage/signals';
import { getUserAvatar } from '../lib/avatars';
import { fetchPublicProfile, type PublicProfile } from '../lib/publicProfile';
import { getLevelForWins } from '../lib/levels';
import { describeTurn, getTrialFloor } from '../lib/stageSpeaker';
import { aiRank, castAvatars } from '../lib/stageCast';
import ModalSheet, { CHOICE_ROW } from './ModalSheet';
import WitnessSelector from './WitnessSelector';
import EvidenceSelector from './EvidenceSelector';
import ObjectionSelector from './ObjectionSelector';
import { getTrialConfig, getTotalTrialTime, BAILIFF_PROMPTS, JUDGE_PROMPTS, getPhaseInfo, getRandomJudgeName, getRandomProsecutorName, formatTime, aiDefenseName, plainLawyerName } from '../lib/trialConfig';
import {
  getAllowedActions,
  initializeTurnState,
  isWitnessPhase,
  getTurnForPhase,
  canSubmitEvidence,
  getExaminationType,
  type TurnState
} from '../lib/trialTurnSystem';
import { descriptionWithRelief, reliefDemands } from '../lib/requestedRelief';
import { generateProsecutionAction, buildTranscriptSummary, generateProsecutionOpeningStatement, generateClosingArgument, generateObjectionRuling, generateWitnessResponse, generateVerdict, generateJuryDeliberation, type JurorProfile } from '../lib/ai/trialAI';
import JuryDeliberation, { type DeliberationState } from './JuryDeliberation';
import type { VerdictResult } from '../lib/ai/trialAI';
import { getJudgeInstructionForPhase, requiresJudgeInstruction, extractWitnessNumber } from '../lib/judgeInstructions';
import { getUserDisplayName } from '../lib/userName';
import { buildExaminationRecap, buildWitnessHistory } from '../lib/witnessHistory';
import { useElementHeight } from '../lib/useElementHeight';
import AutoRestChip from './AutoRestChip';
import { shouldFreezeWhileHidden } from '../lib/presence';
import { activityKey, activityLine, applyRemoteEvents, authorTag, currentActivity, isRemoteEvent, observeActivity, parseActivity, voiceRoleFor, witnessOnStand, type ActivityKind, type ActivityWatch } from '../lib/trialSync';
import { buildLeaveSave, restoreTotalTime, shouldAutoPauseOnHide, startsPaused } from '../lib/trialResume';
import { useTrialLifecycle } from '../lib/useTrialLifecycle';
import { useSpeechRecognition } from '../lib/useSpeechRecognition';
import { canSpeak, enterSpeechScope, speakAs, stopSpeaking, stopSpeakingRole } from '../lib/speech';
import SpeechToggle from './SpeechToggle';
import type { CaseSession, Evidence, Witness, TrialEvent, Verdict, TrialDuration, TrialType, Case, EventType } from '../types';

interface CourtroomProps {
  session: CaseSession;
  onComplete: (verdict: Verdict) => void;
  onBack: () => void;
  /** Cases the player has won: sets their rank, which dresses their avatar. */
  playerWins?: number;
}

export default function Courtroom({ session, onComplete, onBack, playerWins = 0 }: CourtroomProps) {
  const { user } = useAuth();
  const [showPreTrial, setShowPreTrial] = useState(() => {
    // If session is already in trial phase, skip pretrial
    return session.current_phase !== 'trial';
  });
  const [judgeName, setJudgeName] = useState(() => {
    // Try to get from session metadata, or generate a random one
    const saved = (session.session_state as any)?.judgeName;
    return saved || getRandomJudgeName();
  });
  const [prosecutorName, setProsecutorName] = useState(() => {
    // Try to get from session metadata, or generate a random one
    const saved = (session.session_state as any)?.prosecutorName;
    return saved || getRandomProsecutorName();
  });
  const [caseData, setCaseData] = useState<Case | null>(null);
  // Which side the human is playing. Defaults to 'defense' for sessions
  // created before role selection existed, so nothing breaks for them.
  // Multiplayer: two real humans, no AI counsel at all. session_state
  // carries prosecutionUserId/defenseUserId (set once, at match time, by
  // db.challenges.joinChallenge) so each browser can work out which side
  // THIS logged-in user is playing.
  const isMultiplayer: boolean = !!(session.session_state as any)?.isMultiplayer;
  // Two humans, one device, taking turns handing it back and forth.
  // Deliberately layered on top of the existing isMultiplayer machinery
  // (turn tracking, no-AI-counsel gating, addEvent's speaker resolution)
  // rather than replacing any of it — see the awaitingUserInput effect
  // and the pass-device overlay below for the only two behavior changes
  // this flag actually causes.
  const sameDevicePlay: boolean = isMultiplayer && !!(session.session_state as any)?.sameDevicePlay;
  // Practice mode: no clock, and objection rulings explain their legal
  // reasoning more fully. Chosen alongside difficulty, single-player only.
  const practiceMode: boolean = !!(session.session_state as any)?.practiceMode;
  const playerRole: 'defense' | 'prosecution' = isMultiplayer
    ? ((session.session_state as any)?.prosecutionUserId === user.id ? 'prosecution' : 'defense')
    : ((session.session_state as any)?.playerRole || 'defense');
  // aiRole is meaningless in multiplayer (nothing should ever compare
  // against it there, since every AI-counsel trigger is gated on
  // !isMultiplayer below) — kept non-null just so existing comparisons
  // that already correctly check isMultiplayer first don't need every
  // single one re-audited for a null case.
  const aiRole: 'defense' | 'prosecution' = playerRole === 'defense' ? 'prosecution' : 'defense';
  // Single source of truth for "what name does this side go by right now" —
  // whichever side the human plays is addressed by their own name, matching
  // how it always worked for defense (the only side a human could play,
  // before role selection existed); the AI side keeps its assigned persona
  // name (the random attorney pool for prosecution, a generic label for
  // defense, since there's no name pool for that side yet).
  const humanDisplayName = getUserDisplayName(user);
  const onlineTwoPlayerEarly = isMultiplayer && !sameDevicePlay;
  const [opponentProfile, setOpponentProfile] = useState<PublicProfile | null>(null);
  // The shared game state as the other screen last left it (names, clocks, activity), refreshed every couple of seconds.
  const [liveState, setLiveState] = useState<Record<string, any> | null>(null);
  // Two people: the other counsel is a real person and goes by their own name, the same one on both screens
  // (each player's name is saved with the game); only against the computer do the made-up attorney names appear.
  const sharedState = (liveState || session.session_state || {}) as Record<string, any>;
  const effectiveProsecutorName = playerRole === 'prosecution'
    ? humanDisplayName
    : onlineTwoPlayerEarly
      ? (sharedState.nameProsecution || opponentProfile?.username || 'Opposing Counsel')
      : plainLawyerName(prosecutorName || 'Prosecution');
  const effectiveDefenseName = playerRole === 'defense'
    ? humanDisplayName
    : onlineTwoPlayerEarly
      ? (sharedState.nameDefense || opponentProfile?.username || 'Opposing Counsel')
      : aiDefenseName(session.id);
  // Avatars for the stage: the human plays their own saved avatar; the judge and the
  // AI counsel come from the ready-made sets (same name -> same face every time).
  const myAvatar = useMemo(() => getUserAvatar(user), [user]);
  // In a two-player game the opponent is a real person: show the avatar and name they chose.
  const opponentUserId: string | null =
    isMultiplayer && !sameDevicePlay
      ? ((playerRole === 'prosecution'
          ? (session.session_state as any)?.defenseUserId
          : (session.session_state as any)?.prosecutionUserId) ?? null)
      : null;
  useEffect(() => {
    if (!opponentUserId) {
      setOpponentProfile(null);
      return;
    }
    let cancelled = false;
    fetchPublicProfile(opponentUserId).then(profile => {
      if (!cancelled) setOpponentProfile(profile);
    });
    return () => {
      cancelled = true;
    };
  }, [opponentUserId]);
  // Ranks on the stage: you wear your own; a real opponent wears theirs; AI counsel get a
  // steady mid-ladder rank (same name, same rank) so they look experienced but beatable.
  const myRank = getLevelForWins(playerWins).level;
  const prosecutionRank = playerRole === 'prosecution' ? myRank : opponentProfile?.rank || aiRank(opponentUserId || effectiveProsecutorName);
  const defenseRank = playerRole === 'defense' ? myRank : opponentProfile?.rank || aiRank(opponentUserId || effectiveDefenseName);
  const stageProsecutorName =
    playerRole === 'prosecution' ? effectiveProsecutorName : opponentProfile?.username || effectiveProsecutorName;
  const stageDefenseName =
    playerRole === 'defense' ? effectiveDefenseName : opponentProfile?.username || effectiveDefenseName;
  // Same helper the pre-trial scene uses, so nobody changes face between the two.
  const cast = useMemo(
    () =>
      castAvatars({
        judgeName,
        prosecutorName,
        playerRole,
        myAvatar,
        sessionId: session.id,
        opponentAvatar: opponentProfile?.avatar,
        opponentUserId
      }),
    [judgeName, prosecutorName, playerRole, myAvatar, session.id, opponentProfile, opponentUserId]
  );
  const [trialDuration, setTrialDuration] = useState<TrialDuration | null>(
    session.trial_duration as TrialDuration || null
  );
  // Initialize phase - if coming from pretrial, start at phase 7 (Opening Statement - Prosecution)
  // Judge instructions will appear as sub-phases before each counsel action
  const [currentPhase, setCurrentPhase] = useState(() => {
    // If session is in trial phase but no trial_phase set, start at opening statement
    if (session.current_phase === 'trial' && !session.current_trial_phase) {
      return 7; // Opening Statement - Prosecution
    }
    return session.current_trial_phase || 7; // Default to 7 for new trials
  });
  const [events, setEventsRaw] = useState<TrialEvent[]>([]);
  // Both screens add lines to the same transcript (and a line can arrive from the other screen a moment
  // before this one finishes saving it), so a line is only ever kept once.
  const setEvents = (update: TrialEvent[] | ((prev: TrialEvent[]) => TrialEvent[])) =>
    setEventsRaw(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      const seen = new Set<string>();
      return next.filter(e => (seen.has(e.id) ? false : (seen.add(e.id), true)));
    });
  // Mirrors `events` for callbacks that resolve well after the render
  // they were scheduled in (e.g. TTS's onend firing seconds later) — a
  // closure over `events` state directly would still see whatever it
  // was at schedule-time, which is stale by then. handleNextPhase's
  // mandatory-statement gate reads from this instead of `events`
  // directly so it always sees the statement that was just saved.
  /** Every line this screen writes is stamped with who wrote it, so the other screen knows it is theirs to read out. */
  const addTrialEvent = (e: Parameters<typeof db.trialEvents.addEvent>[0]) =>
    db.trialEvents.addEvent({ ...e, metadata: { ...(e.metadata || {}), ...authorTag(user.id) } });
  const eventsRef = useRef<TrialEvent[]>([]);
  const trialLoadedRef = useRef(false);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  const [input, setInput] = useState('');
  const { isListening, isSupported: speechSupported, start: startListening, stop: stopListening } = useSpeechRecognition({
    onResult: (transcript) => {
      setInput(prev => prev ? `${prev} ${transcript}` : transcript);
    },
    onError: (message) => {
      // Keep it low-key — a failed/denied mic shouldn't block typing.
      console.warn('[Courtroom] Speech recognition:', message);
    }
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [deliberation, setDeliberation] = useState<DeliberationState | null>(null);
  const verdictStartedRef = useRef(false);
  const verdictContinueRef = useRef<(() => void) | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
   const [timerActive, setTimerActive] = useState(false);
   // A trial that was left mid-way comes back paused; the player resumes on purpose.
   // Two people on two devices: a game can take days. Nobody has to press Pause: your own clock stands
   // still while you are away, and the other player carries on with their turn.
   const onlineTwoPlayer = isMultiplayer && !sameDevicePlay;
   const [timerPaused, setTimerPaused] = useState(() => !onlineTwoPlayer && startsPaused(session as any, practiceMode));
   const [pausedForDefense, setPausedForDefense] = useState(false);
   const [phaseTimeRemaining, setPhaseTimeRemaining] = useState<Record<number, number>>(() => {
     // Load from session if available
     const saved = (session.session_state as any)?.phaseTimeRemaining;
     return saved || {};
   });
   const [totalTimeRemaining, setTotalTimeRemaining] = useState(() => {
     // Load from session if available. If the total was never saved, rebuild it from the phase clocks:
     // reading it as 0 used to end the trial the moment the player came back.
     const state = session.session_state as any;
     return restoreTotalTime(state?.totalTimeRemaining, state?.phaseTimeRemaining, session.current_trial_phase ?? 7);
   });
  const [currentSpeaker, setCurrentSpeaker] = useState<'judge' | 'prosecution' | 'defense' | 'witness' | 'jury'>('judge');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Turn-based system state
  const [turnState, setTurnState] = useState<TurnState | null>(null);
   const [showWitnessSelector, setShowWitnessSelector] = useState(false);
   const [showEvidenceSelector, setShowEvidenceSelector] = useState(false);
   const [showObjectionSelector, setShowObjectionSelector] = useState(false);
   const [showDefenceModal, setShowDefenceModal] = useState(false);
   // Once the AI finishes generating its opening/closing statement, don't
   // just sit idle until the full phase timer (which could be minutes)
   // runs out — count down an estimated read time and auto-rest, so the
   // human isn't stuck waiting on a side that has nothing left to say.
   const [autoRestSecondsLeft, setAutoRestSecondsLeft] = useState<number | null>(null);
   const [autoRestPaused, setAutoRestPaused] = useState(false);
   const autoRestTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
   // The interval callback below is set up once per countdown and reads
   // this on every tick — using state directly there would only ever see
   // the value from the render when the interval was created.
   const autoRestPausedRef = useRef(false);
   autoRestPausedRef.current = autoRestPaused;
   const timerPausedRef = useRef(false);
   timerPausedRef.current = timerPaused;
   // Always points at the latest handleRestPhase — the countdown interval
   // is set up once and lives for up to its full duration, so if it called
   // handleRestPhase directly it would be closing over turnState/events/etc.
   // from whatever render was active when the countdown started, stale by
   // the time it actually fires.
   const handleRestPhaseRef = useRef<() => Promise<void>>(async () => {});
   // True while a Rest (manual, countdown or phase timeout) is being processed, so the same rest can
   // never be filed or advance the phase twice.
   const restInFlightRef = useRef(false);
   // The phase on screen right now, readable from callbacks that finish later (after an AI call).
   const currentPhaseRef = useRef(currentPhase);
   currentPhaseRef.current = currentPhase;
   // While the witness's answer is being read out (or, muted, given a moment to be read) the AI
   // examiner holds its next question, so answer and next question don't land on top of each other.
   const [aiHold, setAiHold] = useState(false);
   const answerHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const aiNoopTurnsRef = useRef(0);
  // The witness-stage pool lives inside the phase clocks (reserved negative keys); this mirrors them so
  // phase changes can read and update them straight away.
  const phaseClocksRef = useRef<Record<number, number>>({});
  phaseClocksRef.current = phaseTimeRemaining;
  // The break at every change of counsel in the witness stage: clock stopped, nobody can send anything.
  const [handoff, setHandoff] = useState<{ secondsLeft: number; label: string; skippable?: boolean } | null>(null);
  const handoffSkipRef = useRef(false);
  const handoffRef = useRef<number | null>(null);
  // True from the moment a question is sent until its answer is in.
  const questionInFlightRef = useRef(false);
  // An opening or closing statement is due and has not been given: the clock stands still until it is.
  const waitingForStatementRef = useRef(false);
   // Rest between questions: after each witness answer the questioning counsel must wait before the next
   // question (no question cap any more). Seconds left, or null when asking is allowed.
   const [questionRestLeft, setQuestionRestLeft] = useState<number | null>(null);
   const questionRestRef = useRef<number | null>(null);
   const questionRestTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
   // An objection stops the questioning counsel's clock until they speak again.
   const [objectionPaused, setObjectionPaused] = useState(false);
   const objectionPausedRef = useRef(false);
   const isProcessingObjectionRef = useRef(false);
   // Vertical drag offset (px, added to the default bottom-6 position) for
   // the floating action button — it sits over the Rest/Object buttons on
   // small screens, so it needs to be movable out of the way.
   const [floatingButtonOffset, setFloatingButtonOffset] = useState(0);
   const floatingButtonDragRef = useRef<{ startY: number; startOffset: number } | null>(null);
   const floatingButtonWasDraggedRef = useRef(false);
   const [defenceModalTab, setDefenceModalTab] = useState<'witnesses' | 'evidence'>('witnesses');
  const [isProsecutionThinking, setIsProsecutionThinking] = useState(false);
  const [awaitingUserInput, setAwaitingUserInput] = useState(false);
  // Pass & play only: which "phase-turn" combo the device has already
  // been handed over for. Reset implicitly every time the key changes
  // (new phase, or turn flips within a phase), which is what makes the
  // handoff overlay reappear automatically at every turn change.
  const [deviceRevealedFor, setDeviceRevealedFor] = useState<string | null>(null);
   const [isProcessingObjection, setIsProcessingObjection] = useState(false);
   const [lastProsecutionEvent, setLastProsecutionEvent] = useState<TrialEvent | null>(null);
   // Pass & play only: since aiRole is a fixed nominal value (there's no
   // real AI side), objections there can't rely on the aiRole-based
   // tracking above — instead we track each side's own last statement
   // and let whichever side is currently active object to the other
   // side's most recent one. Single-player and real (2-device)
   // multiplayer are untouched — they keep using lastProsecutionEvent
   // exactly as before.
   const [lastProsecutionStatementEvent, setLastProsecutionStatementEvent] = useState<TrialEvent | null>(null);
   const [lastDefenseStatementEvent, setLastDefenseStatementEvent] = useState<TrialEvent | null>(null);
   const trackObjectableStatement = (event: TrialEvent) => {
     if (!sameDevicePlay) return;
     if (event.speaker_role === 'prosecution') setLastProsecutionStatementEvent(event);
     else if (event.speaker_role === 'defense') setLastDefenseStatementEvent(event);
   };
    const prosecutionTurnTriggeredRef = useRef<number | null>(null);
   const [showVideoDisplay, setShowVideoDisplay] = useState(true); // avatar stage on by default; the Courtroom button hides/shows it
    const [judgeInstructionPending, setJudgeInstructionPending] = useState(false);

  useEffect(() => {
    // Force phase 7 if we're in trial phase but phase is too early
    if (session.current_phase === 'trial' && currentPhase < 7 && (!session.current_trial_phase || session.current_trial_phase < 7)) {
      console.log('[Courtroom] Forcing phase to 7 for new trial');
      setCurrentPhase(7);
      db.sessions.updateSession(session.id, {
        current_phase: 'trial',
        current_trial_phase: 7
      }).catch(err => console.error('Failed to save trial phase:', err));
    }

    loadTrialData();

    // Ensure we're marked as in trial phase when component loads
    db.sessions.updateSession(session.id, {
      current_phase: 'trial',
      current_trial_phase: currentPhase
    }).catch(err => console.error('Failed to save trial phase:', err));

    // Set phase times if trial duration is set but times aren't loaded
    if (trialDuration && Object.keys(phaseTimeRemaining).length === 0) {
      const config = getTrialConfig(trialDuration);
      const initialTimes: Record<number, number> = {};
      Object.entries(config.phaseDurations).forEach(([phase, minutes]) => {
        initialTimes[Number(phase)] = minutes * 60;
      });
      setPhaseTimeRemaining(initialTimes);
      if (totalTimeRemaining === 0) {
        setTotalTimeRemaining(Math.round(getTotalTrialTime(trialDuration) * 60));
      }
    }
  }, [session]);

  useEffect(() => {
    if (showPreTrial || practiceMode) return; // don't run trial timers/logic while pre-trial script is still showing, or ever in practice mode
    if (trialDuration) {
      const config = getTrialConfig(trialDuration);
      const phase = config.phases.find(p => p.number === currentPhase);
      // Start timer for trial phases (not pre-trial or post-trial)
      if (phase && phase.category === 'trial') {
        startTimer();
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentPhase, trialDuration, timerPaused, showPreTrial, practiceMode]);

  // Auto-advance phase when time runs out
  useEffect(() => {
    if (showPreTrial || practiceMode) return;
    if (trialDuration && timerActive && !timerPaused && phaseTimeRemaining[currentPhase] <= 0 && phaseTimeRemaining[currentPhase] !== undefined) {
      // Route through handleRestPhase rather than calling handleNextPhase
      // directly. Two reasons: (1) it logs an actual "rests" event, so if
      // the mandatory statement gate applies to this phase (opening/
      // closing) and nobody said anything before time ran out, advancing
      // doesn't get silently blocked forever; (2) it's the same "this
      // side is done" action the Rest button performs, so a timeout and a
      // manual Rest behave identically instead of diverging.
      // An opening or closing statement that has not been given never times out: the clock stands still
      // until the speaker says something (handleSubmit moves on once they do).
      if (waitingForStatementRef.current) return;
      // Two players: only the one whose turn it is ends it. The other screen waits for the trial to move on.
      if (onlineTwoPlayer && turnState?.current_turn !== playerRole) return;
      console.log('[Courtroom] Time ran out for phase', currentPhase, '- auto-resting');
      handleRestPhase();
    }
  }, [phaseTimeRemaining, currentPhase, timerActive, timerPaused, trialDuration, showPreTrial, practiceMode, turnState?.current_turn]);

  // Leaving the page (switching tabs or apps, locking the screen) stops the clock right away, on its
  // own: the player does not have to press Pause, and it does not matter whose turn it is. The exact
  // time left is saved with the pause, and coming back opens the trial paused (they resume on purpose).
  useEffect(() => {
    if (showPreTrial || practiceMode || !trialDuration || onlineTwoPlayer) return;

    const handleVisibilityChange = () => {
      if (!shouldAutoPauseOnHide({
        hidden: document.visibilityState === 'hidden',
        timerActive,
        timerPaused,
        verdictStarted: verdictStartedRef.current
      })) return;

      console.log('[Courtroom] Player left the page - stopping the clock');
      if (timerRef.current) clearInterval(timerRef.current);
      setTimerPaused(true);
      db.sessions
        .updateSession(session.id, buildLeaveSave({ currentPhase, phaseTimeRemaining, totalTimeRemaining, sessionState: session.session_state as any }) as any)
        .catch(error => console.error('[Courtroom] Failed to save auto-pause state:', error));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [timerActive, timerPaused, trialDuration, showPreTrial, practiceMode, currentPhase, session, phaseTimeRemaining, totalTimeRemaining]);

  // Force verdict when total time runs out
  useEffect(() => {
    if (showPreTrial || practiceMode) return;
    if (trialDuration && totalTimeRemaining <= 0 && timerActive && !timerPaused) {
      // Two players: one screen calls the verdict, the player whose turn it is; the other follows it live.
      if (onlineTwoPlayer && turnState?.current_turn !== playerRole) return;
      console.log('[Courtroom] Total trial time ran out - forcing verdict');
      handleVerdict();
    }
  }, [totalTimeRemaining, timerActive, timerPaused, trialDuration, showPreTrial, practiceMode, turnState?.current_turn]);

  // Save progress whenever trial phase changes
  useEffect(() => {
    if (showPreTrial) return;
    // Two players: the phase and clocks are published once, by the player who moves the trial on (see
    // handleNextPhase). Saving them from both screens every second let a screen that was a moment behind
    // push the trial back and overwrite the other player's changes.
    if (onlineTwoPlayer) return;
    // Once the verdict process has started, stop re-saving session_state
    // — it would overwrite the jury vote record saved during deliberation.
    if (verdictStartedRef.current) return;
    db.sessions.updateSession(session.id, {
      current_phase: 'trial',
      current_trial_phase: currentPhase,
      session_state: {
        ...session.session_state,
        phaseTimeRemaining,
        totalTimeRemaining
      }
    }).catch(err => console.error('Failed to save trial phase progress:', err));
  }, [currentPhase, session.id, phaseTimeRemaining, totalTimeRemaining, showPreTrial]);

  const loadTrialData = async () => {
    try {
      const [evidenceData, witnessData, eventsData, caseInfo] = await Promise.all([
        db.evidence.getCaseEvidence(session.case_id),
        db.witnesses.getCaseWitnesses(session.case_id),
        db.trialEvents.getSessionEvents(session.id),
        db.cases.getCaseWithDetails(session.case_id)
      ]);

      setEvidence(evidenceData);
      setWitnesses(witnessData);
      setEvents(eventsData);
      eventsData.forEach(e => spokenRef.current.add(e.id));
      trialLoadedRef.current = true;
      setCaseData(caseInfo);
    } catch (error) {
      console.error('Failed to load trial data:', error);
    }
  };

  // Multiplayer sync: kept intentionally simple (polling, not a realtime
  // channel) for a V1 — both players' browsers run the same Courtroom
  // component independently, so this is what lets each one see the
  // other's actions and phase advances without a manual refresh.
  // Known limitation: since phase-advance can be triggered from either
  // browser (e.g. both timers hitting 0 around the same time), there's a
  // small chance of a redundant double-advance race. Worth revisiting
  // with real usage before investing in a stricter single-authority
  // model.
  // Each player's name is saved with the game, so both screens (and the judge) use the same one for each side.
  useEffect(() => {
    if (!onlineTwoPlayer || showPreTrial) return;
    const key = playerRole === 'prosecution' ? 'nameProsecution' : 'nameDefense';
    db.sessions.mergeState(session.id, { [key]: humanDisplayName }).catch(err => console.error('Failed to save my name:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineTwoPlayer, showPreTrial, session.id, playerRole, humanDisplayName]);

  // Tell the other player what I am doing: typing, or speaking into the microphone.
  const lastActivityRef = useRef<{ kind: ActivityKind; at: number }>({ kind: 'idle', at: 0 });
  const reportActivity = (kind: ActivityKind) => {
    if (!onlineTwoPlayer) return;
    const now = Date.now();
    const last = lastActivityRef.current;
    if (kind === last.kind && (kind === 'idle' || now - last.at < 2500)) return;
    lastActivityRef.current = { kind, at: now };
    db.sessions.mergeState(session.id, { [activityKey(playerRole)]: { kind, seq: now } }).catch(() => {});
  };

  useEffect(() => {
    if (!onlineTwoPlayer || showPreTrial) return;
    if (isListening) reportActivity('speaking');
    else if (input.trim() && turnState?.current_turn === playerRole) reportActivity('typing');
    else reportActivity('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isListening, onlineTwoPlayer, showPreTrial, turnState?.current_turn]);

  // What the other player's screen has done is read back every couple of seconds: their lines, the phase
  // they moved the trial to (with the clocks that go with it), and whether they are typing or speaking.
  const syncBusyRef = useRef(false);
  const spokenRef = useRef<Set<string>>(new Set());
  const [opponentWatch, setOpponentWatch] = useState<ActivityWatch | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const followVerdictRef = useRef<(fresh: CaseSession) => void>(() => {});
  useEffect(() => {
    if (!isMultiplayer || showPreTrial) return;
    const otherSide: 'prosecution' | 'defense' = playerRole === 'prosecution' ? 'defense' : 'prosecution';

    const syncOnce = async () => {
      if (syncBusyRef.current || !trialLoadedRef.current) return;
      syncBusyRef.current = true;
      try {
        const [freshEvents, freshSession] = await Promise.all([
          db.trialEvents.getSessionEvents(session.id),
          db.sessions.getSession(session.id)
        ]);

        const known = new Set(eventsRef.current.map(e => e.id));
        const newOnes = freshEvents.filter(e => !known.has(e.id));
        if (newOnes.length > 0) {
          setEvents(prev => [...prev, ...newOnes]);
          if (onlineTwoPlayer) {
            const remote = newOnes.filter(e => isRemoteEvent(e, user.id));
            for (const e of remote) {
              if (spokenRef.current.has(e.id)) continue;
              spokenRef.current.add(e.id);
              // Both screens read the trial out: what the other player's screen wrote is read out here.
              const voice = voiceRoleFor(e);
              if (voice) speakAs(voice, e.content);
              setCurrentSpeaker(e.speaker_role === 'judge' ? 'judge' : e.speaker_role === 'witness' ? 'witness' : (e.speaker_role as 'prosecution' | 'defense'));
              // The opposing counsel's statements and questions are what I can object to.
              if (e.speaker_role === otherSide && e.event_type !== 'objection' && e.event_type !== 'ruling') setLastProsecutionEvent(e);
              // They objected to my question: my clock stands still until I speak again.
              if (e.event_type === 'objection' && e.speaker_role === otherSide) pauseForObjection();
            }
            // Whoever is on the stand, the exhibits filed: the same on both screens.
            setTurnState(prev => (prev ? applyRemoteEvents(prev, remote) : prev));
          }
        }

        if (freshSession) {
          if (onlineTwoPlayer) {
            const st = (freshSession.session_state || {}) as Record<string, any>;
            setLiveState(st);
            setOpponentWatch(prev => observeActivity(prev, parseActivity(st, otherSide), Date.now()));
            const next = freshSession.current_trial_phase;
            // The other player moved the trial on: follow, with the clocks they published for the new phase.
            if (typeof next === 'number' && next > currentPhaseRef.current) {
              if (st.phaseTimeRemaining && typeof st.phaseTimeRemaining === 'object') {
                phaseClocksRef.current = st.phaseTimeRemaining;
                setPhaseTimeRemaining(st.phaseTimeRemaining);
              }
              if (typeof st.totalTimeRemaining === 'number') setTotalTimeRemaining(st.totalTimeRemaining);
              setCurrentPhase(next);
            }
            followVerdictRef.current(freshSession);
          } else if (freshSession.current_trial_phase && freshSession.current_trial_phase !== currentPhaseRef.current) {
            setCurrentPhase(freshSession.current_trial_phase);
          }
        }
      } catch (error) {
        console.error('[Courtroom] Multiplayer sync failed:', error);
      } finally {
        syncBusyRef.current = false;
      }
    };

    const syncInterval = setInterval(syncOnce, onlineTwoPlayer ? 2000 : 3000);
    return () => clearInterval(syncInterval);
  }, [isMultiplayer, onlineTwoPlayer, showPreTrial, session.id, playerRole]);

  // Keeps the "is typing…" notice honest: it disappears on its own a few seconds after the last sign of life.
  useEffect(() => {
    if (!onlineTwoPlayer) return;
    const id = setInterval(() => setNowTick(Date.now()), 1500);
    return () => clearInterval(id);
  }, [onlineTwoPlayer]);


  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!trialDuration) return;

    // A trial that comes back paused still has its clock: the Pause/Resume button and the time left must show.
    setTimerActive(true);
    if (timerPaused) return;
    timerRef.current = setInterval(() => {
      // An objection is being heard: the questioning counsel's time (and the trial total) stands still
      // until they start talking again.
      if (objectionPausedRef.current) return;
      if (shouldFreezeWhileHidden(onlineTwoPlayer, document.visibilityState === 'hidden')) return;
      // Stopped while a witness answer is read out, during the break between counsel, and while a
      // statement that is due has not been given.
      if (questionRestRef.current !== null || handoffRef.current !== null || waitingForStatementRef.current) return;
      setPhaseTimeRemaining((prev: Record<number, number>) => {
        // Nothing left on this phase's clock: keep the same object. Returning a fresh copy every
        // second made the "time ran out" effect fire again and again until the phase changed.
        if (!(prev[currentPhase] > 0)) return prev;
        return { ...prev, [currentPhase]: prev[currentPhase] - 1 };
      });

      setTotalTimeRemaining((prev: number) => Math.max(0, prev - 1));
    }, 1000);
  };

   const togglePause = async () => {
     const newPausedState = !timerPaused;
     setTimerPaused(newPausedState);
     // If resuming from defense pause, clear the flag
     if (!newPausedState && pausedForDefense) {
       setPausedForDefense(false);
     }

     // Save exactly where the clocks stand (the same save used when the player leaves the page)
     try {
       await db.sessions.updateSession(session.id, (newPausedState
         ? buildLeaveSave({ currentPhase, phaseTimeRemaining, totalTimeRemaining, sessionState: session.session_state as any })
         : {
             current_phase: 'trial',
             current_trial_phase: currentPhase,
             timer_paused_at: null,
             session_state: { ...session.session_state, phaseTimeRemaining, totalTimeRemaining }
           }) as any);
     } catch (error) {
       console.error('Failed to save pause state:', error);
     }
   };

  const announcePhase = (phaseNumber: number) => {
    if (!trialDuration) return;
    const phase = getPhaseInfo(phaseNumber, trialDuration);
    if (!phase) return;

    // Phases 7+ (opening statement onward) already get a judge line from
    // getJudgeInstructionForPhase (see the judgeInstructionPending effect
    // below), correctly spoken as the actual judge's name. This function
    // used to ALSO add a second, differently-worded line here tagged with
    // the literal speaker name "Judge" — that was the duplicate/garbled
    // judge statement bug. Don't duplicate it.
    if (phaseNumber >= 7) return;

    let announcement = '';

    switch (phaseNumber) {
      case 2:
        announcement = BAILIFF_PROMPTS.callToOrder;
        speakAs('recorder', announcement);
        break;
      case 3:
        announcement = "Judge enters";
        break;
      case 4:
        announcement = JUDGE_PROMPTS.caseAnnouncement.replace('{plaintiff}', 'The State').replace('{defendant}', 'Defendant');
        speakAs('judge', announcement);
        break;
      case 6:
        announcement = JUDGE_PROMPTS.plea;
        speakAs('judge', announcement);
        break;
    }

    if (announcement) {
      addEvent('judge', announcement);
    }
  };


  const addEvent = async (role: 'judge' | 'counsel' | 'witness', content: string) => {
    setCurrentSpeaker(role === 'judge' ? 'judge' : role === 'counsel' ? (turnState?.current_turn as any) || 'defense' : 'witness');

    // 'counsel' means 'whichever side is currently speaking' — this is
    // only ever called while it's actually that side's turn (gated by
    // awaitingUserInput), so turnState.current_turn is the correct,
    // specific side (prosecution or defense), not a generic 'counsel'
    // label. Tagging it generically here used to mean events could never
    // match speaker_role === 'defense'/'prosecution' checks elsewhere
    // (e.g. the mandatory opening-statement gate), and always looked like
    // 'defense' regardless of who actually spoke.
    const resolvedRole: 'judge' | 'prosecution' | 'defense' | 'witness' =
      role === 'judge' ? 'judge' : role === 'witness' ? 'witness' : ((turnState?.current_turn as any) || 'defense');
    const resolvedName =
      resolvedRole === 'judge' ? (judgeName || 'Judge')
      : resolvedRole === 'prosecution' ? effectiveProsecutorName
      : resolvedRole === 'defense' ? effectiveDefenseName
      : 'Witness';

    // Which kind of statement this actually is, by phase — this used to
    // be hardcoded to 'opening' unconditionally, which meant a human's
    // own typed closing argument got filed in the transcript mislabeled
    // as an opening statement. Pre-trial announcements (role==='judge'
    // calls before phase 7) fall back to 'announcement'.
    const config = trialDuration ? getTrialConfig(trialDuration) : null;
    const phaseInfo = config?.phases.find(p => p.number === currentPhase);
    const phaseNameLower = phaseInfo?.name.toLowerCase() || '';
    const eventType: EventType = phaseNameLower.includes('closing')
      ? 'closing'
      : phaseNameLower.includes('opening')
      ? 'opening'
      : 'announcement';

    // The questioning counsel is talking again: their clock runs.
    if (role === 'counsel') resumeFromObjection();

    try {
      const event = await addTrialEvent({
        session_id: session.id,
        event_type: eventType,
        speaker_role: resolvedRole,
        speaker_name: resolvedName,
        content,
        metadata: { phase: currentPhase },
        event_order: events.length + 1
      });

      setEvents(prevEvents => [...prevEvents, event]);
      trackObjectableStatement(event);
    } catch (error) {
      console.error('Failed to add event:', error);
    }
  };

  isProcessingObjectionRef.current = isProcessingObjection;

  const clearQuestionRest = () => {
    if (questionRestTimerRef.current) {
      clearInterval(questionRestTimerRef.current);
      questionRestTimerRef.current = null;
    }
    questionRestRef.current = null;
    setQuestionRestLeft(null);
  };

  // Starts the wait before the next question. The countdown stands still while the player has the trial
  // paused and while the judge is ruling on an objection, so neither eats into it.
  const startQuestionRest = (seconds: number) => {
    if (questionRestTimerRef.current) clearInterval(questionRestTimerRef.current);
    questionRestRef.current = seconds;
    setQuestionRestLeft(seconds);
    questionRestTimerRef.current = setInterval(() => {
      if (!aliveRef.current) return;
      if (timerPausedRef.current || isProcessingObjectionRef.current) return;
      const next = (questionRestRef.current ?? 0) - 1;
      if (next <= 0) {
        clearQuestionRest();
      } else {
        questionRestRef.current = next;
        setQuestionRestLeft(next);
      }
    }, 1000);
  };

  // Makes sure at least `minSeconds` of waiting are left (witness phases only): after the answer has
  // been heard, or a ruling read out, the other side still gets a real moment to speak up.
  const ensureQuestionRest = (minSeconds: number) => {
    if (!isWitnessPhase(getPhaseInfo(currentPhaseRef.current, trialDuration ?? undefined))) return;
    const left = questionRestRef.current;
    if (left === null || left < minSeconds) startQuestionRest(minSeconds);
  };

  // Hearing an objection stops the questioning counsel's clock; it runs again once they speak.
  const pauseForObjection = () => {
    objectionPausedRef.current = true;
    setObjectionPaused(true);
  };
  const resumeFromObjection = () => {
    if (!objectionPausedRef.current) return;
    objectionPausedRef.current = false;
    setObjectionPaused(false);
  };

  const cancelAutoRestCountdown = () => {
    if (autoRestTimerRef.current) {
      clearInterval(autoRestTimerRef.current);
      autoRestTimerRef.current = null;
    }
    setAutoRestSecondsLeft(null);
    setAutoRestPaused(false);
  };

  // (no longer started for statements: they get a fixed read time in handleRestPhase)
  const startAutoRestCountdown = (seconds: number) => {
    cancelAutoRestCountdown();
    setAutoRestSecondsLeft(seconds);
    autoRestTimerRef.current = setInterval(() => {
      if (!aliveRef.current) return; // the player left: never rest the AI in the background
      if (autoRestPausedRef.current || timerPausedRef.current) return; // frozen while the player has it paused
      setAutoRestSecondsLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (autoRestTimerRef.current) {
            clearInterval(autoRestTimerRef.current);
            autoRestTimerRef.current = null;
          }
          handleRestPhaseRef.current();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Tapping the countdown display pauses/resumes it — the player might
  // want to keep reading a statement without the clock forcing a move on
  // before they're ready. This only pauses the auto-rest countdown, not
  // the phase's overall timer.
  const toggleAutoRestPause = () => {
    setAutoRestPaused(prev => !prev);
  };

  // Drag handling for the floating action button. Pointer events cover
  // both touch and mouse. A movement past a small threshold counts as a
  // drag (and is suppressed from also firing the click that opens the
  // modal); anything smaller is treated as a tap.
  const handleFloatingButtonPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    floatingButtonDragRef.current = { startY: e.clientY, startOffset: floatingButtonOffset };
    floatingButtonWasDraggedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleFloatingButtonPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = floatingButtonDragRef.current;
    if (!drag) return;
    const deltaY = drag.startY - e.clientY; // moving finger/cursor up = positive offset
    if (Math.abs(deltaY) > 6) {
      floatingButtonWasDraggedRef.current = true;
      // Stay inside the chat panel.
      const panelHeight = chatPanelRef.current?.clientHeight ?? 400;
      const maxOffset = Math.max(0, panelHeight - 72);
      setFloatingButtonOffset(Math.max(0, Math.min(drag.startOffset + deltaY, maxOffset)));
    }
  };

  const handleFloatingButtonPointerUp = () => {
    floatingButtonDragRef.current = null;
  };

  const handleFloatingButtonClick = () => {
    if (floatingButtonWasDraggedRef.current) {
      floatingButtonWasDraggedRef.current = false;
      return;
    }
    setShowDefenceModal(true);
  };

  const handleSubmit = async () => {
    if (!input.trim() || !turnState || isProcessing || timerPaused) return;
    // Nobody can send anything during the break between counsel.
    if (handoffRef.current !== null) return;
    const witnessExamNow = !!turnState.current_witness_id &&
      (turnState.current_phase_type === 'direct' || turnState.current_phase_type === 'cross' || turnState.current_phase_type === 'redirect');
    // Sending only works on your own turn, and only while your clock still has time.
    if (witnessExamNow) {
      if (!(turnState.current_turn === playerRole || sameDevicePlay)) return;
      if (!practiceMode && (phaseClocksRef.current[currentPhase] ?? 1) <= 0) return;
    }
    if (!awaitingUserInput && !witnessExamNow) return;
    // Between questions the examiner waits (the box stays open for drafting the next one).
    if (witnessExamNow && questionRestRef.current !== null) return;

    setIsProcessing(true);
    try {
      // If we're in a witness examination phase, treat input as a question
      if (turnState.current_witness_id && (turnState.current_phase_type === 'direct' || turnState.current_phase_type === 'cross' || turnState.current_phase_type === 'redirect')) {
        await handleAskQuestion(input, turnState.current_witness_id, sameDevicePlay ? (turnState.current_turn === 'prosecution' ? 'prosecution' : 'defense') : playerRole);
        // handleAskQuestion re-opens awaitingUserInput itself (for the
        // human's own turn / pass & play) so a follow-up question can be
        // asked right away — don't clear it again here.
      } else {
        // Statement phases (opening/closing): submitting one chunk of text
        // is NOT the same as ending your turn. This used to unconditionally
        // set awaitingUserInput false right after every submission —
        // functionally identical to clicking Rest, since there was no way
        // to type again without changing phases. Multiple submissions now
        // build up your statement; only Rest (or the phase timer running
        // out, which now auto-rests — see handleRestPhase) actually moves
        // on to the other side.
        await addEvent('counsel', input);
        if (!practiceMode && (phaseClocksRef.current[currentPhase] ?? 1) <= 0) {
          // Their time was up and the game was waiting for this: the statement is in, so their turn ends.
          setInput('');
          await handleRestPhaseRef.current();
          return;
        }
        if (turnState.current_turn === playerRole || sameDevicePlay) {
          setAwaitingUserInput(true);
        }
      }
      setInput('');
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Works out where the trial goes next and what the witness-stage clocks look like once it gets there.
  // Nothing is changed here, so the break between counsel can say where it is heading before anything moves.
  const planNextPhase = (): { nextPhase: number; clocks: Record<number, number> } | 'verdict' =>
    planNextPhasePure({
      config: getTrialConfig(trialDuration!),
      duration: trialDuration!,
      currentPhase,
      clocks: phaseClocksRef.current,
      witnessCalledPhases: new Set(
        eventsRef.current
          .filter(e => e.event_type === 'witness_call')
          .map(e => (e.metadata as any)?.phase)
          .filter((n): n is number => typeof n === 'number')
      )
    });

  // The side whose statement a phase is, or null when it is not an opening or closing statement.
  const statementSideOf = (phase: { name: string } | undefined): 'prosecution' | 'defense' | null => {
    const name = phase?.name.toLowerCase() ?? '';
    if (!(name.includes('opening') || name.includes('closing'))) return null;
    return name.includes('prosecution') ? 'prosecution' : name.includes('defense') ? 'defense' : null;
  };

  const handleNextPhase = async () => {
    if (!trialDuration || !aliveRef.current) return;

    // Opening AND closing statements are mandatory: nothing moves past a statement phase until that side
    // has actually said something. Anything they sent counts (even a single word); the automatic
    // "rests" line written by the Rest button or the clock does not.
    const config = getTrialConfig(trialDuration);
    const currentPhaseInfo = config.phases.find(p => p.number === currentPhase);
    const statementSpeaker = statementSideOf(currentPhaseInfo);
    if (statementSpeaker && !statementGiven(eventsRef.current, statementSpeaker, currentPhase)) {
      console.log(`[Courtroom] Blocked advance from phase ${currentPhase} (${currentPhaseInfo?.name}) - ${statementSpeaker} has not given their statement yet`);
      return;
    }

    const plan = planNextPhase();
    if (plan === 'verdict') {
      await handleVerdict();
      return;
    }

    phaseClocksRef.current = plan.clocks;
    setPhaseTimeRemaining(plan.clocks);
    setCurrentPhase(plan.nextPhase);
    if (onlineTwoPlayer) {
      // The phase and the clocks that go with it reach the other screen together, in one step.
      await db.sessions.mergeState(session.id, { phaseTimeRemaining: plan.clocks, totalTimeRemaining }, undefined, plan.nextPhase);
    } else {
      await db.sessions.updateSession(session.id, {
        current_trial_phase: plan.nextPhase
      });
    }

    announcePhase(plan.nextPhase);
  };

  // A short break at every change of counsel in the witness stage. The clock is stopped and nobody can send
  // anything, so a question sent in the last second is answered inside it. Resolves when the break is over.
  const runHandoffBreak = (label: string, seconds: number = HANDOFF_SECONDS, skippable = false) =>
    new Promise<void>(resolve => {
      handoffRef.current = seconds;
      handoffSkipRef.current = false;
      setHandoff({ secondsLeft: seconds, label, skippable });
      const id = setInterval(() => {
        if (!aliveRef.current || handoffSkipRef.current) {
          clearInterval(id);
          handoffSkipRef.current = false;
          handoffRef.current = null;
          setHandoff(null);
          resolve();
          return;
        }
        if (timerPausedRef.current) return;
        const next = (handoffRef.current ?? 0) - 1;
        if (next <= 0) {
          clearInterval(id);
          handoffRef.current = null;
          setHandoff(null);
          resolve();
        } else {
          handoffRef.current = next;
          setHandoff({ secondsLeft: next, label, skippable });
        }
      }, 1000);
    });

  // Waits (briefly) until the question that was just sent has its answer.
  const waitForQuestionAnswer = async (maxMs: number) => {
    const until = Date.now() + maxMs;
    while (questionInFlightRef.current && aliveRef.current && Date.now() < until) {
      await new Promise(r => setTimeout(r, 250));
    }
  };

  // Initialize turn state when phase changes
  useEffect(() => {
    if (showPreTrial) return;
    if (trialDuration && caseData) {
      const config = getTrialConfig(trialDuration);
      const phase = config.phases.find(p => p.number === currentPhase);

      // Try to load turn state from session state
      const savedTurnState = session.session_state?.turnState as Partial<TurnState> | undefined;

      // A witness's id/name should only carry over into a phase that's
      // still examining THAT SAME witness (cross-examination or redirect
      // immediately following their direct examination). Every fresh
      // "Direct Examination" phase is a new witness slot and needs
      // current_witness_id reset to null, or getAllowedActions never
      // shows "call witness" again — it thinks a witness (the previous
      // one) is already on the stand. Without this, any trial with more
      // than one witness per side got stuck after the first witness's
      // cross-examination, since the second witness could never be
      // called.
      const targetPhaseType = getExaminationType(phase);
      // Two players: the witness on the stand is whoever the other counsel called, which is in the transcript.
      const standing = onlineTwoPlayer ? witnessOnStand(eventsRef.current) : null;
      const carriesForwardWitness = targetPhaseType === 'cross' || targetPhaseType === 'redirect';

      // Both counsel can call the same witnesses and submit the same exhibits, so what counts as "already
      // used" is what the counsel whose turn this is has used, not what either side used. (If the trial
      // history has not loaded yet, the saved lists stand in until the next phase.)
      const sideThisPhase = getTurnForPhase(phase);
      const usedThisSide = eventsRef.current.length > 0 && (sideThisPhase === 'prosecution' || sideThisPhase === 'defense')
        ? usedBySide(eventsRef.current, sideThisPhase)
        : null;

      const newTurnState = initializeTurnState(
        phase,
        trialDuration,
        savedTurnState || turnState ? {
          witnesses_called: usedThisSide?.witnesses ?? (savedTurnState?.witnesses_called || turnState?.witnesses_called || []),
          evidence_submitted: usedThisSide?.evidence ?? (savedTurnState?.evidence_submitted || turnState?.evidence_submitted || []),
          current_witness_id: carriesForwardWitness ? (standing?.id || savedTurnState?.current_witness_id || turnState?.current_witness_id || null) : null,
          current_witness_name: carriesForwardWitness ? (standing?.name || savedTurnState?.current_witness_name || turnState?.current_witness_name || null) : null
        } : undefined
      );
       setTurnState(newTurnState);

       // Save turn state to session (not with two players: each screen works it out from the same
       // transcript, and a write of the whole saved state from a screen that is behind would overwrite the other's)
       if (!onlineTwoPlayer) {
         db.sessions.updateSession(session.id, {
           session_state: {
             ...session.session_state,
             turnState: newTurnState
           }
          }).catch(err => console.error('Failed to save turn state:', err));
       }

        // Enable user input for defense turns (after judge instruction).
        // In pass & play, both sides are the same human on one device, so
        // input opens on every turn, not just playerRole's fixed side.
        if ((newTurnState.current_turn === playerRole || sameDevicePlay) && !judgeInstructionPending) {
          setAwaitingUserInput(true);
        }

        // Auto-triggering the AI's side for witness-examination phases is
        // handled by the dedicated effect below (keyed off turnState so it
        // can keep re-firing for each of the AI's actions within a phase,
        // not just the first). Opening statements have their own dedicated
        // effect further down too. Don't duplicate either trigger here.
    }
  }, [currentPhase, trialDuration, caseData, judgeInstructionPending, showPreTrial]);

  // Auto-trigger the AI's side during witness-examination phases (direct,
  // cross, redirect). This re-fires every time turnState changes — which
  // happens after every action the AI (or the human) takes — so it keeps
  // driving the AI's turn forward (call witness, then ask a question, then
  // another, then end the phase) instead of firing once and going silent.
  //
  // This used to live inside the "Initialize turn state" effect above and
  // claimed prosecutionTurnTriggeredRef *before* scheduling its delayed
  // call, using the same-tick value of judgeInstructionPending. That value
  // is stale on the very first render of a new phase — the judge-
  // instruction effect (which sets judgeInstructionPending true) runs
  // *after* this one in the same commit, so this effect would read `false`,
  // claim the ref immediately, and schedule a timer. That timer then got
  // cancelled a moment later when judgeInstructionPending actually flipped
  // to true (a dependency change re-runs the effect, and React tears down
  // the old effect's cleanup first). But the ref stays claimed for this
  // phase number forever, so when judgeInstructionPending correctly flips
  // back to false once the judge is done speaking, the guard
  // `prosecutionTurnTriggeredRef.current !== currentPhase` is already
  // false and the AI is never (re)scheduled. That's the root cause behind
  // "witness calling doesn't work" — the AI's turn silently never fires.
  //
  // The fix here has no such ref: this effect is written to be safe to
  // re-run on every relevant dependency change (including the stale first
  // pass), since isProsecutionThinking naturally prevents overlapping
  // calls, and turnState only changes when there's genuinely a new action
  // to take.
  useEffect(() => {
    if (isMultiplayer || showPreTrial) return;
    if (!trialDuration || !caseData || !turnState) return;
    if (isProsecutionThinking || judgeInstructionPending) return;

    const config = getTrialConfig(trialDuration);
    const phase = config.phases.find(p => p.number === currentPhase);

    // Only witness-examination phases (direct/cross/redirect) — opening
    // and closing statements are each handled by their own effect.
    if (!isWitnessPhase(phase)) return;
    if (turnState.current_turn !== aiRole) return;
    // A paused trial (including one just reopened) waits for the player to resume.
    if (timerPaused) return;
    // The witness is still answering: wait for the answer to finish before the next move.
    if (aiHold || handoff) return; // nothing happens during the break between counsel
    // The rest between questions is still running, or the judge is ruling on an objection.
    if (questionRestLeft !== null || isProcessingObjection) return;

    console.log('[Courtroom] Scheduling AI turn for witness phase', currentPhase, turnState);

    // After a failed or empty AI turn, wait a few seconds before trying again.
    const delay = aiNoopTurnsRef.current > 0 ? 5000 : 1500;
    const timer = setTimeout(() => {
      handleProsecutionTurn();
    }, delay);

    return () => clearTimeout(timer);
  }, [currentPhase, trialDuration, caseData, judgeInstructionPending, showPreTrial, isMultiplayer, isProsecutionThinking, turnState, aiRole, timerPaused, aiHold, handoff, questionRestLeft, isProcessingObjection]);

  // Judge Instruction Sub-Phase Handler
  // Before entering any counsel action phase, show judge instruction first
  const judgeInstructionShownRef = useRef<Set<number>>(new Set());
  
  useEffect(() => {
    if (showPreTrial) return;
    if (!trialDuration || !caseData || !judgeName) return;
    
    const config = getTrialConfig(trialDuration);
    const currentPhaseInfo = config.phases.find(p => p.number === currentPhase);
    
    if (!currentPhaseInfo) return;
    
    // Check if this phase requires a judge instruction before it
    if (!requiresJudgeInstruction(currentPhaseInfo)) return;
    
    // Two players: the judge's line is written once, by the counsel who is about to speak (or the host for
    // phases that belong to neither); the other screen receives it with everything else and reads it out.
    if (onlineTwoPlayer) {
      const turnOwner = getTurnForPhase(currentPhaseInfo);
      const iWriteIt = turnOwner === 'prosecution' || turnOwner === 'defense' ? turnOwner === playerRole : session.user_id === user.id;
      if (!iWriteIt) return;
    }

    // Check if we already showed the instruction for this phase
    if (judgeInstructionShownRef.current.has(currentPhase)) return;
    
    // Check if judge already gave instruction for this phase (from saved events)
    const judgeAlreadySpoke = events.some(e => 
      e.speaker_role === 'judge' && 
      e.metadata?.instruction_for_phase === currentPhase
    );
    
    if (judgeAlreadySpoke) {
      judgeInstructionShownRef.current.add(currentPhase);
      return;
    }
    
    // Generate hardcoded judge instruction
    const witnessNumber = extractWitnessNumber(currentPhaseInfo.name);
    const instruction = getJudgeInstructionForPhase({
      prosecutorName: effectiveProsecutorName,
      defenseName: effectiveDefenseName,
      nextPhase: currentPhaseInfo,
      witnessNumber
    });
    
    console.log('[Courtroom] 🎯 Showing judge instruction for phase', currentPhase, ':', instruction);
    judgeInstructionShownRef.current.add(currentPhase);
    
    // Add judge instruction to transcript
    const addInstruction = async () => {
      setJudgeInstructionPending(true);
      try {
        const judgeEvent = await addTrialEvent({
          session_id: session.id,
          event_type: 'opening',
          speaker_role: 'judge',
          speaker_name: judgeName,
          content: instruction,
          metadata: {
            instruction_type: 'phase_instruction',
            instruction_for_phase: currentPhase,
            phase: currentPhase
          },
          event_order: events.length + 1
        });
        setEvents((prev: TrialEvent[]) => [...prev, judgeEvent]);
        speakAs('judge', instruction);
        // Wait for speech to complete (approximate)
        await new Promise(resolve => setTimeout(resolve, instruction.length * 50));
        setJudgeInstructionPending(false);
      } catch (dbError) {
        console.error('[Courtroom] ❌ Failed to save judge instruction:', dbError);
        const fallbackEvent: TrialEvent = {
          id: `temp-judge-${Date.now()}`,
          session_id: session.id,
          event_type: 'opening',
          speaker_role: 'judge',
          speaker_name: judgeName,
          content: instruction,
          timestamp: new Date().toISOString(),
          metadata: {
            instruction_type: 'phase_instruction',
            instruction_for_phase: currentPhase
          },
          event_order: events.length + 1
        };
        setEvents((prev: TrialEvent[]) => [...prev, fallbackEvent]);
        speakAs('judge', instruction);
        await new Promise(resolve => setTimeout(resolve, instruction.length * 50));
        setJudgeInstructionPending(false);
      }
    };
    
    addInstruction();
  }, [currentPhase, caseData, trialDuration, judgeName, prosecutorName, events.length, showPreTrial]);

  // Opening Statement - AI's side (phase 7 for prosecution, phase 8 for defense)
  useEffect(() => {
    const openingPhaseNumber = aiRole === 'prosecution' ? 7 : 8;

    console.log('[Courtroom] 🔍 Opening statement useEffect triggered:', {
      currentPhase,
      openingPhaseNumber,
      aiRole,
      hasCaseData: !!caseData,
      hasTrialDuration: !!trialDuration,
      isProsecutionThinking,
      judgeInstructionPending,
      prosecutionTurnTriggeredRef: prosecutionTurnTriggeredRef.current
    });

    if (isMultiplayer || showPreTrial || currentPhase !== openingPhaseNumber || !caseData || !trialDuration || isProsecutionThinking) {
      console.log('[Courtroom] 🚫 Opening statement useEffect blocked by conditions');
      return;
    }
    // Wait for the judge's "you may proceed" instruction to finish being
    // generated and shown before the AI's side starts speaking. Without
    // this guard, this effect and the judge-instruction effect both fire
    // as soon as currentPhase becomes the opening phase and race each
    // other, so the AI's opening statement can appear before or
    // interleaved with the judge's line instead of after it.
    if (judgeInstructionPending) {
      console.log('[Courtroom] 🚫 Opening statement blocked - waiting for judge instruction to finish');
      return;
    }
    if (prosecutionTurnTriggeredRef.current === openingPhaseNumber) {
      console.log('[Courtroom] 🚫 Opening statement already triggered for this phase');
      return;
    }

    const config = getTrialConfig(trialDuration);
    const phase = config.phases.find(p => p.number === openingPhaseNumber);
    const expectedName = aiRole === 'prosecution' ? 'Opening Statement - Prosecution' : 'Opening Statement - Defense';
    if (!phase || phase.name !== expectedName) return;

    console.log(`[Courtroom] 🚀 Phase ${openingPhaseNumber}: Judge instruction complete, generating ${aiRole} opening statement`);

    const generateOpening = async () => {
      prosecutionTurnTriggeredRef.current = openingPhaseNumber;
      setIsProsecutionThinking(true);

      try {
        await handleGenerateOpeningStatement();
        console.log('[Courtroom] ✅ Opening statement completed');
      } catch (error) {
        console.error('[Courtroom] ❌ Opening statement failed:', error);
        setIsProsecutionThinking(false);
      }
    };

    // Same 2500ms deferral the other phases use before triggering the AI.
    // The judgeInstructionPending check above can still read a stale value on
    // the very first render where currentPhase flips to the opening phase
    // (the judge-instruction effect's setState hasn't applied yet within the
    // same render pass), so the check alone isn't airtight. This delay is
    // what actually closes the race: it gives the judge's instruction (a DB
    // write + state update) real time to finish and render before the AI
    // starts speaking, regardless of exact same-tick state timing.
    const timer = setTimeout(() => {
      generateOpening();
    }, 2500);

    return () => clearTimeout(timer);
  }, [currentPhase, caseData, trialDuration, isProsecutionThinking, judgeInstructionPending, showPreTrial, aiRole]);

  // Closing Statement - AI's side. Unlike opening, closing phase numbers
  // vary by trial duration, so the phase is resolved by name each time
  // rather than a hardcoded 7/8. Structured identically to the opening
  // effect above (same race-closing 2500ms deferral, same lazy ref-set
  // inside the delayed callback) so it doesn't inherit the trigger-race
  // bug that blocked witness-phase auto-triggering.
  useEffect(() => {
    if (isMultiplayer || showPreTrial || !caseData || !trialDuration || isProsecutionThinking) return;

    const config = getTrialConfig(trialDuration);
    const expectedName = aiRole === 'prosecution' ? 'Closing Statement - Prosecution' : 'Closing Statement - Defense';
    const closingPhase = config.phases.find(p => p.name === expectedName);
    if (!closingPhase || currentPhase !== closingPhase.number) return;

    if (judgeInstructionPending) return;
    if (prosecutionTurnTriggeredRef.current === closingPhase.number) return;

    const generateClosing = async () => {
      prosecutionTurnTriggeredRef.current = closingPhase.number;
      setIsProsecutionThinking(true);
      try {
        await handleGenerateClosingStatement();
      } catch (error) {
        console.error('[Courtroom] ❌ Closing argument failed:', error);
        setIsProsecutionThinking(false);
      }
    };

    // Same 2500ms deferral the opening effect uses — see the comment there
    // for why the delay (not just the judgeInstructionPending check) is
    // what actually closes the same-tick staleness race.
    const timer = setTimeout(() => {
      generateClosing();
    }, 2500);

    return () => clearTimeout(timer);
  }, [currentPhase, caseData, trialDuration, isProsecutionThinking, judgeInstructionPending, showPreTrial, aiRole]);

  // Handle prosecution AI turn
  const handleProsecutionTurn = async () => {
    if (!trialDuration || !turnState || !caseData || !aliveRef.current) return;
    if (handoffRef.current !== null) return; // the break between counsel
    
    setIsProsecutionThinking(true);
    try {
      const config = getTrialConfig(trialDuration);
      const phase = config.phases.find(p => p.number === currentPhase);

      // turnState.phase_time_remaining is set once when the phase starts
      // and never decrements — the real, ticking countdown lives in the
      // separate phaseTimeRemaining state (driven by startTimer's 1-second
      // interval). Build a live-corrected view of turnState for this one
      // turn's decision-making instead of persisting the correction via
      // setTurnState — writing it into turnState every second would make
      // turnState change every second, and the witness-phase AI-trigger
      // effect below is keyed on turnState changing, so that would cancel
      // and reschedule the AI's pending action every second and it would
      // never actually fire.
      const liveTimeRemaining = phaseTimeRemaining[currentPhase] ?? turnState.phase_time_remaining;
      const liveTurnState = { ...turnState, phase_time_remaining: liveTimeRemaining };

      const allowedActions = getAllowedActions(
        liveTurnState,
        phase,
        trialDuration,
        witnesses.map(w => ({ id: w.id, name: w.name })),
        evidence.map(e => ({ id: e.id, exhibit_label: e.exhibit_label, title: e.title })),
        true
      );

      const currentWitness = turnState.current_witness_id 
        ? witnesses.find(w => w.id === turnState.current_witness_id)?.name || null
        : null;
      // While a witness is on the stand the AI counsel also sees the last 5 questions and answers in full.
      const examRecap = turnState.current_witness_id && currentWitness
        ? buildExaminationRecap(events, turnState.current_witness_id, currentWitness)
        : '';
      const transcriptSummary = [buildTranscriptSummary(events), examRecap].filter(Boolean).join('\n\n');

      const prosecutionContext = {
        role: 'prosecution' as const,
        side: aiRole,
        phase: phase?.name || 'Unknown',
        difficulty: (session.session_state as any)?.difficulty,
        time_remaining_seconds: liveTimeRemaining,
        current_witness: currentWitness,
        available_witnesses: witnesses.map(w => ({ id: w.id, name: w.name })),
        available_evidence: evidence.map(e => ({
          id: e.id,
          exhibit_label: e.exhibit_label,
          title: e.title
        })),
        recent_transcript: transcriptSummary,
        allowed_actions: allowedActions,
        trial_duration: trialDuration || 30,
        witnesses_called_count: turnState.witnesses_called.length
      } as const;

      const action = await generateProsecutionAction(prosecutionContext);
      // The player left while the AI was thinking: don't write its turn or move the trial on.
      if (!aliveRef.current) return;
      const progressed = await executeProsecutionAction(action);
      // An AI move that did nothing (no usable question, unknown witness...) never ends the AI's turn:
      // the phase clock does that. It is just retried after a short pause (see the trigger effect), so
      // a failing AI service is not hammered every 1.5 seconds.
      aiNoopTurnsRef.current = progressed === false ? aiNoopTurnsRef.current + 1 : 0;
    } catch (error) {
      console.error('Failed to handle prosecution turn:', error);
      aiNoopTurnsRef.current += 1; // same short pause before the retry
    } finally {
      setIsProsecutionThinking(false);
    }
  };

  // Execute prosecution action
  const executeProsecutionAction = async (action: { action: string; content?: string; witness_name?: string; evidence_id?: string }): Promise<boolean> => {
    if (!turnState) return false;

    switch (action.action) {
      case 'make_statement':
        // Handle opening/closing statements
        if (action.content) {
          await handleMakeStatement(action.content);
        } else {
          // Generate the statement automatically — route to whichever kind
          // the current phase actually calls for. This used to always call
          // handleGenerateOpeningStatement() regardless of phase, so an AI
          // reaching closing arguments without supplying its own content
          // would get a fresh OPENING statement generated instead.
          const config = trialDuration ? getTrialConfig(trialDuration) : null;
          const phase = config?.phases.find(p => p.number === currentPhase);
          const isClosingPhase = phase?.name.toLowerCase().includes('closing');
          if (isClosingPhase) {
            await handleGenerateClosingStatement();
          } else {
            await handleGenerateOpeningStatement();
          }
        }
        return true;

      case 'call_witness': {
        // The AI never opens the player's pickers. It names a witness (matched loosely, since the
        // model may change case or drop a title); if it names none we know, the next one not yet
        // called takes the stand.
        const wanted = (action.witness_name || '').trim().toLowerCase();
        const notCalled = witnesses.filter(w => !turnState.witnesses_called.includes(w.id));
        const witness =
          (wanted && (notCalled.find(w => w.name.toLowerCase() === wanted) ||
            notCalled.find(w => w.name.toLowerCase().includes(wanted) || wanted.includes(w.name.toLowerCase())))) ||
          notCalled[0];
        if (!witness) return false;
        await handleCallWitness(witness);
        return true;
      }

      case 'ask_question': {
        const question = (action.content || '').trim();
        if (!question || !turnState.current_witness_id) return false;
        await handleAskQuestion(question, turnState.current_witness_id, aiRole);
        return true;
      }

      case 'submit_evidence': {
        // Evidence only goes in while witnesses are being called and examined.
        const phaseNow = trialDuration ? getPhaseInfo(currentPhase, trialDuration) : undefined;
        if (!canSubmitEvidence(phaseNow)) return false;
        const wanted = (action.evidence_id || '').trim().toLowerCase();
        const open = evidence.filter(e => !turnState.evidence_submitted.includes(e.id));
        const evidenceItem =
          open.find(e => e.id === action.evidence_id) ||
          (wanted ? open.find(e => (e.exhibit_label || '').toLowerCase() === wanted || e.title.toLowerCase() === wanted) : undefined);
        if (!evidenceItem) return false;
        await handleSubmitEvidence(evidenceItem);
        return true;
      }

      case 'end_phase':
        await handleEndPhase();
        return true;

      case 'rest':
        await handleRestPhase();
        return true;

      default:
        console.warn('Unknown prosecution action:', action.action);
        return false;
    }
  };

  // Handle making a statement (opening/closing)
  const handleMakeStatement = async (statement: string) => {
    if (!caseData) {
      console.warn('[Courtroom] Cannot make statement - caseData not loaded');
      return;
    }

    console.log('[Courtroom] 📝 handleMakeStatement called with statement length:', statement.length);
    resumeFromObjection();
    
    try {
      const config = getTrialConfig(trialDuration!);
      const phase = config.phases.find(p => p.number === currentPhase);
       const isOpening = phase?.name.toLowerCase().includes('opening');

      console.log('[Courtroom] 💾 Saving event to database...');
      const event = await addTrialEvent({
        session_id: session.id,
        event_type: isOpening ? 'opening' : 'closing',
        speaker_role: aiRole,
        speaker_name: aiRole === 'prosecution' ? effectiveProsecutorName : effectiveDefenseName,
        content: statement,
        metadata: { 
          phase: currentPhase,
          statement_type: isOpening ? 'opening' : 'closing'
        },
        event_order: events.length + 1
      });
      console.log('[Courtroom] ✅ Event saved to database:', event.id);

      console.log('[Courtroom] 📋 Updating events state...');
      setEvents(prevEvents => [...prevEvents, event]);

      // Track prosecution event for objections
      setLastProsecutionEvent(event);
      console.log('[Courtroom] ✅ Statement processed successfully');

      // Speaking is decoupled from advancing the phase — the auto-rest
      // countdown (started right after this function returns, sized to an
      // estimated read time) is the sole mechanism for moving on
      // automatically. This used to advance the phase via a callback when
      // TTS playback finished speaking, for opening statements only —
      // which raced with the countdown (whichever finished first "won",
      // and the other could fire again later against a stale phase) and
      // never applied to closing arguments at all.
      console.log('[Courtroom] 🔊 Speaking text...');
      speakAs('counsel', statement);
    } catch (error) {
      console.error('[Courtroom] ❌ Error in handleMakeStatement:', error);
      // Still update UI even if DB save fails
      const fallbackEvent: TrialEvent = {
        id: `temp-${Date.now()}`,
        session_id: session.id,
        event_type: 'opening',
        speaker_role: aiRole,
        speaker_name: aiRole === 'prosecution' ? effectiveProsecutorName : effectiveDefenseName,
        content: statement,
        timestamp: new Date().toISOString(),
        metadata: { phase: currentPhase },
        event_order: events.length + 1
      };
      setEvents(prev => [...prev, fallbackEvent]);
      speakAs('counsel', statement);
      setLastProsecutionEvent(fallbackEvent);
      throw error; // Re-throw so caller knows it failed
    }
  };

  // Generate opening statement automatically
  const handleGenerateOpeningStatement = async () => {
    if (!aliveRef.current) return; // the player left: no background AI work
    console.log('[Courtroom] 🎯 handleGenerateOpeningStatement CALLED');
    console.log('[Courtroom] 📊 Current state:', {
      hasCaseData: !!caseData,
      hasTrialDuration: !!trialDuration,
      currentPhase,
      isProsecutionThinking
    });
    
    if (!caseData || !trialDuration) {
      console.warn('[Courtroom] ⚠️ Cannot generate opening statement - missing caseData or trialDuration', {
        hasCaseData: !!caseData,
        hasTrialDuration: !!trialDuration
      });
      setIsProsecutionThinking(false);
      return;
    }

    // Opening statements don't require turnState - it's initialized later
    console.log('[Courtroom] ✅ All checks passed - Generating opening statement...');
    setIsProsecutionThinking(true);
    // Tracked here (not scoped inside try/catch) so the finally block can
    // size the auto-rest countdown off whatever statement actually ended
    // up in the transcript, real or fallback.
    
    // Add timeout to prevent infinite hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Opening statement generation timeout after 60 seconds')), 60000);
    });
    
    try {
      const config = getTrialConfig(trialDuration);
      // Opening statement phase: 7 for prosecution, 8 for defense — whichever
      // phase belongs to the side the AI is playing.
      const openingPhaseNumber = aiRole === 'prosecution' ? 7 : 8;
      const phase = config.phases.find(p => p.number === openingPhaseNumber);
      const timeLimit = phase ? legacyStatementMinutes(trialDuration) : 0; // in minutes (what the AI's statement length is sized to)

      // Get investigation findings for comprehensive opening statement
      const { buildInvestigationFindings } = await import('../lib/trial/trialEngine');
      const investigationData = await buildInvestigationFindings(session.case_id, session.id);

      // Debug: Log investigation data
      console.log('[Courtroom] 🔍 Investigation Data Retrieved:', {
        evidenceLength: investigationData.evidenceSummary.length,
        transcriptsLength: investigationData.witnessTranscripts.length,
        evidencePreview: investigationData.evidenceSummary.substring(0, 200),
        transcriptsPreview: investigationData.witnessTranscripts.substring(0, 200)
      });

      // Generate opening statement using prosecution AI with full investigation context
      console.log('[Courtroom] 📝 Calling generateProsecutionOpeningStatement...');
      const openingStatement = await Promise.race([
        generateProsecutionOpeningStatement({
          caseTitle: caseData.title,
          prosecutorName: aiRole === 'prosecution' ? effectiveProsecutorName : effectiveDefenseName,
          side: aiRole,
          difficulty: (session.session_state as any)?.difficulty,
          defendantName: caseData.defendant_name,
          caseDescription: descriptionWithRelief(caseData.description, caseData.requested_relief),
          timeLimitMinutes: timeLimit,
          availableEvidence: evidence.map(e => ({
            id: e.id,
            title: e.title,
            description: e.description || '',
            ai_description: e.ai_description || '',
            exhibit_label: e.exhibit_label
          })),
          availableWitnesses: witnesses.map(w => ({
            id: w.id,
            name: w.name,
            role: w.role
          })),
          investigationEvidenceSummary: investigationData.evidenceSummary,
          investigationWitnessTranscripts: investigationData.witnessTranscripts
        }),
        timeoutPromise
      ]) as string;

      console.log('[Courtroom] ✅ Opening statement received, length:', openingStatement.length);
      console.log('[Courtroom] 📢 Calling handleMakeStatement...');
      
      // Also add timeout for handleMakeStatement
      await Promise.race([
        handleMakeStatement(openingStatement),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('handleMakeStatement timeout after 30 seconds')), 30000);
        })
      ]);
      
      console.log('[Courtroom] ✅ handleMakeStatement completed');
    } catch (error) {
      console.error('[Courtroom] ❌ Failed to generate opening statement:', error);
      // Fallback statement - don't wait for DB, just show it
      const fallback = aiRole === 'prosecution'
        ? `Good morning, Your Honor. The prosecution is ready to present its case. We will show that the defendant is guilty beyond a reasonable doubt.`
        : `Good morning, Your Honor. The defense is ready to present its case. We will show that the evidence does not support a finding of guilt beyond a reasonable doubt.`;
      try {
        // Use a simpler version that doesn't require DB
        const fallbackEvent: TrialEvent = {
          id: `temp-${Date.now()}`,
          session_id: session.id,
          event_type: 'opening',
          speaker_role: aiRole,
          speaker_name: aiRole === 'prosecution' ? effectiveProsecutorName : effectiveDefenseName,
          content: fallback,
          timestamp: new Date().toISOString(),
          metadata: { phase: currentPhase },
          event_order: events.length + 1
        };
        eventsRef.current = [...eventsRef.current, fallbackEvent];
        setEvents(prev => [...prev, fallbackEvent]);
        speakAs('counsel', fallback);
        setLastProsecutionEvent(fallbackEvent);
      } catch (fallbackError) {
        console.error('[Courtroom] ❌ Failed to make fallback statement:', fallbackError);
      }
    } finally {
      setIsProsecutionThinking(false);
      console.log('[Courtroom] ✅ Opening statement generation complete (finally block executed)');
      void handleRestPhaseRef.current(); // the fixed read time in handleRestPhase is the time to read it
    }
  };

  // Generate closing argument automatically. Mirrors
  // handleGenerateOpeningStatement, but pulls context from what actually
  // happened during the trial (transcript, evidence submitted, witnesses
  // called) instead of the pre-trial investigation findings, since a
  // closing argument needs to reference the trial that unfolded rather
  // than the pre-trial theory of the case.
  const handleGenerateClosingStatement = async () => {
    if (!aliveRef.current) return; // the player left: no background AI work
    if (!caseData || !trialDuration) {
      console.warn('[Courtroom] ⚠️ Cannot generate closing argument - missing caseData or trialDuration');
      setIsProsecutionThinking(false);
      return;
    }

    setIsProsecutionThinking(true);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Closing argument generation timeout after 60 seconds')), 60000);
    });

    try {
      const config = getTrialConfig(trialDuration);
      // Closing phase numbers vary by trial length (unlike opening, which is
      // always 7/8), so resolve by name rather than a hardcoded number.
      const expectedName = aiRole === 'prosecution' ? 'Closing Statement - Prosecution' : 'Closing Statement - Defense';
      const phase = config.phases.find(p => p.name === expectedName);
      const timeLimit = phase ? legacyStatementMinutes(trialDuration) : 0;

      const transcriptSummary = buildTranscriptSummary(events, events.length);
      const usedInTrial = usedByEither(eventsRef.current);
      const evidenceSubmitted = evidence.filter(e => usedInTrial.evidence.includes(e.id));
      const witnessesCalled = witnesses.filter(w => usedInTrial.witnesses.includes(w.id));

      const closingArgument = await Promise.race([
        generateClosingArgument({
          caseTitle: caseData.title,
          prosecutorName: aiRole === 'prosecution' ? effectiveProsecutorName : effectiveDefenseName,
          side: aiRole,
          difficulty: (session.session_state as any)?.difficulty,
          defendantName: caseData.defendant_name,
          caseDescription: descriptionWithRelief(caseData.description, caseData.requested_relief),
          timeLimitMinutes: timeLimit,
          trialTranscriptSummary: transcriptSummary,
          evidenceSubmitted: evidenceSubmitted.map(e => ({ id: e.id, exhibit_label: e.exhibit_label, title: e.title })),
          witnessesCalled: witnessesCalled.map(w => ({ id: w.id, name: w.name }))
        }),
        timeoutPromise
      ]) as string;

      await Promise.race([
        handleMakeStatement(closingArgument),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('handleMakeStatement timeout after 30 seconds')), 30000);
        })
      ]);
    } catch (error) {
      console.error('[Courtroom] ❌ Failed to generate closing argument:', error);
      const fallback = aiRole === 'prosecution'
        ? `Your Honor, members of the jury — the evidence and testimony you've heard today prove beyond a reasonable doubt that the defendant is guilty. We ask you to return a guilty verdict.`
        : `Your Honor, members of the jury — the prosecution has not met its burden of proof. The evidence and testimony leave real, reasonable doubt, and we ask you to return a verdict of not guilty.`;
      try {
        const fallbackEvent: TrialEvent = {
          id: `temp-${Date.now()}`,
          session_id: session.id,
          event_type: 'closing',
          speaker_role: aiRole,
          speaker_name: aiRole === 'prosecution' ? effectiveProsecutorName : effectiveDefenseName,
          content: fallback,
          timestamp: new Date().toISOString(),
          metadata: { phase: currentPhase, statement_type: 'closing' },
          event_order: events.length + 1
        };
        eventsRef.current = [...eventsRef.current, fallbackEvent];
        setEvents(prev => [...prev, fallbackEvent]);
        speakAs('counsel', fallback);
        setLastProsecutionEvent(fallbackEvent);
      } catch (fallbackError) {
        console.error('[Courtroom] ❌ Failed to make fallback closing argument:', fallbackError);
      }
    } finally {
      setIsProsecutionThinking(false);
      void handleRestPhaseRef.current(); // the fixed read time in handleRestPhase is the time to read it
    }
  };

  // Handle calling a witness. Attributed to whichever side's turn it
  // actually is (turnState.current_turn), not hardcoded to prosecution —
  // this is the one "call witness" path used by both the main Call
  // Witness button and the Defence Actions modal, so a witness call
  // during a defense witness phase is correctly logged as the defense
  // calling their witness, not mislabeled as the prosecution's.
  const handleCallWitness = async (witness: Witness) => {
    if (!turnState) return;
    resumeFromObjection();
    const phaseAtStart = turnState.current_phase_number;

    const callerRole: 'prosecution' | 'defense' = turnState.current_turn === 'defense' ? 'defense' : 'prosecution';
    const callerName = callerRole === 'prosecution' ? effectiveProsecutorName : effectiveDefenseName;

    const event = await addTrialEvent({
      session_id: session.id,
      event_type: 'witness_call',
      speaker_role: callerRole,
      speaker_name: callerName,
      content: witness.name,
      metadata: {
        witness_id: witness.id,
        phase: currentPhase
      },
      event_order: eventsRef.current.length + 1
    });

    // Add to the transcript from the latest list, not the copy this function started with: other lines
    // (the judge's, a witness answer) may have been added while the save above was in flight.
    eventsRef.current = [...eventsRef.current, event];
    setEvents(prev => [...prev, event]);

    // Track prosecution event for objections
    if (turnState.current_turn === aiRole) {
      setLastProsecutionEvent(event);
    }
    trackObjectableStatement(event);

    // Same for the turn state, and never write into a phase that has moved on in the meantime.
    setTurnState(prev =>
      prev && prev.current_phase_number === phaseAtStart
        ? {
            ...prev,
            current_witness_id: witness.id,
            current_witness_name: witness.name,
            witnesses_called: prev.witnesses_called.includes(witness.id) ? prev.witnesses_called : [...prev.witnesses_called, witness.id]
          }
        : prev
    );
    setShowWitnessSelector(false);
  };

  const releaseAnswerHold = () => {
    if (answerHoldTimerRef.current) {
      clearTimeout(answerHoldTimerRef.current);
      answerHoldTimerRef.current = null;
    }
    setAiHold(false);
  };

  // The witness answer is read out loud (when the voice is on). How long nobody can ask anything, and the
  // clock stands still, is the fixed read-out time (see questionRest.ts), not how long the voice takes.
  const holdForAnswer = (text: string) => {
    releaseAnswerHold();
    if (canSpeak()) speakAs('witness', text);
  };

  // Handle asking a question to witness
  // `asker` is who actually sent the question. The caller knows (the human's own side, or the AI's side),
  // so a question sent just as the turn flips is never filed under the other counsel.
  const handleAskQuestion = async (question: string, witnessId: string, asker?: 'prosecution' | 'defense') => {
    if (!turnState) return;
    // Still inside the rest after the last answer, or in the break between counsel: nothing is asked.
    if (questionRestRef.current !== null || handoffRef.current !== null) return;

    const witness = witnesses.find(w => w.id === witnessId);
    if (!witness) return;

    // The questioning counsel is talking again: if an objection had stopped their clock, it runs now.
    resumeFromObjection();

    // Everything below belongs to the phase and turn that asked this question. Read it once up front: the
    // answer takes seconds to come back and the trial may have moved on by then.
    const phaseAtStart = turnState.current_phase_number;
    const examinationType = turnState.current_phase_type;
    const askerRole: 'prosecution' | 'defense' = asker ?? (turnState.current_turn === 'prosecution' ? 'prosecution' : 'defense');
    const askerIsAi = !isMultiplayer && askerRole === aiRole;
    const humanAsking = !askerIsAi && (askerRole === playerRole || sameDevicePlay);
    const askedNow = (turnState.questions_asked ?? 0) + 1;
    // What this witness has already said, before this question joins the transcript.
    const earlierEvents = eventsRef.current;
    const base = earlierEvents.length;

    // Add the question to the transcript
    questionInFlightRef.current = true;
    const questionEvent = await addTrialEvent({
      session_id: session.id,
      event_type: 'witness_examination',
      speaker_role: askerRole,
      speaker_name: askerRole === 'prosecution' ? effectiveProsecutorName : effectiveDefenseName,
      content: question,
      metadata: { 
        witness_id: witnessId,
        phase: currentPhase,
        examination_type: examinationType
      },
      event_order: base + 1
    }).catch(err => { questionInFlightRef.current = false; throw err; });

    eventsRef.current = [...eventsRef.current, questionEvent];
    setEvents(prev => [...prev, questionEvent]);

    // Get witness response
    setIsProcessing(true);
    let answered = false;
    try {
      // The last few real question-and-answer pairs with this witness.
      const previousInteractions = buildWitnessHistory(earlierEvents, witnessId);

      // Cross-examination comes from the other side; direct and redirect come from the counsel who called the witness.
      const response = await generateWitnessResponse(witness, question, previousInteractions, examinationType === 'cross' ? 'opposing_counsel' : 'own_counsel');

      // The answer is read out for a fixed 20 seconds with the clock stopped. (In the break between counsel
      // the break itself is the time to read it.)
      if (currentPhaseRef.current === phaseAtStart && handoffRef.current === null) startQuestionRest(questionRestSeconds(trialDuration));
      holdForAnswer(response);

      // Add witness response to transcript
      const responseEvent = await addTrialEvent({
        session_id: session.id,
        event_type: 'witness_examination',
        speaker_role: 'witness',
        speaker_name: witness.name,
        content: response,
        metadata: { 
          witness_id: witnessId,
          phase: currentPhase,
          examination_type: examinationType
        },
        event_order: base + 2
      });

      eventsRef.current = [...eventsRef.current, responseEvent];
      setEvents(prev => [...prev, responseEvent]);
      answered = true;
      
      // Track last prosecution event for objections
      if (askerIsAi) {
        setLastProsecutionEvent(questionEvent);
      }
      trackObjectableStatement(questionEvent);

      // Count the question (informational: there is no cap, the phase clock and the rest between
      // questions pace the examination). This state update also keeps the AI-turn trigger effect
      // re-firing after each question, so the AI keeps examining until the clock runs out or it
      // chooses to rest. It is applied to the latest turn state, and only if it is still the same phase.
      setTurnState(prev =>
        prev && prev.current_phase_number === phaseAtStart ? { ...prev, questions_asked: askedNow } : prev
      );
    } catch (error) {
      console.error('Failed to get witness response:', error);
    } finally {
      questionInFlightRef.current = false;
      setIsProcessing(false);
      // Re-open the human's text box for the next question (they asked this one). Even when the witness
      // response failed the box stays open, so they can ask again. Only while it is still their phase:
      // otherwise the box would open on the other side's turn.
      if (humanAsking && currentPhaseRef.current === phaseAtStart) {
        setAwaitingUserInput(true);
      }
    }
  };

  // Handle evidence submission
  const handleSubmitEvidence = async (evidenceItem: Evidence) => {
    if (!turnState) return;
    // Evidence only goes in while witnesses are being called and examined, never in openings or closings.
    if (!canSubmitEvidence(trialDuration ? getPhaseInfo(currentPhase, trialDuration) : undefined)) {
      setShowEvidenceSelector(false);
      return;
    }
    resumeFromObjection();
    const phaseAtStart = turnState.current_phase_number;

    const event = await addTrialEvent({
      session_id: session.id,
      event_type: 'evidence_submission',
      speaker_role: turnState.current_turn === 'prosecution' ? 'prosecution' : 'defense',
      speaker_name: turnState.current_turn === 'prosecution' 
        ? effectiveProsecutorName
        : effectiveDefenseName,
      content: `Submits ${evidenceItem.exhibit_label || evidenceItem.title} to the court.`,
      metadata: { 
        evidence_id: evidenceItem.id,
        exhibit_label: evidenceItem.exhibit_label,
        evidence_title: evidenceItem.title,
        phase: currentPhase
      },
      event_order: eventsRef.current.length + 1
    });

    eventsRef.current = [...eventsRef.current, event];
    setEvents(prev => [...prev, event]);
    
    // Track prosecution event for objections
    if (turnState.current_turn === aiRole) {
      setLastProsecutionEvent(event);
    }
    trackObjectableStatement(event);
    
    setTurnState(prev =>
      prev && prev.current_phase_number === phaseAtStart
        ? { ...prev, evidence_submitted: prev.evidence_submitted.includes(evidenceItem.id) ? prev.evidence_submitted : [...prev.evidence_submitted, evidenceItem.id] }
        : prev
    );
    setShowEvidenceSelector(false);
  };

  // Handle ending current phase
  const handleEndPhase = async () => {
    await handleNextPhase();
  };

  // Handle objection
  const handleObjection = async (reason: string) => {
    // Pass & play: whoever's turn it currently is objects to the other
    // side's most recent statement (there's no fixed aiRole to key off
    // of, since both sides are the same human on this device).
    const objectorRole: 'prosecution' | 'defense' = sameDevicePlay
      ? ((turnState?.current_turn as 'prosecution' | 'defense') || playerRole)
      : playerRole;
    const targetEvent: TrialEvent | null = sameDevicePlay
      ? (objectorRole === 'prosecution' ? lastDefenseStatementEvent : lastProsecutionStatementEvent)
      : lastProsecutionEvent;

    if (!turnState || !targetEvent) {
      setShowObjectionSelector(false);
      return;
    }

    // Check cooldown (60 seconds)
    const now = Date.now();
    if (turnState.objection_cooldown_until && now < turnState.objection_cooldown_until) {
      const remainingSeconds = Math.ceil((turnState.objection_cooldown_until - now) / 1000);
      void appAlert({ title: 'OBJECTION COOLDOWN', message: `Please wait ${remainingSeconds} more seconds before objecting again.`, tone: 'info' });
      setShowObjectionSelector(false);
      return;
    }

    setIsProcessingObjection(true);
    setShowObjectionSelector(false);
    // The objection is being heard: the questioning counsel's clock stops until they speak again.
    pauseForObjection();

    try {
      const objectionReasonMap: Record<string, string> = {
        leading: 'Leading question',
        hearsay: 'Hearsay',
        speculation: 'Speculation',
        relevance: 'Relevance',
        argumentative: 'Argumentative',
        compound: 'Compound question',
        asked_and_answered: 'Asked and answered',
        other: 'Objection'
      };

      const objectionReason = objectionReasonMap[reason] || 'Objection';

      // Add objection to transcript — only the human objects, so this is
      // always the player's side, whichever role they chose (or, in pass
      // & play, whichever side currently has the device).
      const objectionEvent = await addTrialEvent({
        session_id: session.id,
        event_type: 'objection',
        speaker_role: objectorRole,
        speaker_name: objectorRole === 'prosecution' ? effectiveProsecutorName : effectiveDefenseName,
        content: `Objection: ${objectionReason}`,
        metadata: {
          objection_reason: reason,
          objected_to_event_id: targetEvent.id,
          phase: currentPhase
        },
        event_order: events.length + 1
      });

      setEvents(prev => [...prev, objectionEvent]);

      // Get judge ruling
      const config = getTrialConfig(trialDuration!);
      const phase = config.phases.find(p => p.number === currentPhase);
      const transcriptSummary = buildTranscriptSummary(events);

      const ruling = await generateObjectionRuling({
        objection_by: objectorRole,
        objection_reason: objectionReason,
        questioned_statement: targetEvent.content,
        current_phase: phase?.name || 'Unknown',
        recent_transcript: transcriptSummary,
        difficulty: (session.session_state as any)?.difficulty,
        practiceMode
      });

      // Add ruling to transcript
      const rulingEvent = await addTrialEvent({
        session_id: session.id,
        event_type: 'ruling',
        speaker_role: 'judge',
        speaker_name: judgeName || 'Judge',
        content: `Objection ${ruling.ruling}. ${ruling.reasoning}`,
        metadata: {
          objection_id: objectionEvent.id,
          ruling: ruling.ruling,
          phase: currentPhase
        },
        event_order: events.length + 2
      });

      setEvents(prev => [...prev, objectionEvent, rulingEvent]);

      // Update turn state with cooldown (60 seconds from now)
      const cooldownUntil = now + 60000; // 60 seconds
      setTurnState({
        ...turnState,
        objection_cooldown_until: cooldownUntil
      });

      // Save cooldown to session
      await db.sessions.updateSession(session.id, {
        session_state: {
          ...session.session_state,
          turnState: {
            ...turnState,
            objection_cooldown_until: cooldownUntil
          }
        }
      });

      // Give the ruling a moment to land before the next question.
      ensureQuestionRest(OBJECTION_WINDOW_SECONDS);

      // If sustained, prosecution should rephrase (this will be handled in their next turn)
      if (ruling.ruling === 'sustained') {
        speakAs('judge', `Objection sustained. ${ruling.reasoning}`);
      } else {
        speakAs('judge', `Objection overruled. ${ruling.reasoning}`);
      }
    } catch (error) {
      console.error('Failed to process objection:', error);
      void appAlert({ title: "OBJECTION DIDN'T GO THROUGH", message: 'Please try again.', tone: 'error' });
    } finally {
      setIsProcessingObjection(false);
    }
  };



  // Handle skipping phase


  const handleEndTrial = async () => {
    const endIt = await appConfirm({
      title: 'END THE TRIAL?',
      message: 'This will conclude the case.',
      confirmLabel: 'END TRIAL',
      cancelLabel: 'KEEP GOING',
      tone: 'danger'
    });
    if (!endIt) return;

    try {
      // Ending early is a forfeit for whichever side the human is actually
      // playing — not always "defense". A guilty ('win') outcome means the
      // defense lost, so a defense player forfeiting needs outcome 'win';
      // a prosecution player forfeiting needs outcome 'lose' (not guilty).
      const forfeitOutcome: Verdict['outcome'] = playerRole === 'defense' ? 'win' : 'lose';
      const verdict: Verdict = {
        id: crypto.randomUUID(),
        session_id: session.id,
        outcome: forfeitOutcome,
        reasoning: `Trial ended prematurely. The ${playerRole === 'defense' ? 'defense' : 'prosecution'} forfeits the case.`,
        evidence_cited: [],
        witness_performance: {},
        missed_opportunities: [],
        score: 0,
        delivered_at: new Date().toISOString()
      };

      if (onlineTwoPlayer) {
        // Two players: the result is saved and the game completed, so the other player's screen goes to it at once.
        const saved = await db.verdicts.createVerdict({
          session_id: session.id, outcome: verdict.outcome, reasoning: verdict.reasoning, evidence_cited: [], score: 0
        } as any);
        await db.sessions.updateSession(session.id, { current_phase: 'completed', completed_at: new Date().toISOString() });
        onComplete(saved);
        return;
      }

      // Call onComplete to end the session
      onComplete(verdict);
    } catch (error) {
      console.error('[Courtroom] ❌ Failed to end trial:', error);
      void appAlert({ title: "COULDN'T END THE TRIAL", message: 'Please try again.', tone: 'error' });
    }
  };

  const handleRestPhase = async () => {
    if (!turnState || !aliveRef.current) return;
    // One rest at a time: the phase clock, the countdown and the Rest button can all ask for it together.
    if (restInFlightRef.current) return;
    // An opening or closing statement has to be given first: nothing to rest on yet, so nothing moves.
    const restPhaseInfo = trialDuration ? getTrialConfig(trialDuration).phases.find(p => p.number === currentPhase) : undefined;
    const restStatementSide = statementSideOf(restPhaseInfo);
    if (restStatementSide && !statementGiven(eventsRef.current, restStatementSide, currentPhase)) return;
    restInFlightRef.current = true;

    try {
      // Cancel any pending auto-rest countdown immediately — whichever path
      // triggered this (manual click, phase timeout, or the countdown
      // itself finishing) is about to advance the phase, so there's nothing
      // left to count down toward.
      cancelAutoRestCountdown();

      // Event type by phase, not hardcoded — this used to always tag the
      // "rests" event as 'witness_examination' even during an opening/closing
      // statement phase.
      const config = trialDuration ? getTrialConfig(trialDuration) : null;
      const phaseInfo = config?.phases.find(p => p.number === currentPhase);
      const phaseNameLower = phaseInfo?.name.toLowerCase() || '';

      // Changing counsel in the witness stage: a short break first. The clock is stopped and nobody can
      // send anything, so a question sent in the last second is still answered inside it.
      if (config && !practiceMode && isWitnessPhase(phaseInfo)) {
        const planned = planNextPhase();
        const nextName = planned === 'verdict'
          ? 'the verdict'
          : config.phases.find(p => p.number === planned.nextPhase)?.name ?? 'the next phase';
        await runHandoffBreak(`Up next: ${nextName}`);
        await waitForQuestionAnswer(30000);
        if (!aliveRef.current) return;
      }

      const eventType: EventType = phaseNameLower.includes('closing')
        ? 'closing'
        : phaseNameLower.includes('opening')
        ? 'opening'
        : 'witness_examination';

      const event = await addTrialEvent({
        session_id: session.id,
        event_type: eventType,
        speaker_role: turnState.current_turn === 'prosecution' ? 'prosecution' : 'defense',
        speaker_name: turnState.current_turn === 'prosecution'
          ? effectiveProsecutorName
          : effectiveDefenseName,
        content: `The ${turnState.current_turn === 'prosecution' ? 'prosecution' : 'defense'} rests.`,
        metadata: { phase: currentPhase, rested: true },
        event_order: eventsRef.current.length + 1
      });

      // The mandatory-statement check in handleNextPhase reads this list straight away, before React has
      // re-rendered, so the new "rests" line has to be in it already or the phase could never advance.
      eventsRef.current = [...eventsRef.current, event];
      setEvents(prev => [...prev, event]);

      // An opening or closing statement is read for a fixed minute before anything else happens, like a
      // witness answer is. The clock is stopped and nobody can send anything until it is over.
      if (config && restStatementSide && !practiceMode) {
        await runHandoffBreak(`Reading the ${eventType === 'closing' ? 'closing' : 'opening'} statement`, STATEMENT_READ_SECONDS, true);
        if (!aliveRef.current) return;
      }

      // Whoever was speaking stops: it is no longer their turn.
      stopSpeakingRole('counsel');
      await handleNextPhase();
    } finally {
      restInFlightRef.current = false;
    }
  };
  // Keep the ref used by the auto-rest countdown pointed at the latest
  // handleRestPhase on every render.
  handleRestPhaseRef.current = handleRestPhase;

  // Safety net: if the phase changes through some other path while a
  // countdown is running, don't leave it ticking toward a rest call for a
  // phase that's no longer current.
  useEffect(() => {
    cancelAutoRestCountdown();
  }, [currentPhase]);

  // The jurors who actually vote are the ones chosen in the mandatory jury
  // selection step (6 per side) — there is no other source for a jury trial.
  const loadJurorsForVerdict = async (): Promise<JurorProfile[]> => {
    const selections = await db.jurySelections.getSessionJurySelections(session.id);
    const ids = selections.map(sel => sel.juror_id);
    const rows = await db.jurors.getJurorsByIds(ids);
    return ids
      .map(id => rows.find(r => r.id === id))
      .filter((j): j is NonNullable<typeof j> => !!j) as JurorProfile[];
  };

  // The deliberation is shared: the screen that runs it publishes each step, the other follows it live.
  const publishedDeliberationRef = useRef('');
  useEffect(() => {
    if (!onlineTwoPlayer || !verdictStartedRef.current || !deliberation) return;
    const snapshot = JSON.stringify(deliberation);
    if (snapshot === publishedDeliberationRef.current) return;
    publishedDeliberationRef.current = snapshot;
    db.sessions.mergeState(session.id, { deliberationLive: deliberation }).catch(err => console.error('Failed to share the deliberation:', err));
  }, [deliberation, onlineTwoPlayer]);

  const followingVerdictRef = useRef(false);
  const verdictFollowedRef = useRef(false);
  const seenDeliberationRef = useRef('');
  followVerdictRef.current = (fresh: CaseSession) => {
    if (!onlineTwoPlayer || verdictStartedRef.current || verdictFollowedRef.current) return;
    const st = (fresh.session_state || {}) as Record<string, any>;
    if ((st.verdictStarted || fresh.current_phase === 'completed') && !followingVerdictRef.current) {
      followingVerdictRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      setTimerActive(false);
      cancelAutoRestCountdown();
    }
    if (st.deliberationLive) {
      const snap = JSON.stringify(st.deliberationLive);
      if (snap !== seenDeliberationRef.current) {
        seenDeliberationRef.current = snap;
        setDeliberation(st.deliberationLive as DeliberationState);
      }
    } else if (st.verdictStarted && !seenDeliberationRef.current) {
      seenDeliberationRef.current = 'judge';
      setDeliberation({ mode: 'judge', jurors: [], rounds: [], votingRound: null, stage: 'voting' });
    }
    if (fresh.current_phase === 'completed') {
      verdictFollowedRef.current = true;
      db.verdicts.getSessionVerdict(session.id).then(v => {
        if (!v) { verdictFollowedRef.current = false; return; }
        const jury = !!st.deliberationLive && st.deliberationLive.mode === 'jury';
        if (jury) {
          // Same as the player who ran it: look over the ballots, then on to the verdict.
          setDeliberation(d => (d ? { ...d, votingRound: null, stage: 'done' } : d));
          verdictContinueRef.current = () => { setDeliberation(null); onComplete(v); };
        } else {
          setDeliberation(null);
          onComplete(v);
        }
      }).catch(() => { verdictFollowedRef.current = false; });
    }
  };

  const handleVerdict = async () => {
    // Only ever run once, however many triggers fire (phase end, timers).
    if (verdictStartedRef.current || !aliveRef.current) return;
    verdictStartedRef.current = true;
    // Two players: tell the other screen right away, so both of them watch the deliberation together.
    if (onlineTwoPlayer) db.sessions.mergeState(session.id, { verdictStarted: true }).catch(err => console.error('Failed to announce the verdict:', err));

    // Stop the clocks so nothing auto-advances during deliberation.
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerActive(false);
    cancelAutoRestCountdown();

    try {
      setIsProcessing(true);

      const trialType = session.trial_type || 'judge';
      const submittedEvidence = evidence.filter(e => usedByEither(eventsRef.current).evidence.includes(e.id));
      // What the prosecution asks for: the jury or judge rules on each, and the main request decides the verdict.
      const demands = reliefDemands(caseData?.requested_relief);

      let juryResult: Awaited<ReturnType<typeof generateJuryDeliberation>> | undefined;
      if (trialType === 'jury') {
        const jurors = await loadJurorsForVerdict();
        setDeliberation({
          mode: 'jury',
          jurors: jurors.map(j => ({ id: j.id, name: j.name, occupation: j.occupation || 'Citizen' })),
          rounds: [],
          votingRound: 1,
          stage: 'voting'
        });

        juryResult = await generateJuryDeliberation({
          jurors,
          events: eventsRef.current,
          evidence: submittedEvidence,
          caseTitle: caseData?.title || 'Unknown Case',
          defendantName: caseData?.defendant_name,
          demands,
          onRoundStart: round => setDeliberation(d => (d ? { ...d, votingRound: round, stage: 'voting' } : d)),
          onRoundComplete: round => setDeliberation(d => (d ? { ...d, rounds: [...d.rounds, round], votingRound: null } : d))
        });

        setDeliberation(d => (d ? {
          ...d,
          votingRound: null,
          stage: 'foreperson',
          result: {
            outcome: juryResult!.outcome,
            guiltyVotes: juryResult!.guiltyVotes,
            notGuiltyVotes: juryResult!.notGuiltyVotes,
            unanimous: juryResult!.unanimous
          }
        } : d));

        // Keep the vote record so the verdict screen can show how the jury voted.
        db.sessions.updateSession(session.id, {
          session_state: {
            ...session.session_state,
            juryVotes: juryResult.rounds.map(r => ({
              round: r.round,
              guilty: r.guilty,
              notGuilty: r.notGuilty,
              votes: r.votes.map(v => ({ jurorId: v.jurorId, name: v.name, occupation: v.occupation, vote: v.vote, reason: v.reason, ...(v.demands ? { demands: v.demands } : {}) })),
              ...(r.demandTallies ? { demandTallies: r.demandTallies } : {}),
              guiltyVotes: r.guilty,
              notGuiltyVotes: r.notGuilty
            }))
          }
        }).catch(err => console.error('Failed to save jury votes:', err));
      } else {
        setDeliberation({ mode: 'judge', jurors: [], rounds: [], votingRound: null, stage: 'voting' });
      }

      // Generate verdict based on transcript — for a jury trial the
      // foreperson only explains the vote the jurors actually cast.
      const verdictResult = await generateVerdict(
        eventsRef.current,
        submittedEvidence,
        caseData?.title || 'Unknown Case',
        caseData?.defendant_name,
        trialType as 'judge' | 'jury',
        juryResult,
        descriptionWithRelief(caseData?.description, caseData?.requested_relief),
        demands
      );

      // Keep the ruling on each demand so the verdict screen and any appeal can show it.
      if (verdictResult.demands?.length) {
        db.sessions.mergeState(session.id, { demandResults: verdictResult.demands }).catch(err => console.error('Failed to save the rulings on each demand:', err));
      }

      const verdict = await db.verdicts.createVerdict({
        session_id: session.id,
        outcome: verdictResult.outcome,
        reasoning: verdictResult.reasoning,
        evidence_cited: verdictResult.evidence_cited,
        score: verdictResult.score
      });

      // Mark session as completed
      await db.sessions.updateSession(session.id, {
        current_phase: 'completed',
        completed_at: new Date().toISOString()
      });

      const isJuryTrial = trialType === 'jury';
      const verdictText = verdictResult.outcome === 'win' ? 'guilty' : 'not guilty';
      const announcement = isJuryTrial
        ? `Members of the jury, have you reached a verdict? We have, Your Honor. We the jury find the defendant ${verdictText}.`
        : JUDGE_PROMPTS.verdict.replace('{verdict}', verdictText);
      speakAs('judge', announcement);

      if (isJuryTrial && juryResult) {
        // Let the player look over the ballots before moving to the verdict screen.
        setDeliberation(d => (d ? { ...d, stage: 'done' } : d));
        await new Promise<void>(resolve => { verdictContinueRef.current = resolve; });
      }

      setDeliberation(null);
      onComplete(verdict);
    } catch (error) {
      console.error('Failed to create verdict:', error);
      // Fallback verdict — the AI failed, so there's no real basis to call
      // this a win or a loss for either side. 'partial' keeps it neutral
      // instead of silently favoring whichever side 'lose' maps to.
      const fallbackVerdict = await db.verdicts.createVerdict({
        session_id: session.id,
        outcome: 'partial',
        reasoning: 'The Court was unable to reach a clear verdict due to a technical issue. This result is inconclusive.',
        evidence_cited: [],
        score: 50
      });
      if (onlineTwoPlayer) await db.sessions.updateSession(session.id, { current_phase: 'completed', completed_at: new Date().toISOString() }).catch(() => {});
      setDeliberation(null);
      onComplete(fallbackVerdict);
    } finally {
      setIsProcessing(false);
    }
  };

  // Note: trialDuration and pre-trial are both fully handled upstream by
  // App.tsx before this component ever mounts (handleTrialTypeSelect sets
  // trial_duration before switching to this view; current_phase is always
  // 'trial' by the time view becomes 'courtroom', so showPreTrial's
  // initializer is always false here). Fallback screens for those cases
  // used to live here but were unreachable dead code with a stale,
  // incomplete PreTrialScript call (missing judgeName/prosecutorName) —
  // removed rather than fixed, since there's nothing valid to fix them
  // with at this point in the component.

  // At this point, trialDuration is guaranteed to be set (checked above)
  const trialConfig = getTrialConfig(trialDuration);
  const phase = getPhaseInfo(currentPhase, trialDuration);

  // Pass & play handoff: identifies the current "turn slot" so the
  // overlay reappears every time it changes, and whether this slot has
  // already been acknowledged (device handed to the right player).
  const turnHandoffKey = turnState ? `${currentPhase}-${turnState.current_turn}` : null;
  const pendingHandoff = sameDevicePlay && awaitingUserInput && turnHandoffKey !== null && deviceRevealedFor !== turnHandoffKey;
  // Whether it's actually appropriate for the human at this device to take
  // an action right now — used to disable (not hide) the action buttons
  // rather than letting them silently do nothing, or worse, let a human
  // act on the AI's behalf, when it isn't their turn.
  const isPlayerTurn = (turnState?.current_turn === playerRole) || sameDevicePlay;
  // Evidence can only be submitted while witnesses are called and examined (direct, cross, redirect),
  // never during opening or closing statements: there the Evidence tab is greyed out and does nothing.
  const evidenceAllowed = canSubmitEvidence(phase);
  // Calling a witness is only possible on your own turn, in a direct-examination phase, with nobody on the
  // stand. During cross-examination or redirect the other side is still questioning, so the list stays locked.
  // After a granted appeal the earlier trial folds into an accordion; only the appeal hearing stays in view.
  const appealSplit = (() => {
    let at = -1;
    for (let i = events.length - 1; i >= 0; i--) if (events[i].metadata?.appeal_marker) { at = i; break; }
    if (at < 0) return { earlier: [] as typeof events, marker: null as (typeof events)[number] | null, current: events };
    return { earlier: events.slice(0, at), marker: events[at], current: events.slice(at + 1) };
  })();
  const witnessCallAllowed = !!turnState && turnState.current_phase_type === 'direct' && !turnState.current_witness_id && isPlayerTurn && !timerPaused;
  const activeModalTab: 'witnesses' | 'evidence' = evidenceAllowed ? defenceModalTab : 'witnesses';

  // Witness examination (direct/cross/redirect) with a witness on the
  // stand: the examiner's text box stays open for as many questions as
  // they want until they Rest or the phase clock runs out. It is derived
  // from the actual conditions rather than relying solely on the
  // awaitingUserInput flag, and it is NOT locked while a witness answer is
  // being generated (only Submit is) — locking it blurred the field and
  // looked like the box had gone inactive after a single question.
  const inWitnessExam = !!turnState?.current_witness_id &&
    (turnState.current_phase_type === 'direct' || turnState.current_phase_type === 'cross' || turnState.current_phase_type === 'redirect');
  const phaseClockLeft = phaseTimeRemaining[currentPhase];
  const clockRunning = practiceMode || phaseClockLeft === undefined || phaseClockLeft > 0;
  // An opening or closing statement is due: the clock stands still at zero until the speaker has sent anything.
  const uiPhaseInfo = trialDuration ? getTrialConfig(trialDuration).phases.find(p => p.number === currentPhase) : undefined;
  const statementSide = statementSideOf(uiPhaseInfo);
  const statementDone = !!statementSide && statementGiven(events, statementSide, currentPhase);
  const waitingForStatement = !!statementSide && !statementDone && !practiceMode && phaseClockLeft !== undefined && phaseClockLeft <= 0;
  waitingForStatementRef.current = waitingForStatement;
  const handoffActive = handoff !== null;
  // The wait between questions: no question cap, but after each answer the examiner rests a few seconds.
  const restBlocked = inWitnessExam && questionRestLeft !== null;
  const restLabel = inWitnessExam ? questionRestLabel(questionRestLeft) : null;
  // Paused: the box stays open so a player can keep drafting, but nothing can be sent or called.
  const actionsPaused = timerPaused;
  // Sending only works on your own turn: during witness examination the box closes the moment the turn
  // (or the clock) is over, and during the break between counsel.
  const inputOpen = (awaitingUserInput || (inWitnessExam && isPlayerTurn && !judgeInstructionPending && clockRunning)) && !pendingHandoff &&
    !handoffActive && !(inWitnessExam && (!isPlayerTurn || !clockRunning));

  // Put the cursor back in the box after each question finishes so the
  // next one can be typed straight away (the keyboard stays up on mobile).
  useEffect(() => {
    if (!isProcessing && inWitnessExam && isPlayerTurn && inputOpen) {
      inputRef.current?.focus();
    }
  }, [isProcessing, inWitnessExam, isPlayerTurn, inputOpen]);

  // Virtual courtroom extras (only drawn by the 'virtual' scene).
  const stageScene = useMemo(() => pickStageScene(), []); // 3D courtroom where WebGL works, else avatars
  const [seatedJurorIds, setSeatedJurorIds] = useState<string[]>([]);
  useEffect(() => {
    if (stageScene !== 'virtual' && stageScene !== 'court3d') return;
    let cancelled = false;
    db.jurySelections
      .getSessionJurySelections(session.id)
      .then(rows => { if (!cancelled) setSeatedJurorIds(rows.map(r => r.juror_id)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [stageScene, session.id]);
  const stageWitnessName: string | null = inWitnessExam ? (turnState?.current_witness_name || null) : null;
  const stageJurorVotes = useMemo(() => {
    const last = deliberation?.rounds?.[deliberation.rounds.length - 1];
    if (!last) return undefined;
    return Object.fromEntries(last.votes.map(v => [v.jurorId, v.vote])) as Record<string, 'GUILTY' | 'NOT_GUILTY'>;
  }, [deliberation]);

  // The trial's turn-by-turn switch, used by both the stage glow and the turn badge.
  const stageFloor = getTrialFloor({
    phaseName: phase?.name,
    currentTurn: turnState?.current_turn,
    judgeSpeaking: judgeInstructionPending
  });
  const turnBadge = describeTurn({ floor: stageFloor, playerRole, sameDevicePlay });
  const keyboardOpen = useKeyboardOpen();
  useLockPageScroll(); // the page never scrolls or pans: only the chat panel does, so the header stays put
  // The input bar's real height, so the chat panel can stretch down to it with no dead space.
  const [inputBarRef, inputBarHeight] = useElementHeight<HTMLDivElement>();
  const chatPanelRef = useRef<HTMLDivElement>(null);
  // Leaving the trial screen (back, another screen, closing the tab) stops the trial right there:
  // timers, the auto-rest countdown and the voice all stop, a paused snapshot is saved, and
  // anything still in flight (an AI turn, a countdown) sees the player is gone and does nothing.
  const aliveRef = useTrialLifecycle({
    active: !showPreTrial && !practiceMode && !!trialDuration && timerActive && !verdictStartedRef.current,
    buildSave: () => buildLeaveSave({ currentPhase, phaseTimeRemaining, totalTimeRemaining, sessionState: session.session_state as any }),
    persist: payload => { db.sessions.updateSession(session.id, payload as any).catch(err => console.error('Failed to save paused trial:', err)); },
    teardown: () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoRestTimerRef.current) clearInterval(autoRestTimerRef.current);
      if (questionRestTimerRef.current) clearInterval(questionRestTimerRef.current);
      if (answerHoldTimerRef.current) clearTimeout(answerHoldTimerRef.current);
      stopSpeaking('discard');
    }
  });
  // Voice is only allowed here and in the pre-trial; leaving the trial stops it at once.
  useEffect(() => enterSpeechScope(), []);

  // Counsel's text is only read out while it is counsel's turn. The moment it stops being: the judge
  // takes the floor (instruction, ruling, verdict), the phase moves on, or the other side starts, the
  // voice stops. The witness's answer is cut with the phase too, so it never runs into the next one.
  const counselTurn =
    !!turnState && (turnState.current_turn === 'prosecution' || turnState.current_turn === 'defense') && !judgeInstructionPending;
  useEffect(() => {
    if (!counselTurn) stopSpeakingRole('counsel');
  }, [counselTurn]);
  useEffect(() => {
    stopSpeakingRole('counsel');
    stopSpeakingRole('witness');
    releaseAnswerHold();
    // A new phase or turn: no leftover wait between questions, and no leftover objection pause.
    clearQuestionRest();
    resumeFromObjection();
  }, [currentPhase, turnState?.current_turn]);

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#0b0d14] flex flex-col">
      <SceneBackdrop />
      {/* Fixed Header - Non-scrolling */}
      <div className="fixed top-0 left-0 right-0 bg-black/70 backdrop-blur-md border-b border-white/10 z-50 w-full" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="w-full max-w-[1800px] mx-auto px-3 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button onClick={onBack} aria-label="Back" className={ICON_BUTTON}>
                <ArrowLeft className="w-5 h-5" />
              </button>
               <div className="min-w-0">
                 <h1 className="hidden sm:block logo-gold font-game text-3xl leading-none truncate">{phase?.name || 'COURTROOM'}</h1>
                 {practiceMode
                   ? <p className="text-[#FFD43B] text-sm font-semibold sm:mt-1">Practice Mode — no time limit</p>
                   : timerActive && <p className="text-white text-base font-semibold tabular-nums sm:text-sm sm:font-normal sm:text-white/70 sm:mt-1 whitespace-nowrap">{formatTime(totalTimeRemaining)} remaining</p>}
               </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
               <SpeechToggle />
               <button
                 onClick={handleEndTrial}
                 className="flex items-center gap-2 h-10 px-3 sm:px-4 rounded-full bg-[#E5484D] text-white font-semibold text-sm transition-colors active:bg-[#c93a3f]"
                 title="End Trial"
               >
                 <RotateCcw className="w-4 h-4" />
                 <span className="hidden sm:inline">End Trial</span>
               </button>
              <button
                onClick={() => setShowVideoDisplay(v => !v)}
                className="flex items-center gap-2 h-10 px-3 sm:px-4 rounded-full bg-black/55 border border-white/15 text-white text-sm transition-colors active:bg-white/15"
                title={showVideoDisplay ? 'Hide avatars' : 'Show avatars'}
                aria-label={showVideoDisplay ? 'Hide avatars' : 'Show avatars'}
                aria-pressed={showVideoDisplay}
                data-testid="scene-toggle"
              >
                <Landmark className="w-4 h-4" />
                <span className="hidden sm:inline">Courtroom</span>
              </button>
               {timerActive && (
                 <button
                   onClick={togglePause}
                   aria-label={timerPaused ? 'Resume' : 'Pause'}
                   className="flex items-center gap-2 h-10 px-3 sm:px-4 rounded-full bg-[#FFD43B] text-black font-semibold text-sm transition-colors active:bg-[#e6bd2c]"
                 >
                   {timerPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    <span className="hidden sm:inline">{timerPaused ? (pausedForDefense ? 'Start' : 'Resume') : 'Pause'}</span>
                 </button>
               )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area - Padding to account for fixed header (header is ~90px tall) */}
      <div className="relative z-10 flex-1 min-h-0 px-3 sm:px-6 overflow-y-auto" style={{ paddingTop: 'calc(84px + env(safe-area-inset-top))', paddingBottom: `${(inputBarHeight || 200) + 8}px` }}>
        <div className="max-w-[1800px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="hidden lg:block lg:col-span-1">
            {trialConfig && <TrialOutline
              currentPhase={currentPhase}
              trialConfig={trialConfig}
              phaseTimeRemaining={phaseTimeRemaining}
              timerActive={timerActive}
              totalTimeRemaining={totalTimeRemaining}
              practiceMode={practiceMode}
              events={events}
              prosecutorName={prosecutorName || 'Prosecution'}
              defenseName="Defense"
            />}
          </div>

          <div className="lg:col-span-3">
            <div
              ref={chatPanelRef}
              className={`relative ${PANEL_SOFT} flex flex-col overflow-hidden min-h-[16rem]`}
              style={{ height: `calc(100dvh - (84px + env(safe-area-inset-top)) - ${(inputBarHeight || 200) + 16}px)` }}
            >
              {/* Avatar stage - Conditionally Rendered */}
              {showVideoDisplay && (
                <div className="relative flex-shrink-0">
                  <TrialStage
                    currentSpeaker={currentSpeaker}
                    lastRole={events[events.length - 1]?.speaker_role}
                    lastEventKey={events[events.length - 1]?.id}
                    floor={stageFloor}
                    phaseName={phase?.name}
                    playerRole={playerRole}
                    turn={turnBadge}
                    compact={keyboardOpen}
                    scene={stageScene}
                    witness={stageWitnessName ? { name: stageWitnessName, avatar: witnessAvatar(stageWitnessName) } : undefined}
                    jurors={deliberation?.jurors?.length ? deliberation.jurors.map(j => ({ id: j.id, name: j.name })) : seatedJurorIds.map(id => ({ id }))}
                    jurorVotes={stageJurorVotes}
                    judge={{ name: judgeName || 'Judge', avatar: cast.judge, rank: 6 }}
                    prosecution={{ name: stageProsecutorName, avatar: cast.prosecution, rank: prosecutionRank }}
                    defense={{ name: stageDefenseName, avatar: cast.defense, rank: defenseRank }}
                  />
                </div>
              )}

              {/* Transcript/Conversation Area - Expanded when video is hidden */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-5 pb-20 space-y-3 min-h-0 border-t border-white/10">
                {appealSplit.earlier.length > 0 && (
                  <details className="group rounded-xl border border-white/15 bg-black/30">
                    <summary className="cursor-pointer select-none list-none flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-white/80">
                      <span>Earlier trial transcript ({appealSplit.earlier.length} lines)</span>
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-3 p-3 pt-1">
                      {appealSplit.earlier.map((event) => (
                        <TranscriptMessage
                          key={event.id}
                          event={event}
                          avatars={cast}
                          prosecutorName={stageProsecutorName}
                          playerRole={playerRole}
                        />
                      ))}
                    </div>
                  </details>
                )}
                {appealSplit.marker && (
                  <div className="rounded-xl border border-[#FFD43B]/50 bg-[#FFD43B]/10 px-3 py-2 text-center font-game text-lg tracking-wide text-[#FFD43B]">
                    Appeal in session{appealSplit.marker.metadata?.appeal_round ? ` (appeal ${appealSplit.marker.metadata.appeal_round})` : ''}
                  </div>
                )}
                {appealSplit.current.map((event) => (
                  <TranscriptMessage
                    key={event.id}
                    event={event}
                    avatars={cast}
                    prosecutorName={stageProsecutorName}
                    playerRole={playerRole}
                  />
                ))}
              </div>

              {/* Witnesses & evidence button: lives over the chat text, bottom-right of the panel.
                  Still draggable up and down within the panel. */}
              {turnState && turnState.current_turn !== 'judge' && (
                <button
                  onClick={handleFloatingButtonClick}
                  onPointerDown={handleFloatingButtonPointerDown}
                  onPointerMove={handleFloatingButtonPointerMove}
                  onPointerUp={handleFloatingButtonPointerUp}
                  onPointerCancel={handleFloatingButtonPointerUp}
                  style={{ bottom: `${12 + floatingButtonOffset}px`, touchAction: 'none' }}
                  className="absolute right-3 w-12 h-12 bg-[#FFD43B] active:bg-[#e6bd2c] text-black rounded-full shadow-[0_3px_0_#B8860B,0_6px_14px_rgba(0,0,0,0.5)] flex items-center justify-center transition-colors z-20 cursor-grab active:cursor-grabbing select-none"
                  title="Witnesses & Evidence (drag to move)"
                  aria-label="Witnesses and evidence"
                >
                  <Scale className="w-5 h-5" />
                </button>
              )}

              {/* Status chips: small, tucked into the bottom-left corner so they never cover the
                  text. Kept clear of the button on the right. The label and wording reflect the
                  side the AI is actually playing (aiRole) and the kind of phase it is in. */}
              <div className="absolute bottom-3 left-3 right-[4.5rem] z-10 pointer-events-none flex flex-col items-start gap-2">
              {isProsecutionThinking && (
                <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/80 backdrop-blur-md shadow-lg pl-2.5 pr-3 py-1.5 text-white/85">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#FFD43B] border-t-transparent flex-none"></div>
                  <span className="text-xs sm:text-sm leading-tight">
                    {aiRole === 'prosecution' ? 'Prosecution' : 'Defense'} is {(() => {
                      const phaseNameLower = trialDuration
                        ? (getTrialConfig(trialDuration).phases.find(p => p.number === currentPhase)?.name.toLowerCase() || '')
                        : '';
                      if (phaseNameLower.includes('opening')) return 'preparing its opening…';
                      if (phaseNameLower.includes('closing')) return 'preparing its closing…';
                      return 'deciding its next move…';
                    })()}
                  </span>
                </div>
              )}

              {!isProsecutionThinking && autoRestSecondsLeft !== null && (
                <AutoRestChip
                  side={aiRole === 'prosecution' ? 'prosecution' : 'defense'}
                  timeLabel={formatTime(autoRestSecondsLeft)}
                  paused={autoRestPaused}
                  onTogglePause={toggleAutoRestPause}
                  onRestNow={() => { cancelAutoRestCountdown(); void handleRestPhaseRef.current(); }}
                />
              )}

              {restLabel && (
                <div className="rounded-full border border-white/15 bg-black/80 backdrop-blur-md shadow-lg px-3 py-1.5 text-xs sm:text-sm text-white/85 tabular-nums">
                  {restLabel}
                </div>
              )}

              {handoff && (
                <div className="rounded-full border border-white/15 bg-black/80 backdrop-blur-md shadow-lg px-3 py-1.5 text-xs sm:text-sm text-white/85 tabular-nums">
                  {handoff.label} · {formatTime(handoff.secondsLeft)}
                  {handoff.skippable && (
                    <button
                      type="button"
                      onClick={() => { handoffSkipRef.current = true; }}
                      className="ml-2 rounded-full bg-[#FFD43B] px-2.5 py-0.5 text-[11px] font-black text-black"
                    >
                      SKIP
                    </button>
                  )}
                </div>
              )}

              {waitingForStatement && (
                <div className="rounded-full border border-amber-400/40 bg-black/80 backdrop-blur-md shadow-lg px-3 py-1.5 text-xs sm:text-sm text-amber-200">
                  {statementSide === playerRole || sameDevicePlay
                    ? 'Time is up. Send your statement to continue.'
                    : onlineTwoPlayer
                      ? 'Waiting for opponent…'
                      : "Waiting for opposing counsel's statement…"}
                </div>
              )}

              {onlineTwoPlayer && (() => {
                const otherName = playerRole === 'prosecution' ? effectiveDefenseName : effectiveProsecutorName;
                const line = activityLine(otherName, currentActivity(opponentWatch, nowTick));
                return line ? (
                  <div role="status" className="rounded-full border border-white/20 bg-black/80 backdrop-blur-md shadow-lg px-3 py-1.5 text-xs sm:text-sm text-white/90 animate-pulse">
                    {line}
                  </div>
                ) : null;
              })()}

              {objectionPaused && (
                <div className="rounded-full border border-red-400/40 bg-black/80 backdrop-blur-md shadow-lg px-3 py-1.5 text-xs sm:text-sm text-red-200">
                  Objection — clock paused until counsel speaks
                </div>
              )}

              {!isMultiplayer && !isProsecutionThinking && autoRestSecondsLeft === null && !restLabel && !sameDevicePlay && turnState?.current_turn === aiRole && (
                <div className="rounded-full border border-white/15 bg-black/80 backdrop-blur-md shadow-lg px-3 py-1.5 text-xs sm:text-sm text-white/85">
                  Waiting for {aiRole === 'prosecution' ? 'prosecution' : 'the defense'}…
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      {deliberation && (
        <JuryDeliberation
          state={deliberation}
          judge={{ name: judgeName || 'Judge', avatar: cast.judge, rank: 6 }}
          onContinue={() => { verdictContinueRef.current?.(); verdictContinueRef.current = null; }}
        />
      )}

      {pendingHandoff && turnState && (
        <ModalSheet
          title="PASS THE DEVICE"
          icon={turnState.current_turn === 'prosecution'
            ? <Gavel className="w-6 h-6 text-[#E5484D]" />
            : <Shield className="w-6 h-6 text-[#FFD43B]" />}
          maxWidth="max-w-md"
        >
          <p className="text-white/70 text-sm mb-5">
            It's the {turnState.current_turn === 'prosecution' ? 'Prosecution' : 'Defense'} player's turn. Hand over the device, then tap below when you're ready.
          </p>
          <button
            onClick={() => turnHandoffKey && setDeviceRevealedFor(turnHandoffKey)}
            className={`${gameButton(turnState.current_turn === 'prosecution' ? 'danger' : 'gold')} w-full`}
          >
            I'm the {turnState.current_turn === 'prosecution' ? 'Prosecution' : 'Defense'} player — ready
          </button>
        </ModalSheet>
      )}

               {/* Fixed Bottom Input Bar - Static, doesn't scroll - MUST be at bottom */}
               <div ref={inputBarRef} className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md border-t border-white/10 p-3 sm:p-4 z-40 shadow-lg w-full" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                 <div className="w-full max-w-[1800px] mx-auto">
                   <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                     <div className="relative w-full sm:flex-1">
                       <textarea
                         ref={inputRef}
                         value={input}
                         onChange={(e) => setInput(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter' && !e.shiftKey) {
                             e.preventDefault();
                             handleSubmit();
                           }
                         }}
                         placeholder={
                           restLabel
                             ? `${restLabel}… (you can draft it now)`
                             : turnState?.current_phase_type === 'direct' || turnState?.current_phase_type === 'cross'
                             ? "Ask a question to the witness... (Shift+Enter for a new line)"
                             : "Type your statement or question... (Shift+Enter for a new line)"
                         }
                         disabled={!inputOpen}
                         rows={2}
                         className="w-full px-4 py-3 pr-12 bg-black/50 border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-[#FFD43B] disabled:opacity-50 text-base resize-y min-h-[3rem] max-h-40"
                       />
                       {speechSupported && (
                         <button
                           type="button"
                           onClick={() => isListening ? stopListening() : startListening()}
                           disabled={isProcessing || !inputOpen}
                           title={isListening ? 'Stop recording' : 'Speak your statement'}
                           className={`absolute right-2 top-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                             isListening ? 'bg-[#E5484D] animate-pulse' : 'bg-white/15 active:bg-white/25'
                           }`}
                         >
                           <Mic className="w-4 h-4 text-white" />
                         </button>
                       )}
                     </div>
                     <div className="flex gap-2 flex-wrap">
                       <button
                         onClick={handleSubmit}
                         disabled={!input.trim() || isProcessing || !inputOpen || actionsPaused || restBlocked}
                         className={`flex-1 sm:flex-none ${gameButton('gold', 'sm')}`}
                       >
                         <Send className="w-5 h-5" />
                         Submit
                       </button>
                        <button
                           onClick={handleRestPhase}
                           disabled={!isPlayerTurn || actionsPaused || handoffActive || (!!statementSide && !statementDone)}
                           className={`flex-1 sm:flex-none ${gameButton('ghost', 'sm')}`}
                         >
                           <SkipForward className="w-5 h-5" />
                           Rest
                         </button>
                       {turnState?.current_turn !== 'judge' && (
                         <button
                           onClick={() => setShowObjectionSelector(true)}
                           disabled={isProcessingObjection || (isPlayerTurn && !sameDevicePlay) || actionsPaused}
                           title={isPlayerTurn && !sameDevicePlay ? "You can't object during your own turn" : "Object"}
                           className={`flex-1 sm:flex-none ${gameButton('danger', 'sm')}`}
                         >
                           <AlertCircle className="w-5 h-5" />
                           Object
                         </button>
                       )}
                       {turnState && (turnState.current_phase_type === 'direct' || turnState.current_phase_type === 'cross' || turnState.current_phase_type === 'redirect') && !turnState.current_witness_id && (
                         <button
                           onClick={() => setShowWitnessSelector(true)}
                           disabled={!witnessCallAllowed}
                           title={witnessCallAllowed ? 'Call Witness' : "You can only call a witness on your own turn, during direct examination"}
                           className={`flex-1 sm:flex-none ${gameButton('outline', 'sm')}`}
                         >
                           <User className="w-4 h-4" />
                           Call Witness
                         </button>
                       )}
                     </div>
                   </div>
                 </div>
               </div>

      {/* Witness Selector Modal */}
      {showWitnessSelector && (
        <WitnessSelector
          witnesses={witnesses}
          witnessesCalled={turnState?.witnesses_called || []}
          onSelect={handleCallWitness}
          disabled={!witnessCallAllowed}
          onSkip={handleRestPhase}
          onClose={() => setShowWitnessSelector(false)}
        />
      )}

      {/* Evidence Selector Modal */}
      {showEvidenceSelector && evidenceAllowed && (
        <EvidenceSelector
          evidence={evidence}
          evidenceSubmitted={turnState?.evidence_submitted || []}
          onSelect={handleSubmitEvidence}
          onClose={() => setShowEvidenceSelector(false)}
        />
      )}

      {/* Objection Selector Modal */}
      {showObjectionSelector && (
        <ObjectionSelector
          onSelect={handleObjection}
          onClose={() => setShowObjectionSelector(false)}
        />
      )}

      {/* Defence Actions Modal */}
      {showDefenceModal && (
        <ModalSheet title="DEFENCE ACTIONS" onClose={() => setShowDefenceModal(false)}>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setDefenceModalTab('witnesses')}
              className={`${gameButton(activeModalTab === 'witnesses' ? 'gold' : 'ghost', 'sm')} flex-1`}
            >
              <User className="w-4 h-4" /> Witnesses
            </button>
            <button
              onClick={() => { if (evidenceAllowed) setDefenceModalTab('evidence'); }}
              disabled={!evidenceAllowed}
              title={evidenceAllowed ? undefined : 'Evidence can only be submitted while witnesses are being called and examined'}
              className={`${gameButton(activeModalTab === 'evidence' ? 'gold' : 'ghost', 'sm')} flex-1`}
            >
              <FileText className="w-4 h-4" /> Evidence
            </button>
          </div>

          {activeModalTab === 'witnesses' && (
            <div className="space-y-3">
              {witnesses.filter(w => !turnState?.witnesses_called.includes(w.id)).length === 0 ? (
                <p className="text-white/60 text-center py-8">All witnesses have been called.</p>
              ) : (
                witnesses.filter(w => !turnState?.witnesses_called.includes(w.id)).map((witness) => (
                  <button
                    key={witness.id}
                    onClick={() => {
                      handleCallWitness(witness);
                      setShowDefenceModal(false);
                    }}
                    className={`${CHOICE_ROW} disabled:opacity-50 disabled:cursor-not-allowed`}
                    disabled={!witnessCallAllowed}
                  >
                    <div className="font-semibold text-white">{witness.name}</div>
                    <div className="text-sm text-white/60 mt-1">{witness.role}</div>
                    {witness.background && (
                      <div className="text-xs text-white/45 mt-2 line-clamp-2">{witness.background}</div>
                    )}
                  </button>
                ))
              )}
              {!isWitnessPhase(phase) && (
                <p className="text-center py-2 text-white/55 text-sm">
                  Witness calling is only available during witness examination phases.
                </p>
              )}
              {turnState?.current_witness_id !== null && (
                <p className="text-center py-2 text-white/55 text-sm">
                  A witness is currently being examined. Rest first to call a new witness.
                </p>
              )}
              {isWitnessPhase(phase) && turnState?.current_phase_type !== 'direct' && (
                <p className="text-center py-2 text-white/55 text-sm">
                  Witnesses can only be called during direct examination, not during cross-examination or redirect.
                </p>
              )}
              {!isPlayerTurn && (
                <p className="text-center py-2 text-white/55 text-sm">
                  It isn't your turn to call a witness right now.
                </p>
              )}
            </div>
          )}

          {activeModalTab === 'evidence' && (
            <div className="space-y-3">
              {evidence.filter(e => !turnState?.evidence_submitted.includes(e.id)).length === 0 ? (
                <p className="text-white/60 text-center py-8">All evidence has been submitted.</p>
              ) : (
                evidence.filter(e => !turnState?.evidence_submitted.includes(e.id)).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      handleSubmitEvidence(item);
                      setShowDefenceModal(false);
                    }}
                    disabled={!isPlayerTurn || !evidenceAllowed}
                    className={`${CHOICE_ROW} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="font-semibold text-white">{item.title}</div>
                    <div className="text-sm text-white/60 mt-1">{item.evidence_type.replace('_', ' ')}</div>
                    {item.description && (
                      <div className="text-xs text-white/45 mt-2 line-clamp-2">{item.description}</div>
                    )}
                  </button>
                ))
              )}
              {!isPlayerTurn && evidence.filter(e => !turnState?.evidence_submitted.includes(e.id)).length > 0 && (
                <p className="text-center py-2 text-white/55 text-sm">
                  It isn't your turn to submit evidence right now.
                </p>
              )}
            </div>
          )}
        </ModalSheet>
      )}
    </div>
  );
}
