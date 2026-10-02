import { ArrowLeft, Briefcase, FileText, Swords, Settings as SettingsIcon, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getPublicName } from '../lib/userName';
import CaseOfTheWeek from './CaseOfTheWeek';
import HeroBackground from './HeroBackground';
import PathTile from './PathTile';
import type { UserProfile } from '../types';

interface LandingPageProps {
  userProfile: UserProfile | null;
  onNavigateToCaseBoard: () => void;
  onNavigateToCustomCases: () => void;
  onNavigateToChallengeBoard: () => void;
  onPlayFeaturedCase: (caseId: string) => void;
  onOpenSettings: () => void;
  onOpenAdmin?: () => void;
  onBackToHome: () => void;
}

export default function LandingPage({
  userProfile,
  onNavigateToCaseBoard,
  onNavigateToCustomCases,
  onNavigateToChallengeBoard,
  onPlayFeaturedCase,
  onOpenSettings,
  onOpenAdmin,
  onBackToHome
}: LandingPageProps) {
  const { user } = useAuth();

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#0b0d14]">
      <HeroBackground overlay="from-black/80 via-black/70 to-black/90" />

      <div
        className="relative z-10 min-h-[100dvh] flex flex-col px-4"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)', paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        {/* Top bar */}
        <header className="flex items-center gap-2">
          <button
            onClick={onBackToHome}
            aria-label="Back to home"
            className="flex-none flex items-center justify-center w-11 h-11 rounded-full bg-black/55 border border-white/15 text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="logo-gold font-game text-3xl leading-none flex-1 min-w-0 truncate">COURTROOM QUEST</h1>
          {onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="flex-none rounded-full bg-[#FFD43B] text-black px-3 h-11 text-xs font-black tracking-wide"
            >
              ADMIN
            </button>
          )}
          <button
            onClick={onOpenSettings}
            aria-label="Settings"
            className="flex-none flex items-center justify-center w-11 h-11 rounded-full bg-black/55 border border-white/15 text-white"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </header>

        {/* Player chip */}
        {userProfile && (
          <div className="mt-3 self-start inline-flex items-center gap-2 rounded-full bg-black/60 border border-white/15 pl-3 pr-4 py-1.5 backdrop-blur-sm max-w-full">
            <Trophy className="flex-none w-4 h-4 text-[#FFD43B]" />
            <span className="font-game text-xl text-white leading-none truncate">{getPublicName(user)}</span>
            <span className="text-white/30">·</span>
            <span className="text-xs text-white/70 whitespace-nowrap">
              {userProfile.current_level} · {userProfile.wins_count} {userProfile.wins_count === 1 ? 'win' : 'wins'}
            </span>
          </div>
        )}

        <main className="flex-1 mt-4 space-y-5 max-w-lg w-full mx-auto">
          <CaseOfTheWeek onPlayCase={onPlayFeaturedCase} />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/20" />
            <h2 className="font-game text-2xl text-white/90 tracking-wider">CHOOSE YOUR PATH</h2>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          <div className="space-y-4">
            <PathTile
              onClick={onNavigateToCaseBoard}
              icon={<Briefcase className="w-7 h-7 text-white" />}
              iconBg="bg-blue-600"
              title="CASE BOARD"
              subtitle="Take on real cases. Investigate. Argue. Win."
            />
            <PathTile
              onClick={onNavigateToCustomCases}
              icon={<FileText className="w-7 h-7 text-white" />}
              iconBg="bg-purple-600"
              title="CREATE YOUR CASE"
              subtitle="Your evidence. Your witnesses."
            />
            <PathTile
              onClick={onNavigateToChallengeBoard}
              icon={<Swords className="w-7 h-7 text-white" />}
              iconBg="bg-orange-600"
              title="CHALLENGE A PLAYER"
              subtitle="Face a real opponent. No AI."
              badge="LIVE 1V1"
            />
          </div>

          <div className="text-center pt-1">
            <a href="/watch" className="text-[11px] font-bold tracking-[0.2em] text-white/60 underline underline-offset-4">
              WATCH A LIVE TRIAL
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
