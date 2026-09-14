/**
 * Small, deliberate sound effects for the landing page — synthesized
 * with the Web Audio API rather than shipped as audio files, so there's
 * nothing to license and nothing to load. Kept to two sounds used
 * sparingly (a gavel tap, a soft paper rustle), never ambient/looping
 * background audio.
 *
 * Autoplay note: browsers block audio before any user gesture, so
 * these are only ever called from click/hover handlers, never on
 * mount — no need to special-case that here, the browser just won't
 * play a sound triggered outside a gesture, silently.
 */

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

const SOUND_PREF_KEY = 'cq_sound_enabled';

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SOUND_PREF_KEY) === 'true';
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_PREF_KEY, String(enabled));
}

/** A short, low percussive knock — like a gavel striking wood. */
export function playGavelTap() {
  if (!isSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Body of the knock: a fast-decaying low sine "thock"
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.09);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.5, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.18);

  // A touch of high-frequency "crack" on top so it reads as wood, not a drum
  const bufferSize = ctx.sampleRate * 0.02;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 2500;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.18, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
}

/** A soft, brief paper-rustle texture — filtered noise, quiet and quick. */
export function playPaperRustle() {
  if (!isSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 0.25;
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.6;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3200;
  filter.Q.value = 0.6;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.linearRampToValueAtTime(0.0001, now + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(now);
}
