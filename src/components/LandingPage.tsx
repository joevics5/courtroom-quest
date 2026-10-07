import { getLevelForWins, getNextLevel, getRankProgress } from '../lib/levels';
import { ArrowLeft, Briefcase, FileText, Mail, Swords, Settings as SettingsIcon, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getPublicName } from '../lib/userName';
import CaseOfTheWeek from './CaseOfTheWeek';
import HeroBackground from './HeroBackground';
import PathTile from './PathTile';
import type { CaseInvitation, UserProfile } from '../types';

interface LandingPageProps {
  userProfile: UserProfile | null;
  onNavigateToCaseBoard: () => void;
  onNavigateToCustomCases: () => void;
  onNavigateToChallengeBoard: () => void;
  onPlayFeaturedCase: (caseId: string) => void;
  onOpenSettings: () => void;
  onOpenAdmin?: () => void;
  onBackToHome: () => void;
  ongoingCount?: number;
  invites?: CaseInvitation[];
  respondingInviteId?: string | null;
  onAcceptInvite?: (invitationId: string) => void;
  onDeclineInvite?: (invitationId: string) => void;
}

export default function LandingPage({
  userProfile,
  onNavigateToCaseBoard,
  onNavigateToCustomCases,
  onNavigateToChallengeBoard,
  onPlayFeaturedCase,
  onOpenSettings,
  onOpenAdmin,
  onBackToHome,
  ongoingCount = 0,
  invites = [],
  respondingInviteId = null,
  onAcceptInvite,
  onDeclineInvite
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
              {getLevelForWins(userProfile.wins_count ?? 0).title} · {userProfile.wins_count ?? 0} {userProfile.wins_count === 1 ? 'win' : 'wins'}
            </span>
          </div>
        )}
        {userProfile && getNextLevel(userProfile.wins_count ?? 0) && (
          <div className="mt-2 self-start w-full max-w-[16rem]">
            <div className="h-1.5 rounded-full bg-white/15 overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full bg-[#FFD43B]" style={{ width: `${Math.round(getRankProgress(userProfile.wins_count ?? 0) * 100)}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-white/60">
              {getNextLevel(userProfile.wins_count ?? 0)!.winsNeeded} more {getNextLevel(userProfile.wins_count ?? 0)!.winsNeeded === 1 ? 'win' : 'wins'} to {getNextLevel(userProfile.wins_count ?? 0)!.nextTitle}
            </p>
          </div>
        )}

        <main className="flex-1 mt-4 space-y-5 max-w-lg w-full mx-auto">
          {invites.length > 0 && (
            <section className="rounded-3xl bg-black/70 border-2 border-red-500/70 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-5 h-5 text-red-400" />
                <h2 className="font-game text-2xl text-white leading-none">
                  {invites.length === 1 ? 'YOU HAVE AN INVITE' : `YOU HAVE ${invites.length} INVITES`}
                </h2>
              </div>
              <div className="space-y-3">
                {invites.map(invite => {
                  const myRole = invite.inviter_role === 'defense' ? 'Prosecution' : 'Defense';
                  const busy = respondingInviteId === invite.id;
                  return (
                    <div key={invite.id} className="rounded-2xl bg-white/5 border border-white/15 p-3">
                      <div className="font-bold text-white leading-tight">{invite.case_title || 'A case'}</div>
                      <div className="text-sm text-white/65 mt-0.5">A friend challenged you — you'd play the {myRole}.</div>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <button
                          onClick={() => onAcceptInvite?.(invite.id)}
                          disabled={busy}
                          className="rounded-xl bg-[#FFD43B] text-black font-game text-xl py-2 border-b-4 border-[#B8860B] active:translate-y-0.5 active:border-b-2 transition-all disabled:opacity-50"
                        >
                          {busy ? '…' : 'ACCEPT'}
                        </button>
                        <button
                          onClick={() => onDeclineInvite?.(invite.id)}
                          disabled={busy}
                          className="rounded-xl bg-white/10 border border-white/20 text-white font-game text-xl py-2 disabled:opacity-50"
                        >
                          DECLINE
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

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
              badge={ongoingCount > 0 ? `${ongoingCount} ONGOING` : undefined}
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
              badge={invites.length > 0 ? `${invites.length} INVITE${invites.length > 1 ? 'S' : ''} WAITING` : 'LIVE 1V1'}
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
