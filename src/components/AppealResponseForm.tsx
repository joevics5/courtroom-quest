import { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import ModalSheet from './ModalSheet';
import { gameButton, INPUT } from './ui';
import { db } from '../lib/database';
import { APPEAL_REASONS, MAX_EXPLANATION, MIN_EXPLANATION, validateResponse, type Appeal, type ResponseSubmission } from '../lib/appeals';
import type { Evidence, Witness } from '../types';

interface AppealResponseFormProps {
  caseId: string;
  appeal: Appeal;
  onSubmit: (response: ResponseSubmission) => Promise<void>;
  onClose: () => void;
}

const CHIP = 'rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors touch-manipulation';

/** Opposing counsel's answer to an appeal: accept (agree to reconsider) or oppose. Existing evidence and witnesses only. */
export default function AppealResponseForm({ caseId, appeal, onSubmit, onClose }: AppealResponseFormProps) {
  const [decision, setDecision] = useState<'accept' | 'oppose' | null>(null);
  const [explanation, setExplanation] = useState('');
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [witnessIds, setWitnessIds] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([db.evidence.getCaseEvidence(caseId), db.witnesses.getCaseWitnesses(caseId)])
      .then(([e, w]) => { if (!cancelled) { setEvidence(e); setWitnesses(w); } })
      .catch(() => { if (!cancelled) setError('Could not load the case file. Please close this and try again.'); });
    return () => { cancelled = true; };
  }, [caseId]);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) =>
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  const submission: ResponseSubmission = { decision, explanation, evidence_ids: evidenceIds, witness_ids: witnessIds };
  const problem = validateResponse(submission);
  const reasonLabel = APPEAL_REASONS.find(r => r.id === appeal.reason)?.label ?? 'Appeal';
  const citedEvidence = evidence.filter(e => appeal.evidence_ids.includes(e.id)).map(e => e.title);
  const citedWitnesses = witnesses.filter(w => appeal.witness_ids.includes(w.id)).map(w => w.name);

  const send = async () => {
    if (problem || sending) return;
    setSending(true);
    setError('');
    try {
      await onSubmit(submission);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your response. Please try again.');
      setSending(false);
    }
  };

  return (
    <ModalSheet
      title="RESPOND TO THE APPEAL"
      icon={<Scale className="w-6 h-6 text-[#FFD43B]" />}
      subtitle="Accepting agrees to reconsider the case. It does not admit the verdict was wrong."
      onClose={sending ? undefined : onClose}
    >
      <div className="space-y-5">
        <div className="rounded-2xl bg-white/[0.06] border border-white/15 p-4 space-y-1">
          <p className="text-xs font-bold tracking-widest text-[#FFD43B]">APPEAL {appeal.number} · {reasonLabel.toUpperCase()}</p>
          <p className="text-white/90 whitespace-pre-wrap">{appeal.explanation}</p>
          {(citedEvidence.length > 0 || citedWitnesses.length > 0) && (
            <p className="text-sm text-white/60">
              Points to: {[...citedEvidence, ...citedWitnesses].join(', ')}
            </p>
          )}
        </div>

        <fieldset>
          <legend className="font-game text-xl text-white/90 mb-2">YOUR RESPONSE</legend>
          <div className="grid grid-cols-2 gap-2">
            {([['accept', 'ACCEPT'], ['oppose', 'OPPOSE']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDecision(id)}
                aria-pressed={decision === id}
                className={`rounded-2xl border p-3 font-game text-2xl transition-colors touch-manipulation ${
                  decision === id ? 'border-[#FFD43B] bg-[#FFD43B]/15 text-white' : 'border-white/15 bg-white/[0.06] text-white/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-white/55">
            {decision === 'oppose'
              ? 'Argue that the appeal does not justify reopening the case.'
              : decision === 'accept'
                ? 'Agree that the case should be reconsidered.'
                : 'Accept to reconsider the case, or oppose to argue it should stay closed.'}
          </p>
        </fieldset>

        {decision && (
          <div>
            <label htmlFor="appeal-response" className="font-game text-xl text-white/90 mb-2 block">EXPLAIN YOUR POSITION</label>
            <textarea
              id="appeal-response"
              value={explanation}
              onChange={e => setExplanation(e.target.value)}
              maxLength={MAX_EXPLANATION}
              rows={4}
              placeholder={decision === 'oppose' ? 'Why should the verdict stand?' : 'Why are you willing to go again?'}
              className={INPUT}
            />
            <p className="mt-1 text-xs text-white/40">{explanation.trim().length}/{MAX_EXPLANATION} — at least {MIN_EXPLANATION} characters</p>
          </div>
        )}

        {decision && evidence.length > 0 && (
          <div>
            <h3 className="font-game text-xl text-white/90 mb-2">EVIDENCE (optional)</h3>
            <div className="flex flex-wrap gap-2">
              {evidence.map(e => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggle(evidenceIds, setEvidenceIds, e.id)}
                  aria-pressed={evidenceIds.includes(e.id)}
                  className={`${CHIP} ${evidenceIds.includes(e.id) ? 'border-[#8B5CF6] bg-[#8B5CF6]/25 text-white' : 'border-white/20 bg-white/5 text-white/80'}`}
                >
                  {e.exhibit_label ? `${e.exhibit_label}: ` : ''}{e.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {decision && witnesses.length > 0 && (
          <div>
            <h3 className="font-game text-xl text-white/90 mb-2">WITNESSES (optional)</h3>
            <div className="flex flex-wrap gap-2">
              {witnesses.map(w => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => toggle(witnessIds, setWitnessIds, w.id)}
                  aria-pressed={witnessIds.includes(w.id)}
                  className={`${CHIP} ${witnessIds.includes(w.id) ? 'border-[#FFD43B] bg-[#FFD43B]/20 text-white' : 'border-white/20 bg-white/5 text-white/80'}`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p role="alert" className="text-[#FF9A9D] text-sm">{error}</p>}
        {!error && decision && problem && <p className="text-white/50 text-sm">{problem}</p>}

        <button type="button" onClick={send} disabled={!!problem || sending} className={`${gameButton('gold', 'md')} w-full`}>
          {sending ? 'SENDING…' : 'SUBMIT RESPONSE'}
        </button>
      </div>
    </ModalSheet>
  );
}
