import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface PathTileProps {
  onClick: () => void;
  icon: ReactNode;
  iconBg: string;
  title: string;
  badge?: string;
  disabled?: boolean;
}

/** Tappable game-style row used for choosing a path / play mode. The icon is as tall as the title text. */
export default function PathTile({ onClick, icon, iconBg, title, badge, disabled }: PathTileProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative w-full flex items-center gap-4 rounded-2xl bg-black/65 border border-white/15 p-4 text-left backdrop-blur-sm border-b-[5px] border-b-white/25 transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'active:translate-y-1 active:border-b active:bg-black/80'
      }`}
    >
      {badge && (
        <span className="absolute -top-2 right-4 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black tracking-wide text-white">
          {badge}
        </span>
      )}
      {/* text-3xl + leading-none makes the title exactly 1.875rem tall; the icon box matches it */}
      <span className={`flex-none flex items-center justify-center w-[1.875rem] h-[1.875rem] rounded-lg ${iconBg}`}>{icon}</span>
      <span className="flex-1 min-w-0 font-game text-3xl text-white leading-none">{title}</span>
      {!disabled && <ChevronRight className="flex-none w-6 h-6 text-[#FFD43B]" />}
    </button>
  );
}
