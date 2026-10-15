import { FileText, Clock } from 'lucide-react';
import type { TrialEvent } from '../types';
import ModalSheet from './ModalSheet';
import { gameButton } from './ui';

interface TranscriptViewerProps {
  events: TrialEvent[];
  caseTitle: string;
  onClose: () => void;
}

const ROLE_COLORS: Record<string, string> = {
  judge: 'bg-purple-500/20 text-purple-200 border-purple-400/40',
  prosecution: 'bg-red-500/20 text-red-200 border-red-400/40',
  defense: 'bg-blue-500/20 text-blue-200 border-blue-400/40',
  witness: 'bg-yellow-500/20 text-yellow-200 border-yellow-400/40',
  jury: 'bg-green-500/20 text-green-200 border-green-400/40'
};

const ROLE_BAR: Record<string, string> = {
  judge: 'border-purple-400/60',
  prosecution: 'border-red-400/60',
  defense: 'border-blue-400/60',
  witness: 'border-yellow-400/60',
  jury: 'border-green-400/60'
};

export default function TranscriptViewer({ events, caseTitle, onClose }: TranscriptViewerProps) {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getSpeakerDisplayName = (event: TrialEvent) => {
    if (event.speaker_name) return event.speaker_name;
    switch (event.speaker_role) {
      case 'judge': return 'Judge';
      case 'prosecution': return 'Prosecution';
      case 'defense': return 'Defense';
      case 'witness': return 'Witness';
      case 'jury': return 'Jury';
      default: return 'Unknown';
    }
  };

  return (
    <ModalSheet
      title="Court Transcript"
      subtitle={caseTitle}
      icon={<FileText className="w-6 h-6 text-[#FFD43B]" />}
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-3 mb-5">
        {events.length === 0 ? (
          <div className="text-center py-12 text-white/50">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No transcript entries found.</p>
          </div>
        ) : (
          events.map((event, index) => (
            <div
              key={event.id || index}
              className={`rounded-2xl bg-white/[0.05] border border-white/10 border-l-4 ${ROLE_BAR[event.speaker_role] || 'border-white/30'} p-3 sm:p-4`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${ROLE_COLORS[event.speaker_role] || 'bg-white/10 text-white/70 border-white/20'}`}>
                    {getSpeakerDisplayName(event)}
                  </span>
                  {event.event_type && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/60 capitalize">
                      {event.event_type.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                {event.timestamp && (
                  <div className="flex items-center gap-1 text-xs text-white/40 flex-none">
                    <Clock className="w-3 h-3" />
                    {formatTimestamp(event.timestamp)}
                  </div>
                )}
              </div>
              <p className="text-white/90 whitespace-pre-wrap leading-relaxed">{event.content}</p>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-white/55 border-t border-white/10 pt-4">
        <span>Total entries: {events.length}</span>
        <button onClick={onClose} className={gameButton('ghost', 'sm')}>Close</button>
      </div>
    </ModalSheet>
  );
}
