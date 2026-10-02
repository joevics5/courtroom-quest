import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface PathTileProps {
  onClick: () => void;
  icon: ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  badge?: string;
  disabled?: boolean;
}

/** Big tappable game-style row used for choosing a path / play mode. */
export default function PathTile({ onClick, icon, iconBg, title, subtitle, badge, disabled }: PathTileProps) {
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
      <span className={`flex-none flex items-center justify-center w-14 h-14 rounded-xl ${iconBg}`}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-game text-3xl text-white leading-none">{title}</span>
        <span className="block mt-1 text-sm text-white/65">{subtitle}</span>
      </span>
      {!disabled && <ChevronRight className="flex-none w-6 h-6 text-[#FFD43B]" />}
    </button>
  );
}
