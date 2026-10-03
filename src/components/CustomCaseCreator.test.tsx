import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createCase: vi.fn(), deleteCase: vi.fn(), updateCase: vi.fn(),
  addEvidence: vi.fn(), addWitness: vi.fn(),
  remove: vi.fn(), upload: vi.fn(),
}));

vi.mock('./ScreenShell', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('../lib/database', () => ({
  db: {
    cases: { createCase: mocks.createCase, deleteCase: mocks.deleteCase, updateCase: mocks.updateCase, getCaseWithDetails: vi.fn() },
    evidence: { addEvidence: mocks.addEvidence, getCaseEvidence: vi.fn().mockResolvedValue([]), updateEvidence: vi.fn(), deleteEvidence: vi.fn() },
    witnesses: { addWitness: mocks.addWitness, getCaseWitnesses: vi.fn().mockResolvedValue([]), updateWitness: vi.fn(), deleteWitness: vi.fn() },
  },
}));
vi.mock('../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove, getPublicUrl: () => ({ data: { publicUrl: 'https://x/witness-photos/user-1/a.png' } }) }) } },
}));

import CustomCaseCreator from './CustomCaseCreator';

const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

const openForm = () => fireEvent.click(screen.getByText('Fill in the form'));

async function fillValidCase() {
  type(screen.getByPlaceholderText('The State vs. John Doe'), 'State v. Doe');
  type(screen.getByPlaceholderText(/detailed description/i), 'A burglary at night.');
  fireEvent.click(screen.getByText('Continue to Evidence'));
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText('Add Evidence'));
  screen.getAllByPlaceholderText('Evidence title').forEach((el, i) => type(el, `Item ${i + 1}`));
  fireEvent.click(screen.getByText('Continue to Witnesses'));
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText('Add Witness'));
  screen.getAllByPlaceholderText('Witness name').forEach((el, i) => type(el, `Witness ${i + 1}`));
  screen.getAllByPlaceholderText(/Base testimony/).forEach((el) => type(el, 'I saw it.'));
}

beforeEach(() => { vi.clearAllMocks(); mocks.remove.mockResolvedValue({}); mocks.deleteCase.mockResolvedValue(undefined); });

describe('CustomCaseCreator save flow', () => {
  it('creates the case with all rows, difficulty and non-preset flag', async () => {
    mocks.createCase.mockResolvedValue({ id: 'case-1' });
    mocks.addEvidence.mockResolvedValue({});
    mocks.addWitness.mockResolvedValue({});
    const onComplete = vi.fn();
    render(<CustomCaseCreator onComplete={onComplete} onCancel={vi.fn()} />);
    openForm();
    await fillValidCase();
    fireEvent.click(screen.getByText('Create Case & Begin'));
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith('case-1'));
    expect(mocks.createCase).toHaveBeenCalledWith(expect.objectContaining({ is_preset: false, created_by: 'user-1', difficulty: 'medium', title: 'State v. Doe' }));
    expect(mocks.addEvidence).toHaveBeenCalledTimes(3);
    expect(mocks.addWitness).toHaveBeenCalledTimes(3);
    const labels = mocks.addEvidence.mock.calls.map((c) => c[0].exhibit_label);
    expect(labels).toEqual(['Exhibit A', 'Exhibit B', 'Exhibit C']);
  });

  it('rolls the new case back when a later save step fails', async () => {
    mocks.createCase.mockResolvedValue({ id: 'case-2' });
    mocks.addEvidence.mockResolvedValue({});
    mocks.addWitness.mockRejectedValue(new Error('RLS says no'));
    const onComplete = vi.fn();
    render(<CustomCaseCreator onComplete={onComplete} onCancel={vi.fn()} />);
    openForm();
    await fillValidCase();
    fireEvent.click(screen.getByText('Create Case & Begin'));
    await waitFor(() => expect(mocks.deleteCase).toHaveBeenCalledWith('case-2'));
    expect(onComplete).not.toHaveBeenCalled();
    expect(await screen.findByText(/Nothing was saved/)).toBeInTheDocument();
  });

  it('shows what is missing instead of saving an incomplete case', async () => {
    render(<CustomCaseCreator onComplete={vi.fn()} onCancel={vi.fn()} />);
    openForm();
    type(screen.getByPlaceholderText('The State vs. John Doe'), 'State v. Doe');
    type(screen.getByPlaceholderText(/detailed description/i), 'A burglary.');
    fireEvent.click(screen.getByText('Continue to Evidence'));
    fireEvent.click(screen.getByText('Continue to Witnesses'));
    fireEvent.click(screen.getByText('Create Case & Begin'));
    expect(await screen.findByText(/at least 3 evidence items/)).toBeInTheDocument();
    expect(mocks.createCase).not.toHaveBeenCalled();
  });

  it('offers AI parsing or the form when starting a new case', () => {
    render(<CustomCaseCreator onComplete={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Parse with AI')).toBeInTheDocument();
    expect(screen.getByText('Fill in the form')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Parse with AI'));
    expect(screen.getByText('Which side will you argue?')).toBeInTheDocument();
  });
});
