import { FileText, Image, Video, Mic, Users, Package, Database, FileCheck, MessageSquare, Clock } from 'lucide-react';

/** Icon for an evidence type (documents, photographs, recordings…). */
export function getEvidenceIcon(type: string) {
  switch (type) {
    case 'documents': return FileText;
    case 'photographs':
    case 'images': return Image;
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
}

/** "physical_evidence" -> "Physical Evidence" */
export function formatEvidenceType(type: string): string {
  return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
