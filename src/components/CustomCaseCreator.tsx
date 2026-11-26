import { useTranslation } from 'react-i18next';
import ScreenShell from './ScreenShell';
import { INPUT, PANEL, PANEL_SOFT, gameButton } from './ui';
import { appConfirm } from '../lib/appDialog';
import { useState, useEffect, useRef } from 'react';
import { FileText, PenLine, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react';
import AiCaseBuilder from './AiCaseBuilder';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/database';
import { supabase } from '../lib/supabase';
import type { Case, CaseType, Difficulty, EvidenceType, Witness } from '../types';
import {
  PHOTO_BUCKET, assignExhibitLabels, isBlankEvidence, isBlankWitness, nextExhibitLabel,
  photoPath, photoPathFromUrl, validateCustomCase, validatePhoto,
} from '../lib/customCase';
import type { CreatorStep } from '../lib/customCase';

interface CustomCaseCreatorProps {
  onComplete: (caseId: string) => void;
  onCancel: () => void;
  editCaseId?: string;
}

interface WitnessForm {
  uid: string;
  id?: string;
  name: string;
  role: string;
  background: string;
  testimony: string;
  photoUrl?: string;
  photoFile?: File;
}

interface EvidenceForm {
  uid: string;
  id?: string;
  title: string;
  description: string;
  content: string;
  type: EvidenceType;
  exhibitLabel: string;
}

const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const STEPS: CreatorStep[] = ['info', 'evidence', 'witnesses'];

const CASE_TYPES: { value: CaseType }[] = ['burglary', 'fraud', 'assault', 'murder', 'theft', 'criminal', 'civil', 'other'].map(value => ({ value: value as CaseType }));

const EVIDENCE_TYPES: { value: EvidenceType }[] = ['documents', 'photographs', 'video_recordings', 'audio_recordings', 'witness_testimony', 'physical_evidence', 'digital_evidence', 'expert_reports', 'confessions_statements', 'timeline_logs'].map(value => ({ value: value as EvidenceType }));

const inputCls = INPUT;
const cardCls = `${PANEL_SOFT} p-4`;
const primaryBtn = `${gameButton('gold')} w-full`;

const emptyInfo = { title: '', defendant_name: '', description: '', caseType: 'burglary' as CaseType, difficulty: 'medium' as Difficulty };

export default function CustomCaseCreator({ onComplete, onCancel, editCaseId }: CustomCaseCreatorProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isEditMode = !!editCaseId;
  // New cases start by choosing how to fill the case in; editing always uses the form.
  const [mode, setMode] = useState<'choose' | 'manual' | 'ai'>(isEditMode ? 'manual' : 'choose');
  const [step, setStep] = useState<CreatorStep>('info');
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotes, setSavedNotes] = useState<string[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [photoErrors, setPhotoErrors] = useState<Record<string, string>>({});

  const [caseInfo, setCaseInfo] = useState(emptyInfo);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceForm[]>([]);
  const [witnesses, setWitnesses] = useState<WitnessForm[]>([]);

  // Photo URLs as stored in the DB when the case was loaded (to clean up replaced/removed files).
  const loadedPhotos = useRef(new Map<string, string>());
  const blobUrls = useRef(new Set<string>());
  const [baseline, setBaseline] = useState<string | null>(isEditMode ? null : '');

  const snapshot = JSON.stringify([
    caseInfo,
    evidenceItems.map(({ uid: _u, ...e }) => e),
    witnesses.map(({ uid: _u, photoFile, ...w }) => ({ ...w, hasNewPhoto: !!photoFile })),
  ]);
  // Create mode: the empty form is the baseline.
  useEffect(() => {
    if (!isEditMode) setBaseline(JSON.stringify([emptyInfo, [], []]));
  }, [isEditMode]);
  const isDirty = baseline !== null && baseline !== '' && snapshot !== baseline && !savedId;

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  useEffect(() => () => { blobUrls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!editCaseId || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const caseData = await db.cases.getCaseWithDetails(editCaseId, { fresh: true });
        if (cancelled) return;
        if (!caseData) { setLoadError(t('creator.notFound')); return; }
        if (caseData.is_preset || caseData.created_by !== userId) {
          setLoadError(t('creator.notYours'));
          return;
        }
        const info = {
          title: caseData.title,
          defendant_name: caseData.defendant_name || (caseData.truth_state as Record<string, string> | undefined)?.defendant_name || '',
          description: caseData.description,
          caseType: caseData.case_type,
          difficulty: (caseData.difficulty || 'medium') as Difficulty,
        };
        const labels = assignExhibitLabels(caseData.evidence.map((e) => e.exhibit_label));
        const ev: EvidenceForm[] = caseData.evidence.map((e, i) => ({
          uid: uid(), id: e.id, title: e.title, description: e.description || '', content: e.content || '',
          type: e.evidence_type, exhibitLabel: e.exhibit_label || labels[i],
        }));
        const wi: WitnessForm[] = caseData.witnesses.map((w) => ({
          uid: uid(), id: w.id, name: w.name, role: w.role, background: w.background,
          testimony: w.base_testimony, photoUrl: w.photo_url || undefined,
        }));
        loadedPhotos.current = new Map(caseData.witnesses.filter((w) => w.photo_url).map((w) => [w.id, w.photo_url as string]));
        setCaseInfo(info);
        setEvidenceItems(ev);
        setWitnesses(wi);
        setBaseline(JSON.stringify([info, ev.map(({ uid: _u, ...e }) => e), wi.map(({ uid: _u, photoFile, ...w }) => ({ ...w, hasNewPhoto: false }))]));
      } catch (error) {
        console.error('Failed to load case data:', error);
        if (!cancelled) setLoadError(t('creator.loadFail'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editCaseId, userId]);

  const live = validateCustomCase(caseInfo, evidenceItems, witnesses);
  const infoValid = !!caseInfo.title.trim() && !!caseInfo.description.trim();
  const filledEvidence = evidenceItems.filter((e) => !isBlankEvidence(e)).length;
  const filledWitnesses = witnesses.filter((w) => !isBlankWitness(w)).length;

  const handleCancel = async () => {
    if (isDirty && !(await appConfirm({ title: t('creator.discardTitle'), message: t('creator.discardMsg'), confirmLabel: t('creator.discard'), cancelLabel: t('creator.keepEditing'), tone: 'danger' }))) return;
    onCancel();
  };

  // ---- evidence ----
  const addEvidence = () => {
    setEvidenceItems((items) => [...items, {
      uid: uid(), title: '', description: '', content: '', type: 'documents',
      exhibitLabel: nextExhibitLabel(items.map((i) => i.exhibitLabel)),
    }]);
  };
  const removeEvidence = (id: string) => setEvidenceItems((items) => items.filter((e) => e.uid !== id));
  const updateEvidence = <K extends keyof EvidenceForm>(id: string, field: K, value: EvidenceForm[K]) =>
    setEvidenceItems((items) => items.map((e) => (e.uid === id ? { ...e, [field]: value } : e)));

  // ---- witnesses ----
  const addWitness = () => setWitnesses((items) => [...items, { uid: uid(), name: '', role: '', background: '', testimony: '' }]);
  const removeWitness = (id: string) => setWitnesses((items) => items.filter((w) => w.uid !== id));
  const updateWitness = <K extends keyof WitnessForm>(id: string, field: K, value: WitnessForm[K]) =>
    setWitnesses((items) => items.map((w) => (w.uid === id ? { ...w, [field]: value } : w)));

  const handleWitnessPhoto = (id: string, file: File) => {
    const problem = validatePhoto(file);
    setPhotoErrors((p) => ({ ...p, [id]: problem ?? '' }));
    if (problem) return;
    const url = URL.createObjectURL(file);
    blobUrls.current.add(url);
    setWitnesses((items) => items.map((w) => {
      if (w.uid !== id) return w;
      if (w.photoFile && w.photoUrl) { URL.revokeObjectURL(w.photoUrl); blobUrls.current.delete(w.photoUrl); }
      return { ...w, photoFile: file, photoUrl: url };
    }));
  };
  const removeWitnessPhoto = (id: string) => {
    setWitnesses((items) => items.map((w) => {
      if (w.uid !== id) return w;
      if (w.photoFile && w.photoUrl) { URL.revokeObjectURL(w.photoUrl); blobUrls.current.delete(w.photoUrl); }
      return { ...w, photoFile: undefined, photoUrl: undefined };
    }));
  };

  const handleSubmit = async () => {
    if (!user || saving) return;
    if (live.errors.length > 0) {
      setShowIssues(true);
      setStep(live.errors[0].step);
      return;
    }
    setShowIssues(false);
    setSaveError(null);
    setSaving(true);

    const cleanEvidence = evidenceItems.filter((e) => !isBlankEvidence(e));
    const cleanWitnesses = witnesses.filter((w) => !isBlankWitness(w));
    const pendingUploads = new Set<string>(); // uploaded but not yet saved on a witness row
    const replaced: string[] = [];            // old storage files to delete once everything is saved
    const notes: string[] = [];
    let createdCaseId: string | undefined;

    try {
      // 1. Upload any new photos
      const photoByUid = new Map<string, { url?: string; path?: string }>();
      for (const w of cleanWitnesses) {
        if (w.photoFile) {
          const path = photoPath(user.id, w.photoFile.type, uid());
          const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, w.photoFile, {
            contentType: w.photoFile.type, cacheControl: '31536000',
          });
          if (error) throw new Error(t('creator.errPhoto', { name: w.name.trim(), message: error.message }));
          pendingUploads.add(path);
          photoByUid.set(w.uid, { path, url: supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl });
        } else {
          photoByUid.set(w.uid, { url: w.photoUrl });
        }
      }

      // 2. The case row
      const payload = {
        title: caseInfo.title.trim(),
        description: caseInfo.description.trim(),
        defendant_name: caseInfo.defendant_name.trim() || null,
        case_type: caseInfo.caseType,
        difficulty: caseInfo.difficulty,
      };
      let caseId: string;
      if (editCaseId) {
        caseId = editCaseId;
        await db.cases.updateCase(caseId, payload as unknown as Partial<Case>);
      } else {
        const created = await db.cases.createCase({
          ...payload, is_preset: false, created_by: user.id,
        } as unknown as Omit<Case, 'id' | 'created_at' | 'updated_at'>);
        caseId = created.id;
        createdCaseId = created.id;
      }

      // 3. Evidence: remove what was deleted in the form, then update/add
      const keptLabels: string[] = [];
      if (editCaseId) {
        const keep = new Set(cleanEvidence.map((e) => e.id).filter(Boolean));
        for (const row of await db.evidence.getCaseEvidence(caseId, true)) {
          if (keep.has(row.id)) continue;
          try { await db.evidence.deleteEvidence(row.id); } catch {
            notes.push(t('creator.keptEvidence', { title: row.title }));
            if (row.exhibit_label) keptLabels.push(row.exhibit_label);
          }
        }
      }
      const labels = assignExhibitLabels([...keptLabels, ...cleanEvidence.map((e) => e.exhibitLabel)]).slice(keptLabels.length);
      for (const [i, item] of cleanEvidence.entries()) {
        const fields = {
          title: item.title.trim(), description: item.description.trim(), content: item.content.trim(),
          evidence_type: item.type, exhibit_label: labels[i],
        };
        try {
          if (item.id) await db.evidence.updateEvidence(item.id, fields);
          else await db.evidence.addEvidence({ ...fields, case_id: caseId, is_hidden: false, auto_tagged: true });
        } catch (e) {
          throw new Error(t('creator.errEvidenceSave', { title: fields.title, message: e instanceof Error ? e.message : t('creator.unknownError') }));
        }
      }

      // 4. Witnesses
      if (editCaseId) {
        const keep = new Set(cleanWitnesses.map((w) => w.id).filter(Boolean));
        for (const row of await db.witnesses.getCaseWitnesses(caseId, { fresh: true })) {
          if (keep.has(row.id)) continue;
          try {
            await db.witnesses.deleteWitness(row.id);
            const old = photoPathFromUrl(row.photo_url);
            if (old) replaced.push(old);
          } catch {
            notes.push(t('creator.keptWitness', { name: row.name }));
          }
        }
      }
      for (const w of cleanWitnesses) {
        const photo = photoByUid.get(w.uid);
        const fields = {
          name: w.name.trim(), role: w.role.trim() || 'Witness',
          background: w.background.trim(), base_testimony: w.testimony.trim(),
          photo_url: photo?.url ?? null,
        } as unknown as Partial<Witness>;
        try {
          if (w.id) {
            await db.witnesses.updateWitness(w.id, fields);
            const old = loadedPhotos.current.get(w.id);
            if (old && old !== photo?.url) { const p = photoPathFromUrl(old); if (p) replaced.push(p); }
          } else {
            await db.witnesses.addWitness({
              ...fields, case_id: caseId, knowledge_scope: {}, personality_traits: { cooperative: true }, use_ai: true,
            } as unknown as Omit<Witness, 'id' | 'created_at'>);
          }
          if (photo?.path) pendingUploads.delete(photo.path);
        } catch (e) {
          throw new Error(t('creator.errWitnessSave', { name: fields.name, message: e instanceof Error ? e.message : t('creator.unknownError') }));
        }
      }

      // 5. Best-effort cleanup of photos that are no longer used (only ever our own folder)
      const stale = replaced.filter((p) => p.startsWith(`${user.id}/`));
      if (stale.length) await supabase.storage.from(PHOTO_BUCKET).remove(stale).catch(() => undefined);

      if (notes.length) {
        setSavedNotes(notes);
        setSavedId(caseId);
        setSaving(false);
        return;
      }
      setSavedId(caseId);
      onComplete(caseId);
    } catch (error) {
      console.error('Failed to save case:', error);
      // Don't leave a half-built case behind, and don't leave uploaded files nobody points at.
      if (createdCaseId) await db.cases.deleteCase(createdCaseId).catch(() => undefined);
      if (pendingUploads.size) await supabase.storage.from(PHOTO_BUCKET).remove([...pendingUploads]).catch(() => undefined);
      const reason = error instanceof Error ? error.message : t('creator.wentWrong');
      setSaveError(editCaseId
        ? t('creator.partial', { reason })
        : t('creator.nothingSaved', { reason }));
    } finally {
      setSaving(false);
    }
  };

  if (mode === 'ai') {
    return <AiCaseBuilder onComplete={onComplete} onCancel={onCancel} onManual={() => setMode('manual')} />;
  }

  if (mode === 'choose') {
    return (
      <ScreenShell title={t('creator.newCase')} onBack={onCancel} maxWidth="max-w-3xl lg:max-w-4xl">
        <div className={`${PANEL} space-y-4`}>
          <p className="text-white/70 text-sm">{t('creator.how')}</p>
          <button
            onClick={() => setMode('ai')}
            className="w-full text-left rounded-2xl border border-[#FFD43B]/60 bg-[#FFD43B]/10 hover:bg-[#FFD43B]/20 p-4 transition-colors"
          >
            <div className="flex items-center gap-2 text-[#FFD43B] font-bold"><Sparkles className="w-5 h-5" /> {t('creator.fromFile')}</div>
            <p className="text-sm text-white/80 mt-1">
              {t('creator.fromFileBody')}
            </p>
            <p className="text-xs text-white/55 mt-2 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {t('creator.reviewNote')}</p>
          </button>
          <button
            onClick={() => setMode('manual')}
            className="w-full text-left rounded-2xl border border-white/20 bg-white/[0.06] hover:border-[#FFD43B]/60 p-4 transition-colors"
          >
            <div className="flex items-center gap-2 text-white font-bold"><PenLine className="w-5 h-5" /> {t('creator.form')}</div>
            <p className="text-sm text-white/70 mt-1">{t('creator.formBody')}</p>
          </button>
        </div>
      </ScreenShell>
    );
  }

  if (loading || loadError) {
    return (
      <ScreenShell title={t('creator.editCase')} onBack={onCancel} maxWidth="max-w-3xl lg:max-w-4xl">
        <div className={`${PANEL} p-8 text-center text-white/70`}>
          {loadError ? (
            <div className="space-y-4">
              <p className="text-red-300">{loadError}</p>
              <button onClick={onCancel} className={gameButton('gold', 'sm')}>{t('common.back')}</button>
            </div>
          ) : t('creator.loading')}
        </div>
      </ScreenShell>
    );
  }

  const issueList = showIssues ? live.errors : [];

  return (
    <ScreenShell title={isEditMode ? t('creator.editCase') : t('creator.newCase')} onBack={handleCancel} maxWidth="max-w-3xl lg:max-w-4xl">
      <div className={`${PANEL_SOFT} overflow-hidden`}>
        <div className="border-b border-white/15 px-6 py-4">
          <div className="flex gap-3">
            {STEPS.map((s, i) => (
              <button
                key={s}
                onClick={() => setStep(s)}
                disabled={(i > 0 && !infoValid) || saving}
                className={`${gameButton(step === s ? 'gold' : 'ghost', 'sm')} flex-1 capitalize`}
              >
                {i + 1}. {s}
                {s === 'evidence' && filledEvidence > 0 && ` (${filledEvidence})`}
                {s === 'witnesses' && filledWitnesses > 0 && ` (${filledWitnesses})`}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {issueList.length > 0 && (
            <div role="alert" className="mb-4 rounded-lg border border-red-400/40 bg-red-950/40 p-4 text-sm text-red-200 space-y-1">
              <p className="font-semibold">{t('creator.fixThese')}</p>
              {issueList.map((it, i) => (
                <button key={i} onClick={() => setStep(it.step)} className="block text-left underline-offset-2 hover:underline">
                  • {it.message}
                </button>
              ))}
            </div>
          )}
          {step === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t('creator.caseTitle')}</label>
                <input
                  type="text" value={caseInfo.title} maxLength={120}
                  onChange={(e) => setCaseInfo({ ...caseInfo, title: e.target.value })}
                  placeholder={t('creator.titlePh')} className={inputCls}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t('creator.defendant')}</label>
                <input
                  type="text" value={caseInfo.defendant_name} maxLength={80}
                  onChange={(e) => setCaseInfo({ ...caseInfo, defendant_name: e.target.value })}
                  placeholder={t('creator.defendantPh')} className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">{t('creator.caseType')}</label>
                  <select
                    value={caseInfo.caseType}
                    onChange={(e) => setCaseInfo({ ...caseInfo, caseType: e.target.value as CaseType })}
                    className={inputCls}
                  >
                    {CASE_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{t(`creator.types.${ct.value}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">{t('creator.difficulty')}</label>
                  <select
                    value={caseInfo.difficulty}
                    onChange={(e) => setCaseInfo({ ...caseInfo, difficulty: e.target.value as Difficulty })}
                    className={inputCls}
                  >
                    <option value="easy">{t('creator.easyOpt')}</option>
                    <option value="medium">{t('creator.mediumOpt')}</option>
                    <option value="hard">{t('creator.hardOpt')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">{t('creator.desc')}</label>
                <textarea
                  value={caseInfo.description} maxLength={4000} rows={6}
                  onChange={(e) => setCaseInfo({ ...caseInfo, description: e.target.value })}
                  placeholder={t('creator.descPh')} className={inputCls}
                />
                <p className="text-xs text-white/55 mt-1">{t('creator.descNote')}</p>
              </div>

              <button onClick={() => setStep('evidence')} disabled={!infoValid} className={primaryBtn}>
                {t('creator.toEvidence')}
              </button>
            </div>
          )}

          {step === 'evidence' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{t('creator.evidenceItems')}</h3>
                <button
                  onClick={addEvidence}
                  className={gameButton('gold', 'sm')}
                >
                  <Plus className="w-4 h-4" />
                  {t('creator.addEvidence')}
                </button>
              </div>

              {evidenceItems.length === 0 ? (
                <div className="text-center py-12 text-white/55">{t('creator.noEvidence')}</div>
              ) : (
                evidenceItems.map((item) => (
                  <div key={item.uid} className={cardCls}>
                    <div className="flex items-center justify-between mb-3">
                      <input
                        type="text" value={item.exhibitLabel} maxLength={30}
                        onChange={(e) => updateEvidence(item.uid, 'exhibitLabel', e.target.value)}
                        className="text-sm font-medium text-blue-400 bg-transparent border-b border-transparent hover:border-blue-400 focus:border-blue-400 focus:outline-none px-1"
                        placeholder={t('creator.exhibitLabel')} aria-label={t('creator.exhibitLabel')}
                      />
                      <button onClick={() => removeEvidence(item.uid)} aria-label={t('creator.removeEvidence')} className="text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <input
                        type="text" value={item.title} maxLength={120}
                        onChange={(e) => updateEvidence(item.uid, 'title', e.target.value)}
                        placeholder={t('creator.evidenceTitle')} className={inputCls}
                      />
                      <select
                        value={item.type}
                        onChange={(e) => updateEvidence(item.uid, 'type', e.target.value as EvidenceType)}
                        className={inputCls}
                      >
                        {EVIDENCE_TYPES.map((et) => <option key={et.value} value={et.value}>{t(`evidenceType.${et.value}`)}</option>)}
                        {!EVIDENCE_TYPES.some((et) => et.value === item.type) && <option value={item.type}>{item.type}</option>}
                      </select>
                      <textarea
                        value={item.description} maxLength={1000} rows={2}
                        onChange={(e) => updateEvidence(item.uid, 'description', e.target.value)}
                        placeholder={t('creator.description')} className={inputCls}
                      />
                      <textarea
                        value={item.content} maxLength={5000} rows={3}
                        onChange={(e) => updateEvidence(item.uid, 'content', e.target.value)}
                        placeholder={t('creator.content')} className={inputCls}
                      />
                    </div>
                  </div>
                ))
              )}

              <button onClick={() => setStep('witnesses')} className={primaryBtn}>{t('creator.toWitnesses')}</button>
            </div>
          )}

          {step === 'witnesses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{t('creator.witnesses')}</h3>
                <button
                  onClick={addWitness}
                  className={gameButton('gold', 'sm')}
                >
                  <Plus className="w-4 h-4" />
                  {t('creator.addWitness')}
                </button>
              </div>

              {witnesses.length === 0 ? (
                <div className="text-center py-12 text-white/55">{t('creator.noWitnesses')}</div>
              ) : (
                witnesses.map((witness, index) => (
                  <div key={witness.uid} className={cardCls}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-blue-400">Witness {index + 1}</span>
                      <button onClick={() => removeWitness(witness.uid)} aria-label={t('creator.removeWitness')} className="text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">{t('creator.photoOpt')}</label>
                        <div className="flex items-center gap-3 flex-wrap">
                          {witness.photoUrl && (
                            <img src={witness.photoUrl} alt={witness.name || t('transcript.witness')} className="w-16 h-16 rounded-full object-cover" />
                          )}
                          <label className={`${gameButton("ghost", "sm")} cursor-pointer`}>
                            <Upload className="w-4 h-4" />
                            {witness.photoUrl ? t('creator.changePhoto') : t('creator.uploadPhoto')}
                            <input
                              type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleWitnessPhoto(witness.uid, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          {witness.photoUrl && (
                            <button
                              onClick={() => removeWitnessPhoto(witness.uid)}
                              className="flex items-center gap-1 px-3 py-2 text-white/70 hover:text-white text-sm"
                            >
                              <X className="w-4 h-4" /> Remove
                            </button>
                          )}
                        </div>
                        {photoErrors[witness.uid] && <p className="text-sm text-red-300 mt-2">{photoErrors[witness.uid]}</p>}
                      </div>

                      <input
                        type="text" value={witness.name} maxLength={80}
                        onChange={(e) => updateWitness(witness.uid, 'name', e.target.value)}
                        placeholder={t('creator.witnessName')} className={inputCls}
                      />
                      <input
                        type="text" value={witness.role} maxLength={80}
                        onChange={(e) => updateWitness(witness.uid, 'role', e.target.value)}
                        placeholder={t('creator.rolePh')} className={inputCls}
                      />
                      <textarea
                        value={witness.background} maxLength={1000} rows={2}
                        onChange={(e) => updateWitness(witness.uid, 'background', e.target.value)}
                        placeholder={t('creator.background')} className={inputCls}
                      />
                      <textarea
                        value={witness.testimony} maxLength={4000} rows={4}
                        onChange={(e) => updateWitness(witness.uid, 'testimony', e.target.value)}
                        placeholder={t('creator.baseTestimony')} className={inputCls}
                      />
                    </div>
                  </div>
                ))
              )}

              {live.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-950/30 p-4 text-sm text-amber-200 space-y-1">
                  {live.warnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}

              {saveError && (
                <div role="alert" className="rounded-lg border border-red-400/40 bg-red-950/40 p-4 text-sm text-red-200">{saveError}</div>
              )}

              {savedNotes.length > 0 && savedId && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-950/30 p-4 text-sm text-amber-200 space-y-2">
                  <p className="font-semibold">{t('creator.savedNotes')}</p>
                  {savedNotes.map((n, i) => <p key={i}>{n}</p>)}
                </div>
              )}

              {savedId && savedNotes.length > 0 ? (
                <button onClick={() => onComplete(savedId)} className={primaryBtn}>{t('pretrial.continue')}</button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className={primaryBtn}
                >
                  {saving
                    ? (isEditMode ? t('creator.saving') : t('creator.creating'))
                    : (isEditMode ? t('creator.saveContinue') : t('creator.createBegin'))}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </ScreenShell>
  );
}
