import type { CaseSession } from '../types';

export interface PhaseBadge {
  label: string;
  /** badge pill classes */
  badge: string;
  /** card border + tint classes */
  card: string;
}

/** Each stage of a game gets its own colour so ongoing games are easy to tell apart. */
export function getPhaseBadge(phase: string | undefined): PhaseBadge {
  switch (phase) {
    case 'trial':
      return { label: 'IN TRIAL', badge: 'bg-orange-500/20 border-orange-400/60 text-orange-300', card: 'border-orange-400/50 bg-orange-500/[0.07]' };
    case 'pre-trial':
      return { label: 'PRE-TRIAL', badge: 'bg-violet-500/20 border-violet-400/60 text-violet-300', card: 'border-violet-400/50 bg-violet-500/[0.07]' };
    case 'jury-selection':
      return { label: 'JURY SELECTION', badge: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300', card: 'border-emerald-400/50 bg-emerald-500/[0.07]' };
    case 'trial-type-selection':
    case 'difficulty-selection':
      return { label: 'TRIAL SETUP', badge: 'bg-teal-500/20 border-teal-400/60 text-teal-300', card: 'border-teal-400/50 bg-teal-500/[0.07]' };
    case 'setup':
    case 'role-selection':
    case 'investigation':
    default:
      return { label: 'INVESTIGATION', badge: 'bg-sky-500/20 border-sky-400/60 text-sky-300', card: 'border-sky-400/50 bg-sky-500/[0.07]' };
  }
}

export interface SessionMode {
  label: string;
  badge: string;
}

/** How a game is being played: vs the AI, vs another player online, or sharing one device. */
export function getSessionMode(session: Pick<CaseSession, 'session_state'> | null | undefined): SessionMode {
  const state = (session?.session_state || {}) as { isMultiplayer?: boolean; sameDevicePlay?: boolean };
  if (state.sameDevicePlay) return { label: 'SAME DEVICE', badge: 'bg-purple-500/20 border-purple-400/60 text-purple-200' };
  if (state.isMultiplayer) return { label: 'VS PLAYER', badge: 'bg-rose-500/20 border-rose-400/60 text-rose-200' };
  return { label: 'VS AI', badge: 'bg-slate-500/25 border-slate-400/50 text-slate-200' };
}

/** "5 min ago", "3 hours ago", "2 days ago" */
export function timeAgo(iso: string | undefined | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.round(diff / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
