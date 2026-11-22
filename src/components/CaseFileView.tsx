import { useTranslation } from 'react-i18next';
import { ArrowLeft, Eye, FileText, User } from 'lucide-react';
import type { Case, Evidence, Witness } from '../types';
import { parseFileUrls, isImageUrl } from '../lib/caseImages';

/** Everything the witness and evidence pop-ups need to show the case file inside the trial. */
export interface CaseFileData {
  caseData: Case | null;
  witnesses: Witness[];
  evidence: Evidence[];
  witnessesCalled: string[];
  evidenceSubmitted: string[];
}

export type DetailTarget =
  | { kind: 'witness'; item: Witness }
  | { kind: 'evidence'; item: Evidence };

const HEADING = 'text-[11px] font-black tracking-widest text-[#FFD43B] mb-1';
const BOX = 'rounded-2xl bg-white/5 border border-white/15 p-3';

const formatType = (type: string) => type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** A small eye button that sits beside a witness or evidence row. */
export function EyeButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex-none flex items-center justify-center w-11 h-11 rounded-xl bg-white/10 border border-white/15 text-white/80 hover:text-white active:bg-white/20 touch-manipulation"
    >
      <Eye className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}

/** Two quiet tabs at the top of the pop-up: the usual list, and the case file. */
export function SelectorTabs({ tab, onChange, selectLabel }: { tab: 'select' | 'file'; onChange: (t: 'select' | 'file') => void; selectLabel: string }) {
  const { t } = useTranslation();
  const base = 'flex-1 h-9 rounded-full text-xs font-bold transition-colors touch-manipulation';
  return (
    <div role="tablist" className="flex gap-2 mb-4 p-1 rounded-full bg-white/5 border border-white/10">
      <button role="tab" aria-selected={tab === 'select'} onClick={() => onChange('select')} className={`${base} ${tab === 'select' ? 'bg-[#FFD43B] text-black' : 'text-white/70'}`}>
        {selectLabel}
      </button>
      <button role="tab" aria-selected={tab === 'file'} onClick={() => onChange('file')} className={`${base} ${tab === 'file' ? 'bg-[#FFD43B] text-black' : 'text-white/70'}`}>
        {t('casefile.details')}
      </button>
    </div>
  );
}

/** One witness or one piece of evidence in full, with a way back to the list. */
export function ItemDetail({ target, onBack }: { target: DetailTarget; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 mb-3 text-sm font-bold text-white/70 active:text-white touch-manipulation">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> {t('casefile.back')}
      </button>
      {target.kind === 'witness' ? <WitnessDetail witness={target.item} /> : <EvidenceDetail evidence={target.item} />}
    </div>
  );
}

function WitnessDetail({ witness }: { witness: Witness }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <div>
        <h3 className="font-game text-3xl leading-tight text-white">{witness.name}</h3>
        <p className="text-sm text-[#FFD43B]/80">{witness.role}</p>
      </div>
      {witness.background && (
        <div className={BOX}>
          <h4 className={HEADING}>{t('casefile.background')}</h4>
          <p className="text-sm text-white/80 leading-relaxed">{witness.background}</p>
        </div>
      )}
      {witness.base_testimony && (
        <div className="rounded-2xl bg-[#FFD43B]/10 border border-[#F2B705]/40 p-3">
          <h4 className={HEADING}>{t('casefile.writtenTestimony')}</h4>
          <p className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed">{witness.base_testimony}</p>
        </div>
      )}
    </div>
  );
}

function EvidenceDetail({ evidence }: { evidence: Evidence }) {
  const { t } = useTranslation();
  const urls = parseFileUrls(evidence.file_url);
  const images = urls.filter(isImageUrl);
  const files = urls.filter(u => !isImageUrl(u));
  return (
    <div className="space-y-2">
      <div>
        <h3 className="font-game text-3xl leading-tight text-white">
          {evidence.exhibit_label ? `${evidence.exhibit_label}: ` : ''}{evidence.title}
        </h3>
        <p className="text-xs font-bold uppercase tracking-wide text-white/55">{formatType(evidence.evidence_type)}</p>
      </div>
      {evidence.description && <p className="text-sm text-white/75 leading-relaxed">{evidence.description}</p>}
      {evidence.content && (
        <div className={BOX}>
          <h4 className={HEADING}>{t('casefile.evidenceContent')}</h4>
          <div className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{evidence.content}</div>
        </div>
      )}
      {evidence.file_data && (
        <div className={BOX}>
          <h4 className={HEADING}>{t('casefile.fileData')}</h4>
          <div className="text-sm text-white/85 break-all">{evidence.file_data}</div>
        </div>
      )}
      {images.map(url => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
          <img src={url} alt={evidence.title} loading="lazy" className="w-full max-h-[40vh] object-contain rounded-2xl border border-white/15 bg-black/30" />
        </a>
      ))}
      {files.map((url, i) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#FFD43B] underline">
          <FileText className="w-4 h-4" aria-hidden="true" /> {files.length > 1 ? t('casefile.viewFileN', { n: i + 1 }) : t('casefile.viewFile')}
        </a>
      ))}
    </div>
  );
}

/** The "Case details" tab: the case summary, then every witness and exhibit, each with an eye button. */
export function CaseFilePanel({ file, onView }: { file: CaseFileData; onView: (t: DetailTarget) => void }) {
  const { t } = useTranslation();
  const { caseData, witnesses, evidence, witnessesCalled, evidenceSubmitted } = file;
  const relief = caseData?.requested_relief;
  const reliefLines = [relief?.primary, relief?.financial, relief?.penalty, ...(relief?.additional ?? [])].filter(Boolean) as string[];

  return (
    <div className="space-y-3">
      {caseData && (
        <div className={BOX}>
          <h4 className={HEADING}>{t('casefile.theCase')}</h4>
          <p className="font-semibold text-white">{caseData.title}</p>
          {caseData.versus && <p className="text-xs text-white/55 mb-1">{caseData.versus}</p>}
          {caseData.description && <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{caseData.description}</p>}
        </div>
      )}
      {reliefLines.length > 0 && (
        <div className={BOX}>
          <h4 className={HEADING}>{t('casefile.relief')}</h4>
          <ul className="list-disc pl-4 space-y-0.5 text-sm text-white/80">
            {reliefLines.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      )}

      {witnesses.length > 0 && (
        <div>
          <h4 className={HEADING}>{t('casefile.witnesses')}</h4>
          <div className="space-y-2">
            {witnesses.map(w => (
              <div key={w.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0 rounded-2xl bg-white/[0.04] border border-white/10 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-white"><User className="w-3.5 h-3.5 text-[#FFD43B]" aria-hidden="true" />{w.name}</div>
                  <div className="text-xs text-white/55">{w.role}{witnessesCalled.includes(w.id) ? ' · called' : ''}</div>
                </div>
                <EyeButton label={t('casefile.viewItem', { name: w.name })} onClick={() => onView({ kind: 'witness', item: w })} />
              </div>
            ))}
          </div>
        </div>
      )}

      {evidence.length > 0 && (
        <div>
          <h4 className={HEADING}>{t('casefile.evidence')}</h4>
          <div className="space-y-2">
            {evidence.map(e => (
              <div key={e.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0 rounded-2xl bg-white/[0.04] border border-white/10 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-white"><FileText className="w-3.5 h-3.5 text-[#FFD43B]" aria-hidden="true" /><span className="truncate">{e.exhibit_label ? `${e.exhibit_label}: ` : ''}{e.title}</span></div>
                  <div className="text-xs text-white/55">{formatType(e.evidence_type)}{evidenceSubmitted.includes(e.id) ? ' · submitted' : ''}</div>
                </div>
                <EyeButton label={t('casefile.viewItem', { name: e.title })} onClick={() => onView({ kind: 'evidence', item: e })} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
