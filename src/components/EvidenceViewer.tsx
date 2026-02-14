import { ArrowLeft, FileText, Image, Video, Mic, Users, Package, Database, FileCheck, MessageSquare, Clock } from 'lucide-react';
import type { Evidence } from '../types';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Investigation
        </button>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="border-b border-slate-700 px-6 py-4 bg-slate-750">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-600 rounded-lg flex-shrink-0">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{evidence.title}</h2>
                    {evidence.exhibit_label && (
                      <span className="inline-block mt-1 text-sm font-semibold text-blue-400">
                        {evidence.exhibit_label}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-slate-400 capitalize">
                    {formatEvidenceType(evidence.evidence_type)}
                  </span>
                </div>
                {evidence.description && (
                  <p className="text-slate-300">{evidence.description}</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-6">
            {evidence.content && (
              <div className="bg-slate-750 rounded-lg p-6 border border-slate-600">
                <h3 className="text-sm font-semibold text-blue-400 mb-3">Evidence Content</h3>
                <div className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {evidence.content}
                </div>
              </div>
            )}

            {evidence.file_data && (
              <div className="mt-4 bg-slate-750 rounded-lg p-6 border border-slate-600">
                <h3 className="text-sm font-semibold text-blue-400 mb-3">File Data</h3>
                <div className="text-slate-200 text-sm break-all">
                  {evidence.file_data}
                </div>
              </div>
            )}

            {evidence.file_url && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-blue-400 mb-3">Attachment</h3>
                <a
                  href={evidence.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  View File
                </a>
              </div>
            )}

            {evidence.tags && evidence.tags.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-blue-400 mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {evidence.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-slate-700 text-slate-300 text-sm rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {evidence.relevance && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-blue-400 mb-3">Relevance</h3>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  evidence.relevance === 'favorable'
                    ? 'bg-green-500/10 text-green-400'
                    : evidence.relevance === 'risky'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {evidence.relevance.charAt(0).toUpperCase() + evidence.relevance.slice(1)}
                </span>
              </div>
            )}

            {evidence.discovered_at && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-400">
                  Discovered on {new Date(evidence.discovered_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
