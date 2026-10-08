import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeUtterance {
  text: string;
  pitch = 1;
  rate = 1;
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

let queue: FakeUtterance[] = [];
const synth = {
  speak: vi.fn((u: FakeUtterance) => void queue.push(u)),
  // like a real browser: cancelling makes the interrupted line report an error
  cancel: vi.fn(() => {
    const pending = queue;
    queue = [];
    pending.forEach(u => u.onerror?.());
  }),
  getVoices: () => [],
  speaking: false,
  onvoiceschanged: null
};

async function load() {
  vi.resetModules();
  return await import('./speech');
}

describe('courtroom speech', () => {
  beforeEach(() => {
    queue = [];
    synth.speak.mockClear();
    synth.cancel.mockClear();
    window.localStorage.clear();
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FakeUtterance;
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('stays silent outside the trial screens, but still releases whoever is waiting', async () => {
    const { speakAs, canSpeak } = await load();
    const onEnd = vi.fn();
    expect(canSpeak()).toBe(false);
    expect(speakAs('judge', 'Order in the court.', onEnd)).toBe(false);
    expect(synth.speak).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('speaks inside a trial screen and reports when the line ends', async () => {
    const { speakAs, enterSpeechScope } = await load();
    enterSpeechScope();
    const onEnd = vi.fn();
    expect(speakAs('recorder', 'All rise.', onEnd)).toBe(true);
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
    queue[0].onend?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('muted: silent, releases the waiter, and the choice is remembered', async () => {
    const { speakAs, enterSpeechScope, setSpeechMuted, isSpeechMuted, canSpeak } = await load();
    enterSpeechScope();
    setSpeechMuted(true);
    expect(isSpeechMuted()).toBe(true);
    expect(canSpeak()).toBe(false);
    const onEnd = vi.fn();
    expect(speakAs('judge', 'Silence.', onEnd)).toBe(false);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('cq_speech_muted')).toBe('1');

    const again = await load();
    expect(again.isSpeechMuted()).toBe(true);
    again.setSpeechMuted(false);
    expect(window.localStorage.getItem('cq_speech_muted')).toBe('0');
  });

  it('muting mid-line cuts the voice but lets the trial carry on', async () => {
    const { speakAs, enterSpeechScope, setSpeechMuted } = await load();
    enterSpeechScope();
    const onEnd = vi.fn();
    speakAs('judge', 'A long ruling.', onEnd);
    setSpeechMuted(true);
    expect(synth.cancel).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('tells subscribers when mute changes', async () => {
    const { setSpeechMuted, subscribeSpeechMuted } = await load();
    const seen = vi.fn();
    const off = subscribeSpeechMuted(seen);
    setSpeechMuted(true);
    setSpeechMuted(true); // no change, no notification
    setSpeechMuted(false);
    off();
    setSpeechMuted(true);
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('stopSpeaking("discard") stops the voice without calling the waiter', async () => {
    const { speakAs, enterSpeechScope, stopSpeaking } = await load();
    enterSpeechScope();
    const onEnd = vi.fn();
    speakAs('recorder', 'All rise.', onEnd);
    stopSpeaking('discard');
    expect(synth.cancel).toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('leaving the trial screens stops the voice and drops what was waiting', async () => {
    const { speakAs, enterSpeechScope } = await load();
    const leave = enterSpeechScope();
    const onEnd = vi.fn();
    speakAs('judge', 'The court will now rise.', onEnd);
    leave();
    vi.runAllTimers();
    expect(synth.cancel).toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('moving from the pre-trial straight into the trial does not cut the trial\'s first line', async () => {
    const { speakAs, enterSpeechScope } = await load();
    const leavePreTrial = enterSpeechScope();
    leavePreTrial();
    enterSpeechScope(); // the trial screen appears in the same moment
    speakAs('judge', 'We begin.');
    vi.runAllTimers();
    expect(synth.cancel).not.toHaveBeenCalled();
  });

  it('leaving twice is harmless', async () => {
    const { enterSpeechScope, canSpeak } = await load();
    const a = enterSpeechScope();
    const b = enterSpeechScope();
    a();
    a();
    expect(canSpeak()).toBe(true);
    b();
    expect(canSpeak()).toBe(false);
  });
});
