// Deterministic "architect" for juror portraits.
//
// Instead of hand-authoring an illustration per juror, we pick a small set of
// swappable attributes (head shape, skin tone, hairstyle, hair colour, facial
// hair, glasses, attire colour) from fixed palettes, and resolve them from a
// juror's stable id via a seeded PRNG. The same juror id always resolves to
// the same combination, so a juror looks identical across sessions and
// devices without storing any extra image data — the DB id alone is enough.
//
// Swapping in a new hairstyle/colour/etc later just means adding an entry to
// one of the palettes below; it does not change how any existing juror looks,
// since indices are derived by stable modulo, not by array position shifting
// (adding to the END of a palette is safe; reordering existing entries is not).

export type HeadShape = 'oval' | 'round' | 'square';
export type HairStyle = 'bald' | 'buzz' | 'short' | 'side-part' | 'curly' | 'long' | 'bun' | 'afro';
export type FacialHair = 'none' | 'mustache' | 'goatee' | 'beard';
export type Glasses = 'none' | 'round' | 'rectangular';

export interface JurorAvatarAttributes {
  headShape: HeadShape;
  skinTone: string;
  hairStyle: HairStyle;
  hairColor: string;
  facialHair: FacialHair;
  glasses: Glasses;
  attireColor: string;
}

const HEAD_SHAPES: HeadShape[] = ['oval', 'round', 'square'];

// A realistic spread of skin tones, light to deep.
const SKIN_TONES = ['#F3D0B4', '#E8B690', '#D6996F', '#B9794F', '#8D5A38', '#5C3A24'];

const HAIR_STYLES: HairStyle[] = ['bald', 'buzz', 'short', 'side-part', 'curly', 'long', 'bun', 'afro'];

const HAIR_COLORS = ['#1B1B1B', '#3A2A1E', '#5B3A24', '#8B5A2B', '#C9A24B', '#9B9B9B', '#E5E5E5'];

// Facial hair only makes sense on some hair-style/skin combos in practice,
// but we keep selection fully independent on purpose — simpler, and a goatee
// next to long hair or a bun is a perfectly normal look.
const FACIAL_HAIR: FacialHair[] = ['none', 'none', 'none', 'mustache', 'goatee', 'beard'];

const GLASSES: Glasses[] = ['none', 'none', 'none', 'round', 'rectangular'];

// Professional attire tones — kept in the same muted, courtroom-appropriate
// register the rest of the app's theme uses, independent of page branding.
const ATTIRE_COLORS = ['#1E3A5F', '#2E2E2E', '#4A1F24', '#1F4A3A', '#3A3A4A', '#5A3A1F', '#1A1A1A', '#3A2E4A'];

/**
 * mulberry32 — tiny deterministic PRNG. Seeded once per juror id, then drawn
 * from repeatedly (once per attribute) so each attribute gets an
 * independent-looking value without needing a separate hash per field.
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pick<T>(rand: () => number, list: T[]): T {
  return list[Math.floor(rand() * list.length) % list.length];
}

/**
 * Resolve a juror's visual attributes from any stable identifier (DB uuid,
 * numeric id, or name — whatever is guaranteed not to change for that juror).
 */
export function resolveJurorAvatar(seed: string | number): JurorAvatarAttributes {
  const seedStr = String(seed);
  const rand = mulberry32(hashString(seedStr));

  return {
    headShape: pick(rand, HEAD_SHAPES),
    skinTone: pick(rand, SKIN_TONES),
    hairStyle: pick(rand, HAIR_STYLES),
    hairColor: pick(rand, HAIR_COLORS),
    facialHair: pick(rand, FACIAL_HAIR),
    glasses: pick(rand, GLASSES),
    attireColor: pick(rand, ATTIRE_COLORS),
  };
}
