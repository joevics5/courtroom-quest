import { avatarFromSeed, randomAvatar, type AvatarConfig } from './avatars';

/** AI counsel get a steady mid-ladder rank (same seed, same rank): experienced but beatable. */
export function aiRank(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return 3 + (h % 5);
}

/**
 * Who is on screen, and what they look like. Used by BOTH the pre-trial scene and the
 * trial, so a character never changes face between the two: the same name or id always
 * gives the same avatar.
 */
export function castAvatars(input: {
  judgeName?: string | null;
  /** Name of the AI prosecutor (when the player is the defense). */
  prosecutorName?: string | null;
  playerRole: 'prosecution' | 'defense';
  myAvatar: AvatarConfig;
  sessionId: string;
  /** A real opponent's chosen avatar and account id, in a two-player game. */
  opponentAvatar?: AvatarConfig | null;
  opponentUserId?: string | null;
}): { judge: AvatarConfig; prosecution: AvatarConfig; defense: AvatarConfig } {
  const { playerRole, myAvatar, opponentAvatar, opponentUserId } = input;
  return {
    judge: avatarFromSeed(input.judgeName || 'Judge', 'judge'),
    prosecution:
      playerRole === 'prosecution'
        ? myAvatar
        : opponentAvatar || avatarFromSeed(opponentUserId || input.prosecutorName || 'Prosecution', 'counsel'),
    defense:
      playerRole === 'defense'
        ? myAvatar
        : opponentAvatar || avatarFromSeed(opponentUserId || `${input.sessionId}-Defense Counsel`, 'counsel')
  };
}

/** The witnesses who appear on the stand again and again. */
export const WITNESS_POOL_SIZE = 10;

/**
 * A witness's face, taken from a fixed pool of ten. The same witness name always gets the same
 * face, so a witness looks the same on direct, cross and redirect.
 */
export function witnessAvatar(name: string): AvatarConfig {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return randomAvatar(`witness-pool-${h % WITNESS_POOL_SIZE}`);
}
