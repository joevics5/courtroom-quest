import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { db } from '../lib/database';
import HeroBackground from './HeroBackground';
import JurorAvatar from './avatars/JurorAvatar';
import { describeJurorTraits } from '../lib/jurorProfile';
import type { Juror, JurySelection as JurySelectionType } from '../types';

interface Props {
  sessionId: string;
  maxJurors: number;
  onComplete: () => void;
  onBack?: () => void;
}

export default function JurySelection({ sessionId, maxJurors, onComplete, onBack }: Props) {
  const [jurorPool, setJurorPool] = useState<Juror[]>([]);
  const [selectedJurors, setSelectedJurors] = useState<JurySelectionType[]>([]);
  const [currentSide, setCurrentSide] = useState<'prosecution' | 'defense'>('defense');
  const [loading, setLoading] = useState(true);
  const [isAutoSelecting, setIsAutoSelecting] = useState(false);

  useEffect(() => {
    loadJurors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadJurors = async () => {
    try {
      // Jurors already picked in an earlier visit must stay in the pool: the
      // random 30 are different every time, so without this a resumed game
      // would show empty seats for people it had already chosen.
      const existing = await db.jurySelections.getSessionJurySelections(sessionId);
      const pickedIds = existing.map(s => s.juror_id);
      const [picked, random] = await Promise.all([
        pickedIds.length > 0 ? db.jurors.getJurorsByIds(pickedIds) : Promise.resolve([] as Juror[]),
        db.jurors.getRandomJurors(30)
      ]);
      const pool = [...random, ...picked.filter(p => !random.some(r => r.id === p.id))];
      setJurorPool(pool);
      setSelectedJurors(existing);

      if (existing.length > 0) {
        const prosCount = existing.filter(j => j.selected_by === 'prosecution').length;
        const defCount = existing.filter(j => j.selected_by === 'defense').length;
        setCurrentSide(defCount < prosCount ? 'defense' : 'prosecution');
      }
    } catch (error) {
      console.error('Error loading jurors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectJuror = async (juror: Juror) => {
    if (selectedJurors.some(s => s.juror_id === juror.id)) return;
    if (currentSide !== 'defense') return;
    if (isAutoSelecting) return;

    const defCount = selectedJurors.filter(j => j.selected_by === 'defense').length;
    if (defCount >= maxJurors / 2) return;

    try {
      const selection = await db.jurySelections.addJurySelection({
        session_id: sessionId,
        juror_id: juror.id,
        selected_by: 'defense',
        selection_order: selectedJurors.length + 1
      });

      const newSelections = [...selectedJurors, selection];
      setSelectedJurors(newSelections);

      const prosCount = newSelections.filter(j => j.selected_by === 'prosecution').length;
      if (prosCount < maxJurors / 2) {
        await autoSelectForProsecution(newSelections);
      }
    } catch (error) {
      console.error('Error selecting juror:', error);
    }
  };

  const autoSelectForProsecution = async (currentSelections: JurySelectionType[]) => {
    setIsAutoSelecting(true);
    setCurrentSide('prosecution');

    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const availableJurors = jurorPool.filter(
        juror => !currentSelections.some(s => s.juror_id === juror.id)
      );

      if (availableJurors.length === 0) return;

      const randomJuror = availableJurors[Math.floor(Math.random() * availableJurors.length)];

      const selection = await db.jurySelections.addJurySelection({
        session_id: sessionId,
        juror_id: randomJuror.id,
        selected_by: 'prosecution',
        selection_order: currentSelections.length + 1
      });

      setSelectedJurors([...currentSelections, selection]);
      setCurrentSide('defense');
    } catch (error) {
      console.error('Error auto-selecting for prosecution:', error);
    } finally {
      setIsAutoSelecting(false);
    }
  };

  const handleRemoveJuror = async (selectionId: string) => {
    try {
      await db.jurySelections.removeJurySelection(selectionId);
      setSelectedJurors(selectedJurors.filter(s => s.id !== selectionId));
    } catch (error) {
      console.error('Error removing juror:', error);
    }
  };

  const perSide = maxJurors / 2;
  const prosecutionJurors = selectedJurors.filter(j => j.selected_by === 'prosecution');
  const defenseJurors = selectedJurors.filter(j => j.selected_by === 'defense');
  const isComplete = prosecutionJurors.length === perSide && defenseJurors.length === perSide;
  const defenseFull = defenseJurors.length >= perSide;
  const remaining = perSide - defenseJurors.length;
  const available = jurorPool.filter(j => !selectedJurors.some(s => s.juror_id === j.id));
  const canPick = currentSide === 'defense' && !isAutoSelecting && !defenseFull;

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
    return (
      <div className="flex items-center gap-2">
        <div className="w-[88px] flex-none">
          <div className={`text-[11px] font-black tracking-wider ${isDefense ? 'text-blue-300' : 'text-red-300'}`}>
            {isDefense ? 'YOUR PICKS' : 'PROSECUTION'}
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
                    !isDefense && isAutoSelecting && i === picks.length ? 'animate-pulse bg-red-500/20' : ''
                  }`}
                />
              );
            }
            return (
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
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#0b0d14]">
      <HeroBackground overlay="from-black/85 via-black/80 to-black/90" />

      <div className="relative z-10 h-full flex flex-col max-w-2xl mx-auto">
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
            {renderSeats('defense', defenseJurors)}
            <div className="h-px bg-white/10" />
            {renderSeats('prosecution', prosecutionJurors)}
          </div>

          <div
            className={`mt-2.5 rounded-full px-4 py-2 text-center text-sm font-bold ${
              isComplete
                ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                : isAutoSelecting
                  ? 'bg-red-500/15 border border-red-400/40 text-red-200 animate-pulse'
                  : 'bg-[#FFD43B]/15 border border-[#FFD43B]/50 text-[#FFD43B]'
            }`}
          >
            {isComplete
              ? 'The jury is seated.'
              : isAutoSelecting
                ? 'The prosecution is choosing a juror…'
                : defenseFull
                  ? 'Waiting for the prosecution to finish…'
                  : `Your pick — ${remaining} more for the defense`}
          </div>
        </div>

        {/* Pool */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 pb-3 space-y-3">
          <h2 className="font-game text-2xl text-white/90 leading-none">JUROR POOL</h2>
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
            {isComplete ? 'PROCEED TO TRIAL' : defenseFull ? 'WAITING…' : `PICK ${remaining} MORE JUROR${remaining === 1 ? '' : 'S'}`}
            {isComplete && <ArrowRight className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
}
