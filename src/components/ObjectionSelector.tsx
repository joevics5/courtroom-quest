import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import ModalSheet, { CHOICE_ROW } from './ModalSheet';

interface ObjectionSelectorProps {
  onSelect: (reason: string) => void;
  onClose: () => void;
  /** During a redirect, "outside the scope" is a ground too. */
  redirect?: boolean;
}

const OBJECTION_REASONS = [
  { value: 'leading', label: 'Leading Question', description: 'Question suggests the answer' },
  { value: 'hearsay', label: 'Hearsay', description: 'Out-of-court statement offered for truth' },
  { value: 'speculation', label: 'Speculation', description: 'Witness is guessing or speculating' },
  { value: 'relevance', label: 'Relevance', description: 'Question not relevant to the case' },
  { value: 'argumentative', label: 'Argumentative', description: 'Question is argumentative rather than seeking facts' },
  { value: 'compound', label: 'Compound Question', description: 'Question contains multiple questions' },
  { value: 'asked_and_answered', label: 'Asked and Answered', description: 'Question has already been asked and answered' },
  { value: 'other', label: 'Other', description: 'Other valid objection' }
];

const OUTSIDE_SCOPE = { value: 'outside_scope', label: 'Outside the Scope', description: 'Redirect question raises something the cross-examination did not' };

export default function ObjectionSelector({ onSelect, onClose, redirect = false }: ObjectionSelectorProps) {
  const { t } = useTranslation();
  const reasons = redirect ? [OUTSIDE_SCOPE, ...OBJECTION_REASONS] : OBJECTION_REASONS;
  return (
    <ModalSheet
      title={t('objection.title')}
      icon={<AlertCircle className="w-6 h-6 text-[#E5484D]" />}
      subtitle={t('objection.subtitle')}
      onClose={onClose}
    >
      <div className="space-y-2">
        {reasons.map((reason) => (
          <button key={reason.value} onClick={() => onSelect(reason.value)} className={CHOICE_ROW}>
            <div className="font-semibold text-white">{t(`objection.${reason.value}.label`, { defaultValue: reason.label })}</div>
            <div className="text-sm text-white/55 mt-0.5">{t(`objection.${reason.value}.desc`, { defaultValue: reason.description })}</div>
          </button>
        ))}
      </div>
    </ModalSheet>
  );
}
