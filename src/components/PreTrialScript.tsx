import { useMemo, useState } from 'react';
import { Gavel } from 'lucide-react';
import { BAILIFF_PROMPTS, JUDGE_PROMPTS, getRandomJudgeName, getRandomProsecutorName } from '../lib/trialConfig';
import type { PlayerRole } from '../types';
import { speakAs } from '../lib/speech';
import { useAuth } from '../contexts/AuthContext';
import AvatarFace from './AvatarFace';
import SceneBackdrop from './SceneBackdrop';
import { gameButton, PANEL_SOFT } from './ui';
import { TTS_SUPPORTED, useRecentPulse, useTtsSpeaking } from './stage/signals';
import { BAILIFF_AVATAR, getUserAvatar, type AvatarConfig } from '../lib/avatars';
import { aiRank, castAvatars } from '../lib/stageCast';
import { LEVELS, getLevelForWins } from '../lib/levels';
import type { StageSpeaker } from '../lib/stageSpeaker';

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
}

type PreTrialPhase =
  | 'idle'
  | 'bailiff_call'
  | 'case_announcement'
  | 'counsel_appearances'
  | 'defendant_plea'
  | 'plea_complete'
  | 'start_trial';

export default function PreTrialScript({ caseTitle, userName, judgeName: judgeNameProp, prosecutorName: prosecutorNameProp, playerRole = 'defense', sessionId = '', playerWins = 0, onComplete }: PreTrialScriptProps) {
  const [phase, setPhase] = useState<PreTrialPhase>('idle');
  // Fall back to a fresh random pick only if a caller doesn't supply one
  // (e.g. an old session created before this was lifted to App.tsx).
  const [judgeName] = useState(judgeNameProp || getRandomJudgeName());
  // The NPC attorney pool name (e.g. "District Attorney Harrison") is only
  // ever actually spoken for whichever side the human ISN'T playing — the
  // human is addressed by their own name, same as defense always was
  // before prosecution became a selectable role.
  const [npcProsecutorName] = useState(prosecutorNameProp || getRandomProsecutorName());
  const prosecutorDisplayName = playerRole === 'prosecution' ? userName : npcProsecutorName;
  const defenseDisplayName = playerRole === 'defense' ? userName : 'Defense Counsel';
  const [transcript, setTranscript] = useState<Array<{ speaker: string; text: string }>>([]);
  const [pleaGuilty, setPleaGuilty] = useState<boolean | null>(null);
  const [isLoadingJudgeRequest, setIsLoadingJudgeRequest] = useState(false);

  const addTranscript = (speaker: string, text: string) => {
    setTranscript(prev => [...prev, { speaker, text }]);
  };

  const handleStart = () => {
    setPhase('bailiff_call');
    const bailiffText = `All rise. Court is now in session. The Honorable ${judgeName} presiding.`;
    addTranscript('Bailiff', bailiffText);
    speakAs('recorder', bailiffText);

    setTimeout(() => {
      setPhase('case_announcement');
      const caseText = `This is the case of ${caseTitle}. Counsel, please state your appearances.`;
      addTranscript(judgeName, caseText);
      speakAs('judge', caseText);

      setTimeout(() => {
        setPhase('counsel_appearances');
        const prosecutorText = `For the prosecution, ${prosecutorDisplayName}.`;
        addTranscript(prosecutorDisplayName, prosecutorText);
        speakAs('counsel', prosecutorText);

        setTimeout(() => {
          const defenseText = `For the defense, ${defenseDisplayName}, representing the defendant.`;
          addTranscript(defenseDisplayName, defenseText);
          speakAs('counsel', defenseText);

          setTimeout(() => {
            setPhase('defendant_plea');
            const pleaText = 'Defendant, how do you plead to the charges before this court?';
            addTranscript(judgeName, pleaText);
            speakAs('judge', pleaText);
          }, 3000);
        }, 3000);
      }, 4000);
    }, 4000);
  };

  const handlePlea = (guilty: boolean) => {
    const pleaText = guilty ? 'Guilty, Your Honor.' : 'Not guilty, Your Honor.';
    addTranscript('Defendant', pleaText);
    setPleaGuilty(guilty);
    setPhase('plea_complete');
  };

  const handleStartTrial = () => {
    if (pleaGuilty === null) return;

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
    () => castAvatars({ judgeName: judgeNameProp, prosecutorName: prosecutorNameProp, playerRole, myAvatar, sessionId }),
    [judgeNameProp, prosecutorNameProp, playerRole, myAvatar, sessionId]
  );
  const myRank = getLevelForWins(playerWins).level;
  const cast: Record<'bailiff' | 'judge' | 'prosecution' | 'defense', { name: string; role: string; avatar: AvatarConfig; rank: number }> = {
    bailiff: { name: 'Bailiff', role: 'Bailiff', avatar: BAILIFF_AVATAR, rank: 1 },
    judge: { name: judgeName, role: 'Judge', avatar: faces.judge, rank: 6 },
    prosecution: {
      name: prosecutorDisplayName,
      role: 'Prosecution',
      avatar: faces.prosecution,
      rank: playerRole === 'prosecution' ? myRank : aiRank(prosecutorNameProp || 'Prosecution')
    },
    defense: {
      name: defenseDisplayName,
      role: 'Defense',
      avatar: faces.defense,
      rank: playerRole === 'defense' ? myRank : aiRank(`${sessionId}-Defense Counsel`)
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
  const talking = TTS_SUPPORTED ? ttsSpeaking : recentLine;
  const [showTranscript, setShowTranscript] = useState(false);
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
        <header className="text-center max-w-md w-full mx-auto">
          <h1 className="logo-gold font-game text-4xl leading-none">COURT IS IN SESSION</h1>
          <p className="text-white/60 text-sm mt-2 truncate">{caseTitle}</p>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center gap-4 max-w-md w-full mx-auto py-4">
          {/* the speaker, large */}
          <div className="flex flex-col items-center">
            <div
              className={`w-52 h-52 sm:w-60 sm:h-60 rounded-3xl overflow-hidden border-4 border-[#FFD43B] transition-shadow ${
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
          <div className="grid grid-cols-4 gap-2 w-full" aria-label="Who is in court">
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

          {/* subtitle: the line being spoken */}
          <div className={`${PANEL_SOFT} w-full p-4 min-h-[6.5rem]`} aria-live="polite">
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
            {transcript.length > 1 && (
              <button
                type="button"
                onClick={() => setShowTranscript(v => !v)}
                className="mt-3 text-xs text-white/55 underline underline-offset-2"
                aria-expanded={showTranscript}
              >
                {showTranscript ? 'Hide transcript' : `Show transcript (${transcript.length})`}
              </button>
            )}
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

          {/* what the player does now */}
          <div className="w-full">
            {phase === 'idle' && (
              <button onClick={handleStart} className={`${gameButton('gold', 'md')} w-full`}>
                <Gavel className="w-6 h-6" />
                ENTER COURT
              </button>
            )}

            {phase === 'defendant_plea' && transcript.length > 0 && (
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
                  {pleaGuilty
                    ? 'The Court accepts your guilty plea. The case will proceed to sentencing.'
                    : 'The Court notes your plea of not guilty. The trial will now begin.'}
                </p>
                {!pleaGuilty && (
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
                {pleaGuilty && (
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
