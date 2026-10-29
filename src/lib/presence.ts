/**
 * Two human players, one trial that can last days.
 *
 * Each browser sends a heartbeat while its player has the trial open and visible. When the other
 * player has gone quiet, the clocks stand still on their turn, so nobody loses time while waiting
 * for them to come back and respond.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

export const HEARTBEAT_MS = 15000;

export interface FreezeInput {
  /** Two real people on separate devices. */
  onlineTwoPlayer: boolean;
  /** null = not known yet; unknown is treated as online so nothing freezes by mistake. */
  opponentOnline: boolean | null;
  currentTurn: string | null | undefined;
  playerRole: string;
}

/** The clocks stand still when it is the opponent's turn and they are not here. */
export function shouldFreezeForAbsentOpponent(s: FreezeInput): boolean {
  if (!s.onlineTwoPlayer) return false;
  if (s.opponentOnline !== false) return false;
  if (!s.currentTurn) return false;
  return s.currentTurn !== s.playerRole;
}

/** A player hiding the page stops their own clock in a two-player game (nothing to "pause" or resume by hand). */
export function shouldFreezeWhileHidden(onlineTwoPlayer: boolean, hidden: boolean): boolean {
  return onlineTwoPlayer && hidden;
}

/** Sends heartbeats while the page is visible; returns whether the opponent is around (null = unknown). */
export function useOpponentPresence(sessionId: string, enabled: boolean): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (!enabled) { setOnline(null); return; }

    const beat = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const { data, error } = await (supabase as any).rpc('session_heartbeat', { p_session: sessionId });
        if (error || !alive.current) return; // unknown stays "online": never freeze on a failed call
        setOnline(typeof data?.opponent_online === 'boolean' ? data.opponent_online : null);
      } catch { /* ignore */ }
    };

    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive.current = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [sessionId, enabled]);

  return online;
}
