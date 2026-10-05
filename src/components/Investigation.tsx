import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, FileText, Info, Mic, Send, User, Users } from 'lucide-react';
import { db } from '../lib/database';
import EvidenceViewer from './EvidenceViewer';
import HeroBackground from './HeroBackground';
import InitialsAvatar from './InitialsAvatar';
import { getEvidenceIcon, formatEvidenceType } from '../lib/evidenceDisplay';
import { generateWitnessResponse as generateAIWitnessResponse } from '../lib/ai/trialAI';
import { useSpeechRecognition } from '../lib/useSpeechRecognition';
import { speakAs } from '../lib/speech';
import type { Evidence, Witness, WitnessInteraction, CaseSession, Case } from '../types';

interface InvestigationProps {
  session: CaseSession | null;
  onProceedToTrial: () => void;
  onBack: () => void;
  showCaseReview?: boolean;
  caseForReview?: Case | null;
  onReviewAccept?: () => void;
  onReviewReject?: () => void;
}

export default function Investigation({ session, onProceedToTrial, onBack, showCaseReview = false, caseForReview, onReviewAccept, onReviewReject }: InvestigationProps) {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'evidence' | 'witnesses'>('overview');
  const [caseDetails, setCaseDetails] = useState<any>(null);
  const [selectedWitness, setSelectedWitness] = useState<Witness | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [question, setQuestion] = useState('');
  const { isListening, isSupported: speechSupported, start: startListening, stop: stopListening } = useSpeechRecognition({
    onResult: (transcript) => {
      setQuestion(prev => prev ? `${prev} ${transcript}` : transcript);
    },
    onError: (message) => {
      console.warn('[Investigation] Speech recognition:', message);
    }
  });
  const [interactions, setInteractions] = useState<WitnessInteraction[]>([]);
  const [isQuestioningLoading, setIsQuestioningLoading] = useState(false);
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showWitnessInfo, setShowWitnessInfo] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session]);

  useEffect(() => {
    if (showCaseReview && caseForReview) {
      setShowPitchModal(true);
    }
  }, [showCaseReview, caseForReview]);

  // Reset accordion when witness changes
  useEffect(() => {
    setShowWitnessInfo(false);
  }, [selectedWitness?.id]);

  // Auto-scroll to bottom when new interactions are added or loading state changes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [interactions, isQuestioningLoading, selectedWitness]);

  const loadData = async () => {
    try {
      const [evidenceData, witnessData, interactionData, caseData] = await Promise.all([
        db.evidence.getCaseEvidence(session.case_id),
        db.witnesses.getCaseWitnesses(session.case_id),
        db.interactions.getSessionInteractions(session.id),
        db.cases.getCaseWithDetails(session.case_id)
      ]);

      setEvidence(evidenceData);
      setWitnesses(witnessData);
      setInteractions(interactionData);
      setCaseDetails(caseData);
    } catch (error) {
      console.error('Failed to load investigation data:', error);
    }
  };

  const handleAskQuestion = async () => {
    if (!selectedWitness || !question.trim()) return;

    console.log('handleAskQuestion called');
    console.log('Witness:', selectedWitness.name);
    console.log('Question:', question);
    
    setIsQuestioningLoading(true);
    try {
      // Get previous interactions with this witness for context
      const previousInteractions = getWitnessInteractions(selectedWitness.id).map(i => ({
        question: i.question,
        response: i.response
      }));

      console.log('Previous interactions:', previousInteractions.length);
      
      // Generate AI-powered response using Gemini
      console.log('Calling generateAIWitnessResponse...');
      const response = await generateAIWitnessResponse(
        selectedWitness,
        question.trim(),
        previousInteractions
      );
      
      console.log('Received response:', response.substring(0, 100) + '...');
      speakAs('witness', response);

      const interaction = await db.interactions.addInteraction({
        session_id: session.id,
        witness_id: selectedWitness.id,
        question: question.trim(),
        response,
        phase: 'pre_trial',
        interaction_order: interactions.length + 1
      });

      setInteractions([...interactions, interaction]);
      setQuestion('');
    } catch (error) {
      console.error('Failed to record interaction:', error);
      const message = error instanceof Error ? error.message : String(error);
      alert(`Failed to get witness response: ${message}`);
    } finally {
      setIsQuestioningLoading(false);
    }
  };


  const getWitnessInteractions = (witnessId: string) => {
    return interactions.filter(i => i.witness_id === witnessId);
  };

  const handleAcceptCase = () => {
    setShowPitchModal(false);
    setShowAcceptModal(true);
  };

  const handleBeginInvestigation = () => {
    setShowAcceptModal(false);
    if (onReviewAccept) {
      onReviewAccept();
    }
  };

  const defendantName =
    caseForReview?.defendant_name ||
    (caseForReview?.truth_state as any)?.defendant_name ||
    caseDetails?.defendant_name ||
    (caseDetails?.truth_state as any)?.defendant_name ||
    '';

  const reviewModals = (
    <>
      {showPitchModal && caseForReview && (
        <CaseBriefModal
          caseForReview={caseForReview}
          defendantName={defendantName || 'The defendant'}
          onReject={() => {
            setShowPitchModal(false);
            onReviewReject?.();
          }}
          onAccept={handleAcceptCase}
        />
      )}
      {showAcceptModal && caseForReview && (
        <AcceptedModal defendantName={defendantName || 'the defendant'} onBegin={handleBeginInvestigation} />
      )}
    </>
  );

  if (selectedEvidence) {
    return (
      <EvidenceViewer
        evidence={selectedEvidence}
        onBack={() => setSelectedEvidence(null)}
      />
    );
  }

  // Reviewing a case before a game exists: just the brief, over the game background
  if (!session && showCaseReview) {
    return (
      <div className="relative min-h-[100dvh] bg-[#0b0d14]">
        <HeroBackground overlay="from-black/85 via-black/80 to-black/90" />
        {reviewModals}
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const totalQuestions = interactions.length;
  const safeTop = { paddingTop: 'max(env(safe-area-inset-top), 12px)' };
  const safeBottom = { paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' };

  /* ───────────── Witness interview: a chat, full screen ───────────── */
  if (selectedWitness) {
    const history = getWitnessInteractions(selectedWitness.id);
    return (
      <div className="relative h-[100dvh] overflow-hidden bg-[#0b0d14]">
        <HeroBackground overlay="from-black/85 via-black/80 to-black/90" />
        <div className="relative z-10 h-full flex flex-col max-w-2xl mx-auto">
          <div className="flex-none px-4 pb-3 border-b border-white/10 bg-black/40 backdrop-blur-sm" style={safeTop}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedWitness(null)}
                aria-label="Back to witnesses"
                className="flex-none flex items-center justify-center w-11 h-11 rounded-full bg-black/55 border border-white/15 text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <InitialsAvatar name={selectedWitness.name} size="md" />
              <div className="flex-1 min-w-0">
                <h2 className="font-game text-3xl text-white leading-none truncate">{selectedWitness.name}</h2>
                <p className="text-sm text-white/60 capitalize truncate">{selectedWitness.role}</p>
              </div>
              <button
                onClick={() => setShowWitnessInfo(!showWitnessInfo)}
                aria-expanded={showWitnessInfo}
                className="flex-none flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-3 h-9 text-xs font-bold text-white"
              >
                INFO
                <ChevronDown className={`w-4 h-4 transition-transform ${showWitnessInfo ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {showWitnessInfo && (
              <div className="mt-3 space-y-2 max-h-[40dvh] overflow-y-auto">
                <div className="rounded-2xl bg-white/5 border border-white/15 p-3">
                  <h3 className="text-[11px] font-black tracking-widest text-[#FFD43B] mb-1">BACKGROUND</h3>
                  <p className="text-sm text-white/80 leading-relaxed">{selectedWitness.background}</p>
                </div>
                <div className="rounded-2xl bg-[#FFD43B]/10 border border-[#F2B705]/40 p-3">
                  <h3 className="text-[11px] font-black tracking-widest text-[#FFD43B] mb-1">WRITTEN TESTIMONY</h3>
                  <p className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed">{selectedWitness.base_testimony}</p>
                </div>
              </div>
            )}
          </div>

          <div ref={chatContainerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
            {history.length === 0 && !isQuestioningLoading && (
              <div className="text-center py-10">
                <Users className="w-10 h-10 mx-auto text-white/25 mb-3" />
                <p className="font-game text-2xl text-white/80">NO QUESTIONS YET</p>
                <p className="text-sm text-white/50 mt-1">Ask {selectedWitness.name.split(' ')[0]} what they saw. Look for gaps.</p>
              </div>
            )}

            {history.map(interaction => (
              <div key={interaction.id} className="space-y-2">
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#FFD43B]/15 border border-[#FFD43B]/40 px-4 py-2.5">
                    <div className="text-[10px] font-black tracking-widest text-[#FFD43B] mb-0.5">YOU</div>
                    <p className="text-white leading-snug">{interaction.question}</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 border border-white/15 px-4 py-2.5">
                    <div className="text-[10px] font-black tracking-widest text-white/50 mb-0.5">{selectedWitness.name.toUpperCase()}</div>
                    <p className="text-white/90 leading-snug">{interaction.response}</p>
                  </div>
                </div>
              </div>
            ))}

            {isQuestioningLoading && (
              <div className="space-y-2">
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#FFD43B]/15 border border-[#FFD43B]/40 px-4 py-2.5">
                    <div className="text-[10px] font-black tracking-widest text-[#FFD43B] mb-0.5">YOU</div>
                    <p className="text-white leading-snug">{question}</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-white/10 border border-white/15 px-4 py-3 flex items-center gap-1.5" aria-label={`${selectedWitness.name} is thinking`}>
                    <span className="animate-pulse text-white/60">●</span>
                    <span className="animate-pulse text-white/60" style={{ animationDelay: '0.2s' }}>●</span>
                    <span className="animate-pulse text-white/60" style={{ animationDelay: '0.4s' }}>●</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex-none px-4 pt-3 border-t border-white/10 bg-black/50 backdrop-blur-sm" style={safeBottom}>
            <div className="flex items-end gap-2">
              <div className="relative flex-1">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAskQuestion();
                    }
                  }}
                  placeholder={`Ask ${selectedWitness.name.split(' ')[0]} a question…`}
                  disabled={isQuestioningLoading}
                  rows={2}
                  className="w-full px-4 py-3 pr-12 bg-black/50 border border-white/20 rounded-2xl text-white placeholder-white/35 focus:outline-none focus:border-[#FFD43B] resize-none"
                />
                {speechSupported && (
                  <button
                    type="button"
                    onClick={() => (isListening ? stopListening() : startListening())}
                    disabled={isQuestioningLoading}
                    title={isListening ? 'Stop recording' : 'Speak your question'}
                    className={`absolute right-2 top-2 w-9 h-9 flex items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                      isListening ? 'bg-red-600 animate-pulse' : 'bg-white/15 hover:bg-white/25'
                    }`}
                  >
                    <Mic className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>
              <button
                onClick={handleAskQuestion}
                disabled={!question.trim() || isQuestioningLoading}
                aria-label="Send question"
                className="flex-none flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FFD43B] text-black border-b-4 border-[#B8860B] active:translate-y-0.5 active:border-b-2 transition-all disabled:opacity-40 disabled:grayscale"
              >
                <Send className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
        {reviewModals}
      </div>
    );
  }

  /* ───────────── Main investigation screen ───────────── */
  const tabs: Array<{ key: 'overview' | 'evidence' | 'witnesses'; label: string; icon: typeof Info; count?: number }> = [
    { key: 'overview', label: 'BRIEF', icon: Info },
    { key: 'evidence', label: 'EVIDENCE', icon: FileText, count: evidence.length },
    { key: 'witnesses', label: 'WITNESSES', icon: Users, count: witnesses.length }
  ];

  const caseTypeLabel = caseDetails?.case_type ? String(caseDetails.case_type).replace(/_/g, ' ') : '';
  const shownDefendant = caseDetails?.defendant_name || (caseDetails?.truth_state as any)?.defendant_name;
  const interviewedCount = new Set(interactions.map(i => i.witness_id)).size;

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#0b0d14]">
      <HeroBackground overlay="from-black/85 via-black/80 to-black/90" />

      <div className="relative z-10 h-full flex flex-col max-w-2xl mx-auto">
        <div className="flex-none px-4" style={safeTop}>
          <header className="flex items-center gap-3">
            <button
              onClick={onBack}
              aria-label="Back"
              className="flex-none flex items-center justify-center w-11 h-11 rounded-full bg-black/55 border border-white/15 text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="logo-gold font-game text-4xl leading-none">INVESTIGATION</h1>
              <p className="text-white/60 text-xs mt-1 truncate">{caseDetails?.title || 'Examine the evidence. Question the witnesses.'}</p>
            </div>
          </header>

          <nav className="mt-3 grid grid-cols-3 gap-2" aria-label="Investigation sections">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = selectedTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setSelectedTab(tab.key)}
                  aria-pressed={active}
                  className={`flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-black tracking-wide transition-all border-b-4 active:translate-y-0.5 active:border-b-2 ${
                    active ? 'bg-[#FFD43B] text-black border-[#B8860B]' : 'bg-black/60 text-white/80 border-white/20 border-x border-t border-x-white/10 border-t-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`rounded-full px-1.5 min-w-[20px] text-[11px] leading-5 ${active ? 'bg-black/15' : 'bg-white/15'}`}>{tab.count}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
          {selectedTab === 'overview' && (
            caseDetails ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {caseTypeLabel && (
                    <span className="rounded-full bg-sky-500/20 border border-sky-400/50 px-3 py-1 text-xs font-black tracking-wide text-sky-200 uppercase">{caseTypeLabel}</span>
                  )}
                  {shownDefendant && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-bold text-white/85">
                      <User className="w-3.5 h-3.5" /> Defendant: {shownDefendant}
                    </span>
                  )}
                </div>

                <div className="rounded-3xl bg-black/65 border border-white/15 backdrop-blur-sm p-5">
                  <h2 className="font-game text-4xl text-white leading-none">{caseDetails.title}</h2>
                  <p className="mt-3 text-[15px] text-white/80 leading-relaxed whitespace-pre-line">{caseDetails.description}</p>
                </div>

                {caseDetails.case_summary && (
                  <div className="rounded-3xl bg-black/65 border border-white/15 backdrop-blur-sm p-5">
                    <h3 className="text-[11px] font-black tracking-widest text-[#FFD43B] mb-2">CASE SUMMARY</h3>
                    <p className="text-[15px] text-white/80 leading-relaxed whitespace-pre-line">{caseDetails.case_summary}</p>
                  </div>
                )}

                <div className="rounded-3xl bg-black/65 border border-white/15 backdrop-blur-sm p-4">
                  <h3 className="font-game text-2xl text-white/90 leading-none mb-3">YOUR GAME PLAN</h3>
                  <ol className="space-y-2">
                    <li>
                      <button onClick={() => setSelectedTab('evidence')} className="w-full flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 p-3 text-left">
                        <span className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-[#FFD43B] text-black font-black text-sm">1</span>
                        <span className="flex-1 text-white font-semibold">Review the evidence</span>
                        <ChevronRight className="w-5 h-5 text-[#FFD43B]" />
                      </button>
                    </li>
                    <li>
                      <button onClick={() => setSelectedTab('witnesses')} className="w-full flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 p-3 text-left">
                        <span className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-[#FFD43B] text-black font-black text-sm">2</span>
                        <span className="flex-1 text-white font-semibold">Interview the witnesses</span>
                        <ChevronRight className="w-5 h-5 text-[#FFD43B]" />
                      </button>
                    </li>
                    <li className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 p-3">
                      <span className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-[#FFD43B] text-black font-black text-sm">3</span>
                      <span className="flex-1 text-white font-semibold">Take it to trial</span>
                    </li>
                  </ol>
                </div>
              </>
            ) : (
              <p className="text-center text-white/50 py-10">Loading the case file…</p>
            )
          )}

          {selectedTab === 'evidence' && (
            evidence.length === 0 ? (
              <p className="text-center text-white/50 py-10">No evidence available</p>
            ) : (
              evidence.map(item => {
                const Icon = getEvidenceIcon(item.evidence_type);
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedEvidence(item)}
                    className="w-full flex items-center gap-3 rounded-2xl bg-black/65 border border-white/15 backdrop-blur-sm p-3 text-left border-b-4 border-b-white/25 active:translate-y-0.5 active:border-b-2 transition-all"
                  >
                    <span className="flex-none flex items-center justify-center w-14 h-14 rounded-xl bg-amber-500 text-black font-game text-3xl">
                      {(item.exhibit_label || 'E').replace(/exhibit\s*/i, '').slice(0, 2)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-white leading-tight">{item.title}</span>
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/70">
                        <Icon className="w-3 h-3" /> {formatEvidenceType(item.evidence_type)}
                      </span>
                      {item.description && <span className="block mt-1 text-sm text-white/60 line-clamp-2">{item.description}</span>}
                    </span>
                    <ChevronRight className="flex-none w-5 h-5 text-[#FFD43B]" />
                  </button>
                );
              })
            )
          )}

          {selectedTab === 'witnesses' && (
            witnesses.length === 0 ? (
              <p className="text-center text-white/50 py-10">No witnesses available</p>
            ) : (
              <>
                <p className="text-sm text-white/60 px-1">Tap a witness to interview them. Their answers are saved for your trial.</p>
                {witnesses.map(witness => {
                  const count = getWitnessInteractions(witness.id).length;
                  return (
                    <button
                      key={witness.id}
                      onClick={() => setSelectedWitness(witness)}
                      className="w-full flex items-center gap-3 rounded-2xl bg-black/65 border border-white/15 backdrop-blur-sm p-3 text-left border-b-4 border-b-white/25 active:translate-y-0.5 active:border-b-2 transition-all"
                    >
                      <InitialsAvatar name={witness.name} size="lg" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold text-white leading-tight truncate">{witness.name}</span>
                        <span className="block text-sm text-white/60 capitalize truncate">{witness.role}</span>
                        <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          count > 0 ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300' : 'bg-white/10 text-white/55'
                        }`}>
                          {count > 0 && <Check className="w-3 h-3" />}
                          {count > 0 ? `${count} question${count === 1 ? '' : 's'} asked` : 'Not interviewed yet'}
                        </span>
                      </span>
                      <ChevronRight className="flex-none w-5 h-5 text-[#FFD43B]" />
                    </button>
                  );
                })}
              </>
            )
          )}
        </div>

        <div className="flex-none px-4 pt-2" style={safeBottom}>
          <p className="text-center text-[11px] font-bold tracking-wider text-white/45 mb-1.5">
            {witnesses.length > 0 ? `${interviewedCount}/${witnesses.length} WITNESSES INTERVIEWED · ${totalQuestions} QUESTION${totalQuestions === 1 ? '' : 'S'} ASKED` : 'READY WHEN YOU ARE'}
          </p>
          <button
            onClick={onProceedToTrial}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#FFD43B] text-black font-game text-3xl py-3 border-b-[6px] border-[#B8860B] active:translate-y-1 active:border-b-2 transition-all"
          >
            PROCEED TO TRIAL
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </div>

      {reviewModals}
    </div>
  );
}

/* ───────────── Review modals (shared by both entry paths) ───────────── */

function CaseBriefModal({
  caseForReview,
  defendantName,
  onReject,
  onAccept
}: {
  caseForReview: Case;
  defendantName: string;
  onReject: () => void;
  onAccept: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4">
      <div className="w-full max-w-lg max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#14161f] border border-white/10 text-white">
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <span className="inline-block rounded-full bg-[#FFD43B] text-black px-3 py-1 text-[11px] font-black tracking-[0.15em]">CASE BRIEF</span>
          <h2 className="font-game text-4xl leading-none mt-3">{caseForReview.title}</h2>
          <p className="mt-3 text-[15px] text-white/75 leading-relaxed whitespace-pre-line">{caseForReview.description}</p>
          {caseForReview.case_summary && (
            <p className="mt-3 text-[15px] text-white/75 leading-relaxed whitespace-pre-line">{caseForReview.case_summary}</p>
          )}
          <div className="mt-4 rounded-2xl bg-white/5 border border-white/15 p-3 text-center">
            <span className="font-bold text-[#FFD43B]">{defendantName}</span>
            <span className="text-white/75"> has requested legal representation.</span>
          </div>
        </div>
        <div className="flex-none grid grid-cols-2 gap-3 p-5 pt-3 border-t border-white/10">
          <button onClick={onReject} className="rounded-xl bg-white/10 border border-white/20 text-white font-game text-2xl py-3">
            REJECT
          </button>
          <button
            onClick={onAccept}
            className="rounded-xl bg-[#FFD43B] text-black font-game text-2xl py-3 border-b-[5px] border-[#B8860B] active:translate-y-0.5 active:border-b-2 transition-all"
          >
            ACCEPT CASE
          </button>
        </div>
      </div>
    </div>
  );
}

function AcceptedModal({ defendantName, onBegin }: { defendantName: string; onBegin: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#14161f] border border-white/10 text-white p-6 text-center" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
        <span className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-[#FFD43B] text-black">
          <Check className="w-9 h-9" strokeWidth={3} />
        </span>
        <h2 className="logo-gold font-game text-4xl leading-none mt-4">YOU'RE ON THE CASE</h2>
        <p className="mt-2 text-white/75">You are now representing <span className="font-bold text-white">{defendantName}</span>.</p>

        <ul className="mt-4 space-y-2 text-left">
          {['Review the evidence', 'Interview the witnesses', 'Prepare for trial'].map((task, i) => (
            <li key={task} className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 p-3">
              <span className="flex-none flex items-center justify-center w-7 h-7 rounded-full bg-[#FFD43B] text-black font-black text-sm">{i + 1}</span>
              <span className="font-semibold">{task}</span>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-sm italic text-white/50">The court is waiting.</p>
        <button
          onClick={onBegin}
          className="mt-4 w-full rounded-2xl bg-[#FFD43B] text-black font-game text-3xl py-3 border-b-[6px] border-[#B8860B] active:translate-y-1 active:border-b-2 transition-all"
        >
          BEGIN INVESTIGATION
        </button>
      </div>
    </div>
  );
}
