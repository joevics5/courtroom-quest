import { useState, useEffect, useRef } from 'react';
import { Scale, Send, ArrowLeft, Pause, Play, FileText, User, SkipForward, AlertCircle, Video, VideoOff, RotateCcw, X, Mic } from 'lucide-react';
import { db } from '../lib/database';
import { useAuth } from '../contexts/AuthContext';
import TrialConfigSelector from './TrialConfigSelector';
import TrialOutline from './TrialOutline';
import PreTrialScript from './PreTrialScript';
import TrialVideoDisplay from './TrialVideoDisplay';
import WitnessSelector from './WitnessSelector';
import EvidenceSelector from './EvidenceSelector';
import ObjectionSelector from './ObjectionSelector';
import { getTrialConfig, BAILIFF_PROMPTS, JUDGE_PROMPTS, getPhaseInfo, getRandomJudgeName, getRandomProsecutorName, formatTime } from '../lib/trialConfig';
import {
  getAllowedActions,
  initializeTurnState,
  isWitnessPhase,
  type TurnState
} from '../lib/trialTurnSystem';
import { generateProsecutionAction, buildTranscriptSummary, generateProsecutionOpeningStatement, generateObjectionRuling, generateWitnessResponse, generateVerdict } from '../lib/ai/trialAI';
import type { VerdictResult } from '../lib/ai/trialAI';
import { getJudgeInstructionForPhase, requiresJudgeInstruction, extractWitnessNumber } from '../lib/judgeInstructions';
import { getUserDisplayName } from '../lib/userName';
import { useSpeechRecognition } from '../lib/useSpeechRecognition';
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
   const [isProcessingObjection, setIsProcessingObjection] = useState(false);
   const [lastProsecutionEvent, setLastProsecutionEvent] = useState<TrialEvent | null>(null);
    const prosecutionTurnTriggeredRef = useRef<number | null>(null);
   const [showVideoDisplay, setShowVideoDisplay] = useState(true); // Video display on by default
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
    if (showPreTrial) return; // don't run trial timers/logic while pre-trial script is still showing
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
  }, [currentPhase, trialDuration, timerPaused, showPreTrial]);

  // Auto-advance phase when time runs out
  useEffect(() => {
    if (showPreTrial) return;
    if (trialDuration && timerActive && !timerPaused && phaseTimeRemaining[currentPhase] <= 0 && phaseTimeRemaining[currentPhase] !== undefined) {
      console.log('[Courtroom] Time ran out for phase', currentPhase, '- auto-advancing');
      handleNextPhase();
    }
  }, [phaseTimeRemaining, currentPhase, timerActive, timerPaused, trialDuration, showPreTrial]);

  // Force verdict when total time runs out
  useEffect(() => {
    if (showPreTrial) return;
    if (trialDuration && totalTimeRemaining <= 0 && timerActive && !timerPaused) {
      console.log('[Courtroom] Total trial time ran out - forcing verdict');
      handleVerdict();
    }
  }, [totalTimeRemaining, timerActive, timerPaused, trialDuration, showPreTrial]);

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

  const handlePreTrialComplete = async (pleaGuilty: boolean, judge: string, prosecutor: string) => {
    setJudgeName(judge);
    setProsecutorName(prosecutor);

    // Persist so a remount (refresh, back/forward navigation) restores the
    // same judge/prosecutor instead of re-randomizing and drifting out of
    // sync with what was already said in the pre-trial transcript.
    await db.sessions.updateSession(session.id, {
      session_state: {
        ...session.session_state,
        judgeName: judge,
        prosecutorName: prosecutor
      }
    });

    if (pleaGuilty) {
      // Mark session as completed
      await db.sessions.updateSession(session.id, {
        current_phase: 'completed',
        completed_at: new Date().toISOString()
      });

      const guiltyVerdict: Omit<Verdict, 'id' | 'delivered_at'> = {
        session_id: session.id,
        outcome: 'lose',
        reasoning: 'The defendant entered a guilty plea. The Court accepts the plea and proceeds to sentencing.',
        evidence_cited: [],
        score: 0
      };

      const verdict = await db.verdicts.createVerdict(guiltyVerdict);
      onComplete(verdict);
    } else {
      // Update session to trial phase
      await db.sessions.updateSession(session.id, {
        current_phase: 'trial',
        current_trial_phase: 7 // Start at opening statement
      });
      setShowPreTrial(false);
    }
  };

  const handleTrialDurationSelect = async (type: TrialType, duration: TrialDuration) => {
    setTrialDuration(duration);
    const config = getTrialConfig(duration);

    const initialTimes: Record<number, number> = {};
    Object.entries(config.phaseDurations).forEach(([phase, minutes]) => {
      initialTimes[Number(phase)] = minutes * 60;
    });
    setPhaseTimeRemaining(initialTimes);
    setTotalTimeRemaining(duration * 60);

    await db.sessions.updateSession(session.id, {
      trial_duration: duration,
      trial_type: type,
      phase_timings: config.phaseDurations,
      session_state: {
        ...session.session_state,
        phaseTimeRemaining: initialTimes
      }
    });

    if (type === 'judge') {
      // No jury selection step for a bench trial — let the player know
      // who's deciding the case instead of silently skipping straight
      // past it.
      const assignmentEvent = await db.trialEvents.addEvent({
        session_id: session.id,
        event_type: 'announcement',
        speaker_role: 'judge',
        speaker_name: 'Court',
        content: `Judge ${judgeName} has been assigned this case.`,
        metadata: { phase: currentPhase },
        event_order: events.length + 1
      });
      setEvents(prevEvents => [...prevEvents, assignmentEvent]);
    }

    if (currentPhase === 1) {
      announcePhase(1);
    }
  };

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
        speakText(announcement);
        break;
      case 3:
        announcement = "Judge enters";
        break;
      case 4:
        announcement = JUDGE_PROMPTS.caseAnnouncement.replace('{plaintiff}', 'The State').replace('{defendant}', 'Defendant');
        speakText(announcement);
        break;
      case 6:
        announcement = JUDGE_PROMPTS.plea;
        speakText(announcement);
        break;
    }

    if (announcement) {
      addEvent('judge', announcement);
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const addEvent = async (role: 'judge' | 'counsel' | 'witness', content: string) => {
    const speakerMap: Record<string, 'judge' | 'prosecution' | 'defense' | 'witness' | 'jury'> = {
      judge: 'judge',
      counsel: 'defense',
      witness: 'witness'
    };
    setCurrentSpeaker(speakerMap[role] || 'judge');

    try {
      const event = await db.trialEvents.addEvent({
        session_id: session.id,
        event_type: 'opening',
        speaker_role: role,
        speaker_name: role === 'judge' ? 'Judge' : role === 'counsel' ? 'Defense Counsel' : 'Witness',
        content,
        metadata: { phase: currentPhase },
        event_order: events.length + 1
      });

      setEvents(prevEvents => [...prevEvents, event]);
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

    // Opening statements are mandatory: don't let the timer (or any other
    // trigger) advance past phase 7 (prosecution) or 8 (defense) until that
    // side has actually given their statement.
    if (currentPhase === 7 && !events.some(e => e.speaker_role === 'prosecution' && (e.metadata as any)?.phase === 7)) {
      console.log('[Courtroom] Blocked advance from phase 7 — prosecution has not given an opening statement yet');
      return;
    }
    if (currentPhase === 8 && !events.some(e => e.speaker_role === 'defense' && (e.metadata as any)?.phase === 8)) {
      console.log('[Courtroom] Blocked advance from phase 8 — defense has not given an opening statement yet');
      return;
    }

    const config = getTrialConfig(trialDuration);
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
      
      const newTurnState = initializeTurnState(
        phase,
        trialDuration,
        savedTurnState || turnState ? {
          witnesses_called: savedTurnState?.witnesses_called || turnState?.witnesses_called || [],
          evidence_submitted: savedTurnState?.evidence_submitted || turnState?.evidence_submitted || [],
          current_witness_id: savedTurnState?.current_witness_id || turnState?.current_witness_id || null,
          current_witness_name: savedTurnState?.current_witness_name || turnState?.current_witness_name || null
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

        // Enable user input for defense turns (after judge instruction)
        if (newTurnState.current_turn === 'defense' && !judgeInstructionPending) {
          setAwaitingUserInput(true);
        }

        // Auto-trigger prosecution AI if it's their turn (only once per phase)
      // NOTE: Opening statements are handled by the dedicated useEffect below
      // IMPORTANT: Wait for judge instruction to complete before prosecution acts
      const isOpeningPhase = phase?.name.toLowerCase().includes('opening statement - prosecution');
      
      if (newTurnState.current_turn === 'prosecution' && 
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
      prosecutorName: prosecutorName || 'Prosecution',
      defenseName: 'Defense',
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
        speakText(instruction);
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
        speakText(instruction);
        await new Promise(resolve => setTimeout(resolve, instruction.length * 50));
        setJudgeInstructionPending(false);
      }
    };
    
    addInstruction();
  }, [currentPhase, caseData, trialDuration, judgeName, prosecutorName, events.length, showPreTrial]);

  // Phase 7: Opening Statement - Prosecution
  useEffect(() => {
    console.log('[Courtroom] 🔍 Opening statement useEffect triggered:', {
      currentPhase,
      hasCaseData: !!caseData,
      hasTrialDuration: !!trialDuration,
      isProsecutionThinking,
      judgeInstructionPending,
      prosecutionTurnTriggeredRef: prosecutionTurnTriggeredRef.current
    });

    if (showPreTrial || currentPhase !== 7 || !caseData || !trialDuration || isProsecutionThinking) {
      console.log('[Courtroom] 🚫 Opening statement useEffect blocked by conditions');
      return;
    }
    // Wait for the judge's "you may proceed" instruction to finish being
    // generated and shown before the prosecution starts speaking. Without
    // this guard, this effect and the judge-instruction effect both fire
    // as soon as currentPhase becomes 7 and race each other, so the
    // prosecution's opening statement can appear before or interleaved
    // with the judge's line instead of after it.
    if (judgeInstructionPending) {
      console.log('[Courtroom] 🚫 Opening statement blocked - waiting for judge instruction to finish');
      return;
    }
    if (prosecutionTurnTriggeredRef.current === 7) {
      console.log('[Courtroom] 🚫 Opening statement already triggered for phase 7');
      return;
    }

    const config = getTrialConfig(trialDuration);
    const phase = config.phases.find(p => p.number === 7);
    if (!phase || phase.name !== 'Opening Statement - Prosecution') return;

    console.log('[Courtroom] 🚀 Phase 7: Judge instruction complete, generating prosecution opening statement');

    const generateOpening = async () => {
      prosecutionTurnTriggeredRef.current = 7;
      setIsProsecutionThinking(true);

      try {
        await handleGenerateOpeningStatement();
        console.log('[Courtroom] ✅ Prosecution opening statement completed');
      } catch (error) {
        console.error('[Courtroom] ❌ Prosecution opening statement failed:', error);
        setIsProsecutionThinking(false);
      }
    };

    // Same 2500ms deferral the other phases use before triggering prosecution.
    // The judgeInstructionPending check above can still read a stale value on
    // the very first render where currentPhase flips to 7 (the judge-instruction
    // effect's setState hasn't applied yet within the same render pass), so the
    // check alone isn't airtight. This delay is what actually closes the race:
    // it gives the judge's instruction (a DB write + state update) real time to
    // finish and render before the prosecution starts speaking, regardless of
    // exact same-tick state timing.
    const timer = setTimeout(() => {
      generateOpening();
    }, 2500);

    return () => clearTimeout(timer);
  }, [currentPhase, caseData, trialDuration, isProsecutionThinking, judgeInstructionPending, showPreTrial]);

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
        phase: phase?.name || 'Unknown',
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
        speaker_role: 'prosecution',
        speaker_name: prosecutorName || 'Prosecution',
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
      
      console.log('[Courtroom] 🔊 Speaking text...');
      speakText(statement);

      // Track prosecution event for objections
      setLastProsecutionEvent(event);
      console.log('[Courtroom] ✅ Statement processed successfully');

      // After opening statement (phase 7), automatically end phase and move to next phase
      if (isOpening && currentPhase === 7) {
        console.log('[Courtroom] ⏭️ Scheduling phase end in 2 seconds...');
        setTimeout(async () => {
          console.log('[Courtroom] ⏭️ Ending phase now...');
          await handleEndPhase();
        }, 2000);
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
      speakText(statement);
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
      // Opening statement is phase 7
      const phase = config.phases.find(p => p.number === 7);
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
          prosecutorName: prosecutorName || 'Prosecution',
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
      const fallback = `Good morning, Your Honor. The prosecution is ready to present its case. We will show that the defendant is guilty beyond a reasonable doubt.`;
      try {
        // Use a simpler version that doesn't require DB
        const fallbackEvent: TrialEvent = {
          id: `temp-${Date.now()}`,
          session_id: session.id,
          event_type: 'opening',
          speaker_role: 'prosecution',
          speaker_name: prosecutorName || 'Prosecution',
          content: fallback,
          timestamp: new Date().toISOString(),
          metadata: { phase: currentPhase },
          event_order: events.length + 1
        };
        setEvents([...events, fallbackEvent]);
        speakText(fallback);
        setLastProsecutionEvent(fallbackEvent);
      } catch (fallbackError) {
        console.error('[Courtroom] ❌ Failed to make fallback statement:', fallbackError);
      }
    } finally {
      setIsProsecutionThinking(false);
      console.log('[Courtroom] ✅ Opening statement generation complete (finally block executed)');
    }
  };

  // Handle calling a witness
  const handleCallWitness = async (witness: Witness) => {
    if (!turnState) return;

    const event = await db.trialEvents.addEvent({
      session_id: session.id,
      event_type: 'witness_call',
      speaker_role: 'prosecution',
      speaker_name: prosecutorName || 'Prosecution',
      content: witness.name,
      metadata: {
        witness_id: witness.id,
        phase: currentPhase
      },
      event_order: events.length + 1
    });

    setEvents([...events, event]);

    // Track prosecution event for objections
    if (turnState.current_turn === 'prosecution') {
      setLastProsecutionEvent(event);
    }

    setTurnState({
      ...turnState,
      current_witness_id: witness.id,
      current_witness_name: witness.name,
      witnesses_called: [...turnState.witnesses_called, witness.id]
    });
    setShowWitnessSelector(false);
  };

  // Handle defence calling a witness
  const handleDefenceCallWitness = async (witness: Witness) => {
    if (!turnState) return;

    // First, add the defence calling the witness
    const callEvent = await db.trialEvents.addEvent({
      session_id: session.id,
      event_type: 'witness_call',
      speaker_role: 'defense',
      speaker_name: 'Defense Counsel',
      content: `Calls ${witness.name} to the stand.`,
      metadata: {
        witness_id: witness.id,
        phase: currentPhase
      },
      event_order: events.length + 1
    });

    setEvents([...events, callEvent]);

    // Then, witness introduces themselves with name and details
    const introContent = `My name is ${witness.name}. ${witness.role}. ${witness.background || 'I am here to testify.'}`;

    const introEvent = await db.trialEvents.addEvent({
      session_id: session.id,
      event_type: 'witness_examination',
      speaker_role: 'witness',
      speaker_name: witness.name,
      content: introContent,
      metadata: {
        witness_id: witness.id,
        phase: currentPhase,
        introduction: true
      },
      event_order: events.length + 2
    });

    setEvents([...events, callEvent, introEvent]);

    // Update turn state
    setTurnState({
      ...turnState,
      current_witness_id: witness.id,
      current_witness_name: witness.name,
      witnesses_called: [...turnState.witnesses_called, witness.id],
      current_turn: 'defense', // Defence gets to question first
      current_phase_type: 'cross' // Defence cross-examination
    });

    // Enable user input for defence questioning
    setAwaitingUserInput(true);
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
        ? (prosecutorName || 'Prosecution')
        : 'Defense Counsel',
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
      if (turnState.current_turn === 'prosecution') {
        setLastProsecutionEvent(questionEvent);
      }
      
      // Update turn state - switch to user's turn if it was prosecution's turn
      if (turnState.current_turn === 'prosecution') {
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
        ? (prosecutorName || 'Prosecution')
        : 'Defense Counsel',
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
    if (turnState.current_turn === 'prosecution') {
      setLastProsecutionEvent(event);
    }
    
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
    if (!turnState || !lastProsecutionEvent) {
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

      // Add objection to transcript
      const objectionEvent = await db.trialEvents.addEvent({
        session_id: session.id,
        event_type: 'objection',
        speaker_role: 'defense',
        speaker_name: 'Defense Counsel',
        content: `Objection: ${objectionReason}`,
        metadata: {
          objection_reason: reason,
          objected_to_event_id: lastProsecutionEvent.id,
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
        objection_by: 'defense',
        objection_reason: objectionReason,
        questioned_statement: lastProsecutionEvent.content,
        current_phase: phase?.name || 'Unknown',
        recent_transcript: transcriptSummary
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
        speakText(`Objection sustained. ${ruling.reasoning}`);
      } else {
        speakText(`Objection overruled. ${ruling.reasoning}`);
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
        ? (prosecutorName || 'Prosecution')
        : 'Defense Counsel',
      content: `The ${turnState.current_turn === 'prosecution' ? (prosecutorName || 'Prosecution') : 'Defense'} rests.`,
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
      speakText(announcement);

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

  if (!trialDuration) {
    return (
      <TrialConfigSelector
        onSelect={handleTrialDurationSelect}
        onCancel={onBack}
      />
    );
  }

  if (showPreTrial && caseData && user) {
    return (
      <PreTrialScript
        caseTitle={caseData.title}
        userName={getUserDisplayName(user)}
        onComplete={handlePreTrialComplete}
      />
    );
  }

  // At this point, trialDuration is guaranteed to be set (checked above)
  const trialConfig = getTrialConfig(trialDuration);
  const phase = getPhaseInfo(currentPhase, trialDuration);

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
                 {timerActive && <p className="text-slate-400 text-xs sm:text-sm">{formatTime(totalTimeRemaining)} remaining</p>}
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
          <div className="lg:col-span-1">
            <TrialOutline
              currentPhase={currentPhase}
              trialConfig={trialConfig}
              phaseTimeRemaining={phaseTimeRemaining}
              timerActive={timerActive}
              totalTimeRemaining={totalTimeRemaining}
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
              
              {!isProsecutionThinking && turnState?.current_turn === 'prosecution' && (
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

               {/* Fixed Bottom Input Bar - Static, doesn't scroll - MUST be at bottom */}
               <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 p-3 sm:p-4 z-40 shadow-lg w-full" style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}>
                 <div className="w-full max-w-[1800px] mx-auto">
                   <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                     <div className="relative w-full sm:flex-1">
                       <input
                         type="text"
                         value={input}
                         onChange={(e) => setInput(e.target.value)}
                         onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                         placeholder={
                           turnState?.current_phase_type === 'direct' || turnState?.current_phase_type === 'cross'
                             ? "Ask a question to the witness..."
                             : "Type your statement or question..."
                         }
                         disabled={isProcessing || !awaitingUserInput}
                         className="w-full px-4 py-3 pr-12 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-base"
                       />
                       {speechSupported && (
                         <button
                           type="button"
                           onClick={() => isListening ? stopListening() : startListening()}
                           disabled={isProcessing || !awaitingUserInput}
                           title={isListening ? 'Stop recording' : 'Speak your statement'}
                           className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
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
                         disabled={!input.trim() || isProcessing || !awaitingUserInput}
                         className="flex-1 sm:flex-none justify-center px-4 sm:px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors flex items-center gap-2"
                       >
                         <Send className="w-5 h-5" />
                         Submit
                       </button>
                        {turnState?.current_turn === 'defense' && (
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
                          handleDefenceCallWitness(witness);
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
