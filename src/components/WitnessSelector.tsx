import { User } from 'lucide-react';
import type { Witness } from '../types';
import ModalSheet, { CHOICE_ROW } from './ModalSheet';
import { gameButton } from './ui';

interface WitnessSelectorProps {
  witnesses: Witness[];
  witnessesCalled: string[];
  onSelect: (witness: Witness) => void;
  onSkip: () => void;
  /** Locked when it is not your turn or not a direct-examination phase (e.g. during cross-examination). */
  disabled?: boolean;
  onClose?: () => void;
}

export default function WitnessSelector({
  witnesses,
  witnessesCalled,
  onSelect,
  onSkip,
  disabled = false,
  onClose
}: WitnessSelectorProps) {
  const availableWitnesses = witnesses.filter(w => !witnessesCalled.includes(w.id));

  return (
    <ModalSheet title="SELECT A WITNESS" icon={<User className="w-6 h-6 text-[#FFD43B]" />} onClose={onClose}>
      {availableWitnesses.length === 0 ? (
        <p className="text-white/60 text-center py-8">All witnesses have been called.</p>
      ) : (
        <div className="space-y-3 mb-5">
          {availableWitnesses.map((witness) => (
            <button key={witness.id} onClick={() => onSelect(witness)} disabled={disabled} className={`${CHOICE_ROW} disabled:opacity-50 disabled:cursor-not-allowed`}>
              <div className="font-semibold text-white">{witness.name}</div>
              <div className="text-sm text-[#FFD43B]/80 mt-0.5">{witness.role}</div>
              {witness.background && (
                <div className="text-xs text-white/50 mt-2 line-clamp-2">{witness.background}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {disabled && (
        <p className="text-center text-white/60 text-sm mb-3">Witnesses can only be called on your own turn, during direct examination.</p>
      )}
      <button onClick={onSkip} disabled={disabled} className={`w-full ${gameButton('ghost', 'sm')}`}>
        Skip Calling Witness
      </button>
    </ModalSheet>
  );
}
