import i18n from '../i18n';
import { LEVELS } from './levels';

/** Rank title in the player's language, e.g. rankTitle(1) -> "Junior Counsel" / "Abogado/a junior". */
export function rankTitle(level: number): string {
  return i18n.t(`ranks.${level}`);
}

/**
 * Names saved or compared inside the game stay in English ('Bailiff', 'Defendant', "Junior Counsel Ana").
 * This turns one of them into what the player should read on screen.
 */
export function speakerLabel(speaker: string): string {
  if (speaker === 'Bailiff') return i18n.t('speakers.bailiff');
  if (speaker === 'Defendant') return i18n.t('speakers.defendant');
  if (speaker === 'Judge') return i18n.t('speakers.judge');
  for (const level of LEVELS) {
    if (speaker.startsWith(level.title + ' ')) return rankTitle(level.level) + speaker.slice(level.title.length);
  }
  return speaker;
}

/** 'Junior Counsel' -> the same rank in the player's language. Unknown titles come back unchanged. */
export function translateRankTitle(title: string): string {
  const level = LEVELS.find(l => l.title === title);
  return level ? rankTitle(level.level) : title;
}

/** 'Judge' | 'Prosecution' | 'Defense' | 'Witness' | 'Bailiff' | 'Jury' -> the same role in the player's language. */
export function roleLabel(role: string): string {
  switch (role) {
    case 'Judge': return i18n.t('speakers.judge');
    case 'Prosecution': return i18n.t('roles.prosecution');
    case 'Defense': return i18n.t('roles.defense');
    case 'Witness': return i18n.t('transcript.witness');
    case 'Bailiff': return i18n.t('speakers.bailiff');
    case 'Jury': return i18n.t('transcript.jury');
    default: return role;
  }
}
