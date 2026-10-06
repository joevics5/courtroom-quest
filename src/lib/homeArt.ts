import { HOME_ART } from './heroAssets';

// Where things sit inside the home artwork, in px of the artwork canvas (the original 900x2007 picture starts at x=137, y=100).
export const ART = {
  canvasW: HOME_ART.width,
  canvasH: HOME_ART.height,
  origW: 900,               // width of the original picture inside the canvas
  eyesY: 100 + 0.33 * 2007, // the male lawyer's eyes: keep them just under the tagline
  deskY: 100 + 0.695 * 2007, // top edge of the judge's desk (the gavel block sits just below it)
};

export interface ArtLayoutInput {
  /** width of the picture column in px (the page width, capped for wide screens) */
  columnWidth: number;
  /** full height of the page in px */
  pageHeight: number;
  /** distance from the top of the page to the top of the PLAY button */
  controlsTop: number;
  /** distance from the top of the page to the bottom of the tagline */
  taglineBottom: number;
}

export interface ArtLayout {
  /** px on screen per px of artwork */
  scale: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

const GAP_BELOW_TAGLINE = 12;
/** how much of the desk top should show above the PLAY button, when there is room */
const DESK_SHOWING = 56;
/** The old look filled the screen width with the original picture; the picture is now never shown larger than 1/1.2 of that. */
const MAX_ZOOM = 1.2;

/**
 * Sizes and places the picture so that, between the tagline and PLAY, you see the lawyers' faces, the judge, the gavel and
 * the top of the desk with its sound block. The picture is never bigger than about 83% of "original width = screen width" (the old look),
 * and never smaller than what still covers the screen width and height (the soft extended edges fill the rest).
 * Returns null while the page has not been measured.
 */
export function computeArtLayout(i: ArtLayoutInput): ArtLayout | null {
  if (!(i.columnWidth > 0) || !(i.pageHeight > 0) || !(i.controlsTop > 0)) return null;
  const eyesAt = i.taglineBottom + GAP_BELOW_TAGLINE;
  const fit = (i.controlsTop - DESK_SHOWING - eyesAt) / (ART.deskY - ART.eyesY);   // eyes under the tagline, desk top above PLAY
  const sMax = i.columnWidth / (ART.origW * MAX_ZOOM);                             // characters never bigger than ~83% of the old look
  const sMin = i.columnWidth / ART.canvasW;                                        // must still cover the column width
  const scale0 = Math.min(Math.max(fit, sMin), sMax);
  let scale = scale0;

  let top = eyesAt - scale * ART.eyesY;
  const bottom = () => top + scale * ART.canvasH;
  if (bottom() < i.pageHeight) top = i.pageHeight - scale * ART.canvasH;           // cover the page bottom (moves the picture down)
  if (top > 0) { scale = Math.max(scale, i.pageHeight / ART.canvasH); top = 0; }   // still short? grow it instead

  const width = scale * ART.canvasW;
  return {
    scale,
    left: (i.columnWidth - width) / 2,
    top,
    width,
    height: scale * ART.canvasH,
  };
}
