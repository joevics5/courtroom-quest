import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bot, FolderOpen, Swords, Users, X, Zap } from 'lucide-react';
import PathTile from './PathTile';

export type PlayMode = 'quick' | 'ai' | 'online' | 'local' | 'games';

interface PlayModePopupProps {
  onSelect: (mode: PlayMode) => void;
  onClose: () => void;
  /** Signed-in players get a My games shortcut to pick up running and waiting games */
  showMyGames?: boolean;
  /** Running games + challenges/invites still waiting for the other player */
  myGamesCount?: number;
  /** Not signed in: only Quick Start and Solo are offered (no online or same-device play). */
  limited?: boolean;
}

/** "How do you want to play?" — shown from the home screen's PLAY button. */
export default function PlayModePopup({ onSelect, onClose, showMyGames = false, myGamesCount = 0, limited = false }: PlayModePopupProps) {
  const { t } = useTranslation();
  // Escape closes it too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Drawn straight into <body> so no page container (overflow, transforms, stacking) can sit over it or clip it.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/75" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('playMode.aria')}>
      <div
        className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#14161f] border border-white/10 p-5 pb-7"
        onClick={e => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} aria-label={t('common.close')} className="absolute top-3 right-3 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 text-white touch-manipulation">
          <X className="w-5 h-5" />
        </button>
        <h2 className="logo-gold font-game text-4xl leading-none mb-5 pr-10">{t('playMode.heading')}</h2>

        <div className="space-y-4">
          <PathTile
            onClick={() => onSelect('quick')}
            icon={<Zap className="w-4 h-4 text-black" />}
            iconBg="bg-[#FFD43B]"
            title={t('playMode.quick')}
            badge={t('playMode.quickBadge')}
          />
          <PathTile
            onClick={() => onSelect('ai')}
            icon={<Bot className="w-4 h-4 text-white" />}
            iconBg="bg-blue-600"
            title={t('playMode.solo')}
          />
          {!limited && (
            <>
              <PathTile
                onClick={() => onSelect('online')}
                icon={<Swords className="w-4 h-4 text-white" />}
                iconBg="bg-orange-600"
                title={t('playMode.online')}
                badge={t('playMode.onlineBadge')}
              />
              <PathTile
                onClick={() => onSelect('local')}
                icon={<Users className="w-4 h-4 text-white" />}
                iconBg="bg-purple-600"
                title={t('playMode.sameDevice')}
              />
            </>
          )}
        </div>

        {showMyGames && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-white/15" />
              <span className="text-[11px] font-bold tracking-[0.2em] text-white/45">{t('playMode.orPickUp')}</span>
              <div className="flex-1 h-px bg-white/15" />
            </div>
            <PathTile
              onClick={() => onSelect('games')}
              icon={<FolderOpen className="w-4 h-4 text-black" />}
              iconBg="bg-[#FFD43B]"
              title={t('playMode.myGames')}
              badge={myGamesCount > 0 ? t('playMode.active', { count: myGamesCount }) : undefined}
            />
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
