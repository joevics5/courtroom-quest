/**
 * WHERE EVERYONE SITS in the virtual courtroom. One fixed room, same layout every trial.
 *
 * All numbers are percentages of the stage box (x/y = centre of the seat, w = avatar width).
 * When the painted courtroom art arrives, drop it at `public/images/courtroom/courtroom.webp`,
 * set `background` below, then nudge only these numbers until each avatar sits in its seat.
 * No component code needs to change.
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
  /** Top-left corner and size of the jury box; the jurors fill it in two rows. */
  jury: { x: number; y: number; w: number; h: number; seatW: number };
  /** The stage box proportions (width / height). */
  aspect: number;
}

export const COURTROOM_LAYOUT: CourtroomLayout = {
  background: null, // e.g. '/images/courtroom/courtroom.webp'
  judge: { x: 50, y: 30, w: 17 },
  prosecution: { x: 22, y: 66, w: 18 },
  defense: { x: 78, y: 66, w: 18 },
  witness: { x: 72, y: 30, w: 14 },
  jury: { x: 3, y: 12, w: 26, h: 26, seatW: 3.6 },
  aspect: 16 / 9
};

/** Seat count the jury box is drawn with (6 per side, as chosen at jury selection). */
export const JURY_SEATS = 12;
