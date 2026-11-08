import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRandomJurors: vi.fn(),
  getJurorsByIds: vi.fn(),
  getSessionJurySelections: vi.fn(),
  addJurySelection: vi.fn(),
  removeJurySelection: vi.fn(),
  getSession: vi.fn(),
  mergeState: vi.fn()
}));

vi.mock('../lib/database', () => ({
  db: {
    jurors: { getRandomJurors: mocks.getRandomJurors, getJurorsByIds: mocks.getJurorsByIds },
    jurySelections: {
      getSessionJurySelections: mocks.getSessionJurySelections,
      addJurySelection: mocks.addJurySelection,
      removeJurySelection: mocks.removeJurySelection
    },
    sessions: { getSession: mocks.getSession, mergeState: mocks.mergeState }
  }
}));

import JurySelection from './JurySelection';

const juror = (id: string, name: string) => ({
  id, name, age: 40, occupation: 'Teacher', background: `${name} background`, personality_traits: ['Fair'], biases: [], created_at: ''
});
const POOL = [juror('j1', 'Robert Jenkins'), juror('j2', 'Sarah Whitfield'), juror('j3', 'Kwame Mensah'), juror('j4', 'Ada Obi')];
const sel = (id: string, juror_id: string, selected_by: string, order: number) => ({ id, session_id: 's1', juror_id, selected_by, selection_order: order });

let nextId = 1;
beforeEach(() => {
  nextId = 1;
  mocks.getRandomJurors.mockReset().mockResolvedValue(POOL);
  mocks.getJurorsByIds.mockReset().mockImplementation(async (ids: string[]) => POOL.filter(p => ids.includes(p.id)));
  mocks.getSessionJurySelections.mockReset().mockResolvedValue([]);
  mocks.removeJurySelection.mockReset().mockResolvedValue(undefined);
  mocks.addJurySelection.mockReset().mockImplementation(async (s: Record<string, unknown>) => ({ id: `sel-${nextId++}`, ...s }));
  mocks.getSession.mockReset().mockResolvedValue({ session_state: {} });
  mocks.mergeState.mockReset().mockResolvedValue({});
});

describe('JurySelection as the prosecution against the AI', () => {
  it('lets the human pick for the prosecution while the AI defense picks first', async () => {
    render(<JurySelection sessionId="s1" maxJurors={4} mySide="prosecution" mode="ai" onComplete={vi.fn()} />);
    // The AI (defense) goes first; then it is the human's turn, as the prosecution.
    await waitFor(() => expect(mocks.addJurySelection).toHaveBeenCalledWith(expect.objectContaining({ selected_by: 'defense' })), { timeout: 3000 });
    await waitFor(() => expect(screen.getByText(/Your pick — 2 more for the prosecution/)).toBeInTheDocument());
    const pickButtons = screen.getAllByRole('button', { name: 'PICK' });
    fireEvent.click(pickButtons[0]);
    await waitFor(() => expect(mocks.addJurySelection).toHaveBeenCalledWith(expect.objectContaining({ selected_by: 'prosecution' })));
  });
});

describe('JurySelection online, two real players', () => {
  it('never picks for the opponent, and shows their pick live so I can pick next without reloading', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mocks.getSession.mockResolvedValue({ session_state: { jurorPoolIds: ['j1', 'j2', 'j3', 'j4'] } });
      // I am the prosecution: the defense (the other player) picks first.
      render(<JurySelection sessionId="s1" maxJurors={4} mySide="prosecution" mode="online" isHost={false} opponentName="Chidi" onComplete={vi.fn()} />);
      expect(await screen.findByText('Robert Jenkins')).toBeInTheDocument();
      expect(screen.getByText(/Chidi is choosing a juror/)).toBeInTheDocument();
      screen.getAllByRole('button', { name: 'PICK' }).forEach(b => expect(b).toBeDisabled());

      // Time passes: nothing may be picked on anyone's behalf.
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
      expect(mocks.addJurySelection).not.toHaveBeenCalled();

      // The opponent picks; on the next poll it is my turn.
      mocks.getSessionJurySelections.mockResolvedValue([sel('a', 'j1', 'defense', 1)]);
      await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
      await waitFor(() => expect(screen.getByText(/Your pick — 2 more for the prosecution/)).toBeInTheDocument());
      expect(screen.queryByText('Robert Jenkins')).not.toBeInTheDocument(); // taken from the shared pool
      fireEvent.click(screen.getAllByRole('button', { name: 'PICK' })[0]);
      await waitFor(() => expect(mocks.addJurySelection).toHaveBeenCalledWith(expect.objectContaining({ selected_by: 'prosecution' })));
    } finally {
      vi.useRealTimers();
    }
  });

  it('the host draws the pool once and saves it so both players choose from the same people', async () => {
    render(<JurySelection sessionId="s1" maxJurors={4} mySide="defense" mode="online" isHost onComplete={vi.fn()} />);
    expect(await screen.findByText('Robert Jenkins')).toBeInTheDocument();
    await waitFor(() => expect(mocks.mergeState).toHaveBeenCalledWith('s1', { jurorPoolIds: ['j1', 'j2', 'j3', 'j4'] }));
    // I am the defense, so it is my turn straight away.
    expect(screen.getByText(/Your pick — 2 more for the defense/)).toBeInTheDocument();
  });

  it('the guest uses the host\'s saved pool instead of drawing their own', async () => {
    mocks.getSession.mockResolvedValue({ session_state: { jurorPoolIds: ['j3', 'j4'] } });
    render(<JurySelection sessionId="s1" maxJurors={2} mySide="prosecution" mode="online" isHost={false} onComplete={vi.fn()} />);
    expect(await screen.findByText('Kwame Mensah')).toBeInTheDocument();
    expect(screen.queryByText('Robert Jenkins')).not.toBeInTheDocument();
    expect(mocks.getRandomJurors).not.toHaveBeenCalled();
  });
});
