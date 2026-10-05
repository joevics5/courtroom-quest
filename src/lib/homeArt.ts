// Where things sit in the home artwork, as a fraction of the picture's height (read off the 900x2007 image).
export const ART = {
  aspect: 2007 / 900,       // picture height / width
  eyes: 0.33,               // the male lawyer's eyes: keep them clear of the tagline
  gavelHeadBottom: 0.625,
  gavelBottom: 0.66,        // the hand holding the gavel
};

export interface ArtLayout {
  /** width of the picture column in px (the page width, capped for wide screens) */
  width: number;
  /** full height of the page in px */
  height: number;
  /** distance from the top of the page to the top of the PLAY button */
  controlsTop: number;
  /** distance from the top of the page to the bottom of the tagline */
  taglineBottom: number;
}

export const DEFAULT_ART_SHIFT = 48;
const GAP_ABOVE_PLAY = 8;
const GAP_BELOW_TAGLINE = 12;
/** Safety net: on an unusually tall page the two limits below stop constraining each other, so never raise more than this. */
const MAX_SHIFT = 200;

/**
 * How many px to raise the picture so the judge's gavel (and the hand holding it) sit just above the PLAY button,
 * but never so far that the lawyers' eyes slide up under the tagline. Raising never uncovers empty space: the picture
 * is stretched to cover the extra height.
 */
export function computeArtShift(l: ArtLayout): number {
  if (!(l.width > 0) || !(l.height > 0) || !(l.controlsTop > 0)) return DEFAULT_ART_SHIFT;
  let shift = 0;
  for (let i = 0; i < 4; i++) {
    // cover: the picture is as tall as its width needs, or as tall as the (raised) box, whichever is larger
    const picH = Math.max(l.width * ART.aspect, l.height + shift);
    const wanted = ART.gavelBottom * picH - (l.controlsTop - GAP_ABOVE_PLAY);
    const limit = ART.eyes * picH - (l.taglineBottom + GAP_BELOW_TAGLINE);
    const next = Math.max(0, Math.min(wanted, limit));
    if (Math.abs(next - shift) < 0.5) { shift = next; break; }
    shift = next;
  }
  return Math.round(Math.min(shift, MAX_SHIFT));
}
