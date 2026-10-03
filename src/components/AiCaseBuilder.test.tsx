import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateCore: vi.fn(), generateAnalysis: vi.fn(), saveDraft: vi.fn(), upload: vi.fn(), remove: vi.fn(),
}));

vi.mock('./ScreenShell', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('../lib/supabase', () => ({ supabase: { storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) } } }));
vi.mock('../lib/caseDocument', async (orig) => ({ ...(await orig<typeof import('../lib/caseDocument')>()), validatePdf: async () => null }));
vi.mock('../lib/caseCreator/api', async (orig) => ({
  ...(await orig<typeof import('../lib/caseCreator/api')>()),
  generateCore: mocks.generateCore, generateAnalysis: mocks.generateAnalysis,
}));
vi.mock('../lib/caseCreator/save', () => ({ saveDraft: mocks.saveDraft }));

import AiCaseBuilder from './AiCaseBuilder';

const secret = { knowledge: [], opinions: [], suspicions: [], secrets: [], motivated_omissions: [], limitations: [], sample_questions: { prosecution: [], defence: [], damaging: ['Did you see his face?'] } };
const theory = (weak: string[]) => ({ core_claim: 'c', supporting_fact_ids: [], weak_points: weak, assumptions: [], facts_opponent_can_exploit: [], evidence_that_would_strengthen: [], evidence_that_would_weaken: [] });
const core = {
  case: { title: 'State v. Doe', description: 'd', case_type: 'fraud', difficulty: 'medium', defendant_name: 'Doe', subtitle: '', jurisdiction: '', court_type: '', location: '', time_period: '', primary_dispute: '', secondary_disputes: [] },
  truth: { summary: '', who_did_what: '', motive: '', key_moments: [], misleading_elements: [], missing_evidence: [] },
  facts: [{ id: 'F1', text: 'f', status: 'confirmed', public: true }],
  timeline: [],
  theories: { prosecution: theory([]), defence: theory(['No alibi witness']), alternative: theory([]) },
  witnesses: [1, 2, 3].map((n) => ({ code: `W${n}`, name: `Witness ${n}`, role: 'r', background: 'b', base_testimony: 't', personality_traits: [], secret })),
};
const evidenceItem = (n: number) => ({ code: `E${n}`, title: `Exhibit ${n}`, evidence_type: 'documents', description: 'd', content: 'c', date_created: '', is_hidden: false, secret: { fact_ids: ['F1'], related_evidence_codes: [], witnesses: [] } });
const analysis = {
  evidence: [1, 2, 3].map(evidenceItem),
  loopholes: [{ id: 'L1', side: 'prosecution', description: 'Gap at 9pm', argument: 'Where were you?', sample_questions: [], witness_codes: ['W1'], evidence_codes: ['E1'], counterargument: 'Phone log', how_opponent_neutralizes: '', difficulty: 'hard' },
    { id: 'L2', side: 'defence', description: 'Unreliable ID', argument: 'Poor lighting', sample_questions: [], witness_codes: [], evidence_codes: [], counterargument: '', how_opponent_neutralizes: '', difficulty: 'medium' }],
  red_herrings: [], contradictions: [], legal_issues: [], objections: [], investigation: [], verdict_issues: [],
};

const notes = 'The defendant is charged with fraud after the company accounts showed missing funds across March. '.repeat(2);
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const parseBtn = () => screen.getByRole('button', { name: /parse with ai/i });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generateCore.mockResolvedValue({ data: core, warnings: [], model: 'm' });
  mocks.generateAnalysis.mockResolvedValue({ data: analysis, warnings: [], model: 'm' });
  mocks.saveDraft.mockResolvedValue({ caseId: 'case-9', warnings: [] });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({});
});

const setup = () => {
  const props = { onComplete: vi.fn(), onCancel: vi.fn(), onManual: vi.fn() };
  render(<AiCaseBuilder {...props} />);
  return props;
};

describe('AiCaseBuilder', () => {
  it('needs a side and a source before it will parse', () => {
    setup();
    expect(parseBtn()).toBeDisabled();
    type(screen.getByPlaceholderText(/paste the facts/i), notes);
    expect(parseBtn()).toBeDisabled(); // still no side
    fireEvent.click(screen.getByText('Defence'));
    expect(parseBtn()).toBeEnabled();
  });

  it('parses pasted notes in practice mode and saves the reviewed case as a custom case', async () => {
    const props = setup();
    fireEvent.click(screen.getByText('Defence'));
    type(screen.getByPlaceholderText(/paste the facts/i), notes);
    fireEvent.click(parseBtn());

    await waitFor(() => expect(screen.getByText(/Where they will hit/)).toBeInTheDocument());
    expect(mocks.generateCore).toHaveBeenCalledWith(notes.trim(), expect.objectContaining({ user_side: 'defence' }), undefined, { document: undefined });
    expect(mocks.generateAnalysis).toHaveBeenCalledTimes(1);
    expect(mocks.upload).not.toHaveBeenCalled();
    // playbook is built against the opposing side and shows your own weak points
    expect(screen.getByText('Gap at 9pm')).toBeInTheDocument();
    expect(screen.getByText('No alibi witness')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Save case and begin'));
    await waitFor(() => expect(props.onComplete).toHaveBeenCalledWith('case-9'));
    expect(mocks.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ witnesses: expect.any(Array) }), { asCustom: true });
  });

  it('uploads the PDF to the user folder, sends only its path to the AI, and does not delete it itself on success', async () => {
    setup();
    fireEvent.click(screen.getByText('Prosecution'));
    const file = new File(['%PDF-1.7 fake'], 'case file.pdf', { type: 'application/pdf' });
    fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, { target: { files: [file] } });
    await screen.findByText('case file.pdf');
    fireEvent.click(parseBtn());

    await waitFor(() => expect(screen.getByText(/Where they will hit/)).toBeInTheDocument());
    const [path, uploaded, opts] = mocks.upload.mock.calls[0];
    expect(path).toMatch(/^user-1\/.+\.pdf$/);
    expect(uploaded).toBe(file);
    expect(opts).toEqual({ contentType: 'application/pdf' });
    expect(mocks.generateCore).toHaveBeenCalledWith('', expect.objectContaining({ user_side: 'prosecution' }), undefined, { document: { path } });
    expect(mocks.generateAnalysis).toHaveBeenCalledWith(expect.any(String), expect.anything(), expect.anything(), undefined, { document: { path } });
    expect(mocks.remove).not.toHaveBeenCalled(); // the server deletes it after stage 2
  });

  it('shows the server error, saves nothing, and keeps the upload so the user can retry', async () => {
    mocks.generateCore.mockRejectedValue(new Error('Daily AI limit reached. Please try again tomorrow.'));
    setup();
    fireEvent.click(screen.getByText('Defence'));
    type(screen.getByPlaceholderText(/paste the facts/i), notes);
    fireEvent.click(parseBtn());
    expect(await screen.findByText(/Daily AI limit reached/)).toBeInTheDocument();
    expect(mocks.saveDraft).not.toHaveBeenCalled();
    expect(parseBtn()).toBeEnabled();
  });

  it('removes the uploaded PDF when the user leaves without finishing', async () => {
    const props = setup();
    mocks.generateCore.mockRejectedValue(new Error('boom'));
    fireEvent.click(screen.getByText('Defence'));
    const file = new File(['%PDF-1.7 fake'], 'a.pdf', { type: 'application/pdf' });
    fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, { target: { files: [file] } });
    await screen.findByText('a.pdf');
    fireEvent.click(parseBtn());
    await screen.findByText(/boom/);
    fireEvent.click(screen.getByLabelText('Remove PDF'));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith([expect.stringMatching(/^user-1\/.+\.pdf$/)]));
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('lets the user switch to the manual form', () => {
    const props = setup();
    fireEvent.click(screen.getByText('Fill in manually instead'));
    expect(props.onManual).toHaveBeenCalled();
  });
});
