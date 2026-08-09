import { useState, useEffect, useRef } from 'react';
import { FileText, Users, ChevronRight, ChevronDown, Send, Eye, Scale, ArrowRight, ArrowLeft, Info, Mic } from 'lucide-react';
import { db } from '../lib/database';
import EvidenceViewer from './EvidenceViewer';
import { generateWitnessResponse as generateAIWitnessResponse } from '../lib/ai/trialAI';
import { useSpeechRecognition } from '../lib/useSpeechRecognition';
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

  if (selectedEvidence) {
    return (
      <EvidenceViewer
        evidence={selectedEvidence}
        onBack={() => setSelectedEvidence(null)}
      />
    );
  }

  // If no session and showing review, only show modals
  if (!session && showCaseReview) {
    return (
      <>
        {showPitchModal && caseForReview && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 max-w-2xl w-full">
              <h2 className="text-2xl font-bold text-white mb-4">
                Case Brief — {caseForReview.title}
              </h2>
              <div className="prose prose-invert max-w-none mb-6">
                <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                  {caseForReview.description}
                </p>
                {caseForReview.case_summary && (
                  <p className="text-slate-300 leading-relaxed mt-4 whitespace-pre-line">
                    {caseForReview.case_summary}
                  </p>
                )}
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 mb-6">
                <p className="text-slate-300 text-center">
                  <span className="font-semibold text-white">{caseForReview.defendant_name || (caseForReview.truth_state as any)?.defendant_name || 'The defendant'}</span> has requested legal representation.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPitchModal(false);
                    if (onReviewReject) {
                      onReviewReject();
                    }
                  }}
                  className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
                >
                  Reject
                </button>
                <button
                  onClick={handleAcceptCase}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  Accept Case
                </button>
              </div>
            </div>
          </div>
        )}

        {showAcceptModal && caseForReview && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 max-w-lg w-full">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <h2 className="text-2xl font-bold text-white">
                  You are now representing {caseForReview.defendant_name || (caseForReview.truth_state as any)?.defendant_name || 'the defendant'}.
                </h2>

                <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                  <p className="text-slate-300 font-medium mb-2">Your task:</p>
                  <ul className="text-slate-400 text-sm space-y-1 text-left">
                    <li>• Review evidence</li>
                    <li>• Interview witnesses</li>
                    <li>• Prepare for trial</li>
                  </ul>
                </div>

                <p className="text-slate-400 italic">The court is waiting.</p>

                <button
                  onClick={handleBeginInvestigation}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
                >
                  Begin Investigation
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // If no session, don't show investigation UI
  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center justify-center w-10 h-10 bg-slate-700 hover:bg-slate-600 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-full">
                <Scale className="w-5 h-5 text-white" />
              </div>
            </div>
            <button
              onClick={onProceedToTrial}
              className="flex items-center gap-2 px-3 py-2 sm:px-6 sm:py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors text-sm sm:text-base"
            >
              Proceed to Trial
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Investigation Phase</h1>
            <p className="text-slate-400 text-sm">Examine evidence and question witnesses</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="flex border-b border-slate-700">
                <button
                  onClick={() => setSelectedTab('overview')}
                  className={`flex-1 px-3 py-3 font-medium transition-colors text-sm ${
                    selectedTab === 'overview'
                      ? 'bg-slate-750 text-white border-b-2 border-blue-500'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Info className="w-4 h-4" />
                    Case Overview
                  </div>
                </button>
                <button
                  onClick={() => setSelectedTab('evidence')}
                  className={`flex-1 px-3 py-3 font-medium transition-colors text-sm ${
                    selectedTab === 'evidence'
                      ? 'bg-slate-750 text-white border-b-2 border-blue-500'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-4 h-4" />
                    Case File
                  </div>
                </button>
                <button
                  onClick={() => setSelectedTab('witnesses')}
                  className={`flex-1 px-3 py-3 font-medium transition-colors text-sm ${
                    selectedTab === 'witnesses'
                      ? 'bg-slate-750 text-white border-b-2 border-blue-500'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Users className="w-4 h-4" />
                    Witness Interviews
                  </div>
                </button>
              </div>

              <div className="p-4 max-h-[calc(100vh-250px)] overflow-y-auto">
                {selectedTab === 'overview' && caseDetails && (
                  <div className="space-y-4">
                    <div className="bg-slate-750 rounded-lg p-4 border border-slate-600">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">Case Title</h4>
                      <p className="text-white font-medium">{caseDetails.title}</p>
                    </div>
                    <div className="bg-slate-750 rounded-lg p-4 border border-slate-600">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">Case Type</h4>
                      <p className="text-slate-300 capitalize">{caseDetails.case_type}</p>
                    </div>
                    {(caseDetails.defendant_name || (caseDetails.truth_state as any)?.defendant_name) && (
                      <div className="bg-slate-750 rounded-lg p-4 border border-slate-600">
                        <h4 className="text-sm font-semibold text-blue-400 mb-2">Defendant</h4>
                        <p className="text-slate-300">{caseDetails.defendant_name || (caseDetails.truth_state as any)?.defendant_name}</p>
                      </div>
                    )}
                    <div className="bg-slate-750 rounded-lg p-4 border border-slate-600">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">Description</h4>
                      <p className="text-slate-300 leading-relaxed whitespace-pre-line">{caseDetails.description}</p>
                    </div>
                    {caseDetails.case_summary && (
                      <div className="bg-slate-750 rounded-lg p-4 border border-slate-600">
                        <h4 className="text-sm font-semibold text-blue-400 mb-2">Case Summary</h4>
                        <p className="text-slate-300 leading-relaxed whitespace-pre-line">{caseDetails.case_summary}</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedTab === 'evidence' && (
                  <div className="space-y-3">
                    {evidence.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">No evidence available</div>
                    ) : (
                      evidence.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setSelectedEvidence(item)}
                          className="w-full text-left bg-slate-750 rounded-lg p-4 border border-slate-600 hover:border-blue-500 hover:bg-slate-700 transition-all group"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-semibold text-blue-400">
                              {item.exhibit_label || 'Evidence'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400 capitalize">{item.evidence_type.replace('_', ' ')}</span>
                              <Eye className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors" />
                            </div>
                          </div>
                          <h4 className="text-white font-medium mb-1 group-hover:text-blue-400 transition-colors">{item.title}</h4>
                          {item.description && (
                            <p className="text-sm text-slate-400 line-clamp-2">{item.description}</p>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}

                {selectedTab === 'witnesses' && (
                  <div className="space-y-3">
                    {witnesses.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">No witnesses available</div>
                    ) : (
                      witnesses.map((witness) => {
                        const witnessInteractions = getWitnessInteractions(witness.id);
                        return (
                          <button
                            key={witness.id}
                            onClick={() => setSelectedWitness(witness)}
                            className={`w-full text-left bg-slate-750 rounded-lg p-4 border transition-all ${
                              selectedWitness?.id === witness.id
                                ? 'border-blue-500 bg-slate-700'
                                : 'border-slate-600 hover:border-slate-500'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="text-white font-medium">{witness.name}</h4>
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            </div>
                            <p className="text-sm text-slate-400 capitalize mb-1">{witness.role}</p>
                            {witnessInteractions.length > 0 && (
                              <div className="text-xs text-blue-400 mt-2">
                                {witnessInteractions.length} question{witnessInteractions.length !== 1 ? 's' : ''} asked
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-slate-800 rounded-lg border border-slate-700 h-[calc(100vh-150px)] flex flex-col">
              {selectedWitness ? (
                <>
                  <div className="border-b border-slate-700 px-6 py-4 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-white">{selectedWitness.name}</h3>
                        <p className="text-slate-400 text-sm capitalize">{selectedWitness.role}</p>
                      </div>
                      <button
                        onClick={() => setShowWitnessInfo(!showWitnessInfo)}
                        className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <span className="text-sm">Witness Info</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showWitnessInfo ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    
                    {showWitnessInfo && (
                      <div className="mt-4 space-y-3 animate-in slide-in-from-top-2">
                        <div className="bg-slate-750 rounded-lg p-4 border border-slate-600">
                          <h4 className="text-sm font-semibold text-blue-400 mb-2">Background</h4>
                          <p className="text-slate-300 text-sm">{selectedWitness.background}</p>
                        </div>
                        <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/30">
                          <h4 className="text-sm font-semibold text-amber-400 mb-2">Written Testimony</h4>
                          <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">{selectedWitness.base_testimony}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div 
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto p-6 space-y-4"
                  >
                    {getWitnessInteractions(selectedWitness.id).map((interaction) => (
                      <div key={interaction.id} className="space-y-2">
                        <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-4">
                          <div className="text-xs text-blue-400 mb-1">You asked:</div>
                          <p className="text-white">{interaction.question}</p>
                        </div>
                        <div className="bg-slate-750 border border-slate-600 rounded-lg p-4">
                          <div className="text-xs text-slate-400 mb-1">{selectedWitness.name} responded:</div>
                          <p className="text-slate-200">{interaction.response}</p>
                        </div>
                      </div>
                    ))}
                    {isQuestioningLoading && (
                      <div className="space-y-2">
                        <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-4">
                          <div className="text-xs text-blue-400 mb-1">You asked:</div>
                          <p className="text-white">{question}</p>
                        </div>
                        <div className="bg-slate-750 border border-slate-600 rounded-lg p-4">
                          <div className="text-xs text-slate-400 mb-1">{selectedWitness.name} is thinking...</div>
                          <div className="flex items-center gap-2">
                            <div className="animate-pulse text-slate-400">●</div>
                            <div className="animate-pulse text-slate-400" style={{ animationDelay: '0.2s' }}>●</div>
                            <div className="animate-pulse text-slate-400" style={{ animationDelay: '0.4s' }}>●</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-700 p-4 flex-shrink-0 bg-slate-800">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                          placeholder={`Ask ${selectedWitness.name} a question...`}
                          disabled={isQuestioningLoading}
                          className="w-full px-4 py-2 pr-12 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {speechSupported && (
                          <button
                            type="button"
                            onClick={() => isListening ? stopListening() : startListening()}
                            disabled={isQuestioningLoading}
                            title={isListening ? 'Stop recording' : 'Speak your question'}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              isListening ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-slate-600 hover:bg-slate-500'
                            }`}
                          >
                            <Mic className="w-4 h-4 text-white" />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={handleAskQuestion}
                        disabled={!question.trim() || isQuestioningLoading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
                      >
                        {isQuestioningLoading ? (
                          <span className="flex items-center gap-2">
                            <span className="animate-spin">⏳</span>
                            Thinking...
                          </span>
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select a witness to begin questioning</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showPitchModal && caseForReview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 max-w-2xl w-full">
            <h2 className="text-2xl font-bold text-white mb-4">
              Case Brief — {caseForReview.title}
            </h2>
            <div className="prose prose-invert max-w-none mb-6">
              <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                {caseForReview.description}
              </p>
              {caseForReview.case_summary && (
                <p className="text-slate-300 leading-relaxed mt-4 whitespace-pre-line">
                  {caseForReview.case_summary}
                </p>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 mb-6">
              <p className="text-slate-300 text-center">
                <span className="font-semibold text-white">{caseForReview.defendant_name || (caseForReview.truth_state as any)?.defendant_name || caseDetails?.defendant_name || (caseDetails?.truth_state as any)?.defendant_name || 'The defendant'}</span> has requested legal representation.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPitchModal(false);
                  if (onReviewReject) {
                    onReviewReject();
                  }
                }}
                className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
              >
                Reject
              </button>
              <button
                onClick={handleAcceptCase}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                Accept Case
              </button>
            </div>
          </div>
        </div>
      )}

      {showAcceptModal && caseForReview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 max-w-lg w-full">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-white">
                You are now representing {caseForReview.defendant_name || (caseForReview.truth_state as any)?.defendant_name || caseDetails?.defendant_name || (caseDetails?.truth_state as any)?.defendant_name || 'the defendant'}.
              </h2>

              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                <p className="text-slate-300 font-medium mb-2">Your task:</p>
                <ul className="text-slate-400 text-sm space-y-1 text-left">
                  <li>• Review evidence</li>
                  <li>• Interview witnesses</li>
                  <li>• Prepare for trial</li>
                </ul>
              </div>

              <p className="text-slate-400 italic">The court is waiting.</p>

              <button
                onClick={handleBeginInvestigation}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
              >
                Begin Investigation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
