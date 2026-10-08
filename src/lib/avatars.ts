/**
 * Avatar data for the courtroom: what an avatar looks like (AvatarConfig),
 * the parts a player can pick from, and ready-made judges and opposing
 * counsel. Avatars are drawn as layered SVG (see AvatarFace) so the mouth can
 * move while someone speaks. A player's avatar is stored in their account
 * metadata, next to their nickname.
 */

export const SKIN_TONES = ['#fbdcc3', '#efc29a', '#d39a6c', '#b2774a', '#85522f', '#583420'] as const;
export const HAIR_COLORS = ['#1b1512', '#3a2518', '#6b4226', '#b9803c', '#d4d4d4', '#9a321f'] as const;
export const ATTIRE_COLORS = ['#22304f', '#7c1d2a', '#1f4d3a', '#3b2a6b', '#44505e', '#2b2b33'] as const;
/** Trim, tie and scarf colours: the pop of colour on an outfit. */
export const ACCENT_COLORS = ['#FFD43B', '#E5484D', '#2EC4B6', '#8B5CF6', '#FF8A3D', '#F4F1EA'] as const;
export const BACKDROPS = ['#2c4a7a', '#7a4630', '#2d6a52', '#7a3558', '#2a6a78', '#8a6a2a'] as const;
export const EYE_COLORS = ['#5b3a21', '#2b1b12', '#7a5a2a', '#3f7a4f', '#3f6fb0'] as const;

export const HAIR_STYLES = ['short', 'slick', 'bob', 'long', 'bun', 'curly', 'afro', 'wig', 'bald'] as const;
export const ATTIRES = ['robe', 'suit', 'blazer', 'collar'] as const;
export const BEARDS = ['none', 'stubble', 'full', 'goatee'] as const;

/** How many looks each face-shape option has. */
export const HEAD_SHAPES = 4;
export const EYE_SHAPES = 4;
export const NOSE_SHAPES = 4;
export const MOUTH_SHAPES = 3;
export const BROW_SHAPES = 4;
export const AGES = 3;

export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type Attire = (typeof ATTIRES)[number];
export type Beard = (typeof BEARDS)[number];

export interface AvatarConfig {
  gender: Gender;
  skin: number;
  headShape: number;
  eyeShape: number;
  eyeColor: number;
  noseShape: number;
  mouthShape: number;
  browShape: number;
  /** 0 young, 1 middle-aged, 2 senior (adds lines and eye bags) */
  age: number;
  hairStyle: HairStyle;
  hairColor: number;
  attire: Attire;
  attireColor: number;
  accent: number;
  beard: Beard;
  glasses: boolean;
  backdrop: number;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  gender: 'male',
  skin: 2,
  headShape: 0,
  eyeShape: 0,
  eyeColor: 0,
  noseShape: 0,
  mouthShape: 0,
  browShape: 1,
  age: 0,
  hairStyle: 'short',
  hairColor: 1,
  attire: 'suit',
  attireColor: 0,
  accent: 0,
  beard: 'none',
  glasses: false,
  backdrop: 0
};

/** Hair styles offered for each version (the rest read oddly on that face). */
export function hairStylesFor(gender: Gender): HairStyle[] {
  const skip: HairStyle[] = gender === 'female' ? ['slick', 'bald'] : ['bob'];
  return HAIR_STYLES.filter(h => !skip.includes(h));
}

/** Switches the male/female version, keeping what still fits and swapping what does not. */
export function adaptToGender(a: AvatarConfig, gender: Gender): AvatarConfig {
  if (a.gender === gender) return a;
  const next: AvatarConfig = { ...a, gender };
  if (gender === 'female') {
    next.beard = 'none';
    if (a.hairStyle === 'slick' || a.hairStyle === 'bald') next.hairStyle = 'long';
    else if (a.hairStyle === 'short') next.hairStyle = 'bob';
  } else if (a.hairStyle === 'bob' || a.hairStyle === 'long' || a.hairStyle === 'bun') {
    next.hairStyle = 'short';
  }
  return next;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Small deterministic random generator, so the same seed gives the same avatar. */
function seededRandom(seed: string): () => number {
  let a = hashString(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
  };
}

function pick<T>(list: readonly T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)];
}

const int = (rand: () => number, n: number) => Math.floor(rand() * n);

/** Face structure (head, eyes, nose, mouth, brows) chosen from a seed. */
function faceStructure(seed: string) {
  const rand = seededRandom(seed);
  return {
    headShape: int(rand, HEAD_SHAPES),
    eyeShape: int(rand, EYE_SHAPES),
    eyeColor: int(rand, EYE_COLORS.length),
    noseShape: int(rand, NOSE_SHAPES),
    mouthShape: int(rand, MOUTH_SHAPES),
    browShape: int(rand, BROW_SHAPES)
  };
}

/** A ready-made character: the look is spelled out, the face structure is fixed per seed. */
function character(seed: string, look: Partial<AvatarConfig>): AvatarConfig {
  return { ...DEFAULT_AVATAR, ...faceStructure(seed), ...look };
}

/** Ten judges: robes with coloured trim, wigs and varied faces; mostly older. */
export const JUDGE_AVATARS: AvatarConfig[] = [
  character('judge-1', { gender: 'male', skin: 0, hairStyle: 'wig', hairColor: 4, attire: 'robe', accent: 0, age: 2, browShape: 2, backdrop: 1 }),
  character('judge-2', { gender: 'male', skin: 4, hairStyle: 'short', hairColor: 4, attire: 'robe', accent: 1, beard: 'stubble', glasses: true, age: 2, backdrop: 0 }),
  character('judge-3', { gender: 'female', skin: 2, hairStyle: 'bun', hairColor: 0, attire: 'robe', accent: 2, glasses: true, age: 1, backdrop: 3 }),
  character('judge-4', { gender: 'male', skin: 5, hairStyle: 'bald', attire: 'robe', accent: 0, beard: 'full', age: 1, browShape: 2, backdrop: 1 }),
  character('judge-5', { gender: 'female', skin: 1, hairStyle: 'long', hairColor: 4, attire: 'robe', accent: 3, age: 2, backdrop: 2 }),
  character('judge-6', { gender: 'female', skin: 3, hairStyle: 'wig', hairColor: 4, attire: 'robe', accent: 1, glasses: true, age: 1, backdrop: 3 }),
  character('judge-7', { gender: 'male', skin: 0, hairStyle: 'bald', attire: 'robe', accent: 4, beard: 'goatee', glasses: true, age: 2, browShape: 2, backdrop: 4 }),
  character('judge-8', { gender: 'female', skin: 4, hairStyle: 'afro', hairColor: 4, attire: 'robe', accent: 0, age: 2, backdrop: 5 }),
  character('judge-9', { gender: 'female', skin: 2, hairStyle: 'curly', hairColor: 0, attire: 'robe', accent: 2, glasses: true, age: 1, backdrop: 0 }),
  character('judge-10', { gender: 'male', skin: 1, hairStyle: 'slick', hairColor: 4, attire: 'robe', accent: 5, beard: 'stubble', age: 2, backdrop: 1 })
];

/** Ten opposing counsel: sharp business wear, younger, varied faces. */
export const COUNSEL_AVATARS: AvatarConfig[] = [
  character('counsel-1', { gender: 'male', skin: 1, hairStyle: 'slick', hairColor: 3, attire: 'suit', attireColor: 0, accent: 1, backdrop: 0 }),
  character('counsel-2', { gender: 'male', skin: 4, hairStyle: 'short', hairColor: 0, attire: 'suit', attireColor: 3, accent: 0, beard: 'stubble', backdrop: 3 }),
  character('counsel-3', { gender: 'female', skin: 0, hairStyle: 'long', hairColor: 5, attire: 'blazer', attireColor: 1, accent: 5, backdrop: 2 }),
  character('counsel-4', { gender: 'female', skin: 3, hairStyle: 'bun', hairColor: 0, attire: 'blazer', attireColor: 4, accent: 2, glasses: true, backdrop: 4 }),
  character('counsel-5', { gender: 'male', skin: 5, hairStyle: 'afro', hairColor: 0, attire: 'suit', attireColor: 5, accent: 4, backdrop: 5 }),
  character('counsel-6', { gender: 'female', skin: 2, hairStyle: 'curly', hairColor: 1, attire: 'blazer', attireColor: 2, accent: 0, glasses: true, backdrop: 1 }),
  character('counsel-7', { gender: 'male', skin: 0, hairStyle: 'bald', attire: 'suit', attireColor: 0, accent: 3, beard: 'full', age: 1, backdrop: 0 }),
  character('counsel-8', { gender: 'female', skin: 1, hairStyle: 'bob', hairColor: 2, attire: 'collar', attireColor: 3, accent: 1, glasses: true, backdrop: 3 }),
  character('counsel-9', { gender: 'female', skin: 4, hairStyle: 'bob', hairColor: 0, attire: 'blazer', attireColor: 1, accent: 0, backdrop: 2 }),
  character('counsel-10', { gender: 'male', skin: 2, hairStyle: 'short', hairColor: 2, attire: 'suit', attireColor: 4, accent: 2, beard: 'goatee', age: 1, backdrop: 4 })
];

/** The bailiff: calls the court to order in the pre-trial scene. */
export const BAILIFF_AVATAR: AvatarConfig = character('bailiff', {
  gender: 'male',
  skin: 3,
  hairStyle: 'short',
  hairColor: 0,
  attire: 'collar',
  attireColor: 4,
  accent: 0,
  age: 1,
  backdrop: 5
});

/** A random player avatar. Without a seed it is different every call. */
export function randomAvatar(seed?: string): AvatarConfig {
  const rand = seed ? seededRandom(seed) : Math.random;
  const gender: Gender = rand() < 0.5 ? 'male' : 'female';
  return {
    gender,
    skin: int(rand, SKIN_TONES.length),
    headShape: int(rand, HEAD_SHAPES),
    eyeShape: int(rand, EYE_SHAPES),
    eyeColor: int(rand, EYE_COLORS.length),
    noseShape: int(rand, NOSE_SHAPES),
    mouthShape: int(rand, MOUTH_SHAPES),
    browShape: int(rand, BROW_SHAPES),
    age: Math.min(AGES - 1, int(rand, AGES + 1)),
    hairStyle: pick(hairStylesFor(gender), rand),
    hairColor: int(rand, HAIR_COLORS.length),
    attire: pick(['suit', 'blazer', 'collar'] as const, rand),
    attireColor: int(rand, ATTIRE_COLORS.length),
    accent: int(rand, ACCENT_COLORS.length),
    beard: gender === 'male' ? pick(BEARDS, rand) : 'none',
    glasses: rand() < 0.3,
    backdrop: int(rand, BACKDROPS.length)
  };
}

export type AvatarKind = 'judge' | 'counsel' | 'player';

/**
 * Avatar for someone who has not built one: judges and AI counsel come from the
 * ready-made sets (same name gives the same face), anyone else gets a random
 * look seeded by their name or id.
 */
export function avatarFromSeed(seed: string, kind: AvatarKind): AvatarConfig {
  if (kind === 'judge') return JUDGE_AVATARS[hashString(seed) % JUDGE_AVATARS.length];
  if (kind === 'counsel') return COUNSEL_AVATARS[hashString(seed) % COUNSEL_AVATARS.length];
  return randomAvatar(seed);
}

function inRange(n: unknown, length: number): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < length;
}

/**
 * Validates stored data. Returns null if it is missing or not a usable avatar.
 * Avatars saved before the face-shape options existed are still accepted: the
 * missing options are filled in from a stable look based on the saved values.
 */
export function parseAvatar(raw: unknown): AvatarConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  if (
    !inRange(a.skin, SKIN_TONES.length) ||
    !inRange(a.hairColor, HAIR_COLORS.length) ||
    !inRange(a.attireColor, ATTIRE_COLORS.length) ||
    !inRange(a.backdrop, BACKDROPS.length) ||
    !(HAIR_STYLES as readonly unknown[]).includes(a.hairStyle) ||
    !(ATTIRES as readonly unknown[]).includes(a.attire) ||
    !(BEARDS as readonly unknown[]).includes(a.beard) ||
    typeof a.glasses !== 'boolean'
  ) {
    return null;
  }
  const filler = faceStructure(`legacy-${a.skin}-${a.hairStyle}-${a.hairColor}-${a.attire}-${a.attireColor}-${a.backdrop}`);
  const opt = (value: unknown, length: number, fallback: number) => (inRange(value, length) ? value : fallback);
  const gender: Gender =
    a.gender === 'male' || a.gender === 'female'
      ? a.gender
      : ['long', 'bob', 'bun'].includes(a.hairStyle as string)
        ? 'female'
        : a.beard !== 'none' || a.hairStyle === 'bald' || a.hairStyle === 'slick'
          ? 'male'
          : hashString(`${a.skin}-${a.hairStyle}-${a.attireColor}`) % 2 === 0
            ? 'male'
            : 'female';
  return {
    gender,
    skin: a.skin,
    headShape: opt(a.headShape, HEAD_SHAPES, filler.headShape),
    eyeShape: opt(a.eyeShape, EYE_SHAPES, filler.eyeShape),
    eyeColor: opt(a.eyeColor, EYE_COLORS.length, filler.eyeColor),
    noseShape: opt(a.noseShape, NOSE_SHAPES, filler.noseShape),
    mouthShape: opt(a.mouthShape, MOUTH_SHAPES, filler.mouthShape),
    browShape: opt(a.browShape, BROW_SHAPES, filler.browShape),
    age: opt(a.age, AGES, 0),
    hairStyle: a.hairStyle as HairStyle,
    hairColor: a.hairColor,
    attire: a.attire as Attire,
    attireColor: a.attireColor,
    accent: opt(a.accent, ACCENT_COLORS.length, 0),
    beard: gender === 'female' ? 'none' : (a.beard as Beard),
    glasses: a.glasses,
    backdrop: a.backdrop
  };
}

type AvatarUser = {
  id?: string;
  user_metadata?: { avatar?: unknown } | null;
} | null | undefined;

/** The player's saved avatar, or a stable random one (guests, accounts not yet set up). */
export function getUserAvatar(user: AvatarUser): AvatarConfig {
  return parseAvatar(user?.user_metadata?.avatar) ?? randomAvatar(user?.id || 'guest');
}

export function hasSavedAvatar(user: AvatarUser): boolean {
  return parseAvatar(user?.user_metadata?.avatar) !== null;
}

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Returns an error message, or null when the username is fine. */
export function validateUsername(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, ' ');
  if (value.length < USERNAME_MIN) return `Use at least ${USERNAME_MIN} characters.`;
  if (value.length > USERNAME_MAX) return `Use ${USERNAME_MAX} characters or fewer.`;
  if (!/^[\p{L}\p{N}_ .'-]+$/u.test(value)) return 'Use letters, numbers, spaces, and . _ - only.';
  if (value.includes('@')) return 'Do not use an email address.';
  return null;
}
