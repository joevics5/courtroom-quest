import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { User } from 'lucide-react';
import type { Witness } from '../types';
import ModalSheet, { CHOICE_ROW } from './ModalSheet';
import { gameButton } from './ui';
import { CaseFilePanel, EyeButton, ItemDetail, SelectorTabs, type CaseFileData, type DetailTarget } from './CaseFileView';

interface WitnessSelectorProps {
  witnesses: Witness[];
  witnessesCalled: string[];
  onSelect: (witness: Witness) => void;
  onSkip: () => void;
  /** Locked when it is not your turn or not a direct-examination phase (e.g. during cross-examination). */
  disabled?: boolean;
  onClose?: () => void;
  /** When given, a Case details tab and eye buttons let the player re-read the case without leaving. */
  caseFile?: CaseFileData;
}

export default function WitnessSelector({
  witnesses,
  witnessesCalled,
  onSelect,
  onSkip,
  disabled = false,
  onClose,
  caseFile
}: WitnessSelectorProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'select' | 'file'>('select');
  const [target, setTarget] = useState<DetailTarget | null>(null);
  const availableWitnesses = witnesses.filter(w => !witnessesCalled.includes(w.id));

  if (target) {
    return (
      <ModalSheet title={t('selectors.witnessTitle')} icon={<User className="w-6 h-6 text-[#FFD43B]" />} onClose={onClose}>
        <ItemDetail target={target} onBack={() => setTarget(null)} />
      </ModalSheet>
    );
  }

  return (
    <ModalSheet title={t('selectors.selectWitness')} icon={<User className="w-6 h-6 text-[#FFD43B]" />} onClose={onClose}>
      {caseFile && <SelectorTabs tab={tab} onChange={setTab} selectLabel={t('selectors.tabWitnesses')} />}
      {caseFile && tab === 'file' ? (
        <CaseFilePanel file={caseFile} onView={setTarget} />
      ) : (
      <>
      {availableWitnesses.length === 0 ? (
        <p className="text-white/60 text-center py-8">{t('selectors.allCalled')}</p>
      ) : (
        <div className="space-y-3 mb-5">
          {availableWitnesses.map((witness) => (
            <div key={witness.id} className="flex items-stretch gap-2">
              <button onClick={() => onSelect(witness)} disabled={disabled} className={`${CHOICE_ROW} flex-1 min-w-0 disabled:opacity-50 disabled:cursor-not-allowed`}>
                <div className="font-semibold text-white">{witness.name}</div>
                <div className="text-sm text-[#FFD43B]/80 mt-0.5">{witness.role}</div>
                {witness.background && (
                  <div className="text-xs text-white/50 mt-2 line-clamp-2">{witness.background}</div>
                )}
              </button>
              {caseFile && <EyeButton label={t('casefile.viewItem', { name: witness.name })} onClick={() => setTarget({ kind: 'witness', item: witness })} />}
            </div>
          ))}
        </div>
      )}

      {disabled && (
        <p className="text-center text-white/60 text-sm mb-3">{t('selectors.turnOnly')}</p>
      )}
      <button onClick={onSkip} disabled={disabled} className={`w-full ${gameButton('ghost', 'sm')}`}>
        {t('selectors.skipCalling')}
      </button>
      </>
      )}
    </ModalSheet>
  );
}
