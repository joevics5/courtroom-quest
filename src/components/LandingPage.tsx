import { getLevelForWins, getNextLevel, getRankProgress } from '../lib/levels';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Briefcase, FileText, Mail, ScrollText, Swords, Settings as SettingsIcon, Trophy, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getPublicName } from '../lib/userName';
import CaseOfTheWeek from './CaseOfTheWeek';
import HeroBackground from './HeroBackground';
import PathTile from './PathTile';
import LanguageSwitcher from './LanguageSwitcher';
import type { CaseInvitation, UserProfile } from '../types';

interface LandingPageProps {
  userProfile: UserProfile | null;
  onNavigateToCaseBoard: () => void;
  /** Opens the Quick Start list of easy starter cases. */
  onNavigateToQuickStart?: () => void;
  onNavigateToCustomCases: () => void;
  onNavigateToChallengeBoard: () => void;
  onNavigateToCaseHistory?: () => void;
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
  onNavigateToQuickStart,
  onNavigateToCustomCases,
  onNavigateToChallengeBoard,
  onNavigateToCaseHistory,
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
  const { t } = useTranslation();
  const rankOf = (wins: number) => t(`ranks.${getLevelForWins(wins).level}`);

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#0b0d14]">
      <HeroBackground overlay="from-black/80 via-black/70 to-black/90" />

      <div
        className="relative z-10 min-h-[100dvh] flex flex-col px-4 lg:px-10"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)', paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <div className="w-full lg:max-w-6xl lg:mx-auto flex flex-col">
        {/* Top bar */}
        <header className="flex items-center gap-2">
          <button
            onClick={onBackToHome}
            aria-label={t('landing.backHome')}
            className="flex-none flex items-center justify-center w-11 h-11 rounded-full bg-black/55 border border-white/15 text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="sr-only sm:not-sr-only logo-gold font-game text-3xl lg:text-5xl leading-none sm:flex-1 min-w-0 truncate">COURTROOM QUEST</h1>
          <div className="flex-1 sm:hidden" aria-hidden="true" />
          {onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="flex-none rounded-full bg-[#FFD43B] text-black px-3 h-11 text-xs font-black tracking-wide"
            >
              ADMIN
            </button>
          )}
          <LanguageSwitcher />
          <button
            onClick={onOpenSettings}
            aria-label={t('common.settings')}
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
              {rankOf(userProfile.wins_count ?? 0)} · {t('common.wins', { count: userProfile.wins_count ?? 0 })}
            </span>
          </div>
        )}
        {userProfile && getNextLevel(userProfile.wins_count ?? 0) && (
          <div className="mt-2 self-start w-full max-w-[16rem]">
            <div className="h-1.5 rounded-full bg-white/15 overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full bg-[#FFD43B]" style={{ width: `${Math.round(getRankProgress(userProfile.wins_count ?? 0) * 100)}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-white/60">
              {t('landing.nextRank', { count: getNextLevel(userProfile.wins_count ?? 0)!.winsNeeded, rank: t(`ranks.${getLevelForWins(userProfile.wins_count ?? 0).level + 1}`) })}
            </p>
          </div>
        )}

        </div>

        <main className="flex-1 mt-4 lg:mt-8 space-y-5 max-w-lg lg:max-w-6xl w-full mx-auto lg:grid lg:grid-cols-12 lg:gap-x-10 lg:space-y-0 lg:items-start lg:content-center">
          <div className="space-y-5 lg:col-span-5">
          {invites.length > 0 && (
            <section className="rounded-3xl bg-black/70 border-2 border-red-500/70 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-5 h-5 text-red-400" />
                <h2 className="font-game text-2xl text-white leading-none">
                  {t('landing.invitesHeading', { count: invites.length })}
                </h2>
              </div>
              <div className="space-y-3">
                {invites.map(invite => {
                  const myRole = t(invite.inviter_role === 'defense' ? 'roles.prosecution' : 'roles.defense');
                  const busy = respondingInviteId === invite.id;
                  return (
                    <div key={invite.id} className="rounded-2xl bg-white/5 border border-white/15 p-3">
                      <div className="font-bold text-white leading-tight">{invite.case_title || t('landing.aCase')}</div>
                      <div className="text-sm text-white/65 mt-0.5">{t('landing.challengedYou', { role: myRole })}</div>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <button
                          onClick={() => onAcceptInvite?.(invite.id)}
                          disabled={busy}
                          className="rounded-xl bg-[#FFD43B] text-black font-game text-xl py-2 border-b-4 border-[#B8860B] active:translate-y-0.5 active:border-b-2 transition-all disabled:opacity-50"
                        >
                          {busy ? '…' : t('landing.accept')}
                        </button>
                        <button
                          onClick={() => onDeclineInvite?.(invite.id)}
                          disabled={busy}
                          className="rounded-xl bg-white/10 border border-white/20 text-white font-game text-xl py-2 disabled:opacity-50"
                        >
                          {t('landing.decline')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <CaseOfTheWeek onPlayCase={onPlayFeaturedCase} />
          </div>

          <div className="space-y-5 mt-5 lg:mt-0 lg:col-span-7">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/20" />
            <h2 className="font-game text-2xl text-white/90 tracking-wider">{t('landing.choosePath')}</h2>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          <div className="space-y-4">
            {onNavigateToQuickStart && (
              <PathTile
                onClick={onNavigateToQuickStart}
                icon={<Zap className="w-4 h-4 text-black" />}
                iconBg="bg-[#FFD43B]"
                title={t('landing.quickStart')}
                badge={t('landing.quickStartBadge')}
              />
            )}
            <PathTile
              onClick={onNavigateToCaseBoard}
              icon={<Briefcase className="w-4 h-4 text-white" />}
              iconBg="bg-blue-600"
              title={t('landing.caseBoard')}
              badge={ongoingCount > 0 ? t('landing.ongoing', { count: ongoingCount }) : undefined}
            />
            <PathTile
              onClick={onNavigateToCustomCases}
              icon={<FileText className="w-4 h-4 text-white" />}
              iconBg="bg-purple-600"
              title={t('landing.createCase')}
            />
            <PathTile
              onClick={onNavigateToChallengeBoard}
              icon={<Swords className="w-4 h-4 text-white" />}
              iconBg="bg-orange-600"
              title={t('landing.challenge')}
              badge={invites.length > 0 ? t('landing.invitesWaiting', { count: invites.length }) : t('landing.live1v1')}
            />
            {onNavigateToCaseHistory && (
              <PathTile
                onClick={onNavigateToCaseHistory}
                icon={<ScrollText className="w-4 h-4 text-white" />}
                iconBg="bg-slate-600"
                title={t('landing.caseHistory')}
              />
            )}
          </div>

          <div className="text-center pt-1">
            <a href="/watch" className="text-[11px] font-bold tracking-[0.2em] text-white/60 underline underline-offset-4">
              {t('landing.watchLive')}
            </a>
          </div>
          </div>
        </main>
      </div>
    </div>
  );
}
