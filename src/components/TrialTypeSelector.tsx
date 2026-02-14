import { useState } from 'react';
import { Scale, Users, Clock } from 'lucide-react';
import type { TrialType, TrialDuration } from '../types';

interface Props {
  onSelect: (type: TrialType, duration: TrialDuration) => void;
  onCancel: () => void;
}

export default function TrialTypeSelector({ onSelect, onCancel }: Props) {
  const [selectedType, setSelectedType] = useState<TrialType | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<TrialDuration>(30);

  const options: Array<{ type: TrialType; icon: typeof Scale; title: string; description: string }> = [
    {
      type: 'judge',
      icon: Scale,
      title: 'Judge Trial (Bench Trial)',
      description: 'The judge alone decides the verdict based on the law and facts presented'
    },
    {
      type: 'jury',
      icon: Users,
      title: 'Jury Trial',
      description: 'A panel of 6-12 citizens deliberates and determines the verdict'
    }
  ];

  const durationOptions: Array<{ value: TrialDuration; label: string; description: string }> = [
    { value: 15, label: '15 Minutes', description: 'Quick trial' },
    { value: 30, label: '30 Minutes', description: 'Standard trial' },
    { value: 60, label: '1 Hour', description: 'Full trial' }
  ];

  const handleConfirm = () => {
    if (selectedType) {
      onSelect(selectedType, selectedDuration);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Select Trial Type</h2>
        <p className="text-white/60 text-center mb-6 text-sm">
          Choose who will decide the outcome of this case
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.type}
                onClick={() => setSelectedType(option.type)}
                className={`bg-white/5 hover:bg-white/10 border-2 ${
                  selectedType === option.type ? 'border-blue-500' : 'border-white/10 hover:border-blue-500'
                } rounded-lg p-4 text-left transition-all group`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg group-hover:from-blue-500/30 group-hover:to-purple-500/30 transition-all">
                    <Icon className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1">{option.title}</h3>
                    <p className="text-white/70 text-xs leading-relaxed">{option.description}</p>
                  </div>
                </div>

                <div className="bg-white/5 rounded-lg p-3 mt-2">
                  <div className="text-white/60 text-xs space-y-1">
                    {option.type === 'judge' ? (
                      <>
                        <div className="flex items-start gap-2">
                          <span className="text-green-400 mt-0.5">✓</span>
                          <span>Faster proceedings</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-green-400 mt-0.5">✓</span>
                          <span>Legal expertise applied</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-green-400 mt-0.5">✓</span>
                          <span>Simpler presentation</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-2">
                          <span className="text-green-400 mt-0.5">✓</span>
                          <span>Jury selection process</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-green-400 mt-0.5">✓</span>
                          <span>Persuade diverse perspectives</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-green-400 mt-0.5">✓</span>
                          <span>More realistic trial experience</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="bg-white/5 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="text-base font-semibold text-white">Proceedings Length</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {durationOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedDuration(option.value)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedDuration === option.value
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="text-white font-semibold text-sm mb-1">{option.label}</div>
                <div className="text-white/60 text-xs">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-white/60 hover:text-white transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedType}
            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
}
