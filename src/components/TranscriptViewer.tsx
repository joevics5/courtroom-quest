import { X, FileText, User, Clock } from 'lucide-react';
import type { TrialEvent } from '../types';

interface TranscriptViewerProps {
  events: TrialEvent[];
  caseTitle: string;
  onClose: () => void;
}

export default function TranscriptViewer({ events, caseTitle, onClose }: TranscriptViewerProps) {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getSpeakerDisplayName = (event: TrialEvent) => {
    if (event.speaker_name) {
      return event.speaker_name;
    }
    
    // Fallback to role-based names
    switch (event.speaker_role) {
      case 'judge':
        return 'Judge';
      case 'prosecution':
        return 'Prosecution';
      case 'defense':
        return 'Defense';
      case 'witness':
        return 'Witness';
      case 'jury':
        return 'Jury';
      default:
        return 'Unknown';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'judge':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'prosecution':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'defense':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'witness':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'jury':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-lg border border-slate-700 w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-400" />
            <div>
              <h2 className="text-2xl font-bold text-white">Court Transcript</h2>
              <p className="text-slate-400 text-sm mt-1">{caseTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transcript Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {events.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No transcript entries found.</p>
            </div>
          ) : (
            events.map((event, index) => (
              <div
                key={event.id || index}
                className="border-l-4 border-slate-600 pl-4 py-2 hover:bg-slate-800/50 rounded-r transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getRoleColor(event.speaker_role)}`}>
                      {getSpeakerDisplayName(event)}
                    </span>
                    {event.event_type && (
                      <span className="px-2 py-1 rounded text-xs bg-slate-700 text-slate-300">
                        {event.event_type.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  {event.timestamp && (
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(event.timestamp)}
                    </div>
                  )}
                </div>
                <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {event.content}
                </p>
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <details className="mt-2 text-xs text-slate-500">
                    <summary className="cursor-pointer hover:text-slate-400">Metadata</summary>
                    <pre className="mt-2 p-2 bg-slate-900 rounded text-slate-400 overflow-x-auto">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/50">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>Total entries: {events.length}</span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

