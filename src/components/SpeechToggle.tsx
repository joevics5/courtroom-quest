import { useTranslation } from 'react-i18next';
import { useSyncExternalStore } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isSpeechMuted, setSpeechMuted, subscribeSpeechMuted } from '../lib/speech';
import { ICON_BUTTON } from './ui';

/** Whether the courtroom voice is muted (re-renders when it changes). */
export function useSpeechMuted(): boolean {
  return useSyncExternalStore(subscribeSpeechMuted, isSpeechMuted, () => false);
}

/** Mutes or unmutes the courtroom voice. The choice is remembered. */
export default function SpeechToggle({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const muted = useSpeechMuted();
  return (
    <button
      type="button"
      onClick={() => setSpeechMuted(!muted)}
      aria-pressed={muted}
      aria-label={muted ? t('ui.voiceOn') : t('ui.muteVoice')}
      title={muted ? t('ui.voiceOffTitle') : t('ui.muteVoice')}
      className={`${ICON_BUTTON} ${className}`}
    >
      {muted ? <VolumeX className="w-5 h-5 text-white/60" /> : <Volume2 className="w-5 h-5" />}
    </button>
  );
}
