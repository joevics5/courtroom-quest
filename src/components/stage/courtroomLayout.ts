/**
 * WHERE EVERYONE SITS in the virtual courtroom. One fixed room, same layout every trial.
 *
 * All numbers are percentages of the stage box (x/y = centre of the avatar, w = avatar width),
 * measured against public/images/courtroom/courtroom.webp (1408×768). To use different art,
 * change `background` and `aspect`, then nudge only these numbers until each avatar sits in
 * its place. No component code needs to change.
 */
export interface Seat {
  x: number;
  y: number;
  w: number;
}

export interface CourtroomLayout {
  /** Painted art for the room. null draws the built-in placeholder room. */
  background: string | null;
  judge: Seat;
  prosecution: Seat;
  defense: Seat;
  witness: Seat;
  /** One entry per jury chair, in seating order (back row first, then front row). */
  jury: Seat[];
  /** The stage box proportions (width / height). */
  aspect: number;
}

const J = 2.8; // juror avatar width (% of the stage)

export const COURTROOM_LAYOUT: CourtroomLayout = {
  background: '/images/courtroom/courtroom.webp',
  judge: { x: 43.7, y: 33.5, w: 10.5 },
  prosecution: { x: 34.8, y: 55.5, w: 12 },
  defense: { x: 61.5, y: 52.5, w: 10.5 },
  witness: { x: 23.5, y: 47.5, w: 8.5 },
  jury: [
    // back row
    { x: 72.4, y: 42.9, w: J }, { x: 75.2, y: 43.9, w: J }, { x: 78.2, y: 44.8, w: J },
    { x: 81.5, y: 46.0, w: J }, { x: 85.2, y: 46.9, w: J }, { x: 89.1, y: 48.0, w: J },
    // front row
    { x: 69.2, y: 45.0, w: J }, { x: 72.2, y: 46.3, w: J }, { x: 75.4, y: 47.4, w: J },
    { x: 78.8, y: 48.9, w: J }, { x: 82.7, y: 50.2, w: J }, { x: 86.9, y: 51.9, w: J }
  ],
  aspect: 1408 / 768
};

/** Seat count the jury box is drawn with (6 per side, as chosen at jury selection). */
export const JURY_SEATS = 12;

/**
 * Where the camera looks for each speaker (percent of the stage). On a phone the whole room is
 * too small to read faces, so the scene zooms to whoever has the floor.
 */
export function focusPoint(who: string | null | undefined, L: CourtroomLayout = COURTROOM_LAYOUT): { x: number; y: number } | null {
  const headUp = (s: Seat) => ({ x: s.x, y: s.y - s.w * L.aspect * 0.2 });
  switch (who) {
    case 'judge': return headUp(L.judge);
    case 'prosecution': return headUp(L.prosecution);
    case 'defense': return headUp(L.defense);
    case 'witness': return headUp(L.witness);
    case 'jury': {
      const n = L.jury.length || 1;
      return { x: L.jury.reduce((a, s) => a + s.x, 0) / n, y: L.jury.reduce((a, s) => a + s.y, 0) / n };
    }
    default: return null;
  }
}

/** The CSS transform that centres `point` in the frame at the given zoom, never showing past the art's edges. */
export function cameraTransform(point: { x: number; y: number } | null, zoom: number): string {
  if (!point || zoom <= 1) return 'translate(0%, 0%) scale(1)';
  const clamp = (v: number) => Math.min(0, Math.max(100 - 100 * zoom, v));
  return `translate(${clamp(50 - zoom * point.x).toFixed(2)}%, ${clamp(50 - zoom * point.y).toFixed(2)}%) scale(${zoom})`;
}
