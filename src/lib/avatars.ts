/**
 * Avatar data for the courtroom: what an avatar looks like (AvatarConfig),
 * the parts a player can pick from, and ready-made judges and opposing
 * counsel. Avatars are drawn as layered SVG (see AvatarFace) so the mouth can
 * move while someone speaks. A player's avatar is stored in their account
 * metadata, next to their nickname.
 */

export const SKIN_TONES = ['#f6d5b8', '#e8b98f', '#c98e63', '#a86a42', '#7a4a2c', '#4e2e1b'] as const;
export const HAIR_COLORS = ['#1b1512', '#3a2518', '#6b4226', '#b07a3c', '#c9c9c9', '#8a2d1e'] as const;
export const ATTIRE_COLORS = ['#1f2937', '#7c1d1d', '#1e3a8a', '#14532d', '#4b5563', '#3b2a50'] as const;
export const BACKDROPS = ['#2b3a55', '#3d2b4f', '#2f4a3d', '#5a3d2b', '#33414d', '#4a2f3a'] as const;

export const HAIR_STYLES = ['short', 'long', 'bun', 'curly', 'afro', 'wig', 'bald'] as const;
export const ATTIRES = ['robe', 'suit', 'blazer', 'collar'] as const;
export const BEARDS = ['none', 'stubble', 'full'] as const;

export type HairStyle = (typeof HAIR_STYLES)[number];
export type Attire = (typeof ATTIRES)[number];
export type Beard = (typeof BEARDS)[number];

export interface AvatarConfig {
  skin: number;
  hairStyle: HairStyle;
  hairColor: number;
  attire: Attire;
  attireColor: number;
  beard: Beard;
  glasses: boolean;
  backdrop: number;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: 2,
  hairStyle: 'short',
  hairColor: 1,
  attire: 'suit',
  attireColor: 0,
  beard: 'none',
  glasses: false,
  backdrop: 0
};

function make(partial: Partial<AvatarConfig>): AvatarConfig {
  return { ...DEFAULT_AVATAR, ...partial };
}

/** Ten judges: robes, some in wigs, a spread of ages-by-hair and skin tones. */
export const JUDGE_AVATARS: AvatarConfig[] = [
  make({ skin: 0, hairStyle: 'wig', hairColor: 4, attire: 'robe', attireColor: 0, backdrop: 4 }),
  make({ skin: 4, hairStyle: 'short', hairColor: 4, attire: 'robe', attireColor: 0, beard: 'stubble', glasses: true, backdrop: 1 }),
  make({ skin: 2, hairStyle: 'bun', hairColor: 0, attire: 'robe', attireColor: 1, glasses: true, backdrop: 0 }),
  make({ skin: 5, hairStyle: 'bald', hairColor: 0, attire: 'robe', attireColor: 0, beard: 'full', backdrop: 3 }),
  make({ skin: 1, hairStyle: 'long', hairColor: 4, attire: 'robe', attireColor: 5, backdrop: 2 }),
  make({ skin: 3, hairStyle: 'wig', hairColor: 4, attire: 'robe', attireColor: 1, beard: 'none', glasses: true, backdrop: 5 }),
  make({ skin: 0, hairStyle: 'bald', hairColor: 4, attire: 'robe', attireColor: 2, beard: 'full', glasses: true, backdrop: 4 }),
  make({ skin: 4, hairStyle: 'afro', hairColor: 4, attire: 'robe', attireColor: 0, backdrop: 0 }),
  make({ skin: 2, hairStyle: 'curly', hairColor: 0, attire: 'robe', attireColor: 3, glasses: true, backdrop: 2 }),
  make({ skin: 1, hairStyle: 'short', hairColor: 0, attire: 'robe', attireColor: 4, beard: 'stubble', backdrop: 3 })
];

/** Ten opposing counsel: courtroom business wear, varied looks. */
export const COUNSEL_AVATARS: AvatarConfig[] = [
  make({ skin: 1, hairStyle: 'short', hairColor: 3, attire: 'suit', attireColor: 0, backdrop: 0 }),
  make({ skin: 4, hairStyle: 'short', hairColor: 0, attire: 'suit', attireColor: 2, beard: 'stubble', backdrop: 1 }),
  make({ skin: 0, hairStyle: 'long', hairColor: 5, attire: 'blazer', attireColor: 1, backdrop: 2 }),
  make({ skin: 3, hairStyle: 'bun', hairColor: 0, attire: 'blazer', attireColor: 4, glasses: true, backdrop: 4 }),
  make({ skin: 5, hairStyle: 'afro', hairColor: 0, attire: 'suit', attireColor: 5, backdrop: 3 }),
  make({ skin: 2, hairStyle: 'curly', hairColor: 1, attire: 'blazer', attireColor: 0, glasses: true, backdrop: 5 }),
  make({ skin: 0, hairStyle: 'bald', hairColor: 0, attire: 'suit', attireColor: 3, beard: 'full', backdrop: 0 }),
  make({ skin: 1, hairStyle: 'short', hairColor: 4, attire: 'collar', attireColor: 2, glasses: true, backdrop: 1 }),
  make({ skin: 4, hairStyle: 'long', hairColor: 0, attire: 'blazer', attireColor: 5, backdrop: 2 }),
  make({ skin: 2, hairStyle: 'short', hairColor: 2, attire: 'suit', attireColor: 1, beard: 'stubble', backdrop: 4 })
];

export type AvatarKind = 'judge' | 'counsel' | 'player';

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

/** A random player avatar. Without a seed it is different every call. */
export function randomAvatar(seed?: string): AvatarConfig {
  const rand = seed ? seededRandom(seed) : Math.random;
  return {
    skin: Math.floor(rand() * SKIN_TONES.length),
    hairStyle: pick(HAIR_STYLES, rand),
    hairColor: Math.floor(rand() * HAIR_COLORS.length),
    attire: pick(['suit', 'blazer', 'collar'] as const, rand),
    attireColor: Math.floor(rand() * ATTIRE_COLORS.length),
    beard: pick(BEARDS, rand),
    glasses: rand() < 0.3,
    backdrop: Math.floor(rand() * BACKDROPS.length)
  };
}

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

/** Validates stored data. Returns null if it is missing or not a usable avatar. */
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
  return {
    skin: a.skin,
    hairStyle: a.hairStyle as HairStyle,
    hairColor: a.hairColor,
    attire: a.attire as Attire,
    attireColor: a.attireColor,
    beard: a.beard as Beard,
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
