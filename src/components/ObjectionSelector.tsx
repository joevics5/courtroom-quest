import { X, AlertCircle } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <h2 className="text-xl font-bold text-white">Objection</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          Select the reason for your objection:
        </p>

        <div className="space-y-2">
          {OBJECTION_REASONS.map((reason) => (
            <button
              key={reason.value}
              onClick={() => onSelect(reason.value)}
              className="w-full text-left p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <div className="font-semibold text-white">{reason.label}</div>
              <div className="text-sm text-slate-400 mt-1">{reason.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}





