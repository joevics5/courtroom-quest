import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { db } from '../lib/database';
import HeroBackground from './HeroBackground';
import JurorAvatar from './avatars/JurorAvatar';
import { describeJurorTraits } from '../lib/jurorProfile';
import { LIVE_POLL_MS, jurorTurn, otherSide, type PlayMode, type Side } from '../lib/liveGame';
import type { Juror, JurySelection as JurySelectionType } from '../types';

interface Props {
  sessionId: string;
  maxJurors: number;
  onComplete: () => void;
  onBack?: () => void;
  /** Which side this player picks for. Defaults to the defense (older callers). */
  mySide?: Side;
  /** ai: the computer picks for the other side. online: a real opponent does, live. device: one phone, both sides. */
  mode?: PlayMode;
  /** Online: only the host draws the pool, so both players choose from the same people. */
  isHost?: boolean;
  opponentName?: string;
}

const sameSelections = (a: JurySelectionType[], b: JurySelectionType[]) =>
  a.length === b.length && a.every((x, i) => x.id === b[i].id);

export default function JurySelection({ sessionId, maxJurors, onComplete, onBack, mySide = 'defense', mode = 'ai', isHost = true, opponentName }: Props) {
  const [jurorPool, setJurorPool] = useState<Juror[]>([]);
  const [selectedJurors, setSelectedJurors] = useState<JurySelectionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPicking, setIsPicking] = useState(false);
  const aiBusy = useRef(false);
  const perSide = maxJurors / 2;
  const aiSide = otherSide(mySide);
  const turn = jurorTurn(selectedJurors, perSide);
  const online = mode === 'online';

  useEffect(() => {
    loadJurors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Online: keep both players' boards identical. The other player's picks appear on their own,
  // without reloading, and it becomes my turn the moment they have picked.
  useEffect(() => {
    if (!online || loading) return;
    let alive = true;
    const refresh = async () => {
      try {
        const fresh = await db.jurySelections.getSessionJurySelections(sessionId);
        if (!alive) return;
        setSelectedJurors(prev => (sameSelections(prev, fresh) ? prev : fresh));
        // A juror the other player picked might not be in my pool yet (it is shared, so it normally is).
        const missing = fresh.map(f => f.juror_id).filter(id => !jurorPoolRef.current.some(j => j.id === id));
        if (missing.length > 0) {
          const extra = await db.jurors.getJurorsByIds(missing);
          if (alive && extra.length > 0) setJurorPool(prev => [...prev, ...extra.filter(e => !prev.some(j => j.id === e.id))]);
        }
      } catch { /* try again on the next tick */ }
    };
    const id = window.setInterval(refresh, LIVE_POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, [online, loading, sessionId]);

  const jurorPoolRef = useRef<Juror[]>([]);
  jurorPoolRef.current = jurorPool;

  const loadJurors = async () => {
    try {
      // Jurors already picked in an earlier visit must stay in the pool: the
      // random 30 are different every time, so without this a resumed game
      // would show empty seats for people it had already chosen.
      const existing = await db.jurySelections.getSessionJurySelections(sessionId);
      const pickedIds = existing.map(s => s.juror_id);

      let poolIds: string[] | null = null;
      if (online) {
        // Both players must choose from the SAME pool: the host draws it once and saves it with the game.
        // The other player waits for it to appear.
        for (let attempt = 0; attempt < 60 && !poolIds; attempt++) {
          const session = await db.sessions.getSession(sessionId);
          const saved = (session?.session_state as any)?.jurorPoolIds;
          if (Array.isArray(saved) && saved.length > 0) { poolIds = saved as string[]; break; }
          if (isHost) break;
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      if (poolIds) {
        setJurorPool(await db.jurors.getJurorsByIds(Array.from(new Set([...poolIds, ...pickedIds]))));
      } else {
        const [picked, random] = await Promise.all([
          pickedIds.length > 0 ? db.jurors.getJurorsByIds(pickedIds) : Promise.resolve([] as Juror[]),
          db.jurors.getRandomJurors(30)
        ]);
        const pool = [...random, ...picked.filter(p => !random.some(r => r.id === p.id))];
        setJurorPool(pool);
        if (online && isHost) {
          await db.sessions.mergeState(sessionId, { jurorPoolIds: pool.map(j => j.id) });
        }
      }
      setSelectedJurors(existing);
    } catch (error) {
      console.error('Error loading jurors:', error);
    } finally {
      setLoading(false);
    }
  };

  /** Seats a juror for a side. Returns false if someone else got there first. */
  const seat = async (juror: Juror, side: Side, current: JurySelectionType[]) => {
    try {
      const selection = await db.jurySelections.addJurySelection({
        session_id: sessionId,
        juror_id: juror.id,
        selected_by: side,
        selection_order: current.length + 1
      });
      setSelectedJurors(prev => (prev.some(p => p.id === selection.id) ? prev : [...prev, selection]));
      return true;
    } catch (error) {
      console.error('Error selecting juror:', error);
      return false;
    }
  };

  // The side I pick for right now: my own side, or whoever's turn it is when one phone is shared.
  const pickingSide: Side | null = turn === null ? null : mode === 'device' ? turn : turn === mySide ? mySide : null;

  const handleSelectJuror = async (juror: Juror) => {
    if (!pickingSide || isPicking) return;
    if (selectedJurors.some(s => s.juror_id === juror.id)) return;
    setIsPicking(true);
    try {
      await seat(juror, pickingSide, selectedJurors);
    } finally {
      setIsPicking(false);
    }
  };

  // Against the computer, it picks for the other side whenever it is that side's turn
  // (including right at the start, when the player is the prosecution and the defense picks first).
  useEffect(() => {
    if (mode !== 'ai' || loading || turn !== aiSide || aiBusy.current) return;
    aiBusy.current = true;
    const timer = window.setTimeout(async () => {
      try {
        const available = jurorPoolRef.current.filter(j => !selectedJurors.some(s => s.juror_id === j.id));
        if (available.length > 0) {
          await seat(available[Math.floor(Math.random() * available.length)], aiSide, selectedJurors);
        }
      } finally {
        aiBusy.current = false;
      }
    }, 800);
    return () => { window.clearTimeout(timer); aiBusy.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, loading, turn, aiSide, selectedJurors.length]);

  const canRemove = (side: string) => mode === 'device' || side === mySide;
  const handleRemoveJuror = async (selectionId: string) => {
    try {
      await db.jurySelections.removeJurySelection(selectionId);
      setSelectedJurors(prev => prev.filter(s => s.id !== selectionId));
    } catch (error) {
      console.error('Error removing juror:', error);
    }
  };

  const prosecutionJurors = selectedJurors.filter(j => j.selected_by === 'prosecution');
  const defenseJurors = selectedJurors.filter(j => j.selected_by === 'defense');
  const isComplete = prosecutionJurors.length === perSide && defenseJurors.length === perSide;
  const mineFull = (mySide === 'defense' ? defenseJurors : prosecutionJurors).length >= perSide;
  const remaining = perSide - (mySide === 'defense' ? defenseJurors : prosecutionJurors).length;
  const available = jurorPool.filter(j => !selectedJurors.some(s => s.juror_id === j.id));
  const canPick = pickingSide !== null && !isPicking;
  const opponentLabel = online ? opponentName || 'Your opponent' : 'The ' + aiSide;
  const waitingOnOther = !isComplete && mode !== 'device' && turn !== null && turn !== mySide;

  if (loading) {
    return (
      <div className="relative min-h-[100dvh] bg-[#0b0d14] flex items-center justify-center">
        <HeroBackground overlay="from-black/85 via-black/80 to-black/90" />
        <div className="relative z-10 text-center">
          <h1 className="logo-gold font-game text-5xl leading-none">JURY SELECTION</h1>
          <p className="mt-3 text-xs font-bold tracking-[0.3em] text-white/50">CALLING THE JURY POOL…</p>
        </div>
      </div>
    );
  }

  /** One row of seats for a side; filled seats show the juror, tap to strike them */
  const renderSeats = (side: 'prosecution' | 'defense', picks: JurySelectionType[]) => {
    const isDefense = side === 'defense';
    const label = mode === 'device' ? side.toUpperCase() : side === mySide ? 'YOUR PICKS' : online ? (opponentName || 'OPPONENT').toUpperCase() : side.toUpperCase();
    return (
      <div className="flex items-center gap-2">
        <div className="w-[88px] flex-none">
          <div className={`text-[11px] font-black tracking-wider truncate ${isDefense ? 'text-blue-300' : 'text-red-300'}`}>
            {label}
          </div>
          <div className="font-game text-2xl text-white leading-none">
            {picks.length}/{perSide}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-between gap-1.5">
          {Array.from({ length: perSide }).map((_, i) => {
            const pick = picks[i];
            const juror = pick ? jurorPool.find(j => j.id === pick.juror_id) : undefined;
            if (!pick || !juror) {
              return (
                <span
                  key={i}
                  className={`w-10 h-10 rounded-full border-2 border-dashed ${isDefense ? 'border-blue-400/40' : 'border-red-400/40'} ${
                    turn === side && waitingOnOther && i === picks.length ? 'animate-pulse ' + (isDefense ? 'bg-blue-500/20' : 'bg-red-500/20') : ''
                  }`}
                />
              );
            }
            return (
              canRemove(side) ? (
                <button
                  key={pick.id}
                  onClick={() => handleRemoveJuror(pick.id)}
                  aria-label={`Remove ${juror.name}`}
                  title={`${juror.name} — tap to remove`}
                  className={`relative rounded-full ring-2 ${isDefense ? 'ring-blue-400' : 'ring-red-400'}`}
                >
                  <JurorAvatar seed={juror.id} name={juror.name} size="sm" />
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-black border border-white/40">
                    <X className="w-2.5 h-2.5 text-white" />
                  </span>
                </button>
              ) : (
                <span key={pick.id} title={juror.name} className={`rounded-full ring-2 ${isDefense ? 'ring-blue-400' : 'ring-red-400'}`}>
                  <JurorAvatar seed={juror.id} name={juror.name} size="sm" />
                </span>
              )
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#0b0d14]">
      <HeroBackground overlay="from-black/85 via-black/80 to-black/90" />

      <div className="relative z-10 h-full flex flex-col max-w-2xl lg:max-w-4xl mx-auto">
        {/* Header + the jury box stay pinned while the pool scrolls */}
        <div className="flex-none px-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
          <header className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                aria-label="Back"
                className="flex-none flex items-center justify-center w-11 h-11 rounded-full bg-black/55 border border-white/15 text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="logo-gold font-game text-4xl leading-none">JURY SELECTION</h1>
              <p className="text-white/60 text-xs mt-1">Each side picks {perSide} jurors.</p>
            </div>
          </header>

          <div className="mt-3 rounded-3xl bg-black/65 border border-white/15 backdrop-blur-sm p-3 space-y-2.5">
            {mySide === 'prosecution' ? renderSeats('prosecution', prosecutionJurors) : renderSeats('defense', defenseJurors)}
            <div className="h-px bg-white/10" />
            {mySide === 'prosecution' ? renderSeats('defense', defenseJurors) : renderSeats('prosecution', prosecutionJurors)}
          </div>

          <div
            className={`mt-2.5 rounded-full px-4 py-2 text-center text-sm font-bold ${
              isComplete
                ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                : waitingOnOther
                  ? 'bg-red-500/15 border border-red-400/40 text-red-200 animate-pulse'
                  : 'bg-[#FFD43B]/15 border border-[#FFD43B]/50 text-[#FFD43B]'
            }`}
          >
            {isComplete
              ? 'The jury is seated.'
              : waitingOnOther
                ? `${opponentLabel} is choosing a juror…`
                : mode === 'device'
                  ? `${turn === 'prosecution' ? 'Prosecution' : 'Defense'}: your pick — ${perSide - (turn === 'prosecution' ? prosecutionJurors : defenseJurors).length} more`
                  : `Your pick — ${remaining} more for the ${mySide}`}
          </div>
        </div>

        {/* Pool */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 pb-3 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:content-start">
          <h2 className="font-game text-2xl text-white/90 leading-none lg:col-span-2">JUROR POOL</h2>
          {available.map(juror => (
            <article key={juror.id} className="rounded-2xl bg-black/60 border border-white/15 backdrop-blur-sm p-3">
              <div className="flex items-center gap-3">
                <JurorAvatar seed={juror.id} name={juror.name} size="md" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white leading-tight truncate">{juror.name}</h3>
                  <p className="text-sm text-white/65 truncate">{juror.age} · {juror.occupation}</p>
                </div>
                <button
                  onClick={() => handleSelectJuror(juror)}
                  disabled={!canPick}
                  className="flex-none rounded-xl bg-[#FFD43B] text-black font-game text-xl px-4 py-1.5 border-b-4 border-[#B8860B] active:translate-y-0.5 active:border-b-2 transition-all disabled:opacity-35 disabled:grayscale"
                >
                  PICK
                </button>
              </div>
              {juror.background && <p className="mt-2 text-sm text-white/65 leading-snug line-clamp-2">{juror.background}</p>}
              {describeJurorTraits(juror.personality_traits).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {describeJurorTraits(juror.personality_traits).slice(0, 3).map((trait, idx) => (
                    <span key={idx} className="rounded-full bg-white/10 border border-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/75">
                      {trait}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
          {available.length === 0 && <p className="text-center text-white/50 text-sm py-6">No more jurors in the pool.</p>}
        </div>

        {/* Always-visible footer */}
        <div className="flex-none px-4 pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
          <button
            onClick={onComplete}
            disabled={!isComplete}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#FFD43B] text-black font-game text-3xl py-3 border-b-[6px] border-[#B8860B] active:translate-y-1 active:border-b-2 transition-all disabled:opacity-40 disabled:grayscale"
          >
            {isComplete ? 'PROCEED TO TRIAL' : waitingOnOther || mineFull ? 'WAITING…' : `PICK ${mode === 'device' ? perSide - (turn === 'prosecution' ? prosecutionJurors : defenseJurors).length : remaining} MORE JUROR${(mode === 'device' ? 1 : remaining) === 1 ? '' : 'S'}`}
            {isComplete && <ArrowRight className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
}
