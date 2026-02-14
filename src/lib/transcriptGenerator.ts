import type { TrialEvent } from '../types';

/**
 * Generate a readable transcript from trial events
 */
export function generateTranscript(events: TrialEvent[]): string {
  if (events.length === 0) {
    return 'No transcript entries yet.';
  }

  // Sort by event_order or timestamp
  const sortedEvents = [...events].sort((a, b) => {
    if (a.event_order !== undefined && b.event_order !== undefined) {
      return a.event_order - b.event_order;
    }
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  return sortedEvents
    .map(event => formatTranscriptEntry(event))
    .join('\n\n');
}

function formatTranscriptEntry(event: TrialEvent): string {
  const timestamp = new Date(event.timestamp).toLocaleTimeString();
  const speaker = event.speaker_name || event.speaker_role;
  
  // Format based on event type
  switch (event.event_type) {
    case 'opening':
    case 'closing':
      return `[${timestamp}] ${speaker.toUpperCase()}: ${event.content}`;
    
    case 'witness_examination':
      return `[${timestamp}] ${speaker.toUpperCase()}: ${event.content}`;
    
    case 'objection':
      return `[${timestamp}] ${speaker.toUpperCase()} - OBJECTION: ${event.content}`;
    
    case 'ruling':
      return `[${timestamp}] JUDGE - RULING: ${event.content}`;
    
    case 'evidence_submission':
      const evidenceInfo = event.metadata?.evidence_title || event.metadata?.exhibit_label || 'Evidence';
      return `[${timestamp}] ${speaker.toUpperCase()} submits ${evidenceInfo} to the court.\n${event.content || ''}`;
    
    case 'witness_call':
      return `[${timestamp}] ${speaker.toUpperCase()} calls ${event.content} to the stand.`;
    
    default:
      return `[${timestamp}] ${speaker.toUpperCase()}: ${event.content}`;
  }
}

/**
 * Generate a summary of the transcript for AI context
 */
export function generateTranscriptSummary(events: TrialEvent[], maxLength: number = 2000): string {
  const transcript = generateTranscript(events);
  
  if (transcript.length <= maxLength) {
    return transcript;
  }

  // Take the most recent events that fit
  const sortedEvents = [...events].sort((a, b) => {
    if (a.event_order !== undefined && b.event_order !== undefined) {
      return b.event_order - a.event_order;
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  let summary = '';
  for (const event of sortedEvents) {
    const entry = formatTranscriptEntry(event);
    if ((summary + entry).length > maxLength) {
      break;
    }
    summary = entry + '\n\n' + summary;
  }

  return summary || 'No recent activity.';
}

/**
 * Extract evidence citations from transcript
 */
export function extractEvidenceCitations(events: TrialEvent[]): string[] {
  const citations: string[] = [];
  
  for (const event of events) {
    if (event.event_type === 'evidence_submission') {
      const exhibitLabel = event.metadata?.exhibit_label || event.metadata?.evidence_title;
      if (exhibitLabel && !citations.includes(exhibitLabel)) {
        citations.push(exhibitLabel);
      }
    }
  }

  return citations;
}





