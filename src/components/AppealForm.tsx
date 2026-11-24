import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Gavel } from 'lucide-react';
import ModalSheet from './ModalSheet';
import { gameButton, INPUT } from './ui';
import { db } from '../lib/database';
import {
  APPEAL_REASONS, MAX_EXPLANATION, MIN_EXPLANATION, validateAppeal,
  type AppealReason, type AppealSubmission
} from '../lib/appeals';
import type { Evidence, Witness } from '../types';

interface AppealFormProps {
  caseId: string;
  /** Which appeal this would be (1 or 2). */
  appealNumber: number;
  onSubmit: (submission: AppealSubmission) => Promise<void>;
  onClose: () => void;
}

const CHIP = 'rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors touch-manipulation';

/** Ask the court to reopen the case. Only evidence and witnesses that already exist in the case can be picked. */
export default function AppealForm({ caseId, appealNumber, onSubmit, onClose }: AppealFormProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<AppealReason | null>(null);
  const [explanation, setExplanation] = useState('');
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [witnessIds, setWitnessIds] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([db.evidence.getCaseEvidence(caseId), db.witnesses.getCaseWitnesses(caseId)])
      .then(([e, w]) => { if (!cancelled) { setEvidence(e); setWitnesses(w); } })
      .catch(() => { if (!cancelled) setError(t('appeal.errLoad')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [caseId]);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) =>
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  const submission: AppealSubmission = { reason, explanation, evidence_ids: evidenceIds, witness_ids: witnessIds };
  const problem = validateAppeal(submission);
  const showEvidence = reason === 'missed_evidence' || reason === 'other';
  const showWitnesses = reason === 'missed_witness' || reason === 'other';

  const send = async () => {
    if (problem || sending) return;
    setSending(true);
    setError('');
    try {
      await onSubmit(submission);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('appeal.errSend'));
      setSending(false);
    }
  };

  return (
    <ModalSheet
      title={appealNumber > 1 ? t('appeal.titleSecond') : t('appeal.title')}
      icon={<Gavel className="w-6 h-6 text-[#FFD43B]" />}
      subtitle={t('appeal.subtitle')}
      onClose={sending ? undefined : onClose}
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="font-game text-xl text-white/90 mb-2">{t('appeal.why')}</legend>
          <div className="space-y-2">
            {APPEAL_REASONS.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReason(r.id)}
                aria-pressed={reason === r.id}
                className={`w-full text-left rounded-2xl border p-3 transition-colors touch-manipulation ${
                  reason === r.id ? 'border-[#FFD43B] bg-[#FFD43B]/10' : 'border-white/15 bg-white/[0.06]'
                }`}
              >
                <span className="block font-semibold text-white">{t(`appeal.reasons.${r.id}.label`, { defaultValue: r.label })}</span>
                <span className="block text-sm text-white/60">{t(`appeal.reasons.${r.id}.hint`, { defaultValue: r.hint })}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {reason && (
          <div>
            <label htmlFor="appeal-explanation" className="font-game text-xl text-white/90 mb-2 block">{t('appeal.explain')}</label>
            <textarea
              id="appeal-explanation"
              value={explanation}
              onChange={e => setExplanation(e.target.value)}
              maxLength={MAX_EXPLANATION}
              rows={5}
              placeholder={t('appeal.placeholder')}
              className={INPUT}
            />
            <p className={`mt-1 text-xs ${explanation.trim().length < MIN_EXPLANATION ? 'text-white/50' : 'text-white/40'}`}>
              {t('appeal.counter', { n: explanation.trim().length, max: MAX_EXPLANATION, min: MIN_EXPLANATION })}
            </p>
          </div>
        )}

        {reason && loading && <p className="text-white/60 text-sm">{t('appeal.loadingFile')}</p>}

        {reason && !loading && showEvidence && (
          <div>
            <h3 className="font-game text-xl text-white/90 mb-2">
              {t('appeal.evidenceHead')} {reason === 'missed_evidence' ? t('appeal.pickOneEvidence') : t('appeal.optional')}
            </h3>
            {evidence.length === 0 ? (
              <p className="text-white/50 text-sm">{t('appeal.noEvidence')}</p>
            ) : (
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
            )}
          </div>
        )}

        {reason && !loading && showWitnesses && (
          <div>
            <h3 className="font-game text-xl text-white/90 mb-2">
              {t('appeal.witnessesHead')} {reason === 'missed_witness' ? t('appeal.pickOneWitness') : t('appeal.optional')}
            </h3>
            {witnesses.length === 0 ? (
              <p className="text-white/50 text-sm">{t('appeal.noWitnesses')}</p>
            ) : (
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
            )}
          </div>
        )}

        {error && <p role="alert" className="text-[#FF9A9D] text-sm">{error}</p>}
        {!error && reason && problem && <p className="text-white/50 text-sm">{problem}</p>}

        <button type="button" onClick={send} disabled={!!problem || sending} className={`${gameButton('gold', 'md')} w-full`}>
          {sending ? t('appeal.sending') : t('appeal.submit')}
        </button>
      </div>
    </ModalSheet>
  );
}
