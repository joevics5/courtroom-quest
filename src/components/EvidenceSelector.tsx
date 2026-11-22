import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { FileText } from 'lucide-react';
import type { Evidence } from '../types';
import ModalSheet, { CHOICE_ROW } from './ModalSheet';
import { CaseFilePanel, EyeButton, ItemDetail, SelectorTabs, type CaseFileData, type DetailTarget } from './CaseFileView';

interface EvidenceSelectorProps {
  evidence: Evidence[];
  evidenceSubmitted: string[];
  onSelect: (evidence: Evidence) => void;
  onClose: () => void;
  /** When given, a Case details tab and eye buttons let the player re-read the case without leaving. */
  caseFile?: CaseFileData;
}

export default function EvidenceSelector({
  evidence,
  evidenceSubmitted,
  onSelect,
  onClose,
  caseFile
}: EvidenceSelectorProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'select' | 'file'>('select');
  const [target, setTarget] = useState<DetailTarget | null>(null);
  const availableEvidence = evidence.filter(e => !evidenceSubmitted.includes(e.id));

  if (target) {
    return (
      <ModalSheet title={t('selectors.evidenceTitle')} icon={<FileText className="w-6 h-6 text-[#FFD43B]" />} onClose={onClose}>
        <ItemDetail target={target} onBack={() => setTarget(null)} />
      </ModalSheet>
    );
  }

  return (
    <ModalSheet title={t('selectors.submitEvidence')} icon={<FileText className="w-6 h-6 text-[#FFD43B]" />} onClose={onClose}>
      {caseFile && <SelectorTabs tab={tab} onChange={setTab} selectLabel={t('selectors.tabEvidence')} />}
      {caseFile && tab === 'file' ? (
        <CaseFilePanel file={caseFile} onView={setTarget} />
      ) : availableEvidence.length === 0 ? (
        <p className="text-white/60 text-center py-8">{t('selectors.allSubmitted')}</p>
      ) : (
        <div className="space-y-3">
          {availableEvidence.map((item) => (
            <div key={item.id} className="flex items-stretch gap-2">
            <button onClick={() => onSelect(item)} className={`${CHOICE_ROW} flex-1 min-w-0 flex items-start gap-3`}>
              <span className="flex-none w-9 h-9 rounded-xl bg-[#FFD43B]/15 border border-[#FFD43B]/30 flex items-center justify-center">
                <FileText className="w-4 h-4 text-[#FFD43B]" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white">
                  {item.exhibit_label || t('selectors.evidenceFallback')}: {item.title}
                </div>
                {item.description && (
                  <div className="text-sm text-white/60 mt-1 line-clamp-2">{item.description}</div>
                )}
                <div className="text-xs text-white/40 mt-2 capitalize">Type: {item.evidence_type}</div>
              </div>
            </button>
            {caseFile && <EyeButton label={t('casefile.viewItem', { name: item.title })} onClick={() => setTarget({ kind: 'evidence', item })} />}
            </div>
          ))}
        </div>
      )}
    </ModalSheet>
  );
}
