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

// ---------------------------------------------------------------------------
// Where and whether the courtroom may speak
//
//  * Scope: voice is only allowed while a trial or pre-trial screen is on screen. Those
//    screens call enterSpeechScope() when they appear; leaving them stops the voice at once.
//    Anywhere else (home, investigation, ...) speakAs stays silent.
//  * Mute: a player switch, remembered between visits, available on both screens.
// ---------------------------------------------------------------------------

const MUTE_KEY = 'cq_speech_muted';
let scopes = 0;
let muted = readMuted();
const muteListeners = new Set<() => void>();
/** Utterances currently queued or playing. */
const live = new Set<SpeechSynthesisUtterance>();

function readMuted(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isSpeechMuted(): boolean {
  return muted;
}

export function subscribeSpeechMuted(listener: () => void): () => void {
  muteListeners.add(listener);
  return () => muteListeners.delete(listener);
}

export function setSpeechMuted(next: boolean): void {
  if (next === muted) return;
  muted = next;
  try {
    window.localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    /* private mode: the choice just lasts for this visit */
  }
  // Muting cuts the current line. Anything waiting for it to end is released, so the trial moves on.
  if (next) stopSpeaking('finish');
  muteListeners.forEach(l => l());
}

/** True if speakAs would really speak right now (a trial screen is open, not muted, speech exists). */
export function canSpeak(): boolean {
  return scopes > 0 && !muted && speechAvailable();
}

/**
 * Stops the voice.
 *  - 'discard' (default): the screen is going away or the player acted; nothing waiting on the
 *    line is called.
 *  - 'finish': stop the line but let whatever was waiting for it to end carry on.
 */
export function stopSpeaking(mode: 'discard' | 'finish' = 'discard'): void {
  if (!speechAvailable()) return;
  if (mode === 'discard') {
    live.forEach(u => {
      u.onend = null;
      u.onerror = null;
    });
  }
  window.speechSynthesis.cancel();
  if (mode === 'discard') live.clear();
}

/**
 * Call when a trial or pre-trial screen appears; call the returned function when it goes.
 * When the last such screen leaves, the voice stops.
 */
export function enterSpeechScope(): () => void {
  scopes += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    scopes = Math.max(0, scopes - 1);
    // Next tick, so moving from pre-trial straight into the trial doesn't cut the trial's first line.
    setTimeout(() => {
      if (scopes === 0) stopSpeaking('discard');
    }, 0);
  };
}


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

/**
 * Speaks `text` in the role's voice. Returns true if it is really speaking.
 * When it is not (muted, outside a trial screen, no speech support, empty text) `onEnd` is
 * called straight away so anything waiting on "speech finished" never hangs.
 */
export function speakAs(role: VoiceRole, text: string, onEnd?: () => void): boolean {
  if (!canSpeak() || !text?.trim()) {
    onEnd?.();
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const config = ROLE_VOICE_CONFIG[role];
  utterance.pitch = config.pitch;
  utterance.rate = config.rate;

  if (cachedVoices.length > 0) {
    utterance.voice = cachedVoices[config.voiceIndex % cachedVoices.length];
  }

  // 'error' fires instead of 'end' if speech gets interrupted/blocked (tab backgrounded,
  // autoplay blocked, or stopped by the player): still release whoever is waiting.
  const finish = () => {
    live.delete(utterance);
    onEnd?.();
  };
  utterance.onend = finish;
  utterance.onerror = finish;

  live.add(utterance);
  window.speechSynthesis.speak(utterance);
  return true;
}
