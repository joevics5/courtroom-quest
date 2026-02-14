import { useState, useEffect } from 'react';
import { Users, Check, X, ArrowLeft } from 'lucide-react';
import { db } from '../lib/database';
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
  }, []);

  const loadJurors = async () => {
    try {
      const jurors = await db.jurors.getRandomJurors(30);
      setJurorPool(jurors);

      const existing = await db.jurySelections.getSessionJurySelections(sessionId);
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
      const newDefCount = newSelections.filter(j => j.selected_by === 'defense').length;

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

      const newSelections = [...currentSelections, selection];
      setSelectedJurors(newSelections);
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

  const prosecutionJurors = selectedJurors.filter(j => j.selected_by === 'prosecution');
  const defenseJurors = selectedJurors.filter(j => j.selected_by === 'defense');
  const isComplete = prosecutionJurors.length === maxJurors / 2 && defenseJurors.length === maxJurors / 2;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading juror pool...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 shadow-2xl mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-6 h-6 text-white" />
                </button>
              )}
              <Users className="w-8 h-8 text-blue-400" />
              <h1 className="text-3xl font-bold text-white">Jury Selection</h1>
            </div>
            {isComplete && (
              <button
                onClick={onComplete}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-700 transition-all"
              >
                Proceed to Trial
              </button>
            )}
          </div>

          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <p className="text-white/80 text-center">
              Each side selects {maxJurors / 2} jurors. Currently selecting for: <span className="font-bold text-blue-400">{currentSide === 'prosecution' ? 'Prosecution' : 'Defense'}</span>
            </p>
            <div className="mt-4 flex justify-center gap-8">
              <div className="text-center">
                <div className="text-sm text-white/60">Prosecution</div>
                <div className="text-2xl font-bold text-white">{prosecutionJurors.length}/{maxJurors / 2}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-white/60">Defense</div>
                <div className="text-2xl font-bold text-white">{defenseJurors.length}/{maxJurors / 2}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-white mb-4">Available Jurors</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jurorPool.map((juror) => {
                const isSelected = selectedJurors.some(s => s.juror_id === juror.id);
                const selection = selectedJurors.find(s => s.juror_id === juror.id);

                return (
                  <div
                    key={juror.id}
                    className={`bg-white/10 backdrop-blur-lg rounded-lg p-4 border transition-all ${
                      isSelected
                        ? 'border-green-500 opacity-50'
                        : 'border-white/20 hover:border-blue-400 cursor-pointer'
                    }`}
                    onClick={() => !isSelected && handleSelectJuror(juror)}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <img
                        src={juror.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(juror.name)}&background=random&size=48`}
                        alt={juror.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-white font-semibold">{juror.name}</h3>
                            <p className="text-white/60 text-sm">{juror.age} years old</p>
                          </div>
                          {isSelected && selection && (
                            <div className={`text-xs px-2 py-1 rounded ${
                              selection.selected_by === 'prosecution' ? 'bg-blue-500' : 'bg-purple-500'
                            }`}>
                              {selection.selected_by === 'prosecution' ? 'Prosecution' : 'Defense'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-white/80 text-sm font-medium mb-2">{juror.occupation}</p>
                    <p className="text-white/60 text-xs mb-3 line-clamp-2">{juror.background}</p>
                    {juror.personality_traits && juror.personality_traits.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {juror.personality_traits.slice(0, 3).map((trait, idx) => (
                          <span key={idx} className="text-xs bg-white/10 px-2 py-1 rounded text-white/70">
                            {trait}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white mb-4">Selected Jury</h2>
            <div className="space-y-4">
              <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4 border border-blue-500/50">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  Prosecution Jurors ({prosecutionJurors.length}/{maxJurors / 2})
                </h3>
                <div className="space-y-2">
                  {prosecutionJurors.map((selection) => {
                    const juror = jurorPool.find(j => j.id === selection.juror_id);
                    if (!juror) return null;
                    return (
                      <div key={selection.id} className="bg-white/5 p-3 rounded flex items-center justify-between">
                        <div>
                          <div className="text-white text-sm font-medium">{juror.name}</div>
                          <div className="text-white/60 text-xs">{juror.occupation}</div>
                        </div>
                        <button
                          onClick={() => handleRemoveJuror(selection.id)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4 border border-purple-500/50">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  Defense Jurors ({defenseJurors.length}/{maxJurors / 2})
                </h3>
                <div className="space-y-2">
                  {defenseJurors.map((selection) => {
                    const juror = jurorPool.find(j => j.id === selection.juror_id);
                    if (!juror) return null;
                    return (
                      <div key={selection.id} className="bg-white/5 p-3 rounded flex items-center justify-between">
                        <div>
                          <div className="text-white text-sm font-medium">{juror.name}</div>
                          <div className="text-white/60 text-xs">{juror.occupation}</div>
                        </div>
                        <button
                          onClick={() => handleRemoveJuror(selection.id)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
