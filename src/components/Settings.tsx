import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ArrowLeft, X, Feather, Scale as ScaleIcon, Flame, Check } from 'lucide-react';
import HeroBackground from './HeroBackground';
import AvatarCreator from './AvatarCreator';
import { savePublicProfile } from '../lib/publicProfile';
import AvatarFace from './AvatarFace';
import { getUserAvatar } from '../lib/avatars';
import { getLevelForWins } from '../lib/levels';
import { db } from '../lib/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getPublicName } from '../lib/userName';
import { LanguageList } from './LanguageSwitcher';
import type { Difficulty, UserProfile } from '../types';

interface Props {
  userId: string;
  userProfile: UserProfile;
  onBack: () => void;
  onProfileUpdated: (profile: UserProfile) => void;
  /** Guests: opens the save-your-progress sign-up */
  onSaveProgress?: () => void;
  /** Render as a compact popup body (no full-page chrome) — used from the home screen */
  popup?: boolean;
}

const TIER_STYLE: Record<Difficulty, { icon: typeof Feather; iconBg: string }> = {
  easy: { icon: Feather, iconBg: 'bg-green-600' },
  medium: { icon: ScaleIcon, iconBg: 'bg-blue-600' },
  hard: { icon: Flame, iconBg: 'bg-red-600' }
};

const PANEL = 'rounded-3xl bg-black/65 border border-white/15 p-5 backdrop-blur-sm';

export default function Settings({ userId, userProfile, onBack, onProfileUpdated, onSaveProgress, popup = false }: Props) {
  const { t, i18n } = useTranslation();
  const upper = (text: string) => text.toLocaleUpperCase(i18n.resolvedLanguage);
  const rankTitle = t(`ranks.${getLevelForWins(userProfile.wins_count ?? 0).level}`);
  const [selected, setSelected] = useState<Difficulty>(userProfile.difficulty || 'medium');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const tiers: Difficulty[] = ['easy', 'medium', 'hard'];
  const { user, signOut } = useAuth();
  const isGuest = !!user?.is_anonymous;
  const [nickname, setNickname] = useState(user?.user_metadata?.nickname || '');
  const [nameStatus, setNameStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [nameError, setNameError] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [changingAvatar, setChangingAvatar] = useState(false);

  const handleSaveNickname = async () => {
    const value = nickname.trim().replace(/\s+/g, ' ');
    if (value.length < 3 || value.length > 20) {
      setNameError(t('settings.nickname.errLength'));
      setNameStatus('error');
      return;
    }
    if (!/^[A-Za-z0-9 _.-]+$/.test(value)) {
      setNameError(t('settings.nickname.errChars'));
      setNameStatus('error');
      return;
    }
    setNameStatus('saving');
    setNameError('');
    const claimed = await savePublicProfile({ username: value });
    if (!claimed.ok) {
      setNameError(
        claimed.error === 'taken' ? t('settings.nickname.errTaken') : claimed.error === 'invalid' ? t('settings.nickname.errInvalid') : t('settings.nickname.errSave')
      );
      setNameStatus('error');
      return;
    }
    const { error } = await supabase.auth.updateUser({ data: { nickname: value } });
    if (error) {
      console.error('Failed to save nickname:', error);
      setNameError(t('settings.nickname.errSave'));
      setNameStatus('error');
      return;
    }
    setNickname(value);
    setNameStatus('saved');
    setTimeout(() => setNameStatus('idle'), 2000);
  };

  const handleSelect = async (tier: Difficulty) => {
    setSelected(tier);
    setSaving(true);
    setSaved(false);
    try {
      const updated = await db.users.updateProfile(userId, { difficulty: tier });
      onProfileUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save difficulty:', error);
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <div className="max-w-lg lg:max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          aria-label={popup ? t('settings.close') : t('settings.back')}
          className="flex-none flex items-center justify-center w-11 h-11 rounded-full bg-black/55 border border-white/15 text-white"
        >
          {popup ? <X className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
        </button>
        <h1 className="logo-gold font-game text-5xl leading-none">{t('settings.title')}</h1>
      </div>

      <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
        {/* Difficulty */}
        <div className={`${PANEL} lg:row-span-3`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-game text-3xl text-white leading-none">{t('settings.difficulty.heading')}</h2>
            {saved && (
              <span className="flex items-center gap-1 text-sm font-bold text-green-400">
                <Check className="w-4 h-4" /> {t('settings.difficulty.saved')}
              </span>
            )}
          </div>

          <div className="space-y-3">
            {tiers.map((tier) => {
              const style = TIER_STYLE[tier];
              const Icon = style.icon;
              const isSelected = selected === tier;
              return (
                <button
                  key={tier}
                  onClick={() => handleSelect(tier)}
                  disabled={saving}
                  className={`w-full flex items-start gap-3 rounded-2xl p-3 text-left border-2 border-b-[5px] transition-all active:translate-y-1 active:border-b-2 disabled:opacity-70 ${
                    isSelected ? 'bg-[#FFD43B]/10 border-[#FFD43B]' : 'bg-white/5 border-white/15'
                  }`}
                >
                  <span className={`flex-none flex items-center justify-center w-12 h-12 rounded-xl ${style.iconBg}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-game text-3xl text-white leading-none">{upper(t(`settings.difficulty.${tier}.label`))}</span>
                      <span className="text-xs font-bold tracking-wide text-[#FFD43B]">{upper(t(`settings.difficulty.${tier}.tagline`))}</span>
                    </span>
                    {isSelected && <span className="block mt-1.5 text-sm text-white/70 leading-snug">{t(`settings.difficulty.${tier}.description`)}</span>}
                  </span>
                  {isSelected && (
                    <span className="flex-none flex items-center justify-center w-7 h-7 rounded-full bg-[#FFD43B]">
                      <Check className="w-4 h-4 text-black" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-white/50">{t('settings.difficulty.note')}</p>
        </div>

        {/* Nickname */}
        <div className={PANEL}>
          <h2 className="font-game text-3xl text-white leading-none mb-1">{t('settings.nickname.heading')}</h2>
          <p className="text-sm text-white/60 mb-3">
            <Trans
              i18nKey="settings.nickname.help"
              values={{ name: getPublicName(user) }}
              components={{ name: <span className="font-bold text-[#FFD43B]" /> }}
            />
          </p>
          <div className="flex gap-2">
            <input
              value={nickname}
              onChange={e => { setNickname(e.target.value); if (nameStatus !== 'idle') setNameStatus('idle'); }}
              maxLength={20}
              placeholder={t('settings.nickname.placeholder')}
              className="flex-1 min-w-0 rounded-xl bg-black/50 border border-white/20 px-3 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFD43B]"
            />
            <button
              onClick={handleSaveNickname}
              disabled={nameStatus === 'saving' || !nickname.trim()}
              className="rounded-xl bg-[#FFD43B] text-black font-game text-2xl px-5 border-b-[5px] border-[#B8860B] active:translate-y-1 active:border-b-2 transition-all disabled:opacity-50"
            >
              {nameStatus === 'saving' ? '…' : t('settings.nickname.save')}
            </button>
          </div>
          {nameStatus === 'saved' && (
            <p className="mt-3 flex items-center gap-1 text-sm font-bold text-green-400"><Check className="w-4 h-4" /> {t('settings.nickname.saved')}</p>
          )}
          {nameStatus === 'error' && <p className="mt-3 text-sm text-red-400">{nameError}</p>}
        </div>

        {/* Avatar */}
        <div className={PANEL}>
          <h2 className="font-game text-3xl text-white leading-none mb-3">{t('settings.avatar.heading')}</h2>
          <div className="flex items-center gap-4">
            <div className="flex-none w-24 h-24 rounded-2xl overflow-hidden border-4 border-[#FFD43B]">
              <AvatarFace config={getUserAvatar(user)} rank={getLevelForWins(userProfile.wins_count ?? 0).level} label={t('settings.avatar.label')} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/60 mb-3">
                {t('settings.avatar.help', { rank: rankTitle })}
              </p>
              <button
                onClick={() => setChangingAvatar(true)}
                className="rounded-xl bg-[#FFD43B] text-black font-game text-xl px-4 py-2 border-b-[5px] border-[#B8860B] active:translate-y-1 active:border-b-2 transition-all"
              >
                {t('settings.avatar.change')}
              </button>
            </div>
          </div>
        </div>

        {/* Language */}
        <div className={PANEL}>
          <h2 className="font-game text-3xl text-white leading-none mb-1">{t('language.title')}</h2>
          <p className="text-sm text-white/60 mb-3">{t('language.hint')}</p>
          <LanguageList />
        </div>

        {/* Account */}
        <div className={PANEL}>
          <h2 className="font-game text-3xl text-white leading-none mb-2">{t('settings.account.heading')}</h2>
          {isGuest && (
            <>
              <p className="text-sm text-[#FFD43B]/90 mb-3">
                {t('settings.account.guestWarning')}
              </p>
              {onSaveProgress && (
                <button
                  onClick={onSaveProgress}
                  className="w-full mb-3 rounded-xl bg-[#FFD43B] text-black font-game text-2xl py-2.5 border-b-[5px] border-[#B8860B] active:translate-y-1 active:border-b-2 transition-all"
                >
                  {t('settings.account.saveProgress')}
                </button>
              )}
            </>
          )}
          {!confirmSignOut ? (
            <button
              onClick={() => (isGuest ? setConfirmSignOut(true) : signOut())}
              className="w-full rounded-xl bg-white/10 border border-white/20 text-white font-game text-2xl py-2.5 active:translate-y-0.5 transition-transform"
            >
              {t('settings.account.signOut')}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => signOut()}
                className="rounded-xl bg-red-600 text-white font-game text-xl py-2.5 border-b-[5px] border-red-900 active:translate-y-1 active:border-b-2 transition-all"
              >
                {t('settings.account.loseProgress')}
              </button>
              <button
                onClick={() => setConfirmSignOut(false)}
                className="rounded-xl bg-white/10 border border-white/20 text-white font-game text-xl py-2.5"
              >
                {t('settings.account.cancel')}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-white/60">
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{t('settings.terms')}</a>
          {' · '}
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{t('settings.privacy')}</a>
        </p>
      </div>
    </div>
  );

  if (changingAvatar && user) {
    return (
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#0b0d14]">
        <AvatarCreator
          mode="change"
          initialAvatar={getUserAvatar(user)}
          wins={userProfile.wins_count ?? 0}
          onBack={() => setChangingAvatar(false)}
          onDone={() => setChangingAvatar(false)}
        />
      </div>
    );
  }

  if (popup) {
    return <div className="p-4 sm:p-5">{content}</div>;
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#0b0d14]">
      <HeroBackground overlay="from-black/80 via-black/75 to-black/90" />
      <div
        className="relative z-10 min-h-[100dvh] px-4"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)', paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
      >
        {content}
      </div>
    </div>
  );
}
