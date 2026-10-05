import { ART, DEFAULT_ART_SHIFT, computeArtShift } from './homeArt';

const picHeight = (width: number, height: number, shift: number) => Math.max(width * ART.aspect, height + shift);
const where = (frac: number, width: number, height: number, shift: number) => frac * picHeight(width, height, shift) - shift; // y on screen

describe('computeArtShift', () => {
  it("raises the picture on the user's phone (411x778) until the gavel clears PLAY, without pushing the lawyers under the tagline", () => {
    const l = { width: 411, height: 778, controlsTop: 483, taglineBottom: 153 };
    const shift = computeArtShift(l);
    expect(shift).toBeGreaterThan(100);
    expect(where(ART.gavelHeadBottom, l.width, l.height, shift)).toBeLessThanOrEqual(l.controlsTop);
    expect(where(ART.eyes, l.width, l.height, shift)).toBeGreaterThanOrEqual(l.taglineBottom);
  });

  it('does not raise it at all when the gavel already clears PLAY (tall phones)', () => {
    expect(computeArtShift({ width: 412, height: 915, controlsTop: 620, taglineBottom: 153 })).toBe(0);
  });

  it('raises it just enough on a short phone, with the step pills hidden', () => {
    const l = { width: 360, height: 680, controlsTop: 476, taglineBottom: 153 };
    const shift = computeArtShift(l);
    expect(shift).toBeGreaterThan(40);
    expect(where(ART.gavelBottom, l.width, l.height, shift)).toBeLessThanOrEqual(l.controlsTop - 7);
  });

  it('stops raising before the lawyers\' eyes would slide under the tagline, even if the gavel stays partly hidden', () => {
    const l = { width: 360, height: 680, controlsTop: 300, taglineBottom: 153 };
    const shift = computeArtShift(l);
    expect(where(ART.eyes, l.width, l.height, shift)).toBeGreaterThanOrEqual(l.taglineBottom + 11);
    expect(where(ART.gavelBottom, l.width, l.height, shift)).toBeGreaterThan(l.controlsTop); // can't have both: eyes win
  });

  it('never goes negative or non-finite, whatever the screen', () => {
    for (const w of [280, 320, 360, 412, 560]) {
      for (const h of [480, 568, 680, 778, 915, 1200, 2000]) {
        for (const top of [200, 300, 400, 500, 700, 1000]) {
          const s = computeArtShift({ width: w, height: h, controlsTop: top, taglineBottom: 153 });
          expect(Number.isFinite(s)).toBe(true);
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThan(400);
        }
      }
    }
  });

  it('falls back to the default when the page has not been measured yet', () => {
    expect(computeArtShift({ width: 0, height: 0, controlsTop: 0, taglineBottom: 0 })).toBe(DEFAULT_ART_SHIFT);
    expect(computeArtShift({ width: 360, height: 700, controlsTop: 0, taglineBottom: 153 })).toBe(DEFAULT_ART_SHIFT);
  });
});
