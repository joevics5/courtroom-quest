import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ScreenShell from './ScreenShell';
import { gameButton, INPUT, PANEL } from './ui';

interface AuthProps {
  onBack?: () => void;
  /** Open on the sign-up tab instead of sign-in */
  initialSignUp?: boolean;
  /** A signed-in guest saving their progress: sign-up only, and the guest's games carry over. */
  upgrade?: boolean;
  /** Called when an upgrade has finished (or the player carries on after the confirmation notice). */
  onDone?: () => void;
}

export default function Auth({ onBack, initialSignUp = false, upgrade = false, onDone }: AuthProps = {}) {
  const [isSignUp, setIsSignUp] = useState(initialSignUp || upgrade);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signIn, upgradeGuest } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // No name asked here: new players pick their username (and avatar) right after signing up.
      if (upgrade) {
        const result = await upgradeGuest(email, password);
        if (result.error) {
          setError(result.error.message);
        } else if (result.needsConfirmation) {
          setConfirmEmail(true);
        } else {
          onDone?.();
        }
        return;
      }
      const { error } = isSignUp ? await signUp(email, password, '') : await signIn(email, password);

      if (error) {
        setError(error.message);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (signUpMode: boolean) => {
    setIsSignUp(signUpMode);
    setError('');
  };

  if (confirmEmail) {
    return (
      <ScreenShell title="CHECK YOUR EMAIL" subtitle="One last step." maxWidth="max-w-md">
        <div className={`${PANEL} space-y-4 text-center`}>
          <p className="text-white/80 leading-relaxed">
            We sent a confirmation link to <strong className="text-white">{email}</strong>. Open it to finish saving your account.
            Your games and wins are kept, and you can carry on playing in the meantime.
          </p>
          <button type="button" onClick={() => onDone?.()} className={`${gameButton('gold', 'md')} w-full`}>CARRY ON</button>
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={upgrade ? 'SAVE YOUR PROGRESS' : isSignUp ? 'JOIN THE BAR' : 'WELCOME BACK'}
      subtitle={upgrade ? 'Add an email and password to keep your wins, rank and games.' : isSignUp ? 'Create your account, then choose your name and avatar.' : 'Sign in to continue your cases.'}
      onBack={onBack}
      maxWidth="max-w-md"
    >
      <div className={`${PANEL} space-y-5`}>
        {!upgrade && <div role="tablist" className="grid grid-cols-2 gap-2 rounded-2xl bg-black/40 p-1">
          {[
            { id: false, label: 'SIGN IN' },
            { id: true, label: 'SIGN UP' }
          ].map(tab => (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={isSignUp === tab.id}
              onClick={() => switchMode(tab.id)}
              className={`rounded-xl py-2.5 font-game text-xl leading-none transition-colors ${
                isSignUp === tab.id ? 'bg-[#FFD43B] text-black' : 'text-white/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block font-game text-xl text-white leading-none mb-2">
              EMAIL
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
              className={INPUT}
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block font-game text-xl text-white leading-none mb-2">
              PASSWORD
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className={`${INPUT} pr-12`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full text-white/60 active:bg-white/10"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {isSignUp && <p className="mt-2 text-xs text-white/50">At least 6 characters.</p>}
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/50 p-3 text-[#FF9A9D] text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className={`${gameButton('gold', 'md')} w-full`}>
            {loading ? 'PLEASE WAIT...' : isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-white/60">
          {isSignUp ? 'By creating an account you agree to our ' : 'See our '}
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-white/80">Terms</a>
          {' and '}
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-white/80">Privacy Policy</a>.
        </p>
      </div>
    </ScreenShell>
  );
}
