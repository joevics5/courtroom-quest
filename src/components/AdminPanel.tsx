import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit, Trash2, Shield } from 'lucide-react';
import { db } from '../lib/database';
import AdminCaseEditor from './AdminCaseEditor';
import type { Case, CaseType, Difficulty } from '../types';

interface AdminPanelProps {
  onBack: () => void;
}

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [presetCases, setPresetCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState<string>('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    case_type: 'burglary' as CaseType,
    difficulty: 'medium' as Difficulty
  });

  useEffect(() => {
    loadPresetCases();
  }, []);

  const loadPresetCases = async () => {
    try {
      setLoading(true);
      const cases = await db.cases.getPresetCases();
      setPresetCases(cases);
    } catch (error) {
      console.error('Failed to load preset cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingCase) {
        await db.cases.updateCase(editingCase.id, {
          ...formData,
          updated_at: new Date().toISOString()
        });
      } else {
        await db.cases.createCase({
          ...formData,
          is_preset: true
        });
      }

      await loadPresetCases();
      resetForm();
    } catch (error) {
      console.error('Failed to save case:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to save case: ${errorMessage}\n\nNote: Admin features may require service role access. Regular users can only manage custom cases.`);
    }
  };

  const handleEdit = (caseItem: Case) => {
    setEditingCaseId(caseItem.id);
    setShowEditor(true);
  };

  const handleDelete = async (caseId: string) => {
    if (!confirm('Are you sure you want to delete this preset case?')) return;

    try {
      await db.cases.deleteCase(caseId);
      await loadPresetCases();
    } catch (error) {
      console.error('Failed to delete case:', error);
      alert('Failed to delete case. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      case_type: 'burglary',
      difficulty: 'medium'
    });
    setEditingCase(null);
    setShowForm(false);
  };

  if (showEditor && editingCaseId) {
    return <AdminCaseEditor caseId={editingCaseId} onBack={() => {
      setShowEditor(false);
      setEditingCaseId('');
      loadPresetCases();
    }} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cases
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center justify-center w-12 h-12 bg-amber-600 rounded-full">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
            <p className="text-slate-400 text-sm">Manage preset cases</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Preset Cases</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              {showForm ? 'Cancel' : 'Add New Case'}
            </button>
          </div>

          {showForm && (
            <div className="border-b border-slate-700 p-6 bg-slate-750">
              <h3 className="text-lg font-semibold text-white mb-4">
                {editingCase ? 'Edit Case' : 'Create New Case'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Case Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="The State vs. John Doe"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Case Type
                    </label>
                    <select
                      value={formData.case_type}
                      onChange={(e) => setFormData({ ...formData, case_type: e.target.value as CaseType })}
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
                      Difficulty
                    </label>
                    <select
                      value={formData.difficulty}
                      onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as Difficulty })}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide a detailed description of the case..."
                    rows={4}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={!formData.title || !formData.description}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors"
                  >
                    {editingCase ? 'Update Case' : 'Create Case'}
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="p-6">
            {loading ? (
              <div className="text-center py-12 text-slate-400">Loading...</div>
            ) : presetCases.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                No preset cases yet. Create one to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {presetCases.map((caseItem) => (
                  <div
                    key={caseItem.id}
                    className="bg-slate-750 rounded-lg p-4 border border-slate-600"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-1">
                          {caseItem.title}
                        </h3>
                        <p className="text-sm text-slate-400 capitalize mb-2">
                          {caseItem.case_type}
                        </p>
                        <p className="text-slate-300 text-sm line-clamp-2">
                          {caseItem.description}
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          {caseItem.difficulty && (
                            <span className="text-xs px-2 py-1 rounded font-medium text-blue-400 bg-blue-500/10">
                              {caseItem.difficulty}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(caseItem)}
                          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(caseItem.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-400 mb-1">Admin Note</h4>
              <p className="text-sm text-amber-200/80">
                Cases created here will be available to all users as preset cases. After creating a case,
                you can add evidence and witnesses by editing the case details.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
