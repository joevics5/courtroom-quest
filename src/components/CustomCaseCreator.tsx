import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Upload, Edit as EditIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/database';
import type { CaseType, EvidenceType } from '../types';

interface CustomCaseCreatorProps {
  onComplete: (caseId: string) => void;
  onCancel: () => void;
  editCaseId?: string;
}

interface WitnessForm {
  id?: string;
  name: string;
  role: string;
  background: string;
  testimony: string;
  photoUrl?: string;
  photoFile?: File;
}

interface EvidenceForm {
  id?: string;
  title: string;
  description: string;
  content: string;
  type: EvidenceType;
  exhibitLabel?: string;
}

export default function CustomCaseCreator({ onComplete, onCancel, editCaseId }: CustomCaseCreatorProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'info' | 'evidence' | 'witnesses'>('info');
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const [caseInfo, setCaseInfo] = useState({
    title: '',
    defendant_name: '',
    description: '',
    caseType: 'burglary' as CaseType
  });

  const [evidenceItems, setEvidenceItems] = useState<EvidenceForm[]>([]);
  const [witnesses, setWitnesses] = useState<WitnessForm[]>([]);

  useEffect(() => {
    if (editCaseId) {
      loadCaseData(editCaseId);
    }
  }, [editCaseId]);

  const loadCaseData = async (caseId: string) => {
    try {
      setLoading(true);
      setIsEditMode(true);
      const caseData = await db.cases.getCaseWithDetails(caseId);

      if (caseData) {
        setCaseInfo({
          title: caseData.title,
          defendant_name: caseData.defendant_name || (caseData.truth_state as any)?.defendant_name || '',
          description: caseData.description,
          caseType: caseData.case_type
        });

        setEvidenceItems(caseData.evidence.map(e => ({
          id: e.id,
          title: e.title,
          description: e.description || '',
          content: e.content || '',
          type: e.evidence_type,
          exhibitLabel: e.exhibit_label
        })));

        setWitnesses(caseData.witnesses.map(w => ({
          id: w.id,
          name: w.name,
          role: w.role,
          background: w.background,
          testimony: w.base_testimony,
          photoUrl: w.photo_url
        })));
      }
    } catch (error) {
      console.error('Failed to load case data:', error);
      alert('Failed to load case data.');
    } finally {
      setLoading(false);
    }
  };

  const addEvidence = () => {
    const nextIndex = evidenceItems.length;
    const label = `Exhibit ${String.fromCharCode(65 + nextIndex)}`;

    setEvidenceItems([...evidenceItems, {
      title: '',
      description: '',
      content: '',
      type: 'documents',
      exhibitLabel: label
    }]);
  };

  const removeEvidence = (index: number) => {
    setEvidenceItems(evidenceItems.filter((_, i) => i !== index));
  };

  const updateEvidence = (index: number, field: string, value: string) => {
    const updated = [...evidenceItems];
    updated[index] = { ...updated[index], [field]: value };
    setEvidenceItems(updated);
  };

  const addWitness = () => {
    setWitnesses([...witnesses, {
      name: '',
      role: '',
      background: '',
      testimony: '',
      photoUrl: undefined
    }]);
  };

  const handleWitnessPhotoUpload = (index: number, file: File) => {
    const updated = [...witnesses];
    updated[index] = {
      ...updated[index],
      photoFile: file,
      photoUrl: URL.createObjectURL(file)
    };
    setWitnesses(updated);
  };

  const updateExhibitLabel = (index: number, label: string) => {
    const updated = [...evidenceItems];
    updated[index] = { ...updated[index], exhibitLabel: label };
    setEvidenceItems(updated);
  };

  const removeWitness = (index: number) => {
    setWitnesses(witnesses.filter((_, i) => i !== index));
  };

  const updateWitness = (index: number, field: keyof WitnessForm, value: string) => {
    const updated = [...witnesses];
    updated[index] = { ...updated[index], [field]: value };
    setWitnesses(updated);
  };

  const handleSubmit = async () => {
    if (!user) return;

    try {
      setLoading(true);

      let caseId = editCaseId;

      if (isEditMode && editCaseId) {
        await db.cases.updateCase(editCaseId, {
          title: caseInfo.title,
          defendant_name: caseInfo.defendant_name,
          description: caseInfo.description,
          case_type: caseInfo.caseType
        });
      } else {
        const newCase = await db.cases.createCase({
          title: caseInfo.title,
          defendant_name: caseInfo.defendant_name,
          description: caseInfo.description,
          case_type: caseInfo.caseType,
          is_preset: false,
          created_by: user.id
        });
        caseId = newCase.id;
      }

      if (!caseId) return;

      const existingEvidenceIds = evidenceItems.filter(e => e.id).map(e => e.id);
      const allEvidence = await db.evidence.getCaseEvidence(caseId, true);

      for (const evidence of allEvidence) {
        if (!existingEvidenceIds.includes(evidence.id)) {
          await db.evidence.deleteEvidence(evidence.id);
        }
      }

      for (const item of evidenceItems) {
        if (item.title) {
          if (item.id && isEditMode) {
            await db.evidence.updateEvidence(item.id, {
              title: item.title,
              description: item.description,
              content: item.content,
              evidence_type: item.type,
              exhibit_label: item.exhibitLabel
            });
          } else {
            await db.evidence.addEvidence({
              case_id: caseId,
              title: item.title,
              description: item.description,
              content: item.content,
              evidence_type: item.type,
              is_hidden: false,
              exhibit_label: item.exhibitLabel,
              auto_tagged: true
            });
          }
        }
      }

      const existingWitnessIds = witnesses.filter(w => w.id).map(w => w.id);
      const allWitnesses = await db.witnesses.getCaseWitnesses(caseId);

      for (const witness of allWitnesses) {
        if (!existingWitnessIds.includes(witness.id)) {
          await db.witnesses.deleteWitness(witness.id);
        }
      }

      for (const witness of witnesses) {
        if (witness.name) {
          if (witness.id && isEditMode) {
            await db.witnesses.updateWitness(witness.id, {
              name: witness.name,
              role: witness.role,
              background: witness.background,
              base_testimony: witness.testimony,
              photo_url: witness.photoUrl
            });
          } else {
            await db.witnesses.addWitness({
              case_id: caseId,
              name: witness.name,
              role: witness.role,
              background: witness.background,
              base_testimony: witness.testimony,
              photo_url: witness.photoUrl,
              knowledge_scope: {},
              personality_traits: { cooperative: true },
              use_ai: true
            });
          }
        }
      }

      onComplete(caseId);
    } catch (error) {
      console.error('Failed to save case:', error);
      alert('Failed to save case. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 'info') {
      return caseInfo.title && caseInfo.description && caseInfo.caseType;
    }
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cases
        </button>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="border-b border-slate-700 px-6 py-4">
            <h2 className="text-2xl font-bold text-white">
              {isEditMode ? 'Edit Custom Case' : 'Create Custom Case'}
            </h2>
            <div className="flex gap-4 mt-4">
              {(['info', 'evidence', 'witnesses'] as const).map((s, i) => (
                <button
                  key={s}
                  onClick={() => setStep(s)}
                  disabled={i > 0 && !canProceed()}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors capitalize ${
                    step === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {i + 1}. {s}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {step === 'info' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Case Title
                  </label>
                  <input
                    type="text"
                    value={caseInfo.title}
                    onChange={(e) => setCaseInfo({ ...caseInfo, title: e.target.value })}
                    placeholder="The State vs. John Doe"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Defendant Name
                  </label>
                  <input
                    type="text"
                    value={caseInfo.defendant_name}
                    onChange={(e) => setCaseInfo({ ...caseInfo, defendant_name: e.target.value })}
                    placeholder="John Doe"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Case Type
                  </label>
                  <select
                    value={caseInfo.caseType}
                    onChange={(e) => setCaseInfo({ ...caseInfo, caseType: e.target.value as CaseType })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="burglary">Burglary</option>
                    <option value="fraud">Fraud</option>
                    <option value="assault">Assault</option>
                    <option value="murder">Murder</option>
                    <option value="theft">Theft</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Case Description
                  </label>
                  <textarea
                    value={caseInfo.description}
                    onChange={(e) => setCaseInfo({ ...caseInfo, description: e.target.value })}
                    placeholder="Provide a detailed description of the case..."
                    rows={6}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  onClick={() => setStep('evidence')}
                  disabled={!canProceed()}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Continue to Evidence
                </button>
              </div>
            )}

            {step === 'evidence' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Evidence Items</h3>
                  <button
                    onClick={addEvidence}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Evidence
                  </button>
                </div>

                {evidenceItems.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    No evidence added yet. Click "Add Evidence" to begin.
                  </div>
                ) : (
                  evidenceItems.map((item, index) => (
                    <div key={index} className="bg-slate-750 rounded-lg p-4 border border-slate-600">
                      <div className="flex items-center justify-between mb-3">
                        <input
                          type="text"
                          value={item.exhibitLabel || `Exhibit ${String.fromCharCode(65 + index)}`}
                          onChange={(e) => updateExhibitLabel(index, e.target.value)}
                          className="text-sm font-medium text-blue-400 bg-transparent border-b border-transparent hover:border-blue-400 focus:border-blue-400 focus:outline-none px-1"
                          placeholder="Exhibit label"
                        />
                        <button
                          onClick={() => removeEvidence(index)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => updateEvidence(index, 'title', e.target.value)}
                          placeholder="Evidence title"
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <select
                          value={item.type}
                          onChange={(e) => updateEvidence(index, 'type', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="documents">Documents</option>
                          <option value="photographs">Photographs</option>
                          <option value="video_recordings">Video Recordings</option>
                          <option value="audio_recordings">Audio Recordings</option>
                          <option value="witness_testimony">Witness Testimony</option>
                          <option value="physical_evidence">Physical Evidence</option>
                          <option value="digital_evidence">Digital Evidence</option>
                          <option value="expert_reports">Expert Reports</option>
                          <option value="confessions_statements">Confessions/Statements</option>
                          <option value="timeline_logs">Timeline/Logs</option>
                        </select>

                        <textarea
                          value={item.description}
                          onChange={(e) => updateEvidence(index, 'description', e.target.value)}
                          placeholder="Description"
                          rows={2}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <textarea
                          value={item.content}
                          onChange={(e) => updateEvidence(index, 'content', e.target.value)}
                          placeholder="Content / Details"
                          rows={3}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  ))
                )}

                <button
                  onClick={() => setStep('witnesses')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Continue to Witnesses
                </button>
              </div>
            )}

            {step === 'witnesses' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Witnesses</h3>
                  <button
                    onClick={addWitness}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Witness
                  </button>
                </div>

                {witnesses.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    No witnesses added yet. Click "Add Witness" to begin.
                  </div>
                ) : (
                  witnesses.map((witness, index) => (
                    <div key={index} className="bg-slate-750 rounded-lg p-4 border border-slate-600">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-blue-400">
                          Witness {index + 1}
                        </span>
                        <button
                          onClick={() => removeWitness(index)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Witness Photo (Optional)
                          </label>
                          <div className="flex items-center gap-3">
                            {witness.photoUrl && (
                              <img
                                src={witness.photoUrl}
                                alt={witness.name}
                                className="w-16 h-16 rounded-full object-cover"
                              />
                            )}
                            <label className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded cursor-pointer transition-colors">
                              <Upload className="w-4 h-4" />
                              Upload Photo
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleWitnessPhotoUpload(index, file);
                                }}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={witness.name}
                          onChange={(e) => updateWitness(index, 'name', e.target.value)}
                          placeholder="Witness name"
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <input
                          type="text"
                          value={witness.role}
                          onChange={(e) => updateWitness(index, 'role', e.target.value)}
                          placeholder="Role (e.g., neighbor, officer, expert)"
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <textarea
                          value={witness.background}
                          onChange={(e) => updateWitness(index, 'background', e.target.value)}
                          placeholder="Background information"
                          rows={2}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <textarea
                          value={witness.testimony}
                          onChange={(e) => updateWitness(index, 'testimony', e.target.value)}
                          placeholder="Base testimony (what they will say)"
                          rows={4}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  ))
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading || witnesses.length === 0}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  {loading
                    ? (isEditMode ? 'Saving Changes...' : 'Creating Case...')
                    : (isEditMode ? 'Save & Continue' : 'Create Case & Begin')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
