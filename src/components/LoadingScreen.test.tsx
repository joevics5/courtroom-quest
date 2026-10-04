import { render } from '@testing-library/react';
import { vi } from 'vitest';
import LoadingScreen from './LoadingScreen';
import { HERO_POSTER, HOME_ART } from '../lib/heroAssets';

// Fake Image so we can see what gets requested, in what order, and finish loads by hand.
const created: { src: string; onload: null | (() => void); onerror: null | (() => void) }[] = [];
class FakeImage {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  private _src = '';
  get src() { return this._src; }
  set src(v: string) { this._src = v; created.push(this as unknown as (typeof created)[number]); }
}

beforeEach(() => {
  created.length = 0;
  vi.stubGlobal('Image', FakeImage);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('LoadingScreen', () => {
  it('waits for the small home illustration first and only then starts the big background poster', () => {
    render(<LoadingScreen authReady={false} onDone={vi.fn()} />);
    expect(created.map((i) => i.src)).toEqual([HOME_ART.webp]);   // the poster must not compete with it
    created[0].onload?.();
    expect(created.map((i) => i.src)).toEqual([HOME_ART.webp, HERO_POSTER]);
  });

  it('does not get stuck if the illustration fails to load', () => {
    render(<LoadingScreen authReady={false} onDone={vi.fn()} />);
    created[0].onerror?.();
    expect(created.map((i) => i.src)).toContain(HERO_POSTER);
  });

  it('finishes once everything is ready, and never later than the hard timeout', () => {
    vi.useFakeTimers();
    const done = vi.fn();
    render(<LoadingScreen authReady={false} onDone={done} />);
    vi.advanceTimersByTime(4400);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);       // 4.5 s hard timeout, even though auth and the image never finished
    expect(done).toHaveBeenCalledTimes(1);
  });
});
