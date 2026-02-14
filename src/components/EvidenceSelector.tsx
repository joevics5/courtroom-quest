import { X, FileText } from 'lucide-react';
import type { Evidence } from '../types';

interface EvidenceSelectorProps {
  evidence: Evidence[];
  evidenceSubmitted: string[];
  onSelect: (evidence: Evidence) => void;
  onClose: () => void;
}

export default function EvidenceSelector({
  evidence,
  evidenceSubmitted,
  onSelect,
  onClose
}: EvidenceSelectorProps) {
  const availableEvidence = evidence.filter(e => !evidenceSubmitted.includes(e.id));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Submit Evidence</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {availableEvidence.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400">All evidence has been submitted.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {availableEvidence.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="w-full text-left p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors flex items-start gap-3"
              >
                <FileText className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-white">
                    {item.exhibit_label || 'Evidence'}: {item.title}
                  </div>
                  {item.description && (
                    <div className="text-sm text-slate-400 mt-1 line-clamp-2">
                      {item.description}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 mt-2 capitalize">
                    Type: {item.evidence_type}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}





