/**
 * Gives each courtroom role its own distinct voice for text-to-speech,
 * using the browser's native SpeechSynthesis API (same one used for
 * mic input's counterpart — no external TTS vendor, no cost).
 *
 * Browsers vary wildly in how many voices they expose (some phones have
 * only 1-2). So every role always gets a different pitch/rate combo
 * regardless of voice count, and additionally picks a genuinely
 * different SpeechSynthesisVoice when more than one is available, for
 * real timbre distinction on top of the pitch/rate difference.
 */

export type VoiceRole = 'judge' | 'counsel' | 'witness' | 'recorder';

let cachedVoices: SpeechSynthesisVoice[] = [];

function refreshVoices() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices();
  // Voices often load asynchronously after page load in Chrome.
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

const ROLE_VOICE_CONFIG: Record<VoiceRole, { pitch: number; rate: number; voiceIndex: number }> = {
  judge: { pitch: 0.75, rate: 0.88, voiceIndex: 0 },       // deep, deliberate, authoritative
  counsel: { pitch: 1.1, rate: 1.05, voiceIndex: 1 },      // sharper, faster — the opposing AI counsel
  witness: { pitch: 1.0, rate: 0.95, voiceIndex: 2 },      // neutral, natural pace
  recorder: { pitch: 0.92, rate: 1.08, voiceIndex: 3 }     // brisk, procedural — bailiff / court recorder
};

export function speakAs(role: VoiceRole, text: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    // No TTS available in this browser — fall back to calling onEnd
    // immediately so callers waiting on "speech finished" (e.g. to know
    // when to hand control back after the AI's statement) don't hang.
    onEnd?.();
    return;
  }
  if (!text?.trim()) {
    onEnd?.();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const config = ROLE_VOICE_CONFIG[role];
  utterance.pitch = config.pitch;
  utterance.rate = config.rate;

  if (cachedVoices.length > 0) {
    utterance.voice = cachedVoices[config.voiceIndex % cachedVoices.length];
  }

  if (onEnd) {
    // 'error' fires instead of 'end' if speech gets interrupted/blocked
    // (e.g. the tab was backgrounded, or the browser blocks autoplay
    // audio) — still call onEnd so the trial doesn't get stuck waiting
    // for a speech event that will never come.
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }

  window.speechSynthesis.speak(utterance);
}
