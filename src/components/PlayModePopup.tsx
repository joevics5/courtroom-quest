import { Bot, FolderOpen, Swords, Users, X } from 'lucide-react';
import PathTile from './PathTile';

export type PlayMode = 'ai' | 'online' | 'local' | 'games';

interface PlayModePopupProps {
  onSelect: (mode: PlayMode) => void;
  onClose: () => void;
  /** Signed-in players get a My games shortcut to pick up running and waiting games */
  showMyGames?: boolean;
  /** Running games + challenges/invites still waiting for the other player */
  myGamesCount?: number;
}

/** "How do you want to play?" — shown from the home screen's PLAY button. */
export default function PlayModePopup({ onSelect, onClose, showMyGames = false, myGamesCount = 0 }: PlayModePopupProps) {
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

        {showMyGames && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-white/15" />
              <span className="text-[11px] font-bold tracking-[0.2em] text-white/45">OR PICK UP A GAME</span>
              <div className="flex-1 h-px bg-white/15" />
            </div>
            <PathTile
              onClick={() => onSelect('games')}
              icon={<FolderOpen className="w-7 h-7 text-black" />}
              iconBg="bg-[#FFD43B]"
              title="MY GAMES"
              subtitle="Continue a game or check one that's waiting."
              badge={myGamesCount > 0 ? `${myGamesCount} ACTIVE` : undefined}
            />
          </>
        )}
      </div>
    </div>
  );
}
