import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  evidence: [] as unknown[],
  witnesses: [] as unknown[],
  interactions: [] as unknown[],
  addInteraction: vi.fn(),
  generateWitnessResponse: vi.fn()
}));

vi.mock('../lib/database', () => ({
  db: {
    evidence: { getCaseEvidence: vi.fn(async () => mocks.evidence) },
    witnesses: { getCaseWitnesses: vi.fn(async () => mocks.witnesses) },
    interactions: { getSessionInteractions: vi.fn(async () => mocks.interactions), addInteraction: mocks.addInteraction },
    cases: {
      getCaseWithDetails: vi.fn(async () => ({
        id: 'c1', title: 'The Murder Mystery', case_type: 'homicide', description: 'A wealthy business owner was found dead.',
        defendant_name: 'Helen John', case_summary: ''
      }))
    }
  }
}));
vi.mock('../lib/ai/trialAI', () => ({ generateWitnessResponse: mocks.generateWitnessResponse }));
vi.mock('../lib/speech', () => ({ speakAs: vi.fn() }));
vi.mock('../lib/useSpeechRecognition', () => ({ useSpeechRecognition: () => ({ isListening: false, isSupported: false, start: vi.fn(), stop: vi.fn() }) }));

import Investigation from './Investigation';

const session = { id: 's1', case_id: 'c1' } as never;

beforeEach(() => {
  mocks.evidence = [{ id: 'e1', case_id: 'c1', exhibit_label: 'A', title: 'Crime Scene Photos', description: 'Photos of the office', evidence_type: 'photographs', is_hidden: false }];
  mocks.witnesses = [{ id: 'w1', case_id: 'c1', name: 'Dr. Elizabeth Warren', role: 'medical examiner', background: 'Ten years on the job', base_testimony: 'Time of death was 9pm.' }];
  mocks.interactions = [];
  mocks.addInteraction.mockReset().mockImplementation(async (i: Record<string, unknown>) => ({ id: 'i1', ...i }));
  mocks.generateWitnessResponse.mockReset().mockResolvedValue('I examined the body at 10pm.');
});

const open = async (props: Partial<React.ComponentProps<typeof Investigation>> = {}) => {
  const onProceedToTrial = vi.fn();
  const onBack = vi.fn();
  render(<Investigation session={session} onProceedToTrial={onProceedToTrial} onBack={onBack} {...props} />);
  await screen.findByText('The Murder Mystery', { selector: 'h2' });
  return { onProceedToTrial, onBack };
};

describe('Investigation', () => {
  it('opens on the case brief, with counts on the evidence and witness tabs', async () => {
    await open();
    expect(screen.getByText('A wealthy business owner was found dead.')).toBeInTheDocument();
    expect(screen.getByText('Defendant: Helen John')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /EVIDENCE/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /WITNESSES/ })).toHaveTextContent('1');
  });

  it('proceed to trial is always on the main screen', async () => {
    const { onProceedToTrial } = await open();
    fireEvent.click(screen.getByRole('button', { name: /PROCEED TO TRIAL/ }));
    expect(onProceedToTrial).toHaveBeenCalled();
  });

  it('shows evidence as exhibit cards', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: /EVIDENCE/ }));
    const card = screen.getByText('Crime Scene Photos').closest('button') as HTMLElement;
    expect(within(card).getByText('Photographs')).toBeInTheDocument();
    expect(within(card).getByText('A')).toBeInTheDocument();
  });

  it('interviews a witness in a full-screen chat and keeps the answer', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: /WITNESSES/ }));
    expect(screen.getByText('Not interviewed yet')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Dr. Elizabeth Warren'));

    // chat view replaces the list: no proceed button here, the input is on screen
    expect(screen.queryByRole('button', { name: /PROCEED TO TRIAL/ })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/Ask Elizabeth|Ask Dr\./), { target: { value: 'When did you examine the body?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }));

    expect(await screen.findByText('I examined the body at 10pm.')).toBeInTheDocument();
    expect(screen.getByText('When did you examine the body?')).toBeInTheDocument();
    expect(mocks.addInteraction).toHaveBeenCalledWith(expect.objectContaining({ witness_id: 'w1', question: 'When did you examine the body?' }));

    fireEvent.click(screen.getByRole('button', { name: 'Back to witnesses' }));
    expect(await screen.findByText('1 question asked')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /PROCEED TO TRIAL/ })).toBeInTheDocument());
  });

  it('reviewing a case before a game exists shows only the brief and lets you accept', async () => {
    const onReviewAccept = vi.fn();
    const caseForReview = { id: 'c1', title: 'The Murder Mystery', description: 'Brief text.', defendant_name: 'Helen John' } as never;
    render(<Investigation session={null} showCaseReview caseForReview={caseForReview} onProceedToTrial={vi.fn()} onBack={vi.fn()} onReviewAccept={onReviewAccept} />);
    expect(await screen.findByText('CASE BRIEF')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ACCEPT CASE' }));
    expect(await screen.findByText("YOU'RE ON THE CASE")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'BEGIN INVESTIGATION' }));
    expect(onReviewAccept).toHaveBeenCalled();
  });
});
