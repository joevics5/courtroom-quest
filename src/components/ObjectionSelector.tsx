import { AlertCircle } from 'lucide-react';
import ModalSheet, { CHOICE_ROW } from './ModalSheet';

interface ObjectionSelectorProps {
  onSelect: (reason: string) => void;
  onClose: () => void;
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

export default function ObjectionSelector({ onSelect, onClose }: ObjectionSelectorProps) {
  return (
    <ModalSheet
      title="OBJECTION!"
      icon={<AlertCircle className="w-6 h-6 text-[#E5484D]" />}
      subtitle="Select the reason for your objection:"
      onClose={onClose}
    >
      <div className="space-y-2">
        {OBJECTION_REASONS.map((reason) => (
          <button key={reason.value} onClick={() => onSelect(reason.value)} className={CHOICE_ROW}>
            <div className="font-semibold text-white">{reason.label}</div>
            <div className="text-sm text-white/55 mt-0.5">{reason.description}</div>
          </button>
        ))}
      </div>
    </ModalSheet>
  );
}
