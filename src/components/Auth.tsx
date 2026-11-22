import { Trans, useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const authError = (err: { message: string; code?: string }) => {
    switch (err.code) {
      case 'invalid_credentials': return t('auth.errInvalidLogin');
      case 'user_already_exists': case 'email_exists': return t('auth.errExists');
      case 'weak_password': return t('auth.errWeak');
      case 'email_not_confirmed': return t('auth.errNotConfirmed');
      case 'over_request_rate_limit': case 'over_email_send_rate_limit': return t('auth.errRate');
      case 'email_address_invalid': case 'validation_failed': return t('auth.errEmail');
      default: return err.message;
    }
  };
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
          setError(authError(result.error as { message: string; code?: string }));
        } else if (result.needsConfirmation) {
          setConfirmEmail(true);
        } else {
          onDone?.();
        }
        return;
      }
      const { error } = isSignUp ? await signUp(email, password, '') : await signIn(email, password);

      if (error) {
        setError(authError(error as { message: string; code?: string }));
      }
    } catch {
      setError(t('auth.errUnexpected'));
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
      <ScreenShell title={t('auth.checkEmailTitle')} subtitle={t('auth.checkEmailSub')} maxWidth="max-w-md">
        <div className={`${PANEL} space-y-4 text-center`}>
          <p className="text-white/80 leading-relaxed">
            <Trans i18nKey="auth.checkEmailBody" values={{ email }} components={{ email: <strong className="text-white" /> }} />
          </p>
          <button type="button" onClick={() => onDone?.()} className={`${gameButton('gold', 'md')} w-full`}>{t('auth.carryOn')}</button>
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={upgrade ? t('auth.titleUpgrade') : isSignUp ? t('auth.titleSignUp') : t('auth.titleSignIn')}
      subtitle={upgrade ? t('auth.subUpgrade') : isSignUp ? t('auth.subSignUp') : t('auth.subSignIn')}
      onBack={onBack}
      maxWidth="max-w-md"
    >
      <div className={`${PANEL} space-y-5`}>
        {!upgrade && <div role="tablist" className="grid grid-cols-2 gap-2 rounded-2xl bg-black/40 p-1">
          {[
            { id: false, label: t('auth.tabSignIn') },
            { id: true, label: t('auth.tabSignUp') }
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
              placeholder={t('auth.emailPlaceholder')}
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
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                aria-pressed={showPassword}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full text-white/60 active:bg-white/10"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {isSignUp && <p className="mt-2 text-xs text-white/50">{t('auth.passwordHint')}</p>}
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/50 p-3 text-[#FF9A9D] text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className={`${gameButton('gold', 'md')} w-full`}>
            {loading ? t('auth.wait') : isSignUp ? t('auth.createAccount') : t('auth.submitSignIn')}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-white/60">
          <Trans
            i18nKey={isSignUp ? 'auth.agreeSignUp' : 'auth.agreeSignIn'}
            components={{
              terms: <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-white/80" />,
              privacy: <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-white/80" />
            }}
          />
        </p>
      </div>
    </ScreenShell>
  );
}
