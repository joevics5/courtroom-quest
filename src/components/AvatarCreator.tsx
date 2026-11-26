import { useTranslation } from 'react-i18next';
import { rankTitle } from '../lib/displayName';
import { useRef, useState, useEffect } from 'react';
import { Check, Lock, Shuffle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isUsernameAvailable, savePublicProfile } from '../lib/publicProfile';
import ScreenShell from './ScreenShell';
import AvatarFace from './AvatarFace';
import { LEVELS, getLevelForWins } from '../lib/levels';
import {
  ACCENT_COLORS,
  ATTIRES,
  ATTIRE_COLORS,
  AvatarConfig,
  BACKDROPS,
  BEARDS,
  BROW_SHAPES,
  EYE_COLORS,
  EYE_SHAPES,
  GENDERS,
  HAIR_COLORS,
  HAIR_STYLES,
  HEAD_SHAPES,
  MOUTH_SHAPES,
  NOSE_SHAPES,
  SKIN_TONES,
  USERNAME_MAX,
  adaptToGender,
  hairStylesFor,
  randomAvatar,
  validateUsername
} from '../lib/avatars';

interface AvatarCreatorProps {
  /** "signup": username then avatar, right after creating an account. "change": avatar only, from Settings. */
  mode?: 'signup' | 'change';
  /** Pre-fills the username box (e.g. a nickname chosen earlier). */
  initialUsername?: string;
  initialAvatar?: AvatarConfig;
  /** Cases won so far: decides which rank outfits are unlocked. */
  wins?: number;
  onDone: () => void;
  /** Back button (change mode). */
  onBack?: () => void;
}

const PANEL = 'rounded-3xl bg-black/65 border border-white/15 p-5 backdrop-blur-sm';
const GOLD_BUTTON =
  'rounded-xl bg-[#FFD43B] text-black font-game text-2xl px-5 py-2.5 border-b-[5px] border-[#B8860B] active:translate-y-1 active:border-b-2 transition-all disabled:opacity-50';
const GHOST_BUTTON =
  'rounded-xl bg-white/10 border border-white/20 text-white font-game text-xl px-4 py-2.5 active:translate-y-0.5 transition-transform';

type TabId = 'face' | 'hair' | 'outfit' | 'extras' | 'backdrop';
const TABS: { id: TabId }[] = [{ id: 'face' }, { id: 'hair' }, { id: 'outfit' }, { id: 'extras' }, { id: 'backdrop' }];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-game text-xl text-white/90 leading-none mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Tick() {
  return (
    <span className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-[#FFD43B]">
      <Check className="w-3 h-3 text-black" />
    </span>
  );
}

function Swatches({
  label,
  colors,
  value,
  onChange
}: {
  label: string;
  colors: readonly string[];
  value: number;
  onChange: (i: number) => void;
}) {
  return (
    <Section title={label}>
      <div className="flex flex-wrap gap-2.5">
        {colors.map((c, i) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(i)}
            aria-label={`${label} ${i + 1}`}
            aria-pressed={value === i}
            className={`flex items-center justify-center w-11 h-11 rounded-full border-2 transition-transform active:scale-95 ${
              value === i ? 'border-[#FFD43B] scale-110' : 'border-white/25'
            }`}
            style={{ backgroundColor: c }}
          >
            {value === i && <Check className="w-5 h-5 text-white drop-shadow" />}
          </button>
        ))}
      </div>
    </Section>
  );
}

/** Grid of options, each previewed on the player's own avatar with only that option changed. */
function PickGrid<T extends string>({
  label,
  options,
  names,
  value,
  preview,
  onPick,
  crop = 'face'
}: {
  label: string;
  options: readonly T[];
  names?: Record<T, string>;
  value: T;
  preview: (option: T) => AvatarConfig;
  onPick: (option: T) => void;
  crop?: 'face' | 'full';
}) {
  return (
    <Section title={label}>
      <div className="grid grid-cols-4 gap-2.5">
        {options.map((o, i) => (
          <button
            key={o}
            type="button"
            onClick={() => onPick(o)}
            aria-label={`${label} ${names?.[o] ?? i + 1}`}
            aria-pressed={value === o}
            className="text-center"
          >
            <span
              className={`relative block aspect-square rounded-2xl overflow-hidden border-2 transition-transform active:scale-95 ${
                value === o ? 'border-[#FFD43B]' : 'border-white/20'
              }`}
            >
              <AvatarFace config={preview(o)} crop={crop} />
              {value === o && <Tick />}
            </span>
            {names && <span className="block mt-1 text-[11px] text-white/65 leading-tight">{names[o]}</span>}
          </button>
        ))}
      </div>
    </Section>
  );
}

type ShapeField = 'headShape' | 'eyeShape' | 'noseShape' | 'mouthShape' | 'browShape';

/**
 * Username and avatar screens. Shown once right after signup (username first,
 * then avatar) and again from Settings > Change avatar. Saves to the account
 * metadata, so the avatar appears on the trial screen.
 */
export default function AvatarCreator({ mode = 'signup', initialUsername = '', initialAvatar, wins = 0, onDone, onBack }: AvatarCreatorProps) {
  const { t } = useTranslation();
  const names = <K extends string>(group: string, ids: readonly K[]) => Object.fromEntries(ids.map(id => [id, t(`avatarCreator.${group}.${id}`, { defaultValue: String(id) })])) as Record<K, string>;
  const L = (key: string) => t(`avatarCreator.labels.${key}`);
  const myRank = getLevelForWins(wins).level;
  const [previewRank, setPreviewRank] = useState(myRank);
  const [step, setStep] = useState<'username' | 'avatar'>(mode === 'signup' ? 'username' : 'avatar');
  const [username, setUsername] = useState(initialUsername);
  const [avatar, setAvatar] = useState<AvatarConfig>(() => initialAvatar ?? randomAvatar());
  const [tab, setTab] = useState<TabId>('face');
  const [usernameError, setUsernameError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewSpeaking, setPreviewSpeaking] = useState(false);
  const speakTimer = useRef<number>();

  useEffect(() => () => window.clearTimeout(speakTimer.current), []);

  const set = <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) =>
    setAvatar(prev => ({ ...prev, [key]: value }));
  const withValue = <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]): AvatarConfig => ({ ...avatar, [key]: value });

  /** Shape options are numbered looks 0..count-1; each is previewed on the current avatar. */
  const shapes = (label: string, field: ShapeField, count: number) => {
    const options = Array.from({ length: count }, (_, i) => String(i));
    return (
      <PickGrid
        label={label}
        options={options}
        value={String(avatar[field])}
        preview={o => withValue(field, Number(o))}
        onPick={o => set(field, Number(o))}
      />
    );
  };

  const testMouth = () => {
    setPreviewSpeaking(true);
    window.clearTimeout(speakTimer.current);
    speakTimer.current = window.setTimeout(() => setPreviewSpeaking(false), 2200);
  };

  const [checkingName, setCheckingName] = useState(false);

  const submitUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateUsername(username);
    if (problem) {
      setUsernameError(problem);
      return;
    }
    setCheckingName(true);
    const free = await isUsernameAvailable(username);
    setCheckingName(false);
    if (!free) {
      setUsernameError(t('settings.nickname.errTaken'));
      return;
    }
    setUsernameError('');
    setStep('avatar');
  };

  const save = async () => {
    setSaving(true);
    setSaveError('');
    const name = mode === 'signup' ? username.trim().replace(/\s+/g, ' ') : undefined;
    // Claim the name first: it is unique, so someone may have taken it meanwhile.
    const shared = await savePublicProfile({ username: name, avatar });
    if (!shared.ok) {
      setSaving(false);
      if (shared.error === 'taken') {
        setStep('username');
        setUsernameError(t('avatarCreator.errJustTaken'));
      } else {
        setSaveError(t('avatarCreator.errSave'));
      }
      return;
    }
    const data: Record<string, unknown> = { avatar };
    if (name) data.nickname = name;
    const { error } = await supabase.auth.updateUser({ data });
    setSaving(false);
    if (error) {
      console.error('Failed to save avatar:', error);
      setSaveError(t('avatarCreator.errSave'));
      return;
    }
    onDone();
  };

  if (step === 'username') {
    return (
      <ScreenShell title={t('avatarCreator.chooseName')} subtitle={t('avatarCreator.chooseNameSub')} maxWidth="max-w-md">
        <form onSubmit={submitUsername} className={`${PANEL} space-y-4`}>
          <div>
            <label htmlFor="username" className="block font-game text-2xl text-white leading-none mb-2">
              {t('avatarCreator.usernameLabel')}
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              maxLength={USERNAME_MAX}
              autoFocus
              autoComplete="nickname"
              placeholder={t('avatarCreator.placeholder')}
              className="w-full rounded-xl bg-black/50 border border-white/20 px-3 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFD43B]"
            />
            <p className="mt-2 text-xs text-white/50">{t('avatarCreator.nameHint', { max: USERNAME_MAX })}</p>
            {usernameError && <p className="mt-2 text-sm text-red-400">{usernameError}</p>}
          </div>
          <button type="submit" disabled={checkingName} className={`${GOLD_BUTTON} w-full`}>
            {checkingName ? t('avatarCreator.checking') : t('pretrial.continue')}
          </button>
        </form>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={mode === 'signup' ? t('avatarCreator.titleSignup') : t('settings.avatar.change')}
      subtitle={t('avatarCreator.sub')}
      maxWidth="max-w-md"
      onBack={mode === 'signup' ? () => setStep('username') : onBack}
    >
      <div className={`${PANEL} space-y-5`}>
        {/* preview */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={testMouth}
            aria-label={t('avatarCreator.previewAria')}
            className="relative w-44 h-44 rounded-3xl overflow-hidden border-4 border-[#FFD43B] shadow-[0_8px_0_#B8860B,0_0_32px_rgba(255,212,59,0.25)] active:translate-y-0.5 transition-transform"
          >
            <AvatarFace config={avatar} speaking={previewSpeaking} rank={previewRank} label={t('avatarCreator.previewLabel')} />
          </button>
          <p className="mt-4 font-game text-2xl text-white leading-none truncate max-w-full">
            {mode === 'signup' ? username.trim() : t('avatarCreator.tapPreview')}
          </p>
          <p className="mt-1 text-xs text-white/60">
            {previewRank === myRank
              ? t('avatarCreator.rank', { title: rankTitle(myRank) })
              : t(previewRank > myRank ? 'avatarCreator.previewingLocked' : 'avatarCreator.previewing', { title: rankTitle(previewRank) })}
          </p>
          <button type="button" onClick={() => setAvatar(randomAvatar())} className={`${GHOST_BUTTON} mt-3 inline-flex items-center gap-2 !text-lg !py-1.5`}>
            <Shuffle className="w-4 h-4" />
            {t('avatarCreator.shuffle')}
          </button>
        </div>

        {/* tabs */}
        <div role="tablist" className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {TABS.map(tb => (
            <button
              key={tb.id}
              role="tab"
              aria-selected={tab === tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={`flex-none rounded-full px-4 py-1.5 font-game text-xl border transition-colors ${
                tab === tb.id ? 'bg-[#FFD43B] text-black border-[#FFD43B]' : 'bg-white/10 text-white border-white/20'
              }`}
            >
              {t(`avatarCreator.tabs.${tb.id}`)}
            </button>
          ))}
        </div>

        {/* options */}
        <div className="space-y-5 max-h-[44dvh] overflow-y-auto pr-1">
          {tab === 'face' && (
            <>
              <PickGrid
                label={L('version')}
                options={GENDERS}
                names={names('gender', GENDERS)}
                value={avatar.gender}
                preview={o => adaptToGender(avatar, o)}
                onPick={o => setAvatar(prev => adaptToGender(prev, o))}
              />
              <Swatches label={L('skin')} colors={SKIN_TONES} value={avatar.skin} onChange={i => set('skin', i)} />
              {shapes(L('head'), 'headShape', HEAD_SHAPES)}
              {shapes(L('eyes'), 'eyeShape', EYE_SHAPES)}
              <Swatches label={L('eyeColor')} colors={EYE_COLORS} value={avatar.eyeColor} onChange={i => set('eyeColor', i)} />
              {shapes(L('nose'), 'noseShape', NOSE_SHAPES)}
              {shapes(L('mouth'), 'mouthShape', MOUTH_SHAPES)}
              {shapes(L('brows'), 'browShape', BROW_SHAPES)}
              <PickGrid
                label={L('age')}
                options={['0', '1', '2'] as const}
                names={names('age', ['0', '1', '2'] as const)}
                value={String(avatar.age) as '0' | '1' | '2'}
                preview={o => withValue('age', Number(o))}
                onPick={o => set('age', Number(o))}
              />
            </>
          )}
          {tab === 'hair' && (
            <>
              <PickGrid
                label={L('hairStyle')}
                options={hairStylesFor(avatar.gender)}
                names={names('hair', HAIR_STYLES)}
                value={avatar.hairStyle}
                preview={o => withValue('hairStyle', o)}
                onPick={o => set('hairStyle', o)}
              />
              {avatar.hairStyle !== 'bald' && avatar.hairStyle !== 'wig' && (
                <Swatches label={L('hairColor')} colors={HAIR_COLORS} value={avatar.hairColor} onChange={i => set('hairColor', i)} />
              )}
              {avatar.gender === 'male' && (
              <PickGrid
                label={L('facialHair')}
                options={BEARDS}
                names={names('beard', BEARDS)}
                value={avatar.beard}
                preview={o => withValue('beard', o)}
                onPick={o => set('beard', o)}
              />
              )}
            </>
          )}
          {tab === 'outfit' && (
            <>
              <PickGrid
                label={L('outfit')}
                options={ATTIRES}
                names={names('attire', ATTIRES)}
                value={avatar.attire}
                preview={o => withValue('attire', o)}
                onPick={o => set('attire', o)}
                crop="full"
              />
              <Section title={L('rankOutfits')}>
                <div className="grid grid-cols-5 gap-2">
                  {LEVELS.map(l => {
                    const locked = l.level > myRank;
                    const selected = previewRank === l.level;
                    return (
                      <button
                        key={l.level}
                        type="button"
                        onClick={() => setPreviewRank(l.level)}
                        aria-label={locked ? t('avatarCreator.rankLocked', { title: rankTitle(l.level), n: l.wins }) : rankTitle(l.level)}
                        aria-pressed={selected}
                        className="text-center"
                      >
                        <span
                          className={`relative block aspect-square rounded-xl overflow-hidden border-2 transition-transform active:scale-95 ${
                            selected ? 'border-[#FFD43B]' : 'border-white/20'
                          }`}
                        >
                          <span className={locked ? 'block w-full h-full opacity-45' : 'block w-full h-full'}>
                            <AvatarFace config={avatar} rank={l.level} />
                          </span>
                          {locked && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <Lock className="w-4 h-4 text-white drop-shadow" />
                            </span>
                          )}
                        </span>
                        <span className="block mt-1 text-[11px] text-white/65 leading-tight">{l.level}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-white/60">
                  {rankTitle(previewRank)}
                  {previewRank <= myRank
                    ? previewRank === myRank
                      ? t('avatarCreator.rankCurrent')
                      : t('avatarCreator.rankUnlocked')
                    : t('avatarCreator.rankMore', { count: LEVELS[previewRank - 1].wins - wins })}
                  {' '}{t('avatarCreator.rankAuto')}
                </p>
              </Section>
              {avatar.attire !== 'robe' && (
                <Swatches label={L('outfitColor')} colors={ATTIRE_COLORS} value={avatar.attireColor} onChange={i => set('attireColor', i)} />
              )}
              <Swatches
                label={avatar.attire === 'robe' ? L('trim') : L('tie')}
                colors={ACCENT_COLORS}
                value={avatar.accent}
                onChange={i => set('accent', i)}
              />
            </>
          )}
          {tab === 'extras' && (
            <PickGrid
              label={L('glasses')}
              options={['off', 'on'] as const}
              names={names('glasses', ['off', 'on'] as const)}
              value={avatar.glasses ? 'on' : 'off'}
              preview={o => withValue('glasses', o === 'on')}
              onPick={o => set('glasses', o === 'on')}
            />
          )}
          {tab === 'backdrop' && <Swatches label={L('backdrop')} colors={BACKDROPS} value={avatar.backdrop} onChange={i => set('backdrop', i)} />}
        </div>

        {saveError && <div className="rounded-xl bg-red-500/10 border border-red-500/50 p-3 text-red-300 text-sm">{saveError}</div>}
      </div>

      {/* Pinned to the bottom of the screen so it is always visible, however far the options are scrolled.
          It sits outside the panel (which blurs its background) so it stays fixed to the screen. */}
      <div aria-hidden className="h-28" />
      <div
        className="fixed inset-x-0 bottom-0 z-30 px-4 pt-6 bg-gradient-to-t from-black via-black/85 to-transparent"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <div className="max-w-md mx-auto">
          <button type="button" onClick={save} disabled={saving} className={`${GOLD_BUTTON} w-full`}>
            {saving ? t('avatarCreator.saving') : mode === 'signup' ? t('avatarCreator.goCases') : t('avatarCreator.save')}
          </button>
        </div>
      </div>
    </ScreenShell>
  );
}
