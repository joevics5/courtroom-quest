import { useState, useEffect } from 'react';
import { Scale, Trophy, XCircle, CheckCircle, Home, Share2, Download, FileText } from 'lucide-react';
import type { Verdict, TrialEvent } from '../types';
import { db } from '../lib/database';
import TranscriptViewer from './TranscriptViewer';

interface VerdictDisplayProps {
  verdict: Verdict;
  caseTitle: string;
  currentLevel: string;
  onReturnHome: () => void;
}

export default function VerdictDisplay({ verdict, caseTitle, currentLevel, onReturnHome }: VerdictDisplayProps) {
  const isWin = verdict.outcome === 'win';
  const [shareMessage, setShareMessage] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptEvents, setTranscriptEvents] = useState<TrialEvent[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  const loadTranscript = async () => {
    if (transcriptEvents.length > 0) {
      setShowTranscript(true);
      return;
    }

    try {
      setLoadingTranscript(true);
      const events = await db.trialEvents.getSessionEvents(verdict.session_id);
      setTranscriptEvents(events);
      setShowTranscript(true);
    } catch (error) {
      console.error('Failed to load transcript:', error);
      alert('Failed to load transcript. Please try again.');
    } finally {
      setLoadingTranscript(false);
    }
  };

  const handleShare = async () => {
    const shareText = `🏛️ CASE WON!\n\n${caseTitle}\nVerdict: ${verdict.outcome === 'win' ? 'Not Guilty' : 'Guilty'}\nRank Achieved: ${currentLevel}\nScore: ${verdict.score || 0}/100\n\nPlay AI Courtroom now!`;

    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(shareText);
      setShareMessage('Copied to clipboard!');
      setTimeout(() => setShareMessage(''), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
      <div className="max-w-3xl w-full">
        {isWin && (
          <div className="mb-8 bg-gradient-to-br from-amber-600 to-yellow-500 rounded-2xl p-8 border-4 border-amber-400 shadow-2xl animate-pulse">
            <div className="text-center">
              <div className="text-6xl mb-4">🏛️</div>
              <h2 className="text-3xl font-bold text-white mb-2">CASE WON</h2>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-6 mb-4">
                <p className="text-xl font-semibold text-white mb-2">{caseTitle}</p>
                <p className="text-lg text-white/90 mb-1">Verdict: Not Guilty</p>
                <p className="text-lg text-white/90 mb-1">Rank Achieved: {currentLevel}</p>
                {verdict.score && (
                  <p className="text-lg text-white/90">Score: {verdict.score}/100</p>
                )}
              </div>
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-white text-amber-600 rounded-lg font-semibold hover:bg-amber-50 transition-colors"
              >
                <Share2 className="w-5 h-5" />
                Share Victory
              </button>
              {shareMessage && (
                <p className="mt-2 text-white text-sm">{shareMessage}</p>
              )}
            </div>
          </div>
        )}

        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 ${
            isWin ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {isWin ? (
              <Trophy className="w-12 h-12 text-white" />
            ) : (
              <XCircle className="w-12 h-12 text-white" />
            )}
          </div>
          <h1 className={`text-4xl font-bold mb-2 ${
            isWin ? 'text-green-400' : 'text-red-400'
          }`}>
            {isWin ? 'Victory' : 'Case Dismissed'}
          </h1>
          <p className="text-slate-400 text-lg">The court has delivered its verdict</p>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="border-b border-slate-700 px-6 py-4 bg-slate-750">
            <div className="flex items-center gap-3">
              <Scale className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">Judge's Decision</h2>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Outcome
              </h3>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                isWin
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                {isWin ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                <span className="font-semibold capitalize">{verdict.outcome}</span>
              </div>
            </div>

            {verdict.score !== undefined && (
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Performance Score
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        verdict.score >= 80
                          ? 'bg-green-500'
                          : verdict.score >= 60
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${verdict.score}%` }}
                    />
                  </div>
                  <span className="text-2xl font-bold text-white">{verdict.score}</span>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Reasoning
              </h3>
              <div className="bg-slate-750 rounded-lg p-4 border border-slate-600">
                <p className="text-slate-200 leading-relaxed">{verdict.reasoning}</p>
              </div>
            </div>

            {verdict.evidence_cited && verdict.evidence_cited.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Evidence Cited
                </h3>
                <div className="flex flex-wrap gap-2">
                  {verdict.evidence_cited.map((exhibit, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded text-blue-400 text-sm font-medium"
                    >
                      {exhibit}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {verdict.missed_opportunities && verdict.missed_opportunities.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Missed Opportunities
                </h3>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <ul className="space-y-2">
                    {verdict.missed_opportunities.map((opportunity, idx) => (
                      <li key={idx} className="text-yellow-300 text-sm flex items-start gap-2">
                        <span className="text-yellow-500 mt-1">•</span>
                        <span>{opportunity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <button
            onClick={loadTranscript}
            disabled={loadingTranscript}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="w-5 h-5" />
            {loadingTranscript ? 'Loading...' : 'View Transcript'}
          </button>
          <button
            onClick={onReturnHome}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Home className="w-5 h-5" />
            Return to Cases
          </button>
        </div>

        {showTranscript && (
          <TranscriptViewer
            events={transcriptEvents}
            caseTitle={caseTitle}
            onClose={() => setShowTranscript(false)}
          />
        )}
      </div>
    </div>
  );
}
