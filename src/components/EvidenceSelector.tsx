import { FileText } from 'lucide-react';
import type { Evidence } from '../types';
import ModalSheet, { CHOICE_ROW } from './ModalSheet';

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
    <ModalSheet title="SUBMIT EVIDENCE" icon={<FileText className="w-6 h-6 text-[#FFD43B]" />} onClose={onClose}>
      {availableEvidence.length === 0 ? (
        <p className="text-white/60 text-center py-8">All evidence has been submitted.</p>
      ) : (
        <div className="space-y-3">
          {availableEvidence.map((item) => (
            <button key={item.id} onClick={() => onSelect(item)} className={`${CHOICE_ROW} flex items-start gap-3`}>
              <span className="flex-none w-9 h-9 rounded-xl bg-[#FFD43B]/15 border border-[#FFD43B]/30 flex items-center justify-center">
                <FileText className="w-4 h-4 text-[#FFD43B]" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white">
                  {item.exhibit_label || 'Evidence'}: {item.title}
                </div>
                {item.description && (
                  <div className="text-sm text-white/60 mt-1 line-clamp-2">{item.description}</div>
                )}
                <div className="text-xs text-white/40 mt-2 capitalize">Type: {item.evidence_type}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </ModalSheet>
  );
}
