import { memo, useMemo } from 'react';
import { AlertCircle, FileText, User } from 'lucide-react';
import AvatarFace from './AvatarFace';
import { avatarFromSeed, type AvatarConfig } from '../lib/avatars';

export interface TranscriptEvent {
  id: string;
  speaker_role: string;
  speaker_name?: string | null;
  event_type?: string | null;
  content: string;
}

type Tone = 'judge' | 'prosecution' | 'defense' | 'witness' | 'evidence' | 'neutral';

const TONES: Record<Tone, { name: string; ring: string; bar: string; chip: string }> = {
  judge: { name: 'text-[#FFD43B]', ring: 'border-[#FFD43B]/70', bar: 'border-l-[#FFD43B]', chip: 'JUDGE' },
  prosecution: { name: 'text-[#FF7A7E]', ring: 'border-[#E5484D]/70', bar: 'border-l-[#E5484D]', chip: 'PROSECUTION' },
  defense: { name: 'text-[#7FB2FF]', ring: 'border-[#3B82F6]/70', bar: 'border-l-[#3B82F6]', chip: 'DEFENSE' },
  witness: { name: 'text-[#5EEAD4]', ring: 'border-[#2EC4B6]/70', bar: 'border-l-[#2EC4B6]', chip: 'WITNESS' },
  evidence: { name: 'text-[#C4B5FD]', ring: 'border-[#8B5CF6]/70', bar: 'border-l-[#8B5CF6]', chip: 'EVIDENCE' },
  neutral: { name: 'text-white/70', ring: 'border-white/25', bar: 'border-l-white/30', chip: '' }
};

function toneFor(event: TranscriptEvent): Tone {
  if (event.event_type === 'evidence_submission') return 'evidence';
  switch (event.speaker_role) {
    case 'judge':
      return 'judge';
    case 'prosecution':
      return 'prosecution';
    case 'defense':
    case 'counsel':
      return 'defense';
    case 'witness':
      return 'witness';
    default:
      return 'neutral';
  }
}

interface TranscriptMessageProps {
  event: TranscriptEvent;
  /** Face for judge and counsel lines; witnesses get a face made from their name. */
  avatars: { judge: AvatarConfig; prosecution: AvatarConfig; defense: AvatarConfig };
  /** Name of the prosecutor, to tell which side a generic "counsel" line belongs to. */
  prosecutorName?: string;
  /** The player's side, so their own lines can be marked. */
  playerRole?: 'prosecution' | 'defense';
}

/**
 * One line of the transcript: the speaker's face, a role color (gold judge, crimson prosecution,
 * blue defense, teal witness, violet evidence) and the text. Memoized: a long trial has
 * many of these and only the newest changes.
 */
function TranscriptMessageBase({ event, avatars, prosecutorName, playerRole }: TranscriptMessageProps) {
  const tone = toneFor(event);
  const style = TONES[tone];
  const isWitnessCall = event.event_type === 'witness_call';
  const isObjection = event.event_type === 'objection';

  const side =
    event.speaker_role === 'prosecution' || (event.speaker_role === 'counsel' && !!prosecutorName && event.speaker_name === prosecutorName)
      ? 'prosecution'
      : 'defense';
  const witnessFace = useMemo(
    () => (tone === 'witness' ? avatarFromSeed(event.speaker_name || 'witness', 'player') : null),
    [tone, event.speaker_name]
  );
  const face =
    tone === 'judge' ? avatars.judge : tone === 'witness' ? witnessFace : tone === 'prosecution' || tone === 'defense' ? avatars[tone === 'prosecution' ? 'prosecution' : side] : null;
  const mine = (tone === 'prosecution' || tone === 'defense') && playerRole === (tone === 'prosecution' ? 'prosecution' : side);

  return (
    <div className="flex items-start gap-3">
      <div className={`flex-none w-11 h-11 rounded-xl overflow-hidden border-2 ${style.ring} bg-black/40 flex items-center justify-center`}>
        {face ? (
          <AvatarFace config={face} crop="face" label={event.speaker_name || event.speaker_role} />
        ) : tone === 'evidence' ? (
          <FileText className="w-5 h-5 text-[#C4B5FD]" />
        ) : (
          <User className="w-5 h-5 text-white/60" />
        )}
      </div>
      <div
        className={`min-w-0 flex-1 rounded-2xl border border-white/10 border-l-4 ${style.bar} px-4 py-3 ${
          mine ? 'bg-white/[0.09]' : 'bg-black/45'
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1 text-xs">
          <span className={`font-semibold ${style.name}`}>{event.speaker_name || event.speaker_role}</span>
          {style.chip && <span className="text-white/45 tracking-wide">{style.chip}</span>}
          {mine && <span className="rounded-full bg-[#FFD43B] text-black px-2 py-0.5 text-[10px] font-bold">YOU</span>}
          {isWitnessCall && <span className="text-white/60">called to the stand</span>}
          {isObjection && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E5484D] text-white px-2 py-0.5 text-[10px] font-bold">
              <AlertCircle className="w-3 h-3" />
              OBJECTION
            </span>
          )}
        </div>
        <p className="text-white/95 whitespace-pre-wrap break-words leading-relaxed">{event.content}</p>
      </div>
    </div>
  );
}

export default memo(TranscriptMessageBase);
