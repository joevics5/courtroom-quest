import { FileText, Image, Video, Mic, Users, Package, Database, FileCheck, MessageSquare, Clock } from 'lucide-react';
import type { Evidence } from '../types';
import ScreenShell from './ScreenShell';
import { PANEL, gameButton } from './ui';

interface EvidenceViewerProps {
  evidence: Evidence;
  onBack: () => void;
}

const getEvidenceIcon = (type: string) => {
  switch (type) {
    case 'documents': return FileText;
    case 'photographs': return Image;
    case 'video_recordings': return Video;
    case 'audio_recordings': return Mic;
    case 'witness_testimony': return Users;
    case 'physical_evidence': return Package;
    case 'digital_evidence': return Database;
    case 'expert_reports': return FileCheck;
    case 'confessions_statements': return MessageSquare;
    case 'timeline_logs': return Clock;
    default: return FileText;
  }
};

const formatEvidenceType = (type: string) => {
  return type.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

export default function EvidenceViewer({ evidence, onBack }: EvidenceViewerProps) {
  const Icon = getEvidenceIcon(evidence.evidence_type);
  const label = 'text-xs font-black tracking-widest text-[#FFD43B] mb-2';

  return (
    <ScreenShell title={evidence.exhibit_label || 'EVIDENCE'} subtitle="Back to the investigation with the arrow." onBack={onBack} maxWidth="max-w-3xl">
      <div className={`${PANEL} space-y-5`}>
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-[#FFD43B]/15 border border-[#FFD43B]/40 rounded-2xl flex-shrink-0">
            <Icon className="w-6 h-6 text-[#FFD43B]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-game text-3xl leading-tight text-white">{evidence.title}</h2>
            <span className="inline-block mt-1 text-xs font-bold text-white/60 uppercase tracking-wide">
              {formatEvidenceType(evidence.evidence_type)}
            </span>
            {evidence.description && <p className="text-white/75 mt-2">{evidence.description}</p>}
          </div>
        </div>

        {evidence.content && (
          <div className="rounded-2xl bg-white/[0.05] border border-white/15 p-4 sm:p-5">
            <h3 className={label}>EVIDENCE CONTENT</h3>
            <div className="text-white/90 whitespace-pre-wrap leading-relaxed">{evidence.content}</div>
          </div>
        )}

        {evidence.file_data && (
          <div className="rounded-2xl bg-white/[0.05] border border-white/15 p-4 sm:p-5">
            <h3 className={label}>FILE DATA</h3>
            <div className="text-white/85 text-sm break-all">{evidence.file_data}</div>
          </div>
        )}

        {evidence.file_url && (
          <div>
            <h3 className={label}>ATTACHMENT</h3>
            <a href={evidence.file_url} target="_blank" rel="noopener noreferrer" className={gameButton('gold', 'sm')}>
              <FileText className="w-4 h-4" />
              View File
            </a>
          </div>
        )}

        {evidence.tags && evidence.tags.length > 0 && (
          <div>
            <h3 className={label}>TAGS</h3>
            <div className="flex flex-wrap gap-2">
              {evidence.tags.map((tag, index) => (
                <span key={index} className="px-3 py-1 bg-white/10 border border-white/15 text-white/80 text-sm rounded-full">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {evidence.relevance && (
          <div>
            <h3 className={label}>RELEVANCE</h3>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold border ${
              evidence.relevance === 'favorable'
                ? 'bg-green-500/15 text-green-300 border-green-400/40'
                : evidence.relevance === 'risky'
                ? 'bg-red-500/15 text-red-300 border-red-400/40'
                : 'bg-white/10 text-white/70 border-white/20'
            }`}>
              {evidence.relevance.charAt(0).toUpperCase() + evidence.relevance.slice(1)}
            </span>
          </div>
        )}

        {evidence.discovered_at && (
          <p className="text-sm text-white/50 pt-4 border-t border-white/10">
            Discovered on {new Date(evidence.discovered_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </ScreenShell>
  );
}
