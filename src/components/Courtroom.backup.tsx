import { useState, useEffect } from 'react';
import { Scale, Send, AlertCircle, FileText, User, ArrowLeft } from 'lucide-react';
import { db } from '../lib/database';
import type { CaseSession, Evidence, Witness, TrialEvent, Verdict } from '../types';

interface CourtroomProps {
  session: CaseSession;
  onComplete: (verdict: Verdict) => void;
  onBack: () => void;
}

type TrialStage = 'opening' | 'witness_examination' | 'closing' | 'verdict';

interface ParticipantTile {
  role: 'judge' | 'counsel' | 'witness';
  name: string;
  status: 'speaking' | 'listening' | 'idle';
}

export default function Courtroom({ session, onComplete, onBack }: CourtroomProps) {
  const [stage, setStage] = useState<TrialStage>('opening');
  const [events, setEvents] = useState<TrialEvent[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [currentWitness, setCurrentWitness] = useState<Witness | null>(null);
  const [showObjection, setShowObjection] = useState(false);

  const [participants, setParticipants] = useState<ParticipantTile[]>([
    { role: 'judge', name: 'Judge Harrison', status: 'listening' },
    { role: 'counsel', name: 'You (Defense Counsel)', status: 'idle' }
  ]);

  useEffect(() => {
    loadTrialData();
  }, [session]);

  const loadTrialData = async () => {
    try {
      const [evidenceData, witnessData, eventsData] = await Promise.all([
        db.evidence.getCaseEvidence(session.case_id),
        db.witnesses.getCaseWitnesses(session.case_id),
        db.trialEvents.getSessionEvents(session.id)
      ]);

      setEvidence(evidenceData);
      setWitnesses(witnessData);
      setEvents(eventsData);

      if (eventsData.length === 0) {
        addJudgeStatement("Court is now in session. Counsel, you may present your opening statement.");
      }
    } catch (error) {
      console.error('Failed to load trial data:', error);
    }
  };

  const addJudgeStatement = async (content: string) => {
    updateParticipantStatus('judge', 'speaking');

    const event = await db.trialEvents.addEvent({
      session_id: session.id,
      event_type: stage,
      speaker_role: 'judge',
      speaker_name: 'Judge Harrison',
      content,
      metadata: {},
      event_order: events.length + 1
    });

    setEvents([...events, event]);

    setTimeout(() => {
      updateParticipantStatus('judge', 'listening');
    }, 2000);
  };

  const updateParticipantStatus = (role: 'judge' | 'counsel' | 'witness', status: 'speaking' | 'listening' | 'idle') => {
    setParticipants(prev =>
      prev.map(p => (p.role === role ? { ...p, status } : { ...p, status: 'listening' }))
    );
  };

  const handleSubmitStatement = async () => {
    if (!input.trim()) return;

    setIsProcessing(true);
    updateParticipantStatus('counsel', 'speaking');

    try {
      const eventType = stage === 'witness_examination' && currentWitness ? 'witness_examination' : stage;

      const counselEvent = await db.trialEvents.addEvent({
        session_id: session.id,
        event_type: eventType,
        speaker_role: 'counsel',
        speaker_name: 'Defense Counsel',
        content: input,
        metadata: currentWitness ? { witness_id: currentWitness.id } : {},
        event_order: events.length + 1
      });

      setEvents(prev => [...prev, counselEvent]);
      setInput('');

      if (currentWitness) {
        await handleWitnessResponse(input);
      } else {
        await generateJudgeResponse(input);
      }

      updateParticipantStatus('counsel', 'idle');
    } catch (error) {
      console.error('Failed to submit statement:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWitnessResponse = async (question: string) => {
    if (!currentWitness) return;

    updateParticipantStatus('witness', 'speaking');

    const response = `Based on what I observed, ${currentWitness.base_testimony}`;

    const witnessEvent = await db.trialEvents.addEvent({
      session_id: session.id,
      event_type: 'witness_examination',
      speaker_role: 'witness',
      speaker_name: currentWitness.name,
      content: response,
      metadata: { witness_id: currentWitness.id },
      event_order: events.length + 2
    });

    setEvents(prev => [...prev, witnessEvent]);

    setTimeout(() => {
      updateParticipantStatus('witness', 'idle');
    }, 2000);
  };

  const generateJudgeResponse = async (statement: string) => {
    updateParticipantStatus('judge', 'speaking');

    let response = '';

    if (stage === 'opening') {
      response = "Thank you, Counsel. You may proceed with examining your witnesses.";
    } else if (stage === 'closing') {
      response = "Thank you for your closing arguments. The court will now deliberate.";
      setTimeout(() => deliverVerdict(), 3000);
    } else {
      response = "Proceed, Counsel.";
    }

    const judgeEvent = await db.trialEvents.addEvent({
      session_id: session.id,
      event_type: stage,
      speaker_role: 'judge',
      speaker_name: 'Judge Harrison',
      content: response,
      metadata: {},
      event_order: events.length + 2
    });

    setEvents(prev => [...prev, judgeEvent]);

    setTimeout(() => {
      updateParticipantStatus('judge', 'listening');
    }, 2000);
  };

  const callWitness = (witness: Witness) => {
    setCurrentWitness(witness);
    setStage('witness_examination');

    const witnessParticipant: ParticipantTile = {
      role: 'witness',
      name: witness.name,
      status: 'idle'
    };

    setParticipants(prev => {
      const filtered = prev.filter(p => p.role !== 'witness');
      return [...filtered, witnessParticipant];
    });

    addJudgeStatement(`${witness.name} may take the stand.`);
  };

  const dismissWitness = () => {
    if (currentWitness) {
      addJudgeStatement(`${currentWitness.name} may step down.`);
      setCurrentWitness(null);
      setParticipants(prev => prev.filter(p => p.role !== 'witness'));
    }
  };

  const deliverVerdict = async () => {
    setStage('verdict');

    const reasoning = `After careful consideration of the evidence and testimony presented, the court finds that the defense has ${
      Math.random() > 0.5 ? 'successfully' : 'not sufficiently'
    } demonstrated their case. The arguments were ${
      evidence.length > 2 ? 'well-supported by evidence' : 'somewhat lacking in evidentiary support'
    }.`;

    const outcome = Math.random() > 0.5 ? 'win' : 'lose';

    const verdict = await db.verdicts.createVerdict({
      session_id: session.id,
      outcome,
      reasoning,
      evidence_cited: evidence.slice(0, 3).map(e => e.exhibit_label || e.title),
      witness_performance: {},
      missed_opportunities: [],
      score: Math.floor(Math.random() * 40) + 60
    });

    await db.trialEvents.addEvent({
      session_id: session.id,
      event_type: 'verdict',
      speaker_role: 'judge',
      speaker_name: 'Judge Harrison',
      content: `This court finds in favor of the ${outcome === 'win' ? 'defense' : 'prosecution'}. ${reasoning}`,
      metadata: { verdict_id: verdict.id },
      event_order: events.length + 1
    });

    await db.sessions.updateSession(session.id, {
      current_phase: 'completed',
      completed_at: new Date().toISOString()
    });

    onComplete(verdict);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'speaking': return 'border-green-500 ring-2 ring-green-500/50';
      case 'listening': return 'border-blue-500';
      default: return 'border-slate-600';
    }
  };

  const getStageLabel = () => {
    switch (stage) {
      case 'opening': return 'Opening Statements';
      case 'witness_examination': return 'Witness Examination';
      case 'closing': return 'Closing Arguments';
      case 'verdict': return 'Verdict';
      default: return 'Trial';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center justify-center w-10 h-10 bg-slate-700 hover:bg-slate-600 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center justify-center w-10 h-10 bg-red-600 rounded-full">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Courtroom Session</h1>
              <p className="text-slate-400 text-sm">{getStageLabel()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {participants.map((participant, idx) => (
                <div
                  key={idx}
                  className={`bg-slate-800 rounded-lg border-2 transition-all ${getStatusColor(participant.status)} p-6 aspect-video flex flex-col items-center justify-center`}
                >
                  <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mb-4">
                    {participant.role === 'judge' ? (
                      <Scale className="w-10 h-10 text-blue-400" />
                    ) : (
                      <User className="w-10 h-10 text-slate-400" />
                    )}
                  </div>
                  <h3 className="text-white font-semibold text-center">{participant.name}</h3>
                  <p className="text-slate-400 text-sm capitalize mt-1">{participant.role}</p>
                  {participant.status === 'speaking' && (
                    <div className="mt-2 text-green-400 text-xs font-medium animate-pulse">
                      Speaking...
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Transcript</h3>
                <div className="flex gap-2">
                  {stage === 'witness_examination' && currentWitness && (
                    <button
                      onClick={dismissWitness}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors"
                    >
                      Dismiss Witness
                    </button>
                  )}
                  {stage === 'opening' && (
                    <button
                      onClick={() => setStage('witness_examination')}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                    >
                      Begin Examination
                    </button>
                  )}
                  {stage === 'witness_examination' && !currentWitness && (
                    <button
                      onClick={() => setStage('closing')}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                    >
                      Closing Arguments
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className={`p-3 rounded-lg ${
                      event.speaker_role === 'judge'
                        ? 'bg-blue-500/10 border border-blue-500/30'
                        : event.speaker_role === 'counsel'
                        ? 'bg-green-500/10 border border-green-500/30'
                        : 'bg-slate-750 border border-slate-600'
                    }`}
                  >
                    <div className="text-xs text-slate-400 mb-1">{event.speaker_name || event.speaker_role}:</div>
                    <p className="text-slate-200 text-sm">{event.content}</p>
                  </div>
                ))}
              </div>

              {stage !== 'verdict' && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSubmitStatement()}
                    placeholder={
                      currentWitness
                        ? `Question ${currentWitness.name}...`
                        : stage === 'opening'
                        ? 'Deliver your opening statement...'
                        : 'Deliver your closing argument...'
                    }
                    disabled={isProcessing}
                    className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSubmitStatement}
                    disabled={!input.trim() || isProcessing}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors font-medium"
                  >
                    {isProcessing ? 'Processing...' : <Send className="w-5 h-5" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Evidence
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {evidence.map((item) => (
                  <div key={item.id} className="bg-slate-750 rounded p-2 border border-slate-600">
                    <div className="text-xs text-blue-400 font-semibold mb-1">
                      {item.exhibit_label}
                    </div>
                    <div className="text-xs text-slate-300">{item.title}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Witnesses</h3>
              <div className="space-y-2">
                {witnesses.map((witness) => (
                  <button
                    key={witness.id}
                    onClick={() => callWitness(witness)}
                    disabled={currentWitness?.id === witness.id || stage !== 'witness_examination'}
                    className={`w-full text-left bg-slate-750 rounded p-2 border transition-colors text-sm ${
                      currentWitness?.id === witness.id
                        ? 'border-green-500 text-green-400'
                        : 'border-slate-600 text-slate-300 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {witness.name}
                    <div className="text-xs text-slate-400 capitalize">{witness.role}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowObjection(!showObjection)}
              disabled={stage === 'verdict'}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors font-medium"
            >
              <AlertCircle className="w-4 h-4" />
              Objection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
