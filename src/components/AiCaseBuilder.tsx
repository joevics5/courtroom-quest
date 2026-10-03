import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileText, Loader2, RefreshCw, Save, Sparkles, Upload, X } from 'lucide-react';
import ScreenShell from './ScreenShell';
import OpposingPlaybook from './caseCreator/OpposingPlaybook';
import { Fields, ListEditor } from './caseCreator/JsonFields';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DOC_BUCKET, docPath, validatePdf } from '../lib/caseDocument';
import { BLANKS, BLANK_EVIDENCE, BLANK_WITNESS } from '../lib/caseCreator/blank';
import { EMPTY_ANALYSIS, draftToCore, generateAnalysis, generateCore, toDraft } from '../lib/caseCreator/api';
import { buildPlaybook, sideLabel } from '../lib/caseCreator/playbook';
import type { Side } from '../lib/caseCreator/playbook';
import { saveDraft } from '../lib/caseCreator/save';
import { validateDraft } from '../lib/caseCreator/validate';
import type { Draft, DraftEvidence, DraftWitness, GenerateOptions } from '../lib/caseCreator/types';

interface Props {
  onComplete: (caseId: string) => void;
  onCancel: () => void;
  /** Switch to the manual form instead */
  onManual: () => void;
}

type Tab = 'playbook' | 'case' | 'witnesses' | 'evidence' | 'analysis';
const TABS: { id: Tab; label: string }[] = [
  { id: 'playbook', label: 'Opposing playbook' },
  { id: 'case', label: 'Case' },
  { id: 'witnesses', label: 'Witnesses' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'analysis', label: 'Analysis' },
];

const field = 'w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FFD43B]';
const primary = 'flex items-center justify-center gap-2 px-5 py-3 bg-[#FFD43B] hover:bg-[#ffdc5e] text-black font-bold rounded-lg disabled:bg-slate-700 disabled:text-slate-500 transition-colors';
const MAX_NOTES = 40_000;

const nestedBlank = (path: string) => {
  if (path.endsWith('secret.knowledge')) return BLANKS.knowledge();
  if (path.endsWith('secret.witnesses')) return BLANKS['secret.witnesses']();
  return null;
};

const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function AiCaseBuilder({ onComplete, onCancel, onManual }: Props) {
  const { user } = useAuth();
  const [side, setSide] = useState<Side | ''>('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [jurisdiction, setJurisdiction] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [docStoragePath, setDocStoragePath] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<Tab>('playbook');
  const [busy, setBusy] = useState<null | 'upload' | 'core' | 'analysis' | 'save'>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [needsAnalysis, setNeedsAnalysis] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const options = (): GenerateOptions => ({
    jurisdiction, case_type: '', difficulty, duration: '', special: '', user_side: side || undefined,
  });
  const notesOk = notes.trim().length >= 80;
  const canGenerate = !!side && (!!file || !!docStoragePath || notesOk) && notes.length <= MAX_NOTES && busy === null;

  const check = useMemo(() => (draft ? validateDraft(draft, { practice: true }) : { errors: [], warnings: [] }), [draft]);
  const playbook = useMemo(() => (draft && side ? buildPlaybook(draft, side) : null), [draft, side]);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const removeUpload = async (path: string | null) => {
    if (path) await supabase.storage.from(DOC_BUCKET).remove([path]).catch(() => undefined);
  };

  const pickFile = async (f: File | null) => {
    setFileError(null);
    if (!f) return;
    const problem = await validatePdf(f);
    if (problem) { setFileError(problem); return; }
    await removeUpload(docStoragePath);
    setDocStoragePath(null);
    setFile(f);
  };

  const clearFile = async () => {
    await removeUpload(docStoragePath);
    setDocStoragePath(null);
    setFile(null);
    setFileError(null);
  };

  const runAnalysis = async (base: Draft, path: string | null) => {
    setBusy('analysis');
    setError(null);
    try {
      const res = await generateAnalysis(base.source_story, options(), draftToCore(base), undefined, { document: path ? { path } : undefined });
      setWarnings((w) => [...w, ...res.warnings]);
      setDraft(toDraft(base.source_story, draftToCore(base), res.data));
      setNeedsAnalysis(false);
      if (path) setDocStoragePath(null); // the server deletes the file after this stage
    } catch (e) {
      setError(`Evidence and analysis failed: ${e instanceof Error ? e.message : String(e)}. Your case and witnesses are kept; use "Retry".`);
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    if (!user || !side) return;
    setError(null);
    setWarnings([]);
    let path = docStoragePath;
    try {
      if (file && !path) {
        setBusy('upload');
        path = docPath(user.id, uid());
        const { error: upErr } = await supabase.storage.from(DOC_BUCKET).upload(path, file, { contentType: 'application/pdf' });
        if (upErr) throw new Error(`Uploading the PDF failed: ${upErr.message}`);
        setDocStoragePath(path);
      }
      setBusy('core');
      const story = notes.trim();
      const res = await generateCore(story, options(), undefined, { document: path ? { path } : undefined });
      setWarnings(res.warnings);
      const label = file ? `Uploaded file: ${file.name}` : '';
      const base = toDraft([story, label].filter(Boolean).join('\n\n') || label, res.data, EMPTY_ANALYSIS);
      setDraft(base);
      setNeedsAnalysis(true);
      setTab('playbook');
      await runAnalysis(base, path);
    } catch (e) {
      setError(`Case generation failed: ${e instanceof Error ? e.message : String(e)}`);
      setBusy(null);
    }
  };

  const save = async () => {
    if (!draft || check.errors.length) return;
    setBusy('save');
    setError(null);
    try {
      const res = await saveDraft(draft, { asCustom: true });
      onComplete(res.caseId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  const discard = async () => {
    if (draft && !window.confirm('Discard this parsed case?')) return;
    await removeUpload(docStoragePath);
    setDraft(null);
    setDocStoragePath(null);
    setNeedsAnalysis(false);
    setError(null);
    setWarnings([]);
  };

  const back = async () => {
    if (draft && !window.confirm('Discard this parsed case and leave?')) return;
    await removeUpload(docStoragePath);
    onCancel();
  };

  const working = busy === 'upload' || busy === 'core' || busy === 'analysis';

  return (
    <ScreenShell title="AI CASE BUILDER" onBack={back} maxWidth="max-w-4xl">
      <div className="rounded-2xl bg-black/55 border border-white/15 backdrop-blur-sm p-5 space-y-5">
        {!draft && (
          <>
            <p className="text-sm text-slate-300">
              Give the AI your case file. It builds a playable case from it and works out where opposing counsel is likely to attack,
              so you can rehearse before the real thing. You review and edit everything before it is saved.
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Which side will you argue?</label>
              <div className="grid grid-cols-2 gap-3">
                {(['defence', 'prosecution'] as Side[]).map((s) => (
                  <button
                    key={s} type="button" onClick={() => setSide(s)} disabled={working} aria-pressed={side === s}
                    className={`py-3 rounded-lg font-semibold border transition-colors ${side === s ? 'bg-[#FFD43B] text-black border-[#FFD43B]' : 'bg-black/40 text-slate-200 border-white/20 hover:border-white/40'}`}
                  >
                    {sideLabel(s)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Case file (PDF)</label>
              <input
                ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden"
                onChange={(e) => { void pickFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
              />
              {file ? (
                <div className="flex items-center gap-3 rounded-lg border border-white/20 bg-black/40 px-3 py-2">
                  <FileText className="w-5 h-5 text-[#FFD43B] shrink-0" />
                  <span className="text-sm text-white truncate flex-1">{file.name}</span>
                  <span className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button onClick={() => void clearFile()} disabled={working} aria-label="Remove PDF" className="text-slate-300 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button
                  type="button" onClick={() => fileInput.current?.click()} disabled={working}
                  className="w-full flex items-center justify-center gap-2 py-6 rounded-lg border-2 border-dashed border-white/25 text-slate-300 hover:border-[#FFD43B] hover:text-white transition-colors"
                >
                  <Upload className="w-5 h-5" /> Choose a PDF (max 10 MB)
                </button>
              )}
              {fileError && <p role="alert" className="text-sm text-red-300 mt-2">{fileError}</p>}
              <p className="text-xs text-slate-400 mt-2">
                The PDF is sent to Google's Gemini model to be read, and deleted from our storage as soon as parsing finishes. Redact client names and
                anything privileged before uploading; you are responsible for confidentiality obligations.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{file ? 'Extra notes (optional)' : 'Or paste your notes'}</label>
              <textarea
                value={notes} onChange={(e) => setNotes(e.target.value)} rows={file ? 4 : 9} maxLength={MAX_NOTES}
                placeholder={file ? 'Anything the PDF does not say: your theory, concerns, what you expect the other side to argue...' : 'Paste the facts, statements, exhibits and dates. The more detail, the better.'}
                className={field}
              />
              {!file && notes.trim().length > 0 && !notesOk && <p className="text-xs text-amber-300 mt-1">Add a little more detail (at least a few sentences).</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="Jurisdiction (optional)" className={field} />
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={field}>
                <option value="">Difficulty: let the AI decide</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={generate} disabled={!canGenerate} className={`${primary} flex-1`}>
                {working ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {busy === 'upload' ? 'Uploading PDF...' : busy === 'core' ? 'Step 1/2: reading the file...' : busy === 'analysis' ? 'Step 2/2: evidence and attacks...' : 'Parse with AI'}
              </button>
              <button onClick={onManual} disabled={working} className="px-5 py-3 text-slate-300 hover:text-white">Fill in manually instead</button>
            </div>
            {working && <p className="text-xs text-slate-400">Each step can take a minute or two. Keep this screen open.</p>}
            {!side && <p className="text-xs text-slate-400">Pick a side first. The opposing playbook is built against it.</p>}
          </>
        )}

        {error && (
          <div role="alert" className="flex gap-2 rounded-lg border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}

        {draft && (
          <div className="space-y-4">
            {needsAnalysis && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-100">
                <span>{busy === 'analysis' ? 'Building evidence and analysis...' : 'Evidence and analysis are not ready yet.'}</span>
                <button onClick={() => void runAnalysis(draft, docStoragePath)} disabled={busy !== null} className="flex items-center gap-1 px-3 py-1.5 bg-[#FFD43B] text-black font-semibold rounded disabled:opacity-50 shrink-0">
                  {busy === 'analysis' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Retry
                </button>
              </div>
            )}

            {(check.errors.length > 0 || check.warnings.length > 0 || warnings.length > 0) && (
              <details className="rounded-lg border border-white/15 bg-black/30" open={check.errors.length > 0}>
                <summary className="px-4 py-2 text-sm cursor-pointer text-slate-200">
                  <span className="text-red-300">{check.errors.length} problem(s)</span> · <span className="text-amber-300">{check.warnings.length + warnings.length} note(s)</span>
                </summary>
                <ul className="px-4 pb-3 text-xs space-y-1">
                  {check.errors.map((m, i) => <li key={`e${i}`} className="text-red-300">• {m}</li>)}
                  {check.warnings.map((m, i) => <li key={`w${i}`} className="text-amber-300">• {m}</li>)}
                  {warnings.map((m, i) => <li key={`s${i}`} className="text-slate-400">• AI note: {m}</li>)}
                </ul>
              </details>
            )}

            <div className="flex flex-wrap gap-1 border-b border-white/15">
              {TABS.map((t) => (
                <button
                  key={t.id} onClick={() => setTab(t.id)}
                  className={`px-3 py-2 text-sm rounded-t ${tab === t.id ? 'bg-white/10 text-white border border-b-0 border-white/20' : 'text-slate-400 hover:text-white'}`}
                >
                  {t.label}
                  {t.id === 'witnesses' && <span className="ml-1 text-xs text-slate-500">{draft.witnesses.length}</span>}
                  {t.id === 'evidence' && <span className="ml-1 text-xs text-slate-500">{draft.evidence.length}</span>}
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-white/15 bg-black/30 p-4 space-y-5">
              {tab === 'playbook' && playbook && <OpposingPlaybook playbook={playbook} />}
              {tab === 'case' && (
                <>
                  <Fields value={draft.case} onChange={(v) => set('case', v)} path="case" />
                  <details className="rounded-lg border border-white/15 p-3">
                    <summary className="cursor-pointer text-[#FFD43B] text-sm font-semibold">Case truth and theories (private)</summary>
                    <div className="mt-3 space-y-4">
                      <Fields value={draft.truth} onChange={(v) => set('truth', v)} path="truth" />
                      <Fields value={draft.theories} onChange={(v) => set('theories', v)} path="theories" />
                    </div>
                  </details>
                  <ListEditor label="Facts" items={draft.facts} onChange={(v) => set('facts', v)} blank={() => ({ ...BLANKS.facts(), id: `F${draft.facts.length + 1}` })} />
                  <ListEditor label="Timeline" items={draft.timeline} onChange={(v) => set('timeline', v)} blank={BLANKS.timeline} />
                </>
              )}
              {tab === 'witnesses' && (
                <ListEditor
                  label="Witnesses" items={draft.witnesses} onChange={(v) => set('witnesses', v)}
                  blank={() => BLANK_WITNESS(draft.witnesses.length + 1)} rootBlank={nestedBlank} path="witnesses"
                  title={(w: DraftWitness) => `${w.code} · ${w.name || 'Unnamed'}${w.role ? ` — ${w.role}` : ''}`}
                />
              )}
              {tab === 'evidence' && (
                <ListEditor
                  label="Evidence" items={draft.evidence} onChange={(v) => set('evidence', v)}
                  blank={() => BLANK_EVIDENCE(draft.evidence.length + 1)} rootBlank={nestedBlank} path="evidence"
                  title={(e: DraftEvidence) => `${e.code} · ${e.title || 'Untitled'}${e.is_hidden ? ' (hidden)' : ''}`}
                />
              )}
              {tab === 'analysis' && (
                <>
                  <ListEditor label="Loopholes" items={draft.loopholes} onChange={(v) => set('loopholes', v)} blank={BLANKS.loopholes} />
                  <ListEditor label="Contradictions" items={draft.contradictions} onChange={(v) => set('contradictions', v)} blank={BLANKS.contradictions} />
                  <ListEditor label="Red herrings" items={draft.red_herrings} onChange={(v) => set('red_herrings', v)} blank={BLANKS.red_herrings} />
                  <ListEditor label="Legal issues" items={draft.legal_issues} onChange={(v) => set('legal_issues', v)} blank={BLANKS.legal_issues} />
                  <ListEditor label="Objections" items={draft.objections} onChange={(v) => set('objections', v)} blank={BLANKS.objections} />
                  <ListEditor label="Verdict issues" items={draft.verdict_issues} onChange={(v) => set('verdict_issues', v)} blank={BLANKS.verdict_issues} />
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={save} disabled={busy !== null || check.errors.length > 0 || needsAnalysis} className={primary}>
                {busy === 'save' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Save case and begin
              </button>
              <button onClick={() => void discard()} disabled={busy !== null} className="px-4 py-3 text-slate-300 hover:text-white">Discard</button>
              <span className="text-xs text-slate-400">Saved as your own case. Only you can see the private analysis.</span>
            </div>
          </div>
        )}
      </div>
    </ScreenShell>
  );
}
