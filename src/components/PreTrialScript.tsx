import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Gavel } from 'lucide-react';
import { BAILIFF_PROMPTS, JUDGE_PROMPTS, getRandomJudgeName, getRandomProsecutorName, aiDefenseName, plainLawyerName } from '../lib/trialConfig';
import type { PlayerRole } from '../types';
import { canSpeak, enterSpeechScope, speakAs, stopSpeaking } from '../lib/speech';
import { AI_DEFENSE_PLEA, LINGER_MS, aiPleaLine, pretrialSteps, readingTimeMs } from '../lib/pretrial';
import SpeechToggle, { useSpeechMuted } from './SpeechToggle';
import { useAuth } from '../contexts/AuthContext';
import AvatarFace from './AvatarFace';
import SceneBackdrop from './SceneBackdrop';
import { gameButton, PANEL_SOFT } from './ui';
import { TTS_SUPPORTED, useRecentPulse, useTtsSpeaking } from './stage/signals';
import { BAILIFF_AVATAR, getUserAvatar, type AvatarConfig } from '../lib/avatars';
import { aiRank, castAvatars } from '../lib/stageCast';
import { LEVELS, getLevelForWins } from '../lib/levels';
import type { StageSpeaker } from '../lib/stageSpeaker';
import { pickStageScene } from '../lib/stageScene';
import { db } from '../lib/database';
import type { ShotName } from './court3d/stage';
import { drivesPretrial, seatNotice, seatedKey, type PlayMode, type PretrialLive } from '../lib/liveGame';

const Court3D = lazy(() => import('./court3d/Court3D'));

interface PreTrialScriptProps {
  caseTitle: string;
  userName: string;
  judgeName: string;
  prosecutorName: string;
  playerRole?: PlayerRole; // defaults to 'defense' for sessions created before role selection existed
  /** Used so the AI counsel look exactly as they will in the trial. */
  sessionId?: string;
  /** The player's cases won: sets their rank, which dresses their avatar. */
  playerWins?: number;
  onComplete: (pleaGuilty: boolean, judgeName: string, prosecutorName: string) => void;
  /** Leave the pre-trial (the session is kept; it can be continued later). */
  onBack?: () => void;
  /** ai: against the computer. online: two people on two devices, kept in step live. device: one phone, two people. */
  mode?: PlayMode;
  /** Online: the shared pre-trial progress (seats, script, plea), refreshed every couple of seconds. */
  live?: PretrialLive;
  /** Online: writes my part of the shared progress (seated, started, step, plea). */
  onLivePatch?: (patch: Record<string, unknown>) => void;
  /** Online: the other player, so the scene shows their name, rank and the avatar they chose. */
  opponent?: { name: string; avatar: AvatarConfig | null; rank: number | null };
}

type PreTrialPhase =
  | 'idle'
  | 'bailiff_call'
  | 'case_announcement'
  | 'counsel_appearances'
  | 'defendant_plea'
  | 'plea_complete'
  | 'start_trial';

export default function PreTrialScript({ caseTitle, userName, judgeName: judgeNameProp, prosecutorName: prosecutorNameProp, playerRole = 'defense', sessionId = '', playerWins = 0, onComplete, onBack, mode = 'ai', live, onLivePatch, opponent }: PreTrialScriptProps) {
  const online = mode === 'online';
  /** Online, the defense runs the bailiff's script and enters the plea; the prosecution watches it live. */
  const iDrive = !online || drivesPretrial(playerRole);
  /** Who may answer the plea: the defense; on a shared phone, whoever is holding it. */
  const canPlead = mode === 'device' || playerRole === 'defense';
  const patchLive = (patch: Record<string, unknown>) => { if (online) onLivePatch?.(patch); };
  const opponentName = opponent?.name || 'Your opponent';
  const [phase, setPhase] = useState<PreTrialPhase>('idle');
  // Fall back to a fresh random pick only if a caller doesn't supply one
  // (e.g. an old session created before this was lifted to App.tsx).
  const [judgeName] = useState(judgeNameProp || getRandomJudgeName());
  // The NPC attorney pool name (e.g. "District Attorney Harrison") is only
  // ever actually spoken for whichever side the human ISN'T playing — the
  // human is addressed by their own name, same as defense always was
  // before prosecution became a selectable role.
  const [npcProsecutorName] = useState(prosecutorNameProp || getRandomProsecutorName());
  // The human is announced with their rank and own name, e.g. "Junior Counsel Victor Joshua".
  const myAnnouncedName = `${getLevelForWins(playerWins).title} ${userName}`;
  // Online, the other side is a real person with their own name and rank, not a made-up attorney.
  const opponentAnnounced = opponent?.name
    ? `${opponent.rank ? LEVELS[opponent.rank - 1].title + ' ' : ''}${opponent.name}`
    : 'Opposing Counsel';
  const prosecutorDisplayName = playerRole === 'prosecution' ? myAnnouncedName : online ? opponentAnnounced : plainLawyerName(npcProsecutorName);
  const defenseDisplayName = playerRole === 'defense' ? myAnnouncedName : online ? opponentAnnounced : aiDefenseName(sessionId);
  const [transcript, setTranscript] = useState<Array<{ speaker: string; text: string }>>([]);
  const [pleaGuilty, setPleaGuilty] = useState<boolean | null>(null);
  const [isLoadingJudgeRequest] = useState(false);

  const addTranscript = (speaker: string, text: string) => {
    setTranscript(prev => [...prev, { speaker, text }]);
  };

  // ---- the script: the bailiff reads every line; each line waits for the voice, then lingers ----
  const steps = useMemo(
    () => pretrialSteps({ judgeName, caseTitle, prosecutorName: prosecutorDisplayName, defenseName: defenseDisplayName }),
    [judgeName, caseTitle, prosecutorDisplayName, defenseDisplayName]
  );
  /** Bumped to cancel whatever is pending (leaving the screen, or the player pleading). */
  const runRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const skipRef = useRef<(() => void) | null>(null);
  const [canSkip, setCanSkip] = useState(false);

  const clearTimers = () => {
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current = [];
  };
  const cancelScript = () => {
    runRef.current += 1;
    clearTimers();
    skipRef.current = null;
    setCanSkip(false);
    stopSpeaking('discard');
  };

  // Voice is allowed only on this screen and the trial; leaving stops it.
  useEffect(() => {
    const leave = enterSpeechScope();
    return () => {
      runRef.current += 1;
      timersRef.current.forEach(t => window.clearTimeout(t));
      leave();
    };
  }, []);

  /**
   * Reads one line in the bailiff's voice, then calls `done` after the line has been spoken
   * and has stayed up a moment (or after a reading-time pause if nothing is spoken).
   * The player can jump ahead with Next.
   */
  const say = (text: string, done: () => void) => {
    const id = runRef.current;
    let finished = false;
    const complete = () => {
      if (finished || id !== runRef.current) return;
      finished = true;
      clearTimers();
      skipRef.current = null;
      setCanSkip(false);
      done();
    };
    const completeAfter = (ms: number) => {
      if (finished || id !== runRef.current) return;
      clearTimers();
      timersRef.current.push(window.setTimeout(complete, ms));
    };
    skipRef.current = () => {
      if (id !== runRef.current) return;
      stopSpeaking('discard');
      complete();
    };
    setCanSkip(true);
    if (canSpeak()) {
      speakAs('recorder', text, () => completeAfter(LINGER_MS));
      // If the voice never reports back, do not leave the player stuck.
      timersRef.current.push(window.setTimeout(complete, Math.max(20000, readingTimeMs(text) * 4)));
    } else {
      completeAfter(readingTimeMs(text));
    }
  };

  /** In the 3D courtroom the second line waits until the judge has walked in and sat down. */
  const judgeSeatedRef = useRef(false);
  const playStep = (index: number) => {
    if (index === 1 && show3D && !judgeSeatedRef.current) {
      const id = runRef.current;
      const started = Date.now();
      const wait = () => {
        if (id !== runRef.current) return;
        if (judgeSeatedRef.current || Date.now() - started > 15000) playStepNow(index);
        else timersRef.current.push(window.setTimeout(wait, 250));
      };
      wait();
      return;
    }
    playStepNow(index);
  };
  const playStepNow = (index: number) => {
    const step = steps[index];
    setPhase(step.phase);
    addTranscript('Bailiff', step.text);
    patchLive({ pretrialStep: index });
    say(step.text, () => {
      if (index + 1 < steps.length) {
        playStep(index + 1);
      } else if (mode === 'ai' && playerRole !== 'defense') {
        // The human is the prosecution, so the AI defense enters the plea.
        const guilty = AI_DEFENSE_PLEA === 'guilty';
        const line = aiPleaLine(guilty);
        addTranscript('Bailiff', line);
        setPleaGuilty(guilty);
        say(line, () => setPhase('plea_complete'));
      }
    });
  };

  const handleStart = () => {
    // Online: publish the lines first, so the prosecution reads and hears exactly what is read here.
    patchLive({ pretrialStarted: true, pretrialStep: -1, pretrialScript: steps.map(({ phase, text }) => ({ phase, text })) });
    playStep(0);
  };

  const handlePlea = (guilty: boolean) => {
    cancelScript(); // the voice stops the moment the player answers
    const pleaText = guilty ? 'Guilty, Your Honor.' : 'Not guilty, Your Honor.';
    addTranscript('Defendant', pleaText);
    setPleaGuilty(guilty);
    setPhase('plea_complete');
    patchLive({ pretrialPlea: guilty ? 'guilty' : 'not_guilty' });
  };

  const handleStartTrial = () => {
    if (pleaGuilty === null) return;
    cancelScript();

    // If guilty plea, complete immediately
    if (pleaGuilty) {
      onComplete(true, judgeName, npcProsecutorName);
      return;
    }

    // Not guilty — hand off to the trial immediately. The trial's own
    // phase 7 (Opening Statement - Prosecution) already generates the
    // judge's "you may proceed with your opening statement" line
    // correctly. Generating a second version of that line here, in
    // pre-trial, was duplicating it.
    onComplete(false, judgeName, npcProsecutorName);
  };

  // ---- scene: who is on screen, and who is speaking now ----
  const { user } = useAuth();
  const myAvatar = useMemo(() => getUserAvatar(user), [user]);
  const faces = useMemo(
    () => castAvatars({ judgeName: judgeNameProp, prosecutorName: prosecutorNameProp, playerRole, myAvatar, sessionId, opponentAvatar: online ? opponent?.avatar : null }),
    [judgeNameProp, prosecutorNameProp, playerRole, myAvatar, sessionId, online, opponent?.avatar]
  );
  const myRank = getLevelForWins(playerWins).level;
  const cast: Record<'bailiff' | 'judge' | 'prosecution' | 'defense', { name: string; role: string; avatar: AvatarConfig; rank: number }> = {
    bailiff: { name: 'Bailiff', role: 'Bailiff', avatar: BAILIFF_AVATAR, rank: 1 },
    judge: { name: judgeName, role: 'Judge', avatar: faces.judge, rank: 6 },
    prosecution: {
      name: prosecutorDisplayName,
      role: 'Prosecution',
      avatar: faces.prosecution,
      rank: playerRole === 'prosecution' ? myRank : online && opponent?.rank ? opponent.rank : aiRank(prosecutorNameProp || 'Prosecution')
    },
    defense: {
      name: defenseDisplayName,
      role: 'Defense',
      avatar: faces.defense,
      rank: playerRole === 'defense' ? myRank : online && opponent?.rank ? opponent.rank : aiRank(`${sessionId}-Defense Counsel`)
    }
  };
  const roleOf = (speaker: string): StageSpeaker =>
    speaker === 'Bailiff'
      ? 'bailiff'
      : speaker === prosecutorDisplayName
        ? 'prosecution'
        : speaker === defenseDisplayName || speaker === 'Defendant'
          ? 'defense'
          : 'judge';
  const latest = transcript[transcript.length - 1];
  const activeRole = (latest ? roleOf(latest.speaker) : 'judge') as 'bailiff' | 'judge' | 'prosecution' | 'defense';
  const ttsSpeaking = useTtsSpeaking();
  const recentLine = useRecentPulse(latest ? String(transcript.length) : null, 3500);
  const muted = useSpeechMuted();
  const talking = TTS_SUPPORTED && !muted ? ttsSpeaking : recentLine;
  const [showTranscript, setShowTranscript] = useState(false);
  // ---- 3D courtroom: walk to your chair, press Start, then the judge enters ----
  const wants3D = useMemo(() => pickStageScene() === 'court3d', []);
  const [failed3D, setFailed3D] = useState(false);
  const show3D = wants3D && !failed3D;
  const [seated, setSeated] = useState(false);
  // Without the 3D courtroom there is no chair to walk to: being on the screen is being seated.
  const mySeated = show3D ? seated : true;
  const mySeatKey = seatedKey(playerRole);
  const iHaveToldThem = live ? (live as any)[mySeatKey] === true : false;
  useEffect(() => {
    if (online && mySeated && !iHaveToldThem) patchLive({ [mySeatKey]: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, mySeated, iHaveToldThem]);
  const opponentSeated = live ? (playerRole === 'prosecution' ? live.seatedDefense : live.seatedProsecution) : false;
  const bothSeated = !online || (mySeated && !!live?.bothSeated);

  // ---- online, the player who is only watching: follow the script and the plea as they happen ----
  const seenStepRef = useRef(-1);
  const seenPleaRef = useRef<string | null>(null);
  const firstLookRef = useRef(true);
  useEffect(() => {
    if (!online || iDrive || !live) return;
    const script = live.script;
    const silent = firstLookRef.current; // arrived late: show what was already said without reading it all out
    if (script && live.step > seenStepRef.current) {
      const lines = script.slice(seenStepRef.current + 1, live.step + 1);
      setTranscript(prev => [...prev, ...lines.map(l => ({ speaker: 'Bailiff', text: l.text }))]);
      setPhase((script[live.step]?.phase as PreTrialPhase) || 'bailiff_call');
      seenStepRef.current = live.step;
      const latestLine = script[live.step];
      if (!silent && latestLine && canSpeak()) speakAs('recorder', latestLine.text);
    }
    if (live.plea && seenPleaRef.current !== live.plea) {
      seenPleaRef.current = live.plea;
      stopSpeaking('discard');
      setTranscript(prev => [...prev, { speaker: 'Defendant', text: live.plea === 'guilty' ? 'Guilty, Your Honor.' : 'Not guilty, Your Honor.' }]);
      setPleaGuilty(live.plea === 'guilty');
      setPhase('plea_complete');
    }
    firstLookRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, iDrive, live?.step, live?.plea, live?.script]);

  // ---- online, the player running the script: pick up where they left off after a reload ----
  const resumedRef = useRef(false);
  useEffect(() => {
    if (!online || !iDrive || !live || resumedRef.current) return;
    resumedRef.current = true;
    if (!live.started) return;
    if (live.plea) {
      setPleaGuilty(live.plea === 'guilty');
      setPhase('plea_complete');
      return;
    }
    if (live.step >= 0) {
      const said = live.script && live.script.length > live.step ? live.script : steps;
      setTranscript(said.slice(0, live.step + 1).map(st => ({ speaker: 'Bailiff', text: st.text })));
      setPhase((said[live.step].phase as PreTrialPhase) || steps[live.step].phase);
      if (live.step + 1 < steps.length) playStep(live.step + 1);
    } else {
      playStep(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, iDrive, live?.started]);
  const [jurorIds, setJurorIds] = useState<string[]>([]);
  useEffect(() => {
    if (!show3D || !sessionId) return;
    let cancelled = false;
    db.jurySelections
      .getSessionJurySelections(sessionId)
      .then(rows => { if (!cancelled) setJurorIds(rows.map(r => r.juror_id)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [show3D, sessionId]);
  const lineIndex = transcript.length - 1;
  const [tour, setTour] = useState(0);
  useEffect(() => {
    if (lineIndex !== 1) { setTour(0); return; }
    const id = window.setInterval(() => setTour(n => n + 1), 2300);
    return () => window.clearInterval(id);
  }, [lineIndex]);
  /** Where the camera goes while the bailiff reads each line: the judge, then the jury and gallery, then each counsel. */
  const shot: ShotName | null = useMemo(() => {
    if (phase === 'idle') return null;
    if (phase === 'plea_complete' || phase === 'start_trial') return 'wide';
    if (lineIndex <= 0) return 'judge';
    if (lineIndex === 1) {
      const tourShots: ShotName[] = jurorIds.length ? ['jury', 'audience', 'judge'] : ['audience', 'judge'];
      return tourShots[tour % tourShots.length];
    }
    if (lineIndex === 2) return 'prosecution';
    if (lineIndex === 3) return 'defense';
    return 'judge';
  }, [phase, lineIndex, tour, jurorIds.length]);
  const stagePeople = useMemo(() => ({
    judge: { name: judgeName, avatar: faces.judge },
    prosecution: { name: prosecutorDisplayName, avatar: faces.prosecution },
    defense: { name: defenseDisplayName, avatar: faces.defense },
    bailiff: { name: 'Bailiff', avatar: BAILIFF_AVATAR }
  }), [judgeName, faces, prosecutorDisplayName, defenseDisplayName]);
  const stageJurors = useMemo(() => jurorIds.map(id => ({ id })), [jurorIds]);

  // Once the bailiff has announced the case and the plea is asked, the text area goes away so the plea buttons rise (no scrolling).
  const pleaPrompt = phase === 'defendant_plea' && canPlead && !canSkip && transcript.length > 0;
  /** Online prosecution: the defense is still entering the plea. */
  const awaitingPlea = online && !iDrive && phase === 'defendant_plea';
  /** Who may press START TRIAL / CONTINUE once the plea is in: the prosecution online; the one holding the phone otherwise. */
  const canStartTrial = !online || playerRole === 'prosecution';
  const star = cast[activeRole];
  const speakerTone: Record<string, string> = {
    bailiff: 'text-white',
    judge: 'text-[#FFD43B]',
    prosecution: 'text-[#FF7A7E]',
    defense: 'text-[#7FB2FF]'
  };

  const statusText =
    phase === 'idle'
      ? 'Awaiting trial to begin'
      : phase === 'bailiff_call'
        ? 'Bailiff calling court to order'
        : phase === 'case_announcement'
          ? 'Judge announcing case'
          : phase === 'counsel_appearances'
            ? 'Counsel stating appearances'
            : phase === 'defendant_plea'
              ? 'Awaiting defendant plea'
              : phase === 'plea_complete'
                ? pleaGuilty
                  ? 'Guilty plea accepted'
                  : 'Ready to begin trial'
                : phase === 'start_trial'
                  ? 'Starting trial...'
                  : '';

  return (
    <div className="relative min-h-[100dvh] bg-[#0b0d14] overflow-hidden">
      <SceneBackdrop />
      <div
        className="relative z-10 min-h-[100dvh] flex flex-col px-4"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
      >
        <header className="relative text-center max-w-md lg:max-w-2xl w-full mx-auto px-12">
          {onBack && (
            <button
              type="button"
              onClick={() => { cancelScript(); onBack(); }}
              aria-label="Back"
              className="absolute left-0 top-0 flex items-center justify-center w-10 h-10 rounded-full bg-black/55 border border-white/15 text-white active:bg-white/15"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <SpeechToggle className="absolute right-0 top-0" />
          <h1 className="logo-gold font-game text-4xl lg:text-5xl leading-none">COURT IS IN SESSION</h1>
          <p className="text-white/60 text-sm mt-2 truncate">{caseTitle}</p>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center gap-4 max-w-md lg:max-w-5xl w-full mx-auto py-4 lg:grid lg:grid-cols-2 lg:gap-x-12 lg:gap-y-5 lg:items-start lg:content-center">
          {show3D && (
            <Suspense fallback={<div className="w-full h-[46dvh] rounded-2xl bg-black/40 grid place-items-center text-white/60 text-sm">Entering the courtroom...</div>}>
              <Court3D
                mode="pretrial"
                className="w-full h-[46dvh] lg:h-[62dvh] rounded-2xl ring-1 ring-white/20 lg:col-start-1 lg:row-start-1 lg:row-span-2"
                {...stagePeople}
                playerRole={playerRole}
                active={activeRole}
                talking={talking && latest !== undefined}
                shot={shot}
                jurors={stageJurors}
                begun={phase !== 'idle'}
                controls
                onSeated={() => setSeated(true)}
                onJudgeSeated={() => { judgeSeatedRef.current = true; }}
                onFailed={() => setFailed3D(true)}
              />
            </Suspense>
          )}
          {!show3D && (
            <>
          {/* the speaker, large */}
          <div className="flex flex-col items-center lg:col-start-1 lg:row-start-1">
            <div
              className={`w-52 h-52 sm:w-60 sm:h-60 lg:w-72 lg:h-72 rounded-3xl overflow-hidden border-4 border-[#FFD43B] transition-shadow ${
                talking ? 'shadow-[0_8px_0_#B8860B,0_0_40px_rgba(255,212,59,0.45)]' : 'shadow-[0_8px_0_#B8860B]'
              }`}
            >
              <AvatarFace
                config={star.avatar}
                speaking={talking && latest !== undefined}
                rank={star.rank}
                label={`${star.role}: ${star.name}`}
              />
            </div>
            <p className="mt-5 font-game text-3xl text-white leading-none text-center">{star.name}</p>
            <p className="mt-1 text-sm text-white/60">
              {star.role}
              {activeRole !== 'judge' && activeRole !== 'bailiff' ? ` · ${LEVELS[star.rank - 1].title}` : ''}
            </p>
          </div>

          {/* the cast */}
          <div className="grid grid-cols-4 gap-2 w-full lg:col-start-1 lg:row-start-2 lg:max-w-md lg:mx-auto" aria-label="Who is in court">
            {(['bailiff', 'judge', 'prosecution', 'defense'] as const).map(key => {
              const member = cast[key];
              const on = key === activeRole && latest !== undefined;
              return (
                <div key={key} className="min-w-0 text-center">
                  <div
                    className={`aspect-square rounded-xl overflow-hidden transition-all ${
                      on ? 'ring-4 ring-[#FFD43B] shadow-[0_0_20px_rgba(255,212,59,0.5)]' : 'ring-1 ring-white/20 opacity-80'
                    }`}
                  >
                    <AvatarFace config={member.avatar} crop="face" rank={member.rank} label={`${member.role}: ${member.name}`} />
                  </div>
                  <p className="mt-1 text-[11px] text-white/70 truncate">{member.role}</p>
                </div>
              );
            })}
          </div>

            </>
          )}

          {/* subtitle: the line being spoken (hidden while the plea is asked) */}
          {!pleaPrompt && (
          <div className={`${PANEL_SOFT} w-full p-4 min-h-[6.5rem] lg:col-start-2 lg:row-start-1 lg:self-end`} aria-live="polite">
            {latest ? (
              <div key={transcript.length} className="animate-fade-in">
                <p className={`text-sm font-semibold mb-1 ${speakerTone[roleOf(latest.speaker)]}`}>{latest.speaker}</p>
                <p className="text-white/95 leading-relaxed">{latest.text}</p>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="font-game text-2xl text-white">Court is in session</p>
                <p className="text-white/60 text-sm mt-1">Tap the button to begin proceedings</p>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-3">
              {transcript.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setShowTranscript(v => !v)}
                  className="text-xs text-white/55 underline underline-offset-2"
                  aria-expanded={showTranscript}
                >
                  {showTranscript ? 'Hide transcript' : `Show transcript (${transcript.length})`}
                </button>
              ) : (
                <span />
              )}
              {canSkip && (
                <button
                  type="button"
                  onClick={() => skipRef.current?.()}
                  aria-label="Skip to the next line"
                  className="rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs text-white/85"
                >
                  Next ›
                </button>
              )}
            </div>
            {showTranscript && (
              <div className="mt-2 max-h-44 overflow-y-auto space-y-2 border-t border-white/10 pt-2">
                {transcript.map((entry, index) => (
                  <div key={index}>
                    <span className={`text-xs font-semibold ${speakerTone[roleOf(entry.speaker)]}`}>{entry.speaker}</span>
                    <p className="text-white/80 text-sm">{entry.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* what the player does now */}
          <div className="w-full lg:col-start-2 lg:row-start-2">
            {phase === 'idle' && online && (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={handleStart}
                  disabled={!iDrive || !bothSeated}
                  className={`${gameButton('gold', 'md')} w-full`}
                >
                  <Gavel className="w-6 h-6" />
                  {!iDrive ? 'WAITING FOR COURT TO OPEN' : show3D ? 'START' : 'ENTER COURT'}
                </button>
                <p className="text-white/60 text-xs text-center" aria-live="polite">
                  {seatNotice({ mySeated, opponentSeated, iDrive, opponentName })}
                </p>
              </div>
            )}

            {phase === 'idle' && !online && (
              show3D ? (
                <div className="flex flex-col items-center gap-2">
                  <button onClick={handleStart} disabled={!seated} className={`${gameButton('gold', 'md')} w-full`}>
                    <Gavel className="w-6 h-6" />
                    START
                  </button>
                  <p className="text-white/60 text-xs text-center">{seated ? 'You are seated. Press Start when you are ready.' : 'Walk to your chair at the counsel table to begin.'}</p>
                </div>
              ) : (
              <button onClick={handleStart} className={`${gameButton('gold', 'md')} w-full`}>
                <Gavel className="w-6 h-6" />
                ENTER COURT
              </button>
              )
            )}

            {awaitingPlea && (
              <p className="text-center text-white/70 text-sm" aria-live="polite">Waiting for {opponentName} to enter the plea…</p>
            )}

            {pleaPrompt && (
              <div>
                <p className="text-center text-white/70 text-sm mb-3">How does your client plead?</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handlePlea(false)} className={gameButton('gold', 'md')}>
                    NOT GUILTY
                  </button>
                  <button onClick={() => handlePlea(true)} className={gameButton('danger', 'md')}>
                    GUILTY
                  </button>
                </div>
              </div>
            )}

            {phase === 'plea_complete' && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-white/85 text-center">
                  {online && !canPlead
                    ? pleaGuilty
                      ? 'The Court accepts the defendant\'s guilty plea. The case will proceed to sentencing.'
                      : 'The Court notes the defendant\'s plea of not guilty. The trial will now begin.'
                    : pleaGuilty
                      ? 'The Court accepts your guilty plea. The case will proceed to sentencing.'
                      : 'The Court notes your plea of not guilty. The trial will now begin.'}
                </p>
                {online && !canStartTrial && (
                  <p className="text-white/60 text-sm text-center" aria-live="polite">Waiting for {opponentName} to start the trial…</p>
                )}
                {canStartTrial && !pleaGuilty && (
                  <button onClick={handleStartTrial} disabled={isLoadingJudgeRequest} className={`${gameButton('gold', 'md')} w-full`}>
                    {isLoadingJudgeRequest ? (
                      <>
                        <span className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent" />
                        PREPARING TRIAL...
                      </>
                    ) : (
                      <>
                        <Gavel className="w-6 h-6" />
                        START TRIAL
                      </>
                    )}
                  </button>
                )}
                {canStartTrial && pleaGuilty && (
                  <button onClick={() => onComplete(true, judgeName, npcProsecutorName)} className={`${gameButton('ghost', 'md')} w-full`}>
                    CONTINUE
                  </button>
                )}
              </div>
            )}

            {phase === 'start_trial' && isLoadingJudgeRequest && (
              <div className="flex items-center justify-center gap-3 text-white/80">
                <span className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
                <span>Judge is preparing opening statement request...</span>
              </div>
            )}
          </div>
        </main>

        <p className="text-center text-white/45 text-xs">{statusText}</p>
      </div>
    </div>
  );
}
