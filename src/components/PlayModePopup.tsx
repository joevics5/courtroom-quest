import { Bot, Swords, Users, X } from 'lucide-react';
import PathTile from './PathTile';

export type PlayMode = 'ai' | 'online' | 'local';

interface PlayModePopupProps {
  onSelect: (mode: PlayMode) => void;
  onClose: () => void;
}

/** "How do you want to play?" — shown from the home screen's PLAY button. */
export default function PlayModePopup({ onSelect, onClose }: PlayModePopupProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75" onClick={onClose}>
      <div
        className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#14161f] border border-white/10 p-5 pb-7"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white">
          <X className="w-5 h-5" />
        </button>
        <h2 className="logo-gold font-game text-4xl leading-none mb-5 pr-10">HOW DO YOU WANT TO PLAY?</h2>

        <div className="space-y-4">
          <PathTile
            onClick={() => onSelect('ai')}
            icon={<Bot className="w-7 h-7 text-white" />}
            iconBg="bg-blue-600"
            title="VS AI"
            subtitle="Play solo against an AI judge and opposing counsel."
          />
          <PathTile
            onClick={() => onSelect('online')}
            icon={<Swords className="w-7 h-7 text-white" />}
            iconBg="bg-orange-600"
            title="VS PLAYER ONLINE"
            subtitle="Match with an opponent or invite a friend."
            badge="LIVE 1V1"
          />
          <PathTile
            onClick={() => onSelect('local')}
            icon={<Users className="w-7 h-7 text-white" />}
            iconBg="bg-purple-600"
            title="SAME DEVICE"
            subtitle="Two people, one phone. Pass it each turn."
          />
        </div>
      </div>
    </div>
  );
}
