import { useState } from 'react';
import { Shuffle, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AvatarFace from './AvatarFace';
import {
  ATTIRES,
  ATTIRE_COLORS,
  AvatarConfig,
  BACKDROPS,
  BEARDS,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  randomAvatar,
  validateUsername,
  USERNAME_MAX
} from '../lib/avatars';

interface AvatarCreatorProps {
  /** Pre-fills the username box (e.g. a nickname chosen earlier). */
  initialUsername?: string;
  initialAvatar?: AvatarConfig;
  onDone: () => void;
}

const HAIR_LABELS: Record<(typeof HAIR_STYLES)[number], string> = {
  short: 'Short',
  long: 'Long',
  bun: 'Bun',
  curly: 'Curly',
  afro: 'Afro',
  wig: 'Court wig',
  bald: 'Bald'
};
const ATTIRE_LABELS: Record<(typeof ATTIRES)[number], string> = {
  robe: 'Robe',
  suit: 'Suit',
  blazer: 'Blazer',
  collar: 'Shirt'
};
const BEARD_LABELS: Record<(typeof BEARDS)[number], string> = {
  none: 'None',
  stubble: 'Stubble',
  full: 'Full'
};

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
    <div>
      <p className="text-sm text-slate-300 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {colors.map((c, i) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(i)}
            aria-label={`${label} ${i + 1}`}
            aria-pressed={value === i}
            className={`w-9 h-9 rounded-full border-2 transition-transform ${
              value === i ? 'border-white scale-110' : 'border-slate-600'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

function Chips<T extends string>({
  label,
  options,
  labels,
  value,
  onChange
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="text-sm text-slate-300 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            aria-pressed={value === o}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              value === o
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {labels[o]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Shown once after signup: enter a username, then build an avatar. Both are
 * saved to the account metadata, so the avatar appears on the trial screen.
 */
export default function AvatarCreator({ initialUsername = '', initialAvatar, onDone }: AvatarCreatorProps) {
  const [step, setStep] = useState<'username' | 'avatar'>('username');
  const [username, setUsername] = useState(initialUsername);
  const [avatar, setAvatar] = useState<AvatarConfig>(() => initialAvatar ?? randomAvatar());
  const [usernameError, setUsernameError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) =>
    setAvatar(prev => ({ ...prev, [key]: value }));

  const submitUsername = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateUsername(username);
    if (problem) {
      setUsernameError(problem);
      return;
    }
    setUsernameError('');
    setStep('avatar');
  };

  const save = async () => {
    setSaving(true);
    setSaveError('');
    const nickname = username.trim().replace(/\s+/g, ' ');
    const { error } = await supabase.auth.updateUser({ data: { nickname, avatar } });
    setSaving(false);
    if (error) {
      console.error('Failed to save avatar:', error);
      setSaveError('Could not save your avatar. Check your connection and try again.');
      return;
    }
    onDone();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {step === 'username' ? (
          <form onSubmit={submitUsername} className="bg-slate-800 rounded-lg shadow-xl p-8 border border-slate-700 space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Choose your username</h1>
              <p className="text-slate-400 text-sm">This is the name the judge and other players see.</p>
            </div>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                maxLength={USERNAME_MAX}
                autoFocus
                autoComplete="nickname"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Counsel Adebayo"
              />
              {usernameError && <p className="mt-2 text-sm text-red-400">{usernameError}</p>}
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Continue
            </button>
          </form>
        ) : (
          <div className="bg-slate-800 rounded-lg shadow-xl p-6 border border-slate-700 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-28 h-28 flex-none rounded-2xl overflow-hidden border border-slate-600">
                <AvatarFace config={avatar} label="Your avatar preview" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-white mb-1">Create your avatar</h1>
                <p className="text-slate-400 text-sm truncate">{username.trim()}</p>
                <button
                  type="button"
                  onClick={() => setAvatar(randomAvatar())}
                  className="mt-2 inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200"
                >
                  <Shuffle className="w-4 h-4" />
                  Randomize
                </button>
              </div>
            </div>

            <div className="space-y-4 max-h-[46dvh] overflow-y-auto pr-1">
              <Swatches label="Skin" colors={SKIN_TONES} value={avatar.skin} onChange={i => update('skin', i)} />
              <Chips label="Hair" options={HAIR_STYLES} labels={HAIR_LABELS} value={avatar.hairStyle} onChange={v => update('hairStyle', v)} />
              {avatar.hairStyle !== 'bald' && avatar.hairStyle !== 'wig' && (
                <Swatches label="Hair color" colors={HAIR_COLORS} value={avatar.hairColor} onChange={i => update('hairColor', i)} />
              )}
              <Chips label="Facial hair" options={BEARDS} labels={BEARD_LABELS} value={avatar.beard} onChange={v => update('beard', v)} />
              <Chips label="Outfit" options={ATTIRES} labels={ATTIRE_LABELS} value={avatar.attire} onChange={v => update('attire', v)} />
              {avatar.attire !== 'robe' && (
                <Swatches label="Outfit color" colors={ATTIRE_COLORS} value={avatar.attireColor} onChange={i => update('attireColor', i)} />
              )}
              <div>
                <p className="text-sm text-slate-300 mb-2">Glasses</p>
                <button
                  type="button"
                  onClick={() => update('glasses', !avatar.glasses)}
                  aria-pressed={avatar.glasses}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    avatar.glasses
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {avatar.glasses ? 'On' : 'Off'}
                </button>
              </div>
              <Swatches label="Background" colors={BACKDROPS} value={avatar.backdrop} onChange={i => update('backdrop', i)} />
            </div>

            {saveError && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">{saveError}</div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('username')}
                className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save and enter court'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
