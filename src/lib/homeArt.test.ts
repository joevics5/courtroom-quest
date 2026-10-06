import { ART, computeArtLayout } from './homeArt';
import type { ArtLayout } from './homeArt';

const base = { columnWidth: 411, pageHeight: 778, controlsTop: 483, taglineBottom: 153 };
const yOf = (l: ArtLayout, canvasY: number) => l.top + l.scale * canvasY;       // where a point of the artwork lands on screen

describe('computeArtLayout', () => {
  it("on the user's phone (411x778): lawyers' eyes just under the tagline, desk top and sound block above PLAY", () => {
    const l = computeArtLayout(base)!;
    expect(yOf(l, ART.eyesY)).toBeGreaterThanOrEqual(base.taglineBottom + 11);
    expect(yOf(l, ART.eyesY)).toBeLessThan(base.taglineBottom + 40);
    expect(yOf(l, ART.deskY)).toBeLessThan(base.controlsTop - 40);              // a good strip of the table shows above PLAY
    expect(yOf(l, ART.deskY + 100)).toBeLessThan(base.controlsTop);             // including the gavel block just below the desk edge
  });

  it('shows the characters smaller than before (the old look had the 900px picture fill the screen width)', () => {
    const l = computeArtLayout(base)!;
    const oldScale = base.columnWidth / ART.origW;
    expect(l.scale).toBeLessThan(oldScale * 0.85);
  });

  it('always covers the whole screen: width, top and bottom, for every phone shape', () => {
    for (const w of [280, 320, 360, 390, 412, 480, 560, 768]) {
      for (const h of [480, 568, 640, 680, 778, 844, 915, 1000, 1366]) {
        for (const play of [h * 0.45, h * 0.55, h * 0.65]) {
          const col = Math.min(w, 560);
          const l = computeArtLayout({ columnWidth: col, pageHeight: h, controlsTop: play, taglineBottom: 153 })!;
          expect(l.left).toBeLessThanOrEqual(0.5);
          expect(l.left + l.width).toBeGreaterThanOrEqual(col - 0.5);
          expect(l.top).toBeLessThanOrEqual(0.5);
          expect(l.top + l.height).toBeGreaterThanOrEqual(h - 0.5);
          expect(Number.isFinite(l.scale)).toBe(true);
        }
      }
    }
  });

  it('never shows the characters larger than the old look, however tall the phone is', () => {
    const tall = computeArtLayout({ columnWidth: 412, pageHeight: 1100, controlsTop: 800, taglineBottom: 153 })!;
    expect(tall.scale).toBeLessThanOrEqual(412 / ART.origW);
  });

  it('on a very short screen it still covers everything and keeps the lawyers below the tagline', () => {
    const l = computeArtLayout({ columnWidth: 360, pageHeight: 568, controlsTop: 330, taglineBottom: 153 })!;
    expect(yOf(l, ART.eyesY)).toBeGreaterThanOrEqual(153);
    expect(l.top + l.height).toBeGreaterThanOrEqual(568 - 0.5);
  });

  it('returns null until the page has been measured', () => {
    expect(computeArtLayout({ columnWidth: 0, pageHeight: 0, controlsTop: 0, taglineBottom: 0 })).toBeNull();
    expect(computeArtLayout({ ...base, controlsTop: 0 })).toBeNull();
  });
});
