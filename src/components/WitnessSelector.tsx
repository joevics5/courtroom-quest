import { User } from 'lucide-react';
import type { Witness } from '../types';
import ModalSheet, { CHOICE_ROW } from './ModalSheet';
import { gameButton } from './ui';

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
    <ModalSheet title="SELECT A WITNESS" icon={<User className="w-6 h-6 text-[#FFD43B]" />} onClose={onClose}>
      {availableWitnesses.length === 0 ? (
        <p className="text-white/60 text-center py-8">All witnesses have been called.</p>
      ) : (
        <div className="space-y-3 mb-5">
          {availableWitnesses.map((witness) => (
            <button key={witness.id} onClick={() => onSelect(witness)} className={CHOICE_ROW}>
              <div className="font-semibold text-white">{witness.name}</div>
              <div className="text-sm text-[#FFD43B]/80 mt-0.5">{witness.role}</div>
              {witness.background && (
                <div className="text-xs text-white/50 mt-2 line-clamp-2">{witness.background}</div>
              )}
            </button>
          ))}
        </div>
      )}

      <button onClick={onSkip} className={`w-full ${gameButton('ghost', 'sm')}`}>
        Skip Calling Witness
      </button>
    </ModalSheet>
  );
}
