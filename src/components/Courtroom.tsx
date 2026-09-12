import { useState, useEffect, useRef } from 'react';
import { Scale, Send, ArrowLeft, Pause, Play, FileText, User, SkipForward, AlertCircle, Video, VideoOff, RotateCcw, X, Mic, Sparkles, Gavel, Shield } from 'lucide-react';
import { db } from '../lib/database';
import { useAuth } from '../contexts/AuthContext';
import TrialOutline from './TrialOutline';
import TrialVideoDisplay from './TrialVideoDisplay';
import WitnessSelector from './WitnessSelector';
import EvidenceSelector from './EvidenceSelector';
import ObjectionSelector from './ObjectionSelector';
import { getTrialConfig, BAILIFF_PROMPTS, JUDGE_PROMPTS, getPhaseInfo, getRandomJudgeName, getRandomProsecutorName, formatTime } from '../lib/trialConfig';
import {
  getAllowedActions,
  initializeTurnState,
  isWitnessPhase,
  getExaminationType,
  type TurnState
} from '../lib/trialTurnSystem';
import { generateProsecutionAction, buildTranscriptSummary, generateProsecutionOpeningStatement, generateObjectionRuling, generateWitnessResponse, generateVerdict } from '../lib/ai/trialAI';
import type { VerdictResult } from '../lib/ai/trialAI';
import { getJudgeInstructionForPhase, requiresJudgeInstruction, extractWitnessNumber } from '../lib/judgeInstructions';
import { getUserDisplayName } from '../lib/userName';
import { useSpeechRecognition } from '../lib/useSpeechRecognition';
import { speakAs } from '../lib/speech';
import type { CaseSession, Evidence, Witness, TrialEvent, Verdict, TrialDuration, TrialType, Case } from '../types';

interface CourtroomProps {
  session: CaseSession;
  onComplete: (verdict: Verdict) => void;
  onBack: () => void;
}

export default function Courtroom({ session, onComplete, onBack }: CourtroomProps) {
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
  const effectiveProsecutorName = playerRole === 'prosecution' ? humanDisplayName : (prosecutorName || 'Prosecution');
  const effectiveDefenseName = playerRole === 'defense' ? humanDisplayName : 'Defense Counsel';
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
  const [events, setEvents] = useState<TrialEvent[]>([]);
  // Mirrors `events` for callbacks that resolve well after the render
  // they were scheduled in (e.g. TTS's onend firing seconds later) — a
  // closure over `events` state directly would still see whatever it
  // was at schedule-time, which is stale by then. handleNextPhase's
  // mandatory-statement gate reads from this instead of `events`
  // directly so it always sees the statement that was just saved.
  const eventsRef = useRef<TrialEvent[]>([]);
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
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
   const [timerActive, setTimerActive] = useState(false);
   const [timerPaused, setTimerPaused] = useState(false);
   const [pausedForDefense, setPausedForDefense] = useState(false);
   const [phaseTimeRemaining, setPhaseTimeRemaining] = useState<Record<number, number>>(() => {
     // Load from session if available
     const saved = (session.session_state as any)?.phaseTimeRemaining;
     return saved || {};
   });
   const [totalTimeRemaining, setTotalTimeRemaining] = useState(() => {
     // Load from session if available
     const saved = (session.session_state as any)?.totalTimeRemaining;
     return saved || 0;
   });
  const [currentSpeaker, setCurrentSpeaker] = useState<'judge' | 'prosecution' | 'defense' | 'witness' | 'jury'>('judge');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Turn-based system state
  const [turnState, setTurnState] = useState<TurnState | null>(null);
   const [showWitnessSelector, setShowWitnessSelector] = useState(false);
   const [showEvidenceSelector, setShowEvidenceSelector] = useState(false);
   const [showObjectionSelector, setShowObjectionSelector] = useState(false);
   const [showDefenceModal, setShowDefenceModal] = useState(false);
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
   const [showVideoDisplay, setShowVideoDisplay] = useState(true); // Video display on by default
   const [showRealVoiceInfo, setShowRealVoiceInfo] = useState(false);
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
        setTotalTimeRemaining(trialDuration * 60);
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
      console.log('[Courtroom] Time ran out for phase', currentPhase, '- auto-advancing');
      handleNextPhase();
    }
  }, [phaseTimeRemaining, currentPhase, timerActive, timerPaused, trialDuration, showPreTrial, practiceMode]);

  // Force verdict when total time runs out
  useEffect(() => {
    if (showPreTrial || practiceMode) return;
    if (trialDuration && totalTimeRemaining <= 0 && timerActive && !timerPaused) {
      console.log('[Courtroom] Total trial time ran out - forcing verdict');
      handleVerdict();
    }
  }, [totalTimeRemaining, timerActive, timerPaused, trialDuration, showPreTrial, practiceMode]);

  // Save progress whenever trial phase changes
  useEffect(() => {
    if (showPreTrial) return;
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
  useEffect(() => {
    if (!isMultiplayer || showPreTrial) return;

    const syncInterval = setInterval(async () => {
      try {
        const [freshEvents, freshSession] = await Promise.all([
          db.trialEvents.getSessionEvents(session.id),
          db.sessions.getSession(session.id)
        ]);

        setEvents(prev => {
          const knownIds = new Set(prev.map(e => e.id));
          const newOnes = freshEvents.filter(e => !knownIds.has(e.id));
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
        });

        if (freshSession?.current_trial_phase && freshSession.current_trial_phase !== currentPhase) {
          setCurrentPhase(freshSession.current_trial_phase);
        }
      } catch (error) {
        console.error('[Courtroom] Multiplayer sync failed:', error);
      }
    }, 3000);

    return () => clearInterval(syncInterval);
  }, [isMultiplayer, showPreTrial, session.id, currentPhase]);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (timerPaused || !trialDuration) return;

    setTimerActive(true);
    timerRef.current = setInterval(() => {
      setPhaseTimeRemaining((prev: Record<number, number>) => {
        const updated = { ...prev };
        if (updated[currentPhase] !== undefined && updated[currentPhase] > 0) {
          updated[currentPhase] -= 1;
        }
        return updated;
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

     // Save progress when pausing
     try {
       await db.sessions.updateSession(session.id, {
         current_phase: 'trial',
         current_trial_phase: currentPhase,
         timer_paused_at: newPausedState ? new Date().toISOString() : undefined,
         session_state: {
           ...session.session_state,
           phaseTimeRemaining
         }
       });
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

    try {
      const event = await db.trialEvents.addEvent({
        session_id: session.id,
        event_type: 'opening',
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

  const handleSubmit = async () => {
    if (!input.trim() || !turnState || !awaitingUserInput) return;

    setIsProcessing(true);
    try {
      // If we're in a witness examination phase, treat input as a question
      if (turnState.current_witness_id && (turnState.current_phase_type === 'direct' || turnState.current_phase_type === 'cross' || turnState.current_phase_type === 'redirect')) {
        await handleAskQuestion(input, turnState.current_witness_id);
      } else {
        // Otherwise, treat as a statement
        await addEvent('counsel', input);
      }
      setInput('');
      setAwaitingUserInput(false);
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNextPhase = async () => {
    if (!trialDuration) return;

    // Opening AND closing statements are mandatory: don't let the timer
    // (or any other trigger) advance past a statement phase until that
    // side has actually given their statement. Matched by phase name
    // rather than a hardcoded phase number, since closing phases are
    // renumbered dynamically based on trial length (unlike opening,
    // which is always 7/8) — this previously only covered opening,
    // which let closing arguments be skipped entirely.
    const config = getTrialConfig(trialDuration);
    const currentPhaseInfo = config.phases.find(p => p.number === currentPhase);
    const phaseNameLower = currentPhaseInfo?.name.toLowerCase() || '';
    const isStatementPhase = phaseNameLower.includes('opening') || phaseNameLower.includes('closing');
    const statementSpeaker: 'prosecution' | 'defense' | null = phaseNameLower.includes('prosecution')
      ? 'prosecution'
      : phaseNameLower.includes('defense')
      ? 'defense'
      : null;

    if (isStatementPhase && statementSpeaker && !eventsRef.current.some(e => e.speaker_role === statementSpeaker && (e.metadata as any)?.phase === currentPhase)) {
      console.log(`[Courtroom] Blocked advance from phase ${currentPhase} (${currentPhaseInfo?.name}) — ${statementSpeaker} has not given their statement yet`);
      return;
    }

    const verdictPhase = config.phases.find(p => p.name === 'Verdict Delivery');
    const nextPhase = currentPhase + 1;

    // Check if next phase is verdict or beyond the last phase
    if (verdictPhase && nextPhase >= verdictPhase.number) {
      await handleVerdict();
      return;
    }

    // Check if we've reached the end of all phases
    const lastPhase = config.phases[config.phases.length - 1];
    if (nextPhase > lastPhase.number) {
      await handleVerdict();
      return;
    }

    setCurrentPhase(nextPhase);
    await db.sessions.updateSession(session.id, {
      current_trial_phase: nextPhase
    });

    announcePhase(nextPhase);
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
      const carriesForwardWitness = targetPhaseType === 'cross' || targetPhaseType === 'redirect';

      const newTurnState = initializeTurnState(
        phase,
        trialDuration,
        savedTurnState || turnState ? {
          witnesses_called: savedTurnState?.witnesses_called || turnState?.witnesses_called || [],
          evidence_submitted: savedTurnState?.evidence_submitted || turnState?.evidence_submitted || [],
          current_witness_id: carriesForwardWitness ? (savedTurnState?.current_witness_id || turnState?.current_witness_id || null) : null,
          current_witness_name: carriesForwardWitness ? (savedTurnState?.current_witness_name || turnState?.current_witness_name || null) : null
        } : undefined
      );
       setTurnState(newTurnState);

       // Save turn state to session
       db.sessions.updateSession(session.id, {
         session_state: {
           ...session.session_state,
           turnState: newTurnState
         }
        }).catch(err => console.error('Failed to save turn state:', err));

        // Enable user input for defense turns (after judge instruction).
        // In pass & play, both sides are the same human on one device, so
        // input opens on every turn, not just playerRole's fixed side.
        if ((newTurnState.current_turn === playerRole || sameDevicePlay) && !judgeInstructionPending) {
          setAwaitingUserInput(true);
        }

        // Auto-trigger the AI's side if it's their turn (only once per phase)
      // NOTE: Opening statements are handled by the dedicated useEffect below
      // IMPORTANT: Wait for judge instruction to complete before the AI acts
      const isOpeningPhase = phase?.name.toLowerCase().includes('opening statement');
      
      if (!isMultiplayer &&
          newTurnState.current_turn === aiRole && 
          phase?.category === 'trial' && 
          !isOpeningPhase && // Skip opening - handled separately
          !isProsecutionThinking &&
          !judgeInstructionPending && // Wait for judge instruction first
          prosecutionTurnTriggeredRef.current !== currentPhase) {
        prosecutionTurnTriggeredRef.current = currentPhase;
        
        console.log('[Courtroom] Triggering prosecution turn for phase', currentPhase, '(after judge instruction)');
        
        // Delay to ensure judge instruction is visible and spoken first
        const timer = setTimeout(() => {
          if (caseData && turnState) {
            handleProsecutionTurn();
          } else {
            console.warn('[Courtroom] Cannot trigger prosecution - data not ready');
          }
        }, 2500); // Longer delay to let judge instruction complete
        return () => clearTimeout(timer);
      }
    }
  }, [currentPhase, trialDuration, caseData, judgeInstructionPending, showPreTrial]);

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
        const judgeEvent = await db.trialEvents.addEvent({
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

  // Handle prosecution AI turn
  const handleProsecutionTurn = async () => {
    if (!trialDuration || !turnState || !caseData) return;
    
    setIsProsecutionThinking(true);
    try {
      const config = getTrialConfig(trialDuration);
      const phase = config.phases.find(p => p.number === currentPhase);
      const allowedActions = getAllowedActions(
        turnState,
        phase,
        trialDuration,
        witnesses.map(w => ({ id: w.id, name: w.name })),
        evidence.map(e => ({ id: e.id, exhibit_label: e.exhibit_label, title: e.title })),
        true
      );

      const transcriptSummary = buildTranscriptSummary(events);
      const currentWitness = turnState.current_witness_id 
        ? witnesses.find(w => w.id === turnState.current_witness_id)?.name || null
        : null;

      const prosecutionContext = {
        role: 'prosecution' as const,
        side: aiRole,
        phase: phase?.name || 'Unknown',
        difficulty: (session.session_state as any)?.difficulty,
        time_remaining_seconds: turnState.phase_time_remaining,
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
      await executeProsecutionAction(action);
    } catch (error) {
      console.error('Failed to handle prosecution turn:', error);
    } finally {
      setIsProsecutionThinking(false);
    }
  };

  // Execute prosecution action
  const executeProsecutionAction = async (action: { action: string; content?: string; witness_name?: string; evidence_id?: string }) => {
    if (!turnState) return;

    switch (action.action) {
      case 'make_statement':
        // Handle opening/closing statements
        if (action.content) {
          await handleMakeStatement(action.content);
        } else {
          // Generate statement automatically for opening
          await handleGenerateOpeningStatement();
        }
        break;

      case 'call_witness':
        if (action.witness_name) {
          const witness = witnesses.find(w => w.name === action.witness_name);
          if (witness) {
            await handleCallWitness(witness);
          }
        } else {
          setShowWitnessSelector(true);
        }
        break;

      case 'ask_question':
        if (action.content && turnState.current_witness_id) {
          await handleAskQuestion(action.content, turnState.current_witness_id);
        }
        break;

      case 'submit_evidence':
        if (action.evidence_id) {
          const evidenceItem = evidence.find(e => e.id === action.evidence_id);
          if (evidenceItem) {
            await handleSubmitEvidence(evidenceItem);
          }
        } else {
          setShowEvidenceSelector(true);
        }
        break;

      case 'end_phase':
        await handleEndPhase();
        break;

      case 'rest':
        await handleRestPhase();
        break;

      default:
        console.warn('Unknown prosecution action:', action.action);
    }
  };

  // Handle making a statement (opening/closing)
  const handleMakeStatement = async (statement: string) => {
    if (!caseData) {
      console.warn('[Courtroom] Cannot make statement - caseData not loaded');
      return;
    }

    console.log('[Courtroom] 📝 handleMakeStatement called with statement length:', statement.length);
    
    try {
      const config = getTrialConfig(trialDuration!);
      const phase = config.phases.find(p => p.number === currentPhase);
       const isOpening = phase?.name.toLowerCase().includes('opening');

      console.log('[Courtroom] 💾 Saving event to database...');
      const event = await db.trialEvents.addEvent({
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

      // Move on as soon as the AI is actually done *speaking* the
      // statement, rather than a fixed delay — a fixed timer either cuts
      // the statement off (long ones) or leaves the phase sitting idle
      // for however much of its time limit is left after a short one
      // finishes reading. Previously this also only fired for phase 7
      // (prosecution's opening) — phase 8 (defense's opening, i.e. the
      // AI playing defense) never auto-advanced at all.
      if (isOpening) {
        console.log('[Courtroom] 🔊 Speaking text — will end phase when speech finishes...');
        speakAs('counsel', statement, () => {
          console.log('[Courtroom] ⏭️ Speech finished — ending phase now...');
          handleEndPhase();
        });
      } else {
        console.log('[Courtroom] 🔊 Speaking text...');
        speakAs('counsel', statement);
      }
    } catch (error) {
      console.error('[Courtroom] ❌ Error in handleMakeStatement:', error);
      // Still update UI even if DB save fails
      const fallbackEvent: TrialEvent = {
        id: `temp-${Date.now()}`,
        session_id: session.id,
        event_type: 'opening',
        speaker_role: 'prosecution',
        speaker_name: prosecutorName || 'Prosecution',
        content: statement,
        timestamp: new Date().toISOString(),
        metadata: { phase: currentPhase },
        event_order: events.length + 1
      };
      setEvents([...events, fallbackEvent]);
      speakAs('counsel', statement);
      setLastProsecutionEvent(fallbackEvent);
      throw error; // Re-throw so caller knows it failed
    }
  };

  // Generate opening statement automatically
  const handleGenerateOpeningStatement = async () => {
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
      const timeLimit = phase ? (config.phaseDurations[phase.number] || 0) : 0; // in minutes

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
          caseDescription: caseData.description,
          timeLimitMinutes: timeLimit,
          availableEvidence: evidence.map(e => ({
            id: e.id,
            title: e.title,
            description: e.description || '',
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
        setEvents([...events, fallbackEvent]);
        speakAs('counsel', fallback);
        setLastProsecutionEvent(fallbackEvent);
      } catch (fallbackError) {
        console.error('[Courtroom] ❌ Failed to make fallback statement:', fallbackError);
      }
    } finally {
      setIsProsecutionThinking(false);
      console.log('[Courtroom] ✅ Opening statement generation complete (finally block executed)');
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

    const callerRole: 'prosecution' | 'defense' = turnState.current_turn === 'defense' ? 'defense' : 'prosecution';
    const callerName = callerRole === 'prosecution' ? (prosecutorName || 'Prosecution') : effectiveDefenseName;

    const event = await db.trialEvents.addEvent({
      session_id: session.id,
      event_type: 'witness_call',
      speaker_role: callerRole,
      speaker_name: callerName,
      content: witness.name,
      metadata: {
        witness_id: witness.id,
        phase: currentPhase
      },
      event_order: events.length + 1
    });

    setEvents([...events, event]);

    // Track prosecution event for objections
    if (turnState.current_turn === aiRole) {
      setLastProsecutionEvent(event);
    }
    trackObjectableStatement(event);

    setTurnState({
      ...turnState,
      current_witness_id: witness.id,
      current_witness_name: witness.name,
      witnesses_called: [...turnState.witnesses_called, witness.id]
    });
    setShowWitnessSelector(false);
  };

  // Handle asking a question to witness
  const handleAskQuestion = async (question: string, witnessId: string) => {
    if (!turnState) return;

    const witness = witnesses.find(w => w.id === witnessId);
    if (!witness) return;

    // Add prosecution question to transcript
    const questionEvent = await db.trialEvents.addEvent({
      session_id: session.id,
      event_type: 'witness_examination',
      speaker_role: turnState.current_turn === 'prosecution' ? 'prosecution' : 'defense',
      speaker_name: turnState.current_turn === 'prosecution' 
        ? effectiveProsecutorName
        : effectiveDefenseName,
      content: question,
      metadata: { 
        witness_id: witnessId,
        phase: currentPhase,
        examination_type: turnState.current_phase_type
      },
      event_order: events.length + 1
    });

    setEvents([...events, questionEvent]);

    // Get witness response
    setIsProcessing(true);
    try {
      const previousInteractions = events
        .filter(e => e.metadata?.witness_id === witnessId)
        .map(e => ({
          question: e.content,
          response: '' // Will be filled by witness response
        }));

      const response = await generateWitnessResponse(witness, question, previousInteractions);
      speakAs('witness', response);

      // Add witness response to transcript
      const responseEvent = await db.trialEvents.addEvent({
        session_id: session.id,
        event_type: 'witness_examination',
        speaker_role: 'witness',
        speaker_name: witness.name,
        content: response,
        metadata: { 
          witness_id: witnessId,
          phase: currentPhase,
          examination_type: turnState.current_phase_type
        },
        event_order: events.length + 2
      });

      setEvents([...events, questionEvent, responseEvent]);
      
      // Track last prosecution event for objections
      if (turnState.current_turn === aiRole) {
        setLastProsecutionEvent(questionEvent);
      }
      trackObjectableStatement(questionEvent);

      // Re-open the input for another question. This needs to cover the
      // human's own turn too (current_turn === playerRole), not just
      // aiRole's — previously it only fired for aiRole's turn, which
      // meant that after asking their first question during their own
      // witness examination, the human's input box never came back
      // until the phase ended, with no way to ask a natural follow-up.
      if (turnState.current_turn === aiRole || turnState.current_turn === playerRole || sameDevicePlay) {
        setTurnState({
          ...turnState,
          prosecution_actions_remaining: turnState.prosecution_actions_remaining - 1
        });
        setAwaitingUserInput(true);
      }
    } catch (error) {
      console.error('Failed to get witness response:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle evidence submission
  const handleSubmitEvidence = async (evidenceItem: Evidence) => {
    if (!turnState) return;

    const event = await db.trialEvents.addEvent({
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
      event_order: events.length + 1
    });

    setEvents([...events, event]);
    
    // Track prosecution event for objections
    if (turnState.current_turn === aiRole) {
      setLastProsecutionEvent(event);
    }
    trackObjectableStatement(event);
    
    setTurnState({
      ...turnState,
      evidence_submitted: [...turnState.evidence_submitted, evidenceItem.id]
    });
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
      alert(`Objection cooldown active. Please wait ${remainingSeconds} more seconds.`);
      setShowObjectionSelector(false);
      return;
    }

    setIsProcessingObjection(true);
    setShowObjectionSelector(false);

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
      const objectionEvent = await db.trialEvents.addEvent({
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

      setEvents([...events, objectionEvent]);

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
      const rulingEvent = await db.trialEvents.addEvent({
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

      setEvents([...events, objectionEvent, rulingEvent]);

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

      // If sustained, prosecution should rephrase (this will be handled in their next turn)
      if (ruling.ruling === 'sustained') {
        speakAs('judge', `Objection sustained. ${ruling.reasoning}`);
      } else {
        speakAs('judge', `Objection overruled. ${ruling.reasoning}`);
      }
    } catch (error) {
      console.error('Failed to process objection:', error);
      alert('Failed to process objection. Please try again.');
    } finally {
      setIsProcessingObjection(false);
    }
  };



  // Handle skipping phase


  const handleEndTrial = async () => {
    if (!confirm('Are you sure you want to end the trial? This will conclude the case.')) {
      return;
    }

    try {
      // Generate verdict - force defense loss for early termination
      const verdict: Verdict = {
        id: crypto.randomUUID(),
        session_id: session.id,
        outcome: 'lose',
        reasoning: 'Trial ended prematurely. Defense forfeits the case.',
        evidence_cited: [],
        witness_performance: {},
        missed_opportunities: [],
        score: 0,
        delivered_at: new Date().toISOString()
      };

      // Call onComplete to end the session
      onComplete(verdict);
    } catch (error) {
      console.error('[Courtroom] ❌ Failed to end trial:', error);
      alert('Failed to end trial. Please try again.');
    }
  };

  const handleRestPhase = async () => {
    if (!turnState) return;

    const event = await db.trialEvents.addEvent({
      session_id: session.id,
      event_type: 'witness_examination',
      speaker_role: turnState.current_turn === 'prosecution' ? 'prosecution' : 'defense',
      speaker_name: turnState.current_turn === 'prosecution'
        ? effectiveProsecutorName
        : effectiveDefenseName,
      content: `The ${turnState.current_turn === 'prosecution' ? effectiveProsecutorName : effectiveDefenseName} rests.`,
      metadata: { phase: currentPhase, rested: true },
      event_order: events.length + 1
    });

    setEvents([...events, event]);
    await handleNextPhase();
  };

  const handleVerdict = async () => {
    try {
      setIsProcessing(true);
      
      // Generate verdict based on transcript — pass trial type for jury vs bench
      const trialType = session.trial_type || 'judge';
      const verdictResult = await generateVerdict(
        events,
        evidence.filter(e => turnState?.evidence_submitted.includes(e.id) || false),
        caseData?.title || 'Unknown Case',
        caseData?.defendant_name,
        trialType as 'judge' | 'jury'
      );

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

      onComplete(verdict);
    } catch (error) {
      console.error('Failed to create verdict:', error);
      // Fallback verdict
      const fallbackVerdict = await db.verdicts.createVerdict({
        session_id: session.id,
        outcome: 'lose',
        reasoning: 'The Court has reviewed the evidence and testimony presented.',
        evidence_cited: [],
        score: 50
      });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Fixed Header - Non-scrolling */}
      <div className="fixed top-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 z-50 w-full">
        <div className="w-full max-w-[1800px] mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={onBack}
                className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 shrink-0 bg-slate-700 hover:bg-slate-600 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div className="hidden sm:flex items-center justify-center w-10 h-10 shrink-0 bg-red-600 rounded-full">
                <Scale className="w-5 h-5 text-white" />
              </div>
               <div className="min-w-0">
                 <h1 className="text-base sm:text-2xl font-bold text-white truncate">Courtroom Session</h1>
                 <p className="text-slate-400 text-xs sm:text-sm truncate">{phase?.name}</p>
                 {practiceMode
                   ? <p className="text-amber-400 text-xs sm:text-sm font-semibold">Practice Mode — no time limit</p>
                   : timerActive && <p className="text-slate-400 text-xs sm:text-sm">{formatTime(totalTimeRemaining)} remaining</p>}
               </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
               <button
                 onClick={handleEndTrial}
                 className="flex items-center gap-2 px-2.5 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                 title="End Trial"
               >
                 <RotateCcw className="w-4 h-4" />
                 <span className="hidden sm:inline">End Trial</span>
               </button>
              <button
                onClick={() => setShowVideoDisplay(!showVideoDisplay)}
                className="flex items-center gap-2 px-2.5 sm:px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                title={showVideoDisplay ? 'Hide Video' : 'Show Video'}
              >
                {showVideoDisplay ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                <span className="hidden sm:inline">{showVideoDisplay ? 'Hide Video' : 'Show Video'}</span>
              </button>
              <button
                onClick={() => setShowRealVoiceInfo(true)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-gradient-to-r from-purple-600/30 to-fuchsia-600/30 hover:from-purple-600/40 hover:to-fuchsia-600/40 border border-purple-500/40 text-purple-200 rounded-lg transition-colors"
                title="Real Voice — Coming Soon"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-semibold">Real Voice</span>
              </button>
               {timerActive && (
                 <button
                   onClick={togglePause}
                   className="flex items-center gap-2 px-2.5 sm:px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
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
      <div className="flex-1 pb-56 sm:pb-48 px-3 sm:px-6 overflow-y-auto" style={{ paddingTop: '110px' }}>
        <div className="max-w-[1800px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="hidden lg:block lg:col-span-1">
            <TrialOutline
              currentPhase={currentPhase}
              trialConfig={trialConfig}
              phaseTimeRemaining={phaseTimeRemaining}
              timerActive={timerActive}
              totalTimeRemaining={totalTimeRemaining}
              practiceMode={practiceMode}
              events={events}
              prosecutorName={prosecutorName || 'Prosecution'}
              defenseName="Defense"
            />
          </div>

          <div className="lg:col-span-3">
            <div className="bg-slate-800 rounded-lg border border-slate-700 flex flex-col overflow-hidden h-[calc(100vh-360px)]">
              {/* Video Display - Conditionally Rendered */}
              {showVideoDisplay && (
                <div className="relative h-64 flex-shrink-0">
                  <TrialVideoDisplay
                    currentPhase={currentPhase}
                    currentSpeaker={currentSpeaker}
                  />
                  <div className="absolute bottom-4 left-4 bg-slate-900/90 px-4 py-2 rounded-lg">
                    <p className="text-white font-medium">{phase?.name}</p>
                    <p className="text-slate-400 text-sm capitalize">{currentSpeaker} speaking</p>
                  </div>
                </div>
              )}

              {/* Transcript/Conversation Area - Expanded when video is hidden */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-900/50 min-h-0">
                {events.map((event) => {
                  const isJudge = event.speaker_role === 'judge';
                  const isProsecution = event.speaker_role === 'prosecution';
                  const isDefense = event.speaker_role === 'defense' || event.speaker_role === 'counsel';
                  const isWitness = event.speaker_role === 'witness';
                  const isEvidence = event.event_type === 'evidence_submission';
                  const isWitnessCall = event.event_type === 'witness_call';
                  
                  return (
                    <div
                      key={event.id}
                      className={`p-4 rounded-lg ${
                        isJudge
                          ? 'bg-amber-500/10 border border-amber-500/30'
                          : isProsecution
                          ? 'bg-red-500/10 border border-red-500/30'
                          : isDefense
                          ? 'bg-blue-500/10 border border-blue-500/30'
                          : isWitness
                          ? 'bg-green-500/10 border border-green-500/30'
                          : isEvidence
                          ? 'bg-purple-500/10 border border-purple-500/30'
                          : 'bg-slate-750 border border-slate-600'
                      }`}
                    >
                      <div className="text-xs text-slate-400 mb-1 flex items-center gap-2">
                        {isEvidence && <FileText className="w-3 h-3" />}
                        {isWitnessCall && <User className="w-3 h-3" />}
                        {event.speaker_name || event.speaker_role}
                        {event.event_type === 'objection' && (
                          <span className="text-red-400 font-semibold">OBJECTION</span>
                        )}
                      </div>
                      <p className="text-white whitespace-pre-wrap break-words">{event.content}</p>
                    </div>
                  );
                })}
              </div>

              {/* Status/Thinking Messages */}
              {isProsecutionThinking && (
                <div className="border-t border-slate-700 p-4">
                  <div className="flex flex-col items-center justify-center gap-3 py-6">
                    <div className="flex items-center gap-3 text-slate-300">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-400 border-t-transparent"></div>
                      <span className="font-medium text-lg">Prosecution is preparing opening statement...</span>
                    </div>
                    <p className="text-xs text-slate-500">Generating opening statement with AI</p>
                  </div>
                </div>
              )}
              
              {!isProsecutionThinking && !sameDevicePlay && turnState?.current_turn === aiRole && (
                <div className="border-t border-slate-700 p-4">
                  <div className="text-center text-slate-400 py-2">
                    Waiting for prosecution to act...
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>

      {pendingHandoff && turnState && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 max-w-sm w-full border border-white/10 shadow-2xl text-center">
            <div className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center ${turnState.current_turn === 'prosecution' ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
              {turnState.current_turn === 'prosecution'
                ? <Gavel className="w-7 h-7 text-red-400" />
                : <Shield className="w-7 h-7 text-blue-400" />}
            </div>
            <h2 className="text-white text-lg font-bold mb-2">Pass the device</h2>
            <p className="text-white/60 text-sm mb-6">
              It's the {turnState.current_turn === 'prosecution' ? 'Prosecution' : 'Defense'} player's turn. Hand over the device, then tap below when you're ready.
            </p>
            <button
              onClick={() => turnHandoffKey && setDeviceRevealedFor(turnHandoffKey)}
              className={`w-full px-4 py-3 rounded-lg text-white font-semibold transition-colors ${turnState.current_turn === 'prosecution' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              I'm the {turnState.current_turn === 'prosecution' ? 'Prosecution' : 'Defense'} player — I'm ready
            </button>
          </div>
        </div>
      )}

               {/* Fixed Bottom Input Bar - Static, doesn't scroll - MUST be at bottom */}
               <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 p-3 sm:p-4 z-40 shadow-lg w-full" style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}>
                 <div className="w-full max-w-[1800px] mx-auto">
                   <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                     <div className="relative w-full sm:flex-1">
                       <textarea
                         value={input}
                         onChange={(e) => setInput(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter' && !e.shiftKey) {
                             e.preventDefault();
                             handleSubmit();
                           }
                         }}
                         placeholder={
                           turnState?.current_phase_type === 'direct' || turnState?.current_phase_type === 'cross'
                             ? "Ask a question to the witness... (Shift+Enter for a new line)"
                             : "Type your statement or question... (Shift+Enter for a new line)"
                         }
                         disabled={isProcessing || !awaitingUserInput || pendingHandoff}
                         rows={2}
                         className="w-full px-4 py-3 pr-12 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-base resize-y min-h-[3rem] max-h-40"
                       />
                       {speechSupported && (
                         <button
                           type="button"
                           onClick={() => isListening ? stopListening() : startListening()}
                           disabled={isProcessing || !awaitingUserInput || pendingHandoff}
                           title={isListening ? 'Stop recording' : 'Speak your statement'}
                           className={`absolute right-2 top-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                             isListening ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-slate-600 hover:bg-slate-500'
                           }`}
                         >
                           <Mic className="w-4 h-4 text-white" />
                         </button>
                       )}
                     </div>
                     <div className="flex gap-2 flex-wrap">
                       <button
                         onClick={handleSubmit}
                         disabled={!input.trim() || isProcessing || !awaitingUserInput || pendingHandoff}
                         className="flex-1 sm:flex-none justify-center px-4 sm:px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors flex items-center gap-2"
                       >
                         <Send className="w-5 h-5" />
                         Submit
                       </button>
                        {(turnState?.current_turn === playerRole || sameDevicePlay) && (
                           <button
                             onClick={handleRestPhase}
                             className="flex-1 sm:flex-none justify-center px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors flex items-center gap-2"
                           >
                             <SkipForward className="w-5 h-5" />
                             Rest
                           </button>
                        )}
                       {turnState?.current_turn !== 'judge' && (
                         <button
                           onClick={() => setShowObjectionSelector(true)}
                           disabled={isProcessingObjection}
                           className="flex-1 sm:flex-none justify-center px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors flex items-center gap-2"
                           title="Object"
                         >
                           <AlertCircle className="w-5 h-5" />
                           Object
                         </button>
                       )}
                       {turnState && (turnState.current_phase_type === 'direct' || turnState.current_phase_type === 'cross' || turnState.current_phase_type === 'redirect') && !turnState.current_witness_id && (
                         <button
                           onClick={() => setShowWitnessSelector(true)}
                           className="flex-1 sm:flex-none justify-center px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                         >
                           <User className="w-4 h-4" />
                           Call Witness
                         </button>
                       )}
                     </div>
                   </div>
                 </div>
               </div>

      {/* Floating Defence Button */}
      {turnState && turnState.current_turn !== 'judge' && (
        <button
          onClick={() => setShowDefenceModal(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-40"
          title="Defence Actions"
        >
          <Scale className="w-6 h-6" />
        </button>
      )}

      {/* Witness Selector Modal */}
      {showWitnessSelector && (
        <WitnessSelector
          witnesses={witnesses}
          witnessesCalled={turnState?.witnesses_called || []}
          onSelect={handleCallWitness}
          onSkip={handleRestPhase}
          onClose={() => setShowWitnessSelector(false)}
        />
      )}

      {showRealVoiceInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 max-w-md w-full border border-purple-500/30 shadow-2xl">
            <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 mb-4">
              <Sparkles className="w-7 h-7 text-purple-300" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1 text-center">Real Voice — Coming Soon</h2>
            <p className="text-purple-300 text-xs font-semibold text-center mb-4 uppercase tracking-wide">Live Voice Trial Mode</p>
            <p className="text-white/70 text-sm leading-relaxed text-center mb-6">
              A fully spoken courtroom — natural, distinct voices for every character, low-latency back-and-forth, no typing at all. What's here today (the mic input and read-aloud lines) is the free version; this is the upgraded experience we're building next.
            </p>
            <button
              onClick={() => setShowRealVoiceInfo(false)}
              className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Evidence Selector Modal */}
      {showEvidenceSelector && (
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Defence Actions</h2>
              <button
                onClick={() => setShowDefenceModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-slate-700 mb-4">
              <button
                onClick={() => setDefenceModalTab('witnesses')}
                className={`flex-1 px-3 py-2 font-medium transition-colors text-sm ${
                  defenceModalTab === 'witnesses'
                    ? 'bg-slate-750 text-white border-b-2 border-blue-500'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <User className="w-4 h-4" />
                  Witnesses
                </div>
              </button>
              <button
                onClick={() => setDefenceModalTab('evidence')}
                className={`flex-1 px-3 py-2 font-medium transition-colors text-sm ${
                  defenceModalTab === 'evidence'
                    ? 'bg-slate-750 text-white border-b-2 border-blue-500'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" />
                  Evidence
                </div>
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {defenceModalTab === 'witnesses' && (
                <div className="space-y-3">
                  {witnesses.filter(w => !turnState?.witnesses_called.includes(w.id)).length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-slate-400">All witnesses have been called.</p>
                    </div>
                  ) : (
                    witnesses.filter(w => !turnState?.witnesses_called.includes(w.id)).map((witness) => (
                      <button
                        key={witness.id}
                        onClick={() => {
                          handleCallWitness(witness);
                          setShowDefenceModal(false);
                        }}
                        className="w-full text-left p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                        disabled={!isWitnessPhase(phase) || turnState?.current_witness_id !== null}
                      >
                        <div className="font-semibold text-white">{witness.name}</div>
                        <div className="text-sm text-slate-400 mt-1">{witness.role}</div>
                        {witness.background && (
                          <div className="text-xs text-slate-500 mt-2 line-clamp-2">
                            {witness.background}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                  {!isWitnessPhase(phase) && (
                    <div className="text-center py-4 text-slate-400 text-sm">
                      Witness calling is only available during witness examination phases.
                    </div>
                  )}
                  {turnState?.current_witness_id !== null && (
                    <div className="text-center py-4 text-slate-400 text-sm">
                      A witness is currently being examined. Rest first to call a new witness.
                    </div>
                  )}
                </div>
              )}

              {defenceModalTab === 'evidence' && (
                <div className="space-y-3">
                  {evidence.filter(e => !turnState?.evidence_submitted.includes(e.id)).length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-slate-400">All evidence has been submitted.</p>
                    </div>
                  ) : (
                    evidence.filter(e => !turnState?.evidence_submitted.includes(e.id)).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          handleSubmitEvidence(item);
                          setShowDefenceModal(false);
                        }}
                        className="w-full text-left p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                      >
                        <div className="font-semibold text-white">{item.title}</div>
                        <div className="text-sm text-slate-400 mt-1">{item.evidence_type.replace('_', ' ')}</div>
                        {item.description && (
                          <div className="text-xs text-slate-500 mt-2 line-clamp-2">
                            {item.description}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
