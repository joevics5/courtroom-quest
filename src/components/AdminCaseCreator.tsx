import { useMemo, useState } from 'react';
import { ArrowLeft, Sparkles, Save, Loader2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Fields, ListEditor } from './caseCreator/JsonFields';
import { BLANKS, BLANK_EVIDENCE, BLANK_WITNESS } from '../lib/caseCreator/blank';
import { EMPTY_ANALYSIS, draftToCore, generateAnalysis, generateCore, toDraft } from '../lib/caseCreator/api';
import { validateDraft } from '../lib/caseCreator/validate';
import { saveDraft } from '../lib/caseCreator/save';
import type { Draft, GenerateOptions } from '../lib/caseCreator/types';

interface Props {
  onBack: () => void;
  onSaved?: (caseId: string) => void;
}

type Tab = 'case' | 'facts' | 'witnesses' | 'evidence' | 'analysis';
const TABS: { id: Tab; label: string }[] = [
  { id: 'case', label: 'Case & Theories' },
  { id: 'facts', label: 'Facts & Timeline' },
  { id: 'witnesses', label: 'Witnesses' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'analysis', label: 'Loopholes & More' },
];

const selectCls = 'w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-sm text-white focus:outline-none focus:border-amber-500';

// Resolves the "Add" template for nested lists the generic editor meets inside witness/evidence cards.
const nestedBlank = (path: string) => {
  if (path.endsWith('secret.knowledge')) return BLANKS.knowledge();
  if (path.endsWith('secret.witnesses')) return BLANKS['secret.witnesses']();
  return null;
};

export default function AdminCaseCreator({ onBack, onSaved }: Props) {
  const [story, setStory] = useState('');
  const [opts, setOpts] = useState<GenerateOptions>({ jurisdiction: '', case_type: '', difficulty: '', duration: '', special: '' });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<Tab>('case');
  const [busy, setBusy] = useState<null | 'core' | 'analysis' | 'save'>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverWarnings, setServerWarnings] = useState<string[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);

  const check = useMemo(() => (draft ? validateDraft(draft) : { errors: [], warnings: [] }), [draft]);
  const analysisMissing = !!draft && draft.evidence.length === 0;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const runAnalysis = async (base: Draft) => {
    setBusy('analysis');
    setError(null);
    try {
      const res = await generateAnalysis(base.source_story, opts, draftToCore(base));
      setServerWarnings((w) => [...w, ...res.warnings]);
      setDraft(toDraft(base.source_story, draftToCore(base), res.data));
    } catch (e) {
      setError(`Evidence & analysis failed: ${e instanceof Error ? e.message : String(e)}. Your case and witnesses are kept; use "Retry evidence & analysis".`);
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    setError(null);
    setServerWarnings([]);
    setSavedId(null);
    setBusy('core');
    let base: Draft;
    try {
      const res = await generateCore(story, opts);
      setServerWarnings(res.warnings);
      base = toDraft(story, res.data, EMPTY_ANALYSIS);
      setDraft(base);
      setTab('case');
    } catch (e) {
      setError(`Case generation failed: ${e instanceof Error ? e.message : String(e)}`);
      setBusy(null);
      return;
    }
    await runAnalysis(base);
  };

  const save = async () => {
    if (!draft) return;
    if (check.errors.length) { setError('Fix the errors listed above before saving.'); return; }
    setBusy('save');
    setError(null);
    try {
      const id = await saveDraft(draft);
      setSavedId(id);
      onSaved?.(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const reset = () => { setDraft(null); setStory(''); setSavedId(null); setError(null); setServerWarnings([]); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Admin Panel
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 bg-amber-600 rounded-full flex items-center justify-center"><Sparkles className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Case Creator</h1>
            <p className="text-slate-400 text-sm">Paste a story, review every field, then save to the database.</p>
          </div>
        </div>

        {/* INPUT */}
        {!draft && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6 space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Case story</label>
              <textarea
                value={story} onChange={(e) => setStory(e.target.value)} rows={12}
                placeholder="Paste the story or scenario. The more detail on people, money, places and times, the better the case."
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <p className="text-xs text-slate-500 mt-1">{story.length.toLocaleString()} / 40,000 characters</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={opts.jurisdiction} onChange={(e) => setOpts({ ...opts, jurisdiction: e.target.value })}
                placeholder="Jurisdiction (fictional / Nigeria / USA / UK ...)" className={selectCls}
              />
              <select value={opts.case_type} onChange={(e) => setOpts({ ...opts, case_type: e.target.value })} className={selectCls}>
                <option value="">Case type: let AI decide</option>
                {['criminal', 'civil', 'burglary', 'fraud', 'assault', 'murder', 'theft', 'other'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={opts.difficulty} onChange={(e) => setOpts({ ...opts, difficulty: e.target.value })} className={selectCls}>
                <option value="">Difficulty: let AI decide</option>
                {['easy', 'medium', 'hard'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={opts.duration} onChange={(e) => setOpts({ ...opts, duration: e.target.value })} className={selectCls}>
                <option value="">Trial length: let AI decide</option>
                {['10 minutes', '30 minutes', '60 minutes'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <textarea
              value={opts.special} onChange={(e) => setOpts({ ...opts, special: e.target.value })} rows={2}
              placeholder="Special requirements (optional), e.g. 'one witness must lie', 'bench trial only', 'keep it to 5 witnesses'"
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={generate} disabled={busy !== null || story.trim().length < 80}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-medium"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {busy === 'core' ? 'Step 1/2: building case & witnesses…' : busy === 'analysis' ? 'Step 2/2: building evidence…' : 'Generate case'}
            </button>
            {busy && <p className="text-xs text-slate-400">Each step can take up to a couple of minutes. Keep this page open.</p>}
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-700 text-red-200 rounded-lg p-3 text-sm flex gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}

        {/* SAVED */}
        {savedId && (
          <div className="mt-4 bg-green-900/30 border border-green-700 text-green-200 rounded-lg p-4 text-sm">
            <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="w-4 h-4" /> Case saved as a preset case.</div>
            <div className="mt-3 flex gap-2">
              <button onClick={reset} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded">Create another</button>
              <button onClick={onBack} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded">Back to Admin Panel</button>
            </div>
          </div>
        )}

        {/* REVIEW */}
        {draft && !savedId && (
          <div className="mt-4 space-y-4">
            {analysisMissing && (
              <div className="bg-amber-900/30 border border-amber-700 text-amber-100 rounded-lg p-3 text-sm flex items-center justify-between gap-3">
                <span>{busy === 'analysis' ? 'Building evidence & analysis…' : 'Evidence & analysis have not been generated yet.'}</span>
                <button
                  onClick={() => runAnalysis(draft)} disabled={busy !== null}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded shrink-0"
                >
                  {busy === 'analysis' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Retry evidence & analysis
                </button>
              </div>
            )}

            {(check.errors.length > 0 || check.warnings.length > 0 || serverWarnings.length > 0) && (
              <details className="bg-slate-800 border border-slate-700 rounded-lg" open={check.errors.length > 0}>
                <summary className="px-4 py-2 text-sm cursor-pointer text-slate-200">
                  <span className="text-red-400">{check.errors.length} error(s)</span> · <span className="text-amber-400">{check.warnings.length + serverWarnings.length} warning(s)</span>
                </summary>
                <ul className="px-4 pb-3 text-xs space-y-1">
                  {check.errors.map((m, i) => <li key={`e${i}`} className="text-red-300">• {m}</li>)}
                  {check.warnings.map((m, i) => <li key={`w${i}`} className="text-amber-300">• {m}</li>)}
                  {serverWarnings.map((m, i) => <li key={`s${i}`} className="text-slate-400">• Generator note: {m}</li>)}
                </ul>
              </details>
            )}

            <div className="flex flex-wrap gap-1 border-b border-slate-700">
              {TABS.map((t) => (
                <button
                  key={t.id} onClick={() => setTab(t.id)}
                  className={`px-3 py-2 text-sm rounded-t ${tab === t.id ? 'bg-slate-800 text-white border border-b-0 border-slate-700' : 'text-slate-400 hover:text-white'}`}
                >
                  {t.label}
                  {t.id === 'witnesses' && <span className="ml-1 text-xs text-slate-500">{draft.witnesses.length}</span>}
                  {t.id === 'evidence' && <span className="ml-1 text-xs text-slate-500">{draft.evidence.length}</span>}
                </button>
              ))}
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-5">
              {tab === 'case' && (
                <>
                  <Fields value={draft.case} onChange={(v) => set('case', v)} path="case" />
                  <details className="border border-amber-700/50 bg-amber-900/10 rounded-lg p-3">
                    <summary className="cursor-pointer text-amber-400 text-sm font-semibold">Case truth (admin-only)</summary>
                    <div className="mt-3"><Fields value={draft.truth} onChange={(v) => set('truth', v)} path="truth" /></div>
                  </details>
                  <details className="border border-amber-700/50 bg-amber-900/10 rounded-lg p-3">
                    <summary className="cursor-pointer text-amber-400 text-sm font-semibold">Prosecution / defence / alternative theories (admin-only)</summary>
                    <div className="mt-3"><Fields value={draft.theories} onChange={(v) => set('theories', v)} path="theories" /></div>
                  </details>
                </>
              )}

              {tab === 'facts' && (
                <>
                  <ListEditor label="Facts (every witness knowledge entry points at these ids)" items={draft.facts} onChange={(v) => set('facts', v)} blank={() => ({ ...BLANKS.facts(), id: `F${draft.facts.length + 1}` })} />
                  <ListEditor label="Timeline" items={draft.timeline} onChange={(v) => set('timeline', v)} blank={BLANKS.timeline} />
                </>
              )}

              {tab === 'witnesses' && (
                <ListEditor
                  label="Witnesses" items={draft.witnesses} onChange={(v) => set('witnesses', v)}
                  blank={() => BLANK_WITNESS(draft.witnesses.length + 1)} rootBlank={nestedBlank} path="witnesses"
                  title={(w: any) => `${w.code} · ${w.name || 'Unnamed'}${w.role ? ` — ${w.role}` : ''}`}
                />
              )}

              {tab === 'evidence' && (
                <>
                  <ListEditor
                    label="Evidence" items={draft.evidence} onChange={(v) => set('evidence', v)}
                    blank={() => BLANK_EVIDENCE(draft.evidence.length + 1)} rootBlank={nestedBlank} path="evidence"
                    title={(e: any) => `${e.code} · ${e.title || 'Untitled'}${e.is_hidden ? ' (hidden)' : ''}`}
                  />
                  {!analysisMissing && (
                    <button
                      onClick={() => { if (confirm('Regenerate evidence, loopholes and everything on the analysis tab from the current facts and witnesses? Your edits to those will be replaced.')) runAnalysis(draft); }}
                      disabled={busy !== null}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded"
                    >
                      {busy === 'analysis' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Regenerate evidence & analysis
                    </button>
                  )}
                </>
              )}

              {tab === 'analysis' && (
                <>
                  <ListEditor label="Loopholes" items={draft.loopholes} onChange={(v) => set('loopholes', v)} blank={BLANKS.loopholes} />
                  <ListEditor label="Red herrings" items={draft.red_herrings} onChange={(v) => set('red_herrings', v)} blank={BLANKS.red_herrings} />
                  <ListEditor label="Contradictions" items={draft.contradictions} onChange={(v) => set('contradictions', v)} blank={BLANKS.contradictions} />
                  <ListEditor label="Legal issues" items={draft.legal_issues} onChange={(v) => set('legal_issues', v)} blank={BLANKS.legal_issues} />
                  <ListEditor label="Objections" items={draft.objections} onChange={(v) => set('objections', v)} blank={BLANKS.objections} />
                  <ListEditor label="Investigation discoveries" items={draft.investigation} onChange={(v) => set('investigation', v)} blank={BLANKS.investigation} />
                  <ListEditor label="Verdict issues" items={draft.verdict_issues} onChange={(v) => set('verdict_issues', v)} blank={BLANKS.verdict_issues} />
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={save} disabled={busy !== null || check.errors.length > 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium"
              >
                {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save case to database
              </button>
              <button
                onClick={() => { if (confirm('Discard this draft?')) reset(); }} disabled={busy !== null}
                className="px-4 py-2.5 text-slate-300 hover:text-white"
              >
                Discard draft
              </button>
              <span className="text-xs text-slate-500">Saved as a preset case. Admin-only fields go to separate protected tables.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
