import { useState, useEffect } from 'react';
import { Scale, Play, Gavel } from 'lucide-react';
import { BAILIFF_PROMPTS, JUDGE_PROMPTS, getRandomJudgeName, getRandomProsecutorName } from '../lib/trialConfig';

interface PreTrialScriptProps {
  caseTitle: string;
  userName: string;
  judgeName: string;
  prosecutorName: string;
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

export default function PreTrialScript({ caseTitle, userName, judgeName: judgeNameProp, prosecutorName: prosecutorNameProp, onComplete }: PreTrialScriptProps) {
  const [phase, setPhase] = useState<PreTrialPhase>('idle');
  // Fall back to a fresh random pick only if a caller doesn't supply one
  // (e.g. an old session created before this was lifted to App.tsx).
  const [judgeName] = useState(judgeNameProp || getRandomJudgeName());
  const [prosecutorName] = useState(prosecutorNameProp || getRandomProsecutorName());
  const [transcript, setTranscript] = useState<Array<{ speaker: string; text: string }>>([]);
  const [pleaGuilty, setPleaGuilty] = useState<boolean | null>(null);
  const [isLoadingJudgeRequest, setIsLoadingJudgeRequest] = useState(false);

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const addTranscript = (speaker: string, text: string) => {
    setTranscript(prev => [...prev, { speaker, text }]);
  };

  const handleStart = () => {
    setPhase('bailiff_call');
    const bailiffText = `All rise. Court is now in session. The Honorable ${judgeName} presiding.`;
    addTranscript('Bailiff', bailiffText);
    speakText(bailiffText);

    setTimeout(() => {
      setPhase('case_announcement');
      const caseText = `This is the case of ${caseTitle}. Counsel, please state your appearances.`;
      addTranscript(judgeName, caseText);
      speakText(caseText);

      setTimeout(() => {
        setPhase('counsel_appearances');
        const prosecutorText = `For the prosecution, ${prosecutorName}.`;
        addTranscript(prosecutorName, prosecutorText);
        speakText(prosecutorText);

        setTimeout(() => {
          const defenseText = `For the defense, ${userName}, representing the defendant.`;
          addTranscript(userName, defenseText);
          speakText(defenseText);

          setTimeout(() => {
            setPhase('defendant_plea');
            const pleaText = 'Defendant, how do you plead to the charges before this court?';
            addTranscript(judgeName, pleaText);
            speakText(pleaText);
          }, 3000);
        }, 3000);
      }, 4000);
    }, 4000);
  };

  const handlePlea = (guilty: boolean) => {
    const pleaText = guilty ? 'Guilty, Your Honor.' : 'Not guilty, Your Honor.';
    addTranscript('Defendant', pleaText);
    speakText(pleaText);
    setPleaGuilty(guilty);
    setPhase('plea_complete');
  };

  const handleStartTrial = () => {
    if (pleaGuilty === null) return;

    // If guilty plea, complete immediately
    if (pleaGuilty) {
      onComplete(true, judgeName, prosecutorName);
      return;
    }

    // Not guilty — hand off to the trial immediately. The trial's own
    // phase 7 (Opening Statement - Prosecution) already generates the
    // judge's "you may proceed with your opening statement" line
    // correctly. Generating a second version of that line here, in
    // pre-trial, was duplicating it.
    onComplete(false, judgeName, prosecutorName);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Scale className="w-8 h-8 text-amber-400" />
            <h1 className="text-3xl font-bold text-white">Court Session</h1>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-6 mb-6 min-h-[400px] max-h-[500px] overflow-y-auto">
            {phase === 'idle' ? (
              <div className="flex flex-col items-center justify-center h-full py-16">
                <Scale className="w-16 h-16 text-amber-400 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Court is in session</h2>
                <p className="text-white/60 mb-8">Click start to begin proceedings</p>
                <button
                  onClick={handleStart}
                  className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all"
                >
                  <Play className="w-5 h-5" />
                  Start Proceedings
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {transcript.map((entry, index) => (
                  <div key={index} className="animate-fade-in">
                    <div className="text-blue-400 font-semibold mb-1">{entry.speaker}</div>
                    <div className="text-white/90 pl-4">{entry.text}</div>
                  </div>
                ))}

                {phase === 'defendant_plea' && transcript.length > 0 && (
                  <div className="flex gap-4 justify-center mt-8 pt-8 border-t border-white/10">
                    <button
                      onClick={() => handlePlea(true)}
                      className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all"
                    >
                      Guilty
                    </button>
                    <button
                      onClick={() => handlePlea(false)}
                      className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all"
                    >
                      Not Guilty
                    </button>
                  </div>
                )}

                {phase === 'plea_complete' && (
                  <div className="flex flex-col items-center justify-center mt-8 pt-8 border-t border-white/10">
                    <p className="text-white/80 mb-6 text-center">
                      {pleaGuilty 
                        ? 'The Court accepts your guilty plea. The case will proceed to sentencing.'
                        : 'The Court notes your plea of not guilty. The trial will now begin.'}
                    </p>
                    {!pleaGuilty && (
                      <button
                        onClick={handleStartTrial}
                        disabled={isLoadingJudgeRequest}
                        className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoadingJudgeRequest ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                            <span>Preparing trial...</span>
                          </>
                        ) : (
                          <>
                            <Gavel className="w-5 h-5" />
                            <span>Start Trial</span>
                          </>
                        )}
                      </button>
                    )}
                    {pleaGuilty && (
                      <button
                        onClick={() => onComplete(true, judgeName, prosecutorName)}
                        className="px-8 py-4 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold transition-all"
                      >
                        Continue
                      </button>
                    )}
                  </div>
                )}

                {phase === 'start_trial' && isLoadingJudgeRequest && (
                  <div className="flex items-center justify-center mt-8 pt-8 border-t border-white/10">
                    <div className="flex items-center gap-3 text-white/80">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                      <span>Judge is preparing opening statement request...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-center text-white/60 text-sm">
              {phase === 'idle' && 'Awaiting trial to begin'}
              {phase === 'bailiff_call' && 'Bailiff calling court to order'}
              {phase === 'case_announcement' && 'Judge announcing case'}
              {phase === 'counsel_appearances' && 'Counsel stating appearances'}
              {phase === 'defendant_plea' && 'Awaiting defendant plea'}
              {phase === 'plea_complete' && (pleaGuilty ? 'Guilty plea accepted' : 'Ready to begin trial')}
              {phase === 'start_trial' && 'Starting trial...'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
