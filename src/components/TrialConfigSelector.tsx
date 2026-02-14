import { Clock } from 'lucide-react';
import type { TrialDuration } from '../types';

interface TrialConfigSelectorProps {
  onSelect: (duration: TrialDuration) => void;
  onCancel: () => void;
}

export default function TrialConfigSelector({ onSelect, onCancel }: TrialConfigSelectorProps) {
  const options: Array<{ duration: TrialDuration; label: string; description: string }> = [
    {
      duration: 15,
      label: 'Short Trial',
      description: '15 minutes - 1 witness, quick proceedings'
    },
    {
      duration: 30,
      label: 'Medium Trial',
      description: '30 minutes - Up to 3 witnesses, balanced pace'
    },
    {
      duration: 60,
      label: 'Long Trial',
      description: '60 minutes - Up to 5 witnesses, full proceedings'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 max-w-2xl w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-600 rounded-full">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Select Trial Length</h2>
            <p className="text-slate-400 text-sm">Choose how long your trial will be</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {options.map((option) => (
            <button
              key={option.duration}
              onClick={() => onSelect(option.duration)}
              className="w-full bg-slate-750 hover:bg-slate-700 border border-slate-600 hover:border-blue-500 rounded-lg p-4 text-left transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                  {option.label}
                </h3>
                <span className="text-2xl font-bold text-blue-400">
                  {option.duration}<span className="text-sm">min</span>
                </span>
              </div>
              <p className="text-slate-400 text-sm">{option.description}</p>
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
