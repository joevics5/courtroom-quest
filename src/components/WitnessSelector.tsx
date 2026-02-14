import { X } from 'lucide-react';
import type { Witness } from '../types';

interface WitnessSelectorProps {
  witnesses: Witness[];
  witnessesCalled: string[];
  onSelect: (witness: Witness) => void;
  onSkip: () => void;
  onClose?: () => void;
}

export default function WitnessSelector({
  witnesses,
  witnessesCalled,
  onSelect,
  onSkip,
  onClose
}: WitnessSelectorProps) {
  const availableWitnesses = witnesses.filter(w => !witnessesCalled.includes(w.id));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Select a Witness</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {availableWitnesses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400">All witnesses have been called.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {availableWitnesses.map((witness) => (
              <button
                key={witness.id}
                onClick={() => onSelect(witness)}
                className="w-full text-left p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                <div className="font-semibold text-white">{witness.name}</div>
                <div className="text-sm text-slate-400 mt-1">{witness.role}</div>
                {witness.background && (
                  <div className="text-xs text-slate-500 mt-2 line-clamp-2">
                    {witness.background}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Skip Calling Witness
          </button>
        </div>
      </div>
    </div>
  );
}





